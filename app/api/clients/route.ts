import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
