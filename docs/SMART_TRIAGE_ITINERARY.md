# Smart Triage Itinerary — Technical Specification

> **Status**: Implemented  
> **Last updated**: 2026-03-07  
> **Feature owner**: Waypoint Team

---

## 1. Overview

The Smart Triage Itinerary replaces the concept of a blank calendar with an
intelligent, AI-powered daily planner for municipal social workers. It combines:

- **Auto-extracted appointments** from voice notes and transcripts (zero data entry)
- **Manual appointment CRUD** for events not captured in transcripts
- **AI-ranked triage suggestions** to fill schedule gaps
- **On-demand morning audio briefing** via ElevenLabs TTS

The feature lives under a new **"Today"** tab in the bottom navigation dock.

---

## 2. Database Schema

### New table: `appointments`

```sql
CREATE TABLE IF NOT EXISTS appointments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id    UUID NOT NULL REFERENCES users(id),
  client_id    UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  event_type   TEXT NOT NULL CHECK (event_type IN (
    'home_visit','court','medical','phone_call','office','transport','other'
  )),
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ,
  location     TEXT,
  notes        TEXT,
  source       TEXT NOT NULL CHECK (source IN ('ai_extracted','manual')),
  source_message_id TEXT,
  status       TEXT NOT NULL DEFAULT 'tentative' CHECK (status IN (
    'confirmed','tentative','dismissed','completed'
  )),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Migration file: `supabase/migrations/004_create_appointments.sql`

---

## 3. Appointment Auto-Extraction

### 3.1 Prompt Extension

The `NOTE_STRUCTURING_PROMPT` in the ingest pipeline is extended to ask Gemini
to output a `[NEXT_APPOINTMENT]...[/NEXT_APPOINTMENT]` JSON block when future
commitments are mentioned in transcripts.

Example output:
```
[NEXT_APPOINTMENT]{"date":"2026-03-12","time":"10:00","type":"home_visit","description":"Roommate mediation","location":"client's apartment"}[/NEXT_APPOINTMENT]
```

### 3.2 Extraction Pipeline

The helper `lib/extract-appointment.ts` provides:

- `parseAppointmentFromResponse(text)` — Regex extraction of JSON block
- `resolveAppointmentDate(dateStr, timeStr)` — Resolves relative dates (Tuesday, tomorrow, etc.)
- `insertExtractedAppointment(workerId, clientId, extracted, sourceMessageId)` — DB insert
- `stripAppointmentBlock(text)` — Removes block from display text

Extraction runs in three ingestion points:
1. `POST /api/ingest` — primary voice note flow
2. `POST /api/share-target/process` — share target flow
3. `POST /api/clients/[id]/notes` — worker note edits (background)

AI-extracted appointments are always `status: 'tentative'`.

---

## 4. API Endpoints

### 4.1 `GET /api/itinerary/today`

Returns today's appointments for the authenticated worker.

**Query params**: `timezone` (IANA string, default `America/Toronto`)

**Response**:
```json
{
  "appointments": [{
    "id": "uuid",
    "client": { "id": "uuid", "name": "Marcus Thorne", "risk_level": "MED", "tags": ["LEGAL"] },
    "title": "Court Transport",
    "event_type": "transport",
    "starts_at": "2026-03-07T08:30:00-05:00",
    "status": "confirmed",
    "source": "ai_extracted"
  }],
  "date": "2026-03-07"
}
```

### 4.2 `GET /api/itinerary/suggestions`

Returns AI-ranked triage suggestions (top 5 clients who should be visited).

**Scoring formula**:
| Signal | Calculation | Max Score |
|--------|------------|-----------|
| Days since last contact | `min(days * 2, 40)` | 40 |
| Risk level | HIGH=30, MED=15, LOW=5 | 30 |
| Approaching deadlines | `30 - (days_until * 4)`, clamped 0-30 | 30 |
| **Total** | Sum | **100** |

### 4.3 `POST /api/itinerary/briefing`

Generates an on-demand audio morning briefing. Rate-limited (5/min).

**Flow**:
1. Fetch today's appointments + top 2 suggestions
2. Generate briefing script via Backboard (Gemini Flash, ephemeral thread)
3. TTS via ElevenLabs → return `audioBase64` + `briefingText`

### 4.4 Appointment CRUD

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/itinerary/appointments` | Create manual appointment |
| `PATCH` | `/api/itinerary/appointments/[id]` | Update any field |
| `DELETE` | `/api/itinerary/appointments/[id]` | Delete (ownership check) |
| `POST` | `/api/itinerary/appointments/[id]/confirm` | Set status → confirmed |
| `POST` | `/api/itinerary/appointments/[id]/dismiss` | Set status → dismissed |

