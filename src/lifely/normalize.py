"""Normalize raw Google Calendar API events into clean dataclasses.

Handles timezone conversion, duration calculation, and attendee processing.
"""

from datetime import datetime
from zoneinfo import ZoneInfo

from dateutil import parser as dateutil_parser

from .models import NormalizedAttendee, NormalizedEvent

DEFAULT_TIMEZONE = "America/New_York"


def normalize_events(
    raw_events: list[dict],
    user_email: str,
    timezone: str = DEFAULT_TIMEZONE,
) -> list[NormalizedEvent]:
    """Convert raw Calendar API events to normalized dataclasses.

    Args:
        raw_events: List of event dicts from Calendar API.
        user_email: The authenticated user's email (for self-detection).
        timezone: Target timezone for all times (default: America/New_York).

    Returns:
        List of NormalizedEvent objects.
    """
    tz = ZoneInfo(timezone)
    user_email_lower = user_email.lower()
    normalized = []

    for raw in raw_events:
        event = _normalize_single_event(raw, user_email_lower, tz)
        if event:
            normalized.append(event)

    return normalized


def _normalize_single_event(
    raw: dict,
    user_email_lower: str,
    tz: ZoneInfo,
) -> NormalizedEvent | None:
    """Normalize a single raw event.

    Returns None if the event should be skipped (e.g., cancelled).
    """
    # Skip cancelled events
    if raw.get("status") == "cancelled":
        return None

    # Parse start/end times
    start, all_day = _parse_event_time(raw.get("start", {}), tz)
    end, _ = _parse_event_time(raw.get("end", {}), tz)

    if not start or not end:
        return None

    # Calculate duration
    duration_minutes = (end - start).total_seconds() / 60

    # Normalize attendees
    attendees = _normalize_attendees(raw.get("attendees", []), user_email_lower)

    # Parse metadata timestamps
    created = _parse_timestamp(raw.get("created"))
    updated = _parse_timestamp(raw.get("updated"))

    return NormalizedEvent(
        id=raw["id"],
        summary=raw.get("summary"),
        description=raw.get("description"),
        start=start,
        end=end,
        all_day=all_day,
        duration_minutes=duration_minutes,
        attendees=attendees,
        organizer_email=raw.get("organizer", {}).get("email"),
        location_raw=raw.get("location"),
        created=created,
        updated=updated,
        recurring_event_id=raw.get("recurringEventId"),
    )


def _parse_event_time(time_obj: dict, tz: ZoneInfo) -> tuple[datetime | None, bool]:
    """Parse a Calendar API start/end time object.

    Args:
        time_obj: Dict with either 'dateTime' or 'date' key.
        tz: Target timezone.

    Returns:
        Tuple of (datetime in target tz, is_all_day).
    """
    if not time_obj:
        return None, False

    # All-day events use 'date' (YYYY-MM-DD)
    if "date" in time_obj:
        date_str = time_obj["date"]
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        # All-day events: use midnight in target timezone
        return dt.replace(tzinfo=tz), True

    # Timed events use 'dateTime'
    if "dateTime" in time_obj:
        dt = dateutil_parser.isoparse(time_obj["dateTime"])
        # Convert to target timezone
        return dt.astimezone(tz), False

    return None, False


def _normalize_attendees(
    raw_attendees: list[dict],
    user_email_lower: str,
) -> list[NormalizedAttendee]:
    """Normalize the attendees list.

    Args:
        raw_attendees: List of attendee dicts from API.
        user_email_lower: User's email (lowercased) for self-detection.

    Returns:
        List of NormalizedAttendee objects.
    """
    attendees = []

    for raw in raw_attendees:
        email = raw.get("email", "").lower()

        # Detect self: use API's self flag, or fall back to email comparison
        is_self = raw.get("self", False) or email == user_email_lower

        attendee = NormalizedAttendee(
            email=email,
            display_name=raw.get("displayName"),
            is_self=is_self,
            response_status=raw.get("responseStatus"),
        )
        attendees.append(attendee)

    return attendees


def _parse_timestamp(timestamp_str: str | None) -> datetime | None:
    """Parse an ISO timestamp string to datetime."""
    if not timestamp_str:
        return None
    try:
        return dateutil_parser.isoparse(timestamp_str)
    except (ValueError, TypeError):
        return None
