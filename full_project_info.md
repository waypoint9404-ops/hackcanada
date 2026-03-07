# General

[https://www.perplexity.ai/search/what-are-the-top-niches-unders-DePfwW9gRzGGwM\_U.xoWtw](https://www.perplexity.ai/search/what-are-the-top-niches-unders-DePfwW9gRzGGwM_U.xoWtw)  
[https://hack-canada-2026.devpost.com/](https://hack-canada-2026.devpost.com/#prizes)

Sponsor Prizes We Wanna Go For:

- [https://backboard.io](https://backboard.io) using with gemini api  
- Auth0 for dashboard authentication  
- Elevenlabs  
- Google Antigravity  
- Stan challenge

Could potentially use following for a demo to simulate a client call: [https://bland.ai](https://bland.ai)

# What is a social worker

### **Main Role**

A social worker’s job is to **help people access support and solve problems that affect their daily lives**.

### **What Social Workers Do**

1. **Assess situations**  
    They talk with clients to understand problems such as housing issues, family conflict, or financial stress.  
2. **Provide support and counseling**  
    They help people cope with emotional or social problems and guide them toward healthier decisions.  
3. **Connect people with resources**  
    They link clients to services like housing programs, food banks, healthcare, therapy, or financial assistance.  
4. **Advocate for clients**  
    They help people deal with systems like schools, hospitals, courts, or government services.  
5. **Protect vulnerable people**  
    Many work in child protection or elder care to make sure people are safe.

### **Where Social Workers Work**

You’ll find them in places like:

* Schools  
* Hospitals  
* Child protection agencies  
* Community organizations  
* Government programs  
* Mental health clinics

### **Example**

A family struggles to pay rent and their child is missing school. A social worker might:

* help them apply for housing support  
* connect them to food programs  
* work with the school to support the child  
* provide counseling for family stress

### **Simple way to think about it**

A social worker is **a problem-solver who helps people navigate difficult life situations and access the help they need**.

# What problems do social workers face

## **What frontline social workers actually face**

These are the core pain points you should design around, not just “they’re busy.”

* Heavy caseloads and burnout  
  * Workers often juggle 40–80 cases at once in some settings.​  
  * Heavy caseloads plus admin burden are a primary driver of burnout and turnover.  
* Paperwork dominates their week  
  * Studies report social workers spending up to 65% of their week on paperwork, with as little as 20% of time in face‑to‑face contact.​  
  * A single child‑protection case can require hundreds of forms and thousands of pages.​  
* Administrative overload and bad tools  
  * Excessive documentation, compliance, and reporting can take half of their time.​  
  * Templates and information systems are often inappropriate, repetitive, and frustrating, leading to inadequate or incomplete documentation.​  
* Fragmented information and poor “case memory”  
  * Notes are scattered across forms, PDFs, email, spreadsheets, and legacy systems.  
  * Poor documentation practices make it hard to see the whole picture, coordinate with other agencies, and track long‑term goals.  
* Risk of “invisible work”  
  * If something isn’t recorded, it’s treated as if it never happened when managers allocate resources or evaluate risk.​  
  * Fragmented, task‑oriented digital documentation contributes to fragmented care trajectories for clients.​  
* Early but limited AI adoption  
  * AI in social work case management is still in early stages, with a few tools focusing mainly on decision‑support and documentation.  
  * There is clear evidence of benefits (decision‑making support, risk prevention, service monitoring), but only a handful of empirical implementations exist so far.​

These problems combine into a simple reality: they’re spending more time wrestling systems than helping people.

# What we could do

## **What a “case memory copilot” could do**

Your angle: persistent, per‑client memory plus auto‑documentation, built explicitly for frontline social work realities.

## **1\. Turn raw interactions into structured case notes**

Goal: after every call or visit, they get “good enough” notes in seconds instead of 30–60 minutes.

* Worker records or uploads a short transcript / bullet notes about an interaction.  
* AI converts it into:  
  * A properly structured case note (situation, interventions, outcome, next steps).  
  * Auto‑tagged metadata: risk level, themes (housing, addiction, employment), agencies involved.  
* This directly reduces the documentation burden that currently eats half their time.

## **2\. Maintain a living, longitudinal “case timeline”**

Goal: when they open a case, they immediately see the story so far, not just forms.

* Consolidated, chronological view of major events, decisions, and contacts from all past notes.  
* Quick answers like:  
  * “What has changed in this client’s situation over the last 3 months?”  
  * “Which interventions have we already tried for housing/relapse?”  
* Fixes the “fragmented documents → fragmented care” problem.

## **3\. Smart retrieval under heavy caseloads**

Goal: support workers juggling 40–80 active cases by making recall trivial.

* Search by natural language over the entire caseload:  
  * “Show me all clients with recent domestic violence incidents and no current shelter referral.”  
  * “Which clients have a court date coming up next month?”  
* Per‑client AI “profile” summary: 5 bullet snapshot they can read before a visit or call.

## **4\. Triage and prioritization support**

Goal: help them decide who needs attention now, without replacing clinical judgement.

* AI suggests a daily or weekly priority list based on:  
  * Risk indicators in the notes.  
  * Time since last contact.  
  * Upcoming deadlines (court, housing, benefits).  
* Aligns with recommended caseload triage strategies (rank by urgency/complexity).​

## **5\. Better inter‑agency coordination**

* Auto‑generated “summary packets” for partners or handoffs (e.g., when a worker leaves and cases are reassigned).  
* Addresses the documented issue that poor records make cooperation and information exchange difficult.

Goal: make it easier to work across clinics, shelters, police, etc., without losing context.

* For each client, the system tracks: which agencies are involved, what they’ve done, and key contacts.

# Hackathon Plan

## **Core user: one municipal social worker**

Pick a concrete setting for your story, e.g., “city social worker supporting adults facing homelessness and mental‑health challenges.”

**Option 1:**

The Persona: Sarah, a Municipal Housing Outreach Worker.

Her Role: She supports adults facing severe housing insecurity, substance abuse, and mental health challenges.

The Demo Client: Alex, a 45-year-old with bipolar disorder who just missed a rent payment and is at risk of eviction.

Why this works: It perfectly highlights the need for inter-agency coordination (she has to deal with landlords, mental health clinics, and the city), high risk (potential homelessness), and the need for rapid context switching (she has 60 other clients just like Alex).

**Option 2:**

## **Minimal but powerful feature set**

1. Secure login (Auth0)  
   * Worker logs into a simple dashboard.  
   * They see a list of 10–15 clients (with synthetic data for now) representing different client profiles.  
     * Ensure flexibility in crisis level   
2. Per‑client smart memory (using backboard io) with timeline  
   * Seed each client with 5–10 summarized notes: outreach visit, crisis call, shelter referral, relapse, missed appointment, etc.  
   * When a Client Card is clicked on the UI, the following is seen:  
     * AI/human-editable notes organized by a timeline  
     * A short actionable summary/overview section that’s constantly updated after every event (phone call or in-person interaction):  
       1. including key relevant details (specifically optimized for a social worker to “brush up” on or gain a quick overview of the case). This can include recommended next steps, etc.  
       2. A highly concise, short narrative summary  
3. AI‑assisted note creation (that updates the backboard context note system for each client):  
   * For online phone calls:   
   * New interactions (for phone call accounts not present in the database) means a new client will be automatically created with the following info:  
     * Name  
     * Phone number  
     * A fresh backboard io context system is created for the new client. This context system will include comprehensive notes of the interaction and will initialize the timeline-organized system of the notes using the current date.   
   * For in-person meetups, the social worker clicks the client and a button to record transcript and backboard io integration to update the context system for the specific client  
   * On submit, AI:  
     * Produces a clean, structured case note.  
     * Auto‑tags issue categories and risk level.  
4. Smart Q\&A available within each case:  
   * Chat box that answers questions like:  
     * “What interventions have we tried for Alex’s housing?”  
     * “Has Sam had any crises in the last month?”  
   * This showcases the persistent memory across all notes for that client.  
5. Voice‑powered recap (ElevenLabs)   
   * “Generate client update” → model writes a brief update that could be sent to a supervisor.  
   * ElevenLabs turns it into an audio summary so the worker can listen on the way to a visit.  
   * THIS IS CRUCIAL BECAUSE SOCIAL WORKERS ARE USUALLY ON THE MOVE, NOT SITTING AT HOME ON THEIR LAPTOPS

That’s enough to demonstrate: less paperwork, better recall, and safer decisions.

Key insights for the pitch:

- The "Car Dashboard" Reality: Frontline workers do a lot of their work from their cars on their phones between home visits. An app that requires them to sit at a laptop is useless. The ElevenLabs audio summary feature is pure gold here—she can listen to the case summary while driving to Alex's apartment.  
- "If it’s not documented, it didn’t happen": In social work, case notes are legal documents. If they get subpoenaed for a child welfare or eviction case, the notes need to be factual and objective. AI shouldn't "hallucinate" emotional states; it should structure facts.  
- The "Hand-off" Problem: Burnout leads to high turnover. When a worker quits, 60 vulnerable clients are handed to a new worker who has to read 5 years of scattered PDF notes. Your "Case Timeline" solves this instantly.

Other great talking points:

- Social worker data is highly sensitive, and auth0 has HIPAA and PIPEDA compliance which makes it a good option. We must require secure login for viewing a dashboard with sensitive information.

**Surface level summary**  
A secure, mobile-first AI case assistant for municipal social workers: one worker manages high-risk clients facing homelessness, mental-health, and substance-use challenges, with each client getting a persistent timeline, updated summary, AI-generated factual case notes, case Q\&A, and audio recaps for use between visits. It’s designed to reduce paperwork, improve recall, and make handoffs safer, while fitting a real Canadian homelessness-support context and using secure login plus voice playback for on-the-go work.

# Blackboard research

**The Core Idea (simple explanation)**

* Most Ai models like ChatGPT or Claude are stateless  
  * The forget about conversations   
  * They don't naturally remember past events or users.  
* Blackboard solves this problems by adding persistent memory to ai systems so they can remember context across sections.  
  * A chatbot remembers your preferences next week  
  * An AI agent remembers what you did yesterday.  
1) **What it actually does**   
* Blackboard stores important information from conversations so the AI can recall it later.  
* User preferences   
* Past messages   
* Documents   
* Agent state   
2) **Access to thousands of Ai**   
* Instead of integrating these models individually, Backboard gives one  API access to thousands of LLM’s    
* Switch models easily   
* Compare models   
* Avoid vendor lock-in  
3) **Built in RAG (retrieval augmented generation)**  
   * Lets the AI search documents or databases before answering   
   * PDF’s   
   * Spreadsheets  
   * Internal company documents   
   * Blackboard includes this capability by default  
4) **Stateful threads**   
   * content contentKeeps the conversations inside the threads so AI agents maintain continuity over time  
   * Previous tasks   
   * Previous questions   
   * Ongoing workflows

      **5\)  Multi-agent system**

