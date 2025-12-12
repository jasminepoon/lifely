/**
 * LLM-based enrichment for calendar events.
 *
 * Uses OpenAI to extract location details and classify events.
 * Client-side implementation for browser use.
 *
 * Port of Python lifely/llm_enrich.py to TypeScript.
 */

import type {
  NormalizedEvent,
  FriendEvent,
  LocationEnrichment,
  InferredFriend,
  ActivityEvent,
  ActivityCategoryStats,
  NarrativeOutput,
  Insight,
  ExperimentIdea,
  TimeStats,
  FriendStats,
  LocationStats,
} from './types';
import { formatDate } from './normalize';

// ═══════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════

// Given low RPM limits, we prefer fewer, larger requests.
const LOCATION_BATCH_SIZE = 120;
const CLASSIFICATION_BATCH_SIZE = 60;
const MAX_PARALLEL_REQUESTS = 2; // Small concurrency while respecting RPM pacing
const BATCH_PAUSE_MS = 0; // RPM throttle handles pacing
const REQUESTS_PER_MIN = 3; // Adhere to platform RPM limits
const WINDOW_MS = 60_000;
const requestTimestamps: number[] = []; // tracks recent request times for RPM throttle
const MIN_INTERVAL_MS = Math.ceil(WINDOW_MS / REQUESTS_PER_MIN);
let lastRequestStartMs = 0;
let throttleLock: Promise<void> = Promise.resolve();
// GPT-5 models via Responses API
const PRIMARY_MODEL = 'gpt-5.2';
const MODEL_FALLBACK_CHAIN = [PRIMARY_MODEL, 'gpt-5-mini', 'gpt-5-nano'];

const LLM_CACHE_KEY = 'lifely_llm_cache_v2';

export interface LlmConfig {
  apiKey?: string | null;
  proxyUrl?: string | null;
  proxyToken?: string | null;
}

type CachedLocation = {
  venueName: string | null;
  neighborhood: string | null;
  city: string | null;
  cuisine: string | null;
};

type CachedClassification = {
  category: string;
  activity: string;
  names: string[];
  venue: string | null;
  neighborhood: string | null;
  is_interesting: boolean;
  skip?: boolean;
};

type LlmCache = {
  version: 2;
  locations: Record<string, CachedLocation>;
  classifications: Record<string, CachedClassification>;
};

function loadLlmCache(): LlmCache {
  if (typeof window === 'undefined') {
    return { version: 2, locations: {}, classifications: {} };
  }
  try {
    const raw = window.localStorage.getItem(LLM_CACHE_KEY);
    if (!raw) return { version: 2, locations: {}, classifications: {} };
    const parsed = JSON.parse(raw) as Partial<LlmCache>;
    return {
      version: 2,
      locations: parsed.locations || {},
      classifications: parsed.classifications || {},
    };
  } catch {
    return { version: 2, locations: {}, classifications: {} };
  }
}

function saveLlmCache(cache: LlmCache) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LLM_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage errors (private mode, quota, etc.)
  }
}

// ═══════════════════════════════════════════════════════════
// PROMPTS
// ═══════════════════════════════════════════════════════════

const LOCATION_PROMPT = `Extract location details from these calendar events.

For each event with location data, extract:
- venue_name: Business/place name (e.g., "Thai Villa", "Equinox", "AMC Theater")
- neighborhood: NYC neighborhood or district. Infer from address when possible:
  - Lower Manhattan: FiDi, Tribeca, SoHo, NoHo, Chinatown, LES, East Village, West Village, Greenwich Village
  - Midtown: Midtown East, Midtown West, Hell's Kitchen, Hudson Yards, Koreatown, Murray Hill, Kips Bay
  - Upper: Upper East Side, Upper West Side, Harlem
  - Brooklyn: Williamsburg, DUMBO, Park Slope, Bushwick, Greenpoint, Brooklyn Heights
  - Example: "34th Street" → "Midtown", "6th Ave & 32nd St" → "Koreatown", "Bowery" → "East Village"
- city: Borough or city (e.g., "Manhattan", "Brooklyn", "Queens", "New York")
- cuisine: Food type if restaurant/bar (e.g., "Thai", "Italian", "Japanese", "Korean", "American")

Rules:
- ALWAYS try to infer neighborhood from NYC street addresses
- For non-food venues, leave cuisine as null
- Skip events with no location data or private addresses (apartments, homes)

Events:
{events_json}

Return JSON: {"results": [
  {"event_id": "...", "venue_name": "...", "neighborhood": "...", "city": "...", "cuisine": "..."}
]}`;

