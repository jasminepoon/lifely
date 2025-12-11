# Lifely Experience Concept

> "Your year, rendered as a story—not a spreadsheet."

---

## Why This Exists

### The Spotify Wrapped Formula

Spotify Wrapped works because it's **narrative, not analytics**. It doesn't say "You listened to 47,000 minutes of music." It says "You were in the top 0.5% of Taylor Swift listeners. That's... a lot of feelings."

The magic ingredients:
1. **Identity** — Music taste = personality. Sharing Wrapped is saying "this is who I am"
2. **Surprise** — "Wait, I listened to THAT song 247 times?"
3. **Scarcity** — Once a year. A ritual, not a dashboard
4. **Shareability** — Every screen designed for screenshots
5. **Positive framing** — They never say "your taste got worse"

### What Calendar Data Means

Your calendar isn't consumption. It's **commitment**. Every event is something you chose (or had to) show up for. That's more intimate than a playlist.

| Music | Calendar |
|-------|----------|
| "I have taste" | "This is my actual life" |
| Passive consumption | Active commitment |
| Who you follow | Who you make time for |
| Interests | Actions |
| Entertainment | Existence |

Your calendar reveals:
- **Who you prioritize** — not followers, but who you actually see
- **What you invest in** — therapy, yoga, learning (actions, not interests)
- **Where you exist** — your physical footprint in the city
- **How you structure time** — the shape of your days and weeks

This is heavier than music. It's your finite time, rendered as data.

---

## The Emotional Landscape

When someone sees their Lifely, they might feel:

| Data Point | Positive Frame | Uncomfortable Truth |
|------------|----------------|---------------------|
| "Beth: 12 events" | "I have a real friendship" | "Is this my only close friend?" |
| "Yoga: 17 sessions" | "I kept my practice" | "I stopped after September" |
| "Williamsburg: 30 visits" | "I have a neighborhood" | "I never leave my bubble" |
| "November: 89 events" | "I was productive" | "I was drowning" |

### The Design Principle: Honest but Kind

Show the data without editorializing. "November was your busiest month" is neutral. The user brings their own meaning.

Frame warmly, not judgmentally:
- Not "You only saw 3 people" → "Your inner circle was tight this year"
- Not "You barely exercised" → Show what they DID do, let absence speak for itself

---

## The User Journey

### Phase 1: The Command

```bash
$ uv run lifely --enrich --year 2025
```

Minimal. No config wizard. No 20 questions. Just run it.

**What the user sees:**
```
🗓  Pulling your year from Google...     ✓ 392 events
🧠  Teaching GPT about your life...      ✓ 48 friends discovered
📍  Mapping your footprint...            ✓ 14 neighborhoods
✨  Generating your Wrapped...           ✓

→ Opening in browser...
```

**What happens:**
1. OAuth popup (first run only)
2. Calendar fetch + LLM enrichment (parallel, ~60s)
3. HTML generation with embedded data
4. Auto-open in default browser

### Phase 2: The Reveal

The browser experience is **not a dashboard you analyze**. It's **a story you watch unfold**.

---

## The Beat Sequence

### Beat 1: The Year
**Duration:** 0-2s | **Emotion:** Anticipation

- Screen is dark (navy, not black)
- "2025" fades in, huge, centered
- Subtitle types out letter by letter: "Your year in 392 moments"
- Subtle gradient pulses behind the number

```
                         2025
                Your year in 392 moments
```

### Beat 2: The Numbers
**Duration:** 2-5s | **Emotion:** Scale

Three stats count up from zero, staggered 300ms apart:

```
         392              1,807            48
        events            hours          people
```

These are your year's vital signs. Big, bold, undeniable.

### Beat 3: Your People
**Trigger:** Scroll/tap | **Emotion:** Recognition

The emotional core. Not "top attendees by meeting count" but "the ones who showed up."

