# Lifely Project Status

> **Last Updated**: 2025-12-12
> **Version**: 0.2.0 (Phase 2 Complete, Phase 4 Designed)

---

## Quick Summary

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 1** | ✅ Complete | Calendar Pipeline (fetch, normalize, stats, CLI) |
| **Phase 2** | ✅ Complete | LLM Enrichment (locations, classification, activities) |
| **Phase 3** | Not Started | Full Stats & LLM Narrative |
| **Phase 4** | 📐 Designed | Visual UI (Storyboard + Flight Deck accents) |
| **Phase 5** | Not Started | Polish & Extensions |

---

## Current Focus / TODOs

- LLM runtime: defaults to `gpt-5.1` for location and `gpt-5-mini` for classification; env overrides for batch size (`LIFELY_LLM_BATCH_SIZE`, default 30) and timeout (`LIFELY_LLM_TIMEOUT`, default 90s); concurrency env-driven (`LIFELY_LLM_MAX_CONCURRENCY`, default 2—tune up/down based on your org limits); prompt payloads trimmed; Places resolves Maps links with name/hood/cuisine **and lat/lng** when `GOOGLE_MAPS_API_KEY` is set. `.env` auto-loaded by CLI.
- New: stats-level LLM outputs (narrative, patterns, experiments) are generated/cached when `--enrich` runs with API key. Need a fresh enriched run to populate `data/stats_YYYY.json`.
- UI checkpoints: prototype beats locally (hero count-up, people sparkbars, places stacked bars vs map, rituals bars, patterns list, narrative card, experiments CTA) then decide what ships; pick component variants first.
- Map question: lat/lng only when Places resolves; bars are ready now. Inspect coord coverage after next enriched run before broadening Places beyond Maps links or adding centroid mapping.
- Docs: `planning/experience-concept.md` and other planning files are currently untracked—confirm if we should commit them.

---

## What's Working Now

### Run the Tool

```bash
# Basic run (no enrichment)
uv run lifely

# With LLM enrichment (recommended)
uv run lifely --enrich

# Options
uv run lifely --year 2024 --enrich --top 10
uv run lifely --no-cache --enrich  # Force refresh from API
```

### Output Example

```
╭──────────────────────────────────────────────────────────────────────────────╮
│ 2025 Wrapped                                                                 │
╰──────────────────────────────────────────────────────────────────────────────╯

Your Year in Numbers
  392 events
  Busiest month: Nov
  Busiest day: Sat

Your NYC Footprint
  Top neighborhoods: Williamsburg (30), Greenpoint (19), Midtown (10)
  Top spots: Greenpoint Psychotherapy (10), The Residence of Mr. Moto (3)
  Top cuisines: Japanese (17), Korean (8), American (8)

Your Activities
  Health: 15 sessions (mostly therapy) @ Greenpoint Psychotherapy
  Entertainment: 11 sessions (mostly restaurant_reservation)
  Fitness: 11 sessions (mostly yoga) @ Barry's Noho

Your People (Calendar Invites)
  #1 angela.kaur (4 events)
      Suram Sushi & Ramen, AMC 34th Street 14
      (Hudson Yards, Midtown)

Your People (From Event Titles)
  #1 Beth (12 events)
      Cho Dang Gol, Twin Tails, Xie Bao
      (Columbus Circle, Greenwich Village)
```

### JSON Output

Full statistics saved to `data/stats_2025.json` including:
- `time_stats`: events/hours by month, weekday, busiest day
- `friend_stats`: email-based friends with event details
- `location_stats`: top neighborhoods, venues, cuisines
- `inferred_friends`: names extracted from event titles
- `activity_stats`: fitness, health, wellness categories

---

## Phase 4: Visual UI Design

> **Status**: 📐 Designed (Storyboard chosen; Flight Deck accents; Compass deferred)

### Design Direction

- Layout: Storyboard beats (see `experience-concept.md` for full arc) with glass/sparkbar accents.
- Palette: navy base with cyan/magenta/teal accents (see `style-guide.md` tokens).
- Framework: single HTML, vanilla JS/CSS, no build step.
- Auto-play: hero + numbers auto, rest scroll/tap; `prefers-reduced-motion` disables auto.

### Beat Sequence (v1)

| Beat | Content | Emotion |
|------|---------|---------|
| 1. Year | "2025" + event count | Anticipation |
| 2. Numbers | Events, hours, people | Scale |
| 3. People | Top friends with venues | Recognition |
| 4. Places | Map (or stacked bars) + neighborhoods/cuisines | Identity |
| 5. Rituals | Activities (yoga, therapy) | Pride |
| 6. Patterns | Streaks, insights | Surprise |
| 7. Story | LLM narrative | Reflection |
| 8. Experiments | Next-year suggestions | Inspiration |

### Key Documents

- `experience-concept.md` — User journey, emotional arc, product vision
- `style-guide.md` — Design system, CSS tokens, component specs

---

## Phase 2 Implementation Details

### Features Implemented

| Feature | Description | File |
|---------|-------------|------|
| Location extraction | Venue, neighborhood, city, cuisine from location_raw | `llm_enrich.py` |
| Solo event classification | SOCIAL/ACTIVITY/OTHER categorization | `llm_enrich.py` |
| Inferred friends | Names extracted from titles ("Dinner with Masha" -> Masha) | `llm_enrich.py` |
| Activity categories | fitness, health, wellness, personal_care, learning, entertainment | `llm_enrich.py` |
| Venue from summary | "Yoga @ Vital" -> venue: Vital | `llm_enrich.py` |
| Merge suggestions | Link inferred names to email friends | `llm_enrich.py` |
| Async batching | Parallel batches (default 4 concurrent), 50 events each | `llm_enrich.py` |
| Rate limit retry | Exponential backoff (5s, 10s, 20s...) | `llm_enrich.py` |

