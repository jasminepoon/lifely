# Lifely Architecture

> System design for Google Calendar 2025 Wrapped
>
> **Last Updated**: 2025-12-10
> **Status**: Phase 1 ✅ Complete | Phase 2 ✅ Complete | Phase 3-4 Planned

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              LIFELY                                          │
│                    "Flighty, but for your life"                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Google Calendar  ───▶  Data Pipeline  ───▶  Enrichment  ───▶  Output     │
│                                                                              │
│   • Fetch events        • Normalize         • Locations      • JSON stats   │
│   • OAuth auth          • Friend stats      • LLM classify   • CLI display  │
│                         • Time stats        • Infer friends  • (UI later)   │
│                         • Location stats    • Activities     │              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## High-Level Architecture

```
                                 ┌─────────────────┐
                                 │  Google Cloud   │
                                 │  ┌───────────┐  │
                                 │  │ Calendar  │  │
                                 │  │ API       │  │
                                 │  └───────────┘  │
                                 └────────┬────────┘
                                          │
                    ┌─────────────────────▼─────────────────────┐
                    │                 LIFELY                     │
                    │                                            │
┌──────────┐       │  ┌──────────┐  ┌──────────┐  ┌──────────┐ │       ┌──────────┐
│  User    │       │  │  Auth    │  │  Fetch   │  │ Normalize│ │       │  Output  │
│          │──────▶│  │          │─▶│          │─▶│          │ │──────▶│          │
│ (CLI)    │       │  │ (OAuth)  │  │ (Cache)  │  │ (Clean)  │ │       │ (JSON)   │
└──────────┘       │  └──────────┘  └──────────┘  └──────────┘ │       └──────────┘
                    │        │                            │      │
                    │        ▼                            ▼      │
                    │  ┌───────────────────────────────────────┐│
                    │  │            STATS LAYER                ││
                    │  │  ┌──────────┐  ┌──────────┐           ││
                    │  │  │ Friend   │  │  Time    │           ││
                    │  │  │ Stats    │  │  Stats   │           ││
                    │  │  └──────────┘  └──────────┘           ││
                    │  └───────────────────────────────────────┘│
                    │                      │                     │
                    │                      ▼                     │
                    │  ┌───────────────────────────────────────┐│
                    │  │       LLM ENRICHMENT (Async)          ││
                    │  │  ┌──────────┐  ┌──────────┐           ││
                    │  │  │ Location │  │  Event   │           ││
                    │  │  │ Extract  │  │ Classify │           ││
                    │  │  └──────────┘  └──────────┘           ││
                    │  │       │              │                 ││
                    │  │       ▼              ▼                 ││
                    │  │  ┌──────────┐  ┌──────────┐           ││
                    │  │  │ Inferred │  │ Activity │           ││
                    │  │  │ Friends  │  │  Stats   │           ││
                    │  │  └──────────┘  └──────────┘           ││
                    │  └───────────────────────────────────────┘│
                    │                                            │
                    └────────────────────────────────────────────┘
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │     OpenAI      │
                                 │  ┌───────────┐  │
                                 │  │  GPT-5.1  │  │
                                 │  │ Responses │  │
                                 │  │    API    │  │
                                 │  └───────────┘  │
                                 └─────────────────┘
```

---

## Data Flow Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW PIPELINE                                 │
└─────────────────────────────────────────────────────────────────────────────┘

 PHASE 1 ✅                          PHASE 2 ✅
 ══════════                          ══════════

 ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
 │ Calendar│    │  Raw    │    │Normalized│   │ Email   │    │ Final   │
 │  API    │───▶│ Events  │───▶│ Events  │───▶│ Friends │───▶│ Stats   │
 │         │    │ (JSON)  │    │         │    │         │    │ (JSON)  │
 └─────────┘    └─────────┘    └─────────┘    └────┬────┘    └─────────┘
                    │                              │              ▲
                    ▼                              ▼              │
               ┌─────────┐                   ┌─────────┐         │
               │  Cache  │                   │ Time    │         │
               │  (disk) │                   │ Stats   │─────────┤
               └─────────┘                   └─────────┘         │
                                                                 │
 LLM ENRICHMENT (Async Parallel Batching)                       │
 ════════════════════════════════════════                       │
                                                                 │
               ┌─────────┐    ┌─────────┐                       │
               │ Location│    │ venue   │                       │
               │  Strings│───▶│ neighbor│───────────────────────┤
               │ (dedup) │    │ cuisine │                       │
               └─────────┘    └─────────┘                       │
                                                                 │
               ┌─────────┐    ┌─────────┐    ┌─────────┐        │
               │  Solo   │    │ Classify│    │ Inferred│        │
               │ Events  │───▶│ SOCIAL/ │───▶│ Friends │────────┤
               │         │    │ ACTIVITY│    │         │        │
               └─────────┘    └─────────┘    └─────────┘        │
                                   │                             │
                                   ▼                             │
                              ┌─────────┐                       │
                              │Activity │                       │
                              │Category │───────────────────────┘
                              │ Stats   │
                              └─────────┘
