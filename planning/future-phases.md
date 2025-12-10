# Future Phases: Location, Stats, and UI

> This document outlines Phase 2+ after the core calendar pipeline is working.

---

## Phase 2: Location Intelligence

### Goal

Enrich events with place data from Google Maps/Places API to answer:
- "Where do I spend my time?"
- "What's my most-visited restaurant?"
- "Which NYC neighborhoods do I frequent?"
- "What cuisines do I eat most?"

### Pre-requisites Checklist

#### OpenAI API Setup (Required)

- [ ] **Create OpenAI Account**
  - Go to [platform.openai.com](https://platform.openai.com/)
  - Sign up or log in

- [ ] **Add Payment Method**
  - Navigate to Settings → Billing
  - Add credit card (pay-as-you-go)
  - Estimated cost: ~$0.05 per run

- [ ] **Create API Key**
  - Go to API Keys section
  - Click "Create new secret key"
  - Name it "Lifely" or similar
  - Copy the key immediately (shown only once)

- [ ] **Configure Environment Variable**
  ```bash
  # Add to your shell profile (~/.zshrc or ~/.bashrc)
  export OPENAI_API_KEY="sk-..."

  # Or create .env file in project root
  echo "OPENAI_API_KEY=sk-..." >> .env
  ```

- [ ] **Verify Setup**
  ```bash
  curl https://api.openai.com/v1/models \
    -H "Authorization: Bearer $OPENAI_API_KEY" | head -20
  ```

#### Google Places API Setup (Optional - for opaque URLs only)

> **Note**: Places API is only needed for resolving opaque Maps URLs like `goo.gl/maps/...`.
> If all your calendar locations have readable addresses, you can skip this.

- [ ] **Enable Places API (New)**
  - Go to [Google Cloud Console](https://console.cloud.google.com/)
  - Select your Lifely project (created in Phase 1)
  - APIs & Services → Library → Search "Places API (New)"
  - Click "Enable"

- [ ] **Create API Key** (if you don't have one)
  - APIs & Services → Credentials → Create Credentials → API Key
  - Click "Edit API key" to restrict it:
    - Application restrictions: None (or IP if you have static IP)
    - API restrictions: Restrict to "Places API (New)"
  - Copy the key

- [ ] **Configure Environment Variable**
  ```bash
  export GOOGLE_MAPS_API_KEY="AIza..."
  ```

- [ ] **Set Budget Alert** (recommended)
  - Go to Billing → Budgets & alerts
  - Create budget: $5/month (generous for ~300 API calls)
  - Places API cost: ~$0.017 per call
  - Expected usage: ~30 calls per run (opaque URLs only)

### New Modules

```
src/lifely/
├── llm_enrich.py         # LLM enrichment (classification + location extraction)
└── places_client.py      # Google Places API (only for opaque URLs)
```

> **Simplified**: Location extraction is handled by the LLM in most cases.
> Places API is only called for opaque URLs that the LLM can't parse.

### Implementation Steps

#### Step 2.0: FriendEvent Enhancement ✅ DONE

Event summaries and locations are now included in FriendStats. See `planning/phase2-event-summaries.md`.

```python
@dataclass
class FriendEvent:
    id: str
    summary: str | None
    date: str
    hours: float
    location_raw: str | None = None
    # To be populated by location enrichment:
    venue_name: str | None = None
    neighborhood: str | None = None
    cuisine: str | None = None
```

#### Step 2.1: LLM Enrichment Module (Core)

The LLM handles BOTH event classification AND location extraction in a single batch call:

```python
# llm_enrich.py

def enrich_all_events(
    events: list[NormalizedEvent],
    friend_stats: list[FriendStats],
    client: OpenAI,
) -> EnrichmentResult:
    """
    Single LLM call to:
    1. Extract location details from ALL events with location_raw
    2. Classify solo events (SOCIAL/ACTIVITY/OTHER)
    3. Flag opaque URLs that need Places API resolution
    """
    # Prepare batch (dedupe by summary+location for efficiency)
    batch = _prepare_enrichment_batch(events, friend_stats)

    # Call OpenAI
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[{
            "role": "user",
            "content": ENRICHMENT_PROMPT.format(events=json.dumps(batch))
        }]
    )

    return _parse_enrichment_response(response)
```

**What the LLM extracts:**

| Data | Source | Example |
|------|--------|---------|
| `venue_name` | location_raw or summary | "Thai Villa" |
| `neighborhood` | address in location_raw | "Williamsburg" |
| `city` | address in location_raw | "Brooklyn" |
| `cuisine` | inferred from venue name | "Thai" |
| `is_opaque_url` | URL pattern detection | `true` for goo.gl links |
| `type` | summary analysis (solo events) | "SOCIAL" / "ACTIVITY" / "OTHER" |
| `names` | summary extraction (SOCIAL) | ["Masha", "John"] |
| `category` | summary analysis (ACTIVITY) | "fitness" |
| `activity_type` | summary analysis (ACTIVITY) | "yoga" |

**Location scenarios the LLM handles:**

```python
# Scenario A: Structured address (LLM extracts all fields)
location_raw = "Thai Villa, 123 Main St, Williamsburg, Brooklyn, NY"
→ venue_name: "Thai Villa", neighborhood: "Williamsburg", cuisine: "Thai"

# Scenario B: Venue in summary (LLM infers from context)
summary = "Yoga @ Vital", location_raw = ""
→ venue_name: "Vital Climbing", category: "fitness", activity_type: "yoga"

# Scenario C: Full Maps URL (LLM parses venue from URL)
location_raw = "https://www.google.com/maps/place/Thai+Villa/@40.71,-73.95"
→ venue_name: "Thai Villa", is_opaque_url: false

# Scenario D: Opaque URL (LLM flags for Places API)
location_raw = "https://maps.app.goo.gl/xyz789"
→ is_opaque_url: true (needs Places API resolution)
```

#### Step 2.2: Places API Client (Opaque URLs Only)

Only called when LLM flags `is_opaque_url: true`:

```python
# places_client.py

OPAQUE_URL_PATTERNS = [
    r'https?://goo\.gl/maps/',
    r'https?://maps\.app\.goo\.gl/',
]

class PlacesClient:
    def __init__(self, api_key: str | None, cache_path: Path):
        self.api_key = api_key
        self.cache = self._load_cache(cache_path) if cache_path.exists() else {}

    def resolve_opaque_url(self, url: str) -> dict | None:
        """
        Resolve an opaque Maps URL to location details.

        1. Follow redirects to get full URL
        2. Extract place name or coordinates from expanded URL
        3. If needed, call Places API Text Search
        """
        if url in self.cache:
            return self.cache[url]

        # Follow redirects
        full_url = self._follow_redirect(url)

        # Try to extract venue from expanded URL
        venue = self._extract_venue_from_url(full_url)
        if venue:
            result = {"venue_name": venue, "source": "url_parse"}
            self.cache[url] = result
            return result

        # Fallback: Places API Text Search
        if self.api_key:
            result = self._text_search(full_url)
            if result:
                self.cache[url] = result
                return result

        return None

    def _follow_redirect(self, url: str) -> str:
        """Follow redirects to get the full Maps URL."""
        import httpx
        response = httpx.head(url, follow_redirects=True, timeout=10)
        return str(response.url)
```

**Cost optimization**: Most opaque URLs expand to full URLs with venue names visible.
Places API is only called as a last resort (~10% of opaque URLs).

#### Step 2.3: Apply Enrichments

```python
def apply_enrichments(
    friend_stats: list[FriendStats],
    events: list[NormalizedEvent],
    enrichment_result: EnrichmentResult,
) -> tuple[list[FriendStats], list[InferredFriend], list[ActivityEvent]]:
    """
    Apply LLM enrichments back to data structures.
    """
    # Update FriendStats events with location data
    for friend in friend_stats:
        for event in friend.events:
            if event.id in enrichment_result.locations:
                loc = enrichment_result.locations[event.id]
                event.venue_name = loc.venue_name
                event.neighborhood = loc.neighborhood
                event.cuisine = loc.cuisine

    # Build InferredFriends from SOCIAL classifications
    inferred = _build_inferred_friends(enrichment_result.social_events)

    # Build ActivityEvents from ACTIVITY classifications
    activities = _build_activity_events(enrichment_result.activity_events)

    return friend_stats, inferred, activities
```

#### Step 2.4: Collect Solo Events

Solo events (no attendees) are sent to the LLM for classification:

```python
def collect_solo_events(events: list[NormalizedEvent]) -> list[SoloEvent]:
    """Collect events without attendees for LLM classification."""
    return [
        SoloEvent(
            id=e.id,
            summary=e.summary or "",
            date=e.start.strftime("%Y-%m-%d"),
            hours=round(e.duration_minutes / 60, 1),
            location_raw=e.location_raw,
        )
        for e in events
        if not any(not a.is_self for a in e.attendees)
        and e.summary  # Skip empty summaries
    ]
```

> **Note**: We no longer pre-filter with keywords. The LLM handles classification
> of ALL solo events into SOCIAL/ACTIVITY/OTHER categories.

#### Step 2.5: LLM Prompt Template

The combined enrichment prompt (used in Step 2.1):

```python
ENRICHMENT_PROMPT = """Analyze these calendar events and extract structured data.

For EACH event, extract:

1. LOCATION (if location field is present):
   - venue_name: Business/place name
   - neighborhood: District/area (e.g., "Williamsburg", "Midtown", "SoHo")
   - city: City name
   - cuisine: Food type if restaurant (e.g., "Thai", "Italian", "Japanese")
   - is_opaque_url: true ONLY if location is a short URL like goo.gl or maps.app.goo.gl

2. CLASSIFICATION (only for events where has_attendees is false):
   - type: "SOCIAL" (meeting people), "ACTIVITY" (personal activity), "OTHER" (skip)
   - For SOCIAL: names (list of person names)
   - For ACTIVITY: category and activity_type

Activity Categories:
- fitness: gym, yoga, climbing, running, pilates, cycling
- wellness: spa, massage, meditation, acupuncture
- health: doctor, dentist, therapy, physical therapy
- personal_care: haircut, nails, facial, waxing
- learning: class, workshop, lesson, course
- entertainment: movie, concert, show, museum

Events:
{events}

Return JSON: {{"results": [...]}}
"""
```

#### Step 2.6: Name Deduplication & Aggregation

Normalize and aggregate inferred friends (handled in `llm_enrich.py`):

```python
def aggregate_inferred_friends(
    social_events: list[ClassifiedEvent]
) -> list[InferredFriend]:
    """Aggregate LLM-extracted names into deduplicated friends."""
    by_name: dict[str, dict] = defaultdict(
        lambda: {"display_name": None, "events": [], "total_hours": 0.0}
    )

    for event in social_events:
        if not event.names:
            continue
        for name in event.names:
            key = name.strip().lower()
            by_name[key]["total_hours"] += event.hours
            by_name[key]["events"].append(event)
            if by_name[key]["display_name"] is None:
                by_name[key]["display_name"] = name

    return [
        InferredFriend(
            name=data["display_name"],
            normalized_name=key,
            event_count=len(data["events"]),
            total_hours=round(data["total_hours"], 1),
            events=[...],  # Convert to FriendEvent
        )
        for key, data in by_name.items()
    ]
```

#### Step 2.7: Merge Suggestions (Inferred ↔ Email Friends)

Suggest links between inferred names and email-based friends:

```python
def suggest_merges(
    inferred: list[InferredFriend],
    email_friends: list[FriendStats],
) -> list[MergeSuggestion]:
    """Suggest links between inferred names and email friends."""
    suggestions = []

    for inf in inferred:
        for ef in email_friends:
            email_prefix = ef.email.split("@")[0].lower()
            if inf.normalized_name in email_prefix:
                suggestions.append(MergeSuggestion(
                    inferred_name=inf.name,
                    suggested_email=ef.email,
                    confidence="high",
                    reason=f"'{inf.name}' matches email prefix",
                ))

    return suggestions
```

#### Step 2.8: Activity Aggregation

Aggregate activity events by category:

```python
def aggregate_activity_stats(
    activity_events: list[ActivityEvent]
) -> dict[str, ActivityCategoryStats]:
    """Aggregate activities by category."""
    by_category: dict[str, dict] = defaultdict(
        lambda: {"events": [], "total_hours": 0.0, "venues": Counter(), "types": Counter()}
    )

    for event in activity_events:
        cat = event.category
        by_category[cat]["events"].append(event)
        by_category[cat]["total_hours"] += event.hours
        if event.venue_name:
            by_category[cat]["venues"][event.venue_name] += 1
        if event.activity_type:
            by_category[cat]["types"][event.activity_type] += 1

    return {
        cat: ActivityCategoryStats(
            category=cat,
            event_count=len(data["events"]),
            total_hours=round(data["total_hours"], 1),
            top_venues=data["venues"].most_common(5),
            top_activities=data["types"].most_common(5),
        )
        for cat, data in by_category.items()
    }
```

#### Step 2.9: Updated Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PHASE 2 PIPELINE (Hybrid LLM-First)                     │
└─────────────────────────────────────────────────────────────────────────────┘

STEPS 1-4: Same as Phase 1
─────────────────────────
┌──────────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│ Fetch Events │ ──▶ │ Normalize   │ ──▶ │ Email-based  │ ──▶ │ Time Stats   │
│              │     │             │     │ friend_stats │     │              │
└──────────────┘     └─────────────┘     └──────────────┘     └──────────────┘


STEP 5: LLM ENRICHMENT (Single Batch Call)
──────────────────────────────────────────
┌──────────────────────────────────────────────────────────────────────────────┐
│  Input: ALL events (with has_attendees flag)                                 │
│                                                                              │
│  ┌──────────────┐                                                            │
│  │   OpenAI     │     Extracts:                                              │
│  │  GPT-4o-mini │───▶ • Location: venue_name, neighborhood, city, cuisine   │
│  │              │     • Classification: type, names, category, activity_type │
│  │  (~$0.05)    │     • Flags: is_opaque_url (for Places API)               │
│  └──────────────┘                                                            │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
STEP 6: RESOLVE OPAQUE URLs (Conditional)
─────────────────────────────────────────
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Events where │     │  Follow      │     │ Places API   │
│ is_opaque_url│────▶│  redirects   │────▶│ (if needed)  │
│ = true       │     │  (httpx)     │     │ (~$0.50)     │
└──────────────┘     └──────────────┘     └──────────────┘
       │
       │ ~5-10% of events with locations
       ▼

STEP 7: APPLY ENRICHMENTS & AGGREGATE
─────────────────────────────────────
                              ┌─────────────────────┐
                              │ Enrichment Results  │
                              └──────────┬──────────┘
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              │                          │                          │
              ▼                          ▼                          ▼
     ┌──────────────┐           ┌──────────────┐           ┌──────────────┐
     │ Update       │           │ SOCIAL →     │           │ ACTIVITY →   │
     │ FriendStats  │           │ Inferred     │           │ Activity     │
     │ locations    │           │ Friends      │           │ Stats        │
     └──────────────┘           └──────┬───────┘           └──────────────┘
                                       │
                                       ▼
                               ┌──────────────┐
                               │ Merge        │
                               │ Suggestions  │
                               └──────────────┘


STEP 8: OUTPUT
──────────────
┌─────────────────────────────────────────────────────────────────────────────┐
│  stats_2025.json                                                            │
│  ├── time_stats                                                             │
│  ├── friend_stats (email-based, with enriched locations)                    │
│  ├── inferred_friends (LLM-extracted from solo events)                      │
│  ├── activity_stats (fitness, wellness, health, etc.)                       │
│  ├── merge_suggestions (inferred ↔ email friends)                           │
│  └── location_stats (if Places API used)                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Cost Summary:**
| Component | Cost | When |
|-----------|------|------|
| OpenAI LLM | ~$0.05 | Every run |
| Places API | ~$0.50 | Only for opaque URLs, cached |
| **Total first run** | ~$0.55 | |
| **Subsequent runs** | ~$0.05 | Places cached |

### Updated Stats (Phase 2)

Add to `models.py`:

```python
# ═══════════════════════════════════════════════════════════
# SOLO EVENT CLASSIFICATION
# ═══════════════════════════════════════════════════════════

@dataclass
class SoloEvent:
    """A solo event (no attendees) to be classified by LLM."""
    id: str
    summary: str
    date: str
    hours: float
    location_raw: str | None

@dataclass
class ClassifiedEvent:
    """Result of LLM classification."""
    id: str
    summary: str
    date: str
    hours: float
    location_raw: str | None
    event_type: str              # "SOCIAL", "ACTIVITY", "OTHER"
    # For SOCIAL:
    names: list[str] | None = None
    # For ACTIVITY:
    category: str | None = None  # "fitness", "wellness", etc.
    activity_type: str | None = None  # "yoga", "gym", etc.

# ═══════════════════════════════════════════════════════════
# INFERRED FRIENDS (from SOCIAL events)
# ═══════════════════════════════════════════════════════════

@dataclass
class InferredFriend:
    """Friend inferred from event summaries via LLM (no email)."""
    name: str                    # Display: "Masha"
    normalized_name: str         # Dedup key: "masha"
    event_count: int
    total_hours: float
    events: list[FriendEvent]
    linked_email: str | None = None  # Set if merged with email friend

@dataclass
class MergeSuggestion:
    """Suggestion to link inferred friend to email-based friend."""
    inferred_name: str
    suggested_email: str
    confidence: str              # "high", "medium", "low"
    reason: str

# ═══════════════════════════════════════════════════════════
# ACTIVITY STATS (from ACTIVITY events)
# ═══════════════════════════════════════════════════════════

@dataclass
class ActivityEvent:
    """A personal activity event."""
    id: str
    summary: str
    date: str
    hours: float
    location_raw: str | None
    category: str                # "fitness", "wellness", etc.
    activity_type: str           # "yoga", "gym", "haircut", etc.
    # Enriched by Places API:
    venue_name: str | None = None
    neighborhood: str | None = None

@dataclass
class ActivityCategoryStats:
    """Aggregated stats for an activity category."""
    category: str
    event_count: int
    total_hours: float
    top_venues: list[tuple[str, int]]     # [("Vital Climbing", 15), ...]
    top_activities: list[tuple[str, int]] # [("yoga", 20), ("climbing", 10)]

# ═══════════════════════════════════════════════════════════
# LOCATION STATS
# ═══════════════════════════════════════════════════════════

@dataclass
class VenueStats:
    place_id: str
    name: str
    neighborhood: str | None
    city: str
    cuisine: str | None
    visit_count: int
    total_hours: float

@dataclass
class NeighborhoodStats:
    name: str
    city: str
    event_count: int
    total_hours: float
    top_venues: list[str]
    dominant_cuisines: list[str]
```

Add to `stats.py`:

```python
def compute_location_stats(events: list[NormalizedEvent]) -> LocationStats:
    """
    Aggregate by:
    - Venue (place_id)
    - Neighborhood
    - City
    - Cuisine
    """
```

### LLM Test Cases

Before implementing, validate the LLM classification with these test cases:

#### Test Input Batch
```python
TEST_EVENTS = [
    # ═══ SOCIAL (should extract names) ═══
    "Dinner with Masha",
    "Coffee w/ John",
    "Masha's birthday party",
    "Drinks with Mike and Sarah",
    "1:1 Bob",
    "Catching up with mom",
    "Double date - us + Jack & Emily",
    "Girls night",
    "Brunch @ Cafe Mogador with Angela",

    # ═══ ACTIVITY (should categorize) ═══
    "Yoga @ Vital",
    "Gym",
    "Climbing at Brooklyn Boulders",
    "Haircut",
    "Therapy",
    "Dentist appointment",
    "Massage @ Aire",
    "Pilates class",
    "Piano lesson",
    "Movie - Dune 2",
    "Facial at Silver Mirror",
    "Meditation",
    "Run in Prospect Park",
    "Acupuncture",

    # ═══ OTHER (should skip) ═══
    "Pay rent",
    "Cancel Instacart",
    "Flight to LA",
    "Pick up dry cleaning",
    "Call mom",
    "Submit expense report",
    "Team standup",
    "Project deadline",
    "Reminder: renew passport",
    "Block: focus time",
]
```

#### Expected Output
```json
[
  {"summary": "Dinner with Masha", "type": "SOCIAL", "names": ["Masha"]},
  {"summary": "Coffee w/ John", "type": "SOCIAL", "names": ["John"]},
  {"summary": "Masha's birthday party", "type": "SOCIAL", "names": ["Masha"]},
  {"summary": "Drinks with Mike and Sarah", "type": "SOCIAL", "names": ["Mike", "Sarah"]},
  {"summary": "1:1 Bob", "type": "SOCIAL", "names": ["Bob"]},
  {"summary": "Catching up with mom", "type": "SOCIAL", "names": ["Mom"]},
  {"summary": "Double date - us + Jack & Emily", "type": "SOCIAL", "names": ["Jack", "Emily"]},
  {"summary": "Girls night", "type": "SOCIAL", "names": null},
  {"summary": "Brunch @ Cafe Mogador with Angela", "type": "SOCIAL", "names": ["Angela"]},

  {"summary": "Yoga @ Vital", "type": "ACTIVITY", "category": "fitness", "activity_type": "yoga"},
  {"summary": "Gym", "type": "ACTIVITY", "category": "fitness", "activity_type": "gym"},
  {"summary": "Climbing at Brooklyn Boulders", "type": "ACTIVITY", "category": "fitness", "activity_type": "climbing"},
  {"summary": "Haircut", "type": "ACTIVITY", "category": "personal_care", "activity_type": "haircut"},
  {"summary": "Therapy", "type": "ACTIVITY", "category": "health", "activity_type": "therapy"},
  {"summary": "Dentist appointment", "type": "ACTIVITY", "category": "health", "activity_type": "dentist"},
  {"summary": "Massage @ Aire", "type": "ACTIVITY", "category": "wellness", "activity_type": "massage"},
  {"summary": "Pilates class", "type": "ACTIVITY", "category": "fitness", "activity_type": "pilates"},
  {"summary": "Piano lesson", "type": "ACTIVITY", "category": "learning", "activity_type": "piano lesson"},
  {"summary": "Movie - Dune 2", "type": "ACTIVITY", "category": "entertainment", "activity_type": "movie"},
  {"summary": "Facial at Silver Mirror", "type": "ACTIVITY", "category": "personal_care", "activity_type": "facial"},
  {"summary": "Meditation", "type": "ACTIVITY", "category": "wellness", "activity_type": "meditation"},
  {"summary": "Run in Prospect Park", "type": "ACTIVITY", "category": "fitness", "activity_type": "running"},
  {"summary": "Acupuncture", "type": "ACTIVITY", "category": "wellness", "activity_type": "acupuncture"},

  {"summary": "Pay rent", "type": "OTHER"},
  {"summary": "Cancel Instacart", "type": "OTHER"},
  {"summary": "Flight to LA", "type": "OTHER"},
  {"summary": "Pick up dry cleaning", "type": "OTHER"},
  {"summary": "Call mom", "type": "OTHER"},
  {"summary": "Submit expense report", "type": "OTHER"},
  {"summary": "Team standup", "type": "OTHER"},
  {"summary": "Project deadline", "type": "OTHER"},
  {"summary": "Reminder: renew passport", "type": "OTHER"},
  {"summary": "Block: focus time", "type": "OTHER"}
]
```

#### Edge Cases to Watch
| Input | Expected | Notes |
|-------|----------|-------|
| "Girls night" | SOCIAL, names: null | Generic group, no specific names |
| "Call mom" | OTHER | Phone call, not in-person time |
| "Flight to LA" | OTHER | Travel logistics, not an activity |
| "Team standup" | OTHER | Work meeting, not personal |
| "Coffee" (alone) | ACTIVITY or OTHER? | Ambiguous - could be solo coffee break |
| "Lunch" (alone) | OTHER | Probably just blocking time |
| "Movie - Dune 2" | ACTIVITY (solo) or SOCIAL? | Depends on context, default to ACTIVITY |

#### Validation Checklist
- [ ] Run test batch through OpenAI API
- [ ] Compare output to expected
- [ ] Document any misclassifications
- [ ] Adjust prompt if needed
- [ ] Re-test until accuracy > 90%

---

### Resolved Questions for Phase 2

1. **Budget**: ~$20 (≈1200 places)
   - Comprehensive coverage of most venues
   - Caching makes re-runs free

2. **Short URLs**: ✅ Yes, follow redirects for `goo.gl` links
   - Better resolution rate, worth the extra HTTP requests

3. **Location confidence threshold**: Skip obviously invalid strings
   - Empty strings, single words like "TBD", etc.

4. **Non-NYC handling**: ✅ Try neighborhoods everywhere
   - Use Google's neighborhood/sublocality data for all cities

---

## Phase 3: Full Stats & LLM Prompt

### Goal

Produce the complete JSON summary and generate an LLM prompt for narrative generation.

### Implementation

#### Step 3.1: Complete Aggregations

Extend stats to include everything from the original spec:

```python
@dataclass
class YearSummary:
    year: int

    # Global
    global_stats: GlobalStats

    # Time
    time_stats: TimeStats  # enhanced with streaks, time buckets

    # People
    people_stats: PeopleStats  # top friends by hours AND events

    # Places
    place_stats: PlaceStats  # venues, neighborhoods, cities, cuisines

    # Context
    context_stats: ContextStats  # dinner, drinks, coffee, work, travel

    # Notable
    notable: NotableEvents  # longest event, busiest day, etc.
```

#### Step 3.2: Context Classification

Classify events into categories:

```python
CONTEXT_TAGS = [
    'dinner',
    'drinks',
    'coffee',
    'breakfast',
    'lunch',
    'work_meeting',
    'workshop',
    'gym',
    'travel',
    'entertainment',
    'personal',
]

def classify_event_context(event: NormalizedEvent) -> list[str]:
    """
    Heuristics based on:
    1. Event summary keywords
    2. Place types (if enriched)
    3. Time of day
    4. Duration
    """
```

**Heuristic examples**:
- Summary contains "dinner" OR (place_type=restaurant AND start_hour >= 18) → `dinner`
- Summary contains "flight" OR place_type=airport → `travel`
- Place_type=gym → `gym`
- Summary contains "1:1" or looks like a name → `work_meeting`

#### Step 3.3: JSON Summary Generator

```python
def generate_summary_json(
    events: list[NormalizedEvent],
    year: int,
) -> dict:
    """
    Produce the complete summary JSON matching the schema in concept.md.
    """
```

Output to `data/summary_2025.json`.

#### Step 3.4: LLM Prompt Builder

```python
def build_wrapped_prompt(summary: dict) -> str:
    """
    Generate a prompt for an LLM to create the "2025 Wrapped" narrative.

    Includes:
    - System context
    - The summary JSON
    - Specific instructions for tone and output format
    """
```

Output to `data/prompt_2025.txt` or stdout.

### Open Questions for Phase 3

1. **Which LLM to target?** Claude, GPT-4, local model?
   - Affects prompt formatting and length limits

2. **Should the tool call the LLM directly?** Or just generate the prompt?
   - Simpler to generate prompt and let user paste into their preferred tool

3. **How much event detail in prompt?** Just stats, or include some raw events for color?
   - Risk of PII in raw events; maybe include anonymized samples

---

## Phase 4: Visual UI (Flighty-Inspired)

### Goal

Create a beautiful, shareable "2025 Wrapped" visual experience.

### Flighty Reference

- [ ] **Fetch Flighty.com HTML/CSS for inspiration**
  - URL: https://flighty.com/
  - Analyze their design language, animations, color palette

### Design Direction

Based on Flighty's aesthetic:
- **Dark mode** with vibrant accent colors
- **Card-based layout** for each stat category
- **Smooth animations** on scroll/reveal
- **Data visualizations**: charts, maps, timelines
- **Mobile-first** responsive design
- **Shareable**: Generate images or allow screenshots

### Technical Options

1. **Static HTML/CSS** (simplest)
   - Generate a single HTML file with embedded data
   - Use Tailwind CSS for styling
   - Chart.js or similar for visualizations
   - Open in browser, screenshot to share

2. **React/Next.js** (more interactive)
   - Better animations and interactions
   - Could host on Vercel
   - Overkill for a personal tool?

3. **PDF Generation** (most shareable)
   - Generate a beautiful PDF report
   - Libraries: WeasyPrint, Playwright PDF, etc.
   - Easy to share and archive

**Recommendation**: Start with static HTML/CSS. It's the fastest path to something visual and shareable. Can always upgrade later.

### UI Sections

1. **Hero**: Year number, total events, total hours
2. **Time Story**: Calendar heatmap, busiest days, streaks
3. **Friends**: Top 5-10 with avatars (if available), hours together
4. **Places**: Map with markers, top venues list, neighborhood breakdown
5. **Cuisines**: Pie/bar chart of cuisine types
6. **Patterns**: Interesting stats and anomalies
7. **2026 Suggestions**: AI-generated recommendations

### Open Questions for Phase 4

1. **Avatars**: Pull from Google Contacts? Or skip?
2. **Maps**: Embed Google Maps? Or use static map image?
3. **Hosting**: Local HTML file vs. hosted page?
4. **Privacy**: Any concerns about the generated output?

---

## Phase 5: Polish & Extensions

### Potential Enhancements

- **Multi-calendar support**: Aggregate across work + personal
- **Year-over-year comparison**: 2024 vs 2025
- **Friend network visualization**: Who do you see together?
- **Travel map**: Animated timeline of your trips
- **Integrations**: Pull in photos from Google Photos for events?
- **Scheduled reports**: Run monthly/quarterly, not just annual

### Technical Debt to Address

- [ ] Better error handling throughout
- [ ] Retry logic for API failures
- [ ] Rate limiting for Places API
- [ ] Unit test coverage
- [ ] Type hints and mypy validation
- [ ] Documentation (README, inline docs)

---

## Summary: Phase Roadmap

| Phase | Focus | Outcome |
|-------|-------|---------|
| 1 | Calendar Pipeline | Fetch events, normalize, friend stats in terminal |
| 2 | Location Intelligence | Places API, venue/neighborhood/cuisine stats |
| 3 | Full Stats & Prompt | Complete JSON summary, LLM prompt generator |
| 4 | Visual UI | Flighty-inspired HTML/CSS wrapped experience |
| 5 | Polish | Multi-calendar, comparisons, network viz |

**Current focus**: Phase 2 (Location Intelligence)
