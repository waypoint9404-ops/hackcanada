import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local") });

const sb = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_DEFAULT_SECRET_KEY!);

async function debug() {
  // 1. Show all appointments
  const { data: appts } = await sb
    .from("appointments")
    .select("id, title, starts_at, status, source, worker_id")
    .order("starts_at");
  
  console.log("\n📅 APPOINTMENTS IN DB:");
  for (const a of appts || []) {
    console.log(`  ${a.starts_at} | ${a.status.padEnd(10)} | ${a.worker_id} | ${a.title}`);
  }
  console.log(`  Total: ${appts?.length || 0}`);

  // 2. Show all workers
  const { data: workers } = await sb.from("users").select("id, email, name");
  console.log("\n👤 WORKERS IN DB:");
  for (const w of workers || []) {
    console.log(`  ${w.id} | ${w.email} | ${w.name}`);
  }

  // 3. Test the same query the API uses
  const tz = "America/Toronto";
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayStr = formatter.format(now);
  const startOfDay = new Date(`${todayStr}T00:00:00`);
  const endOfDay = new Date(`${todayStr}T23:59:59.999`);

  console.log(`\n🕐 DATE DEBUG:`);
  console.log(`  todayStr (formatted): ${todayStr}`);
  console.log(`  startOfDay ISO:       ${startOfDay.toISOString()}`);
  console.log(`  endOfDay ISO:         ${endOfDay.toISOString()}`);

  // 4. Query for each worker to see what matches
  for (const w of workers || []) {
    const { data: todayAppts } = await sb
      .from("appointments")
      .select("id, title, starts_at, status")
      .eq("worker_id", w.id)
      .in("status", ["confirmed", "tentative"])
      .gte("starts_at", startOfDay.toISOString())
      .lte("starts_at", endOfDay.toISOString())
      .order("starts_at");
    
    console.log(`\n  Worker ${w.email}: ${todayAppts?.length || 0} today appointments`);
    for (const a of todayAppts || []) {
      console.log(`    ${a.starts_at} | ${a.status} | ${a.title}`);
    }
  }
}

debug().catch(console.error);
