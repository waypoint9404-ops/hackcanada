**Condensed MVP outline: Waypoint (~500 words)**
--------------------------------------

**Core persona and scenario**
-----------------------------

*   Core user: one municipal social worker in a Canadian city (e.g., Sarah, a municipal housing outreach worker).
    
*   Context: Sarah supports adults facing housing insecurity, mental‑health issues, and substance‑use challenges. She spends most of her day driving between visits, working out of her car on her phone—not at a desk.
    
*   Demo client: Alex, 45, with bipolar disorder who has missed a rent payment and is at risk of eviction, plus ~10–15 other synthetic clients at varying crisis levels.
    

**Main features**
-----------------

1.  Secure mobile‑first login (Auth0)
    
    *   Worker opens Waypoint (Next.js/React/Tailwind) on phone or laptop and signs in via Auth0’s Universal Login.​
        
    *   Auth0 enforces strong security (MFA/passwordless) for this highly sensitive data and attaches role/tenant claims for future authorization.​

```text
+-----------------------------+
|          WAYPOINT           |
|                             |
|  Secure access for          |
|  Municipal Social Workers   |
|                             |
|  [   Sign In via Auth0   ]  |
|                             |
+-----------------------------+
```
        
2.  Client list with crisis‑aware context
    
    *   Dashboard shows 10–15 synthetic clients with:
        
        *   Name, basic tags (housing / mental health / substance use).
            
        *   Simple crisis indicator (e.g., low/med/high) derived from past notes.
            
    *   This is the entry point into deeper per‑client memory.

```text
+-------------------------------------------------------------+
| Dashboard                                              ⚙️   |
| 12 assigned to Sarah                                        |
|                                                             |
| +-------------------+ +-------------------+ +-------------+ |
| | Alex Mercer       | | Sam Riley         | | Jamie T.    | |
| | 🔴 HIGH           | | 🟠 MED             | | 🟢 LOW      | |
| | [HOUSING]         | | [SUBSTANCE]       | | [HOUSING]   | |
| | [MENTAL_HEALTH]   | |                   | |             | |
| +-------------------+ +-------------------+ +-------------+ |
|                                                             |
|=============================================================|
|                 📇 Clients          👤 Profile              |
+-------------------------------------------------------------+
```
        
3.  Per‑client smart memory & timeline (Backboard)
    
    *   Each client has a Backboard thread as their persistent AI memory: 5–10 seeded notes (outreach visit, crisis call, shelter referral, relapse, missed appointment, etc.).
        
    *   Client detail view shows:
        
        *   Timeline of AI/human‑editable notes (chronological).
            
        *   Actionable summary/overview: short, constantly updated paragraph optimized for “brush‑up before a visit” (key facts, current situation, recommended next steps).
            
        *   Highly concise narrative summary (1–3 sentences capturing the case at a glance).

```text
+-----------------------------+
| ‹ Back       Alex Mercer    |
| 🔴 HIGH RISK                |
|-----------------------------|
| ⚡ Actionable Summary        |
| Alex missed rent on the 2nd.|
| Eviction risk high. Ensure  |
| medication is up to date.   |
|-----------------------------|
| 🎧 [ Generate Audio Recap ] |
|-----------------------------|
| ⏳ Timeline (Backboard)      |
| 10:45 AM - Voice Note       |
| Met at 4th St shelter. ...  |
|-----------------------------|
| Yesterday - Missed Appt     |
| Scheduled check-in ...      |
|                             |
|=============================|
| 🎙️ Record   |  [Ask Q&A...] |
+-----------------------------+
```

4.  Case Document Ingestion & Memory 
    
    *   The system is not just a call note tool; it is a living case memory platform that continuously updates from calls, notes, and uploaded case documents.
    *   Worker can upload PDFs and other case documents directly into the client’s case profile.
    *   System runs AI document ingestion to extract objective facts, agencies, and deadlines.
    *   AI decides whether to create a new case note or update an existing case note context.
    *   Original files are kept accessible via a centralized Case Documents area.
    *   Ensures that Q&A, summaries, and risk analysis use both interaction history and official records.
            
5.  AI‑assisted note creation (per client)
    
    *   In‑person visit flow:
        
        *   Worker opens Alex’s profile → taps “Record visit” → records short voice memo in the PWA.
            
        *   Backend transcribes audio and sends transcript + metadata to a Backboard “ingestion” agent.
            
        *   Backboard writes into Alex’s thread and returns:
            
            *   Clean, structured case note (which the worker can review and edit before finalizing).
                
            *   Auto‑tagged issue categories (housing, mental health, substance use, etc.).
                
            *   Updated risk level for Alex.

