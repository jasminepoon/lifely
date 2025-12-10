# Phase 2 Enhancement: Event Summaries in Friend Stats

> **Status**: ✅ **IMPLEMENTED** (2025-12-10)

> **Goal**: Show which events you shared with each friend, with summaries and (later) resolved locations.

---

## Implementation Summary

This enhancement has been implemented. FriendStats now includes full event details:

```python
@dataclass
class FriendEvent:
    id: str
    summary: str | None
    date: str  # "2025-03-15"
    hours: float
    location_raw: str | None = None
    # Phase 2 location enrichment (pending):
    venue_name: str | None = None
    neighborhood: str | None = None
    cuisine: str | None = None

@dataclass
class FriendStats:
    email: str
    display_name: str | None
    event_count: int
    total_hours: float
    events: list[FriendEvent]  # ← Now includes full event details
```

---

## Original Problem (Solved)
- We stored `event_ids` but lost the connection to event `summary`, `date`, and `location`
- The JSON output was incomplete for the "Wrapped" use case
- To render "You spent 12h with Angela: Dinner at X, Brunch at Y, ..." we needed event details

---

## Design Options

### Option A: Expand FriendStats with Event Details

**Change `event_ids` to `events` with full details:**

```python
@dataclass
class FriendEvent:
    """A single event shared with a friend."""
    id: str
    summary: str | None
    date: str  # ISO date: "2025-03-15"
    hours: float
    location_raw: str | None
    # Phase 2 additions:
    venue_name: str | None = None
    neighborhood: str | None = None

@dataclass
class FriendStats:
    email: str
    display_name: str | None
    event_count: int
    total_hours: float
    events: list[FriendEvent]  # ← Changed from event_ids
```

**Pros:**
- Self-contained: FriendStats has everything needed to render a "friend card"
- Simple serialization to JSON
- No joins needed at display time

**Cons:**
- Slight data duplication if same event has multiple attendees (each friend gets a copy)
- `FriendEvent` will grow as we add location fields

**Verdict:** Best for our use case. Duplication is minimal and acceptable.

---

### Option B: Separate Event Index (Normalized)

**Keep FriendStats lean, create separate lookup:**

```python
# FriendStats unchanged (keeps event_ids)

@dataclass
class EventSummary:
    id: str
    summary: str | None
    date: datetime
    duration_hours: float
    location_raw: str | None
    attendee_emails: list[str]
    # Phase 2:
    place: PlaceDetails | None = None

# Usage: event_index[event_id] → EventSummary
EventIndex = dict[str, EventSummary]
```

**Pros:**
- No data duplication
- Single source of truth for each event
- Cleaner data model

**Cons:**
- Requires passing `event_index` alongside `friend_stats` everywhere
- JSON output needs both structures, or requires join at export time
- More complex for consumers

**Verdict:** Over-engineered for our needs. Adds complexity without significant benefit.

---

### Option C: Hybrid (Reference + Index)

**FriendStats has lightweight refs, index has full details:**

```python
@dataclass
class FriendEventRef:
    id: str
    date: str
    hours: float

@dataclass
class FriendStats:
    email: str
    display_name: str | None
    event_count: int
    total_hours: float
    events: list[FriendEventRef]  # Lightweight

# Full details in separate index
EventIndex = dict[str, EventDetails]
```

**Verdict:** Worst of both worlds. Still need joins, but now have partial duplication.

---

## Recommendation: Option A

**Expand `FriendStats.events` to include summaries and locations.**

This aligns with the "Wrapped" output goal: each friend's data should be self-contained and ready to render.

---

## Implementation Plan

### Step 1: Add FriendEvent Model

**File:** `src/lifely/models.py`

```python
@dataclass
class FriendEvent:
    """A single event shared with a friend."""
    id: str
    summary: str | None
    date: str  # ISO format: "2025-03-15"
    hours: float
    location_raw: str | None = None
    # Phase 2 additions (populated after location enrichment):
    venue_name: str | None = None
    neighborhood: str | None = None
    cuisine: str | None = None
```

### Step 2: Update FriendStats

**File:** `src/lifely/models.py`

```python
@dataclass
class FriendStats:
    email: str
    display_name: str | None
    event_count: int
    total_hours: float
    events: list[FriendEvent] = field(default_factory=list)  # Changed from event_ids
```

### Step 3: Update compute_friend_stats()

**File:** `src/lifely/stats.py`

Current:
```python
friend_data[email]["event_ids"].append(event.id)
```

New:
```python
friend_event = FriendEvent(
    id=event.id,
    summary=event.summary,
    date=event.start.strftime("%Y-%m-%d"),
    hours=round(event.duration_minutes / 60, 1),
    location_raw=event.location_raw,
)
friend_data[email]["events"].append(friend_event)
```

### Step 4: Update JSON Output

**File:** `src/lifely/cli.py`

Update `_save_stats()` to serialize the new `events` structure:

```python
"friend_stats": [
    {
        "email": f.email,
        "display_name": f.display_name,
        "event_count": f.event_count,
        "total_hours": f.total_hours,
        "events": [
            {
                "id": e.id,
                "summary": e.summary,
                "date": e.date,
                "hours": e.hours,
                "location_raw": e.location_raw,
            }
            for e in f.events
        ],
    }
    for f in friend_stats
]
```

### Step 5: (Optional) Add Verbose Display

**File:** `src/lifely/cli.py`

