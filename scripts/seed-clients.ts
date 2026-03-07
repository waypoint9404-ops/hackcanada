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

// Realistic seed data for municipal social workers
const SEED_CLIENTS = [
  {
    name: "Marcus Thorne",
    phone: "+1 (416) 555-0891",
    tags: ["HOUSING", "MENTAL_HEALTH"],
    risk_level: "HIGH",
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
    notes: [
      "Street outreach encounter at the park. JD (19yo) was found sleeping on a bench. Seemed disoriented, possible intoxication. Provided a snack and a sleeping bag.",
      "Saw JD again in the youth drop-in center. He engaged in conversation today. Mentioned he left his foster home 3 months ago. Introduced him to the youth housing navigator."
    ]
  }
];

async function seed() {
  console.log("🌱 Starting Waypoint Database Seed...");

  // 1. Get the first worker (or null if none) to assign these clients
  const { data: worker } = await supabase.from("users").select("id").limit(1).single();
  const workerId = worker?.id || null;

  if (workerId) {
    console.log(`👤 Assigning clients to worker ID: ${workerId}`);
  } else {
    console.log(`⚠️ No workers found in 'users' table. Clients will be unassigned.`);
  }

  // 2. Process each client
  for (const clientData of SEED_CLIENTS) {
    console.log(`\n⏳ Processing client: ${clientData.name}`);

    try {
      // Create Backboard thread
      console.log(`  └─ Creating Backboard thread...`);
      const thread = await createThread();
      const threadId = thread.thread_id;

      // Insert into Supabase
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
      console.log(`  └─ Success! DB ID: ${dbClient.id}`);

      // Seed historical notes into Backboard
      console.log(`  └─ Seeding ${clientData.notes.length} historical notes into AI memory...`);
      
      for (const [index, note] of clientData.notes.entries()) {
        // We use a mock date for realism: 7 days ago and 3 days ago
        const daysAgo = clientData.notes.length - index * 4;
        const mockDate = new Date();
        mockDate.setDate(mockDate.getDate() - daysAgo);
        
        const prompt = `[HISTORICAL CASE NOTE IMPORT]\nDate: ${mockDate.toISOString()}\n\nNote:\n${note}\n\nPlease ingest this historical record into the client's memory.`;
        
        // Use flash config to save money/latency on bulk seed
        await sendMessageWithModel(threadId, prompt, GEMINI_FLASH_CONFIG, { memory: "Auto" });
        await new Promise(resolve => setTimeout(resolve, 1500)); // Rate limit pause
      }

      console.log(`  └─ Done with ${clientData.name}`);

    } catch (err) {
      console.error(`❌ Error processing ${clientData.name}:`, err);
    }
  }

  console.log("\n✅ Seeding complete.");
}

seed().catch(console.error);