```
┌─────────────────────────────────────────────────────────────┐
│  The ones who showed up                                     │
│                                                             │
│  ┌────┐  Beth                                              │
│  │ B  │  12 moments · 28 hours                             │
│  └────┘  Kaoru, Mitr Thai, Twin Tails                      │
│          Midtown, Greenwich Village                         │
│          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 100%       │
│                                                             │
│  ┌────┐  Masha                                             │
│  │ M  │  10 moments · 22 hours                             │
│  └────┘  Cho Dang Gol, AMC 34th Street                     │
│          FiDi, East Village                                 │
│          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 83%          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**The insight:** "Beth" isn't just a name. It's 12 Saturdays. It's a pattern. It's intention.

### Beat 4: Your Places
**Trigger:** Scroll/tap | **Emotion:** Identity

Not addresses. A **footprint**.

```
┌─────────────────────────────────────────────────────────────┐
│  Your NYC                                                   │
│                                                             │
│       [Dark map with glowing neighborhood hotspots]         │
│                                                             │
│  Williamsburg   ████████████████████████████████████  30   │
│  Greenpoint     █████████████████████████████         19   │
│  Midtown        ██████████████████                    10   │
│                                                             │
│  🍜 Japanese 17   🍚 Korean 8   🍔 American 8   🌮 Mexican 5 │
│                                                             │
│  166 places. 14 cuisines. 1 city you love.                 │
└─────────────────────────────────────────────────────────────┘
```

### Beat 5: Your Rituals
**Trigger:** Scroll/tap | **Emotion:** Pride

The recurring patterns. The investments in yourself.

```
┌─────────────────────────────────────────────────────────────┐
│  Your Rituals                                               │
│                                                             │
│  YOGA                                                       │
│  17 sessions @ Vital                                        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  THERAPY                                                    │
│  15 sessions @ Greenpoint Psychotherapy                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━     │
│                                                             │
│  CLIMBING                                                   │
│  5 sessions @ Brooklyn Boulders                             │
│  ━━━━━━━━━━━━━━━━━━━━━━                                     │
│                                                             │
│  You showed up for yourself 37 times.                       │
└─────────────────────────────────────────────────────────────┘
```

This surfaces **self-care and growth** events that get lost in the noise of social calendars.

### Beat 6: The Patterns
**Trigger:** Scroll/tap | **Emotion:** Surprise

The insights you didn't know about your own life.

```
┌─────────────────────────────────────────────────────────────┐
│  Things you might not have noticed                          │
│                                                             │
│  🔥  You and Beth had 12 consecutive Saturdays together.    │
│      That's not coincidence. That's intention.              │
│                                                             │
│  📅  November was your busiest month: 89 events.            │
│      (December was your calmest: 28)                        │
│                                                             │
│  🕐  Thursday 6pm was always therapy. You never missed.     │
│                                                             │
│  📍  In January you were a Midtown person.                  │
│      By December, you'd become a Brooklyn person.           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**This is the screenshot.** The "how did it KNOW?" moment.

### Beat 7: The Story
**Trigger:** Scroll/tap | **Emotion:** Reflection

LLM-generated narrative. 3-4 paragraphs. Data-grounded. Slightly witty.

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  "2025 was the year you became a regular.                   │
│                                                             │
│   At Vital for Sunday yoga. At Greenpoint for Thursday      │
│   therapy. At Cho Dang Gol whenever Masha texted.           │
│                                                             │
│   Your Saturdays belonged to Beth—12 of them, from          │
│   winter through fall. That's not coincidence. That's       │
│   a friendship you chose, over and over.                    │
│                                                             │
│   You spent 1,807 hours in motion. Some of it work.         │
│   Some of it healing. A lot of it eating Japanese food      │
│   (17 times—you might have a type).                         │
│                                                             │
│   What will 2026 hold?"                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Beat 8: The Experiments
**Trigger:** Scroll/tap | **Emotion:** Inspiration

Forward-looking suggestions based on patterns.

```
┌─────────────────────────────────────────────────────────────┐
│  For 2026, consider:                                        │
│                                                             │
│  1. A new neighborhood?                                     │
│     You've never been to the Upper West Side.               │
│                                                             │
│  2. Brunch with Beth?                                       │
│     Your 12 hangs were all dinners.                         │
│                                                             │
│  3. A cooking class?                                        │
│     17 Japanese meals says you love it—maybe learn to       │
│     make it.                                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## The Emotional Arc

```
Surprise → Recognition → Reflection → Pride → Inspiration
    ↑           ↑            ↑          ↑          ↑
 Numbers     People       Places     Rituals    Story
