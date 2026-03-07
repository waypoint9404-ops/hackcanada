# Waypoint MVP — Implementation Notes

## Architecture Overview

Waypoint is a mobile-first Progressive Web App (PWA) designed for municipal social workers. 

*   **Frontend Data Fetching:** Next.js App Router Server Components fetch initial data directly from Supabase, bypassing REST APIs for speed and security. Client Components are used strictly for interactive elements (Audio Recap, Voice Recorder, Q&A Chat, Note Review Modal) and utilize custom REST endpoints (`/api/*`).
*   **Authentication & Security:** Auth0 handles identity management (via Google Login). The `@auth0/nextjs-auth0` SDK provides middleware route protection. Unauthenticated users are strictly barred from `/dashboard` and `/api/*` routes.
*   **Per-Worker Data Security:** The `syncUser()` function maps an Auth0 login (sub string) to a UUID in the Supabase `users` table. The `clients` table relies on the `assigned_worker_id` foreign key. The `/dashboard` view explicitly filters clients where `assigned_worker_id === current_user_id`.
*   **AI Memory Architecture (Backboard.io):** Every client has exactly **one** persistent Backboard Thread (`backboard_thread_id`).
    *   **Ingestion:** Voice notes (processed via ElevenLabs STT) or text transcripts are sent to the thread. The AI structure the note, extracts tags, and assigns a risk level.
    *   **Worker Editing:** Crucially, if a worker edits the AI-generated note, that edit is persisted *back to the same thread* as a follow-up message (`"[WORKER EDIT] ..."`) so the AI accurately recalls the correct information during future interactions.
    *   **Actionable Summary:** The `/api/clients/[id]/summary` route hits the thread with a specific prompt to generate a real-time narrative summary.
    *   **Q&A Chat:** The `/api/qna` route queries the thread, providing the worker with context-aware answers about the specific client's history.

## Core Workflows

### 1. New Client Creation & Auto-Detection
If a worker encounters a new unhoused individual, they can begin recording a voice note immediately without manually creating a profile.
*   **Flow:** The PWA sends the audio to `/api/ingest`. If `clientId` is missing, the backend transcribes the audio, uses a regex to search for a phone number in the transcript, and attempts to map it to an existing client.
*   **Auto-Create:** If no match is found, the backend uses Gemini Flash to extract a name from the transcript, automatically provisions a new Supabase client record and Backboard thread, assigned to the logged-in worker.

### 2. Graceful API Degradation (ElevenLabs)
Due to potential rate-limiting or quota exhaustion on the free ElevenLabs tier, the application employs graceful degradation:
*   **Audio Recap:** If `/api/recap` fails to generate audio, it returns a `warning` flag and a `recapText` string. The `<AudioRecap>` component detects this and renders a distinct "Text Fallback" UI.
*   **Voice Ingestion:** The `<VoiceRecorder>` component features a toggle between "Voice" (MediaRecorder) and "Text Entry" modes. If STT fails or the user is in a loud environment, they can paste text notes directly.

## Design System

The application leverages a bespoke utility-class configuration via Tailwind CSS v4 (`app/globals.css`). It strictly follows a unified Alabaster color palette (no dark mode), ensuring high contrast and optimal legibility outdoors. The typography pairs Instrument Serif for major headings with Geist sans/mono for UI elements. Status badges (HIGH/MED/LOW) use specifically calibrated, desaturated "dusty" colors (e.g., `#B92B27` for high risk) rather than generic red/yellow/green.

## Database Schema (Supabase)

```sql
-- users
id UUID PRIMARY KEY,
auth0_id TEXT UNIQUE,
name TEXT,
email TEXT,
role TEXT DEFAULT 'social_worker'

-- clients
id UUID PRIMARY KEY,
assigned_worker_id UUID REFERENCES users(id),
backboard_thread_id TEXT,
name TEXT,
phone TEXT,
tags TEXT[],
risk_level TEXT (LOW/MED/HIGH),
summary TEXT
```

## Environment Variables
*   `APP_BASE_URL`: e.g., `http://localhost:3000`
*   `AUTH0_SECRET`: 32-byte generated string
*   `AUTH0_BASE_URL`: e.g., `http://localhost:3000`
*   `AUTH0_ISSUER_BASE_URL`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`: From Auth0 Dashboard
*   `BACKBOARD_API_KEY`: Private API Key
*   `BACKBOARD_ASSISTANT_ID`: The ID of the primary Assistant logic
*   `ELEVENLABS_API_KEY`: Private API Key
*   `SUPABASE_PROJECT_URL`: Core REST endpoint
*   `SUPABASE_PUBLISHABLE_KEY`: Anon key
*   `SUPABASE_DEFAULT_SECRET_KEY`: Service role key (used intensely by `createAdminClient` for backend bypass route handling)
