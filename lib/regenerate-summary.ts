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
Based on everything you know about this client from all previous interactions and documents, generate an actionable summary and assess their current risk level.

FORMAT RULES (strict):
- Output MUST be exactly two parts separated by "|||"
- Part 1: Risk Level. Exactly one word: "LOW", "MED", or "HIGH"
- Part 2: The Actionable Summary. ONLY 3–5 concise bullet points. Each bullet highly actionable (1 line max). Cover: current situation, immediate risks, next steps. Do not use narrative paragraphs.

Example output:
HIGH
|||
• Client is currently staying at municipal shelter on Elm St, lease application pending
• Risk elevated due to missed medication appointments last two weeks
• Follow up with Dr. Patel at community clinic re: prescription renewal`;

/**
 * Regenerate the actionable summary for a client, reassess risk, and cache them in Supabase.
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

  const content = response.content ?? "LOW|||Unable to generate summary.";
  const parts = content.split("|||");
  
  let riskLevel = "LOW";
  let summaryText = "Unable to generate summary.";

  if (parts.length >= 2) {
    const parsedRisk = parts[0].trim().toUpperCase();
    if (parsedRisk === "HIGH" || parsedRisk === "MED" || parsedRisk === "LOW") {
      riskLevel = parsedRisk;
    }
    summaryText = parts.slice(1).join("|||").trim();
  } else {
    summaryText = content.trim();
  }

  // Cache in Supabase
  const supabase = createAdminClient();
  await supabase
    .from("clients")
    .update({
      summary: summaryText,
      risk_level: riskLevel,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId);

  return summaryText;
}