```

---

## Module Breakdown

### Core Modules (Phase 1) ✅

| Module | File | Responsibility | Input | Output |
|--------|------|----------------|-------|--------|
| **Auth** | `auth.py` | OAuth 2.0 flow, token management | `credentials.json` | Authenticated API service |
| **Fetch** | `fetch.py` | Retrieve calendar events, pagination, caching | API service, year | `list[dict]` raw events |
| **Models** | `models.py` | Data structures for all entities | - | Dataclasses |
| **Normalize** | `normalize.py` | Clean raw API data, timezone handling | Raw events | `list[NormalizedEvent]` |
| **Stats** | `stats.py` | Aggregate by friend, time, location | Normalized events | `FriendStats`, `TimeStats`, `LocationStats` |
| **CLI** | `cli.py` | User interface, orchestration | CLI args | Terminal output, JSON file |

### Enrichment Module (Phase 2) ✅

| Module | File | Responsibility | Input | Output |
|--------|------|----------------|-------|--------|
| **LLM Enrich** | `llm_enrich.py` | All LLM enrichment (async batching) | Events | See below |
| **Places Fallback** | `places.py` | Resolve Google Maps links via Places API (if key present) | Maps URL/text | `LocationEnrichment` |

**`llm_enrich.py` Functions:**

| Function | Purpose | Output |
|----------|---------|--------|
| `enrich_all_events_sync()` | Extract location data from events | `dict[str, LocationEnrichment]` |
| `classify_solo_events_sync()` | Classify events as SOCIAL/ACTIVITY/OTHER | `(list[InferredFriend], dict[str, ActivityCategoryStats])` |
| `suggest_merges()` | Link inferred names to email friends | `list[MergeSuggestion]` |
| `apply_enrichments_to_friend_stats()` | Add location data to friend events | `list[FriendStats]` (enriched) |

> **Note**: GPT-5.1 handles most enrichment; Places API is used opportunistically for Google Maps links when `GOOGLE_MAPS_API_KEY` is set.

---

## Data Models

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DATA MODELS                                       │
└─────────────────────────────────────────────────────────────────────────────┘

 RAW (from API)              NORMALIZED (Phase 1)           ENRICHED (Phase 2)
 ══════════════              ════════════════════           ══════════════════

 ┌─────────────┐             ┌─────────────────┐            ┌─────────────────┐
 │ API Event   │            │ NormalizedEvent │           │ NormalizedEvent │
 │ (dict)      │───────────▶│                 │──────────▶│ + PlaceDetails  │
 │             │            │ • id            │           │                 │
 │ • id        │            │ • summary       │           │ • venue_name    │
 │ • summary   │            │ • start/end     │           │ • neighborhood  │
 │ • start     │            │ • duration_mins │           │ • cuisine       │
 │ • end       │            │ • attendees[]   │           │                 │
 │ • attendees │            │ • location_raw  │           │                 │
 │ • location  │            │                 │           │                 │
 └─────────────┘            └─────────────────┘           └─────────────────┘
                                     │
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
                    ▼                                 ▼
          ┌─────────────────┐               ┌─────────────────┐
          │ NormalizedAttendee│             │ FriendEvent     │
          │                 │               │                 │
          │ • email         │               │ • id            │
          │ • display_name  │               │ • summary       │
          │ • is_self       │               │ • date          │
          │ • response_status│              │ • hours         │
          └─────────────────┘               │ • location_raw  │
                                            │ • venue_name    │
                                            │ • neighborhood  │
                                            │ • cuisine       │
                                            └─────────────────┘


 AGGREGATED STATS                           INFERRED (LLM)
 ════════════════                           ══════════════

 ┌─────────────────┐                        ┌─────────────────┐
 │ FriendStats     │                        │ InferredFriend  │
 │ (email-based)   │                        │ (name-based)    │
 │                 │                        │                 │
 │ • email         │                        │ • name          │
 │ • display_name  │◄──── merge ───────────▶│ • normalized    │
 │ • event_count   │      suggestion        │ • event_count   │
 │ • total_hours   │                        │ • total_hours   │
 │ • events[]      │                        │ • events[]      │
 └─────────────────┘                        │ • linked_email  │
                                            └─────────────────┘

 ┌─────────────────┐                        ┌─────────────────┐
 │ TimeStats       │                        │ MergeSuggestion │
 │                 │                        │                 │
 │ • total_events  │                        │ • inferred_name │
 │ • total_hours   │                        │ • suggested_email│
 │ • per_month     │                        │ • confidence    │
 │ • per_weekday   │                        │ • reason        │
 │ • busiest_day   │                        └─────────────────┘
 └─────────────────┘


 ACTIVITY ANALYSIS (LLM)
 ═══════════════════════

 ┌─────────────────┐                        ┌─────────────────────────┐
 │ ActivityEvent   │                        │ ActivityCategoryStats   │
 │                 │                        │                         │
 │ • id            │                        │ • category (fitness,    │
 │ • summary       │                        │   wellness, health,     │
 │ • date          │──── aggregate ────────▶│   personal_care,        │
 │ • hours         │                        │   learning, entertain)  │
 │ • category      │                        │ • event_count           │
 │ • activity_type │                        │ • total_hours           │
 │ • venue_name    │                        │ • top_venues[]          │
 │                 │                        │ • top_activities[]      │
 └─────────────────┘                        └─────────────────────────┘

 Categories:
 • fitness      - gym, yoga, climbing, running, pilates, cycling
 • wellness     - massage, spa, meditation, acupuncture
 • health       - doctor, dentist, therapy, physical therapy
 • personal_care - haircut, nails, facial, waxing
 • learning     - class, lesson, workshop, tutoring
 • entertainment - concert, show, movie, museum, game


 LOCATION (Phase 2)
 ══════════════════

 ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
 │ PlaceDetails    │      │ VenueStats      │      │ NeighborhoodStats│
 │                 │      │                 │      │                 │
 │ • place_id      │      │ • place_id      │      │ • name          │
 │ • name          │      │ • name          │      │ • city          │
 │ • address       │      │ • neighborhood  │      │ • event_count   │
 │ • neighborhood  │      │ • cuisine       │      │ • total_hours   │
 │ • city/state    │      │ • visit_count   │      │ • top_venues    │
 │ • lat/lng       │      │ • total_hours   │      │ • cuisines      │
 │ • types[]       │      └─────────────────┘      └─────────────────┘
 │ • primary_type  │
 │ • price_level   │
 │ • rating        │
 └─────────────────┘
```

