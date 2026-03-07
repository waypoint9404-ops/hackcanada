# MVP Action Plan: "Waypoint for Municipal Outreach"

## Overview
This document outlines the actionable, high-level steps to take Waypoint from 0 to a 100% working Minimum Viable Product (MVP). It is designed to be a comprehensive reference for software developers building the platform, ensuring that design, security, and AI integrations align with the core scenario of a municipal social worker (e.g., Sarah) operating out of her car.

---

## Phase 1: Foundational Setup & Design System
*Goal: Scaffold the Next.js application, configure the PWA, and establish the strict design rules.*

1. **Next.js & PWA Initialization**
   - Initialize a Next.js App Router project (`npx create-next-app@latest`).
   - Configure Progressive Web App (PWA) manifest and service workers (e.g., using `next-pwa`) to ensure mobile accessibility and a "car dashboard" app feel. 
2. **Design System & Tailwind Configuration**
   - Implement the "Humane Utility & Dignified Minimalism" design system as described in `DESIGN_SYSTEMS.md`.
   - Update `tailwind.config.ts` and `globals.css` with the specific typography (`Instrument Serif`, `Geist Sans`, `Geist Mono`), custom color palette (Alabaster, Bone, Deep Charcoal), and spacing rules.
   - Build foundational UI components: Generous touch targets (>48px), fixed bottom navigation, and accessible typography plates.

---

## Phase 2: Security & Authentication (Auth0)
*Goal: Implement secure, API-protecting authentication using Auth0.*

1. **Auth0 Setup**
   - Configure a new Auth0 tenant and Next.js Web Application in the Auth0 dashboard.
   - Install `@auth0/nextjs-auth0`.
2. **Next.js Integration**
   - Set up the dynamic API route (`/app/api/auth/[auth0]/route.ts`) for Universal Login.
   - Protect sensitive frontend pages using `withPageAuthRequired`.
   - Configure access token retrieval (`auth0.getAccessToken()`) inside Route Handlers to securely authenticate backend calls to external APIs.

---

## Phase 3: Data Layer & AI Memory (Supabase + Backboard)
*Goal: Set up stateful data storage and AI thread management.*

1. **Supabase Initialization (Relational Data)**
   - Create a Supabase project and install `@supabase/ssr` to securely initialize `createServerClient` in Next.js Middleware and Server Components.
   - **Schema Design:**
     - `users`: Maps to Auth0 roles for social workers.
     - `clients`: Stores core demographic data (Name, Phone number) and high-level synthesized metadata (e.g., tags like `[HOUSING]`, risk level enum: `LOW/MED/HIGH`).
     - *Note: Critical narrative/case notes live in Backboard, not Supabase.* Each client record in Supabase should have a `backboard_thread_id`.
2. **Backboard Initialization (AI Memory OS)**
   - Set up API keys for Backboard.
   - Establish utility functions to initialize a new "Thread" for new clients.
   - Configure memory streams: Route objective factual events to the **Factual Stream** and AI syntheses to the **Narrative Stream**.

---

## Phase 4: Core Frontend Flows
*Goal: Build the mobile-first visual interface.*

1. **Client List View**
   - Build a dashboard showing the seeded 10–15 synthetic clients.
   - Fetch client data from Supabase and display names, tags, and the simple crisis indicator (dusty red, burnt orange, sage green).
2. **Per-Client Detail View**
   - **Actionable Summary:** Fetch and display the constantly updated narrative summary from Backboard at the top of the page.
   - **Timeline UI:** Build the chronological interface to display factual case notes, using `Geist Mono` for timestamps and system tags.
   - **Data Hydration:** Next.js Server Components should fetch Supabase metadata and Backboard thread history concurrently to render this view.

---

## Phase 5: Voice Note Ingestion Pipeline
*Goal: Allow workers to capture voice memos that automatically translate to structured case notes.*

1. **Audio Capture UI**
   - Create a "Record Visit" bottom-sheet or modal.
   - Implement browser MediaRecorder API to record short voice memos.
2. **Transcription & Ingestion API (`/api/ingest`)**
   - Send the audio blob to an API route.
   - Transcribe the audio using a fast transcription service (e.g., Whisper API or Gemini audio ingestion).
   - **Backboard Agent Routing:**
     - Send the transcript to the Backboard thread.
     - Configure Backboard to use a fast model (Gemini Flash) to clean the note and write to the Factual Stream.
     - Automatically update the Narrative Stream (via Gemini Pro) with the newly updated risk level and summary.
3. **Webhook/Callback to Supabase**
   - Update the respective Supabase `clients` row with any newly categorized tags and the updated risk level.

---

## Phase 6: Audio Recaps (ElevenLabs)
*Goal: Provide a hands-free "brush-up" utility while driving.*

1. **Recap Generation API (`/api/recap`)**
   - When the user taps "Generate audio recap", fetch the latest factual summary for that *specific client* from Backboard.
2. **ElevenLabs Integration**
   - Install `@elevenlabs/node`.
   - Call the `elevenlabs.textToSpeech.stream` method using a highly professional and calm AI voice.
   - Stream the audio chunks seamlessly back to the PWA (`core.Stream<ElevenLabs.StreamingAudioChunkWithTimestampsResponse>`).
3. **Playback UI**
   - Implement the subtle CSS-only waveform animation/glow (`accent-primary`) while the audio plays.

---

## Phase 7: Smart Case Q&A (RAG)
*Goal: Enable conversational context isolation per client.*

1. **Chat UI**
   - Add a minimalist chat box floating at the bottom of the Client Detail view.
2. **Backboard Q&A Route**
   - Send the query along with the respective `backboard_thread_id` to a Next.js Server Action / Route Handler.
   - Pass the query directly to Backboard. Because the contextual thread and RAG are native to Backboard, it will reason purely over the specified client's factual history and return the answer.

---

## Phase 8: Document Ingestion & Case Memory
*Goal: Elevate documents to first-class case memory inputs alongside calls and visits.*

1. **Document Storage & Upload API**
   - Create secure Supabase object storage bucket (`case-documents`).
   - Add frontend `<DocumentUpload>` and `<DocumentList>` components on the client detail page.
2. **Text Extraction & Classification**
   - Extract text from PDFs/documents via `pdf-parse` or similar.
   - Run AI classification to decide if the document translates into a CREATE (new issue) or UPDATE (adding context to an existing note).
3. **Dual-Channel Memory Architecture**
   - Incorporate `addMemory()` to write structured factual metadata (document stream) to Backboard explicitly for robust retrieval filtering.
   - Dispatch `[DOCUMENT FACTS]` and a full synthesized prose case note into the persistent Backboard thread.
4. **Summary & Risk Re-evaluation**
   - Force trigger summary regeneration immediately after document ingestion to adjust `risk_level` (LOW/MED/HIGH) strictly based on the extracted contents.

---

## Unresolved Considerations & Future-Proofing
- **HIPAA/Compliance Storage:** Evaluate if audio recordings are stored temporarily in memory during ingestion or if they require an encrypted bucket in Supabase. For the MVP, recommend processing in-memory and discarding the audio buffer after transcription.
- **Offline Capabilities:** As a PWA meant for on-the-go workers, consider implementing basic optimistic UI updates and service-worker caching for read-only access in zero-connectivity zones (e.g., apartment building basements).
- **Scale Limits:** Monitor Backboard memory ingestion token limits and ElevenLabs character limits for synthetic clients during demo day to ensure stable presentation.
