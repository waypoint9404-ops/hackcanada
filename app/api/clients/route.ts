import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createThread } from "@/lib/backboard";
import { auth0 } from "@/lib/auth0";
import { getCurrentWorkerId } from "@/lib/user-sync";

/**
 * GET /api/clients
 * Returns all clients for the logged-in worker.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth0.getSession(request);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    let workerId: string | null = null;
    try {
      workerId = await getCurrentWorkerId(session.user.sub);
    } catch (e) {
      console.warn("Worker not found for auth0 sub:", session.user.sub);
    }

    const supabase = createAdminClient();
    let query = supabase.from("clients").select("*").order("updated_at", { ascending: false });
    
    if (workerId) {
      query = query.eq("assigned_worker_id", workerId);
    }

    const { data: clients, error } = await query;
    if (error) throw error; 

    return NextResponse.json({ clients });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/**
 * POST /api/clients
 * Create a new client and auto-assign to the creating worker.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession(request);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { name, phone, tags, risk_level } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

    let workerId: string | null = null;
    try {
      workerId = await getCurrentWorkerId(session.user.sub);
    } catch (e) {
      console.warn("Worker not found for auth0 sub:", session.user.sub);
    }

    const supabase = createAdminClient();

    // 1. Create Backboard thread
    const thread = await createThread();

    // 2. Insert into Supabase
    const { data: client, error } = await supabase
      .from("clients")
      .insert({
        name: name.trim(),
        phone: phone?.trim() || null,
        tags: tags || [],
        risk_level: risk_level || "LOW",
        backboard_thread_id: thread.thread_id,
        assigned_worker_id: workerId || null
      })
      .select()
      .single();

    if (error || !client) throw error;

    return NextResponse.json({ success: true, client, threadId: thread.thread_id });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
