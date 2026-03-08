import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

/**
 * Seed appointments for the Smart Triage Itinerary.
 *
 * Run:  npx tsx scripts/seed-appointments.ts
 *
 * This script:
 * 1. Looks up existing workers by email
 * 2. Looks up existing seeded clients by name
 * 3. Creates realistic appointments for today + upcoming days
 * 4. Mixes confirmed, tentative (AI-extracted), and past appointments
 *
 * Prerequisites:
 *   - Run the 004_create_appointments.sql migration first
 *   - Run seed-clients.ts first so clients exist
 */

// Load environment variables
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL!;
const supabaseKey = process.env.SUPABASE_DEFAULT_SECRET_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Helper: create a date relative to today ─────────────────────────────────

function relativeDate(daysOffset: number, hours: number, minutes: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

function addHours(iso: string, h: number): string {
  return new Date(new Date(iso).getTime() + h * 60 * 60 * 1000).toISOString();
}

// ─── Appointment templates ───────────────────────────────────────────────────
// These are assigned to EVERY worker in the DB so any logged-in account sees data.

interface AppointmentTemplate {
  clientName: string;
  title: string;
  event_type: string;
  daysOffset: number;     // 0 = today, 1 = tomorrow, -1 = yesterday
  hour: number;
  minute?: number;
  durationHours?: number; // default 1
  location: string | null;
  notes: string | null;
  source: "ai_extracted" | "manual";
  status: "confirmed" | "tentative" | "dismissed" | "completed";
}

const APPOINTMENT_TEMPLATES: AppointmentTemplate[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // TODAY — Confirmed appointments
  // ═══════════════════════════════════════════════════════════════════════════

  {
    clientName: "Marcus Thorne",
    title: "Court Transport — Bail Hearing",
    event_type: "transport",
    daysOffset: 0,
    hour: 8,
    minute: 30,
    durationHours: 2,
    location: "Ontario Superior Court, 361 University Ave",
    notes: "Pick up Marcus near the King St underpass by 8:15. Bring extra ID replacement docs. Check his left foot for frostbite — he mentioned pain yesterday.",
    source: "manual",
    status: "confirmed",
  },
  {
    clientName: "Elena Rostova",
    title: "EI Application Follow-up",
    event_type: "office",
    daysOffset: 0,
    hour: 11,
    minute: 0,
    location: "Community Resource Centre, 120 Carlton St",
    notes: "Review EI documentation status. Bring printout of legal aid referral.",
    source: "ai_extracted",
    status: "confirmed",
  },
  {
    clientName: "David Chen",
    title: "Chest Infection Follow-up at Clinic",
    event_type: "medical",
    daysOffset: 0,
    hour: 9,
    minute: 0,
    durationHours: 1.5,
    location: "Parkdale Community Health Centre, 1229 Queen St W",
    notes: "Accompanying David for antibiotic follow-up. Ask about support group schedule.",
    source: "manual",
    status: "confirmed",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TODAY — Tentative (AI-extracted, need confirm/dismiss)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    clientName: "Jordan 'JD' Davis",
    title: "Drop-in Check — Youth Housing Follow-up",
    event_type: "home_visit",
    daysOffset: 0,
    hour: 14,
    minute: 0,
    location: "Youth Drop-in Centre, 40 Oak St",
    notes: "JD mentioned he'd try to be at the drop-in today. AI extracted from last visit transcript: 'I'll try to come by Tuesday around 2.'",
    source: "ai_extracted",
    status: "tentative",
  },
  {
    clientName: "Marcus Thorne",
    title: "Post-Hearing Phone Debrief",
    event_type: "phone_call",
    daysOffset: 0,
    hour: 16,
    minute: 30,
    durationHours: 0.5,
    location: null,
    notes: "AI extracted: Worker mentioned 'I'll call you after court to see how it went' during transport.",
    source: "ai_extracted",
    status: "tentative",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TOMORROW (affects deadline scoring in suggestions)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    clientName: "Elena Rostova",
    title: "Legal Aid Appointment",
    event_type: "court",
    daysOffset: 1,
    hour: 10,
    minute: 0,
    durationHours: 2,
    location: "Legal Aid Ontario, 40 Dundas St W",
    notes: "Representing Elena in landlord deposit dispute. Bring all documentation.",
    source: "manual",
    status: "confirmed",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 3 DAYS FROM NOW (tests deadline scoring)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    clientName: "Jordan 'JD' Davis",
    title: "Youth Housing Navigator Intake Meeting",
    event_type: "office",
    daysOffset: 3,
    hour: 9,
    minute: 30,
    location: "Youth Services, 365 Bloor St E",
    notes: "Critical: JD's intake for youth transitional housing. Must attend or slot is given away.",
    source: "manual",
    status: "confirmed",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // YESTERDAY (completed — proves history, won't show in "today")
  // ═══════════════════════════════════════════════════════════════════════════

  {
    clientName: "Elena Rostova",
    title: "EI Office Visit",
    event_type: "office",
    daysOffset: -1,
    hour: 14,
    minute: 0,
    location: "Service Canada, 25 St Clair Ave E",
    notes: "Submitted EI forms. Elena was relieved — expects first payment in 2 weeks.",
    source: "manual",
    status: "completed",
  },
];

// ─── Seed logic ──────────────────────────────────────────────────────────────

async function seed() {
  console.log("📅 Starting Appointment Seed for Smart Triage Itinerary...\n");

  // Clean up old seed appointments
  console.log("🧹 Cleaning up previous appointments...");
  const { data: existingAppts, error: cleanErr } = await supabase
    .from("appointments")
    .select("id")
    .limit(1000);

  if (cleanErr) {
    console.error("  ⚠️  Could not check for existing appointments:", cleanErr.message);
    console.error("  → Make sure you've run 004_create_appointments.sql migration first!");
    process.exit(1);
  }

  if (existingAppts && existingAppts.length > 0) {
    const ids = existingAppts.map((a) => a.id);
    await supabase.from("appointments").delete().in("id", ids);
    console.log(`  └─ Removed ${existingAppts.length} existing appointments`);
  } else {
    console.log("  └─ No existing appointments found");
  }

  // Look up ALL workers in the database
  console.log("\n👤 Looking up ALL workers...");
  const { data: workers } = await supabase.from("users").select("id, email, name");
  if (!workers || workers.length === 0) {
    console.error("  ⚠️  No workers found. Log in to the app first.");
    process.exit(1);
  }
  for (const w of workers) {
    console.log(`  └─ ${w.email} → ${w.id} (${w.name})`);
  }

  // Look up ALL clients
  console.log("\n🔍 Looking up clients...");
  const { data: allClients } = await supabase
    .from("clients")
    .select("id, name, assigned_worker_id");

  if (!allClients || allClients.length === 0) {
    console.error("  ⚠️  No clients found. Run seed-clients.ts first.");
    process.exit(1);
  }

  const clientByName = new Map<string, { id: string; name: string }>();
  for (const c of allClients) {
    clientByName.set(c.name, { id: c.id, name: c.name });
    console.log(`  └─ ${c.name} → ${c.id}`);
  }

  // Also build a list of all client IDs to cycle through
  const allClientIds = allClients.map((c) => c.id);

  // ── Create appointments for EVERY worker ────────────────────────────────
  // This guarantees any logged-in account sees data.
  console.log("\n📝 Creating appointments for EVERY worker...");
  let created = 0;
  let skipped = 0;

  for (const worker of workers) {
    console.log(`\n  👷 Worker: ${worker.email}`);

    // Find clients for this worker (prefer assigned, fall back to all)
    const workerClients = allClients.filter(
      (c) => c.assigned_worker_id === worker.id
    );
    // Use worker's own clients if any, otherwise use all clients
    const clientPool =
      workerClients.length >= 2 ? workerClients : allClients;

    for (const tmpl of APPOINTMENT_TEMPLATES) {
      // Resolve client — try exact name match first, then pick from pool
      let clientId: string | null = null;
      let clientName = tmpl.clientName;

      const exactMatch = clientByName.get(tmpl.clientName);
      if (exactMatch) {
        clientId = exactMatch.id;
      } else {
        // Pick a deterministic client from pool based on template title hash
        const hash = tmpl.title.length + tmpl.hour;
        const picked = clientPool[hash % clientPool.length];
        clientId = picked.id;
        clientName = picked.name;
      }

      const startsAt = relativeDate(tmpl.daysOffset, tmpl.hour, tmpl.minute || 0);
      const endsAt = addHours(startsAt, tmpl.durationHours ?? 1);

      const { error: insertErr } = await supabase.from("appointments").insert({
        worker_id: worker.id,
        client_id: clientId,
        title: tmpl.title,
        event_type: tmpl.event_type,
        starts_at: startsAt,
        ends_at: endsAt,
        location: tmpl.location,
        notes: tmpl.notes,
        source: tmpl.source,
        status: tmpl.status,
      });

      if (insertErr) {
        console.error(`    ❌ Failed: "${tmpl.title}" — ${insertErr.message}`);
        skipped++;
      } else {
        const dayLabel =
          tmpl.daysOffset === 0
            ? "TODAY"
            : tmpl.daysOffset === 1
              ? "TOMORROW"
              : tmpl.daysOffset === -1
                ? "YESTERDAY"
                : `+${tmpl.daysOffset}d`;

        const statusIcon =
          tmpl.status === "confirmed"
            ? "✓"
            : tmpl.status === "tentative"
              ? "?"
              : tmpl.status === "completed"
                ? "✔"
                : "✗";

        console.log(
          `    ${statusIcon} [${dayLabel} ${tmpl.hour}:${String(tmpl.minute || 0).padStart(2, "0")}] ${tmpl.title} → ${clientName}`
        );
        created++;
      }
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n✅ Appointment seeding complete!`);
  console.log(`   Created: ${created} | Skipped: ${skipped}`);
  console.log(`   Seeded for ${workers.length} workers × ${APPOINTMENT_TEMPLATES.length} templates`);
  console.log(`\n📋 What to test:`);
  console.log(`   1. Navigate to /today — you should see today's schedule`);
  console.log(`   2. Tentative (AI-extracted) cards show dashed borders with Confirm/Dismiss`);
  console.log(`   3. "Play Morning Briefing" generates an audio summary of the day`);
  console.log(`   4. "Suggested Visits" shows triaged clients not on today's schedule`);
  console.log(`   5. "Add Appointment" opens a form sheet to create manual events`);

  // Also backdate some clients' updated_at to make triage suggestions more interesting
  console.log(`\n🕐 Backdating client updated_at for triage scoring...`);

  const jdId = clientByName.get("Jordan 'JD' Davis")?.id;
  if (jdId) {
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - 14);
    await supabase.from("clients").update({ updated_at: staleDate.toISOString() }).eq("id", jdId);
    console.log(`  └─ Jordan 'JD' Davis updated_at → 14 days ago`);
  }

  const elenaId = clientByName.get("Elena Rostova")?.id;
  if (elenaId) {
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - 8);
    await supabase.from("clients").update({ updated_at: staleDate.toISOString() }).eq("id", elenaId);
    console.log(`  └─ Elena Rostova updated_at → 8 days ago`);
  }

  console.log(`\nDone! 🚀 Every worker now has ${APPOINTMENT_TEMPLATES.filter(t => t.daysOffset === 0).length} today appointments.`);
}

seed().catch(console.error);
