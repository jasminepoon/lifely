/**
 * Normalize raw Google Calendar API events into clean typed objects.
 *
 * Handles timezone conversion, duration calculation, and attendee processing.
 * Port of Python lifely/normalize.py to TypeScript for client-side use.
 */

import type { NormalizedAttendee, NormalizedEvent } from './types';

// Raw types from Google Calendar API
export interface RawCalendarEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  start?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email?: string;
    displayName?: string;
    self?: boolean;
    responseStatus?: string;
  }>;
  organizer?: {
    email?: string;
  };
  location?: string;
  created?: string;
  updated?: string;
  recurringEventId?: string;
}

/**
 * Convert raw Calendar API events to normalized objects.
 *
 * @param rawEvents - List of event dicts from Calendar API
 * @param userEmail - The authenticated user's email (for self-detection)
 * @returns List of NormalizedEvent objects
 */
export function normalizeEvents(
  rawEvents: RawCalendarEvent[],
  userEmail: string
): NormalizedEvent[] {
  const userEmailLower = userEmail.toLowerCase();
  const normalized: NormalizedEvent[] = [];

  for (const raw of rawEvents) {
    const event = normalizeSingleEvent(raw, userEmailLower);
    if (event) {
      normalized.push(event);
    }
  }

  return normalized;
}

/**
 * Normalize a single raw event.
 * Returns null if the event should be skipped (e.g., cancelled).
 */
function normalizeSingleEvent(
  raw: RawCalendarEvent,
  userEmailLower: string
): NormalizedEvent | null {
  // Skip cancelled events
  if (raw.status === 'cancelled') {
    return null;
  }

  // Parse start/end times
  const [start, allDay] = parseEventTime(raw.start);
  const [end] = parseEventTime(raw.end);

  if (!start || !end) {
    return null;
  }

  // Calculate duration in minutes
  const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);

  // Normalize attendees
  const attendees = normalizeAttendees(raw.attendees || [], userEmailLower);

  // Parse metadata timestamps
  const created = parseTimestamp(raw.created);
  const updated = parseTimestamp(raw.updated);

  return {
    id: raw.id,
    summary: raw.summary || null,
    description: raw.description || null,
    start,
    end,
    allDay,
    durationMinutes,
    attendees,
    organizerEmail: raw.organizer?.email || null,
    locationRaw: raw.location || null,
    created,
    updated,
    recurringEventId: raw.recurringEventId || null,
  };
}

/**
 * Parse a Calendar API start/end time object.
 *
 * @returns Tuple of [Date | null, isAllDay]
 */
function parseEventTime(
  timeObj?: RawCalendarEvent['start']
): [Date | null, boolean] {
  if (!timeObj) {
    return [null, false];
  }

  // All-day events use 'date' (YYYY-MM-DD)
  if (timeObj.date) {
    const date = new Date(timeObj.date + 'T00:00:00');
    return [date, true];
  }

  // Timed events use 'dateTime'
  if (timeObj.dateTime) {
    const date = new Date(timeObj.dateTime);
    return [date, false];
  }

  return [null, false];
}

/**
 * Normalize the attendees list.
 *
 * @param rawAttendees - List of attendee objects from API
 * @param userEmailLower - User's email (lowercased) for self-detection
 * @returns List of NormalizedAttendee objects
 */
function normalizeAttendees(
  rawAttendees: NonNullable<RawCalendarEvent['attendees']>,
  userEmailLower: string
): NormalizedAttendee[] {
  const attendees: NormalizedAttendee[] = [];

  for (const raw of rawAttendees) {
    const email = (raw.email || '').toLowerCase();

    // Detect self: use API's self flag, or fall back to email comparison
    const isSelf = raw.self === true || email === userEmailLower;

    attendees.push({
      email,
      displayName: raw.displayName || null,
      isSelf,
      responseStatus: raw.responseStatus || null,
    });
  }

  return attendees;
}

/**
 * Parse an ISO timestamp string to Date.
 */
function parseTimestamp(timestampStr?: string): Date | null {
  if (!timestampStr) {
    return null;
  }
  try {
    const date = new Date(timestampStr);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/**
 * Format a date to YYYY-MM-DD string.
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get weekday name from date.
 */
export function getWeekdayName(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[date.getDay()];
}

/**
 * Get month number (1-12) from date.
 */
export function getMonth(date: Date): number {
  return date.getMonth() + 1;
}
