# Future Phases: Location, Stats, and UI

> This document outlines Phase 2+ after the core calendar pipeline is working.

---

## Phase 2: Location Intelligence

> **Status**: ✅ **COMPLETE** (2025-12-10)

### Goal

Enrich events with place data from Google Maps/Places API to answer:
- "Where do I spend my time?"
- "What's my most-visited restaurant?"
- "Which NYC neighborhoods do I frequent?"
- "What cuisines do I eat most?"

### Implementation Summary

**Approach Changed**: Instead of Google Places API, we use **GPT-5.1 LLM** for location extraction. This is simpler, cheaper, and handles most cases well.

| Feature | Status | Notes |
|---------|--------|-------|
| LLM location extraction | ✅ Done | venue_name, neighborhood, city, cuisine |
| Solo event classification | ✅ Done | SOCIAL/ACTIVITY/OTHER |
| InferredFriends from titles | ✅ Done | 50+ friends discovered |
| ActivityCategoryStats | ✅ Done | fitness, health, wellness, etc. |
| Merge suggestions | ✅ Done | Links names to emails |
| Async batch processing | ✅ Done | 2 concurrent, 50/batch |
| Rate limit retry | ✅ Done | Exponential backoff |
| Places API (opaque URLs) | ✅ Partial | Resolve Google Maps links when key present; fallback to LLM otherwise |

### Pre-requisites Checklist

#### OpenAI API Setup (Required) ✅

