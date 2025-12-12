# Lifely Project Status

> **Last Updated**: 2025-12-12
> **Version**: 0.5.1 (Phase 4 In Progress — React wired, needs validation & proxy)

---

## Quick Summary

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 1** | ✅ Complete | Calendar Pipeline (fetch, normalize, stats, CLI) |
| **Phase 2** | ✅ Complete | LLM Enrichment (locations, classification, activities) |
| **Phase 3** | ✅ Complete | Full Stats & LLM Narrative (narrative, patterns, experiments) |
| **Phase 4** | 🚧 In Progress | Visual UI (React app wired to OAuth + TS stats; needs end-to-end validation and safe OpenAI proxy) |
| **Phase 5** | Not Started | Hosted App (Cloudflare deployment) |

---

## Current Focus / TODOs

### Immediate
- [x] React + Tailwind landing page with all states
- [x] Design tokens matching style guide (navy, cyan, Space Grotesk)
- [x] "Maximum wow" effects (particles, glassmorphism, gradients, animations)
- [x] Build Results page (7 beats) in React
- [x] Wire client-side OAuth + Calendar fetch (Google Identity Services)
- [x] Port Python stats engine to TypeScript (`lib/stats/pipeline.ts`)
- [x] Feed real data into React results via sessionStorage
- [x] Fix Tailwind v4 layout issues (inline styles for reliability)
- [x] Horizontal scroll with snap for Results page
- [ ] **Test end-to-end flow with real Google Calendar**
- [ ] **Move OpenAI calls off-browser** (client now points to proxy URL; still need worker deployed so keys aren’t exposed)
- [x] **LLM fragility (priority)**: stay within 3 RPM (throttle) and keep request count low (larger batches + combined story call)
- [x] Cache LLM results client-side (localStorage) for reruns
- [x] Add “Retry AI enrichment” UX (rerun without OAuth/fetch; uses cached raw events in sessionStorage)
- [x] Add AI toggle (optional “fast mode”)
- [x] Provide non-AI fallbacks for patterns/experiments
- [x] **Places v1: stacked bars only** (heatmap deferred — adds ~200KB bundle, API costs, marginal insight over bars)

### Infrastructure (Phase 5)
- [ ] Deploy Cloudflare Pages
- [ ] Deploy LLM proxy worker
- [ ] Set up Cloudflare KV (token system)
- [ ] Configure Google OAuth for production (lifely.thirdplane.io)
- [ ] DNS setup for subdomain

---

## What's Built

### Python CLI (Complete)

```bash
# Basic run (no enrichment)
uv run lifely

# With LLM enrichment (recommended)
uv run lifely --enrich

# Options
uv run lifely --year 2024 --enrich --top 10
uv run lifely --no-cache --enrich  # Force refresh from API
```

### React App (Wired, needs validation)

```bash
# Development
cd lifely-web-react
cp .env.example .env  # Add your credentials
npm run dev           # http://localhost:5173

# Keyboard shortcuts (dev mode)
r - toggle between landing and results page
```

**Landing Page Features:**
- Real Google OAuth flow (Google Identity Services)
- 6 states (idle, oauth_pending, oauth_declined, processing, complete, error)
- AI insights toggle (optional; can skip AI for faster runs)
- Animated particle background with connections
- Glassmorphism cards
- Animated gradient hero background
- Glow effects (cyan pulse on CTA)
- Text gradient on "2025"
- Modal dialogs (How it works, Permissions)
- Responsive design
- Accessibility (reduced motion support, ARIA labels)

**Results Page Features:**
- 7 horizontal-scroll beats with snap (Hero, People, Places, Rituals, Patterns, Narrative, Experiments)
- Progress dots fixed at top, updating via scroll events
- AI warning banner + “Retry AI” (reruns enrichment without OAuth/fetch)
- Hero beat with animated stats countup
- People beat with sparkbars and neighborhood chips
- Places beat with neighborhood bars and cuisine chips
- Rituals beat with dynamic categories, time breakdown visualization, coverage stats
- Patterns beat with insights and icons
- Narrative beat with AI-generated story
- Experiments beat with numbered suggestions