const CLASSIFICATION_PROMPT = `Analyze these calendar events and assign each a meaningful category.

For EVERY event, determine:
1. **category** - A short, lowercase category name that best describes this event. Be specific and consistent.
   Common categories (use these when appropriate, or create your own):
   - social: dining, drinks, parties, hangouts with friends/family
   - fitness: gym, yoga, running, climbing, sports
   - wellness: spa, massage, meditation, therapy
   - health: doctor, dentist, medical appointments
   - personal_care: haircut, nails, grooming
   - entertainment: movies, concerts, shows, museums
   - learning: classes, lessons, workshops
   - work: meetings, standups, work events
   - travel: flights, trips, commute
   - creative: writing, art, music practice
   - admin: errands, appointments, logistics

2. **activity** - A more specific label (e.g., "yoga", "dinner", "standup", "haircut")

3. **names** - If people are mentioned, extract their names. Empty array if none.
   Examples: "Dinner with Masha" → ["Masha"], "1:1 Bob" → ["Bob"], "Gym" → []

4. **venue** - If a specific venue/place is mentioned in the summary, extract it. Null if none.
   Examples: "Yoga @ Vital" → "Vital", "Gym" → null

5. **neighborhood** - If you recognize the venue/place and know its neighborhood, include it. Null if unknown.
   Examples: "Barry's Bootcamp" → "Tribeca" or "Flatiron", "Carbone" → "Greenwich Village"
   Only include if you're confident about the location. Use location_hint if provided.

6. **is_interesting** - true if this is a personal life event worth highlighting (social, fitness, wellness, entertainment, creative). false for mundane events (work meetings, admin, generic blocks).

Events:
{events_json}

Return JSON: {"results": [
  {"event_id": "...", "category": "...", "activity": "...", "names": [...], "venue": "...", "neighborhood": "...", "is_interesting": true/false}
]}`;

const WRAPPED_OUTPUT_PROMPT = `You are a warm, data-grounded concierge with a wink.

Using ONLY the context JSON, return JSON with:
- narrative: 3-5 sentences, no emojis/hashtags, data-grounded (no invented specifics)
- patterns: 3 items max, each detail under 140 chars
- experiments: 3 items max, each description under 140 chars

Return JSON:
{
  "narrative": "...",
  "patterns": [{"title": "...", "detail": "..."}],
  "experiments": [{"title": "...", "description": "..."}]
}

Context (JSON):
{context_json}`;

// ═══════════════════════════════════════════════════════════
// OPENAI API HELPERS
// ═══════════════════════════════════════════════════════════

interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

type ErrorWithStatus = Error & { status?: number };

type CallOptions = {
  maxTokens?: number;
  reasoningEffort?: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
  verbosity?: 'low' | 'medium' | 'high';
  retries?: number;
  timeoutMs?: number;
};

// Response type for GPT-5 Responses API
interface ResponsesAPIResponse {
  status?: 'completed' | 'incomplete' | 'failed' | string;
  incomplete_details?: { reason?: string } | null;
  error?: { message?: string; code?: string; type?: string; param?: string } | null;
  output: Array<{
    type: 'reasoning' | 'message';
    content?: Array<{
      type: string;
      text: string;
    }>;
  }>;
}

/**
 * Extract text from GPT-5 Responses API output.
 * The response structure is: output[].content[].text where type='message'
 */
function extractResponseText(data: ResponsesAPIResponse): string {
  const outputs = data.output || [];
  const texts: string[] = [];

  for (const output of outputs) {
    if (output.type !== 'message') continue;
    const content = output.content || [];
    for (const c of content) {
      if (c.type === 'output_text' && typeof c.text === 'string') {
        texts.push(c.text);
      }
    }
  }

  return texts.join('\n');
}

function normalizeReasoningEffort(
  model: string,
  effort: NonNullable<CallOptions['reasoningEffort']>
): 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' {
  const isMiniOrNano = model.includes('mini') || model.includes('nano');

  if (isMiniOrNano) {
    if (effort === 'none') return 'minimal';
    if (effort === 'xhigh') return 'high';
    return effort;
  }

  // gpt-5.2 supports: none | low | medium | high | xhigh (not minimal)
  if (effort === 'minimal') return 'low';
  return effort;
}

async function throttleRpm() {
  const previous = throttleLock;
  let release: () => void;
  throttleLock = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;

  try {
    while (true) {
      const now = Date.now();

      // Drop timestamps older than the window
      while (requestTimestamps.length && now - requestTimestamps[0] > WINDOW_MS) {
        requestTimestamps.shift();
      }

      const waitForWindow =
        requestTimestamps.length >= REQUESTS_PER_MIN
          ? WINDOW_MS - (now - requestTimestamps[0])
          : 0;
      const waitForSpacing = lastRequestStartMs
        ? MIN_INTERVAL_MS - (now - lastRequestStartMs)
        : 0;

      const waitFor = Math.max(waitForWindow, waitForSpacing);
      if (waitFor > 0) {
        await sleep(waitFor);
        continue;
      }

      const start = Date.now();
      requestTimestamps.push(start);
      lastRequestStartMs = start;
      return;
    }
  } finally {
    release!();
  }
}

/**
 * Call OpenAI Responses API (GPT-5 models).
 * Uses /v1/responses endpoint with input format.
 */