---

## 5. Frontend

### 5.1 Page: `/today`

Client component at `app/(app)/today/page.tsx`. Mobile-first layout:

- **Top bar**: Date heading (serif display), refresh button
- **Morning Briefing**: Full-width accent button → audio player + transcript
- **Today's Schedule**: Chronological appointment cards
  - Confirmed: solid border, edit/delete actions
  - Tentative (AI): dashed border, confirm/dismiss buttons
  - "Add Appointment" button at bottom
- **Suggested Visits**: Ranked triage cards with reason chips + "Schedule Visit"

### 5.2 Components

| Component | File |
|-----------|------|
| `AppointmentCard` | `components/itinerary/appointment-card.tsx` |
| `SuggestionCard` | `components/itinerary/suggestion-card.tsx` |
| `MorningBriefing` | `components/itinerary/morning-briefing.tsx` |
| `AddAppointmentSheet` | `components/itinerary/add-appointment-sheet.tsx` |

### 5.3 Navigation

Bottom dock updated from 2 to 3 tabs: **Clients** | **Today** | **Profile**

---

## 6. File Manifest

### New files
| Path | Type |
|------|------|
| `supabase/migrations/004_create_appointments.sql` | SQL migration |
| `lib/extract-appointment.ts` | Extraction helper |
| `app/api/itinerary/today/route.ts` | API: today's schedule |
| `app/api/itinerary/suggestions/route.ts` | API: triage suggestions |
| `app/api/itinerary/briefing/route.ts` | API: morning briefing |
| `app/api/itinerary/appointments/route.ts` | API: create appointment |
| `app/api/itinerary/appointments/[id]/route.ts` | API: update/delete appointment |
| `app/api/itinerary/appointments/[id]/confirm/route.ts` | API: confirm action |
| `app/api/itinerary/appointments/[id]/dismiss/route.ts` | API: dismiss action |
| `app/(app)/today/page.tsx` | Page: itinerary view |
| `components/itinerary/appointment-card.tsx` | UI: appointment card |
| `components/itinerary/suggestion-card.tsx` | UI: suggestion card |
| `components/itinerary/morning-briefing.tsx` | UI: audio briefing |
| `components/itinerary/add-appointment-sheet.tsx` | UI: appointment form |

### Modified files
| Path | Change |
|------|--------|
| `app/api/ingest/route.ts` | Appointment extraction in prompt + post-processing |
| `app/api/share-target/process/route.ts` | Appointment extraction |
| `app/api/clients/[id]/notes/route.ts` | Appointment extraction in background task |
| `components/ui/bottom-nav.tsx` | Added "Today" tab |

---

## 7. Pitch Framing

> "Standard apps give social workers a calendar. We give them an intelligent
> itinerary. Sarah works out of her car — she doesn't have time to type
> 'Meeting with Marcus at 8:30' into her phone. Our Backboard agent extracts
> that commitment directly from her voice notes and schedules it automatically.
> Using ElevenLabs, she hits 'Play' while driving and gets an audio brief of
> her entire day, including safety reminders pulled from persistent client
> memory. And when she has a gap in her schedule, Waypoint actively triages her
> 80-person caseload so no one falls through the cracks."
