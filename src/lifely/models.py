"""Data models for normalized calendar events.

These dataclasses provide a clean interface over the raw Google Calendar API
response, with consistent typing and derived fields like duration.
"""

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class NormalizedAttendee:
    """A normalized event attendee.

    Attributes:
        email: Attendee's email address (lowercased).
        display_name: Attendee's display name, if available.
        is_self: True if this attendee is the authenticated user.
        response_status: One of 'accepted', 'declined', 'tentative', 'needsAction'.
    """

    email: str
    display_name: str | None
    is_self: bool
    response_status: str | None


@dataclass
class NormalizedEvent:
    """A normalized calendar event.

    All times are in the configured timezone (default: America/New_York).

    Attributes:
        id: Unique event ID from Google Calendar.
        summary: Event title/summary.
        description: Event description/notes.
        start: Event start time.
        end: Event end time.
        all_day: True if this is an all-day event.
        duration_minutes: Duration in minutes.
        attendees: List of attendees (excluding self for friend analysis).
        organizer_email: Email of the event organizer.
        location_raw: Raw location string from the event.
        created: When the event was created.
        updated: When the event was last updated.
        recurring_event_id: ID of the parent recurring event, if applicable.
    """

    id: str
    summary: str | None
    description: str | None

    # Time
    start: datetime
    end: datetime
    all_day: bool
    duration_minutes: float

    # People
    attendees: list[NormalizedAttendee] = field(default_factory=list)
    organizer_email: str | None = None

    # Location (raw for Phase 1, enriched in Phase 2)
    location_raw: str | None = None

    # Metadata
    created: datetime | None = None
    updated: datetime | None = None
    recurring_event_id: str | None = None


@dataclass
class FriendEvent:
    """A single event shared with a friend.

    Attributes:
        id: Unique event ID from Google Calendar.
        summary: Event title/summary.
        date: Event date in ISO format (YYYY-MM-DD).
        hours: Duration in hours.
        location_raw: Raw location string from the event.
        venue_name: Resolved venue name (Phase 2).
        neighborhood: Resolved neighborhood (Phase 2).
        cuisine: Detected cuisine type for restaurants (Phase 2).
    """

    id: str
    summary: str | None
    date: str
    hours: float
    location_raw: str | None = None
    # Phase 2 additions (populated after location enrichment):
    venue_name: str | None = None
    neighborhood: str | None = None
    cuisine: str | None = None


@dataclass
class FriendStats:
    """Aggregated statistics for time spent with a friend.

    Attributes:
        email: Friend's email (used as unique key).
        display_name: Friend's display name.
        event_count: Number of shared events.
        total_hours: Total hours spent together.
        events: List of events shared with this friend.
    """

    email: str
    display_name: str | None
    event_count: int
    total_hours: float
    events: list[FriendEvent] = field(default_factory=list)


@dataclass
class TimeStats:
    """Time-based statistics for the year.

    Attributes:
        total_events: Total number of events.
        total_hours: Total hours of events.
        events_per_month: Event count by month (1-12).
        events_per_weekday: Event count by weekday name.
        hours_per_month: Hours by month (1-12).
        busiest_day: Tuple of (date string, event count, hours).
    """

    total_events: int
    total_hours: float
    events_per_month: dict[int, int]
    events_per_weekday: dict[str, int]
    hours_per_month: dict[int, float]
    busiest_day: tuple[str, int, float] | None = None


@dataclass
class LocationStats:
    """Location-based statistics aggregated from friend events.

    Attributes:
        top_neighborhoods: List of (neighborhood, count) tuples.
        top_venues: List of (venue_name, count) tuples.
        top_cuisines: List of (cuisine, count) tuples.
        total_with_location: Count of events with location data.
    """

    top_neighborhoods: list[tuple[str, int]]
    top_venues: list[tuple[str, int]]
    top_cuisines: list[tuple[str, int]]
    total_with_location: int
    map_points: list[dict] | None = None


@dataclass
class LocationEnrichment:
    """Resolved location details for an event."""

    event_id: str = ""
    venue_name: str | None = None
    neighborhood: str | None = None
    city: str | None = None
    cuisine: str | None = None
    latitude: float | None = None
    longitude: float | None = None


@dataclass
class NarrativeOutput:
    """LLM-generated narrative for the year."""

    story: str


@dataclass
class Insight:
    """Short insight/pattern from stats."""

    title: str
    detail: str


@dataclass
class ExperimentIdea:
    """Forward-looking suggestion."""

    title: str
    description: str


# ═══════════════════════════════════════════════════════════
# SOLO EVENT CLASSIFICATION (Phase 2)
# ═══════════════════════════════════════════════════════════


@dataclass
class InferredFriend:
    """Friend inferred from event summaries via LLM (no email).

    Attributes:
        name: Display name as extracted (e.g., "Masha").
        normalized_name: Lowercase key for deduplication.
        event_count: Number of events with this person.
        total_hours: Total hours from events.
        events: List of events with this person.
        linked_email: Email if merged with email-based friend.
    """

    name: str
    normalized_name: str
    event_count: int
    total_hours: float
    events: list[FriendEvent] = field(default_factory=list)
    linked_email: str | None = None


@dataclass
class ActivityEvent:
    """A personal activity event (fitness, wellness, etc.).

    Attributes:
        id: Event ID.
        summary: Event title.
        date: Event date (YYYY-MM-DD).
        hours: Duration in hours.
        category: Activity category (fitness, wellness, health, etc.).
        activity_type: Specific activity (yoga, gym, therapy, etc.).
        venue_name: Venue if available.
        neighborhood: Neighborhood if available.
    """

    id: str
    summary: str | None
    date: str
    hours: float
    category: str
    activity_type: str
    venue_name: str | None = None
    neighborhood: str | None = None


@dataclass
class ActivityCategoryStats:
    """Aggregated stats for an activity category.

    Attributes:
        category: Category name (fitness, wellness, etc.).
        event_count: Number of events in this category.
        total_hours: Total hours spent.
        top_venues: List of (venue, count) tuples.
        top_activities: List of (activity_type, count) tuples.
    """

    category: str
    event_count: int
    total_hours: float
    top_venues: list[tuple[str, int]]
    top_activities: list[tuple[str, int]]


@dataclass
class MergeSuggestion:
    """Suggestion to link inferred friend to email-based friend.

    Attributes:
        inferred_name: Name extracted from events.
        suggested_email: Email that might match.
        confidence: high/medium/low.
        reason: Why this match was suggested.
    """

    inferred_name: str
    suggested_email: str
    confidence: str
    reason: str