async function callOpenAI(
  config: LlmConfig,
  messages: OpenAIMessage[],
  model: string,
  options: CallOptions = {}
): Promise<string> {
  // Convert messages to single input string for Responses API
  const input = messages.map(m => m.content).join('\n\n');

  const timeoutMs = options.timeoutMs ?? 120_000;

  // Normalize reasoning effort across models:
  // - gpt-5.2 supports `none` but NOT `minimal`
  // - gpt-5-mini/nano support `minimal` but NOT `none`
  const requestedEffort = options.reasoningEffort ?? 'none';
  const normalizedEffort = normalizeReasoningEffort(model, requestedEffort);

  let maxOutputTokens = options.maxTokens ?? 1600;

  const buildBody = () => ({
    model,
    input,
    reasoning: { effort: normalizedEffort },
    text: { verbosity: options.verbosity ?? 'low' },
    max_output_tokens: maxOutputTokens,
  });

  const execute = async () => {
    // Enforce RPM throttle before any outbound request
    await throttleRpm();

    const body = buildBody();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // Prefer proxy so keys stay server-side
    try {
      if (config.proxyUrl) {
        const response = await fetch(config.proxyUrl, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...(config.proxyToken ? { Authorization: `Bearer ${config.proxyToken}` } : {}),
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const error = await response.text();
          const err: ErrorWithStatus = new Error(
            `LLM proxy error: ${response.status} - ${error}`
          );
          err.status = response.status;
          throw err;
        }

        const data: ResponsesAPIResponse = await response.json();
        if (data.error) {
          const err: ErrorWithStatus = new Error(
            `LLM proxy OpenAI error: ${data.error.message || 'unknown error'}`
          );
          err.status = 502;
          throw err;
        }

        if (data.status && data.status !== 'completed') {
          const reason = data.incomplete_details?.reason || data.status;
          // If we hit output token limits, bump once and retry (handled by outer retry loop).
          if (data.status === 'incomplete' && reason === 'max_output_tokens') {
            maxOutputTokens = Math.min(
              2400,
              Math.max(maxOutputTokens + 600, Math.round(maxOutputTokens * 1.5))
            );
            const err: ErrorWithStatus = new Error(
              `LLM proxy returned incomplete response (${reason}). Retrying with higher max_output_tokens.`
            );
            err.status = 503;
            throw err;
          }

          const err: ErrorWithStatus = new Error(
            `LLM proxy returned ${data.status} response (${reason}).`
          );
          err.status = 503;
          throw err;
        }

        const text = extractResponseText(data).trim();
        if (!text) {
          const err: ErrorWithStatus = new Error('LLM proxy returned empty response text.');
          err.status = 503;
          throw err;
        }
        return text;
      }

      // Fallback: direct call (dev only; exposes key in browser)
      if (!config.apiKey) {
        throw new Error('No LLM credentials configured');
      }

      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        const err: ErrorWithStatus = new Error(
          `OpenAI API error: ${response.status} - ${error}`
        );
        err.status = response.status;
        throw err;
      }

      const data: ResponsesAPIResponse = await response.json();
      if (data.error) {
        const err: ErrorWithStatus = new Error(
          `OpenAI API error: ${data.error.message || 'unknown error'}`
        );
        err.status = 400;
        throw err;
      }

      if (data.status && data.status !== 'completed') {
        const reason = data.incomplete_details?.reason || data.status;
        if (data.status === 'incomplete' && reason === 'max_output_tokens') {
          maxOutputTokens = Math.min(
            2400,
            Math.max(maxOutputTokens + 600, Math.round(maxOutputTokens * 1.5))
          );
          const err: ErrorWithStatus = new Error(
            `OpenAI returned incomplete response (${reason}). Retrying with higher max_output_tokens.`
          );
          err.status = 503;
          throw err;
        }

        const err: ErrorWithStatus = new Error(`OpenAI returned ${data.status} response (${reason}).`);
        err.status = 503;
        throw err;
      }

      const text = extractResponseText(data).trim();
      if (!text) {
        const err: ErrorWithStatus = new Error('OpenAI returned empty response text.');
        err.status = 503;
        throw err;
      }
      return text;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        const timeoutErr: ErrorWithStatus = new Error(
          `LLM request timed out after ${Math.round(timeoutMs / 1000)}s`
        );
        timeoutErr.status = 503;
        throw timeoutErr;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };

  // Simple retry/backoff for rate limits (429) or 503s
  const maxRetries = options.retries ?? 2;
  let attempt = 0;
  let delayMs = 500;

  while (true) {
    try {
      return await execute();
    } catch (err) {
      const status = (err as ErrorWithStatus | undefined)?.status;
      const isRetryable = status === 429 || status === 503;
      if (!isRetryable || attempt >= maxRetries) {
        throw err;
      }
      await new Promise(res => setTimeout(res, delayMs));
      delayMs *= 2;
      attempt += 1;
    }
  }
}

function isRateLimitError(err: unknown): boolean {
  if (!err) return false;
  const status = (err as ErrorWithStatus | undefined)?.status;
  if (status === 429) return true;
  const msg = (err as ErrorWithStatus | undefined)?.message;
  return msg ? msg.toLowerCase().includes('rate limit') : false;
}

function isModelNotAvailableError(err: unknown): boolean {
  if (!err) return false;
  const status = (err as ErrorWithStatus | undefined)?.status;
  if (status === 404) return true;
  const msg = (err as ErrorWithStatus | undefined)?.message?.toLowerCase() || '';
  if (!msg) return false;
  return (
    msg.includes('model') &&
    (msg.includes('not found') ||
      msg.includes('does not exist') ||
      msg.includes('model_not_found') ||
      msg.includes('unsupported model') ||
      msg.includes('invalid model'))
  );
}

/**
 * Try a list of models in order; fall back when rate limited.
 */
async function callWithFallback(
  models: string[],
  config: LlmConfig,
  messages: OpenAIMessage[],
  options: CallOptions
): Promise<string> {
  let lastError: unknown;
  for (let i = 0; i < models.length; i += 1) {
    try {
      return await callOpenAI(config, messages, models[i], options);
    } catch (err) {
      lastError = err;
      if ((isRateLimitError(err) || isModelNotAvailableError(err)) && i < models.length - 1) {
        // Try the next model
        continue;
      }
      throw err;
    }
  }
  // Should not reach; throw the last error if all fail
  throw lastError instanceof Error ? lastError : new Error('LLM call failed');
}

