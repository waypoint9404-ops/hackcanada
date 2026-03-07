import { NextResponse } from "next/server";
import {
  getAssistant,
  createThread,
  sendMessage,
} from "@/lib/backboard";

/**
 * GET /api/backboard/test
 *
 * Diagnostic endpoint – runs a full Backboard integration smoke test:
 * 1. Verifies the assistant exists
 * 2. Creates a new thread
 * 3. Sends a mock case note (ingestion test)
 * 4. Sends a follow-up Q&A query (memory/context test)
 * 5. Returns all results as JSON
 *
 * NOT auth-protected — intended for dev smoke testing only.
 */
export async function GET() {
  try {
    // Step 1: Verify assistant
    const assistant = await getAssistant();

    // Step 2: Create thread
    const thread = await createThread();

    // Step 3: Send a mock case note
    const ingestResponse = await sendMessage(
      thread.thread_id,
      `Case note for Alex Mercer (Client ID: test-alex-001):
Met Alex at the 4th Street shelter today at 2:15 PM. He missed his rent payment on the 2nd and is at risk of eviction. 
His landlord has filed a notice. Alex reports he stopped taking his bipolar medication two weeks ago because he ran out and couldn't afford the refill.
He appeared agitated but cooperative. Referred him to the emergency housing fund and scheduled a follow-up for Thursday.
Tags: HOUSING, MENTAL_HEALTH. Risk level: HIGH.`,
      { memory: "Auto", stream: false }
    );

    // Step 4: Follow-up Q&A
    const qnaResponse = await sendMessage(
      thread.thread_id,
      "Based on the case note above, what is Alex Mercer's current risk level and what are the recommended next steps?",
      { memory: "Auto", stream: false }
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
      ingestResponse: ingestResponse.content,
      qnaResponse: qnaResponse.content,
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
