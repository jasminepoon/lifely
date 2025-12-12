# Lifely Hosted App — Technical Plan

> **Goal**: Let friends run their 2025 Wrapped once, without you ever seeing their calendar data.

**Domain**: `lifely.thirdplane.io`

---

## User Journey

```
┌──────────────────────────────────────────────────────────────────┐
│  1. Friend receives link                                          │
│     https://lifely.thirdplane.io?token=abc123                    │
│                                                                   │
│  2. Lands on dark, Flighty-styled page                           │
│     "Your 2025, Wrapped" — [Connect Google Calendar]              │
│                                                                   │
│  3. OAuth popup → grants calendar.events.readonly                 │
│                                                                   │
│  4. Loading screen with progress dots                             │
│     "Fetching events..." → "Crunching numbers..." → "Writing..."  │
│                                                                   │
│  5. Storyboard reveals: Hero → Stats → People → Places → Story   │
│                                                                   │
│  6. Optional: Download as image / Share link (future)            │
└──────────────────────────────────────────────────────────────────┘
```

---

## Privacy Architecture

**The core constraint**: Calendar data never touches your server.

```
┌─────────────────┐         ┌─────────────────┐
│  Friend's       │◄───────►│  Google         │
│  Browser        │  OAuth  │  Calendar API   │
│                 │  +data  │                 │
└────────┬────────┘         └─────────────────┘
         │
         │ Only sends:
         │ • Event summaries ("Dinner with X")
         │ • Locations ("123 Main St")
         │ • Token for auth
         │
         ▼
┌─────────────────┐         ┌─────────────────┐
│  LLM Proxy      │────────►│  OpenAI         │
│  (your server)  │  API    │                 │
└─────────────────┘  key    └─────────────────┘
```

**What you (the owner) can see**:
- Token usage logs (which token, when, how many LLM calls)
- Aggregate OpenAI costs

**What you cannot see**:
- Friend's calendar events
- Attendee names/emails
- LLM responses (processed client-side)

---

## Technical Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Frontend** | Vite + React | Already implemented in `lifely-web-react/`; easy to iterate on beats |
| **Hosting** | Cloudflare Pages | Free, fast, easy DNS for subdomain |
| **OAuth** | Google Identity Services (PKCE) | Client-side only, no server token handling |
| **LLM Proxy** | Cloudflare Worker | Edge, stateless, ~50 lines |
| **Token Store** | Cloudflare KV | Simple key-value, free tier sufficient |
| **Domain** | lifely.thirdplane.io | CNAME to Cloudflare |

---

## Component Breakdown

### 1. Landing Page (`/`)

```
┌────────────────────────────────────────┐
│                                        │
│            2025 WRAPPED                │
│                                        │
│     Your year, visualized.             │
│                                        │
│     ┌──────────────────────────┐       │
│     │ Connect Google Calendar  │       │
│     └──────────────────────────┘       │
│                                        │
│     One-time access. Your data         │
│     never leaves your browser.         │
│                                        │
└────────────────────────────────────────┘
```

- Validates token from URL param before showing button
- Invalid/expired token → "This link has expired" message
- Dark theme matching spikes

### 2. OAuth Flow (Client-Side PKCE)

```javascript
// No server involvement — token stays in browser
const client = google.accounts.oauth2.initTokenClient({
  client_id: 'YOUR_CLIENT_ID',
  scope: 'https://www.googleapis.com/auth/calendar.events.readonly',
  callback: (response) => {
    // Access token is here, never sent to our server
    fetchCalendarEvents(response.access_token);
  },
});
```

**Scopes requested**: `calendar.events.readonly` (minimum needed)

### 3. Calendar Fetch + Stats (Client-Side)

Use the existing TypeScript stats pipeline from `lifely-web-react/src/lib/stats/` (already a port of the Python flow):

```javascript
// Runs entirely in browser
async function processCalendar(accessToken) {
  // 1. Fetch events from Google (browser → Google, direct)
  const events = await fetchGoogleCalendarEvents(accessToken, 2025);

  // 2. Normalize events (same logic as Python)
  const normalized = normalizeEvents(events);

  // 3. Compute stats (time, friends, locations)
  const stats = computeStats(normalized);

  // 4. Prepare LLM payloads (anonymized summaries only)
  const locationPayload = buildLocationPrompt(normalized);
  const classificationPayload = buildClassificationPrompt(normalized);

  return { normalized, stats, locationPayload, classificationPayload };
}
```

**Status**: Implemented in React app; needs production hardening (proxy + rate limits).

### 4. LLM Proxy (Cloudflare Worker)

```javascript
// workers/llm-proxy/src/index.ts (~100 lines)
export default {
  async fetch(request, env) {
    // 1. Validate origin
    const origin = request.headers.get('Origin');
    if (!origin?.includes('lifely.thirdplane.io')) {
      return new Response('Forbidden', { status: 403 });
    }

    // 2. Extract and validate token
    const { token, prompt, model } = await request.json();
    const tokenData = await env.TOKENS.get(token, 'json');

    if (!tokenData || tokenData.uses_remaining <= 0) {
      return new Response('Invalid or expired token', { status: 401 });
    }

    // 3. Decrement uses
    tokenData.uses_remaining--;
    await env.TOKENS.put(token, JSON.stringify(tokenData));

    // 4. Proxy to OpenAI (GPT-5 Responses API)
    const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'gpt-5.2',
        input: prompt,
        reasoning: { effort: 'low' },
        text: { verbosity: 'low' },
        max_output_tokens: 2000,
      }),
    });

    // 5. Return response (client extracts from output[].content[].text)
    return new Response(openaiResponse.body, {
      headers: { 'Access-Control-Allow-Origin': origin },
    });
  }
};
```