- [x] **Create OpenAI Account** at [platform.openai.com](https://platform.openai.com/)
- [x] **Add Payment Method** (Settings → Billing)
- [x] **Create API Key** (API Keys → Create new secret key)
- [x] **Configure Environment Variable**: `export OPENAI_API_KEY="sk-..."`

#### Google Places API Setup (Optional - NOT USED)

> We opted to skip Places API. LLM extraction handles ~95% of cases.

### Modules Implemented

```
src/lifely/
├── llm_enrich.py         # ✅ LLM enrichment (GPT-5.1 Responses API)
│   ├── enrich_all_events()           # Location extraction
│   ├── classify_solo_events()        # SOCIAL/ACTIVITY/OTHER
│   ├── suggest_merges()              # Link inferred to email friends
│   └── apply_enrichments_to_friend_stats()
└── places.py             # ✅ Resolve Google Maps links with Places API when key present
```

### Updated Pipeline Flow

```
PHASE 2 PIPELINE (Implemented)
══════════════════════════════

STEPS 1-4: Phase 1 (unchanged)
─────────────────────────────
Fetch → Normalize → Email Friends → Time Stats

STEP 5a: LOCATION ENRICHMENT
────────────────────────────
┌─────────────────────────────────────────────────────────────┐
│  Input: All events with location_raw                        │
│                                                             │
│  OpenAI GPT-5.1 (Responses API)                             │
│  ├── Async parallel batches (2 concurrent, 50/batch)        │
│  ├── Retry with exponential backoff (5s, 10s, 20s...)       │
│  └── Deduplication by location string                       │
│                                                             │
│  Output: venue_name, neighborhood, city, cuisine            │
└─────────────────────────────────────────────────────────────┘

STEP 5b: SOLO EVENT CLASSIFICATION
──────────────────────────────────
┌─────────────────────────────────────────────────────────────┐
│  Input: Events without attendees                            │
│                                                             │
│  Classification:                                            │
│  ├── SOCIAL → extract names ["Masha", "John"]               │
│  ├── ACTIVITY → category, activity_type, venue              │
│  └── OTHER → skip                                           │
│                                                             │
│  Output: InferredFriends, ActivityCategoryStats             │
└─────────────────────────────────────────────────────────────┘

STEP 5c: MERGE SUGGESTIONS
──────────────────────────
Match inferred names to email prefixes
"Masha" ↔ masha.k@gmail.com → confidence: high

STEP 6: OUTPUT
──────────────
stats_2025.json with:
├── time_stats
├── friend_stats (with enriched events)
├── location_stats
├── inferred_friends
└── activity_stats
```

### Cost Summary

| Component | Cost | Notes |
|-----------|------|-------|
| OpenAI LLM (location) | ~$0.05 | Per run |
| OpenAI LLM (classification) | ~$0.05 | Per run |
| **Total per run** | ~$0.10 | |

---

## Phase 3: Full Stats & LLM Prompt

> **Status**: ❌ **NOT STARTED**

### Goal

Produce the complete JSON summary and generate an LLM prompt for narrative generation.

### Implementation Tasks

#### Step 3.1: Complete Aggregations

Add missing stats to match the schema in concept.md:

```python
@dataclass
class GlobalStats:
    total_events: int
    total_hours: float
    median_event_minutes: float          # ❌ Not implemented
    days_with_events: int                 # ❌ Not implemented
    days_without_events: int              # ❌ Not implemented

@dataclass
class TimeStatsEnhanced:
    # Existing
    events_per_month: dict[int, int]
    hours_per_month: dict[int, float]
    events_per_weekday: dict[str, int]
    busiest_day: tuple[str, int, float]

    # New - NOT IMPLEMENTED
    hours_by_time_bucket: dict[str, float]  # ❌
    # early_morning (05:00-09:00), mid_morning (09:00-12:00),
    # afternoon (12:00-17:00), evening (17:00-21:00), late_night (21:00-02:00)

    streaks: dict[str, int]                  # ❌
    # longest_meeting_streak_days, longest_free_streak_days
```

#### Step 3.2: Context Classification

Classify events into meal/activity tags:

```python
CONTEXT_TAGS = [
    'dinner',      # evening + restaurant or "dinner" in summary
    'drinks',      # "drinks", "bar", "cocktails"
    'coffee',      # morning + cafe or "coffee" in summary
    'breakfast',   # morning + "breakfast" or "brunch"
    'lunch',       # midday + restaurant
    'work_meeting',# "1:1", "standup", "meeting"
    'gym',         # place_type=gym or "gym" in summary
    'travel',      # "flight", "airport"
    'entertainment', # movie, concert, show
]

def classify_event_context(event: NormalizedEvent) -> list[str]:
    """Heuristics based on summary, place types, time of day, duration."""
```

#### Step 3.3: JSON Summary Generator

```python
def generate_summary_json(events: list[NormalizedEvent], year: int) -> dict:
    """Produce complete summary JSON matching concept.md schema."""
```

Output to `data/summary_2025.json`.

#### Updated TODOs (2025-12-11)

- [ ] Implement the full summary schema (median duration, streaks, time buckets, context tags).
- [ ] Build the prompt generator that emits `prompt_{year}.txt`.
- [ ] Add regression tests for timezone parsing, classification caching, and Places/LLM fallbacks.
- [ ] Consider opt-in throttling/filters so LLM payloads stay small on large calendars.

#### Step 3.4: LLM Prompt Builder

```python
WRAPPED_PROMPT_TEMPLATE = """
You are analyzing a person's Google Calendar events for {year}.

You are given a JSON object with aggregated stats:
- Global stats (event counts, hours)
- Time-based stats (by month, weekday, time of day)
- People stats (top friends by events and hours)
- Place stats (venues, neighborhoods, cuisines)
- Activity stats (fitness, wellness, health)
- Context stats (dinners, drinks, coffee)

Tasks:
1. Write a "{year} Calendar Wrapped" narrative (3-6 paragraphs, friendly, slightly humorous)
2. List 5-10 interesting patterns or mini-stories
3. Suggest 5 experiments for {year+1}
4. Ground all claims in the numbers

JSON data:
{summary_json}
"""

def build_wrapped_prompt(summary: dict) -> str:
    """Generate prompt for LLM narrative."""
```

### Open Questions for Phase 3

1. **Which LLM to target?** Claude, GPT-4, local model?
   - Recommendation: GPT-5.1 (already integrated)

2. **Should the tool call the LLM directly?** Or just generate the prompt?
   - Recommendation: Generate prompt, let user paste (more control)

3. **How much event detail in prompt?** Just stats, or include raw events?
   - Recommendation: Stats only (privacy, token limits)

---

## Phase 4: Visual UI (Flighty-Inspired)

> **Status**: ❌ **NOT STARTED**

### Goal

Create a beautiful, shareable "2025 Wrapped" visual experience.

### Flighty Reference

- [ ] **Fetch Flighty.com HTML/CSS for inspiration**
  - URL: https://flighty.com/
  - Analyze design language, animations, color palette

### Design Direction

Based on Flighty's aesthetic:
- **Dark mode** with vibrant accent colors
- **Card-based layout** for each stat category
- **Smooth animations** on scroll/reveal
- **Data visualizations**: charts, maps, timelines
- **Mobile-first** responsive design
- **Shareable**: Generate images or allow screenshots

### Technical Options

1. **Static HTML/CSS** (simplest) ← Recommended
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

**Recommendation**: Start with static HTML/CSS.

### UI Sections

1. **Hero**: Year number, total events, total hours
2. **Time Story**: Calendar heatmap, busiest days, streaks
3. **Friends**: Top 5-10 with avatars (if available), hours together
4. **Places**: Map with markers, top venues list, neighborhood breakdown
5. **Cuisines**: Pie/bar chart of cuisine types
6. **Activities**: Fitness tracker style (yoga sessions, gym visits)
7. **Patterns**: Interesting stats and anomalies
8. **2026 Suggestions**: AI-generated recommendations

### Implementation Tasks

```
src/lifely/
├── html_generator.py     # Generate static HTML from stats
├── templates/
│   └── wrapped.html      # Jinja2 template
└── static/
    ├── styles.css        # Tailwind or custom CSS
    └── charts.js         # Chart.js visualizations
```

### Open Questions for Phase 4

1. **Avatars**: Pull from Google Contacts? Or skip?
2. **Maps**: Embed Google Maps? Or use static map image?
3. **Hosting**: Local HTML file vs. hosted page?
4. **Privacy**: Any concerns about the generated output?

---

## Phase 5: Polish & Extensions

> **Status**: ❌ **NOT STARTED**

### Potential Enhancements

- **Multi-calendar support**: Aggregate across work + personal
- **Year-over-year comparison**: 2024 vs 2025
- **Friend network visualization**: Who do you see together?
- **Travel map**: Animated timeline of your trips
- **Integrations**: Pull in photos from Google Photos for events?
- **Scheduled reports**: Run monthly/quarterly, not just annual

### Technical Debt to Address

- [ ] Better error handling throughout
- [ ] Retry logic for API failures ✅ (Done in Phase 2)
- [ ] Rate limiting for APIs ✅ (Done in Phase 2)
- [ ] Unit test coverage
- [ ] Type hints and mypy validation
- [ ] Documentation (README, inline docs)

---

## Summary: Phase Roadmap

| Phase | Focus | Status | Outcome |
|-------|-------|--------|---------|
| 1 | Calendar Pipeline | ✅ Done | Fetch, normalize, friend stats, CLI |
| 2 | Location Intelligence | ✅ Done | LLM enrichment, inferred friends, activities |
| 3 | Full Stats & Prompt | ❌ Not started | Context tags, streaks, LLM narrative |
| 4 | Visual UI | ❌ Not started | Flighty-inspired HTML/CSS wrapped |
| 5 | Polish | ❌ Not started | Multi-calendar, comparisons, tests |

**Current recommendation**: Phase 3 (context classification + LLM narrative) for maximum "Wrapped" feel.
