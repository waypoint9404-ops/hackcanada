import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteDocumentFile } from "@/lib/supabase/storage";
import { listThreadDocuments, deleteBackboardDocument } from "@/lib/backboard";

/**
 * DELETE /api/clients/[id]/documents/[docId]
 * Delete a document from Supabase Storage, the database, and Backboard.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: clientId, docId } = await params;
    const supabase = createAdminClient();

    const { data: worker } = await supabase
      .from("users")
      .select("id")
      .eq("auth0_id", session.user.sub)
      .single();

    if (!worker) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    const { data: client } = await supabase
      .from("clients")
      .select("id, assigned_worker_id, backboard_thread_id")
      .eq("id", clientId)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (client.assigned_worker_id && client.assigned_worker_id !== worker.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { data: doc } = await supabase
      .from("documents")
      .select("id, storage_path, filename, linked_note_message_id")
      .eq("id", docId)
      .eq("client_id", clientId)
      .single();

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // 1. Delete from Supabase Storage
    try {
      await deleteDocumentFile(doc.storage_path);
    } catch (err) {
      console.error("[documents] Storage delete failed:", err);
    }

    // 2. Delete from database
    await supabase.from("documents").delete().eq("id", docId);

    // 3. Delete the Backboard document (best-effort, async)
    //    List thread docs, match by filename, then delete from Backboard's RAG index
    if (client.backboard_thread_id) {
      void (async () => {
        try {
          const threadDocs = await listThreadDocuments(client.backboard_thread_id!);
          const bbDoc = threadDocs.find(d => d.filename === doc.filename);
          if (bbDoc) {
            await deleteBackboardDocument(bbDoc.document_id);
          }
        } catch (err) {
          console.error("[documents] Backboard document cleanup failed:", err);
        }
      })();
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
