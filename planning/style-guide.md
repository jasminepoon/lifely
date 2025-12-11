# Lifely Design System

> "Flighty, but for your life" — polished, kinetic, and personal.

---

## Design Direction: Storyboard

**We chose the Storyboard approach**: vertical scroll, progressive reveal, card-based beats. This matches the "Wrapped" mental model users expect while allowing our calendar data to shine.

**Borrowed from Flight Deck**: glass cards, sparkbars, premium density, the "boarding pass" hero aesthetic.

**Deferred**: Compass (radial UI) — too risky for v1, save for future exploration.

**Beat flow (v1)**  
1) Hero/Year + quick stats (auto count-up)  
2) People card(s) with sparkbars + venues/hood chips  
3) Places card with map heat (or stacked bars) + cuisine chips  
4) Rituals/Activities bar card  
5) Patterns/streaks insight list  
6) Narrative card (LLM story)  
7) Experiments card (numbered CTAs)

---

## Color System

### Core Palette

```css
:root {
  /* Backgrounds */
  --bg-base: #0A0F1A;           /* Deep navy, not black */
  --bg-surface: #141B2D;        /* Card backgrounds */
  --bg-elevated: #1C2438;       /* Hover states, modals */

  /* Borders */
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-default: rgba(255, 255, 255, 0.10);
  --border-accent: rgba(0, 212, 255, 0.30);

  /* Text */
  --text-primary: #F8FAFC;      /* Headlines, important */
  --text-secondary: #94A3B8;    /* Body text */
  --text-muted: #64748B;        /* Labels, captions */

  /* Accents */
  --accent-cyan: #00D4FF;       /* Primary accent, numbers */
  --accent-magenta: #FF3D71;    /* Highlights, alerts */
  --accent-teal: #00C9A7;       /* Success, positive */
  --accent-amber: #FFB800;      /* Warnings, attention */

  /* Gradients */
  --gradient-hero: linear-gradient(135deg, #0A0F1A 0%, #1A1F35 50%, #0F1629 100%);
  --gradient-accent: linear-gradient(135deg, #00D4FF 0%, #00C9A7 100%);
  --gradient-warm: linear-gradient(135deg, #FF3D71 0%, #FFB800 100%);

  /* Glows */
  --glow-cyan: 0 0 20px rgba(0, 212, 255, 0.15);
  --glow-magenta: 0 0 20px rgba(255, 61, 113, 0.15);
}
```

### Dark Mode Only

