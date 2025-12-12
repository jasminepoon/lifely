/**
 * Compute statistics from normalized calendar events.
 *
 * Generates friend rankings, time distributions, and location aggregations.
 * Port of Python lifely/stats.py to TypeScript for client-side use.
 */

import type {
  NormalizedEvent,
  FriendEvent,
  FriendStats,
  TimeStats,
  LocationStats,
  LocationEnrichment,
  MapPoint,
} from './types';
import { formatDate, getWeekdayName, getMonth } from './normalize';

// Emails containing these substrings are filtered out as "system" accounts
const SYSTEM_EMAIL_PATTERNS = [
  '@resource.calendar.google.com',
  'noreply',
  'no-reply',
  'calendar-notification',
  '@zoom.us',
  '@calendly.com',
  'mailer-daemon',
  '@google.com', // Google Meet, etc.
];

/**
 * Check if an email belongs to a system/bot account.
 */
function isSystemEmail(email: string): boolean {
  const emailLower = email.toLowerCase();
  return SYSTEM_EMAIL_PATTERNS.some((pattern) => emailLower.includes(pattern));
}

/**
 * Compute statistics for time spent with each person.
 *
 * Aggregates by attendee email, excluding self and system accounts.
 *
 * @param events - List of normalized events
 * @param minEvents - Minimum events to include a person in results
 * @returns List of FriendStats, sorted by event count descending
 */
export function computeFriendStats(
  events: NormalizedEvent[],
  minEvents = 1
): FriendStats[] {
  // Aggregate by email
  const friendData = new Map<
    string,
    {
      displayName: string | null;
      eventCount: number;
      totalHours: number;
      events: FriendEvent[];
    }
  >();

  for (const event of events) {
    const eventHours = event.durationMinutes / 60;

    for (const attendee of event.attendees) {
      // Skip self
      if (attendee.isSelf) continue;

      // Skip declined attendees
      if (attendee.responseStatus === 'declined') continue;

      // Skip system accounts
      if (isSystemEmail(attendee.email)) continue;

      const email = attendee.email;

      if (!friendData.has(email)) {
        friendData.set(email, {
          displayName: null,
          eventCount: 0,
          totalHours: 0,
          events: [],
        });
      }

      const data = friendData.get(email)!;
      data.eventCount += 1;
      data.totalHours += eventHours;

      // Create FriendEvent with summary and location
      const friendEvent: FriendEvent = {
        id: event.id,
        summary: event.summary,
        date: formatDate(event.start),
        hours: Math.round(eventHours * 10) / 10,
        locationRaw: event.locationRaw,
        venueName: null,
        neighborhood: null,
        cuisine: null,
      };
      data.events.push(friendEvent);

      // Keep the most recent display name
      if (attendee.displayName) {
        data.displayName = attendee.displayName;
      }
    }
  }

  // Convert to FriendStats and filter
  const stats: FriendStats[] = [];
  for (const [email, data] of friendData) {
    if (data.eventCount >= minEvents) {
      stats.push({
        email,
        displayName: data.displayName,
        eventCount: data.eventCount,
        totalHours: Math.round(data.totalHours * 10) / 10,
        events: data.events,
      });
    }
  }

  // Sort by event count descending (tiebreaker: total hours)
  stats.sort((a, b) => {
    if (b.eventCount !== a.eventCount) {
      return b.eventCount - a.eventCount;
    }
    return b.totalHours - a.totalHours;
  });

  return stats;
}

/**
 * Compute time-based statistics for the year.
 *
 * @param events - List of normalized events
 * @returns TimeStats with various time aggregations
 */
export function computeTimeStats(events: NormalizedEvent[]): TimeStats {
  const totalEvents = events.length;
  let totalHours = 0;

  // Per-month aggregations
  const eventsPerMonth: Record<number, number> = {};
  const hoursPerMonth: Record<number, number> = {};

  // Per-weekday aggregations
  const eventsPerWeekday: Record<string, number> = {};

  // Per-day aggregations (for finding busiest day)
  const eventsPerDay = new Map<string, NormalizedEvent[]>();

  for (const event of events) {
    const hours = event.durationMinutes / 60;
    totalHours += hours;

    const month = getMonth(event.start);
    const weekday = getWeekdayName(event.start);
    const dayStr = formatDate(event.start);

    eventsPerMonth[month] = (eventsPerMonth[month] || 0) + 1;
    hoursPerMonth[month] = (hoursPerMonth[month] || 0) + hours;
    eventsPerWeekday[weekday] = (eventsPerWeekday[weekday] || 0) + 1;

    if (!eventsPerDay.has(dayStr)) {
      eventsPerDay.set(dayStr, []);
    }
    eventsPerDay.get(dayStr)!.push(event);
  }

  // Find busiest day
  let busiestDay: [string, number, number] | null = null;
  let maxHours = 0;

  for (const [dayStr, dayEvents] of eventsPerDay) {
    const dayHours = dayEvents.reduce(
      (sum, e) => sum + e.durationMinutes / 60,
      0
    );
    if (dayHours > maxHours) {
      maxHours = dayHours;
      busiestDay = [dayStr, dayEvents.length, Math.round(dayHours * 10) / 10];
    }
  }

  // Round hours per month
  for (const month in hoursPerMonth) {
    hoursPerMonth[month] = Math.round(hoursPerMonth[month] * 10) / 10;
  }

  return {
    totalEvents,
    totalHours: Math.round(totalHours * 10) / 10,
    eventsPerMonth,
    eventsPerWeekday,
    hoursPerMonth,
    busiestDay,
  };
}

