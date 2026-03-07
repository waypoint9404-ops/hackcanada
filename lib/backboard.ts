/**
 * Backboard.io REST API wrapper for Waypoint.
 * All Backboard calls go through this file — never expose the API key to the client.
 *
 * Docs: https://docs.backboard.io
 * Base URL: https://app.backboard.io/api
 */

const BASE_URL = "https://app.backboard.io/api";

function getApiKey(): string {
  const key = process.env.BACKBOARD_API_KEY;
  if (!key) throw new Error("Missing BACKBOARD_API_KEY env var.");
  return key;
}

function getAssistantId(): string {
  const id = process.env.BACKBOARD_ASSISTANT_ID;
  if (!id) throw new Error("Missing BACKBOARD_ASSISTANT_ID env var.");
  return id;
}

function headers(): Record<string, string> {
  return {
    "X-API-Key": getApiKey(),
    "Content-Type": "application/json",
  };
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BackboardThread {
  thread_id: string;
  assistant_id: string;
  created_at: string;
}

export interface BackboardMessage {
  content: string;
  role: "user" | "assistant";
  memory_operation_id?: string;
  [key: string]: unknown;
}

// ─── Assistant ───────────────────────────────────────────────────────────────

/** Get the configured assistant's details */
export async function getAssistant() {
  const res = await fetch(`${BASE_URL}/assistants/${getAssistantId()}`, {
    method: "GET",
    headers: headers(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[Backboard] GET assistant failed (${res.status}): ${text}`);
  }

  return res.json();
}

// ─── Threads ─────────────────────────────────────────────────────────────────

/** Create a new conversation thread under the configured assistant */
export async function createThread(): Promise<BackboardThread> {
  const res = await fetch(
    `${BASE_URL}/assistants/${getAssistantId()}/threads`,
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({}),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `[Backboard] Create thread failed (${res.status}): ${text}`
    );
  }

  return res.json();
}

/** Get all messages in a thread */
export async function getThreadMessages(
  threadId: string
): Promise<BackboardMessage[]> {
  const res = await fetch(`${BASE_URL}/threads/${threadId}/messages`, {
    method: "GET",
    headers: headers(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `[Backboard] Get messages failed (${res.status}): ${text}`
    );
  }

  return res.json();
}

// ─── Messages ────────────────────────────────────────────────────────────────

interface SendMessageOptions {
  /** Enable persistent memory across threads: "Auto" | "None" */
  memory?: "Auto" | "None";
  /** Whether to stream the response (for skeleton, we use false) */
  stream?: boolean;
}

/**
 * Send a message to a Backboard thread and receive the AI response.
 * Uses form-data per the Backboard API spec for POST /threads/{id}/messages.
 */
export async function sendMessage(
  threadId: string,
  content: string,
  opts: SendMessageOptions = {}
): Promise<BackboardMessage> {
  const { memory = "Auto", stream = false } = opts;

  // Backboard's message endpoint uses form-data style
  const formData = new URLSearchParams();
  formData.append("content", content);
  formData.append("stream", String(stream));
  if (memory) {
    formData.append("memory", memory);
  }

  const res = await fetch(`${BASE_URL}/threads/${threadId}/messages`, {
    method: "POST",
    headers: {
      "X-API-Key": getApiKey(),
      // URLSearchParams automatically sets Content-Type to application/x-www-form-urlencoded
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `[Backboard] Send message failed (${res.status}): ${text}`
    );
  }

  return res.json();
}

// ─── Memory ──────────────────────────────────────────────────────────────────

/** Explicitly add a memory to the assistant's persistent memory store */
export async function addMemory(content: string): Promise<unknown> {
  const res = await fetch(
    `${BASE_URL}/assistants/${getAssistantId()}/memories`,
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ content }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[Backboard] Add memory failed (${res.status}): ${text}`);
  }

  return res.json();
}
