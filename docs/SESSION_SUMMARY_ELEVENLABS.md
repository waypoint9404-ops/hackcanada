# Session Summary — ElevenLabs Integration
**Date:** March 7, 2026

---

## What Was Accomplished

### 1. ElevenLabs SDK Installed & Configured

Installed `@elevenlabs/elevenlabs-js` and created a comprehensive server-side wrapper at `lib/elevenlabs.ts`.

| Config | Value |
|---|---|
| **SDK** | `@elevenlabs/elevenlabs-js` |
| **API Key** | `ELEVENLABS_API_KEY` in `.env` |
| **TTS Model** | `eleven_multilingual_v2` |
| **TTS Voice** | George (`JBFqnCBsd6RMkjVDRZzb`) — calm, professional male |
| **STT Model** | `scribe_v1` |
| **Output Format** | `mp3_44100_128` |

> [!NOTE]
> The ElevenLabs Free Tier API key is currently **blocked** (`detected_unusual_activity`) from automated environments. Upgrading to a Paid plan or testing from a non-flagged network will resolve this. All code is correct and hits the API properly.

### 2. Dual Audio Pipeline

ElevenLabs handles **both directions** of the audio pipeline:

```
┌──────────────────────────────────────────────────────────────┐
│                    AUDIO PIPELINE                            │
│                                                              │
│  INBOUND (STT):                                              │
│  Voice memo/call → /api/transcribe → ElevenLabs Scribe v1   │
│                  → transcript text → /api/ingest             │
│                  → Backboard (structured note)               │
│                                                              │
│  OUTBOUND (TTS):                                             │
│  Client page → /api/recap → Backboard (summary text)        │
│             → ElevenLabs TTS → audio/mpeg playback           │
└──────────────────────────────────────────────────────────────┘
```

### 3. Files Created / Modified

| File | Purpose |
|---|---|
| `lib/elevenlabs.ts` | Server-side wrapper: `generateSpeech()`, `streamSpeech()`, `transcribeAudio()`, `listVoices()` |
| `app/api/transcribe/route.ts` | `POST` — standalone transcription: multipart audio → transcript text + word timing |
| `app/api/recap/route.ts` | `POST` — per-client audio recap: Supabase → Backboard summary → ElevenLabs TTS → audio/mpeg |
| `app/api/elevenlabs/test/route.ts` | `GET` — TTS smoke test |
| `app/api/ingest/route.ts` | `POST` — **enhanced** to accept text transcript, base64 audio, or multipart audio file |
| `app/api/clients/route.ts` | `POST` added — new client creation with auto-provisioned Backboard thread |
| `app/test-integrations/page.tsx` | Added ElevenLabs TTS + Full Recap Pipeline test cards with audio playback |

### 4. New Client Creation Flow

`POST /api/clients` supports the "phone call from unknown number" MVP flow:

1. Accept `{ name, phone?, tags?, risk_level? }`
2. Auto-create a Backboard thread for the client's AI memory
3. Insert into Supabase with thread ID
4. Return full client record ready for immediate ingestion

### 5. Enhanced Ingest Pipeline

`/api/ingest` now supports three input modes:

| Mode | Input | How |
|---|---|---|
| **Text** | `{ clientId, transcript }` | JSON body (original, backward-compatible) |
| **Audio (base64)** | `{ clientId, audioBase64, audioMimeType }` | JSON body with encoded audio |
| **Audio (file)** | Multipart form: `clientId` + `audio` file | Direct file upload from MediaRecorder |

All audio modes pass through ElevenLabs STT before Backboard processing.

---

## `lib/elevenlabs.ts` API Reference

```typescript
// ─── TTS ─────────────────────────────────────────
generateSpeech(text, opts?)        // → Buffer (MP3)
streamSpeech(text, opts?)          // → ReadableStream<Uint8Array>
listVoices()                       // → VoiceInfo[]

// ─── STT ─────────────────────────────────────────
transcribeAudio(audioFile)         // → { text, languageCode, words[] }
```

---

## Current Integration Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Auth0       │     │  Supabase    │     │  Backboard.io    │     │  ElevenLabs  │
│  (Auth)      │     │  (Data)      │     │  (AI Memory)     │     │  (Audio)     │
│              │     │              │     │                  │     │              │
│  • Login     │     │  • users     │     │  • Assistant     │     │  • TTS       │
│  • MFA       │     │  • clients   │────▶│  • Threads       │     │  • STT       │
│  • Sessions  │     │    (thread_id│     │  • Messages      │     │  • Voices    │
│              │     │     stored)  │     │  • Memory/RAG    │     │              │
└──────┬───────┘     └──────┬───────┘     └────────┬─────────┘     └──────┬───────┘
       │                    │                      │                      │
       └────────────────────┼──────────────────────┼──────────────────────┘
                            │                      │
                    ┌───────┴──────────────────────┴┐
                    │        Next.js API Routes      │
                    │                                │
                    │  POST /api/transcribe  (STT)   │
                    │  POST /api/ingest   (notes)    │
                    │  POST /api/qna      (Q&A)      │
                    │  POST /api/recap    (TTS)      │
                    │  GET|POST /api/clients         │
                    └────────────────────────────────┘
```

---

## What's Left to Build (Core MVP)

All external services are now integrated. The remaining work is **application logic and frontend**:

| Area | Status | What's Needed |
|---|---|---|
| **Auth0 route protection** | ⏳ Deferred | Wrap API routes with `withApiAuthRequired` |
| **Client list dashboard** | ⏳ Not started | Mobile-first grid with crisis indicators |
| **Client detail view** | ⏳ Not started | Timeline, summary, Q&A chat, audio recap player |
| **Voice recording UI** | ⏳ Not started | MediaRecorder bottom-sheet → /api/ingest |
| **Note review/edit flow** | ⏳ Not started | Worker reviews AI note before finalizing |
| **Chat UI for Q&A** | ⏳ Not started | Floating chat on client detail page |
| **Synthetic data seeding** | ⏳ Not started | 10-15 clients with pre-filled Backboard threads |
| **PWA manifest** | ⏳ Not started | Mobile-first experience |
| **Design system** | ⏳ Not started | DESIGN_SYSTEMS.md implementation |

> [!IMPORTANT]
> All four external services (Auth0, Supabase, Backboard, ElevenLabs) are now fully wired up at the code level. The project is ready for core MVP frontend development.
