import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { createThread, sendMessageWithModel, GEMINI_FLASH_CONFIG } from "../lib/backboard";

// Load environment variables
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL!;
const supabaseKey = process.env.SUPABASE_DEFAULT_SECRET_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Hardcoded worker emails
const WORKER_EMAILS = [
  "aamirfiretv777@gmail.com",
  "dhimanishaan7@gmail.com",
  "dhairyashah2513@gmail.com"
];

const SUMMARY_PROMPT = `You are Waypoint, a case management assistant for municipal social workers.
Based on everything you know about this client from all previous interactions:

Generate an **actionable summary** in exactly this format:
1. A 2-3 sentence overview of the client's CURRENT situation
2. Their current risk level (LOW / MED / HIGH) with a brief justification
3. 2-3 specific action items for the social worker's next visit

Be factual, concise, and objective. Use present tense. Do not speculate.`;

// Realistic seed data for municipal social workers
// workerIndex determines which worker gets assigned (0, 1, or 2)
const SEED_CLIENTS = [
  {
    name: "Marcus Thorne",
    phone: "+1 (416) 555-0891",
    tags: ["HOUSING", "MENTAL_HEALTH"],
    risk_level: "HIGH",
    workerIndex: 0,
    notes: [
      "Met Marcus near the underpass on King St. He was highly agitated, pacing erratically. Claims he hasn't slept in 3 days. Refused offer for shelter bed, citing safety concerns. Gave him a harm reduction kit and water.",
      "Follow-up: Marcus is calmer today. Says he lost his ID last week which is preventing him from accessing his OW payments. Agreed to meet tomorrow morning to start the ID replacement process at the community center."
    ]
  },
  {
    name: "Elena Rostova",
    phone: "+1 (416) 555-0234",
    tags: ["EMPLOYMENT", "LEGAL"],
    risk_level: "LOW",
    workerIndex: 0,
    notes: [
      "Initial intake: Elena recently lost her job at the processing plant due to restructuring. Facing potential eviction next month if she can't make rent. Needs help navigating EI application.",
      "Assisted Elena with submitting EI forms online. Also provided a referral to Legal Aid regarding a dispute with her previous landlord over a damage deposit."
    ]
  },
  {
    name: "David Chen",
    phone: "+1 (416) 555-0788",
    tags: ["SUBSTANCE_USE", "MEDICAL"],
    risk_level: "MED",
    workerIndex: 1,
    notes: [
      "Visited David at his supported housing unit. He looks pale and reports a persistent cough. Admits he relapsed over the weekend after 2 months sober. Needs a doctor's appointment.",
      "Accompanied David to the walk-in clinic. Diagnosed with a mild chest infection, prescribed antibiotics. He expressed desire to return to the weekly support group; provided him with the updated schedule."
    ]
  },
  {
    name: "Sarah Jenkins & Family",
    phone: "+1 (416) 555-0445",
    tags: ["HOUSING", "FAMILY_SUPPORT"],
    risk_level: "MED",
    workerIndex: 1,
    notes: [
      "Family of four currently staying in the municipal family shelter. Sarah is stressed about finding stable housing before the school year starts for her eldest daughter.",
      "Completed the centralized housing waitlist application. Discussed school enrollment strategies for the kids while they are in temporary housing."
    ]
  },
  {
    name: "Jordan 'JD' Davis",
    phone: null,
    tags: ["YOUTH", "SUBSTANCE_USE"],
    risk_level: "HIGH",
    workerIndex: 0,
    notes: [
      "Street outreach encounter at the park. JD (19yo) was found sleeping on a bench. Seemed disoriented, possible intoxication. Provided a snack and a sleeping bag.",
      "Saw JD again in the youth drop-in center. He engaged in conversation today. Mentioned he left his foster home 3 months ago. Introduced him to the youth housing navigator."
    ]
  }
];

