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
   - Application type: Desktop app
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

# Or using pip
pip install -e .
```

### 3. Run

```bash
# Using uv
uv run lifely

# Or directly
python -m lifely.cli
```

On first run, a browser window will open for Google OAuth. After authorizing, a `token.json` will be saved for future runs.

## Project Structure

```
lifely/
├── planning/           # Specs and implementation plans
├── credentials/        # OAuth credentials (gitignored)
├── data/              # Output data (gitignored)
└── src/lifely/        # Source code
    ├── auth.py        # Google Calendar OAuth
    ├── fetch.py       # Fetch events from Calendar API
    ├── models.py      # Data models
    ├── normalize.py   # Convert raw API → normalized events
    ├── stats.py       # Compute aggregations
    └── cli.py         # CLI entrypoint
```

## Phases

- **Phase 1** (current): Calendar data pipeline, friend stats
- **Phase 2**: Location enrichment via Google Places API
- **Phase 3**: Full stats and LLM prompt generation
- **Phase 4**: Visual UI (Flighty-inspired)

See `planning/` for detailed specs.
