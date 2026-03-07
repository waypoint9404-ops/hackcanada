/**
 * Shared utility: regenerate a client's actionable summary via Backboard.
 * Called after new note creation or worker note edits.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendMessageWithModel,
  GEMINI_PRO_CONFIG,
} from "@/lib/backboard";

const SUMMARY_PROMPT = `You are Waypoint, a case management assistant for municipal social workers.
Based on everything you know about this client from all previous interactions, generate an actionable summary.

FORMAT RULES (strict):
- Output ONLY 3–5 concise bullet points
- Each bullet must be a short, actionable sentence (1 line max)
- Cover: current situation, immediate risks, and next steps for the social worker
- Use present tense. Be factual and objective. Do not speculate.
- Do NOT include headings, titles, numbering, or narrative paragraphs — just bullet points.

Example output:
• Client is currently staying at municipal shelter on Elm St, lease application pending
• Risk elevated due to missed medication appointments last two weeks
• Follow up with Dr. Patel at community clinic re: prescription renewal
• Connect client with legal aid for upcoming court date on March 15
• Housing voucher application submitted — check status at next visit`;

/**
 * Regenerate the actionable summary for a client and cache it in Supabase.
 * Returns the new summary text.
 */
export async function regenerateSummary(
  clientId: string,
  threadId: string
): Promise<string> {
  const response = await sendMessageWithModel(
    threadId,
    SUMMARY_PROMPT,
    GEMINI_PRO_CONFIG,
    { memory: "Readonly" }
  );

  const summaryText = response.content ?? "Unable to generate summary.";

  // Cache in Supabase
  const supabase = createAdminClient();
  await supabase
    .from("clients")
    .update({
      summary: summaryText,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId);

  return summaryText;
}