This is a dark-first product. No light mode. The navy background is intentional:
- Warmer than pure black (#0A0A0A)
- More sophisticated than gray (#1A1A1A)
- OLED-friendly but not harsh
- Personal and cozy, not clinical

---

## Typography

### Font Stack

```css
:root {
  /* Display — bold, geometric, for headlines */
  --font-display: 'Space Grotesk', 'SF Pro Display', system-ui, sans-serif;

  /* Body — clean, readable, for content */
  --font-body: 'Satoshi', 'Inter', -apple-system, sans-serif;

  /* Mono — for numbers, data, stats */
  --font-mono: 'SF Mono', 'JetBrains Mono', 'Fira Code', monospace;
}
```

### Type Scale

```css
/* Headlines */
.text-hero    { font-size: 4.5rem; line-height: 1.0; font-weight: 700; }  /* Year number */
.text-title   { font-size: 2rem;   line-height: 1.2; font-weight: 600; }  /* Section titles */
.text-heading { font-size: 1.25rem; line-height: 1.3; font-weight: 600; } /* Card headers */

/* Body */
.text-body    { font-size: 1rem;   line-height: 1.5; font-weight: 400; }  /* Paragraphs */
.text-small   { font-size: 0.875rem; line-height: 1.4; font-weight: 400; } /* Labels */
.text-caption { font-size: 0.75rem; line-height: 1.3; font-weight: 500; }  /* Chips, tags */

/* Numbers */
.text-stat    { font-size: 3rem;   line-height: 1.0; font-weight: 700; font-variant-numeric: tabular-nums; }
.text-number  { font-size: 1.5rem; line-height: 1.2; font-weight: 600; font-variant-numeric: tabular-nums; }
```

### Rules

- **Tabular numerals** for all stats (numbers align vertically)
- **No weight yoyoing** — keep consistent weights within sections
- **Tight leading** on headlines, comfortable on body
- **Display font** for impact, **body font** for readability

---

## Components

### Cards

```css
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  padding: 24px;

  /* Subtle glass effect */
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.card:hover {
  border-color: var(--border-default);
  box-shadow: var(--glow-cyan);
  transform: translateY(-2px);
  transition: all 200ms ease;
}
```

**Card anatomy:**
```
┌─────────────────────────────────────────┐
│  Section Title              [optional]  │  ← text-heading, text-muted
│                                         │
│  HERO ELEMENT                           │  ← Big number, name, or visual
│                                         │
│  Supporting data                        │  ← Chips, sparkbars, stats
│                                         │
│  One-liner insight                      │  ← text-small, warm tone
└─────────────────────────────────────────┘
```

### Chips / Pills

```css
.chip {
  display: inline-flex;
  padding: 4px 12px;
  border-radius: 100px;
  font-size: 0.75rem;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
}

.chip--accent {
  background: linear-gradient(135deg, rgba(0, 212, 255, 0.15), rgba(0, 201, 167, 0.15));
  border-color: var(--border-accent);
  color: var(--accent-cyan);
}

.chip--cuisine {
  /* Specific styling for cuisine chips with emoji */
}
```

### Progress Bars / Sparkbars

```css
.sparkbar {
  height: 4px;
  background: var(--bg-elevated);
  border-radius: 2px;
  overflow: hidden;
}

.sparkbar__fill {
  height: 100%;
  background: var(--gradient-accent);
  border-radius: 2px;
  transition: width 600ms ease-out;
}
```

### Avatars

```css
.avatar {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);

  /* Gradient background based on letter */
  background: var(--gradient-accent);
}

.avatar--large {
  width: 64px;
  height: 64px;
  font-size: 1.5rem;
}
```

---

## Layout

### Beat Structure

Each "beat" is a full-height section:

```css
.beat {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 48px 24px;
}

@media (max-width: 640px) {
  .beat {
    min-height: auto;
    padding: 32px 16px;
  }
}
```

### Container

```css
.container {
  max-width: 640px;  /* Optimized for mobile screenshots */
  margin: 0 auto;
  width: 100%;
}
```

### Beat Layouts

**Beat 1-2 (Hero, Numbers):** Centered, full-screen
```
┌─────────────────────────────────────┐
│                                     │
│              2025                   │
│     Your year in 392 moments        │
│                                     │
└─────────────────────────────────────┘
```

**Beat 3-5 (People, Places, Rituals):** Card stack
```
┌─────────────────────────────────────┐
│  The ones who showed up             │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Avatar  Name  Stats         │   │
│  │         Venues              │   │
│  │         ━━━━━━━━━━━━        │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ ...                         │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

**Beat 6-8 (Patterns, Story, Experiments):** Single card, text-focused
```
┌─────────────────────────────────────┐
│                                     │
│  "2025 was the year you became     │
│   a regular..."                     │
│                                     │
│   [Prose content]                   │
│                                     │
└─────────────────────────────────────┘
```

---

## Animation

### Principles

1. **Purpose over decoration** — Animation should convey information, not just look cool
2. **Staggered reveals** — Lists animate in sequence, not all at once
3. **Quick but not instant** — 150-250ms for micro-interactions, 400-600ms for reveals
4. **Respect preferences** — Honor `prefers-reduced-motion`

### Timing Functions

```css
:root {
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);      /* Fast start, smooth end */
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);  /* Smooth both ends */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* Overshoot, settle */
}
```

### Key Animations

**Number count-up:**
```css
@keyframes countUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
```

**Card reveal:**
```css
@keyframes slideUp {
  from { opacity: 0; transform: translateY(40px); }
  to { opacity: 1; transform: translateY(0); }
}

.card { animation: slideUp 500ms var(--ease-out) both; }
.card:nth-child(1) { animation-delay: 0ms; }
.card:nth-child(2) { animation-delay: 100ms; }
.card:nth-child(3) { animation-delay: 200ms; }
```

**Sparkbar fill:**
```css
@keyframes fillBar {
  from { width: 0; }
}