### Data Models

```python
@dataclass
class InferredFriend:
    name: str                  # "Masha"
    normalized_name: str       # "masha"
    event_count: int
    total_hours: float
    events: list[FriendEvent]
    linked_email: str | None   # If merged

@dataclass
class ActivityCategoryStats:
    category: str              # "fitness", "health", etc.
    event_count: int
    total_hours: float
    top_venues: list[tuple[str, int]]
    top_activities: list[tuple[str, int]]
```

---

## What's NOT Implemented Yet

### Phase 3 (Planned)

| Feature | Description |
|---------|-------------|
| Context tags | dinner, drinks, coffee, lunch, work_meeting, gym, travel |
| Time buckets | early_morning, mid_morning, afternoon, evening, late_night |
| Streaks | longest_meeting_streak_days, longest_free_streak_days |
| LLM narrative | GPT-5.1 generates "Wrapped" story from stats |
| Patterns | "You and Beth had 12 consecutive Saturdays" |

### Phase 4 (Designed, Not Built)

| Feature | Description |
|---------|-------------|
| HTML generator | Python generates single HTML file |
| Beat renderer | Each section as `<section class="beat">` |
| Animations | CSS + Intersection Observer |
| Number count-up | Animated stat reveals |
| Sparkbars | Progress bars for people/places |
| Places viz | Stacked bars (map deferred to v2) |

### Decisions (Locked)

| Decision | Choice |
|----------|--------|
| Places viz | Stacked bars |
| Progress | Dots |
| Sticky banner | After hero |
| Data payload | < 50KB (top 10 only) |

### Build Order

1. Hero count-up → 2. People sparkbars → 3. Places bars → 4. Rituals → 5. Patterns → 6. Narrative → 7. Experiments

Spike each in isolation, then integrate.

---

## Environment Setup

### Required

```bash
# Google Calendar OAuth
credentials/credentials.json   # Download from GCP Console

# OpenAI API (for --enrich)
export OPENAI_API_KEY="sk-..."
```

### Optional

```bash
--no-cache   # Force refresh calendar data
--top 5      # Limit friends shown
--year 2024  # Different year
```

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Events processed | 392 |
| Locations enriched | 166 |
| Inferred friends | 48 |
| Activity categories | 6 |
| LLM cost per run | ~$0.10 |
| Total runtime | ~2-5 min (with LLM calls) |

---

## File Structure

```
lifely/
├── planning/
│   ├── concept.md              # Original vision
│   ├── experience-concept.md   # User journey & product vision
│   ├── style-guide.md          # Design system & CSS specs
│   ├── future-enhancements.md  # Deferred ideas (map, multi-city, etc.)
│   ├── phase1-plan.md          # Phase 1 details
│   ├── phase2-event-summaries.md  # Phase 2 details
│   ├── future-phases.md        # Phase 3-5 roadmap
│   ├── architecture.md         # System design
│   └── status.md               # This file
│
├── src/lifely/
│   ├── auth.py                 # OAuth
│   ├── fetch.py                # Calendar API
│   ├── models.py               # All dataclasses
│   ├── normalize.py            # Event normalization
│   ├── stats.py                # Statistics
│   ├── cli.py                  # CLI entrypoint
│   └── llm_enrich.py           # GPT-5.1 enrichment
│
├── data/                       # Output (gitignored)
│   ├── raw_events_2025.json
│   └── stats_2025.json
│
└── credentials/                # Auth (gitignored)
    ├── credentials.json
    └── token.json
```

---

## Next Steps

### Immediate (Phase 4 Implementation)
1. Create `html_generator.py` module
2. Build Jinja2 template with beat structure
3. Embed CSS design system
4. Add vanilla JS for animations
5. Test screenshot optimization

### Then (Phase 3 Enhancements)
1. Add streak calculations
2. Build pattern detection
3. Implement LLM narrative generation
4. Add context tags

---

## Changelog

### 2025-12-11 - LLM perf + UI checkpoints
- Fixed concurrency cap to respect env default (4) and trimmed prompt payloads to reduce token/time usage.
- Resolves Google Maps links with Places API before LLM when key is provided.
- Added UI prototype checklist + variation brainstorm to `style-guide.md` (Storyboard locked; Flight Deck/Compass parked as explorations).

### 2025-12-10 - Phase 4 Design Complete
- Created comprehensive `experience-concept.md` with user journey
- Rewrote `style-guide.md` with committed design direction
- Defined 8-beat reveal sequence
- Specified color system, typography, animations
- Made key decisions: Storyboard layout, navy palette, no light mode

### 2025-12-10 - Phase 2 Complete
- Implemented async LLM enrichment with GPT-5.1 Responses API
- Added location extraction (venue, neighborhood, cuisine)
- Added solo event classification (SOCIAL/ACTIVITY/OTHER)
- Added inferred friends from event titles
- Added activity category stats (fitness, health, wellness, etc.)
- Added venue extraction from event summaries
- Added rate limit handling with exponential backoff
- Updated CLI with wrapped-style display
- Updated JSON output with all enrichment data

### 2025-12-09 - Phase 1 Complete
- Calendar API integration with OAuth
- Event normalization and timezone handling
- Friend stats computation
- Time stats computation
- Basic CLI output
- JSON export
