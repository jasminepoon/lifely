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

- [ ] **Create API Key**
  - APIs & Services → Credentials → Create Credentials → API Key
  - Restrict to Places API and Geocoding API
  - Store as `GOOGLE_MAPS_API_KEY` environment variable

- [ ] **Set up billing alerts**
  - Places API is pay-per-use (~$17/1000 Place Details calls)
  - Set budget alerts to avoid surprises

### New Modules

```
src/lifely/
├── locations.py          # URL parsing, place resolution
├── places_client.py      # Google Places API wrapper with caching
└── neighborhoods.py      # NYC neighborhood mapping
```

### Implementation Steps

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

#### Step 2.4: NYC Neighborhood Mapping

Google's `addressComponents` sometimes includes `neighborhood` or `sublocality`, but it's inconsistent for NYC.

**Options**:

1. **Use Google's data as-is** (easiest, less accurate)
   - Accept whatever `neighborhood` or `sublocality` Google returns

2. **Postal code mapping** (medium effort, good accuracy)
   - Maintain a lookup table: ZIP → neighborhood
   - NYC has well-defined ZIP boundaries
   - Example: 10002 → "Lower East Side"

3. **Coordinate-based lookup** (most accurate, more effort)
   - Use NYC neighborhood boundary polygons (available as open data)
   - Point-in-polygon test for each lat/lng
   - Libraries: `shapely`, `geopandas`

**Recommendation**: Start with option 1, add option 2 if results are unsatisfying.

#### Step 2.5: Cuisine Detection

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

### Updated Stats (Phase 2)

Add to `stats.py`:

```python
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

def compute_location_stats(events: list[NormalizedEvent]) -> LocationStats:
    """
    Aggregate by:
    - Venue (place_id)
    - Neighborhood
    - City
    - Cuisine
    """
```

### Open Questions for Phase 2

1. **Budget**: How much are you willing to spend on Places API?
   - 100 unique places ≈ $1.70
   - 1000 unique places ≈ $17
   - Caching makes re-runs free

2. **Short URLs**: Should we follow redirects for `goo.gl` links?
   - Adds complexity but improves resolution rate

3. **Location confidence threshold**: Skip enrichment if location string looks like garbage?

4. **Non-NYC handling**: Just report city, or try neighborhood mapping for other cities too?

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

**Current focus**: Phase 1