* It allows multiple AI agents to share memory   
* Example   
  * **Agent A**  
  * (research) → finds data  
  * **Agent B**  
  * (writer) → writes report  
  * **Agent C**  
  * (reviewer) → checks output  
* All share the same memory

       **6\)**  **Why it exists** 

* Ai systems usually break when they become complex because   
* Models forget context  
* Memory systems are unreliable   
* Developers must connect many tools  
* Backboard tries to solve this by combining the whole AI stack into one platform

        **7\) Real-World Example**

* You must build memory storage   
* Vector database  
* Model routing   
* Retrieval system  
* Conversation state   
* **With Backboard**   
* One api handles it all

| Tool | Analogy |
| :---- | :---- |
| LLM (GPT) | The brain  |
| RAG | Search engine |
| Memory system | Long-term memory |
| Backboard | The whole operating system |

      

**Surface level summary**  
[Blackboard.io](http://Blackboard.io) is a developer platform that gives AI systems persistent memory, access to thousands of models, and built in tools (RAG, routing, agents) through one unified API.

# BACKBOARD SPLIT STUFF

### ***1\. Storing Case Notes***

***Every time a social worker creates a new note (from a transcript, a call, a visit), that note gets pushed into Backboard under that client's unique ID.***

***Worker submits interaction → Gemini structures it → Backboard stores it***

***Without Backboard, those notes only exist in a database as plain text. With Backboard, they're embedded and searchable by meaning, not just keywords.***

---

### ***2\. Powering the "Summarize Case" Button***

***When a worker clicks "Summarize Case", the app queries Backboard to pull all stored memories for that client, passes them to Gemini, and gets back a clean narrative summary. Backboard is what makes the summary span months of history, not just the last session.***

---

### ***3\. The Chat Q\&A Feature***

***This is the most visible use. When a worker asks:***

***"What housing interventions have we tried for Alex?"***

***That question goes to Backboard as a semantic search over Alex's stored notes. Backboard returns the most relevant chunks, Gemini reads them and gives a conversational answer. Without Backboard, Gemini would have no idea who Alex is.***

---

### ***4\. Cross-Caseload Search***

***When a worker searches something like:***

***"Which clients haven't been contacted in 3 weeks?"***

***Backboard searches across all client namespaces simultaneously, pulling relevant note chunks from multiple clients at once. This is what enables the triage/prioritization feature.***

# MVP Outline

## **Condensed MVP outline (\~500 words)**

## **Core persona and scenario**

* Core user: one municipal social worker in a Canadian city (e.g., Sarah, a municipal housing outreach worker).  
* Context: Sarah supports adults facing housing insecurity, mental‑health issues, and substance‑use challenges. She spends most of her day driving between visits, working out of her car on her phone—not at a desk.  
* Demo client: Alex, 45, with bipolar disorder who has missed a rent payment and is at risk of eviction, plus \~10–15 other synthetic clients at varying crisis levels.

## **Main features**

1. Secure mobile‑first login (Auth0)  
   * Worker opens the PWA (Next.js/React/Tailwind) on phone or laptop and signs in via Auth0’s Universal Login.​  
   * Auth0 enforces strong security (MFA/passwordless) for this highly sensitive data and attaches role/tenant claims for future authorization.​  
2. Client list with crisis‑aware context  
   * Dashboard shows 10–15 synthetic clients with:  
     * Name, basic tags (housing / mental health / substance use).  
     * Simple crisis indicator (e.g., low/med/high) derived from past notes.  
   * This is the entry point into deeper per‑client memory.  
3. Per‑client smart memory & timeline (Backboard)  
   * Each client has a Backboard thread as their persistent AI memory: 5–10 seeded notes (outreach visit, crisis call, shelter referral, relapse, missed appointment, etc.).  
   * Client detail view shows:  
     * Timeline of AI/human‑editable notes (chronological).  
     * Actionable summary/overview: short, constantly updated paragraph optimized for “brush‑up before a visit” (key facts, current situation, recommended next steps).  
     * Highly concise narrative summary (1–3 sentences capturing the case at a glance).  
4. AI‑assisted note creation (per client)  
   * In‑person visit flow:  
     * Worker opens Alex’s profile → taps “Record visit” → records short voice memo in the PWA.  
     * Backend transcribes audio and sends transcript \+ metadata to a Backboard “ingestion” agent.  
     * Backboard writes into Alex’s thread and returns:  
       * Clean, structured case note.  
       * Auto‑tagged issue categories (housing, mental health, substance use, etc.).  
       * Updated risk level for Alex.  
   * Phone‑call flow (MVP):  
     * Worker records a call on their device, then uses the PWA “Upload call recording” for a known client (select Alex) or “New client” flow.  
     * For a truly new caller, app creates a new client with name \+ phone and a fresh Backboard thread, then runs the same ingestion pipeline.  
5. Smart Q\&A inside each case  
   * On a client page, a chat box lets the worker ask questions like:  
     * “What interventions have we tried for Alex’s housing so far?”  
     * “Has Sam had any crises in the last month?”  
   * Backend forwards the question to Backboard, which uses the client’s persistent thread \+ RAG over their documents to answer within that case only.  
6. Per‑client voice recap (ElevenLabs)  
   * On a client profile, “Generate audio recap”:  
     * Backend asks Backboard for a short, factual, up‑to‑date summary of that *one* client (status, last few interactions, key risks, next steps).  
     * That text goes to ElevenLabs to generate an audio file.  
     * PWA plays the audio so Sarah can listen while driving to Alex’s apartment.  
   * This is explicitly per‑client, not a global daily digest.

## **Pitch framing**

* “Car dashboard” reality: Designed as a PWA with audio recaps and simple mobile UI because Sarah works from her phone between visits, not a laptop.  
* “If it’s not documented, it didn’t happen”: Backboard \+ Gemini are constrained to produce objective, structured notes—no emotional hallucinations—so case notes remain subpoena‑safe.​  
* “Hand‑off” problem: The persistent timeline and summary mean that if Sarah burns out and leaves, the next worker can understand 5 years of history in minutes.

This keeps the MVP tightly aligned with your original feature sketch while still cleanly highlighting Backboard for stateful case memory and Auth0 for secure, compliant access and API protection.

## **Technical innovation details (Backboard \+ Auth0)**

At the core of our innovation is treating Backboard as the agent runtime and memory OS, not just a nicer vector DB. Backboard gives us stateful threads, long‑term and short‑term memory management, RAG, and tool orchestration in one API, with memory handled as first‑class infrastructure. For each client, we create a dedicated Backboard thread; this thread holds all transcripts, notes, and derived summaries so the system can reason over years of history without manually rebuilding prompts every time.

We then lean into Backboard’s philosophy of configurable, separated memory streams: different data types (objective facts, legal documents, worker reflections) are written into distinct “streams,” so they never compete or dilute each other during retrieval. The ingestion agent only writes verifiable facts and timestamped events into the factual stream, while summaries are written into a separate narrative stream. This lets the Q\&A and “brush‑up” summaries prioritize high‑precision recall from the factual stream for subpoena‑safe documentation, while still drawing context from human‑friendly summaries when appropriate.​

On the modeling side, we use Backboard’s routing to run different Gemini models on the same case memory: a fast, cheaper model (Gemini Flash) for ingestion and note‑cleaning, and a more capable reasoning model (Gemini Pro or similar) for generating risk‑aware overviews and recap scripts—all without losing continuity when models change. Because Backboard treats memory as portable across 2,000+ models, we can swap or A/B test models without rewriting our memory logic.

For security and sponsor differentiation, Auth0 sits entirely at the API boundary. Auth0’s Universal Login protects access to the PWA and issues access tokens that gate every backend route (e.g., ingest call, fetch client thread, generate recap), following their “secure AI agents that can call APIs on users’ behalf” pattern. For any future high‑risk tools (e.g., syncing notes into a production case‑management system), we can wrap that tool with the Auth0 AI SDK’s withAsyncAuthorization() helper so the action is only executed after a CIBA/RAR push approval to the worker’s phone—an industry‑standard human‑in‑the‑loop mechanism for AI agents.

