/**
 * Main processing pipeline for Lifely stats.
 *
 * Orchestrates the full flow from raw calendar events to final stats output.
 */

import type {
  LifelyStatsOutput,
  LocationEnrichment,
  InferredFriend,
  ActivityCategoryStats,
} from './types';
import type { RawCalendarEvent } from './normalize';
import { normalizeEvents } from './normalize';
import {
  computeFriendStats,
  computeTimeStats,
  computeLocationStats,
  applyEnrichmentsToFriendStats,
  filterEventsByYear,
} from './stats';
import {
  enrichAllEvents,
  classifyEvents,
  generateStoryAndInsights,
  type LlmConfig,
} from './llm';

export type ProcessingPhase =
  | 'normalizing'
  | 'computing_stats'
  | 'enriching_locations'
  | 'classifying_events'
  | 'generating_insights'
  | 'complete';

export interface ProcessingProgress {
  phase: ProcessingPhase;
  percent: number;
  message: string;
}

/**
 * Process raw calendar events through the full Lifely pipeline.
 *
 * @param rawEvents - Raw events from Google Calendar API
 * @param userEmail - User's email for self-detection
 * @param year - Year to filter events to (e.g., 2025)
 * @param llmConfig - LLM config (proxy preferred; apiKey for dev)
 * @param onProgress - Progress callback
 * @returns Complete stats output
 */
