/**
 * Backboard.io REST API client for Waypoint.
 *
 * Built following the official Backboard cookbook TypeScript client pattern:
 * https://github.com/Backboard-io/backboard_io_cookbook/blob/main/recipes/ts_client.ts
 *
 * All Backboard calls go through this file — never expose the API key to the client.
 
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const BASE_URL = "https://app.backboard.io/api";
const DEFAULT_TIMEOUT_MS = 60_000;

// ─── Model Routing Configs ───────────────────────────────────────────────────
// Per the Backboard cookbook, model routing is per-message via add_message().
// These configs are passed as form-data fields: `llm_provider` and `model_name`.

export interface ModelConfig {
  llmProvider: string;
  modelName: string;
}

/** Gemini Flash — fast & cheap. Use for ingestion, note-cleaning, simple Q&A.
 *  Backboard routes via OpenRouter, so model names use the `org/model` format. */
export const GEMINI_FLASH_CONFIG: ModelConfig = {
  llmProvider: process.env.BACKBOARD_LLM_PROVIDER ?? "openrouter",
  modelName: process.env.BACKBOARD_MODEL_NAME ?? "google/gemini-3-flash-preview",
};

/** Gemini Pro — deeper reasoning. Use for risk-aware overviews and recap scripts. */
export const GEMINI_PRO_CONFIG: ModelConfig = {
  llmProvider: "openrouter",
  modelName: "google/gemini-3.1-pro-preview",
};

// ─── Env Helpers ─────────────────────────────────────────────────────────────

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

function authHeaders(): Record<string, string> {
  return {
    "X-API-Key": getApiKey(),
  };
}

function jsonHeaders(): Record<string, string> {
  return {
    ...authHeaders(),
    "Content-Type": "application/json",
  };
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BackboardAssistant {
  assistant_id: string;
  name: string;
  description?: string;
  system_prompt?: string;
  created_at: string;
  [key: string]: unknown;
}

export interface BackboardThread {
  thread_id: string;
  assistant_id: string;
  created_at: string;
}

export interface BackboardMessageResponse {
  content?: string;
  status?: string;
  run_id?: string;
  memory_operation_id?: string;
  model_provider?: string;
  model_name?: string;
  total_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
  role?: "user" | "assistant";
  [key: string]: unknown;
}

export interface BackboardStreamEvent {
  type: string;
  content?: string;
  error?: string;
  message?: string;
  run_id?: string;
  tool_calls?: Array<{
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }>;
  model_provider?: string;
  model_name?: string;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  memory_operation_id?: string;
}

export interface BackboardMemoryOperationStatus {
  status: "IN_PROGRESS" | "COMPLETED" | "FAILED";
  status_message?: string;
}

export interface BackboardMemory {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

// ─── Internal Fetch with Timeout ─────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Assistant ───────────────────────────────────────────────────────────────

/** Get the configured assistant's details */
export async function getAssistant(): Promise<BackboardAssistant> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/assistants/${getAssistantId()}`,
    { method: "GET", headers: authHeaders() }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[Backboard] GET assistant failed (${res.status}): ${text}`);
  }

  return res.json();
}

/** List all assistants on the account */
export async function listAssistants(
  skip = 0,
  limit = 100
): Promise<BackboardAssistant[]> {
  const url = new URL(`${BASE_URL}/assistants`);
  url.searchParams.set("skip", String(skip));
  url.searchParams.set("limit", String(limit));

  const res = await fetchWithTimeout(url.toString(), {
    method: "GET",
    headers: authHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `[Backboard] List assistants failed (${res.status}): ${text}`
    );
  }

  return res.json();
}

// ─── Threads ─────────────────────────────────────────────────────────────────

/** Create a new conversation thread under the configured assistant */
export async function createThread(): Promise<BackboardThread> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/assistants/${getAssistantId()}/threads`,
    {
      method: "POST",
      headers: jsonHeaders(),
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
): Promise<BackboardMessageResponse[]> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/threads/${threadId}/messages`,
    { method: "GET", headers: authHeaders() }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `[Backboard] Get messages failed (${res.status}): ${text}`
    );
  }

  return res.json();
}

// ─── Messages ────────────────────────────────────────────────────────────────

export interface SendMessageOptions {
  /** Enable persistent memory: "Auto" | "Readonly" | "Off" */
  memory?: "Auto" | "Readonly" | "Off";
  /** Whether to stream the response via SSE */
  stream?: boolean;
  /** LLM provider override — e.g. "google", "openai", "anthropic" */
  llmProvider?: string;
  /** Model name override — e.g. "gemini-2.5-flash-preview-05-20" */
  modelName?: string;
}

/**
 * Send a message to a Backboard thread and receive the AI response.
 * Uses form-data per the Backboard API spec for POST /threads/{id}/messages.
 *
 * IMPORTANT: Pass `llmProvider` and `modelName` to control which LLM handles
 * the request. Without these, Backboard defaults to GPT-4o.
 */