---

## External Dependencies

### APIs Required

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL DEPENDENCIES                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           GOOGLE CLOUD                                       │
├─────────────────┬───────────────────┬───────────────────────────────────────┤
│ Service         │ Purpose           │ Auth                                  │
├─────────────────┼───────────────────┼───────────────────────────────────────┤
│ Calendar API    │ Fetch events      │ OAuth 2.0 (credentials.json)          │
│                 │                   │ Scope: calendar.readonly              │
└─────────────────┴───────────────────┴───────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                            OPENAI                                            │
├─────────────────┬───────────────────┬───────────────────────────────────────┤
│ Service         │ Purpose           │ Auth                                  │
├─────────────────┼───────────────────┼───────────────────────────────────────┤
│ GPT-5.1         │ All enrichment:   │ API Key (OPENAI_API_KEY)              │
│ Responses API   │ • Location extract│ ~$0.05 per run                        │
│                 │ • SOCIAL → names  │ Async batched: 50 events/request      │
│                 │ • ACTIVITY → type │ 2 concurrent batches max              │
│                 │ • Venue from title│ Retry with exponential backoff        │
└─────────────────┴───────────────────┴───────────────────────────────────────┘

> **Note**: Google Places API is used only when a Google Maps URL is present and a key is configured; everything else still relies on LLM extraction.
```

### Environment Variables

```bash
# credentials/credentials.json - OAuth client (downloaded from GCP)
# credentials/token.json       - Auto-generated after first auth