export async function processCalendarEvents(
  rawEvents: RawCalendarEvent[],
  userEmail: string,
  year: number,
  llmConfig: LlmConfig | null,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<LifelyStatsOutput> {
  // Phase 1: Normalize events
  onProgress?.({
    phase: 'normalizing',
    percent: 5,
    message: 'Normalizing calendar events...',
  });

  const allEvents = normalizeEvents(rawEvents, userEmail);
  const events = filterEventsByYear(allEvents, year);
  const hasLlm = !!llmConfig?.apiKey || !!llmConfig?.proxyUrl;
  const llmWarnings: string[] = [];
  const pushWarning = (warning: string) => {
    const trimmed = warning?.trim();
    if (!trimmed) return;
    if (!llmWarnings.includes(trimmed)) llmWarnings.push(trimmed);
  };

  // Phase 2: Compute basic stats (no LLM)
  onProgress?.({
    phase: 'computing_stats',
    percent: 15,
    message: 'Computing calendar statistics...',
  });

  const timeStats = computeTimeStats(events);
  let friendStats = computeFriendStats(events);

  // Count events with location
  const eventsWithLocation = events.filter(e => e.locationRaw && e.locationRaw.trim()).length;

  // If no LLM credentials, return basic stats without enrichment
  if (!hasLlm) {
    onProgress?.({
      phase: 'complete',
      percent: 100,
      message: 'Processing complete (no enrichment)',
    });

    const locationStats = computeLocationStats(friendStats, null);

    return {
      year,
      timeStats,
      friendStats,
      locationStats,
      inferredFriends: [],
      activityStats: {},
      narrative: null,
      patterns: [],
      experiments: [],
      coverage: {
        totalEvents: events.length,
        eventsWithLocation,
        eventsClassified: 0,
        interestingEvents: 0,
      },
    };
  }

  // Phase 3: Enrich locations via LLM
  onProgress?.({
    phase: 'enriching_locations',
    percent: 25,
    message: 'Analyzing locations...',
  });

  let enrichmentLookup: Map<string, LocationEnrichment>;
  try {
    enrichmentLookup = await enrichAllEvents(
      events,
      llmConfig!,
      (current, total) => {
        const percent = 25 + Math.round((current / total) * 25);
        onProgress?.({
          phase: 'enriching_locations',
          percent,
          message: `Analyzing locations (${current}/${total})...`,
        });
      },
      pushWarning
    );
  } catch (error) {
    console.error('Location enrichment failed:', error);
    llmWarnings.push(
      error instanceof Error
        ? error.message
        : 'Location enrichment failed (unknown error)'
    );
    enrichmentLookup = new Map();
  }

  // Apply enrichments to friend stats
  friendStats = applyEnrichmentsToFriendStats(friendStats, enrichmentLookup);

  // Phase 4: Classify events via LLM
  onProgress?.({
    phase: 'classifying_events',
    percent: 55,
    message: 'Classifying events...',
  });

  let inferredFriends: InferredFriend[] = [];
  let activityStats: Record<string, ActivityCategoryStats> = {};

  try {
    [inferredFriends, activityStats] = await classifyEvents(
      events,
      enrichmentLookup,
      llmConfig!,
      (current, total) => {
        const percent = 55 + Math.round((current / total) * 20);
        onProgress?.({
          phase: 'classifying_events',
          percent,
          message: `Classifying events (${current}/${total})...`,
        });
      },
      pushWarning
    );
  } catch (error) {
    console.error('Event classification failed:', error);
    llmWarnings.push(
      error instanceof Error
        ? error.message
        : 'Event classification failed (unknown error)'
    );
  }

  // Compute location stats with enrichment
  const locationStats = computeLocationStats(friendStats, enrichmentLookup);

  // Phase 5: Generate narrative and insights
  onProgress?.({
    phase: 'generating_insights',
    percent: 80,
    message: 'Writing your story...',
  });

  let narrative = null;
  let patterns: { title: string; detail: string }[] = [];
  let experiments: { title: string; description: string }[] = [];

  try {
    const insights = await generateStoryAndInsights(
      timeStats,
      friendStats,
      inferredFriends,
      locationStats,
      activityStats,
      year,
      llmConfig!,
      pushWarning
    );
    narrative = insights.narrative;
    patterns = insights.patterns;
    experiments = insights.experiments;
  } catch (error) {
    console.error('Narrative generation failed:', error);
    llmWarnings.push(
      error instanceof Error
        ? error.message
        : 'Narrative generation failed (unknown error)'
    );
  }

  onProgress?.({
    phase: 'complete',
    percent: 100,
    message: 'Processing complete!',
  });

  // Calculate coverage stats
  const eventsClassified = Object.values(activityStats).reduce(
    (sum, cat) => sum + cat.eventCount,
    0
  );
  const interestingEvents = Object.values(activityStats)
    .filter(cat => cat.isInteresting)
    .reduce((sum, cat) => sum + cat.eventCount, 0);

  return {
    year,
    timeStats,
    friendStats,
    locationStats,
    inferredFriends,
    activityStats,
    narrative,
    patterns,
    experiments,
    coverage: {
      totalEvents: events.length,
      eventsWithLocation,
      eventsClassified,
      interestingEvents,
    },
    ...(llmWarnings.length ? { llmWarnings } : {}),
  };
}

/**
 * Convert LifelyStatsOutput to the RawStats format expected by the UI.
 * This bridges the new stats engine output to the existing UI components.
 */
export function convertToRawStats(output: LifelyStatsOutput): {
  year: number;
  time_stats: {
    total_events: number;
    total_hours: number;
    events_per_month: Record<string, number>;
    hours_per_month: Record<string, number>;
    events_per_weekday: Record<string, number>;
    busiest_day: [string, number, number];
  };
  friend_stats: Array<{
    email: string;
    display_name: string | null;
    event_count: number;
    total_hours: number;
    events: Array<{
      id: string;
      summary: string;
      date: string;
      hours: number;
      location_raw: string | null;
      venue_name: string | null;
      neighborhood: string | null;
      cuisine: string | null;
    }>;
  }>;
  location_stats: {
    top_neighborhoods: Array<[string, number]>;
    top_venues: Array<[string, number]>;
    top_cuisines: Array<[string, number]>;
    map_points: Array<{
      lat: number;
      lng: number;
      count: number;
      label: string;
    }>;
  };
  inferred_friends: Array<{
    name: string;
    normalized_name: string;
    event_count: number;
    total_hours: number;
    linked_email: string | null;
    events: Array<{
      id: string;
      summary: string;
      date: string;
      hours: number;
      location_raw: string | null;
      venue_name: string | null;
      neighborhood: string | null;
      cuisine: string | null;
    }>;
  }>;
  activity_stats: Record<
    string,
    {
      category: string;
      event_count: number;
      total_hours: number;
      top_venues: Array<[string, number]>;
      top_activities: Array<[string, number]>;
      is_interesting?: boolean;
    }
  >;
  narrative: {
    story: string;
  };
  patterns: Array<{
    title: string;
    detail: string;
  }>;
  experiments: Array<{
    title: string;
    description: string;
  }>;
  coverage: {
    total_events: number;
    events_with_location: number;
    events_classified: number;
    interesting_events: number;
  };
  llm_warnings?: string[];
} {
  // Convert events_per_month keys from number to string
  const eventsPerMonth: Record<string, number> = {};
  for (const [month, count] of Object.entries(output.timeStats.eventsPerMonth)) {
    eventsPerMonth[month] = count;
  }

  const hoursPerMonth: Record<string, number> = {};
  for (const [month, hours] of Object.entries(output.timeStats.hoursPerMonth)) {
    hoursPerMonth[month] = hours;
  }

  return {
    year: output.year,
    time_stats: {
      total_events: output.timeStats.totalEvents,
      total_hours: output.timeStats.totalHours,
      events_per_month: eventsPerMonth,
      hours_per_month: hoursPerMonth,
      events_per_weekday: output.timeStats.eventsPerWeekday,
      busiest_day: output.timeStats.busiestDay || ['', 0, 0],
    },
    friend_stats: output.friendStats.map((f) => ({
      email: f.email,
      display_name: f.displayName,
      event_count: f.eventCount,
      total_hours: f.totalHours,
      events: f.events.map((e) => ({
        id: e.id,
        summary: e.summary || '',
        date: e.date,
        hours: e.hours,
        location_raw: e.locationRaw,
        venue_name: e.venueName,
        neighborhood: e.neighborhood,
        cuisine: e.cuisine,
      })),
    })),
    location_stats: {
      top_neighborhoods: output.locationStats.topNeighborhoods,
      top_venues: output.locationStats.topVenues,
      top_cuisines: output.locationStats.topCuisines,
      map_points: output.locationStats.mapPoints,
    },
    inferred_friends: output.inferredFriends.map((f) => ({
      name: f.name,
      normalized_name: f.normalizedName,
      event_count: f.eventCount,
      total_hours: f.totalHours,
      linked_email: f.linkedEmail,
      events: f.events.map((e) => ({
        id: e.id,
        summary: e.summary || '',
        date: e.date,
        hours: e.hours,
        location_raw: e.locationRaw,
        venue_name: e.venueName,
        neighborhood: e.neighborhood,
        cuisine: e.cuisine,
      })),
    })),
    activity_stats: Object.fromEntries(
      Object.entries(output.activityStats).map(([key, stats]) => [
        key,
        {
          category: stats.category,
          event_count: stats.eventCount,
          total_hours: stats.totalHours,
          top_venues: stats.topVenues,
          top_activities: stats.topActivities,
          is_interesting: stats.isInteresting,
        },
      ])
    ),
    narrative: {
      story: output.narrative?.story || '',
    },
    patterns: output.patterns,
    experiments: output.experiments,
    coverage: {
      total_events: output.coverage.totalEvents,
      events_with_location: output.coverage.eventsWithLocation,
      events_classified: output.coverage.eventsClassified,
      interesting_events: output.coverage.interestingEvents,
    },
    ...(output.llmWarnings?.length ? { llm_warnings: output.llmWarnings } : {}),
  };
}
