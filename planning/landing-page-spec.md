# Landing Page Specification

> **URL**: `https://lifely.thirdplane.io?token=abc123`
> **Goal**: Get friends to connect their Google Calendar with minimal friction and maximum trust.
>
> **Implementation Note (2025-12-12)**: Progress dots were removed from landing page states to reserve them for Results page navigation only. The loading/processing state now uses a dedicated `ProcessingView` component with a 3-step timeline and glassmorphism card.
>
> **Implementation Status**: The current React app implements the OAuth + processing states, but does not yet enforce token-gated access (`?token=`). Token validation is part of Phase 5 hosting work.

---

## Design Philosophy

This is not a signup page. It's an **invitation to an experience**.

The friend didn't ask for this — you sent them a link. The page must:
1. Earn trust in < 5 seconds
2. Explain value without spoiling the surprise
3. Make the action obvious and easy
4. Feel like a gift, not a product

---

## Page States

### State 1: Loading (Token Validation)

**Duration**: < 500ms
**Purpose**: Validate token before showing UI

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│                                                        │
│                                                        │
│                         ◦                              │
│                    (pulsing)                           │
│                                                        │
│                                                        │
│                                                        │
└────────────────────────────────────────────────────────┘
```

- Single pulsing dot, centered
- No text (too fast to read anyway)
- Dark background already loaded

---

### State 2: Valid Token (Main Landing)

**The hero state**. This is what most users see first.

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│  ◦ ◦ ◦ ◦ ◦                                             │
│                                                        │
│                                                        │
│                                                        │
│                    2 0 2 5                             │
│                   WRAPPED                              │
│                                                        │
│             Your year in moments.                      │
│                                                        │
│                                                        │
│             ┌────────────────────┐                     │
│             │  Connect Calendar  │                     │
│             └────────────────────┘                     │
│                                                        │
│                                                        │
│        Read-only  ·  Stays in your browser             │
│                                                        │
│                 How this works ↓                       │
│                                                        │
│                                                        │
└────────────────────────────────────────────────────────┘
```

#### Element Specifications

| Element | Spec |
|---------|------|
| **Progress dots** | 5 dots, 8px diameter, `--text-secondary` at 30% opacity, 12px gap |
| **Year "2025"** | 120px, `--text-primary`, letter-spacing 0.3em, font-weight 700 |
| **"WRAPPED"** | 14px, `--text-secondary`, letter-spacing 0.4em, uppercase |
| **Tagline** | 18px, `--text-secondary`, font-weight 400 |
| **Button** | 200px wide, 52px tall, `--accent-cyan` bg, white text, 8px radius |
| **Privacy line** | 14px, `--text-secondary` at 60% opacity |
| **"How this works"** | 14px, `--accent-cyan`, underline on hover |

#### Animations (respect `prefers-reduced-motion`)

1. **Dots**: Fade in together, 0ms delay
2. **Year**: Fade in + slight rise (20px), 100ms delay
3. **"WRAPPED"**: Fade in, 200ms delay
4. **Tagline**: Fade in, 300ms delay
5. **Button**: Fade in + scale from 0.95, 400ms delay
6. **Privacy + link**: Fade in, 500ms delay

All transitions: 400ms ease-out

---

### State 3: Invalid/Expired Token

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│                                                        │
│                                                        │
│                    2 0 2 5                             │
│                   WRAPPED                              │
│                                                        │
│                                                        │
│            This link has expired.                      │
│                                                        │
│       Each link works up to 3 times.                   │
│       Ask for a new one to continue.                   │
│                                                        │
│                                                        │
│                                                        │
└────────────────────────────────────────────────────────┘
```

- No CTA (nothing actionable)
- Maintains brand (year + WRAPPED still visible)
- Friendly language, no error codes
- Explains the mechanic (3 uses)

---

### State 4: OAuth Popup Open

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│  ◦ ◦ ◦ ◦ ◦                                             │
│                                                        │
│                                                        │
│                    2 0 2 5                             │
│                   WRAPPED                              │
│                                                        │
│          Waiting for Google sign-in...                 │
│                                                        │
│             ┌────────────────────┐                     │
│             │     Waiting...     │  ← disabled state   │
│             └────────────────────┘                     │
│                                                        │
│          Complete sign-in in the popup.                │
│                                                        │
└────────────────────────────────────────────────────────┘
```

