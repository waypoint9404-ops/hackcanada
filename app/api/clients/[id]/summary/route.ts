import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { regenerateSummary } from "@/lib/regenerate-summary";
import { rateLimit } from "@/lib/rate-limit";

const limiter = rateLimit({ interval: 60_000, limit: 10 });

/**
 * GET /api/clients/[id]/summary
 * Return the CACHED summary from Supabase.
 * Summary is force-regenerated on POST.
 * This ensures manual summary edits persist.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { data: client, error } = await supabase
      .from("clients")
      .select("id, summary")
      .eq("id", id)
      .single();

    if (error || !client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      summary: client.summary || null,
      source: "cached",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/clients/[id]/summary
 * Force-regenerate the actionable summary via Backboard.
 * Called programmatically after note creation or worker edits.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { success } = limiter.check(request);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait." },
      { status: 429 }
    );
  }

  try {
    const { id } = await params;
    const refresh = request.nextUrl.searchParams.get("refresh") === "true";
    const supabase = createAdminClient();

    const { data: client, error } = await supabase
      .from("clients")
      .select("id, backboard_thread_id")
      .eq("id", id)
      .single();

    if (error || !client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    if (!client.backboard_thread_id) {
      return NextResponse.json({
        summary: null,
        source: "none",
        message: "No Backboard thread — cannot generate summary.",
      });
    }

    const summaryText = await regenerateSummary(id, client.backboard_thread_id);

    return NextResponse.json({
      summary: summaryText,
      source: "backboard",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
