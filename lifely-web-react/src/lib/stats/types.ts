// ═══════════════════════════════════════════════════════════
// NORMALIZED EVENT TYPES (from Calendar API)
// ═══════════════════════════════════════════════════════════

export interface NormalizedAttendee {
  email: string;
  displayName: string | null;
  isSelf: boolean;
  responseStatus: string | null;
}

export interface NormalizedEvent {
  id: string;
  summary: string | null;
  description: string | null;
  start: Date;
  end: Date;
  allDay: boolean;
  durationMinutes: number;
  attendees: NormalizedAttendee[];
  organizerEmail: string | null;
  locationRaw: string | null;
  created: Date | null;
  updated: Date | null;
  recurringEventId: string | null;
}

// ═══════════════════════════════════════════════════════════
// FRIEND STATS TYPES
// ═══════════════════════════════════════════════════════════

export interface FriendEvent {
  id: string;
  summary: string | null;
  date: string; // YYYY-MM-DD
  hours: number;
  locationRaw: string | null;
  venueName: string | null;
  neighborhood: string | null;
  cuisine: string | null;
}

export interface FriendStats {
  email: string;
  displayName: string | null;
  eventCount: number;
  totalHours: number;
  events: FriendEvent[];
}

// ═══════════════════════════════════════════════════════════
// TIME STATS TYPES
// ═══════════════════════════════════════════════════════════

export interface TimeStats {
  totalEvents: number;
  totalHours: number;
  eventsPerMonth: Record<number, number>; // 1-12
  eventsPerWeekday: Record<string, number>; // Mon-Sun
  hoursPerMonth: Record<number, number>; // 1-12
  busiestDay: [string, number, number] | null; // [date, eventCount, hours]
}

// ═══════════════════════════════════════════════════════════
// LOCATION STATS TYPES
// ═══════════════════════════════════════════════════════════

export interface LocationEnrichment {
  eventId: string;
  venueName: string | null;
  neighborhood: string | null;
  city: string | null;
  cuisine: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface MapPoint {
  lat: number;
  lng: number;
  count: number;
  label: string;
}

export interface LocationStats {
  topNeighborhoods: Array<[string, number]>;
  topVenues: Array<[string, number]>;
  topCuisines: Array<[string, number]>;
  totalWithLocation: number;
  mapPoints: MapPoint[];
}

// ═══════════════════════════════════════════════════════════
// INFERRED FRIENDS (from LLM classification)
// ═══════════════════════════════════════════════════════════

export interface InferredFriend {
  name: string;
  normalizedName: string;
  eventCount: number;
  totalHours: number;
  events: FriendEvent[];
  linkedEmail: string | null;
}

// ═══════════════════════════════════════════════════════════
// ACTIVITY STATS (from LLM classification)
// ═══════════════════════════════════════════════════════════

export interface ActivityEvent {
  id: string;
  summary: string | null;
  date: string;
  hours: number;
  category: string;
  activityType: string;
  venueName: string | null;
  neighborhood: string | null;
}

export interface ActivityCategoryStats {
  category: string;
  eventCount: number;
  totalHours: number;
  topVenues: Array<[string, number]>;
  topActivities: Array<[string, number]>;
  isInteresting?: boolean;
}

// ═══════════════════════════════════════════════════════════
// LLM OUTPUT TYPES
// ═══════════════════════════════════════════════════════════

export interface NarrativeOutput {
  story: string;
}

export interface Insight {
  title: string;
  detail: string;
}

export interface ExperimentIdea {
  title: string;
  description: string;
}

// ═══════════════════════════════════════════════════════════
// COMBINED OUTPUT (what the stats engine produces)
// ═══════════════════════════════════════════════════════════

export interface CoverageStats {
  totalEvents: number;
  eventsWithLocation: number;
  eventsClassified: number;
  interestingEvents: number;
}

export interface LifelyStatsOutput {
  year: number;
  timeStats: TimeStats;
  friendStats: FriendStats[];
  locationStats: LocationStats;
  inferredFriends: InferredFriend[];
  activityStats: Record<string, ActivityCategoryStats>;
  narrative: NarrativeOutput | null;
  patterns: Insight[];
  experiments: ExperimentIdea[];
  coverage: CoverageStats;
  llmWarnings?: string[];
}