/**
 * Parse JSON from LLM response (handles markdown code blocks).
 */
function parseJsonResponse<T>(
  content: string,
  defaultValue: T
): { ok: boolean; data: T } {
  let jsonStr = content;

  // Extract from markdown code blocks
  if (content.includes('```json')) {
    jsonStr = content.split('```json')[1]?.split('```')[0]?.trim() || '';
  } else if (content.includes('```')) {
    jsonStr = content.split('```')[1]?.split('```')[0]?.trim() || '';
  }

  const candidates: string[] = [];
  if (jsonStr.trim()) candidates.push(jsonStr.trim());

  // Try to salvage by extracting the first JSON object in the string
  const start = jsonStr.indexOf('{');
  const end = jsonStr.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    candidates.push(jsonStr.slice(start, end + 1).trim());
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return { ok: true, data: JSON.parse(candidate) as T };
    } catch {
      // try next candidate
    }
  }

  return { ok: false, data: defaultValue };
}

/**
 * Trim text for LLM prompts to keep payloads small.
 */
function shortenText(text: string | null, maxLen = 180): string {
  if (!text) return '';
  return text.trim().slice(0, maxLen);
}

/**
 * Trim locations (esp. long map URLs) before sending to the LLM.
 */
function shortenLocation(location: string | null, maxLen = 160): string {
  if (!location) return '';
  let trimmed = location.trim();
  if (trimmed.startsWith('http')) {
    trimmed = trimmed.split('?')[0];
  }
  return trimmed.slice(0, maxLen);
}

function normalizeLocationCacheKey(locationRaw: string): string {
  return shortenLocation(locationRaw, 240).toLowerCase().trim();
}

// ═══════════════════════════════════════════════════════════
// LOCATION ENRICHMENT
// ═══════════════════════════════════════════════════════════

interface LocationEnrichmentResult {
  event_id: string;
  venue_name?: string;
  neighborhood?: string;
  city?: string;
  cuisine?: string;
}

/**
 * Enrich ALL events with location data via LLM.
 *
 * @param events - List of NormalizedEvents to enrich
 * @param apiKey - OpenAI API key
 * @param onProgress - Optional progress callback
 * @returns Map of event_id -> LocationEnrichment
 */
export async function enrichAllEvents(
  events: NormalizedEvent[],
  llmConfig: LlmConfig,
  onProgress?: (current: number, total: number) => void,
  onWarning?: (warning: string) => void
): Promise<Map<string, LocationEnrichment>> {
  const enrichmentLookup = new Map<string, LocationEnrichment>();
  const cache = loadLlmCache();
  let warned = false;

  // Deduplicate by location to reduce tokens and cache hits.
  const locationKeyToEventIds = new Map<string, string[]>();
  const representativeByLocationKey = new Map<
    string,
    { event_id: string; summary: string; location: string }
  >();
  const eventIdToLocationKey = new Map<string, string>();

  for (const e of events) {
    if (!e.locationRaw) continue;
    const locKey = normalizeLocationCacheKey(e.locationRaw);
    if (!locKey) continue;

    if (!locationKeyToEventIds.has(locKey)) {
      locationKeyToEventIds.set(locKey, []);
      representativeByLocationKey.set(locKey, {
        event_id: e.id,
        summary: shortenText(e.summary),
        location: shortenLocation(e.locationRaw),
      });
    }

    locationKeyToEventIds.get(locKey)!.push(e.id);
    eventIdToLocationKey.set(e.id, locKey);
  }

  if (locationKeyToEventIds.size === 0) {
    return enrichmentLookup;
  }

  // Apply cached results and build pending work list.
  const pending: Array<{ event_id: string; summary: string; location: string }> = [];
  const repEventIdToLocationKey = new Map<string, string>();
  let cachedLocations = 0;

  for (const [locKey, eventIds] of locationKeyToEventIds) {
    const cached = cache.locations[locKey];
    if (cached) {
      cachedLocations += 1;
      for (const eventId of eventIds) {
        enrichmentLookup.set(eventId, {
          eventId,
          venueName: cached.venueName,
          neighborhood: cached.neighborhood,
          city: cached.city,
          cuisine: cached.cuisine,
          latitude: null,
          longitude: null,
        });
      }
      continue;
    }

    const rep = representativeByLocationKey.get(locKey);
    if (rep) {
      pending.push(rep);
      repEventIdToLocationKey.set(rep.event_id, locKey);
    }
  }

  const totalLocations = locationKeyToEventIds.size;
  onProgress?.(cachedLocations, totalLocations);

  if (pending.length === 0) {
    return enrichmentLookup;
  }

  const batches = chunkArray(pending, LOCATION_BATCH_SIZE);

  try {
    await runBatchesWithLimit(
      batches,
      async (batch) => {
        const prompt = LOCATION_PROMPT.replace(
          '{events_json}',
          JSON.stringify(batch)
        );

        try {
          const content = await callWithFallback(
            MODEL_FALLBACK_CHAIN,
            llmConfig,
            [{ role: 'user', content: prompt }],
            { maxTokens: 1400, reasoningEffort: 'none', retries: 2 }
          );

          const parsed = parseJsonResponse<{ results: LocationEnrichmentResult[] }>(
            content,
            { results: [] }
          );
          if (!parsed.ok) {
            const msg =
              'Location enrichment returned invalid JSON. Please retry AI enrichment.';
            if (!warned) {
              warned = true;
              onWarning?.(msg);
            }
            console.error(msg);
            return;
          }
          const data = parsed.data;

          const returnedKeys = new Set<string>();

          for (const r of data.results) {
            const locKey =
              repEventIdToLocationKey.get(r.event_id) ||
              eventIdToLocationKey.get(r.event_id);
            if (!locKey) continue;

            returnedKeys.add(locKey);

            const cachedLocation: CachedLocation = {
              venueName: r.venue_name || null,
              neighborhood: r.neighborhood || null,
              city: r.city || null,
              cuisine: r.cuisine || null,
            };
            cache.locations[locKey] = cachedLocation;

            for (const eventId of locationKeyToEventIds.get(locKey) || []) {
              enrichmentLookup.set(eventId, {
                eventId,
                venueName: cachedLocation.venueName,
                neighborhood: cachedLocation.neighborhood,
                city: cachedLocation.city,
                cuisine: cachedLocation.cuisine,
                latitude: null,
                longitude: null,
              });
            }
          }

          // Cache empty results too, to avoid retrying forever.
          for (const requested of batch) {
            const locKey = repEventIdToLocationKey.get(requested.event_id);
            if (!locKey || returnedKeys.has(locKey)) continue;
            cache.locations[locKey] = {
              venueName: null,
              neighborhood: null,
              city: null,
              cuisine: null,
            };
            for (const eventId of locationKeyToEventIds.get(locKey) || []) {
              enrichmentLookup.set(eventId, {
                eventId,
                venueName: null,
                neighborhood: null,
                city: null,
                cuisine: null,
                latitude: null,
                longitude: null,
              });
            }
          }
        } catch (error) {
          if (isRateLimitError(error)) {
            throw new Error(
              'OpenAI rate limit reached during location enrichment. Please retry in a minute.'
            );
          }
          if (!warned) {
            warned = true;
            onWarning?.(
              error instanceof Error
                ? `Location enrichment batch failed: ${error.message}`
                : 'Location enrichment batch failed (unknown error)'
            );
          }
          console.error('Location enrichment batch failed:', error);
        }
      },
      (processed) => onProgress?.(cachedLocations + processed, totalLocations)
    );
  } finally {
    saveLlmCache(cache);
  }

  return enrichmentLookup;
}