- Button changes to disabled state
- Helpful text pointing to popup
- Handles popup blockers: "Popup blocked? Click to retry"

---

### State 5: OAuth Declined

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│                                                        │
│                    2 0 2 5                             │
│                   WRAPPED                              │
│                                                        │
│                  No worries.                           │
│                                                        │
│       We need calendar access to show your             │
│       year in review. We only read events —            │
│       we can't change anything.                        │
│                                                        │
│             ┌────────────────────┐                     │
│             │     Try Again      │                     │
│             └────────────────────┘                     │
│                                                        │
│            What permissions exactly?                   │
│                                                        │
└────────────────────────────────────────────────────────┘
```

- Doesn't guilt or pressure
- Reiterates safety (read-only)
- Offers retry
- Links to permission details

---

### State 6: Processing

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│  ● ● ◦ ◦ ◦                                             │
│                                                        │
│                                                        │
│                                                        │
│           Finding your people...                       │
│                                                        │
│          ┌──────────────────────────┐                  │
│          │ ████████████░░░░░░░░░░░░ │                  │
│          └──────────────────────────┘                  │
│                                                        │
│           This takes about 30 seconds.                 │
│                                                        │
│                                                        │
└────────────────────────────────────────────────────────┘
```

#### Progress Phases

| Phase | Dots | Message | Bar % |
|-------|------|---------|-------|
| 1. Fetch calendar | ● ◦ ◦ ◦ ◦ | Fetching your calendar... | 0-20% |
| 2. Compute stats | ● ● ◦ ◦ ◦ | Crunching numbers... | 20-40% |
| 3. Classify events | ● ● ● ◦ ◦ | Finding your people... | 40-60% |
| 4. Enrich locations | ● ● ● ● ◦ | Mapping your city... | 60-80% |
| 5. Generate narrative | ● ● ● ● ● | Writing your story... | 80-100% |

- Progress bar is **real** (tied to actual completion)
- Messages rotate based on actual phase
- "30 seconds" manages expectations

#### Progress Bar Spec

- 280px wide, 6px tall
- Background: `--bg-surface`
- Fill: `--accent-cyan`
- Border-radius: 3px
- Transition: width 300ms ease-out

---

### State 7: Error

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│                                                        │
│                    2 0 2 5                             │
│                   WRAPPED                              │
│                                                        │
│              Something went wrong.                     │
│                                                        │
│       We couldn't load your calendar data.             │
│       This might be a temporary issue.                 │
│                                                        │
│             ┌────────────────────┐                     │
│             │     Try Again      │                     │
│             └────────────────────┘                     │
│                                                        │
│           Still not working? Let us know.              │
│                                                        │
└────────────────────────────────────────────────────────┘
```

- Generic but friendly
- Offers retry
- "Let us know" could link to your email/Twitter

---

## "How This Works" Expandable

Triggered by clicking "How this works ↓"

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │                                              [×] │  │
│  │  How this works                                  │  │
│  │                                                  │  │
│  │  1. You sign in with Google                      │  │
│  │     We never see your password.                  │  │
│  │                                                  │  │
│  │  2. Your calendar loads in your browser          │  │
│  │     The data stays on your device.               │  │
│  │                                                  │  │
│  │  3. We analyze it and show you the results       │  │
│  │     Using AI to find patterns and write          │  │
│  │     your story.                                  │  │
│  │                                                  │  │
│  │  4. Close the tab and it's gone                  │  │
│  │     Nothing is saved anywhere.                   │  │
│  │                                                  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
└────────────────────────────────────────────────────────┘
```

- Modal overlay with glassmorphism
- Click outside or [×] to close
- Numbered steps feel trustworthy
- Secondary text addresses specific concerns

---

## Permissions Expandable

Triggered by "What permissions exactly?"

```
┌──────────────────────────────────────────────────────┐
│                                                  [×] │
│  Permissions we request                              │
│                                                      │
│  ✓ View events on your calendars                     │
│    So we can analyze your year.                      │
│                                                      │
│  ✗ Create, edit, or delete events                    │
│    We can't change anything.                         │
│                                                      │
│  ✗ Access your contacts                              │
│    We don't need them.                               │
│                                                      │
│  ✗ Access your email                                 │
│    Not requested.                                    │
│                                                      │
│  We use the minimum permissions needed.              │
│                                                      │
└──────────────────────────────────────────────────────┘
```

