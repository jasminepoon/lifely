"""Fetch events from Google Calendar API.

Handles pagination and caching of raw API responses.
"""

import json
from pathlib import Path

from googleapiclient.discovery import Resource

DEFAULT_DATA_DIR = Path("data")


def fetch_events_for_year(
    service: Resource,
    year: int = 2025,
    calendar_id: str = "primary",
    use_cache: bool = True,
    cache_dir: Path = DEFAULT_DATA_DIR,
) -> list[dict]:
    """Fetch all events for a given year from Google Calendar.

    Expands recurring events into individual instances and handles pagination.

    Args:
        service: Authenticated Calendar API service.
        year: Year to fetch events for.
        calendar_id: Calendar ID to query (default: 'primary').
        use_cache: If True, load from cache if available.
        cache_dir: Directory to store cached responses.

    Returns:
        List of raw event dictionaries from the Calendar API.
    """
    cache_path = cache_dir / f"raw_events_{year}.json"

    # Return cached data if available and requested
    if use_cache and cache_path.exists():
        with open(cache_path) as f:
            return json.load(f)

    # Build time range for the year
    time_min = f"{year}-01-01T00:00:00Z"
    time_max = f"{year + 1}-01-01T00:00:00Z"

    all_events: list[dict] = []
    page_token: str | None = None

    while True:
        # Fetch a page of events
        response = (
            service.events()
            .list(
                calendarId=calendar_id,
                timeMin=time_min,
                timeMax=time_max,
                singleEvents=True,  # Expand recurring events
                orderBy="startTime",
                maxResults=2500,  # Max allowed per page
                pageToken=page_token,
            )
            .execute()
        )

        events = response.get("items", [])
        all_events.extend(events)

        # Check for more pages
        page_token = response.get("nextPageToken")
        if not page_token:
            break

    # Cache the results
    cache_dir.mkdir(parents=True, exist_ok=True)
    with open(cache_path, "w") as f:
        json.dump(all_events, f, indent=2)

    return all_events
