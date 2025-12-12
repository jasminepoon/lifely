# Lifely - 2025 Wrapped

A "Spotify Wrapped" style year-in-review for your Google Calendar. See your year in moments.

## Features

- Connect to Google Calendar via OAuth
- Analyze your 2025 events (people, places, patterns)
- AI-powered insights using OpenAI
- Beautiful horizontal-scroll presentation
- Privacy-first: data stays in your browser

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Add your credentials to .env (see Setup below)

# Start dev server
npm run dev
```

## Setup

### 1. Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select existing
3. Enable the **Google Calendar API**
4. Create OAuth 2.0 credentials:
   - Click "Create Credentials" → "OAuth client ID"
   - Choose **"Web application"**
   - Add to "Authorized JavaScript origins":
     - `http://localhost:5173` (development)
     - Your production URL
5. Copy the Client ID to `.env`:
   ```
   VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```

### 2. LLM Access (Preferred: Proxy)

Enables location enrichment and AI-generated narrative.

- **Recommended**: route through a proxy (keeps keys server-side)
  ```
  VITE_LLM_PROXY_URL=https://your-worker-url
  VITE_LLM_PROXY_TOKEN=shared-secret
  ```
- **Dev-only fallback** (exposes key in browser):
  ```
  VITE_OPENAI_API_KEY=sk-your-api-key
  ```

Notes:
- Default model is `gpt-5.2` (fallback: `gpt-5-mini` → `gpt-5-nano`).
- Current GPT-5 family limits can be as low as ~3 RPM; first-time runs may take minutes. Location/classification results are cached in localStorage to make reruns fast.

### 3. Google Maps (Optional)

Only needed if you want to experiment with a Places heatmap.
```
VITE_GOOGLE_MAPS_API_KEY=your-maps-key
```

## Development

```bash
npm run dev      # Start dev server (http://localhost:5173)
npm run build    # Production build
npm run preview  # Preview production build
```

### Keyboard Shortcuts (Dev Only)

- Press `r` to toggle between landing and results page

## Architecture

```
src/
├── components/
│   ├── landing/     # Landing page components
│   ├── results/     # Results page container
│   ├── beats/       # 7 "beat" sections (Hero, People, Places, etc.)
│   └── ui/          # Shared UI components
├── hooks/
│   ├── use-lifely.ts      # Main orchestration hook (OAuth + processing)
│   ├── use-results.ts     # Results page data loading
│   └── use-scroll-progress.ts  # Horizontal scroll tracking
├── lib/
│   ├── google/      # Google OAuth and Calendar API
│   ├── stats/       # Stats processing pipeline
│   └── types.ts     # TypeScript types and data transformation
└── App.tsx          # Simple routing
```

## Data Flow

```
Landing Page
    ↓
Google OAuth Popup
    ↓
Fetch Calendar Events (2025)
    ↓
Process Stats (normalize → analyze → enrich with OpenAI)
    ↓
Save to sessionStorage
    ↓
Navigate to /results
    ↓
Display 7 horizontal beats
```

## Known Issues

See [TAILWIND_V4_LEARNINGS.md](./TAILWIND_V4_LEARNINGS.md) for Tailwind CSS v4 compatibility notes.

## Tech Stack

- React 19 + TypeScript
- Vite 7
- Tailwind CSS v4
- Google Identity Services (OAuth)
- OpenAI GPT-5 Responses API (default: `gpt-5.2`)
