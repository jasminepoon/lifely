/**
 * Lifely Stats Engine
 *
 * Client-side port of the Python stats engine for computing
 * calendar analytics in the browser.
 *
 * Usage:
 * ```typescript
 * import { processCalendarEvents } from '@/lib/stats';
 *
 * const results = await processCalendarEvents(
 *   rawCalendarEvents,
 *   userEmail,
 *   2025,
 *   { proxyUrl, proxyToken, apiKey }, // LLM config
 *   (phase, progress) => console.log(`${phase}: ${progress}%`)
 * );
 * ```
 */

// Types
export type {
  NormalizedAttendee,
  NormalizedEvent,
  FriendEvent,
  FriendStats,
  TimeStats,
  LocationEnrichment,
  MapPoint,
  LocationStats,
  InferredFriend,
  ActivityEvent,
  ActivityCategoryStats,
  NarrativeOutput,
  Insight,
  ExperimentIdea,
  LifelyStatsOutput,
} from './types';

// Normalize
export {
  normalizeEvents,
  formatDate,
  getWeekdayName,
  getMonth,
} from './normalize';
export type { RawCalendarEvent } from './normalize';

// Stats computation
export {
  computeFriendStats,
  computeTimeStats,
  computeLocationStats,
  applyEnrichmentsToFriendStats,
  filterEventsByYear,
} from './stats';

// LLM enrichment
export {
  enrichAllEvents,
  classifyEvents,
  generateStoryAndInsights,
  type LlmConfig,
} from './llm';

// Main pipeline
export { processCalendarEvents, type ProcessingPhase } from './pipeline';
