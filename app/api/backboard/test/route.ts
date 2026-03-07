import { NextResponse } from "next/server";
import {
  getAssistant,
  createThread,
  sendMessageWithModel,
  GEMINI_FLASH_CONFIG,
} from "@/lib/backboard";

/**
 * GET /api/backboard/test
 *
 * Diagnostic endpoint – runs a full Backboard integration smoke test:
 * 1. Verifies the assistant exists
 * 2. Creates a new thread
 * 3. Sends a mock case note (ingestion test) — using Gemini Flash
 * 4. Sends a follow-up Q&A query (memory/context test) — using Gemini Flash
 * 5. Returns all results as JSON, including which model handled each request
 *
 * NOT auth-protected — intended for dev smoke testing only.
 */
export async function GET() {
  try {
    // Step 1: Verify assistant
    const assistant = await getAssistant();

    // Step 2: Create thread
    const thread = await createThread();

    // Step 3: Send a mock case note — explicitly routed to Gemini
    const ingestResponse = await sendMessageWithModel(
      thread.thread_id,
      `Case note for Alex Mercer (Client ID: test-alex-001):
Met Alex at the 4th Street shelter today at 2:15 PM. He missed his rent payment on the 2nd and is at risk of eviction. 
His landlord has filed a notice. Alex reports he stopped taking his bipolar medication two weeks ago because he ran out and couldn't afford the refill.
He appeared agitated but cooperative. Referred him to the emergency housing fund and scheduled a follow-up for Thursday.
Tags: HOUSING, MENTAL_HEALTH. Risk level: HIGH.`,
      GEMINI_FLASH_CONFIG,
      { memory: "Auto" }
    );

    // Step 4: Follow-up Q&A — also Gemini
    const qnaResponse = await sendMessageWithModel(
      thread.thread_id,
      "Based on the case note above, what is Alex Mercer's current risk level and what are the recommended next steps?",
      GEMINI_FLASH_CONFIG,
      { memory: "Auto" }
    );

    return NextResponse.json({
      success: true,
      assistant: {
        id: assistant.assistant_id,
        name: assistant.name,
      },
      thread: {
        id: thread.thread_id,
      },
      ingest: {
        content: ingestResponse.content,
        model_provider: ingestResponse.model_provider,
        model_name: ingestResponse.model_name,
        tokens: ingestResponse.total_tokens,
      },
      qna: {
        content: qnaResponse.content,
        model_provider: qnaResponse.model_provider,
        model_name: qnaResponse.model_name,
        tokens: qnaResponse.total_tokens,
      },
      modelConfig: {
        requested_provider: GEMINI_FLASH_CONFIG.llmProvider,
        requested_model: GEMINI_FLASH_CONFIG.modelName,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/backboard/test] Error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