# Required for enrichment
OPENAI_API_KEY=your_openai_api_key
```

### Python Dependencies

```
Phase 1 (Core):
├── google-api-python-client  # Calendar API client
├── google-auth-oauthlib      # OAuth flow
├── google-auth-httplib2      # HTTP transport
├── python-dateutil           # Date parsing
└── rich                      # CLI formatting

Phase 2 (Enrichment):
└── openai                    # GPT-5.1 API client (async support)
```

---

## File Structure

```
lifely/
├── planning/
│   ├── concept.md              # Original vision doc
│   ├── phase1-plan.md          # Phase 1 implementation details
│   ├── phase2-event-summaries.md  # Phase 2 implementation details
│   ├── future-phases.md        # Phases 3-5 roadmap
│   ├── architecture.md         # This document
│   └── status.md               # Current project status
│
├── credentials/                # OAuth credentials (gitignored)
│   ├── credentials.json        # Downloaded from GCP
│   └── token.json              # Auto-generated
│
├── data/                       # Output data (gitignored)
│   ├── raw_events_2025.json    # Cached API response
│   └── stats_2025.json         # Computed statistics (full output)
│
├── src/lifely/
│   │
│   │  # ══════ PHASE 1 ✅ ══════
│   ├── __init__.py
│   ├── auth.py                 # OAuth authentication
│   ├── fetch.py                # Calendar API fetching
│   ├── models.py               # All data models
│   ├── normalize.py            # Event normalization
│   ├── stats.py                # Statistics computation
│   ├── cli.py                  # CLI entrypoint & display
│   │
│   │  # ══════ PHASE 2 ✅ ══════
│   └── llm_enrich.py           # GPT-5.1 enrichment (async batching)
│
├── tests/                      # Test files
├── pyproject.toml              # Project config
├── .env.example                # Environment template
└── README.md                   # Setup instructions
```

---

## Processing Pipeline Detail

### Step-by-Step Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROCESSING PIPELINE                                  │
└─────────────────────────────────────────────────────────────────────────────┘

STEP 1: AUTHENTICATION
══════════════════════
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ credentials/ │     │   OAuth      │     │  Authenticated│
│ credentials  │────▶│   Flow       │────▶│  Service      │
│ .json        │     │ (browser)    │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │ credentials/ │
                     │ token.json   │
                     │ (cached)     │
                     └──────────────┘


STEP 2: FETCH EVENTS
════════════════════
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Calendar    │     │  Paginate    │     │ raw_events_  │
│  API         │────▶│  (2500/page) │────▶│ 2025.json    │
│              │     │              │     │ (cached)     │
└──────────────┘     └──────────────┘     └──────────────┘
       │
       │ Parameters:
       │ • timeMin: 2025-01-01
       │ • timeMax: 2026-01-01
       │ • singleEvents: true
       │ • orderBy: startTime
       ▼


STEP 3: NORMALIZE
═════════════════
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Raw Events  │     │  For each:   │     │ Normalized   │
│  (dict[])    │────▶│  • Parse TZ  │────▶│ Events       │
│              │     │  • Calc dur  │     │              │
└──────────────┘     │  • Clean att │     └──────────────┘
                     │  • Detect self│
                     └──────────────┘


STEP 4: COMPUTE STATS (Email-based)
═══════════════════════════════════
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Normalized   │     │  Group by:   │     │ FriendStats  │
│ Events       │────▶│  • Attendee  │────▶│ (email-based)│
│              │     │  • Filter sys│     │              │
└──────────────┘     │  • Sum hours │     └──────────────┘
       │             └──────────────┘            │
       │                                         │
       ▼                                         │
┌──────────────┐                                 │
│ TimeStats    │                                 │
│ • per month  │                                 │
│ • per weekday│                                 │
│ • busiest day│                                 │
└──────────────┘                                 │
                                                 │

STEP 5a: LOCATION ENRICHMENT (Async Parallel)
═════════════════════════════════════════════
┌──────────────────────────────────────────────────────────────────────────┐
│  Input: Unique location strings from all events                          │
│                                                                          │
│  ┌──────────────┐    Processing:                                         │
│  │   OpenAI     │    • Async parallel batches (2 concurrent)             │
│  │   GPT-5.1    │    • 50 events per batch                               │
│  │   Responses  │    • Retry with exponential backoff (5s, 10s, 20s...)  │
│  │   API        │    • Deduplication by location string                  │
│  │              │                                                        │
│  │  (~$0.05)    │    Output: venue_name, neighborhood, city, cuisine     │
│  └──────────────┘                                                        │
└──────────────────────────────────────────────────────────────────────────┘


STEP 5b: SOLO EVENT CLASSIFICATION (Async Parallel)
═══════════════════════════════════════════════════
┌──────────────────────────────────────────────────────────────────────────┐
│  Input: Events without attendees (solo events)                           │
│                                                                          │
│  ┌──────────────┐    Classification:                                     │
│  │   OpenAI     │    • SOCIAL → extract names ["Masha", "John"]          │
│  │   GPT-5.1    │    • ACTIVITY → category, activity_type, venue         │
│  │   Responses  │    • OTHER → skip                                      │
│  │   API        │                                                        │
│  │              │    Venue extraction from summary:                      │
│  │  (~$0.05)    │    • "Yoga @ Vital" → venue: "Vital"                   │
│  └──────────────┘    • "Climbing at Brooklyn Boulders" → venue: "BB"     │
└──────────────────────────────────────────────────────────────────────────┘


STEP 5c: AGGREGATE RESULTS
══════════════════════════
              ┌─────────────────────────────────────────────────────────┐
              │  Apply enrichments & aggregate:                          │
              │                                                          │
              │  • FriendStats.events → venue_name, neighborhood, etc.  │
              │  • SOCIAL events → aggregate into InferredFriends        │
              │  • ACTIVITY events → aggregate into ActivityCategoryStats│
              │  • Venue priority: classification > location enrichment  │
              └─────────────────────────────────────────────────────────┘


STEP 5d: MERGE SUGGESTIONS
══════════════════════════
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Inferred     │     │  Match:      │     │ Merge        │
│ Friends      │────▶│  • name in   │────▶│ Suggestions  │
│              │     │    email     │     │              │
└──────────────┘     └──────────────┘     └──────────────┘


STEP 6: OUTPUT
══════════════
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ All Stats    │     │  Serialize   │     │ stats_2025   │
│              │────▶│  to JSON     │────▶│ .json        │
│              │     │              │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
       │
       │
       ▼
┌──────────────┐
│ CLI Display  │
│ (rich/wrapped│
│  style)      │
└──────────────┘
```

