"""Compute statistics from normalized calendar events.

Generates friend rankings, time distributions, and other aggregations.
"""

from collections import Counter, defaultdict

from .models import FriendEvent, FriendStats, LocationStats, NormalizedEvent, TimeStats

# Emails containing these substrings are filtered out as "system" accounts
SYSTEM_EMAIL_PATTERNS = [
    "@resource.calendar.google.com",
    "noreply",
    "no-reply",
    "calendar-notification",
    "@zoom.us",
    "@calendly.com",
    "mailer-daemon",
    "@google.com",  # Google Meet, etc.
]


def compute_friend_stats(
    events: list[NormalizedEvent],
    min_events: int = 1,
) -> list[FriendStats]:
    """Compute statistics for time spent with each person.

    Aggregates by attendee email, excluding self and system accounts.

    Args:
        events: List of normalized events.
        min_events: Minimum events to include a person in results.

    Returns:
        List of FriendStats, sorted by total_hours descending.
    """
    # Aggregate by email
    friend_data: dict[str, dict] = defaultdict(
        lambda: {"display_name": None, "event_count": 0, "total_hours": 0.0, "events": []}
    )

    for event in events:
        event_hours = event.duration_minutes / 60

        for attendee in event.attendees:
            # Skip self
            if attendee.is_self:
                continue

            # Skip declined attendees
            if attendee.response_status == "declined":
                continue

            # Skip system accounts
            if _is_system_email(attendee.email):
                continue

            email = attendee.email
            friend_data[email]["event_count"] += 1
            friend_data[email]["total_hours"] += event_hours

            # Create FriendEvent with summary and location
            friend_event = FriendEvent(
                id=event.id,
                summary=event.summary,
                date=event.start.strftime("%Y-%m-%d"),
                hours=round(event_hours, 1),
                location_raw=event.location_raw,
            )
            friend_data[email]["events"].append(friend_event)

            # Keep the most recent display name
            if attendee.display_name:
                friend_data[email]["display_name"] = attendee.display_name

    # Convert to FriendStats and filter
    stats = [
        FriendStats(
            email=email,
            display_name=data["display_name"],
            event_count=data["event_count"],
            total_hours=round(data["total_hours"], 1),
            events=data["events"],
        )
        for email, data in friend_data.items()
        if data["event_count"] >= min_events
    ]

    # Sort by event count descending (tiebreaker: total hours)
    stats.sort(key=lambda x: (x.event_count, x.total_hours), reverse=True)

    return stats


def compute_time_stats(events: list[NormalizedEvent]) -> TimeStats:
    """Compute time-based statistics for the year.

    Args:
        events: List of normalized events.

    Returns:
        TimeStats with various time aggregations.
    """
    total_events = len(events)
    total_hours = sum(e.duration_minutes for e in events) / 60

    # Per-month aggregations
    events_per_month: dict[int, int] = defaultdict(int)
    hours_per_month: dict[int, float] = defaultdict(float)

    # Per-weekday aggregations
    events_per_weekday: dict[str, int] = defaultdict(int)
    weekday_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    # Per-day aggregations (for finding busiest day)
    events_per_day: dict[str, list[NormalizedEvent]] = defaultdict(list)

    for event in events:
        month = event.start.month
        weekday = weekday_names[event.start.weekday()]
        day_str = event.start.strftime("%Y-%m-%d")

        events_per_month[month] += 1
        hours_per_month[month] += event.duration_minutes / 60
        events_per_weekday[weekday] += 1
        events_per_day[day_str].append(event)

    # Find busiest day
    busiest_day = None
    max_hours = 0.0

    for day_str, day_events in events_per_day.items():
        day_hours = sum(e.duration_minutes for e in day_events) / 60
        if day_hours > max_hours:
            max_hours = day_hours
            busiest_day = (day_str, len(day_events), round(day_hours, 1))

    return TimeStats(
        total_events=total_events,
        total_hours=round(total_hours, 1),
        events_per_month=dict(events_per_month),
        events_per_weekday=dict(events_per_weekday),
        hours_per_month={k: round(v, 1) for k, v in hours_per_month.items()},
        busiest_day=busiest_day,
    )


def _is_system_email(email: str) -> bool:
    """Check if an email belongs to a system/bot account."""
    email_lower = email.lower()
    return any(pattern in email_lower for pattern in SYSTEM_EMAIL_PATTERNS)


def compute_location_stats(
    friend_stats: list[FriendStats],
    enrichment_lookup: dict | None = None,
    top_n: int = 5,
) -> LocationStats:
    """Compute location statistics from ALL enriched events.

    Args:
        friend_stats: List of FriendStats (used if no enrichment_lookup).
        enrichment_lookup: Dict mapping event_id -> LocationEnrichment for ALL events.
        top_n: Number of top items to return for each category.

    Returns:
        LocationStats with top neighborhoods, venues, and cuisines.
    """
    neighborhoods: Counter[str] = Counter()
    venues: Counter[str] = Counter()
    cuisines: Counter[str] = Counter()
    total_with_location = 0

    # If we have enrichment lookup, use ALL enriched events
    if enrichment_lookup:
        for enrichment in enrichment_lookup.values():
            if enrichment.venue_name or enrichment.neighborhood:
                total_with_location += 1
            if enrichment.neighborhood:
                neighborhoods[enrichment.neighborhood] += 1
            if enrichment.venue_name:
                venues[enrichment.venue_name] += 1
            if enrichment.cuisine:
                cuisines[enrichment.cuisine] += 1
    else:
        # Fallback: use friend_stats only
        seen_events: set[str] = set()
        for friend in friend_stats:
            for event in friend.events:
                if event.id in seen_events:
                    continue
                seen_events.add(event.id)

                if event.venue_name or event.neighborhood:
                    total_with_location += 1
                if event.neighborhood:
                    neighborhoods[event.neighborhood] += 1
                if event.venue_name:
                    venues[event.venue_name] += 1
                if event.cuisine:
                    cuisines[event.cuisine] += 1

    return LocationStats(
        top_neighborhoods=neighborhoods.most_common(top_n),
        top_venues=venues.most_common(top_n),
        top_cuisines=cuisines.most_common(top_n),
        total_with_location=total_with_location,
    )
