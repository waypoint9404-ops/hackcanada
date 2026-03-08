import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { createThread, sendMessageWithModel } from "../lib/backboard";
import { regenerateSummary } from "../lib/regenerate-summary";
import { SEED_CLIENTS } from "./seed-data";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL!;
const supabaseKey = process.env.SUPABASE_DEFAULT_SECRET_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

const GEMINI_FLASH_CONFIG = {
  llmProvider: "google",
  modelName: "gemini-3-flash-preview"
};

const NOTE_STRUCTURING_PROMPT = `You are a factual case-note extraction agent for a municipal social worker's records.

CRITICAL RULES — FOLLOW EXACTLY:
- Extract ONLY objective, verifiable facts from the transcript.
- Report only what was directly observed, stated, or done. Use language like "Client stated…", "Worker observed…", "Client was seen at…".
- NEVER infer, assume, or interpret emotional states, motivations, mental health conditions, or intentions unless the client or worker explicitly stated them.
- NEVER add information that is not present in the transcript. If something is unclear, omit it.
- Do NOT speculate, editorialize, or add recommendations. Recommendations are the social worker's job.
- Do NOT use phrases like "appeared to be", "seemed", "likely", "probably", or "may have".
- These notes may be subpoenaed. Accuracy and objectivity are legally critical.

FORMAT:
- Start with a 1-2 sentence factual summary of the visit/interaction (who, where, when, what).
- Follow with bullet points covering ONLY: direct client statements (quoted or paraphrased with attribution), observed physical conditions or environment, concrete actions taken by the worker, and any follow-up commitments made.
- Use professional, clinical, third-person language.
- Be concise — include all verifiable details, exclude everything else.
- Do NOT include the raw transcript itself.
- At the very end of your response, on a new line, output EXACTLY one of these risk tags: [RISK:LOW] [RISK:MED] [RISK:HIGH]
  Choose based on the factual severity: HIGH = immediate danger, legal jeopardy, or urgent medical need; MED = notable but non-urgent concerns; LOW = routine check-in with no red flags.

Raw transcript:
`;

async function seed() {
  console.log("🌱 Starting Waypoint Extensive Database Seed with Factual AI Format (v3)...\n");

  console.log("🧹 Cleaning up old seed data...");
  const seedNames = SEED_CLIENTS.map(c => c.name);
  const legacyNames = ["Alex Mercer", "Sam Riley", "Jamie Torres", "Marcus Thorne", "Elena Rostova", "David Chen", "Sarah Jenkins & Family", "Jordan 'JD' Davis", "Patricia 'Patty' O'Connor", "Samuel 'Sammy' Tucker", "TestUser"];
  const allNames = [...new Set([...seedNames, ...legacyNames])];

  const { data: existing } = await supabase
    .from("clients")
    .select("id, name")
    .in("name", allNames);

  if (existing && existing.length > 0) {
    const ids = existing.map(c => c.id);
    try {
      await supabase.from("note_edits").delete().in("client_id", ids);
    } catch { /* table may not exist */ }
    
    await supabase.from("clients").delete().in("id", ids);
    console.log(`  └─ Removed ${existing.length} existing clients: ${existing.map(c => c.name).join(", ")}`);
  } else {
    console.log("  └─ No stale data found");
  }

  const workerId = "fa297850-93c3-409e-9c74-5d9d5fcafea0";
  console.log(`\n👤 Using hardcoded worker ID: ${workerId}`);

  const CHUNK_SIZE = 5;
  for (let i = 0; i < SEED_CLIENTS.length; i += CHUNK_SIZE) {
    const chunk = SEED_CLIENTS.slice(i, i + CHUNK_SIZE);
    
    await Promise.all(chunk.map(async (clientData) => {
      console.log(`\n⏳ Processing client: ${clientData.name}`);

      try {
        console.log(`  └─ [${clientData.name}] Creating Backboard thread...`);
        const thread = await createThread();
        const threadId = thread.thread_id;
        console.log(`  └─ [${clientData.name}] Thread created: ${threadId}`);

        console.log(`  └─ [${clientData.name}] Inserting into Supabase...`);
        const { data: dbClient, error: insertError } = await supabase
          .from("clients")
          .insert({
            name: clientData.name,
            phone: clientData.phone,
            tags: clientData.tags,
            risk_level: clientData.risk_level as "LOW" | "MED" | "HIGH",
            backboard_thread_id: threadId,
            assigned_worker_id: workerId
          })
          .select()
          .single();

        if (insertError) throw insertError;
        console.log(`  └─ [${clientData.name}] Supabase ID: ${dbClient.id}`);

        console.log(`  └─ [${clientData.name}] Ingesting ${clientData.notes.length} notes into Backboard...`);
        
        for (const [index, note] of clientData.notes.entries()) {
          const daysAgo = (clientData.notes.length - index) * 4;
          const mockDate = new Date();
          mockDate.setDate(mockDate.getDate() - daysAgo);
          
          const finalNote = note.replace("[Date]", mockDate.toLocaleDateString("en-US", { year: 'numeric', month: 'short', day: 'numeric' }));
          
          // Mimic the exact production app's ingestion API prompt:
          const prompt = `${NOTE_STRUCTURING_PROMPT}\nWorker's local date/time: ${mockDate.toISOString()}\nUse this date for the note.\n\n${finalNote}`;
          
          await sendMessageWithModel(threadId, prompt, GEMINI_FLASH_CONFIG, { memory: "Auto" });
          console.log(`     [${clientData.name}] ✓ Note ${index + 1}/${clientData.notes.length} ingested`);
          await new Promise(resolve => setTimeout(resolve, 2000)); 
        }

        console.log(`  └─ [${clientData.name}] Generating Actionable Summary via app logic...`);
        await regenerateSummary(dbClient.id, threadId);

        console.log(`  └─ [${clientData.name}] Summary saved to Supabase ✓`);
        console.log(`  ✅ [${clientData.name}] Done`);

      } catch (err) {
        console.error(`❌ [${clientData.name}] Error processing ${clientData.name}:`, err);
      }
    }));
    console.log(`\n⏳ Finished chunk. Waiting 2 seconds before next chunk...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log("\n✅ Extensive validly-formatted seeding complete! 15 new clients added.");
}

seed().catch(console.error);