---

## Output Schema

### Final JSON Structure (Phase 2)

```json
{
  "year": 2025,
  "generated_at": "2025-12-10T15:30:00Z",

  "time_stats": {
    "total_events": 392,
    "total_hours": 1807.9,
    "events_per_month": {"1": 37, "2": 21, ...},
    "hours_per_month": {"1": 117.3, ...},
    "events_per_weekday": {"Mon": 46, "Tue": 36, ...},
    "busiest_day": ["2025-06-14", 12, 152.4]
  },

  "friend_stats": [
    {
      "email": "friend@example.com",
      "display_name": "Friend Name",
      "event_count": 4,
      "total_hours": 8.8,
      "events": [
        {
          "id": "abc123",
          "summary": "Dinner",
          "date": "2025-03-15",
          "hours": 2.5,
          "location_raw": "Thai Villa, Brooklyn",
          "venue_name": "Thai Villa",
          "neighborhood": "Williamsburg",
          "cuisine": "Thai"
        }
      ]
    }
  ],

  "inferred_friends": [
    {
      "name": "Masha",
      "normalized_name": "masha",
      "event_count": 3,
      "total_hours": 6.5,
      "linked_email": null,
      "events": [...]
    }
  ],

  "merge_suggestions": [
    {
      "inferred_name": "Masha",
      "suggested_email": "masha.k@gmail.com",
      "confidence": "high",
      "reason": "'Masha' matches email prefix"
    }
  ],

  "activity_stats": {
    "fitness": {
      "category": "fitness",
      "event_count": 45,
      "total_hours": 67.5,
      "top_venues": [["Vital Climbing", 15], ["Equinox", 12]],
      "top_activities": [["yoga", 20], ["climbing", 15], ["gym", 10]]
    },
    "wellness": {
      "category": "wellness",
      "event_count": 12,
      "total_hours": 18.0,
      "top_venues": [["Aire Ancient Baths", 5]],
      "top_activities": [["massage", 6], ["meditation", 4]]
    },
    "health": {...},
    "personal_care": {...},
    "learning": {...},
    "entertainment": {...}
  },

  "location_stats": {
    "top_venues": [...],
    "top_neighborhoods": [...],
    "top_cuisines": [...]
  }
}
```

