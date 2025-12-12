/**
 * Google API Types
 */

// OAuth Token Response
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

// Calendar Event Types (subset of Google Calendar API)
export interface CalendarEvent {
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
    displayName?: string;
    self?: boolean;
  };
  location?: string;
  created?: string;
  updated?: string;
  recurringEventId?: string;
}

// Calendar List Response
export interface CalendarListResponse {
  kind: string;
  etag: string;
  nextPageToken?: string;
  items: CalendarEvent[];
}

// User Info
export interface UserInfo {
  email: string;
  name?: string;
  picture?: string;
}
