/**
 * API Utilities
 *
 * Handles communication with:
 * 1. Google Calendar API (direct, from browser)
 * 2. Lifely LLM Proxy (for AI enrichment)
 */

// ═══════════════════════════════════════════════════════════
// TOKEN VALIDATION
// ═══════════════════════════════════════════════════════════

/**
 * Validate a Lifely token with the proxy
 *
 * @param {string} token - The Lifely token from URL
 * @param {string} proxyUrl - Base URL of the LLM proxy
 * @returns {Promise<boolean>} Whether the token is valid
 */
export async function validateToken(token, proxyUrl) {
  try {
    const response = await fetch(`${proxyUrl}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.valid === true;
  } catch (error) {
    console.error('[API] Token validation failed:', error);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// GOOGLE CALENDAR API
// ═══════════════════════════════════════════════════════════

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

/**
 * Fetch calendar events for a given year
 *
 * @param {string} accessToken - Google OAuth access token
 * @param {number} year - Year to fetch events for
 * @returns {Promise<Array>} Array of calendar events
 */
export async function fetchCalendarEvents(accessToken, year = 2025) {
  const timeMin = new Date(year, 0, 1).toISOString();
  const timeMax = new Date(year, 11, 31, 23, 59, 59).toISOString();

  const events = [];
  let pageToken = null;

  do {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      maxResults: '2500',
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const response = await fetch(
      `${CALENDAR_API_BASE}/calendars/primary/events?${params}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `Calendar API error: ${response.status}`);
    }

    const data = await response.json();
    events.push(...(data.items || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return events;
}

// ═══════════════════════════════════════════════════════════
// LLM PROXY
// ═══════════════════════════════════════════════════════════

/**
 * Call the LLM proxy
 *
 * @param {string} proxyUrl - Base URL of the proxy
 * @param {string} lifelyToken - Lifely token for auth
 * @param {string} prompt - The prompt to send
 * @param {string} model - Model to use (default: gpt-5-mini)
 * @returns {Promise<string>} LLM response text
 */
async function callLLM(proxyUrl, lifelyToken, prompt, model = 'gpt-5-mini') {
  const response = await fetch(`${proxyUrl}/llm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: lifelyToken, prompt, model }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `LLM proxy error: ${response.status}`);
  }

  const data = await response.json();
  return data.content || data.text || '';
}

// ═══════════════════════════════════════════════════════════
// FULL PROCESSING PIPELINE
// ═══════════════════════════════════════════════════════════

/**
 * Process calendar through the full pipeline
 *
 * @param {string} accessToken - Google OAuth access token
 * @param {string} lifelyToken - Lifely token for LLM proxy
 * @param {string} proxyUrl - Base URL of LLM proxy
 * @param {function} onProgress - Called with (phase, progress) updates
 * @returns {Promise<Object>} Full results object
 */
export async function processCalendar(accessToken, lifelyToken, proxyUrl, onProgress) {
  const results = {
    events: [],
    stats: {},
    enrichments: {},
    classifications: {},
    narrative: null,
    patterns: [],
    experiments: [],
  };

  // Phase 0: Fetch calendar events
  onProgress?.(0, 5);
  results.events = await fetchCalendarEvents(accessToken, 2025);
  onProgress?.(0, 20);

  if (results.events.length === 0) {
    throw new Error("No events found in your 2025 calendar. It might be too early in the year!");
  }

  // Phase 1: Compute local stats
  onProgress?.(1, 25);
  results.stats = computeStats(results.events);
  onProgress?.(1, 35);

  // Phase 2: Classify events (LLM)
  onProgress?.(2, 40);
  results.classifications = await classifyEvents(results.events, lifelyToken, proxyUrl);
  onProgress?.(2, 55);

  // Phase 3: Enrich locations (LLM)
  onProgress?.(3, 60);
  results.enrichments = await enrichLocations(results.events, lifelyToken, proxyUrl);
  onProgress?.(3, 75);

  // Phase 4: Generate narrative & insights (LLM)
  onProgress?.(4, 80);
  const story = await generateStory(results.stats, results.classifications, results.enrichments, lifelyToken, proxyUrl);
  results.narrative = story.narrative;
  results.patterns = story.patterns;
  results.experiments = story.experiments;
  onProgress?.(4, 100);

  return results;
}

// ═══════════════════════════════════════════════════════════
// LOCAL STATS COMPUTATION
// ═══════════════════════════════════════════════════════════

/**
 * Compute basic stats from events (runs entirely client-side)
 */
function computeStats(events) {
  const stats = {
    totalEvents: events.length,
    totalHours: 0,
    eventsPerMonth: {},
    eventsPerWeekday: {},
    attendees: {},
  };

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (const event of events) {
    // Duration
    const start = new Date(event.start?.dateTime || event.start?.date);
    const end = new Date(event.end?.dateTime || event.end?.date);
    const hours = (end - start) / (1000 * 60 * 60);
    if (hours > 0 && hours < 24) {
      stats.totalHours += hours;
    }

    // Month distribution
    const month = start.getMonth() + 1;
    stats.eventsPerMonth[month] = (stats.eventsPerMonth[month] || 0) + 1;

    // Weekday distribution
    const weekday = weekdays[start.getDay()];
    stats.eventsPerWeekday[weekday] = (stats.eventsPerWeekday[weekday] || 0) + 1;

    // Attendees
    for (const attendee of event.attendees || []) {
      if (attendee.email && !attendee.self) {
        const key = attendee.email.toLowerCase();
        if (!stats.attendees[key]) {
          stats.attendees[key] = {
            email: attendee.email,
            displayName: attendee.displayName,
            count: 0,
            hours: 0,
          };
        }
        stats.attendees[key].count++;
        stats.attendees[key].hours += hours > 0 && hours < 24 ? hours : 0;
      }
    }
  }

  stats.totalHours = Math.round(stats.totalHours);

  // Sort attendees by count
  stats.topAttendees = Object.values(stats.attendees)
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return stats;
}

// ═══════════════════════════════════════════════════════════
// LLM ENRICHMENT (Stubs — to be implemented)
// ═══════════════════════════════════════════════════════════

/**
 * Classify events using LLM
 */
async function classifyEvents(events, lifelyToken, proxyUrl) {
  // Build payload with event summaries
  const payload = events
    .filter((e) => e.summary)
    .slice(0, 500) // Limit to avoid huge payloads
    .map((e) => ({
      id: e.id,
      summary: e.summary?.slice(0, 100),
      location: e.location?.slice(0, 100),
    }));

  const prompt = buildClassificationPrompt(payload);
  const response = await callLLM(proxyUrl, lifelyToken, prompt);

  try {
    return parseJSONResponse(response, 'results') || {};
  } catch {
    return {};
  }
}

/**
 * Enrich locations using LLM
 */
async function enrichLocations(events, lifelyToken, proxyUrl) {
  const eventsWithLocation = events
    .filter((e) => e.location)
    .slice(0, 300)
    .map((e) => ({
      id: e.id,
      summary: e.summary?.slice(0, 80),
      location: e.location?.slice(0, 150),
    }));

  if (eventsWithLocation.length === 0) {
    return {};
  }

  const prompt = buildLocationPrompt(eventsWithLocation);
  const response = await callLLM(proxyUrl, lifelyToken, prompt);

  try {
    return parseJSONResponse(response, 'results') || {};
  } catch {
    return {};
  }
}

/**
 * Generate narrative, patterns, and experiments
 */
async function generateStory(stats, classifications, enrichments, lifelyToken, proxyUrl) {
  const context = {
    totalEvents: stats.totalEvents,
    totalHours: stats.totalHours,
    topAttendees: stats.topAttendees?.slice(0, 5),
    eventsPerMonth: stats.eventsPerMonth,
    // Add more context as needed
  };

  const prompt = buildNarrativePrompt(context);
  const response = await callLLM(proxyUrl, lifelyToken, prompt, 'gpt-5.1');

  try {
    const data = parseJSONResponse(response);
    return {
      narrative: data.narrative || response,
      patterns: data.patterns || [],
      experiments: data.experiments || [],
    };
  } catch {
    return { narrative: response, patterns: [], experiments: [] };
  }
}

// ═══════════════════════════════════════════════════════════
// PROMPT BUILDERS
// ═══════════════════════════════════════════════════════════

function buildClassificationPrompt(events) {
  return `Classify these calendar events into SOCIAL, ACTIVITY, or OTHER.

For SOCIAL events (meeting people), extract names mentioned.
For ACTIVITY events (personal activities), extract category and venue.

Events:
${JSON.stringify(events)}

Return JSON: {"results": [{"id": "...", "type": "SOCIAL|ACTIVITY|OTHER", "names": [...], "category": "...", "venue": "..."}]}`;
}

function buildLocationPrompt(events) {
  return `Extract location details from these calendar events.

For each event, extract:
- venue_name: Business/place name
- neighborhood: NYC neighborhood if applicable
- cuisine: Food type if restaurant

Events:
${JSON.stringify(events)}

Return JSON: {"results": [{"id": "...", "venue_name": "...", "neighborhood": "...", "cuisine": "..."}]}`;
}

function buildNarrativePrompt(context) {
  return `Write a warm, data-grounded narrative about this person's 2025.

Context:
${JSON.stringify(context)}

Return JSON:
{
  "narrative": "3-5 sentences about their year...",
  "patterns": [{"title": "...", "detail": "..."}, ...],
  "experiments": [{"title": "...", "description": "..."}, ...]
}

Rules:
- Ground every claim in the data
- 3 patterns max, 3 experiments max
- No emojis, no hashtags`;
}

// ═══════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════

function parseJSONResponse(text, key = null) {
  let jsonStr = text;

  // Extract JSON from markdown code blocks
  if (text.includes('```json')) {
    jsonStr = text.split('```json')[1].split('```')[0].trim();
  } else if (text.includes('```')) {
    jsonStr = text.split('```')[1].split('```')[0].trim();
  }

  const data = JSON.parse(jsonStr);
  return key ? data[key] : data;
}