---

## Phase Roadmap

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PHASE ROADMAP                                      │
└─────────────────────────────────────────────────────────────────────────────┘

 PHASE 1 ✅                PHASE 2 ✅               PHASE 3                PHASE 4
 Calendar Pipeline         LLM Enrichment           Full Stats + Prompt    Visual UI
 ══════════════════        ══════════════           ═══════════════════    ═════════

 ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐    ┌─────────────────┐
 │ • OAuth auth    │      │ • Location LLM  │      │ • Context tags  │    │ • HTML/CSS      │
 │ • Fetch events  │      │ • Solo classify │      │ • Streaks calc  │    │ • Flighty-style │
 │ • Normalize     │ ───▶ │ • Infer friends │ ───▶ │ • LLM narrative │───▶│ • Charts/maps   │
 │ • Email friends │      │ • Activity stats│      │ • Hour buckets  │    │ • Shareable     │
 │ • Time stats    │      │ • Async batching│      │                 │    │                 │
 │ • JSON output   │      │ • Rate limiting │      │                 │    │                 │
 │ • CLI display   │      │ • Merge suggest │      │                 │    │                 │
 │                 │      │ • Neighborhoods │      │                 │    │                 │
 └─────────────────┘      └─────────────────┘      └─────────────────┘    └─────────────────┘

 Dependencies:             Dependencies:            Dependencies:          Dependencies:
 • Calendar API           • Phase 1 complete       • Phase 2 complete     • Phase 3 complete
 • OAuth credentials      • OpenAI API key         • All stats computed   • Static HTML gen
                                                                          • Tailwind CSS
                                                                          • Chart.js
```

---

## Caching Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CACHING STRATEGY                                    │
└─────────────────────────────────────────────────────────────────────────────┘

 LAYER 1: Calendar Events ✅
 ═══════════════════════════
 File: data/raw_events_{year}.json
 Key: year
 TTL: Manual refresh (--no-cache flag)
 Size: ~1-5 MB typical

 LAYER 2: LLM Caching (Future Enhancement)
 ═════════════════════════════════════════
 Status: NOT IMPLEMENTED
 Rationale: LLM calls are cheap (~$0.10/run) and fast (~30s)
 Future: Could cache by location_raw string to reduce API calls


 Cache Flow:
 ───────────

 Calendar Request ───▶ Check Cache ───▶ HIT ───▶ Return cached
                             │
                             │ MISS
                             ▼
                        Call API ───▶ Store in cache ───▶ Return fresh

 LLM Request ───▶ Always call API (no caching currently)
```

---

## Error Handling

| Error | Source | Handling |
|-------|--------|----------|
| OAuth expired | Calendar API | Auto-refresh token, re-auth if needed |
| Rate limited (429) | OpenAI API | ✅ Exponential backoff (5s, 10s, 20s, 40s, 80s) |
| LLM timeout | OpenAI API | ✅ Retry up to 5 times with backoff |
| Parse failure | LLM response | Log warning, skip event, continue |
| Network error | Any API | Retry 3x, then fail gracefully |
| Missing API key | OpenAI | ✅ Warn and skip enrichment gracefully |

---

## Security Considerations

| Asset | Protection |
|-------|------------|
| `credentials.json` | Gitignored, never commit |
| `token.json` | Gitignored, user-specific |
| API keys | Environment variables, never in code |
| Calendar data | Local only, gitignored |
| Friend emails | Local only, not uploaded anywhere |

---

## Performance Targets

| Operation | Target | Actual | Notes |
|-----------|--------|--------|-------|
| Full year fetch | < 30s | ~5s | ✅ Cached after first run |
| Stats computation | < 5s | < 1s | ✅ In-memory processing |
| LLM location enrichment | < 60s | ~20s | ✅ Async parallel (2 concurrent) |
| LLM solo classification | < 60s | ~15s | ✅ Async parallel (2 concurrent) |
| Total (cached calendar) | < 90s | ~40s | ✅ LLM calls every run |
| Total (fresh) | < 2min | ~45s | ✅ Including calendar fetch |

## Cost Targets

| Component | Cost | Notes |
|-----------|------|-------|
| OpenAI LLM (locations) | ~$0.05 | Per run |
| OpenAI LLM (classification) | ~$0.05 | Per run |
| **Total per run** | ~$0.10 | ✅ Achieved |