```text
+-----------------------------+
| Cancel          Save Note   |
|-----------------------------|
| 📝 Edit AI Case Note        |
| Client: Alex Mercer         |
| Date: Oct 24, 2:15 PM       |
|-----------------------------|
| [Note Content]              |
| Met Alex at the shelter. He |
| missed rent due to...       |
|                             |
| [Tags]                      |
| (x) HOUSING                 |
| (x) MENTAL_HEALTH           |
| (+) Add Tag                 |
|                             |
|=============================|
| Keyboard/Dictation tools    |
+-----------------------------+
```
                
    *   Phone‑call flow (MVP):
        
        *   Worker records a call on their device, then uses the PWA “Upload call recording” for a known client (select Alex) or “New client” flow.
            
        *   For a truly new caller, Waypoint creates a new client with name + phone and a fresh Backboard thread, then runs the same ingestion pipeline.

```text
+-----------------------------+
|                             |
|      (Background dimmed)    |
|                             |
|  +-----------------------+  |
|  | Recording Visit...    |  |
|  |                       |  |
|  |        00:45          |  |
|  |    ılılılllıılılı     |  |
|  |                       |  |
|  |  [🛑 Stop & Ingest]   |  |
|  +-----------------------+  |
|                             |
|=============================|
|   📇 Clients     👤 Profile   |
+-----------------------------+
```
            
5.  Smart Q&A inside each case
    
    *   On a client page, a chat box lets the worker ask questions like:
        
        *   “What interventions have we tried for Alex’s housing so far?”
            
        *   “Has Sam had any crises in the last month?”
            
    *   Backend forwards the question to Backboard, which uses the client’s persistent thread + RAG over their documents to answer within that case only.
        
6.  Per‑client voice recap (ElevenLabs)
    
    *   On a client profile, “Generate audio recap”:
        
        *   Backend asks Backboard for a short, factual, up‑to‑date summary of that _one_ client (status, last few interactions, key risks, next steps).
            
        *   That text goes to ElevenLabs to generate an audio file.
            
        *   PWA plays the audio so Sarah can listen while driving to Alex’s apartment.
            
    *   This is explicitly per‑client, not a global daily digest.
        

**Pitch framing**
-----------------

*   “Car dashboard” reality: Designed as a PWA with audio recaps and simple mobile UI because Sarah works from her phone between visits, not a laptop.
    
*   “If it’s not documented, it didn’t happen”: Backboard + Gemini are constrained to produce objective, structured notes—no emotional hallucinations—so case notes remain subpoena‑safe.​
    
*   “Hand‑off” problem: The persistent timeline and summary mean that if Sarah burns out and leaves, the next worker can understand 5 years of history in minutes.
    

This keeps the MVP tightly aligned with your original feature sketch while still cleanly highlighting Backboard for stateful case memory and Auth0 for secure, compliant access and API protection.

**Technical innovation details (Backboard + Auth0)**
----------------------------------------------------

At the core of our innovation is treating Backboard as the agent runtime and memory OS, not just a nicer vector DB. Backboard gives us stateful threads, long‑term and short‑term memory management, RAG, and tool orchestration in one API, with memory handled as first‑class infrastructure. For each client, we create a dedicated Backboard thread; this thread holds all transcripts, notes, and derived summaries so the system can reason over years of history without manually rebuilding prompts every time.

We then lean into Backboard’s philosophy of configurable, separated memory streams: different data types (objective facts, legal documents, worker reflections) are written into distinct “streams,” so they never compete or dilute each other during retrieval. The ingestion agent only writes verifiable facts and timestamped events into the factual stream, while summaries are written into a separate narrative stream. This lets the Q&A and “brush‑up” summaries prioritize high‑precision recall from the factual stream for subpoena‑safe documentation, while still drawing context from human‑friendly summaries when appropriate.​

On the modeling side, we use Backboard’s routing to run different Gemini models on the same case memory: a fast, cheaper model (Gemini Flash) for ingestion and note‑cleaning, and a more capable reasoning model (Gemini Pro or similar) for generating risk‑aware overviews and recap scripts—all without losing continuity when models change. Because Backboard treats memory as portable across 2,000+ models, we can swap or A/B test models without rewriting our memory logic.

For security and sponsor differentiation, Auth0 sits entirely at the API boundary. Auth0’s Universal Login protects access to the PWA and issues access tokens that gate every backend route (e.g., ingest call, fetch client thread, generate recap), following their “secure AI agents that can call APIs on users’ behalf” pattern. For any future high‑risk tools (e.g., syncing notes into a production case‑management system), we can wrap that tool with the Auth0 AI SDK’s withAsyncAuthorization() helper so the action is only executed after a CIBA/RAR push approval to the worker’s phone—an industry‑standard human‑in‑the‑loop mechanism for AI agents.