export async function sendMessage(
  threadId: string,
  content: string,
  opts: SendMessageOptions = {}
): Promise<BackboardMessageResponse> {
  const {
    memory = "Auto",
    stream = false,
    llmProvider,
    modelName,
  } = opts;

  // Backboard's message endpoint uses form-data
  const formData = new URLSearchParams();
  formData.append("content", content);
  formData.append("stream", String(stream));

  if (memory) {
    formData.append("memory", memory);
  }

  // Model routing — the critical fix!
  if (llmProvider) {
    formData.append("llm_provider", llmProvider);
  }
  if (modelName) {
    formData.append("model_name", modelName);
  }

  const res = await fetchWithTimeout(
    `${BASE_URL}/threads/${threadId}/messages`,
    {
      method: "POST",
      headers: authHeaders(),
      // URLSearchParams automatically sets Content-Type to application/x-www-form-urlencoded
      body: formData,
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `[Backboard] Send message failed (${res.status}): ${text}`
    );
  }

  return res.json();
}

/**
 * Send a message with a pre-built ModelConfig.
 * Convenience wrapper that merges model config into SendMessageOptions.
 */
export async function sendMessageWithModel(
  threadId: string,
  content: string,
  model: ModelConfig,
  opts: Omit<SendMessageOptions, "llmProvider" | "modelName"> = {}
): Promise<BackboardMessageResponse> {
  return sendMessage(threadId, content, {
    ...opts,
    llmProvider: model.llmProvider,
    modelName: model.modelName,
  });
}

// ─── Streaming Messages ──────────────────────────────────────────────────────

/**
 * Stream a message response via SSE.
 * Returns an AsyncGenerator that yields parsed BackboardStreamEvents.
 */
export async function* streamMessage(
  threadId: string,
  content: string,
  opts: Omit<SendMessageOptions, "stream"> = {}
): AsyncGenerator<BackboardStreamEvent> {
  const { memory = "Auto", llmProvider, modelName } = opts;

  const formData = new URLSearchParams();
  formData.append("content", content);
  formData.append("stream", "true");

  if (memory) formData.append("memory", memory);
  if (llmProvider) formData.append("llm_provider", llmProvider);
  if (modelName) formData.append("model_name", modelName);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS * 3);

  try {
    const res = await fetch(`${BASE_URL}/threads/${threadId}/messages`, {
      method: "POST",
      headers: authHeaders(),
      body: formData,
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "<no body>");
      throw new Error(`[Backboard] Streaming failed (${res.status}): ${text}`);
    }

    if (!res.body) throw new Error("[Backboard] No response body for streaming");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        try {
          const payload = JSON.parse(trimmed.slice(6)) as BackboardStreamEvent;
          if (payload.type === "error" || payload.type === "run_failed") {
            throw new Error(
              payload.error ?? payload.message ?? "Streaming error"
            );
          }
          yield payload;
        } catch (e) {
          if (e instanceof SyntaxError) continue; // skip malformed JSON lines
          throw e;
        }
      }
    }
  } finally {
    clearTimeout(timer);
  }
}

// ─── Memory ──────────────────────────────────────────────────────────────────

/** Explicitly add a memory to the assistant's persistent memory store */
export async function addMemory(
  content: string,
  metadata?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = { content };
  if (metadata) data.metadata = metadata;

  const res = await fetchWithTimeout(
    `${BASE_URL}/assistants/${getAssistantId()}/memories`,
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(data),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[Backboard] Add memory failed (${res.status}): ${text}`);
  }

  return res.json();
}

/** Get all memories for the assistant */
export async function getMemories(): Promise<{
  memories: BackboardMemory[];
  total_count: number;
}> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/assistants/${getAssistantId()}/memories`,
    { method: "GET", headers: authHeaders() }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[Backboard] Get memories failed (${res.status}): ${text}`);
  }

  return res.json();
}

/** Delete a specific memory */
export async function deleteMemory(memoryId: string): Promise<void> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/assistants/${getAssistantId()}/memories/${memoryId}`,
    { method: "DELETE", headers: authHeaders() }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `[Backboard] Delete memory failed (${res.status}): ${text}`
    );
  }
}

/** Poll memory operation status (use after sendMessage with memory="Auto") */
export async function getMemoryOperationStatus(
  operationId: string
): Promise<BackboardMemoryOperationStatus> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/assistants/memories/operations/${operationId}`,
    { method: "GET", headers: authHeaders() }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `[Backboard] Memory operation status failed (${res.status}): ${text}`
    );
  }

  return res.json();
}

/**
 * Poll until a memory operation completes.
 * Throws if the operation fails or times out.
 */
export async function waitForMemoryOperation(
  operationId: string,
  maxWaitMs: number = 30_000,
  pollIntervalMs: number = 1_000
): Promise<BackboardMemoryOperationStatus> {
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const status = await getMemoryOperationStatus(operationId);

    if (status.status === "COMPLETED") return status;
    if (status.status === "FAILED") {
      throw new Error(
        `[Backboard] Memory operation failed: ${status.status_message}`
      );
    }

    // Still IN_PROGRESS — wait and retry
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `[Backboard] Memory operation timed out after ${maxWaitMs}ms`
  );
}
