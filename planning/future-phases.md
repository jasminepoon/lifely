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

- [ ] **Enable Places API (New)**
  - Go to Google Cloud Console → APIs & Services → Library
  - Search "Places API (New)" and enable it
  - Note: This is the newer version with better pricing and fields

- [ ] **Enable Geocoding API** (optional, for lat/lng → address)
  - Same process as above

- [ ] **Create Google API Key**
  - APIs & Services → Credentials → Create Credentials → API Key
  - Restrict to Places API and Geocoding API
  - Store as `GOOGLE_MAPS_API_KEY` environment variable

- [ ] **Set up billing alerts**
  - Places API is pay-per-use (~$17/1000 Place Details calls)
  - Set budget alerts to avoid surprises

- [ ] **Configure LLM API Key**
  - Get API key from [OpenAI Platform](https://platform.openai.com/)
  - Store as `OPENAI_API_KEY` environment variable
  - Used for: classifying events, extracting friend names, categorizing activities

### New Modules

```
src/lifely/
├── locations.py          # URL parsing, place resolution
├── places_client.py      # Google Places API wrapper with caching
├── llm_enrich.py         # LLM-based friend name extraction
└── dedup.py              # Name normalization and merge suggestions
```

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

#### Step 2.1: Google Maps URL Parser

Events often contain Maps URLs in `location` or `description`:

```
https://maps.google.com/?cid=12345678901234567890
https://goo.gl/maps/abc123
https://www.google.com/maps/place/Restaurant+Name/@40.123,-73.456,17z
https://maps.app.goo.gl/xyz789
```

**Parser should extract**:
- `place_id` (if present in URL params)
- `cid` (customer ID, can be converted to place_id)
- Lat/lng coordinates
- Place name from URL path

**Fallback**: If URL is opaque (short link), we may need to:
1. Follow redirects to get the full URL
2. Or use the URL as a text query to Places Text Search

#### Step 2.2: Places API Client

```python
class PlacesClient:
    def __init__(self, api_key: str, cache_path: Path):
        self.api_key = api_key
        self.cache = self._load_cache(cache_path)

    def get_place_details(self, place_id: str) -> PlaceDetails | None:
        """Fetch place details, using cache when available."""

    def text_search(self, query: str, location_bias: tuple[float, float] | None = None) -> PlaceDetails | None:
        """Search for a place by text query."""

    def resolve_location(self, location_string: str) -> PlaceDetails | None:
        """
        Main entry point: try to resolve any location string to place details.
        1. Check if it's a Maps URL → parse and fetch
        2. Else use text search
        """
```

**Caching strategy**:
- Cache by `place_id` (stable identifier)
- Also cache by normalized location string → place_id mapping
- Persist cache to `data/places_cache.json`
- This dramatically reduces API calls on re-runs

#### Step 2.3: Place Details Model

```python
@dataclass
class PlaceDetails:
    place_id: str
    name: str
    formatted_address: str

    # Structured address
    neighborhood: str | None
    city: str | None
    state: str | None
    country: str | None
    postal_code: str | None

    # Coordinates
    lat: float | None
    lng: float | None

    # Classification
    types: list[str]              # e.g., ['restaurant', 'food', 'point_of_interest']
    primary_type: str | None      # e.g., 'thai_restaurant'

    # Optional enrichments
    price_level: int | None       # 0-4
    rating: float | None
    user_ratings_total: int | None
```

#### Step 2.4: Enrich Friend Stats

After resolving locations, populate the FriendEvent fields:

```python
def enrich_friend_stats(
    stats: list[FriendStats],
    places_client: PlacesClient,
) -> list[FriendStats]:
    """
    Enrich FriendEvent.location_raw with resolved place details.
    """
    for friend in stats:
        for event in friend.events:
            if event.location_raw and _is_valid_location(event.location_raw):
                place = places_client.resolve_location(event.location_raw)
                if place:
                    event.venue_name = place.name
                    event.neighborhood = place.neighborhood
                    event.cuisine = detect_cuisine(place)
    return stats
```

#### Step 2.5: Neighborhood Mapping

**Decision**: Use Google's `neighborhood` or `sublocality` data for all cities.

```python
def extract_neighborhood(place: PlaceDetails) -> str | None:
    """
    Extract neighborhood from Google's address components.

    Priority:
    1. neighborhood component
    2. sublocality component
    3. None if neither available
    """
    # Google's addressComponents includes neighborhood for many places
    # Works reasonably well across all cities
```

**Future enhancement** (if needed): Add ZIP → neighborhood lookup table for NYC.

#### Step 2.6: Cuisine Detection

For restaurant-type places, extract cuisine:

1. **Primary source**: `primaryType` from Places API
   - Values like: `thai_restaurant`, `italian_restaurant`, `japanese_restaurant`
   - Parse the prefix: `thai_restaurant` → "Thai"

2. **Fallback**: Check `types` array for cuisine indicators

3. **Last resort**: Keyword match on place name
   - "Ugly Baby" doesn't tell us much, but "Thai Villa" does

```python
CUISINE_PATTERNS = {
    'thai': ['thai'],
    'japanese': ['japanese', 'sushi', 'ramen', 'izakaya'],
    'italian': ['italian', 'pizza', 'pasta', 'trattoria'],
    'mexican': ['mexican', 'taco', 'taqueria'],
    'chinese': ['chinese', 'dim sum', 'szechuan', 'cantonese'],
    # ... etc
}

def detect_cuisine(place: PlaceDetails) -> str | None:
    # 1. Check primaryType
    # 2. Check types array
    # 3. Keyword match on name
```

#### Step 2.7: Collect Candidate Social Events

Identify solo events (no attendees) that might mention friends:

```python
NON_SOCIAL_KEYWORDS = {"flight", "dentist", "doctor", "gym", "haircut",
                        "reminder", "deadline", "standup", "sync"}

def collect_candidate_social_events(
    events: list[NormalizedEvent]
) -> list[CandidateSocialEvent]:
    """Find solo events that might mention friends."""
    candidates = []
    for event in events:
        # Skip if has attendees (already in friend_stats)
        if any(not a.is_self for a in event.attendees):
            continue
        if not event.summary:
            continue
        # Skip obvious non-social events
        if any(kw in event.summary.lower() for kw in NON_SOCIAL_KEYWORDS):
            continue
        candidates.append(CandidateSocialEvent(...))
    return candidates
```

#### Step 2.8: LLM Event Classification (Mandatory)

Use OpenAI to classify events AND extract relevant data in one call:

```python
# In llm_enrich.py
def classify_events_with_llm(
    events: list[SoloEvent],
    client: OpenAI,
) -> list[ClassifiedEvent]:
    """Classify solo events as social, activity, or other."""

    # Batch events (50 per request for efficiency)
    prompt = f"""Classify each calendar event into one of three categories:

1. SOCIAL - spending time with specific people
   → Extract: names (list of person names mentioned)

2. ACTIVITY - personal activity (fitness, wellness, health, etc.)
   → Extract: category (fitness/wellness/health/personal_care/learning/entertainment)
   → Extract: activity_type (yoga, gym, haircut, therapy, etc.)

3. OTHER - not classifiable (reminders, tasks, work, etc.)
   → Skip

Events:
{chr(10).join(f'- "{e.summary}"' for e in batch)}

Return JSON array:
[
  {{"summary": "Yoga @ Vital", "type": "ACTIVITY", "category": "fitness", "activity_type": "yoga"}},
  {{"summary": "Dinner with Masha", "type": "SOCIAL", "names": ["Masha"]}},
  {{"summary": "Pay rent", "type": "OTHER"}}
]"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": prompt}]
    )
    # Parse response and return classified events
```

**Activity Categories:**
| Category | Examples |
|----------|----------|
| `fitness` | gym, yoga, climbing, running, pilates, crossfit |
| `wellness` | spa, massage, meditation, acupuncture |
| `health` | doctor, dentist, therapy, optometrist |
| `personal_care` | haircut, nails, facial, esthetician |
| `learning` | class, workshop, lesson, course |
| `entertainment` | movie, concert, show, museum (solo) |

#### Step 2.9: Name Deduplication & Aggregation

Normalize and aggregate inferred friends:

```python
# In dedup.py
def normalize_name(name: str) -> str:
    """Normalize name for deduplication."""
    return name.strip().lower()

def aggregate_inferred_friends(
    events_with_names: list[tuple[CandidateSocialEvent, list[str]]]
) -> list[InferredFriend]:
    """Aggregate LLM-extracted names into deduplicated friends."""
    by_name: dict[str, dict] = defaultdict(
        lambda: {"display_name": None, "events": [], "total_hours": 0.0}
    )

    for event, names in events_with_names:
        for name in names:
            key = normalize_name(name)
            by_name[key]["total_hours"] += event.hours
            by_name[key]["events"].append(event)
            if by_name[key]["display_name"] is None:
                by_name[key]["display_name"] = name

    return [InferredFriend(...) for key, data in by_name.items()]
```

#### Step 2.10: Merge Suggestions (Inferred ↔ Email Friends)

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

#### Step 2.11: Activity Aggregation

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

#### Step 2.12: Updated Pipeline Flow

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│ Fetch Events │ ──▶ │ Normalize   │ ──▶ │ Email-based  │
│              │     │             │     │ friend_stats │
└──────────────┘     └─────────────┘     └──────────────┘
                            │
                            ▼
                     ┌─────────────┐     ┌──────────────────────┐
                     │ Collect     │ ──▶ │ LLM Classify         │
                     │ Solo Events │     │ (SOCIAL/ACTIVITY/    │
                     └─────────────┘     │  OTHER)              │
                                         └──────────┬───────────┘
                                                    │
                              ┌─────────────────────┼─────────────────────┐
                              │                     │                     │
                              ▼                     ▼                     ▼
                     ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
                     │ SOCIAL       │      │ ACTIVITY     │      │ OTHER        │
                     │ → Extract    │      │ → Categorize │      │ → Skip       │
                     │   names      │      │   type       │      │              │
                     └──────┬───────┘      └──────┬───────┘      └──────────────┘
                            │                     │
                            ▼                     ▼
                     ┌──────────────┐      ┌──────────────┐
                     │ Deduplicate  │      │ Aggregate    │
                     │ & Aggregate  │      │ by Category  │
                     └──────┬───────┘      └──────┬───────┘
                            │                     │
                            ▼                     ▼
                     ┌──────────────┐      ┌──────────────┐
                     │ Inferred     │      │ Activity     │
                     │ Friends      │      │ Stats        │
                     └──────┬───────┘      └──────┬───────┘
                            │                     │
                            ▼                     │
                     ┌──────────────┐             │
                     │ Merge        │             │
                     │ Suggestions  │             │
                     └──────┬───────┘             │
                            │                     │
                            └──────────┬──────────┘
                                       │
                                       ▼
                     ┌─────────────────────────────────┐
                     │ Final Output:                   │
                     │ - friend_stats (email-based)    │
                     │ - inferred_friends (LLM-based)  │
                     │ - merge_suggestions             │
                     │ - activity_stats (by category)  │
                     │ - location enrichments          │
                     └─────────────────────────────────┘
```

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