**Rate limits**: Models are currently capped at ~3 RPM. The client should pack larger batches and keep request count low. The proxy should enforce per-token usage limits and return clear 429/401 errors (no silent failures).

**Caching**: To preserve the “owner can’t see calendar data” constraint, caching is best done client-side (localStorage) rather than in the worker.

### 5. Token Management

**Token schema** (stored in KV):
```json
{
  "id": "abc123",
  "label": "Beth's token",
  "uses_remaining": 3,
  "created_at": "2025-12-10T00:00:00Z",
  "expires_at": "2025-12-31T23:59:59Z"
}
```

**Admin CLI** (or just `wrangler kv` commands):
```bash
# Create token
lifely-admin token create --label "Beth" --uses 5

# List tokens
lifely-admin token list

# Revoke token
lifely-admin token revoke abc123
```

For MVP: Just use `wrangler kv:key put` directly.

### 6. Results Rendering

Reuse the existing React beats (Hero, People, Places, Rituals, Patterns, Narrative, Experiments). The “storyboard” experience is already implemented with horizontal scroll + snap, progress dots, and screenshot-friendly cards.

---

## Security Considerations

| Risk | Mitigation |
|------|------------|
| Token in URL | Short-lived tokens (7 days), single-use by default |
| Token leakage | Move to httpOnly cookie after first load (stretch) |
| CORS abuse | Lock proxy to `lifely.thirdplane.io` origin only |
| Rate limiting | 3 runs per token (each run = location + classification + narrative + patterns + experiments) |
| OAuth token theft | Stays in browser memory, not localStorage |

---

## File Structure

```
lifely/
├── lifely-web-react/               # React frontend (active)
│   ├── src/
│   │   ├── lib/
│   │   │   ├── google/             # GIS OAuth + Calendar fetch
│   │   │   └── stats/              # TS stats + LLM pipeline
│   │   ├── components/
│   │   │   ├── landing/
│   │   │   ├── results/
│   │   │   └── beats/              # 7 beats
│   │   └── hooks/
│   └── .env.example
│
├── workers/
│   └── llm-proxy/                  # Cloudflare Worker (OpenAI proxy)
│       ├── src/index.ts
│       └── wrangler.toml
│
└── planning/                       # Specs + roadmap
```

`lifely-web/` (vanilla JS) is archived and not the v1 target.

---

## Build Order

### Phase 1: Infrastructure (Day 1)
- [ ] Set up `lifely.thirdplane.io` DNS (CNAME to Cloudflare)
- [ ] Create Cloudflare Pages project
- [ ] Create Cloudflare KV namespace for tokens
- [ ] Deploy minimal "Coming Soon" page

### Phase 2: OAuth + Calendar (Day 1-2)
- [ ] Set up Google OAuth client for web (add `lifely.thirdplane.io` as origin)
- [ ] Implement client-side PKCE flow
- [ ] Fetch calendar events from browser
- [ ] Test with your own account

### Phase 3: Stats Engine (Day 2)
- [ ] Port `normalize_events()` to JS
- [ ] Port `compute_time_stats()` to JS
- [ ] Port `compute_friend_stats()` to JS
- [ ] Port location/activity aggregation to JS
- [ ] Unit test against known output

### Phase 4: LLM Proxy (Day 2-3)
- [ ] Deploy Cloudflare Worker
- [ ] Implement token validation
- [ ] Implement OpenAI proxy
- [ ] Test with curl

### Phase 5: Wire It Up (Day 3)
- [ ] Connect frontend to proxy
- [ ] Run location enrichment via proxy
- [ ] Run classification via proxy
- [ ] Run narrative/patterns/experiments via proxy

### Phase 6: Results UI (Day 3-4)
- [ ] Reuse `lifely-web-react/` storyboard beats (Hero → People → Places → Rituals → Patterns → Narrative → Experiments)
- [ ] Add token-gated entry + “Start over” behavior for hosted links
- [ ] Ensure loading/progress UX matches landing-page-spec
- [ ] Polish for screenshot shareability

### Phase 7: Token Admin (Day 4)
- [ ] Simple CLI or script to create tokens
- [ ] Test full flow with a test token

### Phase 8: Launch (Day 4-5)
- [ ] Add friends as OAuth test users
- [ ] Generate tokens
- [ ] Send links
- [ ] Monitor usage

---

## Cost Estimate

| Item | Cost |
|------|------|
| Cloudflare Pages | Free |
| Cloudflare Workers | Free (100k requests/day) |
| Cloudflare KV | Free (100k reads/day) |
| OpenAI (per friend) | Variable (model: gpt-5.2; request count must stay low due to 3 RPM) |
| Domain | Already owned |

**Total per friend**: ~$0.50 (assuming 3 runs max)

---

## Open Questions

1. **Download/Share**: Let friends download results as PNG/PDF? (Stretch goal)
2. **Multi-year**: Support 2024 as well? (Requires more token budget)
3. **Mobile**: Full mobile support or desktop-first? (Recommend: responsive, but optimize for desktop)
4. **Analytics**: Track usage with simple Cloudflare Analytics? (Privacy-preserving)

---

## Definition of Done

- [ ] Friend clicks link → sees landing page
- [ ] Clicks "Connect" → Google OAuth popup
- [ ] Grants permission → loading screen with progress
- [ ] Results render as storyboard (Hero → Stats → People → Places → Story)
- [ ] Token is consumed (can't reuse)
- [ ] Owner never sees calendar data
- [ ] Works on Chrome, Safari, Firefox (desktop)