// ═══════════════════════════════════════════════════════════
// EVENT CLASSIFICATION
// ═══════════════════════════════════════════════════════════

interface ClassificationResult {
  event_id: string;
  category: string;
  activity: string;
  names: string[];
  venue: string | null;
  neighborhood: string | null;
  is_interesting: boolean;
}

/**
 * Classify events into SOCIAL/ACTIVITY/OTHER via LLM.
 *
 * @param events - List of NormalizedEvents
 * @param enrichmentLookup - Optional enrichment data
 * @param apiKey - OpenAI API key
 * @param onProgress - Optional progress callback
 * @returns Tuple of [InferredFriends, ActivityStats]
 */
export async function classifyEvents(
  events: NormalizedEvent[],
  enrichmentLookup: Map<string, LocationEnrichment> | null,
  llmConfig: LlmConfig,
  onProgress?: (current: number, total: number) => void,
  onWarning?: (warning: string) => void
): Promise<[InferredFriend[], Record<string, ActivityCategoryStats>]> {
  const cache = loadLlmCache();
  let warned = false;

  const summaryToEvents = new Map<
    string,
    Array<{
      event_id: string;
      summary: string;
      date: string;
      hours: number;
      location_raw: string | null;
    }>
  >();
  const representativeBySummaryKey = new Map<
    string,
    { event_id: string; summary: string; location_hint?: string }
  >();
  const summaryForEvent = new Map<string, string>();
  const repEventIdToSummaryKey = new Map<string, string>();
  const classificationById = new Map<
    string,
    ClassificationResult & {
      summary: string;
      date: string;
      hours: number;
      location_raw: string | null;
    }
  >();

  for (const e of events) {
    if (!e.summary) continue;

    const summaryKey = e.summary.toLowerCase().trim();
    if (!summaryKey) continue;

    if (!summaryToEvents.has(summaryKey)) {
      summaryToEvents.set(summaryKey, []);
      const locationHint = shortenLocation(e.locationRaw);
      representativeBySummaryKey.set(summaryKey, {
        event_id: e.id,
        summary: shortenText(e.summary),
        ...(locationHint ? { location_hint: locationHint } : {}),
      });
    }

    summaryToEvents.get(summaryKey)!.push({
      event_id: e.id,
      summary: e.summary,
      date: formatDate(e.start),
      hours: Math.round((e.durationMinutes / 60) * 10) / 10,
      location_raw: e.locationRaw,
    });
    summaryForEvent.set(e.id, summaryKey);
  }

  if (summaryToEvents.size === 0) {
    return [[], {}];
  }

  const eventsForClassification: Array<{
    event_id: string;
    summary: string;
    location_hint?: string;
  }> = [];
  let cachedSummaries = 0;

  for (const [summaryKey, eventList] of summaryToEvents) {
    const cached = cache.classifications[summaryKey];
    if (cached) {
      cachedSummaries += 1;
      if (!cached.skip) {
        for (const ev of eventList) {
          classificationById.set(ev.event_id, {
            event_id: ev.event_id,
            category: cached.category,
            activity: cached.activity,
            names: cached.names || [],
            venue: cached.venue ?? null,
            neighborhood: cached.neighborhood ?? null,
            is_interesting: cached.is_interesting ?? false,
            summary: ev.summary,
            date: ev.date,
            hours: ev.hours,
            location_raw: ev.location_raw,
          });
        }
      }
      continue;
    }

    const rep = representativeBySummaryKey.get(summaryKey);
    if (rep) {
      eventsForClassification.push(rep);
      repEventIdToSummaryKey.set(rep.event_id, summaryKey);
    }
  }

  const totalSummaries = summaryToEvents.size;
  onProgress?.(cachedSummaries, totalSummaries);

  if (eventsForClassification.length > 0) {
    const batches = chunkArray(eventsForClassification, CLASSIFICATION_BATCH_SIZE);

    try {
      await runBatchesWithLimit(
        batches,
        async (batch) => {
          const prompt = CLASSIFICATION_PROMPT.replace(
            '{events_json}',
            JSON.stringify(batch)
          );

          try {
            const content = await callWithFallback(
              MODEL_FALLBACK_CHAIN,
              llmConfig,
              [{ role: 'user', content: prompt }],
              { maxTokens: 2400, reasoningEffort: 'none', retries: 2 }
            );

            const parsed = parseJsonResponse<{ results: ClassificationResult[] }>(
              content,
              { results: [] }
            );
            if (!parsed.ok) {
              const msg = 'Classification returned invalid JSON. Please retry AI enrichment.';
              if (!warned) {
                warned = true;
                onWarning?.(msg);
              }
              console.error(msg);
              return;
            }
            const data = parsed.data;

            const returnedSummaries = new Set<string>();

            for (const c of data.results) {
              const summaryKey =
                repEventIdToSummaryKey.get(c.event_id) ||
                summaryForEvent.get(c.event_id);
              if (!summaryKey) continue;

              returnedSummaries.add(summaryKey);

              const cachedClassification: CachedClassification = {
                category: c.category || 'other',
                activity: c.activity || 'unknown',
                names: c.names || [],
                venue: c.venue ?? null,
                neighborhood: c.neighborhood ?? null,
                is_interesting: c.is_interesting ?? false,
              };
              cache.classifications[summaryKey] = cachedClassification;

              // Propagate to all events with same summary
              for (const ev of summaryToEvents.get(summaryKey) || []) {
                classificationById.set(ev.event_id, {
                  ...cachedClassification,
                  event_id: ev.event_id,
                  summary: ev.summary,
                  date: ev.date,
                  hours: ev.hours,
                  location_raw: ev.location_raw,
                });
              }
            }

            // Cache "skip" sentinels for missing results so we don't retry forever.
            for (const requested of batch) {
              const summaryKey = repEventIdToSummaryKey.get(requested.event_id);
              if (!summaryKey || returnedSummaries.has(summaryKey)) continue;
              cache.classifications[summaryKey] = {
                category: '',
                activity: '',
                names: [],
                venue: null,
                neighborhood: null,
                is_interesting: false,
                skip: true,
              };
            }
          } catch (error) {
            if (isRateLimitError(error)) {
              throw new Error(
                'OpenAI rate limit reached during classification. Please retry in a minute.'
              );
            }
            if (!warned) {
              warned = true;
              onWarning?.(
                error instanceof Error
                  ? `Classification batch failed: ${error.message}`
                  : 'Classification batch failed (unknown error)'
              );
            }
            console.error('Classification batch failed:', error);
          }
        },
        (processed) =>
          onProgress?.(cachedSummaries + processed, totalSummaries)
      );
    } finally {
      saveLlmCache(cache);
    }
  } else {
    saveLlmCache(cache);
  }

  // Aggregate SOCIAL events into InferredFriends
  const inferredFriends = aggregateInferredFriends(
    classificationById,
    enrichmentLookup
  );

  // Aggregate ACTIVITY events into ActivityCategoryStats
  const activityStats = aggregateActivityStats(
    classificationById,
    enrichmentLookup
  );

  return [inferredFriends, activityStats];
}

