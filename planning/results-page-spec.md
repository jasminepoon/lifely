# Results Page Specification

> **URL**: `/results.html` (redirected from landing after processing)
> **Goal**: Present the user's year as a narrative experience — not a dashboard.

---

## Design Philosophy

This is a **story**, not analytics. The user should feel:
1. **Surprise** — "I didn't know that about my year"
2. **Recognition** — "That's so accurate"
3. **Pride** — "I showed up for myself"
4. **Inspiration** — "I want to try that in 2026"

Every beat is designed for **screenshots**. Self-contained, readable at phone resolution, shareable without context.

---

## Page Structure

### Navigation Model

| Device | Interaction |
|--------|-------------|
| Desktop | Scroll to advance between beats |
| Mobile | Scroll or swipe |
| Both | Progress dots at top show current beat |

### Beat Sequence

```
Beat 1: Hero + Stats     → "The scale of your year"
Beat 2: People           → "Who showed up"
Beat 3: Places           → "Where you existed"
Beat 4: Rituals          → "How you invested in yourself"
Beat 5: Patterns         → "What you didn't notice"
Beat 6: Narrative        → "Your story, written"
Beat 7: Experiments      → "Ideas for next year"
```

### Progress Indicator

- 7 dots, 8px diameter, 8px gap
- Inactive: `--border-default` (10% white)
- Active: `--accent-cyan` with `--glow-cyan`
- Fixed at top of viewport, 16px from top
- Updates as user scrolls (Intersection Observer)

```
┌────────────────────────────────────────────────────────────┐
│  ● ○ ○ ○ ○ ○ ○                                             │
│                                                            │
│                     [Beat Content]                         │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Beat 1: Hero + Stats

**Purpose**: Establish scale. "This is how much happened."

### Layout

```
┌────────────────────────────────────────────────────────────┐
│  ● ○ ○ ○ ○ ○ ○                                             │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  2025 Wrapped                                        │  │
│  │                                                      │  │
│  │        2025                                          │  │
│  │                                                      │  │
│  │  Your year in 392 moments                            │  │
│  │                                                      │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐             │  │
│  │  │   392    │ │  1,807   │ │    48    │             │  │
│  │  │  Events  │ │  Hours   │ │  People  │             │  │
│  │  └──────────┘ └──────────┘ └──────────┘             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Element Specifications

| Element | Spec |
|---------|------|
| **Container** | Card with glassmorphism, 20px radius, cyan glow |
| **Eyebrow** | "2025 Wrapped", 12px, `--text-muted`, uppercase, 0.15em tracking |
| **Year** | "2025", 64px (mobile) / 80px (desktop), `--text-primary`, -0.04em tracking |
| **Subtitle** | "Your year in X moments", 18px, `--text-secondary` |
| **Stat cards** | 3-column grid (responsive), `--bg-elevated`, 12px radius |
| **Stat value** | 32px, weight 700, tabular-nums |
| **Stat label** | 14px, `--text-secondary` |

### Animation

1. Card fades in + rises 20px (0ms, 400ms ease-out)
2. Year number counts up from 0 (200ms delay, 1000ms duration)
3. Stats count up staggered (400ms, 600ms, 800ms delays)
4. Respect `prefers-reduced-motion`: show final values immediately

### Data Requirements

```typescript
interface HeroData {
  year: number;           // 2025
  totalEvents: number;    // 392
  totalHours: number;     // 1807
  totalPeople: number;    // 48
}
```

---

## Beat 2: People

**Purpose**: Show relationships. "These are the humans you made time for."

### Layout

