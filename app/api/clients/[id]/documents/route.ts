import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadDocument, getDocumentUrl } from "@/lib/supabase/storage";
import { extractTextFromPdf } from "@/lib/pdf-extract";
import { classifyDocumentAction, type DocumentClassification } from "@/lib/document-actions";
import {
  sendMessageWithModel,
  addMemory,
  GEMINI_FLASH_CONFIG,
} from "@/lib/backboard";
import { regenerateSummary } from "@/lib/regenerate-summary";
import { rateLimit } from "@/lib/rate-limit";

const limiter = rateLimit({ interval: 60_000, limit: 10 });
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const DOCUMENT_INGESTION_PROMPT = (
  clientName: string,
  filename: string,
  classification: DocumentClassification,
  extractedText: string
) =>
  `[DOCUMENT UPLOAD] The following text was extracted from a document uploaded to ${clientName}'s case file.
Document filename: ${filename}
AI classification: ${classification.action.toUpperCase()} — ${classification.reason}${classification.relatedTopic ? ` (Relates to: ${classification.relatedTopic})` : ""}

You are a case-document ingestion agent for a social work case management system.
Your job is to read this document and generate a structured case note.

INSTRUCTIONS:
1. Identify the document type and source entity.
2. Extract only objective, supportable facts. Do not speculate or infer beyond what is explicit.
3. Identify dates, deadlines, status changes, agencies involved, and risk-relevant information.
4. Compare the document against the client's existing case history/timeline for context.
5. Generate a structured case note using subpoena-safe, factual language (e.g., "Document states...", "According to the filing...").
6. The note should start with a 1-2 sentence summary of the document and its significance.
7. Follow with bullet points of key extracted facts.
8. If this relates to an existing issue, note the connection explicitly.

Extracted document text:
${extractedText.slice(0, 15000)}`;

