/**
 * AI-powered document classification and action routing.
 *
 * Determines whether an uploaded document should result in:
 *   - CREATE: a new case note (new development, new issue)
 *   - UPDATE: contextual update to an existing case issue
 *
 * Both actions produce a Backboard thread message with memory: "Auto",
 * so the distinction is informational for the worker — Backboard's
 * persistent memory naturally ties related content together.
 */

import {
  sendMessageWithModel,
  GEMINI_FLASH_CONFIG,
  type ModelConfig,
} from "@/lib/backboard";

export interface DocumentClassification {
  action: "create" | "update";
  reason: string;
}

const CLASSIFY_PROMPT = (filename: string, textExcerpt: string) =>
  `[DOCUMENT CLASSIFICATION — INTERNAL]
Based on the existing case history in this thread, should this newly uploaded document "${filename}" result in:
A) CREATE a new case note — it introduces a new development, a new issue, or new agency involvement
B) UPDATE existing context — it adds evidence, changes a timeline, or confirms/contradicts existing information

Respond with ONLY one line in this exact format:
CREATE: <brief reason>
or
UPDATE: <brief reason>

Document excerpt (first 2000 characters):
${textExcerpt.slice(0, 2000)}`;

/**
 * Ask the AI whether a document should create a new note or update existing context.
 * Uses Readonly memory so this classification query doesn't persist as a note.
 */
export async function classifyDocumentAction(
  threadId: string,
  extractedText: string,
  filename: string,
  model: ModelConfig = GEMINI_FLASH_CONFIG
): Promise<DocumentClassification> {
  try {
    const response = await sendMessageWithModel(
      threadId,
      CLASSIFY_PROMPT(filename, extractedText),
      model,
      { memory: "Readonly" }
    );

    const content = (response.content ?? "").trim();
    if (content.toUpperCase().startsWith("UPDATE")) {
      return {
        action: "update",
        reason: content.replace(/^UPDATE:\s*/i, "").trim() || "Updates existing case context",
      };
    }

    // Default to "create" — safer to surface a new note than miss one
    return {
      action: "create",
      reason: content.replace(/^CREATE:\s*/i, "").trim() || "Introduces new information",
    };
  } catch (err) {
    console.error("[document-actions] Classification failed:", err);
    return { action: "create", reason: "Classification unavailable — defaulting to new note" };
  }
}