```
┌────────────────────────────────────────────────────────────┐
│  ○ ● ○ ○ ○ ○ ○                                             │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  The ones who showed up                              │  │
│  │  Top friends with venues & neighborhoods             │  │
│  │                                                      │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │ ┌───┐  Beth                                    │  │  │
│  │  │ │ B │  12 moments · 28 hours                   │  │  │
│  │  │ └───┘  Twin Tails  Cho Dang Gol  Mitr Thai    │  │  │
│  │  │        Greenwich Village  Midtown              │  │  │
│  │  │        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 100%   │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │                                                      │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │ ┌───┐  Masha                                   │  │  │
│  │  │ │ M │  10 moments · 22 hours                   │  │  │
│  │  │ └───┘  ...                                     │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### Element Specifications

| Element | Spec |
|---------|------|
| **Section heading** | "The ones who showed up", 24px, `--text-primary` |
| **Subheading** | 15px, `--text-secondary` |
| **Person card** | Nested card, grid layout (avatar + content) |
| **Avatar** | 52px square, 14px radius, gradient background, initial letter |
| **Name** | 18px, `--text-primary` |
| **Meta** | "X moments · Y hours", 15px, `--text-secondary` |
| **Venue chips** | `chip--accent` variant, cyan gradient bg |
| **Hood chips** | Default chip, subtle bg |
| **Sparkbar** | 6px height, gradient fill, percentage of top person |

### Animation

1. Cards appear staggered (0ms, 80ms, 160ms delays)
2. Sparkbars animate width from 0 to value (600ms ease-out)
3. Cards have subtle hover lift (2px) with glow

### Data Requirements

```typescript
interface Person {
  name: string;           // "Beth"
  displayName?: string;   // Full name if available
  count: number;          // 12 (event count)
  hours: number;          // 28
  venues: string[];       // ["Twin Tails", "Cho Dang Gol"]
  neighborhoods: string[];// ["Greenwich Village", "Midtown"]
  percentage: number;     // 100 (relative to top person)
}

interface PeopleData {
  people: Person[];       // Top 5-10
}
```

### Design Decisions

- **Max 5 people** on first view (avoid scroll fatigue)
- **No email addresses** shown (privacy)
- **Venues before neighborhoods** (more specific = more interesting)
- **Sparkbar shows relative frequency** (not absolute)

---

## Beat 3: Places

**Purpose**: Show geographic identity. "This is where you exist."

### Layout

```
┌────────────────────────────────────────────────────────────┐
│  ○ ○ ● ○ ○ ○ ○                                             │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Your NYC footprint                                  │  │
│  │                                                      │  │
│  │  Williamsburg   ████████████████████████████████  30 │  │
│  │  Greenpoint     █████████████████████████         21 │  │
│  │  Midtown        ██████████████                    12 │  │
│  │  Lower East Side ████████████                      9 │  │
│  │                                                      │  │
│  │  🍜 Japanese · 17   🍚 Korean · 8   🍔 American · 8  │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    [Map Heat]                        │  │
│  │              (optional, if lat/lng)                  │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### Element Specifications

| Element | Spec |
|---------|------|
| **Heading** | "Your NYC footprint", 24px, `--text-primary` |
| **Bar row** | Grid: label (140px fixed) + bar (flex) + value (44px) |
| **Bar label** | 15px, `--text-primary` |
| **Bar track** | 10px height, `--bg-elevated`, full radius |
| **Bar fill** | Gradient accent, animates from 0 |
| **Bar value** | 15px, `--text-secondary`, tabular-nums, right-aligned |
| **Cuisine chips** | `chip--accent` for top 3, default for rest |
| **Map container** | 280px height, radial gradient bg, subtle border |
| **Map dots** | Absolute positioned, sized by frequency, cyan/magenta |

### Animation

1. Bars animate width staggered (0ms, 50ms, 100ms... per bar)
2. Chips fade in after bars complete
3. Map dots pulse in sequentially (if map present)

### Data Requirements

```typescript
interface PlacesData {
  neighborhoods: Array<[string, number]>;  // [["Williamsburg", 30], ...]
  cuisines: Array<[string, number]>;       // [["Japanese", 17], ...]
  mapPoints?: Array<{                      // Optional
    lat: number;
    lng: number;
    label: string;
    count: number;
  }>;
}
```

### Design Decisions

- **Stacked bars ship by default** (no map dependency)
- **Map is optional** — only show if sufficient lat/lng coverage
- **Max 6-8 neighborhoods** (avoid visual clutter)
- **Cuisine chips are personality** — highlight top 3-4

---

## Beat 4: Rituals

**Purpose**: Surface self-investment. "This is how you showed up for yourself."

### Layout

