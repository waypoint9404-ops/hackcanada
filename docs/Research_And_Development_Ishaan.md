Backboard API Integration Guide

The Backboard API integration in this codebase is centralized in a single wrapper file: backboard.ts. This is designed so you never expose your BACKBOARD_API_KEY to the client-side browser.

Here is a breakdown of how the integration works and how you can use it to build new features.

1. The Core Wrapper (backboard.ts)

Instead of using raw fetch calls scattered everywhere, the codebase uses helper functions exported from backboard.ts. To interact with Backboard, you just import what you need from there.

The most important functions available are:
	•	createThread()
Creates a new persistent memory thread, used when a new client is added to the system.
	•	sendMessageWithModel(threadId, prompt, modelConfig, options)
Sends a prompt to an AI model within a specific thread.
	•	streamMessage(...)
Same as above, but returns an async generator for Server-Sent Events, used in Q&A streaming.
	•	addMemory(content, metadata)
Explicitly injects a fact into the system’s vector database without sending a message to a thread, used for document ingestion.

2. Available Models

Backboard routes your prompts to specific LLMs via OpenRouter. The codebase exports predefined configurations you can pass into your calls:
	•	GEMINI_FLASH_CONFIG
Fast, cheap, and great for parsing data, extracting text, and quick Q&A.
	•	GEMINI_PRO_CONFIG
Slower, but better at deep reasoning and complex summaries.

3. The memory Parameter (Crucial Concept)

Whenever you call Backboard, you must pass a memory option. This dictates whether the AI’s response is permanently remembered in the client’s file.
	•	{ memory: "Auto" }
Persists. Use this for real case notes, visit transcripts, or document summaries. The prompt and response become a permanent part of the client’s history.
	•	{ memory: "Readonly" }
Reads but does not save. Use this for generating a quick summary or asking a Q&A question. It reads the client’s history to get context, but does not log your question as a new case note.
	•	{ memory: "Off" }
Completely ignores the client’s past history.

4. How to Use It in a New API Route

If you wanted to build a new feature—for example, a route that translates a client’s entire case history into Spanish—you could create a Next.js App Router endpoint like this:

import { NextResponse } from "next/server";
import { sendMessageWithModel, GEMINI_FLASH_CONFIG } from "@/lib/backboard";

export async function POST(request: Request) {
  const { threadId } = await request.json();

  // 1. Send the prompt to Backboard
  const response = await sendMessageWithModel(
    threadId,
    "Read this client's history and write a 2-paragraph summary in Spanish.",
    GEMINI_FLASH_CONFIG,
    { memory: "Readonly" }
  );

  // 2. Return the AI's text
  return NextResponse.json({
    spanishSummary: response.content,
  });
}

5. Where to Look for Existing Examples in Your Code
	•	route.ts
Shows how to use { memory: "Auto" } to save a new voice note.
	•	regenerate-summary.ts
Shows how to use { memory: "Readonly" } to read the whole file and return bullet points.
	•	route.ts
Shows how addMemory() is used to inject document metadata directly into the system’s memory.