- Shows what we request AND what we don't
- Checkmarks/X marks make it scannable
- Reassures privacy-conscious users

---

## Responsive Behavior

### Desktop (> 768px)
- Centered content, max-width 480px
- Comfortable spacing

### Mobile (≤ 768px)
- Full viewport height (100dvh)
- Button in bottom third (thumb zone)
- Slightly smaller typography
- Modal becomes bottom sheet

```
Mobile Layout:
┌────────────────────┐
│  ◦ ◦ ◦ ◦ ◦         │
│                    │
│      2 0 2 5       │
│     WRAPPED        │
│                    │
│  Your year in      │
│  moments.          │
│                    │
│                    │
│                    │
│ ┌────────────────┐ │
│ │Connect Calendar│ │
│ └────────────────┘ │
│                    │
│ Read-only · Local  │
│                    │
│  How this works    │
└────────────────────┘
```

---

## Accessibility

| Requirement | Implementation |
|-------------|----------------|
| **Keyboard navigation** | Tab order: button → "How this works" → modal close |
| **Screen readers** | Proper ARIA labels on button, progress bar, modals |
| **Reduced motion** | All animations disabled, instant state changes |
| **Color contrast** | All text meets WCAG AA (checked against #0A0F1A) |
| **Focus indicators** | Cyan outline on focusable elements |

---

## Copy Variants (A/B candidates)

### Taglines
- "Your year in moments." (default)
- "Your year, visualized."
- "See how you spent 2025."
- "365 days. One story."

### CTAs
- "Connect Calendar" (default)
- "See Your Year"
- "Get Started"
- "Show Me"

### Privacy lines
- "Read-only · Stays in your browser" (default)
- "Your data never leaves your device"
- "Private. Secure. Local."

---

## Technical Implementation Notes

### Token Validation
```javascript
// On page load, before rendering anything
const token = new URLSearchParams(location.search).get('token');
if (!token) {
  showState('invalid');
  return;
}

const response = await fetch(`${PROXY_URL}/validate`, {
  method: 'POST',
  body: JSON.stringify({ token }),
});

if (!response.ok) {
  showState('invalid');
  return;
}

showState('valid');
```

### Google OAuth PKCE
```javascript
// Load Google Identity Services
const client = google.accounts.oauth2.initTokenClient({
  client_id: GOOGLE_CLIENT_ID,
  scope: 'https://www.googleapis.com/auth/calendar.events.readonly',
  callback: handleOAuthResponse,
  error_callback: handleOAuthError,
});

// On button click
function handleConnect() {
  showState('oauth-pending');
  client.requestAccessToken();
}
```

### Session Recovery
```javascript
// If user refreshes during processing, recover
const savedToken = sessionStorage.getItem('oauth_token');
if (savedToken && location.pathname === '/processing') {
  resumeProcessing(savedToken);
}
```

---

## Metrics to Track

| Event | Purpose |
|-------|---------|
| `page_view` | How many people land |
| `token_valid` | How many have valid tokens |
| `oauth_started` | How many click the button |
| `oauth_completed` | How many complete OAuth |
| `oauth_declined` | How many decline |
| `processing_started` | How many begin processing |
| `processing_completed` | How many see results |
| `processing_error` | How many hit errors |

All via Cloudflare Analytics (no PII, no cookies).

---

## File Structure

```
lifely-web/
├── index.html
├── src/
│   ├── main.js          # Entry, state machine
│   ├── states/
│   │   ├── loading.js
│   │   ├── valid.js
│   │   ├── invalid.js
│   │   ├── oauth.js
│   │   ├── processing.js
│   │   └── error.js
│   ├── components/
│   │   ├── progress-dots.js
│   │   ├── progress-bar.js
│   │   ├── modal.js
│   │   └── button.js
│   └── utils/
│       ├── oauth.js
│       └── api.js
├── styles/
│   ├── base.css         # From spikes
│   ├── landing.css      # Landing-specific
│   └── modals.css
└── assets/
    └── (none needed)
```