/**
 * POST /api/clients/[id]/documents
 * Upload a document, extract text, send to Backboard with memory, regenerate summary.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { success } = limiter.check(request);
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: clientId } = await params;
    const supabase = createAdminClient();

    // Verify client exists and belongs to this worker
    const { data: worker } = await supabase
      .from("users")
      .select("id")
      .eq("auth0_id", session.user.sub)
      .single();

    if (!worker) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, name, backboard_thread_id, assigned_worker_id")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (client.assigned_worker_id && client.assigned_worker_id !== worker.id) {
      return NextResponse.json({ error: "Not authorized for this client" }, { status: 403 });
    }

    if (!client.backboard_thread_id) {
      return NextResponse.json(
        { error: "Client has no Backboard thread — record a note first" },
        { status: 400 }
      );
    }

    // Parse the multipart form
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name || "document";
    const mimeType = file.type || "application/octet-stream";

    // 1. Upload to Supabase Storage
    const storagePath = await uploadDocument(clientId, buffer, filename, mimeType);

    // 2. Extract text (PDF only for now)
    let extractedText = "";
    let extractionResult = { text: "", pages: 0, isEmpty: true };

    if (mimeType === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) {
      extractionResult = await extractTextFromPdf(buffer);
      extractedText = extractionResult.text;
    } else if (mimeType.startsWith("text/")) {
      // Plain text files
      extractedText = buffer.toString("utf-8");
      extractionResult = { text: extractedText, pages: 1, isEmpty: extractedText.length === 0 };
    }

    if (extractionResult.isEmpty) {
      // Still store the document but warn that AI processing wasn't possible
      const { data: doc } = await supabase
        .from("documents")
        .insert({
          client_id: clientId,
          uploaded_by: worker.id,
          filename,
          storage_path: storagePath,
          mime_type: mimeType,
          file_size_bytes: file.size,
          extracted_text: null,
          document_type: "other",
          ai_summary: "Document uploaded but text could not be extracted. It may be a scanned image.",
          linked_note_message_id: null,
        })
        .select()
        .single();

      return NextResponse.json({
        success: true,
        documentId: doc?.id,
        note: null,
        warning: "No text could be extracted from this document. It may be a scanned image PDF or unsupported format.",
        documentType: "other",
        classification: null,
      });
    }

    // 3. Classify: create new note or update existing context
    const classification = await classifyDocumentAction(
      client.backboard_thread_id,
      extractedText,
      filename
    );

    // 4. Send to Backboard with memory: "Auto" — this is the critical integration
    const prompt = DOCUMENT_INGESTION_PROMPT(
      client.name,
      filename,
      classification,
      extractedText
    );

    const response = await sendMessageWithModel(
      client.backboard_thread_id,
      prompt,
      GEMINI_FLASH_CONFIG,
      { memory: "Auto" }
    );

    const aiNote = response.content ?? "";

    // Extract document type from AI response (simple heuristic)
    const docType = inferDocumentType(filename, extractedText);

    // Short AI summary (first 200 chars of the note)
    const aiSummary = aiNote.slice(0, 200) + (aiNote.length > 200 ? "..." : "");

    // --- DUAL-CHANNEL MEMORY ---
    // A. Explicit Memory (tagged for retrieval filtering)
    try {
      const aiSummaryFactual = aiNote.slice(0, 500);
      await addMemory(`[DOCUMENT] ${filename} — ${docType}. Uploaded ${new Date().toISOString().split('T')[0]}. ${aiSummaryFactual}`, {
        stream: "document",
        document_type: docType,
        filename: filename,
        client_id: clientId,
        action: classification.action,
        related_topic: classification.relatedTopic,
      });
    } catch (memErr) {
      console.error("[documents] Failed to add explicit memory:", memErr);
    }

    // B. Factual stream thread message (shorter, objective timeline entry)
    try {
      await sendMessageWithModel(
        client.backboard_thread_id,
        `[DOCUMENT FACTS] Raw extracted case data:\nFilename: ${filename}\nType: ${docType}\nAction: ${classification.action}\nSummary: ${aiSummary}`,
        GEMINI_FLASH_CONFIG,
        { memory: "Auto" }
      );
    } catch (factErr) {
      console.error("[documents] Failed to add factual stream message:", factErr);
    }
    // ---------------------------

    // 5. Store document record in Supabase
    const { data: doc } = await supabase
      .from("documents")
      .insert({
        client_id: clientId,
        uploaded_by: worker.id,
        filename,
        storage_path: storagePath,
        mime_type: mimeType,
        file_size_bytes: file.size,
        extracted_text: extractedText.slice(0, 50000), // Cap stored text
        document_type: docType,
        ai_summary: aiSummary,
        linked_note_message_id: response.run_id ?? null,
      })
      .select()
      .single();

    // 6. Regenerate summary (async, don't block response)
    regenerateSummary(clientId, client.backboard_thread_id).catch((err) =>
      console.error("[documents] Summary regeneration failed:", err)
    );

    return NextResponse.json({
      success: true,
      documentId: doc?.id,
      note: aiNote,
      documentType: docType,
      classification,
      aiSummary,
    });
  } catch (err) {
    console.error("[documents] Upload error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/clients/[id]/documents
 * List all documents for a client with signed download URLs.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth0.getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: clientId } = await params;
    const supabase = createAdminClient();

    const { data: documents, error } = await supabase
      .from("documents")
      .select("id, filename, mime_type, file_size_bytes, document_type, ai_summary, created_at, storage_path")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Generate signed URLs for each document
    const docsWithUrls = await Promise.all(
      (documents ?? []).map(async (doc) => {
        let downloadUrl: string | null = null;
        try {
          downloadUrl = await getDocumentUrl(doc.storage_path);
        } catch {
          // URL generation failed — still return the doc metadata
        }
        return {
          id: doc.id,
          filename: doc.filename,
          mimeType: doc.mime_type,
          fileSizeBytes: doc.file_size_bytes,
          documentType: doc.document_type,
          aiSummary: doc.ai_summary,
          createdAt: doc.created_at,
          downloadUrl,
        };
      })
    );

    return NextResponse.json({ documents: docsWithUrls });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function inferDocumentType(filename: string, text: string): string {
  const lower = (filename + " " + text.slice(0, 1000)).toLowerCase();

  if (lower.includes("eviction") || lower.includes("notice to vacate") || lower.includes("n4"))
    return "eviction_letter";
  if (lower.includes("court") || lower.includes("hearing") || lower.includes("summons") || lower.includes("docket"))
    return "court_notice";
  if (lower.includes("discharge") || lower.includes("hospital") || lower.includes("medical") || lower.includes("diagnosis"))
    return "medical_record";
  if (lower.includes("benefit") || lower.includes("ow ") || lower.includes("odsp") || lower.includes("ontario works"))
    return "benefit_statement";
  if (lower.includes("police") || lower.includes("incident report") || lower.includes("occurrence"))
    return "police_report";
  if (lower.includes("shelter") || lower.includes("intake form"))
    return "shelter_form";
  if (lower.includes("agency") || lower.includes("referral"))
    return "agency_report";

  return "other";
}