**Data Flow (current):**
```
Landing Page → Google OAuth Popup → Fetch Calendar (2025)
    → Process Stats (normalize, LLM enrich/classify/story; proxy preferred)
    → Save to sessionStorage → Navigate to /results
    → Display 7 horizontal beats
```
**Caveat:** If you use a direct OpenAI key, calls run client-side (key exposed). Use the proxy before sharing.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              LIFELY SYSTEM                                   │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────┐
                    │   User Browser  │
                    └────────┬────────┘
                             │
    ┌────────────────────────┼────────────────────────┐
    │                        │                        │
    │                        ▼                        │
    │   ┌─────────────────────────────────────┐      │
    │   │         REACT FRONTEND               │      │
    │   │   ┌─────────┐  ┌─────────┐           │      │
    │   │   │ Landing │─▶│ Results │           │      │
    │   │   │ (OAuth) │  │(7 beats)│           │      │
    │   │   └────┬────┘  └────┬────┘           │      │
    │   └────────┼────────────┼────────────────┘      │
    │            │            │                       │
    │            ▼            ▼                       │
    │   ┌─────────────┐  ┌─────────────┐             │
    │   │Google OAuth │  │Google Cal   │             │
    │   │(GIS Popup)  │  │API (browser)│             │
    │   └─────────────┘  └──────┬──────┘             │
    │                           │                     │
    │                           ▼                     │
    │              ┌─────────────────┐                │
    │              │  Stats Pipeline │                │
    │              │  (TypeScript)   │                │
    │              └────────┬────────┘                │
    │                       │                         │
    │                       ▼                         │
    │              ┌─────────────────┐                │
    │              │    OpenAI       │                │
    │              │  (enrichment)   │                │
    │              └─────────────────┘                │
    │                                                 │
    │   CLIENT-SIDE (localhost / Cloudflare Pages)   │
    └─────────────────────────────────────────────────┘
```

---

## File Structure

```
lifely/
├── planning/                      # Documentation
│   ├── README.md                  # Navigation guide
│   ├── status.md                  # This file
│   ├── concept.md                 # Original vision
│   ├── experience-concept.md      # User journey & emotional arc
│   ├── style-guide.md             # Design system & CSS specs
│   ├── landing-page-spec.md       # Landing page UX
│   ├── results-page-spec.md       # Results page UX (7 beats)
│   ├── hosted-app-plan.md         # Cloudflare deployment plan
│   └── architecture.md            # System design
│
├── lifely-web-react/              # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                # Shared UI components
│   │   │   │   ├── button.tsx
│   │   │   │   ├── glass-card.tsx
│   │   │   │   ├── progress-dots.tsx
│   │   │   │   ├── bar-row.tsx
│   │   │   │   ├── chip.tsx
│   │   │   │   └── sparkbar.tsx
│   │   │   ├── landing/           # Landing page
│   │   │   │   ├── landing-page.tsx  # OAuth flow integrated
│   │   │   │   ├── hero-text.tsx
│   │   │   │   ├── message-box.tsx
│   │   │   │   ├── progress-bar.tsx
│   │   │   │   └── modals.tsx
│   │   │   ├── results/           # Results container
│   │   │   │   └── results-page.tsx
│   │   │   └── beats/             # 7 beat components
│   │   │       ├── hero.tsx
│   │   │       ├── people.tsx
│   │   │       ├── places.tsx
│   │   │       ├── rituals.tsx
│   │   │       ├── patterns.tsx
│   │   │       ├── narrative.tsx
│   │   │       └── experiments.tsx
│   │   ├── hooks/
│   │   │   ├── use-lifely.ts      # OAuth + processing orchestration
│   │   │   ├── use-results.ts     # Results page data loading
│   │   │   ├── use-scroll-progress.ts  # Horizontal scroll tracking
│   │   │   ├── use-particles.tsx
│   │   │   └── use-countup.ts
│   │   ├── lib/
│   │   │   ├── google/            # Google OAuth + Calendar API
│   │   │   │   ├── oauth.ts
│   │   │   │   ├── calendar.ts
│   │   │   │   └── types.ts
│   │   │   ├── stats/             # Stats processing pipeline
│   │   │   │   ├── pipeline.ts
│   │   │   │   ├── normalize.ts
│   │   │   │   └── index.ts
│   │   │   ├── types.ts           # Data types + transformation
│   │   │   └── utils.ts
│   │   ├── App.tsx                # Simple routing
│   │   └── index.css              # Design tokens + Tailwind
│   ├── .env.example               # Environment template
│   ├── README.md                  # Setup instructions
│   ├── TAILWIND_V4_LEARNINGS.md   # Tailwind v4 compatibility notes
│   └── package.json
│
├── src/lifely/                    # Python CLI
│   ├── auth.py
│   ├── fetch.py
│   ├── models.py
│   ├── normalize.py
│   ├── stats.py
│   ├── cli.py
│   └── llm_enrich.py
│
├── data/                          # Output (gitignored)
│   ├── raw_events_2025.json
│   ├── stats_2025.json
│   └── llm_cache.json
│
└── credentials/                   # Auth (gitignored)
    ├── credentials.json
    └── token.json
