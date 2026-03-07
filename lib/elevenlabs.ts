/**
 * ElevenLabs audio client for Waypoint.
 *
 * Server-side only — never expose the API key to the client.
 *
 * Two capabilities:
 * 1. TTS (Text-to-Speech) — per-client audio recaps via generateSpeech/streamSpeech
 * 2. STT (Speech-to-Text) — voice memo/call transcription via transcribeAudio
 */

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

// ─── Constants ───────────────────────────────────────────────────────────────

/** George — calm, professional male voice. Good for case summaries. */
const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";

/** Scribe v1 — ElevenLabs' speech-to-text model */
const STT_MODEL_ID = "scribe_v1";

// ─── Client Singleton ────────────────────────────────────────────────────────

let _client: ElevenLabsClient | null = null;

function getClient(): ElevenLabsClient {
  if (!_client) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("Missing ELEVENLABS_API_KEY env var.");
    _client = new ElevenLabsClient({ apiKey });
  }
  return _client;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TTSOptions {
  /** ElevenLabs voice ID. Defaults to George. */
  voiceId?: string;
  /** Model ID. Defaults to eleven_multilingual_v2. */
  modelId?: string;
  /** Output format. Defaults to mp3_44100_128. */
  outputFormat?: string;
}

export interface VoiceInfo {
  voice_id: string;
  name: string;
  category?: string;
}

export interface TranscriptionWord {
  text: string;
  start: number;
  end: number;
  type?: string;
}

export interface TranscriptionResult {
  /** The full transcribed text */
  text: string;
  /** Detected language code (e.g., "en") */
  languageCode?: string;
  /** Word-level timing data */
  words?: TranscriptionWord[];
}

// ─── Voices ──────────────────────────────────────────────────────────────────

/** List all available voices. Useful for verifying API key + connection. */
export async function listVoices(): Promise<VoiceInfo[]> {
  const client = getClient();
  const response = await client.voices.getAll();

  const raw = response as unknown as { voices?: Array<{ voice_id: string; name: string; category?: string }> };
  const voices = raw.voices ?? [];

  return voices.map((v) => ({
    voice_id: v.voice_id,
    name: v.name,
    category: v.category,
  }));
}

// ─── Text-to-Speech ──────────────────────────────────────────────────────────

/**
 * Generate speech from text. Returns the full audio as a Buffer.
 * Use for short-to-medium text (case recap summaries).
 */
export async function generateSpeech(
  text: string,
  opts: TTSOptions = {}
): Promise<Buffer> {
  const {
    voiceId = DEFAULT_VOICE_ID,
    modelId = DEFAULT_MODEL_ID,
    outputFormat = DEFAULT_OUTPUT_FORMAT,
  } = opts;

  const client = getClient();

  const audioStream = await client.textToSpeech.convert(voiceId, {
    text,
    modelId,
    outputFormat: outputFormat as "mp3_44100_128",
  });

  // Collect the stream into a Buffer
  const chunks: Buffer[] = [];
  const reader = (audioStream as unknown as ReadableStream<Uint8Array>).getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks);
}

/**
 * Stream speech from text. Returns a ReadableStream for streaming responses.
 * Use for longer text where you want to start playback before generation completes.
 */
export async function streamSpeech(
  text: string,
  opts: TTSOptions = {}
): Promise<ReadableStream<Uint8Array>> {
  const {
    voiceId = DEFAULT_VOICE_ID,
    modelId = DEFAULT_MODEL_ID,
    outputFormat = DEFAULT_OUTPUT_FORMAT,
  } = opts;

  const client = getClient();

  const audioStream = await client.textToSpeech.stream(voiceId, {
    text,
    modelId,
    outputFormat: outputFormat as "mp3_44100_128",
  });

  const source = audioStream as unknown as ReadableStream<Uint8Array>;
  return source;
}

// ─── Speech-to-Text ──────────────────────────────────────────────────────────

/**
 * Transcribe an audio file to text using ElevenLabs Scribe v1.
 *
 * Accepts audio as a File or Blob (from multipart form data).
 * Returns the transcript text plus optional word-level timing data.
 *
 * Used by:
 * - /api/transcribe — standalone transcription endpoint
 * - /api/ingest — when audio is provided instead of text transcript
 */
export async function transcribeAudio(
  audioFile: File | Blob
): Promise<TranscriptionResult> {
  const client = getClient();

  const response = await client.speechToText.convert({
    file: audioFile,
    modelId: STT_MODEL_ID,
  });

  const raw = response as unknown as {
    text?: string;
    language_code?: string;
    words?: Array<{ text: string; start: number; end: number; type?: string }>;
  };

  return {
    text: raw.text ?? "",
    languageCode: raw.language_code,
    words: raw.words?.map((w) => ({
      text: w.text,
      start: w.start,
      end: w.end,
      type: w.type,
    })),
  };
}
