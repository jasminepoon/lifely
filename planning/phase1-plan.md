# Phase 1: Calendar Data Pipeline

> **Goal**: Fetch 2025 Google Calendar events, normalize them, compute friend stats, output to terminal + JSON.

---

## Pre-requisites Checklist

Before writing any code, you need to provision Google Cloud resources:

### Google Cloud Setup

- [ ] **Create a Google Cloud Project**
  - Go to [Google Cloud Console](https://console.cloud.google.com/)
  - Create new project (e.g., "Lifely" or "Calendar Wrapped")
  - Note your Project ID

- [ ] **Enable the Google Calendar API**
  - In your project, go to "APIs & Services" → "Library"
  - Search for "Google Calendar API"
  - Click "Enable"

- [ ] **Configure OAuth Consent Screen**
  - Go to "APIs & Services" → "OAuth consent screen"
  - Choose "External" (unless you have Google Workspace)
  - Fill in app name: "Lifely" (or similar)
  - Add your email as test user (required for "Testing" status)
  - Scopes: add `https://www.googleapis.com/auth/calendar.readonly`

- [ ] **Create OAuth 2.0 Credentials**
  - Go to "APIs & Services" → "Credentials"
  - Click "Create Credentials" → "OAuth client ID"
  - Application type: **Desktop app**
  - Name: "Lifely CLI"
  - Download the JSON file
  - Rename to `credentials.json`

- [ ] **Place credentials file**
  - Create `credentials/` directory in project root
  - Move `credentials.json` into `credentials/`
  - Verify it's gitignored

---

## Project Structure (Phase 1)

```
lifely/
├── pyproject.toml              # uv project config
├── .python-version             # pin Python version
├── .gitignore
├── .env.example                # environment variable template
├── README.md                   # basic setup instructions
│
├── planning/                   # specs and plans (checked in)
│   ├── concept.md
│   ├── phase1-plan.md
│   └── future-phases.md
│
├── credentials/                # OAuth credentials (gitignored)
│   ├── credentials.json        # downloaded from GCP
│   └── token.json              # auto-generated on first auth
│
├── data/                       # output data (gitignored)
│   ├── raw_events_2025.json    # cached API response
│   └── stats_2025.json         # computed stats
│
└── src/
    └── lifely/
        ├── __init__.py
        ├── auth.py             # Google Calendar OAuth setup
        ├── fetch.py            # fetch_events_for_year()
        ├── models.py           # dataclasses: NormalizedEvent, NormalizedAttendee
        ├── normalize.py        # convert raw API → normalized models
        ├── stats.py            # compute aggregations (friends, time stats)
        └── cli.py              # main entrypoint
```

---

## Dependencies (Phase 1)

```toml
[project]
dependencies = [
    "google-api-python-client>=2.0",   # Calendar API client
    "google-auth-httplib2>=0.1",        # Auth HTTP transport
    "google-auth-oauthlib>=1.0",        # OAuth flow for desktop apps
    "python-dateutil>=2.8",             # robust datetime parsing
    "rich>=13.0",                       # pretty CLI output (optional but nice)
]

[project.optional-dependencies]
dev = [
    "ruff",                             # linting
    "pytest",                           # testing
]
```

---

## Implementation Steps

### Step 1: Project Scaffolding

1. Initialize uv project with `pyproject.toml`
2. Create directory structure
3. Set up `.gitignore` (credentials/, data/, __pycache__, etc.)
4. Create `.env.example` documenting any env vars

### Step 2: Authentication Module (`auth.py`)

**Responsibility**: Handle OAuth flow, return authenticated Calendar service.

```python
# Pseudocode structure
def get_calendar_service() -> Resource:
    """
    Returns authenticated Google Calendar API service.

    Flow:
    1. Check for existing token.json
    2. If valid, use it
    3. If expired, refresh it
    4. If missing/invalid, run OAuth flow (opens browser)
    5. Save new token.json
    6. Return built service
    """
```

**Key details**:
- Scopes: `['https://www.googleapis.com/auth/calendar.readonly']`
- Credentials path: `credentials/credentials.json`
- Token path: `credentials/token.json`
- Use `InstalledAppFlow` for desktop OAuth

**Self-detection**: The authenticated user's email can be obtained from:
- `service.calendarList().get(calendarId='primary').execute()['id']`
- Or from attendee objects which have a `self: true` field

### Step 3: Fetch Events (`fetch.py`)

**Responsibility**: Retrieve all events for a given year.

```python
def fetch_events_for_year(
    service: Resource,
    calendar_id: str = 'primary',
    year: int = 2025,
    use_cache: bool = True,
    cache_path: Path | None = None,
) -> list[dict]:
    """
    Fetch all events for the specified year.

    - timeMin: {year}-01-01T00:00:00Z
    - timeMax: {year+1}-01-01T00:00:00Z
    - singleEvents: True (expand recurring events)
    - orderBy: startTime
    - Handle pagination via nextPageToken
    - Cache to data/raw_events_{year}.json
    """
```

**Pagination**: Calendar API returns max 2500 events per page. Loop until `nextPageToken` is exhausted.

**Fields to request** (use `fields` parameter to reduce payload):
- `items(id,summary,description,start,end,location,attendees,organizer,created,updated,recurringEventId,htmlLink)`

### Step 4: Data Models (`models.py`)

```python
@dataclass
class NormalizedAttendee:
    email: str
    display_name: str | None
    is_self: bool
    response_status: str | None  # 'accepted', 'declined', 'tentative', 'needsAction'

@dataclass
class NormalizedEvent:
    id: str
    summary: str | None
    description: str | None

    # Time
    start: datetime
    end: datetime
    all_day: bool
    duration_minutes: float

    # People
    attendees: list[NormalizedAttendee]
    organizer_email: str | None

    # Location (raw for Phase 1, enriched in Phase 2)
    location_raw: str | None

    # Metadata
    created: datetime | None
    updated: datetime | None
    recurring_event_id: str | None
```

### Step 5: Normalization (`normalize.py`)

**Responsibility**: Convert raw API responses to `NormalizedEvent` objects.

```python
def normalize_events(
    raw_events: list[dict],
    user_email: str,
    timezone: str = 'America/New_York',
) -> list[NormalizedEvent]:
    """
    Convert raw Calendar API events to normalized dataclasses.

    Handles:
    - date vs dateTime (all-day vs timed events)
    - Timezone normalization to NYC
    - Duration calculation
    - Attendee normalization with is_self detection
    """
```

**Timezone handling**:
- Events can have `start.dateTime` (with TZ) or `start.date` (all-day)
- Normalize everything to `America/New_York`
- Use `zoneinfo` (stdlib) or `dateutil.tz`

**Self-detection strategy**:
1. Primary: Check `attendee.self` field (boolean, set by API)
2. Fallback: Compare `attendee.email` to authenticated user's email

### Step 6: Stats Computation (`stats.py`)

**Responsibility**: Aggregate normalized events into summary stats.

```python
@dataclass
class FriendStats:
    email: str
    display_name: str | None
    event_count: int
    total_hours: float
    events: list[str]  # event IDs for reference

@dataclass
class TimeStats:
    total_events: int
    total_hours: float
    events_per_month: dict[int, int]      # month number → count
    events_per_weekday: dict[str, int]    # 'Mon' → count
    busiest_day: tuple[date, int, float]  # (date, event_count, hours)

def compute_friend_stats(events: list[NormalizedEvent]) -> list[FriendStats]:
    """
    Aggregate events by attendee (excluding self).
    Return sorted by total_hours descending.
    """

def compute_time_stats(events: list[NormalizedEvent]) -> TimeStats:
    """
    Compute time-based aggregations.
    """
```

**Friend aggregation logic**:
1. For each event, iterate attendees where `is_self=False`
2. Group by email (lowercased)
3. Accumulate event count and hours
4. Filter out obvious system emails (contain 'noreply', 'calendar', 'resource', etc.)

### Step 7: CLI Entrypoint (`cli.py`)

**Responsibility**: Wire everything together, handle CLI args, display output.

```python
def main():
    """
    1. Parse args (--year, --no-cache, etc.)
    2. Authenticate
    3. Fetch events (with caching)
    4. Normalize
    5. Compute stats
    6. Display with rich tables
    7. Save stats JSON
    """
```

**Output (Phase 1)**:
- Print top 10 friends by hours
- Print top 10 friends by event count
- Print basic time stats (total events, total hours, busiest month)
- Save full stats to `data/stats_2025.json`

---

## Edge Cases to Handle

1. **All-day events**: Duration = 24 hours? Or skip from time calculations?
   - **Decision**: Include but flag `all_day=True`; let stats decide how to weight

2. **Events with no attendees**: Solo events (just you)
   - **Decision**: Include in time stats, skip in friend stats

3. **Declined events**: Attendee with `responseStatus='declined'`
   - **Decision**: Exclude from friend stats (they didn't actually attend)

4. **Multi-day events**: `start.date` spanning multiple days
   - **Decision**: Calculate actual duration; flag for review

5. **Duplicate attendees**: Same person, multiple email addresses
   - **Decision**: Phase 1 treats each email as separate; Phase 2 can add deduplication

6. **System/resource emails**: Room bookings, Zoom, etc.
   - **Decision**: Filter out emails containing: `@resource.calendar.google.com`, `noreply`, `zoom.us`, etc.

---

## Testing Strategy (Phase 1)

1. **Unit tests** for:
   - Timezone normalization
   - Duration calculation
   - Attendee filtering logic

2. **Integration test**:
   - Use a small sample of real events (sanitized)
   - Verify stats computation

3. **Manual testing**:
   - Run against real calendar
   - Spot-check friend rankings against memory

---

## Success Criteria

Phase 1 is complete when:

- [ ] `uv run python -m lifely.cli` successfully authenticates
- [ ] Events for 2025 are fetched and cached to JSON
- [ ] Top 10 friends are printed with event counts and hours
- [ ] Basic time stats are displayed
- [ ] Output matches intuition (your actual top friends appear)

---

## Open Questions for Phase 1

1. **All-day event handling**: Include in hour calculations or not?
   - Suggestion: Include but can filter later

2. **Response status filtering**: Only count 'accepted'? Or include 'tentative'?
   - Suggestion: Include 'accepted' and 'tentative', exclude 'declined' and 'needsAction'

3. **Self-organized events**: If you created an event but aren't in attendees, should it count?
   - Suggestion: Yes, count as solo event

---

## Next: Phase 2 Preview

Once Phase 1 is working, Phase 2 adds location intelligence:
- Google Places API integration
- Venue resolution from location strings and Maps URLs
- Neighborhood extraction for NYC
- Cuisine detection for restaurants

See `future-phases.md` for details.
