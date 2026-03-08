import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_DEFAULT_SECRET_KEY!; // service char key
const supabase = createClient(supabaseUrl, supabaseKey);

const backboardKey = process.env.BACKBOARD_API_KEY!;
const BASE_URL = "https://app.backboard.io/api";

async function testDelete() {
  const { data: clients } = await supabase
    .from("clients")
    .select("backboard_thread_id")
    .not("backboard_thread_id", "is", null)
    .limit(1);

  if (!clients || clients.length === 0) {
    console.log("No clients with threads found.");
    return;
  }

  const threadId = clients[0].backboard_thread_id;
  console.log("Testing with thread:", threadId);

  // Get messages
  const getRes = await fetch(`${BASE_URL}/threads/${threadId}`, {
    headers: { "X-API-Key": backboardKey }
  });
  const threadData = await getRes.json();
  const messages = threadData.messages || [];
  
  if (messages.length === 0) {
    console.log("No messages in thread.");
    return;
  }

  const lastMessage = messages[messages.length - 1];
  console.log("Will try to delete message:", lastMessage.run_id || lastMessage.id || lastMessage);

  const msgIdToDel = lastMessage.run_id || lastMessage.id;
  
  // What else can we do? We can't delete directly. Let's see if we can edit/override.
  // The Backboard.io Cookbook doesn't have an endpoint for this.
  // We can just add a new message to the thread indicating the previous message should be ignored!
  
  console.log("Completed analysis");
}

testDelete().catch(console.error);
