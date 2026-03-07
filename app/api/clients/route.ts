import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createThread } from "@/lib/backboard";

/**
 * GET /api/clients
 *
 * Returns all clients from Supabase for internal use (test dashboard, etc.)
 */
export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data: clients, error } = await supabase
      .from("clients")
      .select("id, name, phone, tags, risk_level, backboard_thread_id, summary")
      .order("name");

    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch clients: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ clients });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/clients
 *
 * Create a new client with auto-provisioned Backboard thread.
 *
 * Used by:
 * - "New client" flow when an unknown caller contacts the social worker
 * - "Upload call recording → New client" flow in the PWA
 *
 * Request body: { name: string, phone?: string, tags?: string[], risk_level?: string }
 * Response: { success, client } where client includes backboard_thread_id
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, tags, risk_level } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Client name is required." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Step 1: Create a Backboard thread for this client's AI memory
    const thread = await createThread();

    // Step 2: Insert the client into Supabase with the thread ID
    const { data: client, error: insertError } = await supabase
      .from("clients")
      .insert({
        name: name.trim(),
        phone: phone ?? null,
        tags: tags ?? [],
        risk_level: risk_level ?? "LOW",
        backboard_thread_id: thread.thread_id,
        summary: null,
      })
      .select(
        "id, name, phone, tags, risk_level, backboard_thread_id, summary, created_at"
      )
      .single();

    if (insertError || !client) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to create client: ${insertError?.message ?? "unknown error"}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      client,
      threadId: thread.thread_id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/clients POST] Error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