```
┌────────────────────────────────────────────────────────────┐
│  ○ ○ ○ ● ○ ○ ○                                             │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Your rituals                                        │  │
│  │  How you showed up for yourself                      │  │
│  │                                                      │  │
│  │  Therapy     █████████████████████████████████████ 15│  │
│  │  Yoga        ████████████████████████████████     13 │  │
│  │  Climbing    █████████████████                     7 │  │
│  │  Pilates     ████████████                          5 │  │
│  │                                                      │  │
│  │  You showed up for yourself 40 times.                │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### Element Specifications

| Element | Spec |
|---------|------|
| **Heading** | "Your rituals", 24px, `--text-primary` |
| **Subheading** | "How you showed up for yourself", 15px, `--text-secondary` |
| **Bar rows** | Same spec as Places beat |
| **Summary line** | "You showed up for yourself X times", 15px, `--text-secondary` |

### Categories to Surface

Activities classified as "self-care" by LLM:
- Therapy / Counseling
- Yoga / Pilates / Gym / Fitness
- Meditation / Mindfulness
- Doctor / Dentist / Medical
- Haircut / Spa / Self-care
- Learning / Classes / Lessons

### Data Requirements

```typescript
interface RitualsData {
  activities: Array<{
    name: string;       // "Therapy"
    count: number;      // 15
    venue?: string;     // "Greenpoint Psychotherapy"
  }>;
  totalSelfCare: number; // 40
}
```

### Design Decisions

- **Positive framing** — "showed up for yourself" not "self-care sessions"
- **Max 5 activities** — more feels like a to-do list
- **Venue is optional** — only show if consistent (same place every time)
- **Empty state**: If no self-care detected, skip this beat entirely

---

## Beat 5: Patterns

**Purpose**: Surprise and delight. "Here's what you didn't notice."

### Layout

```
┌────────────────────────────────────────────────────────────┐
│  ○ ○ ○ ○ ● ○ ○                                             │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Things you might not have noticed                   │  │
│  │                                                      │  │
│  │  ┌────┐  You and Beth had 12 consecutive Saturdays   │  │
│  │  │ 🔥 │  together. That's not coincidence.           │  │
│  │  └────┘  That's intention.                           │  │
│  │                                                      │  │
│  │  ┌────┐  Thursday 6pm was always therapy.            │  │
│  │  │ 🕐 │  You never missed.                           │  │
│  │  └────┘  15 sessions, all in Greenpoint.             │  │
│  │                                                      │  │
│  │  ┌────┐  In January you were a Midtown person.       │  │
│  │  │ 📍 │  By December, you were Brooklyn.             │  │
│  │  └────┘  Williamsburg 30x vs Midtown 12x.            │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### Element Specifications

| Element | Spec |
|---------|------|
| **Heading** | "Things you might not have noticed", 24px, `--text-primary` |
| **Pattern row** | Grid: icon (32px) + content |
| **Icon container** | 32px square, 10px radius, cyan bg at 15%, subtle border |
| **Pattern text** | 16px, `--text-primary`, the insight |
| **Pattern meta** | 14px, `--text-secondary`, supporting data |

### Pattern Types

| Type | Icon | Example |
|------|------|---------|
| Streak | 🔥 | "12 consecutive Saturdays with Beth" |
| Time slot | 🕐 | "Thursday 6pm was always therapy" |
| Location shift | 📍 | "January = Midtown, December = Brooklyn" |
| Outlier day | 📅 | "June 14th: 12 events. What happened?" |
| Busiest period | 📊 | "November was your busiest month" |

### Data Requirements

```typescript
interface Pattern {
  icon: string;        // Emoji
  title: string;       // Main insight text
  detail: string;      // Supporting context
}

interface PatternsData {
  patterns: Pattern[]; // Max 3-4
}
```

### Design Decisions

- **Max 3 patterns** — quality over quantity
- **LLM-generated** — but grounded in data
- **No generic insights** — every pattern must have specific data
- **This is THE screenshot beat** — optimize for shareability

---

## Beat 6: Narrative

**Purpose**: Synthesis. "Here's your year as a story."

### Layout