Add `--verbose` flag to show event summaries in terminal output:

```
# Normal output:
1. angela.kaur@gmail.com    4 events    8.8 hours

# Verbose output:
1. angela.kaur@gmail.com    4 events    8.8 hours
   - 2025-03-15: Dinner at Thai Villa (2.5h)
   - 2025-04-02: Coffee (1.0h)
   - 2025-05-18: Birthday brunch (3.0h)
   - 2025-06-22: Movie night (2.3h)
```

---

## Integration with Phase 2 Location Work

### How It Fits

Phase 2's location enrichment naturally extends `FriendEvent`:

```
Phase 1 (now):
  FriendEvent.location_raw = "Thai Villa, 123 Main St, Brooklyn"

Phase 2 (location enrichment):
  FriendEvent.venue_name = "Thai Villa"
  FriendEvent.neighborhood = "Williamsburg"
  FriendEvent.cuisine = "Thai"
```

### Enrichment Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  FriendStats    │     │  PlacesClient    │     │  FriendStats    │
│  (with events,  │ ──▶ │  resolve each    │ ──▶ │  (with enriched │
│   location_raw) │     │  location_raw    │     │   venue/hood)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### New Function: enrich_friend_stats()

```python
def enrich_friend_stats(
    stats: list[FriendStats],
    places_client: PlacesClient,
) -> list[FriendStats]:
    """
    Enrich FriendEvent.location_raw with resolved place details.

    For each event with a location_raw:
    1. Resolve via PlacesClient (cached)
    2. Populate venue_name, neighborhood, cuisine
    """
    for friend in stats:
        for event in friend.events:
            if event.location_raw:
                place = places_client.resolve_location(event.location_raw)
                if place:
                    event.venue_name = place.name
                    event.neighborhood = place.neighborhood
                    event.cuisine = detect_cuisine(place)
    return stats
```

---

## Updated Phase 2 Checklist

### Prerequisites
- [ ] Enable Places API (New)
- [ ] Create Google API Key
- [ ] Set up billing alerts (~$20 budget for ≈1200 places)
- [ ] Configure Anthropic API Key (`ANTHROPIC_API_KEY`)

### Implementation Steps

**Location Enrichment:**
- [x] **Step 2.0**: Add FriendEvent model, update FriendStats ✅
- [ ] Step 2.1: Google Maps URL Parser (with redirect following for short URLs)
- [ ] Step 2.2: Places API Client with caching
- [ ] Step 2.3: PlaceDetails model
- [ ] Step 2.4: `enrich_friend_stats()` for locations
- [ ] Step 2.5: Neighborhood mapping (use Google's data for all cities)
- [ ] Step 2.6: Cuisine detection

**LLM Friend Extraction (Mandatory):**
- [ ] Step 2.7: Collect candidate social events (solo events with potential friend mentions)
- [ ] Step 2.8: LLM friend name extraction (Claude API)
- [ ] Step 2.9: Name deduplication & aggregation
- [ ] Step 2.10: Merge suggestions (inferred ↔ email friends)

**Output:**
- [ ] Step 2.11: Update CLI and JSON output with all enrichments

---

## Example Output After Implementation

### Phase 1 (current)
```json
{
  "friend_stats": [
    {
      "email": "angela.kaur@gmail.com",
      "display_name": null,
      "event_count": 4,
      "total_hours": 8.8,
      "events": [
        {
          "id": "abc123",
          "summary": "Dinner",
          "date": "2025-03-15",
          "hours": 2.5,
          "location_raw": "Thai Villa, 123 Main St, Brooklyn, NY"
        }
      ]
    }
  ]
}
```

### Phase 2 (after all enrichments)
```json
{
  "friend_stats": [
    {
      "email": "angela.kaur@gmail.com",
      "display_name": null,
      "event_count": 4,
      "total_hours": 8.8,
      "events": [
        {
          "id": "abc123",
          "summary": "Dinner",
          "date": "2025-03-15",
          "hours": 2.5,
          "location_raw": "Thai Villa, 123 Main St, Brooklyn, NY",
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
      "events": [
        {
          "id": "ghi789",
          "summary": "Dinner with Masha",
          "date": "2025-03-20",
          "hours": 2.5,
          "location_raw": "Carbone, NYC"
        }
      ]
    }
  ],

  "merge_suggestions": [
    {
      "inferred_name": "Masha",
      "suggested_email": "masha.k@gmail.com",
      "confidence": "high",
      "reason": "'Masha' matches email prefix"
    }
  ]
}
```

---

## Files to Modify/Add

| File | Change |
|------|--------|
| `models.py` | Add `FriendEvent` ✅, `CandidateSocialEvent`, `InferredFriend`, `MergeSuggestion` |
| `stats.py` | Update `compute_friend_stats()` ✅, add `collect_candidate_social_events()` |
| `llm_enrich.py` | **NEW**: LLM-based friend name extraction |
| `dedup.py` | **NEW**: Name normalization, aggregation, merge suggestions |
| `cli.py` | Update output serialization with all new fields |
| `.env.example` | Add `ANTHROPIC_API_KEY` |

---

## Resolved Questions

1. **Sort order for events within a friend?**
   - ✅ **Chronological** (oldest first) - events come from API sorted by startTime

2. **Include events where friend declined?**
   - ✅ **Excluded** - correct behavior, already implemented

3. **What if summary is None?**
   - ✅ **Output as null** - UI layer can display as "(No title)" if needed
