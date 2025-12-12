# Phase 2 Enhancement: Event Summaries in Friend Stats

> **Status**: ✅ **FULLY IMPLEMENTED** (2025-12-10)

---

## Implementation Summary

Phase 2 has been fully implemented with the following features:

### Location Enrichment
- **LLM-based extraction** using GPT-5 Responses API (default model: `gpt-5.2`)
- Extracts: `venue_name`, `neighborhood`, `city`, `cuisine`
- **Async parallel batching** with concurrency limits (2 concurrent)
- **Retry logic** with exponential backoff for rate limits
- **Deduplication** by location string to reduce API calls

### Solo Event Classification
- Classifies events without attendees into **SOCIAL**, **ACTIVITY**, or **OTHER**
- **SOCIAL events**: Extracts person names from titles (e.g., "Dinner with Masha" → ["Masha"])
- **ACTIVITY events**: Extracts category, activity_type, and venue from titles
- Activity categories: fitness, wellness, health, personal_care, learning, entertainment

### Data Models Implemented

```python
@dataclass
class FriendEvent:
    id: str
    summary: str | None
    date: str  # "2025-03-15"
    hours: float
    location_raw: str | None = None
    venue_name: str | None = None      # ✅ Enriched
    neighborhood: str | None = None    # ✅ Enriched
    cuisine: str | None = None         # ✅ Enriched

@dataclass
class FriendStats:
    email: str
    display_name: str | None
    event_count: int
    total_hours: float
    events: list[FriendEvent]          # ✅ Full event details

@dataclass
class InferredFriend:
    name: str                          # "Masha"
    normalized_name: str               # "masha"
    event_count: int
    total_hours: float
    events: list[FriendEvent]
    linked_email: str | None = None

@dataclass
class ActivityEvent:
    id: str
    summary: str | None
    date: str
    hours: float
    category: str                      # "fitness", "wellness", etc.
    activity_type: str                 # "yoga", "therapy", etc.
    venue_name: str | None = None
    neighborhood: str | None = None

@dataclass
class ActivityCategoryStats:
    category: str
    event_count: int
    total_hours: float
    top_venues: list[tuple[str, int]]
    top_activities: list[tuple[str, int]]

@dataclass
class MergeSuggestion:
    inferred_name: str
    suggested_email: str
    confidence: str                    # "high", "medium", "low"
    reason: str

@dataclass
class LocationStats:
    top_neighborhoods: list[tuple[str, int]]
    top_venues: list[tuple[str, int]]
    top_cuisines: list[tuple[str, int]]
    total_with_location: int
```

---

## Files Modified/Created

| File | Changes |
|------|---------|
| `models.py` | Added FriendEvent, InferredFriend, ActivityEvent, ActivityCategoryStats, MergeSuggestion, LocationStats |
| `stats.py` | Added compute_location_stats(), changed sort to event_count |
| `llm_enrich.py` | **NEW**: Full LLM enrichment module with async batching |
| `cli.py` | Updated with --enrich flag, wrapped-style display, JSON output |
| `pyproject.toml` | Added openai dependency |

---

## CLI Output Example

```
╭──────────────────────────────────────────────────────────────────────────────╮
│ 2025 Wrapped                                                                 │
╰──────────────────────────────────────────────────────────────────────────────╯

Your Year in Numbers
  392 events
  Busiest month: Nov
  Busiest day: Sat

Your NYC Footprint
  Top neighborhoods: Williamsburg (25), Greenpoint (18), Midtown (11)
  Top spots: Greenpoint Psychotherapy (10), JFK Airport (3)
  Top cuisines: Japanese (13), American (9), Korean (5)

Your Activities
  Entertainment: 17 sessions (mostly restaurant)
  Fitness: 17 sessions (mostly yoga)
      @ Vital
  Health: 15 sessions (mostly therapy)
      @ Greenpoint Psychotherapy

Your People (Calendar Invites)
  #1 angela.kaur (4 events)
      Suram Sushi & Ramen, AMC 34th Street 14
      (Hudson Yards, Midtown)

Your People (From Event Titles)
  #1 Beth (12 events)
      Kaoru, Mitr Thai Restaurant
      (Midtown, Midtown East)
  #2 Masha (10 events)
      Tashkent Supermarket, AMC 34th Street
      (FiDi, Greenwich Village, Midtown)
```

---

## JSON Output Schema

```json
{
  "year": 2025,
  "time_stats": {
    "total_events": 392,
    "total_hours": 1807.9,
    "events_per_month": {"1": 37, ...},
    "hours_per_month": {"1": 117.3, ...},
    "events_per_weekday": {"Mon": 46, ...},
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
  "location_stats": {
    "top_neighborhoods": [["Williamsburg", 25], ...],
    "top_venues": [["Greenpoint Psychotherapy", 10], ...],
    "top_cuisines": [["Japanese", 13], ...]
  },
  "inferred_friends": [
    {
      "name": "Beth",
      "normalized_name": "beth",
      "event_count": 12,
      "total_hours": 24.5,
      "linked_email": null,
      "events": [...]
    }
  ],
  "activity_stats": {
    "fitness": {
      "category": "fitness",
      "event_count": 17,
      "total_hours": 25.5,
      "top_venues": [["Vital", 10], ["Barry's", 5]],
      "top_activities": [["yoga", 12], ["climbing", 5]]
    },
    "health": {...},
    "wellness": {...}
  }
}
```

---

## Technical Implementation Details

### Async Batch Processing
```python
MAX_CONCURRENT_BATCHES = 2  # Limit concurrent API calls
BATCH_SIZE = 50             # Events per API call

async def _call_openai_parallel(client, events, prompt_template, parse_fn):
    batches = [events[i:i+BATCH_SIZE] for i in range(0, len(events), BATCH_SIZE)]
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_BATCHES)

    async def limited_batch(batch):
        async with semaphore:
            return await _call_openai_batch(client, batch, prompt_template, parse_fn)

    tasks = [limited_batch(batch) for batch in batches]
    results = await asyncio.gather(*tasks)
    return [item for batch_result in results for item in batch_result]
```

### Retry Logic with Exponential Backoff
```python
async def _call_openai_batch(..., max_retries=5):
    for attempt in range(max_retries):
        try:
            response = await client.responses.create(...)
            return parse_fn(response)
        except Exception as e:
            if "429" in str(e) or "rate_limit" in str(e).lower():
                wait_time = 5 * (2 ** attempt)  # 5s, 10s, 20s, 40s, 80s
                await asyncio.sleep(wait_time)
                continue
            raise
    return []
```

### Venue Extraction Priority
1. **From classification** (extracted from summary: "Yoga @ Vital" → "Vital")
2. **From location enrichment** (extracted from location_raw field)

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Events processed | 392 |
| Locations enriched | ~120 |
| Inferred friends discovered | ~50 |
| Activity categories detected | 5 |
| Total LLM batches | ~8 (locations) + ~6 (classification) |
| Estimated cost per run | ~$0.10 |

---

## Remaining Optional Enhancements

- [ ] Cache LLM results to disk for faster re-runs
- [ ] Places API integration for opaque URLs (goo.gl)
- [ ] Validate LLM output against test cases from future-phases.md