```
┌────────────────────────────────────────────────────────────┐
│  ○ ○ ○ ○ ○ ● ○                                             │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Your story                                          │  │
│  │                                                      │  │
│  │  "2025 was the year you became a regular.            │  │
│  │                                                      │  │
│  │   At Vital for Sunday yoga. At Greenpoint for        │  │
│  │   Thursday therapy. At Cho Dang Gol whenever         │  │
│  │   Masha texted.                                      │  │
│  │                                                      │  │
│  │   Your Saturdays belonged to Beth—12 of them,        │  │
│  │   from winter through fall. That's not coincidence.  │  │
│  │   That's a friendship you chose, over and over.      │  │
│  │                                                      │  │
│  │   You spent 1,807 hours in motion. Some of it work.  │  │
│  │   Some of it healing. A lot of it eating Japanese    │  │
│  │   food (17 times—you might have a type).             │  │
│  │                                                      │  │
│  │   What will 2026 hold?"                              │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### Element Specifications

| Element | Spec |
|---------|------|
| **Heading** | "Your story", 24px, `--text-primary` |
| **Narrative text** | 17px, `--text-secondary`, 1.6 line-height |
| **Paragraph spacing** | 16px between paragraphs |

### Animation

- **Typewriter effect** — text appears character by character
- **Speed**: 12ms per character (adjust for length)
- **Reduced motion**: Show full text immediately
- **Cursor**: Blinking underscore during typing

### Data Requirements

```typescript
interface NarrativeData {
  narrative: string;   // 3-5 paragraphs, LLM-generated
}
```

### Narrative Guidelines (for LLM prompt)

1. **Ground every claim in data** — no vague statements
2. **Be specific** — names, places, numbers
3. **Warm but not saccharine** — "concierge with a wink"
4. **End with a question** — invite reflection
5. **3-5 paragraphs max** — don't overwrite
6. **No emojis, no hashtags** — keep it literary

---

## Beat 7: Experiments

**Purpose**: Forward momentum. "Here's what to try next."

### Layout

```
┌────────────────────────────────────────────────────────────┐
│  ○ ○ ○ ○ ○ ○ ●                                             │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  For 2026, consider:                                 │  │
│  │                                                      │  │
│  │  ┌───┐  A new neighborhood                           │  │
│  │  │ 1 │  You never ventured to the Upper West Side.   │  │
│  │  └───┘  Pick one Saturday.                           │  │
│  │                                                      │  │
│  │  ┌───┐  Brunch with Beth                             │  │
│  │  │ 2 │  All 12 hangs were dinners.                   │  │
│  │  └───┘  Try one daylight adventure.                  │  │
│  │                                                      │  │
│  │  ┌───┐  A cooking class                              │  │
│  │  │ 3 │  Seventeen Japanese meals say you love it.    │  │
│  │  └───┘  Learn to make one.                           │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              [ Start Over ]                          │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### Element Specifications

| Element | Spec |
|---------|------|
| **Heading** | "For 2026, consider:", 24px, `--text-primary` |
| **Number badge** | 32px square, 10px radius, cyan border, cyan text |
| **Experiment title** | 16px, weight 600, `--text-primary` |
| **Experiment desc** | 15px, `--text-secondary` |
| **Start Over button** | Secondary style, full-width, clears session |

### Data Requirements

```typescript
interface Experiment {
  title: string;       // "A new neighborhood"
  description: string; // "You never ventured to..."
}

interface ExperimentsData {
  experiments: Experiment[]; // Max 3
}
```

### Design Decisions

- **Exactly 3 experiments** — manageable, memorable
- **Each grounded in data** — derived from patterns
- **Actionable and specific** — not "try something new"
- **Ends the experience** — "Start Over" clears data, returns to landing

---

## Responsive Behavior

### Desktop (> 768px)

- Container max-width: 720px
- Generous padding: 48px vertical, 24px horizontal
- Cards have hover states with lift + glow
- Progress dots at top, fixed position

### Mobile (< 768px)

- Full-width cards with 16px padding
- Year text: 64px (down from 80px)
- Bar labels: 120px (down from 140px)
- Touch-friendly: all interactive areas > 44px
- Progress dots still fixed at top

### Screenshot Optimization (390px width)

Every beat is designed to screenshot well on iPhone 14/15:
- Self-contained meaning (no context needed)
- Key info above the fold
- Contrast optimized for phone screens
- Text readable at phone resolution

---

## Accessibility

### Requirements

| Requirement | Implementation |
|-------------|----------------|
| **Reduced motion** | Disable all animations, show final states |
| **Screen readers** | Semantic HTML, ARIA labels on progress |
| **Keyboard nav** | Tab through beats, Enter to interact |
| **Color contrast** | All text meets WCAG AA on `--bg-base` |
| **Focus indicators** | Cyan outline on focusable elements |

### Semantic Structure

```html
<main>
  <nav aria-label="Progress">
    <ol class="progress-dots">...</ol>
  </nav>

  <section aria-labelledby="hero-heading">
    <h1 id="hero-heading" class="sr-only">Your 2025 Wrapped</h1>
    ...
  </section>

  <section aria-labelledby="people-heading">
    <h2 id="people-heading">The ones who showed up</h2>
    ...
  </section>

  <!-- etc -->
</main>
```