/**
 * Aggregate events with names into InferredFriends.
 */
function aggregateInferredFriends(
  classificationById: Map<string, ClassificationResult & { summary: string; date: string; hours: number; location_raw: string | null }>,
  enrichmentLookup: Map<string, LocationEnrichment> | null
): InferredFriend[] {
  const byName = new Map<string, {
    displayName: string | null;
    events: FriendEvent[];
    totalHours: number;
  }>();

  for (const [eventId, classification] of classificationById) {
    // Now we check for names array instead of type === 'SOCIAL'
    const names = classification.names || [];
    if (names.length === 0) continue;

    const enrichment = enrichmentLookup?.get(eventId);
    // Use classification neighborhood if enrichment doesn't have one
    const neighborhood = enrichment?.neighborhood || classification.neighborhood || null;

    for (const name of names) {
      if (!name) continue;
      const key = name.trim().toLowerCase();

      if (!byName.has(key)) {
        byName.set(key, {
          displayName: null,
          events: [],
          totalHours: 0,
        });
      }

      const data = byName.get(key)!;
      data.totalHours += classification.hours || 0;
      data.events.push({
        id: eventId,
        summary: classification.summary,
        date: classification.date,
        hours: classification.hours || 0,
        locationRaw: classification.location_raw,
        venueName: classification.venue || enrichment?.venueName || null,
        neighborhood,
        cuisine: enrichment?.cuisine || null,
      });

      if (!data.displayName) {
        data.displayName = name.trim();
      }
    }
  }

  // Convert to InferredFriend objects
  const friends: InferredFriend[] = [];
  for (const [key, data] of byName) {
    friends.push({
      name: data.displayName || key,
      normalizedName: key,
      eventCount: data.events.length,
      totalHours: Math.round(data.totalHours * 10) / 10,
      events: data.events,
      linkedEmail: null,
    });
  }

  // Sort by event count descending
  friends.sort((a, b) => {
    if (b.eventCount !== a.eventCount) {
      return b.eventCount - a.eventCount;
    }
    return b.totalHours - a.totalHours;
  });

  return friends;
}