.sparkbar__fill {
  animation: fillBar 600ms var(--ease-out) both;
}
```

**Reduced motion:**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Interaction States

### Hover

```css
.interactive:hover {
  border-color: var(--border-default);
  box-shadow: var(--glow-cyan);
  transform: translateY(-2px);
  transition: all 200ms var(--ease-out);
}
```

### Focus

```css
.interactive:focus-visible {
  outline: 2px solid var(--accent-cyan);
  outline-offset: 2px;
}
```

### Active

```css
.interactive:active {
  transform: translateY(0);
  transition: transform 50ms;
}
```

---

## Responsive Breakpoints

```css
/* Mobile first */
@media (min-width: 480px)  { /* Small phones → large phones */ }
@media (min-width: 640px)  { /* Phones → small tablets */ }
@media (min-width: 768px)  { /* Tablets */ }
@media (min-width: 1024px) { /* Tablets → desktop */ }
```

### Mobile Considerations

- Touch targets: minimum 44px
- Cards: full-width with 16px padding
- Screenshots: 390px wide (iPhone 14 Pro)
- Chips: horizontal scroll if overflow
- Interaction: scroll-first; sticky quick-stats after hero; progress dots at top
- Respect `prefers-reduced-motion`: disable auto-play

---

## Decisions (Locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Places viz | **Stacked bars** | No lat/lng; bars work now, look clean |
| Progress indicator | **Dots** | Discrete beats, story-like feel |
| Sticky banner | **Yes, after hero** | Context without clutter |
| Build approach | **Spike-first** | Test each beat in isolation |
| Data payload | **< 50KB** | Top 10 only, strip raw events |
| Motion | **150-250ms micro, 400-600ms reveals** | Quick but not jarring |

## Build Order (Spikes)

1. Hero count-up (year + 3 stats)
2. People sparkbar cards
3. Places stacked bars + cuisine chips
4. Rituals bar chart
5. Patterns insight list
6. Narrative card
7. Experiments CTA list

Each spike: standalone HTML, hardcoded data, test in browser. Integrate after all work.

---

## Tone & Microcopy

### Voice

**Concierge with a wink** — friendly, specific, slightly witty. Never cringe.

### Examples

| Bad | Good |
|-----|------|
| "Great job!" | "You showed up 392 times." |
| "You're so popular!" | "Beth was there for 12 of them." |
| "Wow, you love food!" | "Japanese, 17 times. You might have a type." |
| "Amazing year!" | "1,807 hours in motion. What will 2026 hold?" |

### Rules

1. **Ground every quip in data** — numbers make it personal
2. **Avoid clichés** — no "crushing it" or "killing it"
3. **Be specific** — "Williamsburg" not "Brooklyn", "Cho Dang Gol" not "Korean restaurant"
4. **End with questions** — invite reflection, not just admiration

---

## Accessibility

### Contrast

- All text meets WCAG AA (4.5:1 for body, 3:1 for large text)
- Accent colors on dark backgrounds tested for readability
- Don't rely solely on color for meaning (add icons/text)

### Motion

- Respect `prefers-reduced-motion`
- No auto-playing animations that can't be paused
- Essential animations only when motion is reduced

### Focus

- Visible focus states on all interactive elements
- Logical tab order through beats
- Skip link to main content

### Screen Readers

- Semantic HTML (headings, lists, landmarks)
- Alt text for any visualizations
- ARIA labels for icon-only buttons

---

## Implementation Notes

### No Build Step

The output is a single HTML file with:
- Embedded CSS (no external stylesheet)
- Embedded JSON data
- Minimal vanilla JS (Intersection Observer, number animation)
- No framework dependencies

### File Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>2025 Wrapped | Lifely</title>
  <style>/* All CSS here */</style>
</head>
<body>
  <main>
    <section class="beat beat--hero">...</section>
    <section class="beat beat--numbers">...</section>
    <section class="beat beat--people">...</section>
    <!-- etc -->
  </main>

  <script>
    const DATA = { /* Embedded JSON */ };
    // Animation logic
  </script>
</body>
</html>
```

### Performance Budget

- Total HTML: < 200KB (including embedded data)
- First paint: < 500ms
- Interactive: < 1s
- Animation: 60fps on mobile

---

## Design Tokens Summary

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-base` | #0A0F1A | Page background |
| `--bg-surface` | #141B2D | Card backgrounds |
| `--accent-cyan` | #00D4FF | Primary accent, numbers |
| `--text-primary` | #F8FAFC | Headlines |
| `--text-secondary` | #94A3B8 | Body text |
| `--border-radius-card` | 16px | Card corners |
| `--border-radius-chip` | 100px | Pill/chip corners |
| `--spacing-card` | 24px | Card padding |
| `--font-display` | Space Grotesk | Headlines |
| `--font-body` | Satoshi | Body text |
| `--font-mono` | SF Mono | Numbers |
