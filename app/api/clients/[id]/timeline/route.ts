import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getThreadMessages } from "@/lib/backboard";
import { getDocumentUrl } from "@/lib/supabase/storage";

/**
 * A structured case note entry pairing AI note with its raw transcript.
 */
interface CaseNoteEntry {
  id: string;
  ai_note: string;
  raw_transcript: string | null;
  timestamp: string | null;
  is_worker_edit: boolean;
  /** Source of this entry: "call" (default), "document" */
  source?: "call" | "document";
  /** If source is "document", the original filename */
  document_filename?: string;
  document_id?: string;
  file_size_bytes?: number;
  download_url?: string;
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

    // Pass 1: find all soft-delete directives
    const deletedIds = new Set<string>();
    for (const msg of filtered) {
      const content = msg.content ?? "";
      if (
        msg.role === "user" && 
        content.includes("[WORKER EDIT") && 
        content.includes("disregard that specific note")
      ) {
        const match = content.match(/Message ID: (.*?)\)/);
        if (match && match[1]) {
          deletedIds.add(match[1]);
        }
      }
    }

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
          // Worker edit — apply this edit to the targeted entry
          const editContent = content
            .replace(/\[WORKER EDIT[^\]]*\]\n*/i, "")
            .replace(/^The social worker has reviewed and edited the following case note for [^:]*:\n*/i, "")
            .replace(/\n*Please acknowledge this edit and update your understanding of this client accordingly\.?\s*$/i, "")
            .trim();

          // Extract TARGET entry ID from the message header
          const targetMatch = content.match(/TARGET:\s*([^\]]+)/);
          const targetId = targetMatch?.[1]?.trim();

          // Find the specific entry to overwrite (by TARGET ID, falling back to last entry)
          let targetEntry: CaseNoteEntry | undefined;
          if (targetId && targetId !== "unknown") {
            targetEntry = entries.find(e => e.id === targetId);
          }
          if (!targetEntry && entries.length > 0) {
            targetEntry = entries[entries.length - 1];
          }

          if (targetEntry) {
            targetEntry.ai_note = editContent;
            targetEntry.is_worker_edit = true;
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
            content.startsWith("You are a scheduling assistant") ||
            content.startsWith("[Q&A]") ||
            content.startsWith("[DOCUMENT FACTS]") ||
            content.startsWith("[DOCUMENT CLASSIFICATION");

          // Check if it's a soft delete directive (we already parsed these)
          const isSoftDelete = content.includes("[WORKER EDIT") && content.includes("disregard that specific note");
          
          if (isSummaryPrompt || isSoftDelete) {
            // Skip both — this is an internal system call or soft delete, not a case note
            i += 2;
            continue;
          }

          // Check if this is a document upload entry
          const isDocumentUpload = content.startsWith("[DOCUMENT UPLOAD]");
          let documentFilename: string | undefined;
          if (isDocumentUpload) {
            const filenameMatch = content.match(/Document filename:\s*(.+)/);
            documentFilename = filenameMatch?.[1]?.trim();
          }

          // Extract just the raw transcript from the user message
          // The user message format is: "New case note for {name}:\n\n{transcript}\n\nRespond with..."
          let rawTranscript = content;
          const caseNoteMatch = content.match(/New case note for [^:]*:\s*\n\n([\s\S]*?)(?:\n\nRespond with|$)/);
          if (caseNoteMatch) {
            rawTranscript = caseNoteMatch[1].trim();
          }

          const entryId = nextMsg.run_id ?? `entry-${i}`;
          
          // Only add if it hasn't been soft-deleted
          if (!deletedIds.has(entryId)) {
            entries.push({
              id: entryId,
              ai_note: nextMsg.content ?? "",
              raw_transcript: isDocumentUpload ? null : rawTranscript,
              timestamp: (nextMsg as Record<string, unknown>).created_at as string | undefined ?? timestamp ?? null,
              is_worker_edit: false,
              source: isDocumentUpload ? "document" : "call",
              document_filename: documentFilename,
            });
          }
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
          content.includes("1. **") ||
          content.trim().startsWith("[{");
          
        const isDisregardAck = content.includes("acknowledge") || content.includes("disregard") || content.includes("deleted");
        
        if (!isSummaryResponse && !isDisregardAck) {
          const entryId = msg.run_id ?? `entry-${i}`;
          if (!deletedIds.has(entryId)) {
            entries.push({
              id: entryId,
              ai_note: content,
              raw_transcript: null,
              timestamp: timestamp ?? null,
              is_worker_edit: false,
            });
          }
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

    // Fetch documents to enrich document entries
    const { data: documents } = await supabase
      .from("documents")
      .select("id, filename, file_size_bytes, storage_path, linked_note_message_id")
      .eq("client_id", id);
      
    if (documents && documents.length > 0) {
      for (const entry of entries) {
        if (entry.source === "document") {
          const doc = documents.find(d => 
            (d.linked_note_message_id && d.linked_note_message_id === entry.id) ||
            (d.filename === entry.document_filename)
          );
          
          if (doc) {
            entry.document_id = doc.id;
            entry.file_size_bytes = doc.file_size_bytes;
            try {
              entry.download_url = await getDocumentUrl(doc.storage_path);
            } catch (e) {
              // Ignore failure to generate URL
            }
          }
        }
      }
    }

    return NextResponse.json({ entries });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