/**
 * Aggregate ALL events by category (dynamic categories from LLM).
 */
function aggregateActivityStats(
  classificationById: Map<string, ClassificationResult & { summary: string; date: string; hours: number; location_raw: string | null }>,
  enrichmentLookup: Map<string, LocationEnrichment> | null
): Record<string, ActivityCategoryStats> {
  const byCategory = new Map<string, {
    events: ActivityEvent[];
    totalHours: number;
    venues: Map<string, number>;
    types: Map<string, number>;
    isInteresting: boolean;
  }>();

  for (const [eventId, classification] of classificationById) {
    // Process ALL events, not just type === 'ACTIVITY'
    const category = classification.category || 'other';
    const activityType = classification.activity || 'unknown';
    const enrichment = enrichmentLookup?.get(eventId);

    // Prefer venue from classification, fall back to enrichment
    const venueName = classification.venue || enrichment?.venueName || null;
    // Prefer neighborhood from classification, fall back to enrichment
    const neighborhood = classification.neighborhood || enrichment?.neighborhood || null;

    if (!byCategory.has(category)) {
      byCategory.set(category, {
        events: [],
        totalHours: 0,
        venues: new Map(),
        types: new Map(),
        isInteresting: classification.is_interesting ?? false,
      });
    }

    const data = byCategory.get(category)!;
    data.totalHours += classification.hours || 0;
    // If any event in category is interesting, mark category as interesting
    if (classification.is_interesting) {
      data.isInteresting = true;
    }
    data.events.push({
      id: eventId,
      summary: classification.summary,
      date: classification.date,
      hours: classification.hours || 0,
      category,
      activityType,
      venueName,
      neighborhood,
    });

    if (venueName) {
      data.venues.set(venueName, (data.venues.get(venueName) || 0) + 1);
    }
    if (activityType) {
      data.types.set(activityType, (data.types.get(activityType) || 0) + 1);
    }
  }

  // Convert to ActivityCategoryStats
  const result: Record<string, ActivityCategoryStats> = {};
  for (const [cat, data] of byCategory) {
    result[cat] = {
      category: cat,
      eventCount: data.events.length,
      totalHours: Math.round(data.totalHours * 10) / 10,
      topVenues: Array.from(data.venues.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
      topActivities: Array.from(data.types.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
      isInteresting: data.isInteresting,
    };
  }

  return result;
}

// ═══════════════════════════════════════════════════════════
// NARRATIVE + INSIGHTS + EXPERIMENTS
// ═══════════════════════════════════════════════════════════

interface StatsContext {
  year: number;
  total_events: number;
  total_hours: number;
  busiest_month: string | null;
  busiest_weekday: string | null;
  top_friends: Array<{
    name: string;
    events: number;
    hours: number;
    venues: string[];
    neighborhoods: string[];
  }>;
  top_inferred_friends: Array<{
    name: string;
    events: number;
    hours: number;
    venues: string[];
    neighborhoods: string[];
  }>;
  top_neighborhoods: Array<[string, number]>;
  top_venues: Array<[string, number]>;
  top_cuisines: Array<[string, number]>;
  activities: Array<{
    category: string;
    events: number;
    hours: number;
    top_activities: string[];
    top_venues: string[];
  }>;
}

const MONTH_NAMES = [
  '',
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Build stats context for LLM calls.
 */
function buildStatsContext(
  timeStats: TimeStats,
  friendStats: FriendStats[],
  inferredFriends: InferredFriend[],
  locationStats: LocationStats,
  activityStats: Record<string, ActivityCategoryStats>,
  year: number,
  topN = 5
): StatsContext {
  // Find busiest month
  const eventsPerMonth = timeStats.eventsPerMonth || {};
  const monthEntries = Object.entries(eventsPerMonth);
  const busiestMonthNum =
    monthEntries.length > 0
      ? monthEntries.reduce((a, b) => (+b[1] > +a[1] ? b : a))[0]
      : null;
  const busiestMonth = busiestMonthNum
    ? MONTH_NAMES[parseInt(busiestMonthNum)]
    : null;

  // Find busiest weekday
  const eventsPerWeekday = timeStats.eventsPerWeekday || {};
  const dayEntries = Object.entries(eventsPerWeekday);
  const busiestWeekday =
    dayEntries.length > 0
      ? dayEntries.reduce((a, b) => (+b[1] > +a[1] ? b : a))[0]
      : null;

  // Build friend payloads
  const topFriends = friendStats.slice(0, topN).map((f) => {
    const venues = [
      ...new Set(f.events.filter((e) => e.venueName).map((e) => e.venueName!)),
    ].slice(0, 3);
    const neighborhoods = [
      ...new Set(
        f.events.filter((e) => e.neighborhood).map((e) => e.neighborhood!)
      ),
    ].slice(0, 3);
    return {
      name: f.displayName || f.email.split('@')[0],
      events: f.eventCount,
      hours: f.totalHours,
      venues,
      neighborhoods,
    };
  });

  const topInferredFriends = inferredFriends.slice(0, topN).map((f) => {
    const venues = [
      ...new Set(f.events.filter((e) => e.venueName).map((e) => e.venueName!)),
    ].slice(0, 3);
    const neighborhoods = [
      ...new Set(
        f.events.filter((e) => e.neighborhood).map((e) => e.neighborhood!)
      ),
    ].slice(0, 3);
    return {
      name: f.name,
      events: f.eventCount,
      hours: f.totalHours,
      venues,
      neighborhoods,
    };
  });

  const activities = Object.values(activityStats).map((a) => ({
    category: a.category,
    events: a.eventCount,
    hours: a.totalHours,
    top_activities: a.topActivities.slice(0, 2).map(([name]) => name),
    top_venues: a.topVenues.slice(0, 2).map(([name]) => name),
  }));

  return {
    year,
    total_events: timeStats.totalEvents,
    total_hours: timeStats.totalHours,
    busiest_month: busiestMonth,
    busiest_weekday: busiestWeekday,
    top_friends: topFriends,
    top_inferred_friends: topInferredFriends,
    top_neighborhoods: locationStats.topNeighborhoods,
    top_venues: locationStats.topVenues,
    top_cuisines: locationStats.topCuisines,
    activities,
  };
}

/**
 * Generate narrative, patterns, and experiments from stats via LLM.
 */
export async function generateStoryAndInsights(
  timeStats: TimeStats,
  friendStats: FriendStats[],
  inferredFriends: InferredFriend[],
  locationStats: LocationStats,
  activityStats: Record<string, ActivityCategoryStats>,
  year: number,
  llmConfig: LlmConfig,
  onWarning?: (warning: string) => void
): Promise<{
  narrative: NarrativeOutput | null;
  patterns: Insight[];
  experiments: ExperimentIdea[];
}> {
  const context = buildStatsContext(
    timeStats,
    friendStats,
    inferredFriends,
    locationStats,
    activityStats,
    year
  );
  const contextJson = JSON.stringify(context);

  let narrative: NarrativeOutput | null = null;
  let patterns: Insight[] = [];
  let experiments: ExperimentIdea[] = [];

  // Generate narrative + patterns + experiments in a single call (low RPM environments).
  try {
    const wrappedPrompt = WRAPPED_OUTPUT_PROMPT.replace(
      '{context_json}',
      contextJson
    );
    const content = await callWithFallback(
      MODEL_FALLBACK_CHAIN,
      llmConfig,
      [{ role: 'user', content: wrappedPrompt }],
      { maxTokens: 1200, reasoningEffort: 'none', verbosity: 'low', retries: 2 }
    );

    const parsed = parseJsonResponse<{
      narrative?: string;
      patterns?: Array<{ title: string; detail: string }>;
      experiments?: Array<{ title: string; description: string }>;
    }>(
      content,
      { narrative: '', patterns: [], experiments: [] }
    );
    if (!parsed.ok) {
      const msg = 'Narrative/insights returned invalid JSON. Please retry AI enrichment.';
      onWarning?.(msg);
      console.error(msg);
      return { narrative, patterns, experiments };
    }
    const data = parsed.data;

    if (data.narrative && data.narrative.trim()) {
      narrative = { story: data.narrative.trim() };
    }
    patterns = (data.patterns || []).map((p) => ({
      title: p.title,
      detail: p.detail,
    }));
    experiments = (data.experiments || []).map((e) => ({
      title: e.title,
      description: e.description,
    }));
  } catch (error) {
    if (isRateLimitError(error)) {
      throw new Error(
        'OpenAI rate limit reached while generating narrative. Please retry in a minute.'
      );
    }
    onWarning?.(
      error instanceof Error
        ? `Narrative/insights generation failed: ${error.message}`
        : 'Narrative/insights generation failed (unknown error)'
    );
    console.error('Narrative/insights generation failed:', error);
  }

  return { narrative, patterns, experiments };
}

// ═══════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════

/**
 * Split array into chunks of specified size.
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

/**
 * Run batches with limited concurrency.
 */
async function runBatchesWithLimit<T>(
  batches: T[][],
  handler: (batch: T[], index: number) => Promise<void>,
  onProgress?: (processed: number) => void
) {
  if (batches.length === 0) return;

  let processed = 0;
  let cursor = 0;

  const worker = async () => {
    while (cursor < batches.length) {
      const index = cursor++;
      const batch = batches[index];
      await handler(batch, index);
      processed += batch.length;
      onProgress?.(processed);
      // Add a small pause between batches to reduce rate-limit hits
      if (BATCH_PAUSE_MS > 0) {
        await sleep(BATCH_PAUSE_MS);
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(MAX_PARALLEL_REQUESTS, batches.length) },
    () => worker()
  );
  await Promise.all(workers);
}
