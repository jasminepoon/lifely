# Lifely

> Google Calendar 2025 Wrapped — "Flighty, but for your life"

Analyze your Google Calendar to discover:
- Which friends you spent the most time with
- Your favorite neighborhoods and venues
- Patterns in how you spend your time

## Setup

### 1. Google Cloud Configuration

Before running, you need to set up Google Cloud credentials:

1. **Create a Google Cloud Project** at [console.cloud.google.com](https://console.cloud.google.com/)
2. **Enable the Google Calendar API** (APIs & Services → Library → search "Google Calendar API")
3. **Configure OAuth consent screen** (APIs & Services → OAuth consent screen)
   - Choose "External"
   - Add your email as a test user
4. **Create OAuth credentials** (APIs & Services → Credentials → Create → OAuth client ID)
   - Application type: **Desktop app** (not Web application)
   - Download the JSON file
5. **Place credentials**:
   ```bash
   mkdir -p credentials
   mv ~/Downloads/client_secret_*.json credentials/credentials.json
   ```

### 2. Install Dependencies

```bash
# Using uv (recommended)
uv sync
```

### 3. Run

```bash
uv run lifely
```

On first run, a browser window will open for Google OAuth. After authorizing, a `token.json` will be saved for future runs.

## CLI Options

```
uv run lifely [OPTIONS]

Options:
  --year YEAR   Year to analyze (default: 2025)
  --no-cache    Force refresh from API (ignore cached data)
  --top TOP     Number of top friends to show (default: 10)
  -h, --help    Show help message
```

### Examples

```bash
# Analyze 2024 instead of 2025
uv run lifely --year 2024

# Force refresh from Google Calendar API
uv run lifely --no-cache

# Show top 20 friends
uv run lifely --top 20
```

## Sample Output

```
Lifely - 2025 Calendar Wrapped

Authenticating with Google Calendar... OK (you@gmail.com)
Fetching events for 2025... OK (392 events)
Normalizing events... OK (392 normalized)
Computing statistics... OK

Time Stats (2025)
  Total events: 392
  Total hours: 1,807.9
  Busiest day: 2025-06-14 (12 events, 152.4 hours)
  Busiest month: Nov (47 events)

Top 10 Friends by Hours Together
┏━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━┳━━━━━━━━━━┓
┃   # ┃ Name                           ┃   Events ┃    Hours ┃
┡━━━━━╇━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━╇━━━━━━━━━━┩
│   1 │ friend@example.com             │        4 │      8.8 │
│   2 │ another@example.com            │        3 │      5.5 │
│  ...│ ...                            │      ... │      ... │
└─────┴────────────────────────────────┴──────────┴──────────┘

Stats saved to data/stats_2025.json
```

## Output Files

| File | Description |
|------|-------------|
| `data/raw_events_{year}.json` | Cached raw API response |
| `data/stats_{year}.json` | Computed statistics with friend details |

## Project Structure

```
lifely/
├── planning/           # Specs and implementation plans
├── credentials/        # OAuth credentials (gitignored)
├── data/               # Output data (gitignored)
└── src/lifely/         # Source code
    ├── auth.py         # Google Calendar OAuth
    ├── fetch.py        # Fetch events from Calendar API
    ├── models.py       # Data models (NormalizedEvent, FriendStats, etc.)
    ├── normalize.py    # Convert raw API → normalized events
    ├── stats.py        # Compute aggregations
    └── cli.py          # CLI entrypoint
```

## Phases

| Phase | Focus | Status |
|-------|-------|--------|
| 1 | Calendar pipeline, friend stats | Done |
| 2 | Location + LLM enrichment | **Current** |
| 3 | Full stats and LLM prompt generation | Planned |
| 4 | Visual UI (Flighty-inspired) | Planned |

### Phase 2 Prerequisites (Coming)

Phase 2 will require additional API keys:

```bash
# Google Places API (for location enrichment)
export GOOGLE_MAPS_API_KEY=your_key_here

# Anthropic API (for friend name extraction from event summaries)
export ANTHROPIC_API_KEY=your_key_here
```

See `planning/` for detailed specs.