async function seed() {
  console.log("🌱 Starting Waypoint Database Seed...\n");

  // ── Step 0: Clean up stale data ──────────────────────────────────────────
  // Remove old SQL-migration seed clients (no Backboard thread = not functional)
  // and any previous script runs so we start fresh.
  console.log("🧹 Cleaning up old seed data...");
  const seedNames = SEED_CLIENTS.map(c => c.name);
  const legacyNames = ["Alex Mercer", "Sam Riley", "Jamie Torres"];
  const allNames = [...seedNames, ...legacyNames];

  const { data: existing } = await supabase
    .from("clients")
    .select("id, name")
    .in("name", allNames);

  if (existing && existing.length > 0) {
    const ids = existing.map(c => c.id);
    // Clean up note_edits for these clients (if table exists)
    try {
      await supabase.from("note_edits").delete().in("client_id", ids);
    } catch { /* table may not exist */ }
    
    await supabase.from("clients").delete().in("id", ids);
    console.log(`  └─ Removed ${existing.length} existing clients: ${existing.map(c => c.name).join(", ")}`);
  } else {
    console.log("  └─ No stale data found");
  }

  // ── Step 1: Look up workers by email ─────────────────────────────────────
  console.log("\n👤 Looking up workers...");
  const workerIds: (string | null)[] = [];
  for (const email of WORKER_EMAILS) {
    const { data: worker } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .single();
    if (worker) {
      workerIds.push(worker.id);
      console.log(`  └─ Found worker for ${email}: ${worker.id}`);
    } else {
      workerIds.push(null);
      console.log(`  ⚠️ No worker found for ${email}`);
    }
  }

  // ── Step 2: Process each client ──────────────────────────────────────────
  for (const clientData of SEED_CLIENTS) {
    const workerId = workerIds[clientData.workerIndex] || null;
    console.log(`\n⏳ Processing client: ${clientData.name} → ${WORKER_EMAILS[clientData.workerIndex]} (${workerId || "unassigned"})`);

    try {
      // 2a. Create Backboard thread
      console.log(`  └─ Creating Backboard thread...`);
      const thread = await createThread();
      const threadId = thread.thread_id;
      console.log(`  └─ Thread created: ${threadId}`);

      // 2b. Insert into Supabase (no summary yet — will be generated after notes)
      console.log(`  └─ Inserting into Supabase...`);
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
      console.log(`  └─ Supabase ID: ${dbClient.id}`);

      // 2c. Seed historical notes into Backboard thread
      console.log(`  └─ Ingesting ${clientData.notes.length} notes into Backboard...`);
      
      for (const [index, note] of clientData.notes.entries()) {
        const daysAgo = (clientData.notes.length - index) * 4;
        const mockDate = new Date();
        mockDate.setDate(mockDate.getDate() - daysAgo);
        
        const prompt = `[HISTORICAL CASE NOTE IMPORT]\nDate: ${mockDate.toISOString()}\nClient: ${clientData.name}\n\nNote:\n${note}\n\nPlease ingest this historical record into the client's memory.`;
        
        await sendMessageWithModel(threadId, prompt, GEMINI_FLASH_CONFIG, { memory: "Auto" });
        console.log(`     ✓ Note ${index + 1}/${clientData.notes.length} ingested`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limit pause
      }

      // 2d. Generate initial summary from Backboard and store in Supabase
      console.log(`  └─ Generating AI summary...`);
      const summaryResponse = await sendMessageWithModel(
        threadId,
        SUMMARY_PROMPT,
        GEMINI_FLASH_CONFIG,
        { memory: "Readonly" }
      );

      const summaryText = summaryResponse.content ?? "Summary generation pending.";

      await supabase
        .from("clients")
        .update({
          summary: summaryText,
          updated_at: new Date().toISOString()
        })
        .eq("id", dbClient.id);

      console.log(`  └─ Summary saved to Supabase ✓`);
      console.log(`  ✅ Done with ${clientData.name}`);

      // Pause between clients to avoid API rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (err) {
      console.error(`❌ Error processing ${clientData.name}:`, err);
    }
  }

  console.log("\n✅ Seeding complete! All clients have:");
  console.log("  • A Supabase record with summary, tags, risk_level");
  console.log("  • A Backboard thread with ingested case history");
  console.log("  • An AI-generated summary cached in Supabase");
}

seed().catch(console.error);