```

This is the Wrapped formula: start with scale, move to specifics, end with forward-looking prompts.

---

## What Makes This Special

### 1. The Insight You Didn't Know

Spotify's magic moment: "Wait, I listened to that song 247 times?"

Lifely equivalents:
- **The streak** — "You and Beth had 12 consecutive Saturdays together"
- **The ritual** — "Thursday 6pm was always therapy. You never missed."
- **The evolution** — "In January you were a Midtown person. By December, Brooklyn."
- **The outlier** — "June 14th: 12 events in one day. What happened?"

These are things you *lived* but never noticed. The data surfaces the pattern you couldn't see.

### 2. Two Kinds of Friends

Your calendar has:
- **Email friends** — People who send calendar invites (colleagues, formal)
- **Inferred friends** — Names in event titles ("Dinner with Masha")

The second category is more interesting. These are the people you text, not email. The informal relationships that define your actual social life.

When Lifely surfaces "Masha: 10 events, mostly Korean food in the East Village"—that's a relationship rendered as data. That's screenshot-worthy.

### 3. The Self You Chose

The rituals section isn't "you went to the gym." It's:

> "You showed up for yourself 37 times. These weren't obligations. These were choices."

Reframing self-care as **agency**. You didn't just have a calendar. You built a life.

---

## What This Is NOT

### Not a Dashboard
No filters. No date pickers. No "drill down." You don't analyze your Wrapped—you experience it.

### Not Comprehensive
We show highlights, not the full dataset. The JSON has everything; the UI has the story.

### Not Real-Time
This is a retrospective. A year-end ritual. It feels special because you only see it once a year.

### Not Social (Yet)
No sharing to Twitter. No "compare with friends." Just you and your year. Shareability via screenshots for v1.

---

## Interaction Model

### Desktop
- Scroll to advance between beats
- Progress indicator at top (subtle dots or line)
- Numbers animate on scroll-into-view
- Hover states on people/places for detail

### Mobile
- Tap or swipe to advance
- Full-screen cards (screenshot-optimized)
- Same progress indicator
- Touch-friendly chip sizes (44px min)

### Auto-Advance
- Beats 1-2 (Year, Numbers) auto-play on load
- Beat 3+ (People, Places, etc.) require scroll/tap
- `prefers-reduced-motion` disables all auto-animation

---

## Technical Approach

### Output: Single HTML File
- All data embedded as JSON in `<script>` tag
- No server required
- Works offline after generation
- Easy to archive ("my 2025 wrapped")

### Animation Strategy
- CSS animations + Intersection Observer
- No heavy JS frameworks (vanilla JS or Alpine.js)
- Respect `prefers-reduced-motion`
- Target 60fps on mobile

### Screenshot Optimization
- Cards sized for phone screenshots (~390px wide)
- Important text readable at phone resolution
- Self-contained cards (make sense without context)
- Colors pop on phone screens (slightly saturated)

---

## Success Metrics

How do we know this worked?

1. **The Screenshot Test**
   Would someone screenshot this and text it to a friend?

2. **The "Huh" Test**
   Does it surface something the user didn't know about their own year?

3. **The Return Test**
   Would someone run this again next December?

4. **The Share Test**
   Would someone post a screenshot to Instagram Stories?

---

## Decisions Made

| Question | Decision | Rationale |
|----------|----------|-----------|
| Auto-advance vs scroll? | Hybrid (auto for hero, scroll for rest) | Hero sets the mood; user controls depth |
| Music/audio? | No | Too gimmicky. Let visuals speak. |
| Multiple years? | Future (v2) | Keep v1 focused on single year |
| Export to PDF? | No | Screenshot-optimized layout is enough |
| Dashboard filters? | No | This is a story, not analytics |
| Navy vs true black? | Navy | Warmer, more personal, less harsh |
| Framework? | Vanilla JS + CSS | No build step, fast, simple |

---

## References

- **[Spotify Wrapped](https://spotify.com/wrapped)** — The gold standard for retrospective storytelling
- **[Flighty](https://flighty.com)** — Premium data density, dark-first design, aviation-grade polish
- **[GitHub Contributions](https://github.com)** — Calendar heatmap as identity
- **[Apple Fitness Year in Review](https://apple.com)** — Activity rings as personal narrative
- **[Strava Year in Sport](https://strava.com)** — Athletic data as story