---

## Data Flow

### From Processing to Results

```javascript
// After processing completes (in landing page)
const results = await processCalendar(accessToken, lifelyToken, proxyUrl, onProgress);
sessionStorage.setItem('lifely_results', JSON.stringify(results));
window.location.href = '/results.html';

// In results page
const results = JSON.parse(sessionStorage.getItem('lifely_results'));
if (!results) {
  window.location.href = '/'; // No data, go back
}
renderResults(results);
```

### Results Object Shape

```typescript
interface LifelyResults {
  // Beat 1: Hero
  stats: {
    totalEvents: number;
    totalHours: number;
    totalPeople: number;
  };

  // Beat 2: People
  topPeople: Person[];

  // Beat 3: Places
  neighborhoods: Array<[string, number]>;
  cuisines: Array<[string, number]>;
  mapPoints?: MapPoint[];

  // Beat 4: Rituals
  rituals: Activity[];
  totalSelfCare: number;

  // Beat 5: Patterns
  patterns: Pattern[];

  // Beat 6: Narrative
  narrative: string;

  // Beat 7: Experiments
  experiments: Experiment[];
}
```

---

## Empty States

### No People Data

If `topPeople` is empty (all events are solo):
- Skip Beat 2 entirely
- Adjust progress dots to 6

### No Location Data

If `neighborhoods` is empty:
- Show "No location data available"
- Hide cuisine chips
- Skip map

### No Rituals

If `rituals` is empty:
- Skip Beat 4 entirely
- Adjust progress dots to 6

### Fallback Narrative

If LLM fails to generate narrative:
- Show stats-based fallback: "In 2025, you had {X} events across {Y} places..."

---

## Performance

### Targets

| Metric | Target |
|--------|--------|
| First paint | < 200ms |
| Interactive | < 500ms |
| Animation FPS | 60fps |
| Bundle size | < 100KB (gzipped, with React + shadcn) |

### Optimizations

- No external API calls (all data in sessionStorage)
- CSS animations (GPU accelerated)
- Intersection Observer for scroll-triggered animations
- Lazy render beats below fold

---

## State Machine

```
LOADING → READY
READY → [scroll] → BEAT_1 → BEAT_2 → ... → BEAT_7 → COMPLETE
COMPLETE → [click "Start Over"] → CLEARED → redirect to /
```

### States

| State | Behavior |
|-------|----------|
| `LOADING` | Check sessionStorage for results |
| `READY` | Render all beats, trigger Beat 1 animations |
| `BEAT_N` | Update progress dots, trigger beat animations |
| `COMPLETE` | All beats viewed, show "Start Over" |
| `CLEARED` | Clear sessionStorage, redirect |

---

## File Structure (Post-Migration)

```
lifely-web/src/
├── components/
│   ├── ui/                    # shadcn components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   └── progress.tsx
│   ├── progress-dots.tsx      # Custom
│   ├── sparkbar.tsx           # Custom
│   ├── bar-row.tsx            # Custom
│   ├── person-card.tsx        # Custom
│   ├── pattern-item.tsx       # Custom
│   └── experiment-item.tsx    # Custom
├── beats/
│   ├── hero.tsx
│   ├── people.tsx
│   ├── places.tsx
│   ├── rituals.tsx
│   ├── patterns.tsx
│   ├── narrative.tsx
│   └── experiments.tsx
├── hooks/
│   ├── use-results.ts         # Load from sessionStorage
│   ├── use-scroll-progress.ts # Track current beat
│   └── use-count-up.ts        # Animated numbers
├── lib/
│   ├── types.ts               # TypeScript interfaces
│   └── utils.ts               # cn(), formatNumber(), etc.
├── pages/
│   ├── landing.tsx
│   └── results.tsx
├── App.tsx
└── main.tsx
```

---

## Metrics to Track

| Event | Purpose |
|-------|---------|
| `results_viewed` | How many complete the flow |
| `beat_viewed_N` | Which beats get engagement |
| `time_on_beat_N` | How long users spend per beat |
| `start_over_clicked` | Re-engagement rate |
| `session_duration` | Total time in results |

All via Cloudflare Analytics (no PII, no cookies).
