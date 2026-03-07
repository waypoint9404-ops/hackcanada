import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getThreadMessages } from "@/lib/backboard";

/**
 * A structured case note entry pairing AI note with its raw transcript.
 */
interface CaseNoteEntry {
  id: string;
  ai_note: string;
  raw_transcript: string | null;
  timestamp: string | null;
  is_worker_edit: boolean;
}

/**
 * GET /api/clients/[id]/timeline
 * Fetch all Backboard messages for a client's thread,
 * structured as paired case note entries (AI note + raw transcript).
 * System prompts are filtered out completely.
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
      .select("id, name, backboard_thread_id")
      .eq("id", id)
      .single();

    if (error || !client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    if (!client.backboard_thread_id) {
      return NextResponse.json({ entries: [], message: "No thread yet" });
    }

    const messages = await getThreadMessages(client.backboard_thread_id);

    // Filter out system messages entirely
    const filtered = messages.filter(
      (msg) => (msg.role as string) !== "system" && (msg.content ?? "").trim().length > 0
    );

    // Pair user→assistant messages into structured entries
    const entries: CaseNoteEntry[] = [];
    let i = 0;

    while (i < filtered.length) {
      const msg = filtered[i];
      const content = msg.content ?? "";
      const timestamp = (msg as Record<string, unknown>).created_at as string | undefined;
      const isWorkerEdit = content.includes("[WORKER EDIT");

      if (msg.role === "user") {
        // Check if next message is the AI response
        const nextMsg = i + 1 < filtered.length ? filtered[i + 1] : null;

        if (isWorkerEdit) {
          // Worker edit — apply this edit to the PREVIOUS assistant note
          const editContent = content
            .replace(/\[WORKER EDIT[^\]]*\]\n*/i, "")
            .replace(/^The social worker has reviewed and edited the following case note for [^:]*:\n*/i, "")
            .replace(/\n*Please acknowledge this edit and update your understanding of this client accordingly\.?\s*$/i, "")
            .trim();
          
          // Find the most recently added entry and overwrite its content
          if (entries.length > 0) {
            entries[entries.length - 1].ai_note = editContent;
            entries[entries.length - 1].is_worker_edit = true;
          }

          if (nextMsg && nextMsg.role === "assistant") {
            i += 2;
          } else {
            i += 1;
          }
        } else if (nextMsg && nextMsg.role === "assistant") {
          // Normal pair: user transcript → AI structured note
          // Check if the user message is a summary/extract prompt (not a real transcript)
          const isSummaryPrompt = content.includes("Generate an **actionable summary**") ||
            content.includes("actionable summary") ||
            content.includes("Extract the full name") ||
            content.startsWith("You are Waypoint") ||
            content.startsWith("[Q&A]");
          
          if (isSummaryPrompt) {
            // Skip both — this is an internal system call, not a case note
            i += 2;
            continue;
          }

          // Extract just the raw transcript from the user message
          // The user message format is: "New case note for {name}:\n\n{transcript}\n\nRespond with..."
          let rawTranscript = content;
          const caseNoteMatch = content.match(/New case note for [^:]*:\s*\n\n([\s\S]*?)(?:\n\nRespond with|$)/);
          if (caseNoteMatch) {
            rawTranscript = caseNoteMatch[1].trim();
          }

          entries.push({
            id: nextMsg.run_id ?? `entry-${i}`,
            ai_note: nextMsg.content ?? "",
            raw_transcript: rawTranscript,
            timestamp: (nextMsg as Record<string, unknown>).created_at as string | undefined ?? timestamp ?? null,
            is_worker_edit: false,
          });
          i += 2;
        } else {
          // Unpaired user message — skip (shouldn't happen normally)
          i += 1;
        }
      } else if (msg.role === "assistant") {
        // Orphan assistant message (e.g., initial greeting) — show as AI note
        // Skip if it looks like a summary or system response
        const isSummaryResponse = content.includes("actionable summary") || 
          content.startsWith("•") || 
          content.includes("1. **");
        
        if (!isSummaryResponse) {
          entries.push({
            id: msg.run_id ?? `entry-${i}`,
            ai_note: content,
            raw_transcript: null,
            timestamp: timestamp ?? null,
            is_worker_edit: false,
          });
        }
        i += 1;
      } else {
        i += 1;
      }
    }

    // Merge any worker edits from Supabase over the original Backboard messages
    // The note_edits table does not exist in this project.
    // Instead of overriding notes, we rely purely on the fact that we pushed the edit to backboard!

    // Strip internal [RISK:...] tags from AI notes before sending to frontend
    for (const entry of entries) {
      entry.ai_note = entry.ai_note.replace(/\s*\[RISK:(?:LOW|MED|HIGH)\]\s*/g, "").trim();
    }

    return NextResponse.json({ entries });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
