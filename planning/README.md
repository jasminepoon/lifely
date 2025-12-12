# Lifely Planning Documents

> Documentation for the Lifely "2025 Wrapped" experience — a personal year-in-review generated from Google Calendar data.

---

## Quick Navigation

| Document | Purpose | Read When... |
|----------|---------|--------------|
| [experience-concept.md](experience-concept.md) | The "why" and emotional design | Understanding the product vision |
| [style-guide.md](style-guide.md) | Visual design system | Building any UI component |
| [landing-page-spec.md](landing-page-spec.md) | Landing page UX detail | Implementing the landing page |
| [results-page-spec.md](results-page-spec.md) | Results page UX detail | Implementing the results page |
| [hosted-app-plan.md](hosted-app-plan.md) | Technical architecture | Setting up infrastructure |
| [architecture.md](architecture.md) | System design overview | Understanding data flow |

---

## Document Map

### Vision & Concept

- **[concept.md](concept.md)** — Original product concept and goals
- **[experience-concept.md](experience-concept.md)** — Detailed experience design: the Spotify Wrapped formula, emotional arc, beat sequence, what makes this special

### Design System

- **[style-guide.md](style-guide.md)** — Complete design system: colors, typography, components, animations, accessibility. The source of truth for all UI decisions.

### Page Specifications

- **[landing-page-spec.md](landing-page-spec.md)** — Landing page with 7 states: Loading, Valid, Invalid, OAuth, Declined, Processing, Error. Element specs, animations, responsive behavior.

- **[results-page-spec.md](results-page-spec.md)** — Results page with 7 beats: Hero, People, Places, Rituals, Patterns, Narrative, Experiments. Component specs, data contracts, empty states.

### Technical Architecture

- **[architecture.md](architecture.md)** — System design: CLI tool, Google Calendar API, LLM enrichment pipeline
- **[hosted-app-plan.md](hosted-app-plan.md)** — Web app architecture: Cloudflare Pages/Workers, token system, privacy model

### Development Phases

- **[phase1-plan.md](phase1-plan.md)** — Phase 1: Basic calendar fetch and stats
- **[phase2-event-summaries.md](phase2-event-summaries.md)** — Phase 2: LLM-powered event classification
- **[future-phases.md](future-phases.md)** — Roadmap for future development
- **[future-enhancements.md](future-enhancements.md)** — Ideas and feature backlog

### Status

- **[status.md](status.md)** — Current project status and progress

---

## Reading Order

**If you're new to the project:**

1. `concept.md` — What we're building
2. `experience-concept.md` — How it should feel
3. `style-guide.md` — How it should look

**If you're implementing UI:**

1. `style-guide.md` — Design tokens and components
2. `landing-page-spec.md` or `results-page-spec.md` — Page-specific specs
3. Reference `spikes/` for working prototypes

**If you're setting up infrastructure:**

1. `hosted-app-plan.md` — Architecture and deployment
2. `architecture.md` — Data flow and APIs

---

## Key Design Principles

From `experience-concept.md`:

> "This is a **story**, not analytics. The user should feel surprise, recognition, pride, and inspiration."

From `style-guide.md`:

> "Shadcn implementation vibe: minimal scaffolding, opinionated tokens, tight spacing, confident typography."

### The Wrapped Formula

1. **Identity** — Your calendar reveals who you are
2. **Surprise** — Surface patterns you didn't notice
3. **Scarcity** — Once a year, not a dashboard
4. **Shareability** — Every screen designed for screenshots
5. **Positive framing** — Celebrate, don't judge

### Visual Identity

- **Dark-first**: Navy (#0A0F1A), not black
- **Accent**: Cyan (#00D4FF) for emphasis
- **Typography**: Space Grotesk (display), Inter (body)
- **Motion**: Purposeful, staggered, never jittery

---

## Related Directories

```
lifely/
├── planning/          # You are here
├── lifely-web-react/  # React frontend (active development)
├── spikes/            # UI prototypes (standalone HTML)
├── lifely-web/        # Vanilla JS version (archived)
├── workers/           # Cloudflare Workers (LLM proxy)
├── src/lifely/        # Python CLI tool
└── ui_screenshots/    # Reference designs (gitignored)
```

---

## Quick Start

### Run the CLI
```bash
uv run lifely --enrich --top 5
```

### Run the React App
```bash
cd lifely-web-react
npm run dev   # http://localhost:5173 (or next available)
```

### Dev Shortcuts
- Press `r` to toggle between landing/results (dev only)
