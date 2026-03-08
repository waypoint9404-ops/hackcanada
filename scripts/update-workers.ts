import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL!;
const supabaseKey = process.env.SUPABASE_DEFAULT_SECRET_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const userId = "fa297850-93c3-409e-9c74-5d9d5fcafea0";
  console.log("Updating to user ID:", userId);
  const names = [
    "Evelyn Hart", "Jamal Oates", "Clara & Mateo Silva", "Leo Vance", 
    "Nora Blake", "Samuel 'Sammy' Tucker", "Kim Jin", "Tyler Dunn", 
    "Maria Gonzalez", "Henry Cobb", "Chloe & Liam Peterson", "Robert Lin", 
    "Zainab Al-Fayed", "Dominic Foster", "Patricia 'Patty' O'Connor"
  ];
  const { error } = await supabase.from("clients").update({ assigned_worker_id: userId }).in("name", names);
  if (error) console.error("Error:", error);
  else console.log("Success! Updated 15 clients to waypoint9404@gmail.com (ID: " + userId + ")");
}
run();
