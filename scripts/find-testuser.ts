import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL!;
const supabaseKey = process.env.SUPABASE_DEFAULT_SECRET_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: client, error } = await supabase.from("clients").select("name, assigned_worker_id").eq("name", "TestUser").single();
  if (error) console.error("Error:", error);
  else console.log("TestUser assigned to:", client.assigned_worker_id);
}
run();
