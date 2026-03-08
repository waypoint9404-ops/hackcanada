# Waypoint: AI-Powered Case Memory for Social Workers

Social workers are the backbone of our communities, but they are trapped in a digital dark age. Up to 65% of their week is spent fighting fragmented paperwork, unsearchable PDFs, and chaotic legacy systems instead of actually helping people in crisis. When cases change hands, critical history is lost. 

**Waypoint** is a mobile-first, AI-powered case memory platform designed to solve this. It doesn't just digitize notes—it utilizes advanced LLM architectures to act as a secure, continuous intelligence layer for case workers on the go.

---

## 🎯 Current Scope & Features

Waypoint is built to be used in the field, primarily accessed via mobile devices while workers move between client visits.

*   **Crisis-Aware Dashboard:** Workers instantly see their assigned clients, automatically tagged with risk levels (e.g., HIGH RISK: EVICTION) derived from their recent case history.
*   **Instant Voice Ingestion:** Workers can record a disorganized voice memo immediately following a client visit. The platform transcribes the audio and restructures it into an objective, subpoena-safe, factual case note.
*   **Thread-Scoped Case Memory (RAG):** Workers can upload legacy case documents (PDFs, court notices) directly to a client's profile. They can then chat with the client's localized history, instantly retrieving answers based on years of collected data.
*   **Audio Recaps (ElevenLabs):** Because workers drive between visits, they can tap a button to hear a highly concise, AI-generated voice recap of the client's current crisis. They get crucial context safely, before ever stepping out of the car.

---

## 🚀 Key Technical Innovations

We built Waypoint around two core technologies, treating AI not as a gimmick, but as an orchestration layer and strict API boundary.

### 1. Backboard.io (Intelligent Orchestration)
We didn't just use Backboard as a simple LLM wrapper; we leveraged its deep memory features and custom model routing:
- **Dynamic Dual-Model Routing:** We hooked into Backboard's native Google integration. Lightning-fast ingestion of messy notes is routed to **Gemini Flash** (acting as an ETL pipeline). The resulting case thread is then passed to **Gemini Pro** for deep reasoning and risk assessment.
- **Thread-Scoped RAG:** Every client is mapped 1:1 with a unique Backboard Thread ID. When a document is uploaded, we utilize Backboard's native *Thread-Level Document API*. This ensures the RAG pipeline is strictly scoped to that individual client, totally preventing cross-client data leaks.

### 2. Auth0 (API Boundary & Secure AI Agents)
Security is non-negotiable for HIPAA and PIPEDA-compliant data.
- **Universal Login:** We use Auth0 for seamless passwordless/MFA authentication.
- **Strict API Gating:** Auth0 sits entirely at our backend API boundary. Every time our frontend requests an AI action (like ingesting a transcript or summarizing a file), an Auth0 access token validates the request. We utilize the 'Secure AI Agents' pattern, ensuring AI operations only execute on behalf of a verified user, paving the way for human-in-the-loop push approvals for high-risk data mutations.

---

## 💻 Tech Stack

- **Frontend:** Next.js (App Router), React, Tailwind CSS, shadcn/ui
- **Authentication & Security:** Auth0 (`@auth0/nextjs-auth0`)
- **AI & Orchestration:** Backboard.io (Agentic Memory), Google Gemini (Flash & Pro via native integration)
- **Database & Storage:** Supabase (PostgreSQL, Storage Buckets)
- **Voice & Audio:** Native Web Speech API (Transcription), ElevenLabs (Voice Generation)

---

## 🛠️ Getting Started (Development)

First, clone the repository and install dependencies:

```bash
npm install
```

Ensure you have your `.env.local` configured with the required keys for Supabase, Auth0, Backboard, and ElevenLabs.

Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application in action.
