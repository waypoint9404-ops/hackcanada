import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteDocumentFile } from "@/lib/supabase/storage";

/**
 * DELETE /api/clients/[id]/documents/[docId]
 * Delete a document from both Supabase Storage and the database.
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

    // Verify worker owns this client
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
      .select("id, assigned_worker_id")
      .eq("id", clientId)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (client.assigned_worker_id && client.assigned_worker_id !== worker.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Fetch the document to get its storage path
    const { data: doc } = await supabase
      .from("documents")
      .select("id, storage_path")
      .eq("id", docId)
      .eq("client_id", clientId)
      .single();

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Delete from Storage
    try {
      await deleteDocumentFile(doc.storage_path);
    } catch (err) {
      console.error("[documents] Storage delete failed:", err);
      // Continue to delete DB record even if storage delete fails
    }

    // Delete from database
    await supabase.from("documents").delete().eq("id", docId);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
