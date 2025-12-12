/**
 * Google Calendar API client for fetching events.
 *
 * Uses the Google Calendar API v3 directly via fetch.
 */

import type { CalendarEvent, CalendarListResponse, UserInfo } from './types';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';
const USERINFO_API = 'https://www.googleapis.com/oauth2/v3/userinfo';

/**
 * Fetch user info from Google.
 */
export async function fetchUserInfo(accessToken: string): Promise<UserInfo> {
  const response = await fetch(USERINFO_API, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user info: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch all calendar events for a given year.
 *
 * @param accessToken - OAuth access token
 * @param year - Year to fetch events for (e.g., 2025)
 * @param onProgress - Progress callback (events fetched so far)
 * @returns Array of calendar events
 */
export async function fetchCalendarEvents(
  accessToken: string,
  year: number,
  onProgress?: (count: number) => void
): Promise<CalendarEvent[]> {
  const timeMin = new Date(year, 0, 1).toISOString();
  const timeMax = new Date(year, 11, 31, 23, 59, 59).toISOString();

  const allEvents: CalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${CALENDAR_API_BASE}/calendars/primary/events`);
    url.searchParams.set('timeMin', timeMin);
    url.searchParams.set('timeMax', timeMax);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '2500');

    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Calendar API error: ${response.status} - ${error}`);
    }

    const data: CalendarListResponse = await response.json();

    if (data.items) {
      allEvents.push(...data.items);
      onProgress?.(allEvents.length);
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return allEvents;
}

/**
 * List all calendars the user has access to.
 */
export async function listCalendars(
  accessToken: string
): Promise<
  Array<{
    id: string;
    summary: string;
    primary?: boolean;
    accessRole: string;
  }>
> {
  const response = await fetch(`${CALENDAR_API_BASE}/users/me/calendarList`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to list calendars: ${response.status}`);
  }

  const data = await response.json();
  return data.items || [];
}