/**
 * Compute location statistics from enriched events.
 *
 * @param friendStats - List of FriendStats
 * @param enrichmentLookup - Dict mapping event_id -> LocationEnrichment for ALL events
 * @param topN - Number of top items to return for each category
 * @returns LocationStats with top neighborhoods, venues, and cuisines
 */
export function computeLocationStats(
  friendStats: FriendStats[],
  enrichmentLookup: Map<string, LocationEnrichment> | null = null,
  topN = 5
): LocationStats {
  const neighborhoods = new Map<string, number>();
  const venues = new Map<string, number>();
  const cuisines = new Map<string, number>();
  let totalWithLocation = 0;
  const pointIndex = new Map<
    string,
    { lat: number; lng: number; count: number; label: string }
  >();

  // If we have enrichment lookup, use ALL enriched events
  if (enrichmentLookup) {
    for (const enrichment of enrichmentLookup.values()) {
      if (enrichment.venueName || enrichment.neighborhood) {
        totalWithLocation += 1;
      }
      if (enrichment.neighborhood) {
        neighborhoods.set(
          enrichment.neighborhood,
          (neighborhoods.get(enrichment.neighborhood) || 0) + 1
        );
      }
      if (enrichment.venueName) {
        venues.set(
          enrichment.venueName,
          (venues.get(enrichment.venueName) || 0) + 1
        );
      }
      if (enrichment.cuisine) {
        cuisines.set(
          enrichment.cuisine,
          (cuisines.get(enrichment.cuisine) || 0) + 1
        );
      }
      if (enrichment.latitude != null && enrichment.longitude != null) {
        // Round to reduce duplicates at the same venue
        const key = `${enrichment.latitude.toFixed(4)},${enrichment.longitude.toFixed(4)}`;
        if (!pointIndex.has(key)) {
          pointIndex.set(key, {
            lat: enrichment.latitude,
            lng: enrichment.longitude,
            count: 0,
            label:
              enrichment.neighborhood ||
              enrichment.venueName ||
              enrichment.city ||
              'Location',
          });
        }
        pointIndex.get(key)!.count += 1;
      }
    }
  } else {
    // Fallback: use friend_stats only
    const seenEvents = new Set<string>();
    for (const friend of friendStats) {
      for (const event of friend.events) {
        if (seenEvents.has(event.id)) continue;
        seenEvents.add(event.id);

        if (event.venueName || event.neighborhood) {
          totalWithLocation += 1;
        }
        if (event.neighborhood) {
          neighborhoods.set(
            event.neighborhood,
            (neighborhoods.get(event.neighborhood) || 0) + 1
          );
        }
        if (event.venueName) {
          venues.set(
            event.venueName,
            (venues.get(event.venueName) || 0) + 1
          );
        }
        if (event.cuisine) {
          cuisines.set(event.cuisine, (cuisines.get(event.cuisine) || 0) + 1);
        }
      }
    }
  }

  // Convert Maps to sorted arrays
  const topNeighborhoods = mostCommon(neighborhoods, topN);
  const topVenues = mostCommon(venues, topN);
  const topCuisines = mostCommon(cuisines, topN);

  // Sort map points by count, take top 200
  const mapPoints: MapPoint[] = Array.from(pointIndex.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 200);

  return {
    topNeighborhoods,
    topVenues,
    topCuisines,
    totalWithLocation,
    mapPoints,
  };
}

/**
 * Get the N most common items from a Map.
 */
function mostCommon<T>(
  counter: Map<T, number>,
  n: number
): Array<[T, number]> {
  return Array.from(counter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

/**
 * Apply location enrichments to FriendStats events.
 *
 * @param friendStats - List of FriendStats to update
 * @param enrichmentLookup - Map of event_id -> LocationEnrichment
 * @returns The same list with events enriched (mutated in place)
 */
export function applyEnrichmentsToFriendStats(
  friendStats: FriendStats[],
  enrichmentLookup: Map<string, LocationEnrichment>
): FriendStats[] {
  for (const friend of friendStats) {
    for (const event of friend.events) {
      const enrichment = enrichmentLookup.get(event.id);
      if (enrichment) {
        event.venueName = enrichment.venueName;
        event.neighborhood = enrichment.neighborhood;
        event.cuisine = enrichment.cuisine;
      }
    }
  }
  return friendStats;
}

/**
 * Filter events to a specific year.
 *
 * @param events - List of normalized events
 * @param year - Year to filter to (e.g., 2025)
 * @returns Events that fall within the given year
 */
export function filterEventsByYear(
  events: NormalizedEvent[],
  year: number
): NormalizedEvent[] {
  return events.filter((event) => event.start.getFullYear() === year);
}
