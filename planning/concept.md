# Google Calendar 2025 Wrapped — Spec for Coding AI

> TL;DR: Build me a personal “Flighty, but for my life” using Google Calendar + Google Maps.

If anything in this spec is ambiguous, **search the web / official Google docs** (e.g. “Google Calendar API Python quickstart”, “Google Places API Place Details”, etc.) and adapt. Don’t guess silently.

---

## 0. High-Level Concept

I want a “**2025 Wrapped**” for my Google Calendar that:

- Analyzes all my **2025 events**.
- Tells me **which friends I saw the most** (who’s clingy; who’s ghosting me).
- Uses **location data** (including Google Maps links) to **pinpoint where I went**, e.g.  
  > “You had **35 dinners** with friends in **Lower East Side**, mostly **Thai** cuisine.”
- I’m **based in NYC**, so neighborhood-level insights and cuisine types are very welcome.
- Conceptually: think **“Flighty app”**, but for **calendar + places**, not flights.

Implementation language: assume **Python** for the backend.

For any API details, rate limits, or auth edge cases: **search the docs**.  
Useful references: Google Calendar API Python Quickstart  [oai_citation:0‡Google for Developers](https://developers.google.com/workspace/calendar/api/quickstart/python?utm_source=chatgpt.com), Google Maps / Places API docs.  [oai_citation:1‡Google for Developers](https://developers.google.com/maps/documentation/places/web-service/overview?utm_source=chatgpt.com)

---

## 1. Goals & Deliverables

### 1.1 Main deliverables

1. **Data pipeline** that:
   - Pulls all my events for **2025-01-01 → 2026-01-01** from my **primary** calendar.
   - Normalizes & enriches events (attendees, locations, durations, etc.).
   - Resolves locations using **Google Maps / Places** where possible.
   - Clusters events into:
     - People (friends / frequent collaborators).
     - Places (neighborhoods, venues, cities).
     - Context (e.g. “dinner”, “coffee”, “gym”, “flight”, etc.).
2. **Aggregated JSON summary** for 2025 with:
   - Time usage / stats.
   - Top friends.
   - Top places / neighborhoods.
   - High-level “stories” about my life patterns.
3. **LLM prompt generator**:
   - Takes the summary JSON and produces a **ready-to-paste prompt** to feed a language model.
   - The prompt should ask the model to produce a **“2025 Wrapped” narrative** + insights + suggestions.

### 1.2 Extra explicit desires

- **Friend I’ve met with the most** (and top N friends by:
  - Count of shared events.
  - Total shared hours.
- **Location stories**:
  - “Top neighborhoods” (NYC-flavored).
  - Count of events by venue / POI.
  - Category & cuisine (when it’s a restaurant / bar / cafe).
  - E.g. “Most visited restaurant: Ugly Baby, 7 visits. Cuisine: Thai.”
- **Contextual mini-stories**:
  - Dinners vs drinks vs coffee.
  - Social vs work vs other.

When unclear how to classify something, do a **best-effort heuristic**, and keep enough metadata so an LLM can refine the judgment.

---

## 2. Data Sources & APIs

### 2.1 Google Calendar API (read-only)

- Use the official **Python Quickstart** as the baseline.  [oai_citation:2‡Google for Developers](https://developers.google.com/workspace/calendar/api/quickstart/python?utm_source=chatgpt.com)  
- Use **read-only scope**:
  - `https://www.googleapis.com/auth/calendar.readonly`
- Query the **primary** calendar by default (later: allow list of calendar IDs).

**Important fields to retrieve per event**:

- `id`
- `summary`
- `description`
- `start`, `end`:
  - `dateTime` or `date` (handle both).
  - Time zone.
- `location`
- `htmlLink` (for reference, not necessarily used).
- `attendees`:
  - `email`, `displayName`, `responseStatus`.
- `organizer`
- `created`, `updated`
- `recurringEventId` & expansion (use `singleEvents=true`).

For any missing field semantics, **search** Google’s Calendar API reference.  [oai_citation:3‡endgrate.com](https://endgrate.com/blog/how-to-create-calendar-events-with-the-google-calendar-api-in-python?utm_source=chatgpt.com)

### 2.2 Google Maps / Places APIs

We need to translate event locations into:

- Venue / POI details (is it a restaurant? which cuisine?).
- Address components (neighborhood, city, country).
- Possibly lat/lng if helpful.

Assume we use **Places API Web Service** (server-side).  [oai_citation:4‡Google for Developers](https://developers.google.com/maps/documentation/places/web-service/overview?utm_source=chatgpt.com)  

We’ll likely need:

- **Text Search / Find Place**:
  - To turn raw text or a Google Maps URL into a **place_id**.
- **Place Details**:
  - To get:
    - Name.
    - Full address + structured components.
    - Types (e.g. `restaurant`, `bar`, `gym`).
    - Possibly price level, rating, etc.
- **Geocoding (optional)**:
  - To map lat/lng ↔ address when needed.

If there is any confusion about which specific Places endpoints to use, **search the Places API docs** and choose something that:
- Accepts text addresses / URLs or coordinates.
- Returns a consistent `place_id` and structured address.

---

## 3. Step-by-Step Pipeline

### 3.1 Auth & Setup

**Goal:** Standalone Python CLI that can run locally and fetch my 2025 data.

1. Use the **Google Calendar Python Quickstart** flow to set up OAuth and produce:
   - `credentials.json` (downloaded from Google Cloud console).
   - `token.json` (created automatically on first run).  [oai_citation:5‡Google for Developers](https://developers.google.com/workspace/calendar/api/quickstart/python?utm_source=chatgpt.com)
2. Build a `calendar_service` client with `google-api-python-client`.
3. Separately, configure **Google Maps Platform**:
   - Create an API key for **Places / Geocoding**.
   - Store it securely (env var like `GOOGLE_MAPS_API_KEY`).
4. If you’re unsure about the exact console steps, **search** for:
   - “Enable Google Calendar API”
   - “Enable Places API”
   - “Create API key Google Maps Platform”

### 3.2 Fetch events for 2025

Implement function:

```python
def fetch_events_for_year(calendar_service, calendar_id: str, year: int) -> list[dict]:
    # returns the raw Calendar API event objects for the whole year
```
Requirements:
	•	timeMin = f"{year}-01-01T00:00:00Z"
	•	timeMax = f"{year+1}-01-01T00:00:00Z"
	•	singleEvents = True (expand recurring).
	•	orderBy = "startTime".
	•	Handle pagination via nextPageToken until exhausted.
	•	Store result in data/raw_events_{year}.json for debugging / re-runs.

3.3 Normalize events

Create a normalization layer:
```python
@dataclass
class NormalizedEvent:
    id: str
    start: datetime
    end: datetime
    all_day: bool
    duration_minutes: float
    summary: str | None
    description: str | None
    location_raw: str | None
    attendees: list[NormalizedAttendee]
    organizer_email: str | None
    created: datetime | None
    updated: datetime | None
    # filled in later:
    place_id: str | None
    venue_name: str | None
    address: str | None
    neighborhood: str | None
    city: str | None
    country: str | None
    place_types: list[str] | None
    cuisine: str | None
    location_confidence: float | None
    inferred_context_tags: list[str] | None
```

Notes:
	•	Handle both date (all-day) and dateTime.
	•	Normalize everything into one timezone, ideally America/New_York (since I’m in NYC).
	•	If event has no timezone, fallback to calendar default; if still unclear, use America/New_York.
	•	If unclear, search around “Google Calendar event time zone behavior” for exact logic.
	•	Compute duration_minutes from end - start.

3.4 Attendees & “friends”

Define a NormalizedAttendee:
```python
@dataclass
class NormalizedAttendee:
    email: str
    display_name: str | None
    is_self: bool
    response_status: str | None
```

We need to identify “self” vs “others”:
	•	Use the Calendar API calendarList().get(calendarId='primary') or event creator/organizer or event’s attendees[].self flag when available.
	•	If there’s ambiguity, search Calendar API docs for best practice.

We’ll later aggregate per friend based on email (with some normalization / fallback to display name).

3.5 Location extraction from events

Events might have:
	•	location string (free text).
	•	description with:
	•	Google Maps URLs (e.g. https://maps.google.com/... or https://goo.gl/maps/...).
	•	Other hints like addresses.

We want a robust location extraction layer:
	1.	Extract possible location candidates:
	•	Primary candidate: location field (if not empty).
	•	Secondary candidates: any Google Maps URLs found in:
	•	location
	•	description
	•	Optionally, fallback: free-text address in description if it looks like one.
	2.	For each candidate:
	•	If it’s a Google Maps URL, parse it:
	•	Try to extract:
	•	place_id if available in parameters.
	•	Or lat/lng if present.
	•	Or fallback to using the entire URL string as a textQuery to Places/Geocoding.
	•	If it’s a plain address or name:
	•	Use Places Text Search or Geocoding to resolve to a place_id + details.
	3.	Choose a single best place per event:
	•	Prefer direct place_id from a Maps URL.
	•	Else nearest/most confident text match.
	•	Store location_confidence as a float (0–1) to reflect how sure we are.

Whenever you are unsure how to parse a particular Maps URL variation, search for “Google Maps URL parameters” and implement a robust parser.

3.6 Place details enrichment

Once we have a place_id, call Places Details to fetch structured info.

For each event with a candidate place_id:
	•	Request fields like:
	•	displayName (name).
	•	formattedAddress.
	•	addressComponents (to derive neighborhood, city, country).
	•	types.
	•	Possibly priceLevel, rating (optional).
	•	Store results in the corresponding fields on NormalizedEvent.

Important:
	•	Cache place lookups by place_id and/or by normalized key (e.g. address text) so:
	•	The same place across many events doesn’t trigger 100 queries.
	•	Respect API quotas; if needed, rate-limit or batch.

3.7 Deriving NYC neighborhoods & cuisine

We want output like:

“35 dinners with friends in Lower East Side. Cuisine: Thai.”

We need two layers:
	1.	Neighborhood / area extraction:
	•	From addressComponents, look at:
	•	sublocality, neighborhood, locality, administrative_area_level_X, etc.
	•	For NYC, attempt to map to:
	•	Common neighborhoods (Lower East Side, East Village, Williamsburg, etc.).
	•	If the built-in components aren’t clear enough:
	•	You can maintain a manual mapping from components/postcodes to neighborhoods.
	•	Or rely on address substring matching (imperfect but fine for now).
	•	When uncertain, fall back to:
	•	Borough (Manhattan, Brooklyn, etc.).
	•	Or just city-level (“New York”).
	2.	Cuisine & place type:
	•	For restaurants / bars / cafes:
	•	Use the types array from Place Details.
	•	Some types include thai_restaurant, italian_restaurant, etc.
	•	If types isn’t specific, consider:
	•	Parsing restaurant name or description for cuisine hints (e.g. “Thai”, “Sushi”).
	•	Or leaving cuisine = None.
	•	Store:
	•	place_types (raw from Places).
	•	cuisine (our best guess, or None).

Again, if the types field’s semantics are unclear, search for “Google Places types list”.

⸻

4. Aggregations & Stats

4.1 Time-based stats

Compute for 2025:
	•	Global:
	•	total_events
	•	total_hours
	•	median_event_minutes
	•	days_with_events / days_without_events
	•	By month:
	•	Events per month.
	•	Hours per month.
	•	By weekday:
	•	Events per weekday.
	•	Hours per weekday.
	•	Time buckets (by event start time, local NYC time):
	•	05:00–09:00: early_morning
	•	09:00–12:00: mid_morning
	•	12:00–17:00: afternoon
	•	17:00–21:00: evening
	•	21:00–02:00: late_night
	•	Streaks:
	•	Longest streak of consecutive days with events.
	•	Longest streak without events.

4.2 People / friends stats

We want to know:
	•	Top people by time spent together.
	•	Top people by number of shared events.
	•	Fun “Spotify Wrapped” style highlight like:
“Your #1 friend was Alice: 42 events, 63.5 hours together.”

Implementation notes:
	1.	Identify self email(s).
	2.	For each event:
	•	Identify attendees who are not self.
	•	For each such attendee:
	•	Add:
	•	events_together += 1
	•	hours_together += event_duration_hours
	3.	Aggregate by a normalized key:
	•	Prefer email (lowercased).
	•	If no email, fallback to displayName.
	4.	Compute:
	•	Top N attendees (e.g. top 10).
	•	Events that are 1:1 vs group (attendees count == 2 vs >2).

Make sure to handle:
	•	People with multiple emails (if easily detectable).
	•	Calendar entries that are clearly not “friends” (e.g. “no-reply@zoom.us” → we can blacklist or mark as “system”).

If you aren’t sure the best way to detect “self” or system emails, search for common patterns or consult Calendar API docs.

4.3 Place / location stats

We want:
	•	Top venues by number of visits and hours:
	•	E.g. “You went to ‘Ruby’s Cafe’ 9 times.”
	•	Top neighborhoods:
	•	E.g. “Lower East Side: 35 social events.”
	•	Top cities / travel:
	•	Count events by city/country (to spot trips).

Implementation:
	•	For each NormalizedEvent that has a place_id or at least city:
	•	Count:
	•	By place_id (venue).
	•	By neighborhood (if known).
	•	By city and country.
	•	Distinguish local NYC vs travel:
	•	If city (or something similar) is New York (and maybe surrounding NJ if desired), mark as local.
	•	Else mark as travel.

4.4 Context / type stats (“dinner”, “coffee”, etc.)

We want to label events roughly into context categories like:
	•	dinner
	•	drinks
	•	coffee
	•	work_meeting
	•	workshop/conference
	•	gym/health
	•	travel (flights, trains)
	•	misc_social
	•	etc.

Heuristic classification based on:
	•	Event summary / description keywords:
	•	“dinner”, “supper”, “restaurant”, etc. → dinner
	•	“drinks”, “bar”, “cocktails” → drinks
	•	“coffee”, “cafe” → coffee
	•	“flight”, “airport”, etc. → travel
	•	Place types:
	•	restaurant, bar, cafe, gym, airport, lodging, etc.
	•	Time-of-day:
	•	Evening events at restaurants → likely dinner.
	•	Morning at cafe → likely coffee.

Store one or more inferred_context_tags per event (could be multiple).

We do not need this to be perfect—just plausible enough for an LLM to riff on.

⸻

5. JSON Summary Schema (for LLM input)

Produce a compact summary JSON per year, something like:

```jsonc
{
  "year": 2025,
  "global_stats": {
    "total_events": 1234,
    "total_hours": 456.7,
    "median_event_minutes": 30,
    "days_with_events": 280,
    "days_without_events": 85
  },
  "time_stats": {
    "events_per_month": { "1": 120, "2": 98 },
    "hours_per_month": { "1": 42.5, "2": 35.0 },
    "events_per_weekday": { "Mon": 200, "Tue": 210 },
    "hours_by_time_bucket": {
      "early_morning": 30.0,
      "mid_morning": 80.0,
      "afternoon": 250.0,
      "evening": 70.0,
      "late_night": 15.0
    },
    "streaks": {
      "longest_meeting_streak_days": 21,
      "longest_free_streak_days": 7
    }
  },
  "people_stats": {
    "top_friends_by_hours": [
      { "key": "alice@example.com", "label": "Alice", "events": 42, "hours": 63.5 },
      { "key": "bob@example.com",   "label": "Bob",   "events": 30, "hours": 40.0 }
    ],
    "top_friends_by_events": [
      { "key": "bob@example.com", "label": "Bob", "events": 50, "hours": 35.0 }
    ]
  },
  "place_stats": {
    "top_venues": [
      {
        "place_id": "abc123",
        "name": "Favorite Thai Spot",
        "city": "New York",
        "neighborhood": "Lower East Side",
        "cuisine": "Thai",
        "visits": 12,
        "hours": 24.0
      }
    ],
    "top_neighborhoods": [
      {
        "neighborhood": "Lower East Side",
        "city": "New York",
        "events": 35,
        "hours": 60.0,
        "dominant_cuisines": ["Thai", "Japanese"]
      }
    ],
    "top_cities": [
      { "city": "New York", "country": "US", "events": 900, "hours": 300.0 },
      { "city": "Paris", "country": "FR", "events": 40, "hours": 30.0 }
    ]
  },
  "context_stats": {
    "events_by_tag": {
      "dinner": 80,
      "drinks": 50,
      "coffee": 40,
      "work_meeting": 500,
      "travel": 20
    },
    "hours_by_tag": {
      "dinner": 120.0,
      "drinks": 75.0,
      "coffee": 30.0,
      "work_meeting": 300.0,
      "travel": 50.0
    }
  },
  "notable": {
    "longest_event": {
      "summary": "Offsite",
      "hours": 8.0,
      "date": "2025-05-12"
    },
    "busiest_day_by_hours": {
      "date": "2025-03-18",
      "hours": 12.5,
      "events": 9
    }
  }
}
```
This is the object we’ll feed to the LLM; avoid dumping all raw events unless specifically requested.

⸻

6. Prompt Generator for 2025 Wrapped

Create a small module that takes the JSON and produces a prompt string.

6.1 Prompt skeleton

Something along the lines of (pseudo-template):
```
You are analyzing a person’s Google Calendar events for the year {year}.

You are given a JSON object with aggregated stats derived from their calendar and from Google Maps / Places:
- Global stats about event counts and hours.
- Time-based stats (by month, weekday, and time of day).
- People stats (top friends / collaborators by events and hours).
- Place stats (venues, neighborhoods, cities, cuisines).
- Context stats (dinners, drinks, travel, etc).
- Notable events and streaks.

Tasks:
1. Write a narrative “{year} Calendar Wrapped” summary in 3–6 paragraphs, in a friendly, slightly humorous tone.
   - Mention the friend they saw the most and how many events/hours.
   - Highlight their favorite neighborhoods and cuisines (e.g., “35 Thai dinners in the Lower East Side”).
2. List 5–10 interesting patterns, anomalies, or mini-stories in bullet points.
3. Suggest 5 concrete, personalized experiments or resolutions for how they could adjust their time in {year+1}.
   - E.g., protect specific times, rebalance work vs social, or explore new neighborhoods/cuisines.
4. Ground all claims in the numbers. When possible, include specific counts, dates, or percentages from the data.

Here is the JSON data:
{SUMMARY_JSON_HERE}
```
Make sure to embed the actual JSON (properly serialized) when generating the final prompt.

---

## 7. Project Structure

Proposed layout:

```text
calendar_wrapped/
  README.md                 # describe how to run the pipeline
  config.example.toml       # API keys, calendar IDs, etc.
  auth/
    calendar_auth.py        # Calendar OAuth setup
  data/
    raw_events_2025.json
    summary_2025.json
  src/
    fetch_events.py         # fetch_events_for_year()
    normalize.py            # NormalizedEvent, NormalizedAttendee, normalization logic
    locations.py            # Maps URL parsing, Places/Geocoding calls, caching
    classify_context.py     # heuristics for dinner/drinks/etc.
    aggregate.py            # all aggregations → summary JSON
    prompt_builder.py       # builds LLM prompt from summary JSON
    cli.py                  # main entrypoint: run full pipeline
```
If directory structure or packaging details are unclear, search for a typical Python project layout and follow that.

⸻

8. Execution Flow (Step-by-Step for the Script)
	1.	Auth & config:
	•	Load config (year, calendar ID, API keys).
	•	Initialize Google Calendar and Maps clients.
	2.	Fetch:
	•	If data/raw_events_{year}.json exists and a flag like --use-cache is set, load it.
	•	Else call fetch_events_for_year then write to raw_events_{year}.json.
	3.	Normalize:
	•	Convert raw events to NormalizedEvent objects.
	4.	Enrich locations:
	•	Extract Maps URLs / addresses.
	•	Resolve them to place IDs and details (using caching).
	5.	Classify context:
	•	Assign inferred_context_tags (dinner, drinks, etc.).
	6.	Aggregate:
	•	Produce summary_{year}.json as per schema.
	7.	Generate prompt:
	•	Build an LLM prompt string from summary_{year}.json.
	•	Print to stdout or save to prompt_{year}.txt.

⸻

9. Humor / Tone Guidance (for the Wrapped Output)

While the code itself can be dry, the LLM output should be:
	•	Playful but not cringe.
	•	Example tone:
“Your #1 collaborator this year was Alice (42 events, 63.5 hours together).
At this point, you might as well put her on the lease.”

“You clearly have a type: Thai food in the Lower East Side.
35 dinners. That’s not a phase. That’s a lifestyle.”

We’re not hard-coding jokes in code; we’re telling the LLM (via the prompt) to be slightly humorous.

⸻

10. If Anything Is Unclear…

If any of the following are unclear:
	•	Exact Calendar API query parameters.
	•	How to parse weird Google Maps URLs.
	•	Which Places endpoint is best for a specific subtask.
	•	How to interpret address components for NYC neighborhoods.
	•	How to set up API keys / OAuth.

Then:
	1.	Search the official Google docs (Calendar API, Maps Platform / Places, Geocoding).
	2.	Optionally search StackOverflow / GitHub for working examples.
	3.	Implement the most reasonable, robust approach; keep the surface flexible so we can tweak heuristics later.

Do not silently skip these pieces — always try to resolve them by looking things up.