```

---

## Tech Stack

| Component | Technology | Status |
|-----------|------------|--------|
| **CLI** | Python + uv | ✅ Complete |
| **Frontend** | React 19 + TypeScript + Vite 7 | 🚧 Wired, not yet validated end-to-end |
| **Styling** | Tailwind CSS v4 (inline styles for layout) | ✅ Implemented |
| **OAuth** | Google Identity Services | 🚧 Implemented, needs live test |
| **Stats** | TypeScript pipeline | ✅ Implemented |
| **Hosting** | Cloudflare Pages | ❌ Not deployed |
| **API Proxy** | Cloudflare Worker | ❌ Not deployed (OpenAI called from browser) |

---

## Known Issues

### Tailwind CSS v4 Compatibility
Many Tailwind v4 utility classes silently fail (flex, grid, gap, w-full, max-w-*, bg-*, scale-*, etc.).

**Affected**: Layout, spacing, sizing, colors, transforms
**Solution**: Use inline styles for all layout-critical and conditional styling properties
**Reference**: See `lifely-web-react/TAILWIND_V4_LEARNINGS.md` for detailed list

### Reasoning Effort Compatibility
GPT-5 family models differ in supported `reasoning.effort` values:
- `gpt-5.2`: `none | low | medium | high | xhigh` (does **not** support `minimal`)
- `gpt-5-mini` / `gpt-5-nano`: `minimal | low | medium | high` (does **not** support `none`)

**Solution**: Normalize effort per model:
- `none → minimal` on `gpt-5-mini` / `gpt-5-nano`
- `minimal → low` on `gpt-5.2`

**Status**: Implemented in:
- `lifely-web-react/src/lib/stats/llm.ts`
- `workers/llm-proxy/src/index.ts`

### OpenAI Rate Limits (3 RPM)
These models have extremely low request-per-minute limits (3 RPM). That makes “many small requests” brittle.

**Mitigations (React pipeline)**:
- RPM throttle to stay within limits
- Larger batches (fewer requests)
- Local cache (localStorage) for location + classification so reruns are cheap
- Single combined call for narrative + patterns + experiments

### OpenAI Key Exposure
OpenAI calls currently run client-side; keys are exposed in the browser.

**Risk**: API key visible in browser DevTools
**Solution**: Deploy Cloudflare Worker proxy per `hosted-app-plan.md`
**Status**: Proxy scaffolded in code, worker not yet deployed

### Missing AI Sections When LLM Fails
When LLM calls fail (rate limits, timeouts), AI-driven sections can be empty.

**Solution**: Beats render with explicit fallback UI and a warning banner (instead of disappearing and breaking navigation). Non-fatal batch failures are surfaced via `llm_warnings` so debugging isn’t “silent”.

### LLM Processing Time
LLM enrichment time is dominated by RPM limits and the number of unique locations/summaries.

**Bottleneck**: 3 RPM + multi-stage enrichment
**Mitigations applied**: RPM throttle, larger batches, local cache, fewer total calls
**Future**: Worker proxy + better payload trimming; consider opt-in “AI-lite” mode

---

## Changelog

### 2025-12-12 - LLM Reliability (Rate Limits + Caching)
- **Default model**: `gpt-5.2` (fallback: `gpt-5-mini` → `gpt-5-nano`)
- **Rate-limit aware batching**: larger batches + RPM throttle (3 RPM) to avoid 429s
- **Local cache**: location + classification cached in localStorage to make reruns fast and reliable
- **Fewer calls**: narrative + patterns + experiments generated in a single request
- **UI resilience**: beats render with explicit fallbacks when AI data is missing
- **Hardening**: request timeouts + detection of incomplete/empty Responses API outputs; avoid poisoning cache on invalid JSON

### 2025-12-12 - Loading UX + Navigation Fixes
- **New ProcessingView component**: Premium loading experience during LLM enrichment
  - 3-step visual timeline: Places → Patterns → Story
  - Glassmorphism card with current step details
  - Animated gradient progress bar with shimmer effect
  - Pulsing icon for active step
- **ProgressDots reserved for navigation only**: Removed from landing page states
  - Landing idle, oauth_pending, complete states no longer show dots
  - Dots only appear on Results page for beat navigation
- **Fixed missing-beat failure mode**: AI-driven beats no longer disappear when data is missing
  - Beats render fallback UI instead of returning `null`
  - Progress dots remain stable and navigation stays consistent
- **ProgressDots converted to inline styles**: Tailwind v4 reliability
- **Complete state redesign**: Glow checkmark with "Your year is ready" messaging

### 2025-12-11 - GPT-5 Responses API Migration
- **Migrated to OpenAI Responses API**: Switched from Chat Completions (`/v1/chat/completions`) to Responses API (`/v1/responses`)
  - GPT-5 models require the new API format for optimal performance
  - Request: uses `input` instead of `messages`
  - Response: nested structure `output[].content[].text` (where `type === 'message'` and content `type === 'output_text'`)
- **Updated models to GPT-5 family**: Initial migration used `gpt-5-mini` defaults (later moved to `gpt-5.2`; see 2025-12-12)
- **New API parameters**: Replaced `temperature` with GPT-5 parameters
  - `reasoning.effort`: model-dependent (see “Reasoning Effort Compatibility” above)
  - `text.verbosity`: 'low' | 'medium' | 'high' (controls output length)
  - Current default: `reasoningEffort: 'none'` (normalized per model; mini/nano → `minimal`)

### 2025-12-11 - Dynamic categories & coverage stats
- **Dynamic LLM classification**: Prompt now asks LLM to assign any meaningful category name + `is_interesting` flag
  - No more hardcoded self-care categories; LLM decides what's interesting
  - Added neighborhood inference from venue names (e.g., "Barry's Bootcamp" → "Tribeca")
- **Coverage stats**: Track total events, events with location, classified, interesting
  - Displayed in Rituals beat summary ("X of Y events analyzed")
- **Time breakdown visualization**: Colorful stacked bar showing hours per category with legend
- **Rituals beat rewrite**: Shows dynamic categories with icons, activity chips, time breakdown
- **Places v1 decision**: Skip heatmap (200KB+ bundle, API costs, sparse data); stacked bars + chips are sufficient

### 2025-12-11 - LLM proxy prep & perf tweaks
- React stats pipeline now prefers LLM proxy (VITE_LLM_PROXY_URL/TOKEN); direct OpenAI key is dev-only fallback
- Added batch concurrency + tighter token limits in TS LLM calls to reduce 15m runs
- Updated env/README with proxy scaffolding; Places v1 is bars-only (heatmap deferred)

### 2025-12-11 - Phase 4 Wiring (OAuth, needs validation)
- **OAuth Integration**: Wired real Google OAuth flow using Google Identity Services
  - Landing page now uses `useLifely` hook instead of fake simulation
  - OAuth popup → fetch calendar → process stats → sessionStorage → redirect to /results
- **Tailwind v4 Fixes**: Converted 21+ files from Tailwind classes to inline styles
  - All beat components (hero, people, places, rituals, patterns, narrative, experiments)
  - UI components (bar-row, chip, sparkbar, progress-dots, glass-card, button)
  - Landing components (modals, message-box, progress-bar)
- **Horizontal Scroll**: Changed from vertical scroll to horizontal scroll with snap
  - `scroll-snap-type: x mandatory` on results container
  - Each beat is `min-width: 100vw` with `scroll-snap-align: start`
- **Progress Dots**: Fixed tracking to use scroll events instead of IntersectionObserver
  - Callback ref pattern for container element
  - `scrollLeft / containerWidth` calculation for current beat
- **Data Flow Fixed**:
  - Removed hardcoded MOCK_STATS from `use-results.ts`
  - Fixed Rituals transformation to use actual activity counts (not category totals)
  - `useLifely` now saves rawStats to sessionStorage on completion
- **Documentation**: Updated README.md and .env.example with setup instructions

### 2025-12-11 - React Results Page Complete
- Built all 7 beats: Hero, People, Places, Rituals, Patterns, Narrative, Experiments
- Added scroll tracking with progress dots
- Created shared components: Sparkbar, BarRow, Chip
- Added types.ts with data contracts and transformation function

### 2025-12-11 - React Landing Page Complete
- Created `lifely-web-react/` with Vite + React + TypeScript
- Added Tailwind CSS v4 with custom design tokens
- Built all landing page states with particle effects and animations

### 2025-12-10 - Phase 2 & 3 Complete
- LLM enrichment with GPT for locations, classification, narrative
- Full stats engine with friend detection, activity categorization
