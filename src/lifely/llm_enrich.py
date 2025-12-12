"""LLM-based enrichment for calendar events.

Uses OpenAI to extract location details and classify events.
Async batch processing with caching to reduce cost.
"""

import asyncio
import json
import os
from collections import Counter, defaultdict
from pathlib import Path

from openai import AsyncOpenAI

from .models import (
    ActivityCategoryStats,
    ActivityEvent,
    ExperimentIdea,
    FriendEvent,
    FriendStats,
    Insight,
    InferredFriend,
    LocationEnrichment,
    NarrativeOutput,
    MergeSuggestion,
    NormalizedEvent,
    TimeStats,
)
from .places import (
    load_places_cache,
    looks_like_maps_url,
    resolve_place_from_location_string,
    save_places_cache,
)


LOCATION_PROMPT = """Extract location details from these calendar events.

For each event with location data, extract:
- venue_name: Business/place name (e.g., "Thai Villa", "Equinox", "AMC Theater")
- neighborhood: NYC neighborhood or district. Infer from address when possible:
  - Lower Manhattan: FiDi, Tribeca, SoHo, NoHo, Chinatown, LES, East Village, West Village, Greenwich Village
  - Midtown: Midtown East, Midtown West, Hell's Kitchen, Hudson Yards, Koreatown, Murray Hill, Kips Bay
  - Upper: Upper East Side, Upper West Side, Harlem
  - Brooklyn: Williamsburg, DUMBO, Park Slope, Bushwick, Greenpoint, Brooklyn Heights
  - Example: "34th Street" → "Midtown", "6th Ave & 32nd St" → "Koreatown", "Bowery" → "East Village"
- city: Borough or city (e.g., "Manhattan", "Brooklyn", "Queens", "New York")
- cuisine: Food type if restaurant/bar (e.g., "Thai", "Italian", "Japanese", "Korean", "American")

Rules:
- ALWAYS try to infer neighborhood from NYC street addresses
- For non-food venues, leave cuisine as null
- Skip events with no location data or private addresses (apartments, homes)

Events:
{events_json}

Return JSON: {{"results": [
  {{"event_id": "...", "venue_name": "...", "neighborhood": "...", "city": "...", "cuisine": "..."}}
]}}
"""


CLASSIFICATION_PROMPT = """Classify these calendar events into SOCIAL, ACTIVITY, or OTHER.

For each event, determine:
1. **SOCIAL** - Meeting with specific people (friends, family, dates)
   - Extract `names`: list of person names mentioned
   - Examples: "Dinner with Masha" → ["Masha"], "Coffee w/ John & Sarah" → ["John", "Sarah"]
   - "1:1 Bob" → ["Bob"], "Mom's birthday" → ["Mom"]

2. **ACTIVITY** - Personal activities you do solo or at a venue
   - Extract `category`, `activity_type`, and `venue` (if mentioned in summary)
   - Categories:
     - fitness: gym, yoga, climbing, running, pilates, cycling, swimming, CrossFit
     - wellness: spa, massage, meditation, acupuncture, sauna, float tank
     - health: doctor, dentist, therapy, physical therapy, dermatologist
     - personal_care: haircut, nails, facial, waxing, barber
     - learning: class, lesson, workshop, course, tutoring
     - entertainment: movie, concert, show, museum, theater, comedy
   - Extract venue from summary if present:
     - "Yoga @ Vital" → venue: "Vital"
     - "Climbing at Brooklyn Boulders" → venue: "Brooklyn Boulders"
     - "Gym" → venue: null (no specific venue)

3. **OTHER** - Skip these (work, reminders, travel logistics, chores)
   - Examples: "Team standup", "Flight to LA", "Pay rent", "Block: focus time"

Events:
{events_json}

Return JSON: {{"results": [
  {{"event_id": "...", "type": "SOCIAL", "names": ["..."]}} or
  {{"event_id": "...", "type": "ACTIVITY", "category": "...", "activity_type": "...", "venue": "..."}} or
  {{"event_id": "...", "type": "OTHER"}}
]}}
"""


BATCH_SIZE = int(os.environ.get("LIFELY_LLM_BATCH_SIZE", "30"))  # Events per API call
MAX_CONCURRENT_BATCHES = int(os.environ.get("LIFELY_LLM_MAX_CONCURRENCY", "2"))
REQUEST_TIMEOUT = float(os.environ.get("LIFELY_LLM_TIMEOUT", "90"))
LOCATION_MODEL = os.environ.get("LIFELY_LLM_LOCATION_MODEL", "gpt-5.2")
CLASSIFICATION_MODEL = os.environ.get("LIFELY_LLM_CLASSIFICATION_MODEL", "gpt-5.2")
LLM_CACHE_FILENAME = "llm_cache.json"
NARRATIVE_MODEL = os.environ.get("LIFELY_LLM_NARRATIVE_MODEL", "gpt-5.2")
INSIGHTS_MODEL = os.environ.get("LIFELY_LLM_INSIGHTS_MODEL", "gpt-5.2")


def _shorten_text(text: str | None, max_len: int = 180) -> str:
    """Trim text for LLM prompts to keep payloads small."""
    if not text:
        return ""
    return text.strip()[:max_len]


def _shorten_location(location: str | None, max_len: int = 160) -> str:
    """Trim locations (esp. long map URLs) before sending to the LLM."""
    if not location:
        return ""
    trimmed = location.strip()
    if trimmed.startswith("http"):
        trimmed = trimmed.split("?", 1)[0]
    return trimmed[:max_len]


async def enrich_all_events(
    events: list[NormalizedEvent],
    api_key: str | None = None,
) -> dict[str, LocationEnrichment]:
    """Enrich ALL events with location data via LLM (async).

    Args:
        events: List of NormalizedEvents to enrich.
        api_key: OpenAI API key. Defaults to OPENAI_API_KEY env var.

    Returns:
        Dict mapping event_id -> LocationEnrichment for events with locations.
    """
    api_key = api_key or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY not set")

    data_dir = _data_dir()
    llm_cache = _load_llm_cache(data_dir)
    location_cache = llm_cache.setdefault("locations_by_location", {})
    places_cache = load_places_cache(data_dir)
    maps_api_key = os.environ.get("GOOGLE_MAPS_API_KEY")

    enrichment_lookup: dict[str, LocationEnrichment] = {}

    # Deduplicate by location to reduce tokens
    seen_locations: dict[str, list[str]] = {}  # location -> [event_ids]
    unique_events = []
    event_location_lookup: dict[str, str] = {}
    geocode_targets: set[str] = set()

    for e in events:
        if not e.location_raw:
            continue
        loc = e.location_raw.strip()
        if not loc:
            continue

        seen_locations.setdefault(loc, []).append(e.id)
        event_location_lookup[e.id] = loc

        cached = location_cache.get(loc)
        if cached:
            enrichment_lookup[e.id] = _location_enrichment_from_cache(e.id, cached)
            if maps_api_key and (
                cached.get("latitude") is None or cached.get("longitude") is None
            ):
                geocode_targets.add(loc)
            continue

        # Try Places API for opaque map links before LLM
        if maps_api_key and looks_like_maps_url(loc):
            resolved = resolve_place_from_location_string(loc, maps_api_key, places_cache)
            if resolved:
                resolved.event_id = e.id
                enrichment_lookup[e.id] = resolved
                location_cache[loc] = _cache_from_enrichment(resolved)
                continue

        if maps_api_key:
            geocode_targets.add(loc)

        # Only send each unique location to the LLM once
        if len(seen_locations[loc]) == 1:  # first time we saw this location
            unique_events.append(
                {
                    "event_id": e.id,
                    "summary": _shorten_text(e.summary),
                    "location": _shorten_location(loc),
                }
            )

    if not unique_events and not geocode_targets:
        _save_llm_cache(llm_cache, data_dir)
        save_places_cache(places_cache, data_dir)
        return enrichment_lookup

    # Call OpenAI with async parallel batches
    client = AsyncOpenAI(api_key=api_key)
    enrichments = await _call_openai_parallel(
        client, unique_events, LOCATION_PROMPT, _parse_location_results, model=LOCATION_MODEL
    )

    # Build lookup: event_id -> enrichment
    for e in enrichments:
        enrichment_lookup[e.event_id] = e
        loc = event_location_lookup.get(e.event_id)
        if loc:
            location_cache[loc] = _cache_from_enrichment(e)

    # Propagate enrichments to all events with same location
    for event in unique_events:
        loc = event["location"]
        for eid in seen_locations.get(loc, []):
            if eid in enrichment_lookup:
                continue
            template = enrichment_lookup.get(event["event_id"])
            if template:
                enrichment_lookup[eid] = LocationEnrichment(
                    event_id=eid,
                    venue_name=template.venue_name,
                    neighborhood=template.neighborhood,
                    city=template.city,
                    cuisine=template.cuisine,
                    latitude=template.latitude,
                    longitude=template.longitude,
                )

    # Fill in lat/lng via Places for address-like strings (not just Maps URLs)
    if maps_api_key and geocode_targets:
        for loc in geocode_targets:
            cached = location_cache.get(loc, {})
            if cached.get("latitude") is not None and cached.get("longitude") is not None:
                continue
            low = loc.lower()
            if low.startswith(("http://", "https://")):
                continue
            if any(bad in low for bad in ("zoom", "google meet", "meet link", "see attached")):
                continue
            resolved = resolve_place_from_location_string(loc, maps_api_key, places_cache)
            if not resolved:
                continue

            # Merge into cache
            cached.update(
                {
                    "venue_name": cached.get("venue_name") or resolved.venue_name,
                    "neighborhood": cached.get("neighborhood") or resolved.neighborhood,
                    "city": cached.get("city") or resolved.city,
                    "cuisine": cached.get("cuisine") or resolved.cuisine,
                    "latitude": resolved.latitude,
                    "longitude": resolved.longitude,
                }
            )
            location_cache[loc] = cached

            # Patch existing enrichments for all events at this location
            for eid in seen_locations.get(loc, []):
                enr = enrichment_lookup.get(eid)
                if enr:
                    if enr.latitude is None:
                        enr.latitude = resolved.latitude
                        enr.longitude = resolved.longitude
                    if not enr.neighborhood and resolved.neighborhood:
                        enr.neighborhood = resolved.neighborhood
                    if not enr.city and resolved.city:
                        enr.city = resolved.city
                    if not enr.cuisine and resolved.cuisine:
                        enr.cuisine = resolved.cuisine
                else:
                    enrichment_lookup[eid] = LocationEnrichment(
                        event_id=eid,
                        venue_name=resolved.venue_name,
                        neighborhood=resolved.neighborhood,
                        city=resolved.city,
                        cuisine=resolved.cuisine,
                        latitude=resolved.latitude,
                        longitude=resolved.longitude,
                    )

    _save_llm_cache(llm_cache, data_dir)
    save_places_cache(places_cache, data_dir)
    return enrichment_lookup


async def classify_solo_events(
    events: list[NormalizedEvent],
    enrichment_lookup: dict[str, LocationEnrichment] | None = None,
    api_key: str | None = None,
) -> tuple[list[InferredFriend], dict[str, ActivityCategoryStats]]:
    """Classify events into SOCIAL/ACTIVITY/OTHER (now includes invite-based)."""
    api_key = api_key or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY not set")

    data_dir = _data_dir()
    llm_cache = _load_llm_cache(data_dir)
    classification_cache = llm_cache.setdefault("classification_by_summary", {})

    events_for_classification = []
    summary_to_events: dict[str, list[dict]] = defaultdict(list)
    classification_by_id: dict[str, dict] = {}
    summary_for_event: dict[str, str] = {}
    event_meta_by_id: dict[str, dict] = {}
    prompt_event_by_summary: dict[str, dict] = {}

    for e in events:
        if not e.summary:
            continue
        event_payload = {
            "event_id": e.id,
            "summary": e.summary,
            "date": e.start.strftime("%Y-%m-%d"),
            "hours": round(e.duration_minutes / 60, 1),
            "location_raw": e.location_raw,
        }
        summary_key = e.summary.lower().strip()
        summary_to_events[summary_key].append(event_payload)
        summary_for_event[e.id] = summary_key
        event_meta_by_id[e.id] = event_payload
        location_hint = _shorten_location(e.location_raw)
        prompt_event_by_summary.setdefault(
            summary_key,
            {
                "event_id": e.id,
                "summary": _shorten_text(e.summary),
                **({"location_hint": location_hint} if location_hint else {}),
            },
        )

        cached = classification_cache.get(summary_key)
        if cached:
            classification_by_id[e.id] = {
                "event_id": e.id,
                **cached,
                "summary": e.summary,
                "date": event_payload["date"],
                "hours": event_payload["hours"],
                "location_raw": e.location_raw,
            }

    # Build unique events to send to LLM (uncached summaries only)
    for summary_key, grouped_events in summary_to_events.items():
        if summary_key in classification_cache:
            continue
        if summary_key in prompt_event_by_summary:
            events_for_classification.append(prompt_event_by_summary[summary_key])

    if events_for_classification:
        client = AsyncOpenAI(api_key=api_key)
        classifications = await _call_openai_parallel(
            client,
            events_for_classification,
            CLASSIFICATION_PROMPT,
            _parse_classification_results,
            model=CLASSIFICATION_MODEL,
        )

        for c in classifications:
            event_id = c.get("event_id")
            summary_key = summary_for_event.get(event_id)
            if not summary_key:
                continue
            cached_payload = {k: v for k, v in c.items() if k != "event_id"}
            classification_cache[summary_key] = cached_payload
            event_meta = event_meta_by_id.get(event_id, {})
            classification_by_id[event_id] = {
                "event_id": event_id,
                **cached_payload,
                "summary": event_meta.get("summary"),
                "date": event_meta.get("date"),
                "hours": event_meta.get("hours"),
                "location_raw": event_meta.get("location_raw"),
            }

        # Propagate new classifications to same-summary events
        for summary_key, grouped_events in summary_to_events.items():
            cached = classification_cache.get(summary_key)
            if not cached:
                continue
            for ev in grouped_events:
                if ev["event_id"] in classification_by_id:
                    continue
                classification_by_id[ev["event_id"]] = {
                    "event_id": ev["event_id"],
                    **cached,
                    "summary": ev.get("summary"),
                    "date": ev.get("date"),
                    "hours": ev.get("hours"),
                    "location_raw": ev.get("location_raw"),
                }

    _save_llm_cache(llm_cache, data_dir)

    if not classification_by_id:
        return [], {}

    # Aggregate SOCIAL events into InferredFriends
    inferred_friends = _aggregate_inferred_friends(
        list(summary_for_event.keys()), classification_by_id, enrichment_lookup
    )

    # Aggregate ACTIVITY events into ActivityCategoryStats
    activity_stats = _aggregate_activity_stats(
        list(summary_for_event.keys()), classification_by_id, enrichment_lookup
    )

    return inferred_friends, activity_stats


def _aggregate_inferred_friends(
    event_ids: list[str],
    classification_by_id: dict[str, dict],
    enrichment_lookup: dict[str, LocationEnrichment] | None,
) -> list[InferredFriend]:
    """Aggregate SOCIAL events by extracted name."""
    by_name: dict[str, dict] = defaultdict(
        lambda: {"display_name": None, "events": [], "total_hours": 0.0}
    )

    for event_id in event_ids:
        classification = classification_by_id.get(event_id)
        if not classification or classification.get("type") != "SOCIAL":
            continue

        names = classification.get("names", [])
        if not names:
            continue

        # Get enrichment data if available
        enrichment = enrichment_lookup.get(event_id) if enrichment_lookup else None

        for name in names:
            if not name:
                continue
            key = name.strip().lower()
            by_name[key]["total_hours"] += classification.get("hours", 0) or 0
            by_name[key]["events"].append(
                FriendEvent(
                    id=event_id,
                    summary=classification.get("summary"),
                    date=classification.get("date"),
                    hours=classification.get("hours", 0) or 0,
                    location_raw=classification.get("location_raw"),
                    venue_name=enrichment.venue_name if enrichment else None,
                    neighborhood=enrichment.neighborhood if enrichment else None,
                    cuisine=enrichment.cuisine if enrichment else None,
                )
            )
            if by_name[key]["display_name"] is None:
                by_name[key]["display_name"] = name.strip()

    # Convert to InferredFriend objects
    friends = [
        InferredFriend(
            name=data["display_name"],
            normalized_name=key,
            event_count=len(data["events"]),
            total_hours=round(data["total_hours"], 1),
            events=data["events"],
        )
        for key, data in by_name.items()
    ]

    # Sort by event count descending
    friends.sort(key=lambda x: (x.event_count, x.total_hours), reverse=True)

    return friends


def _aggregate_activity_stats(
    event_ids: list[str],
    classification_by_id: dict[str, dict],
    enrichment_lookup: dict[str, LocationEnrichment] | None,
) -> dict[str, ActivityCategoryStats]:
    """Aggregate ACTIVITY events by category."""
    by_category: dict[str, dict] = defaultdict(
        lambda: {"events": [], "total_hours": 0.0, "venues": Counter(), "types": Counter()}
    )

    for event_id in event_ids:
        classification = classification_by_id.get(event_id)
        if not classification or classification.get("type") != "ACTIVITY":
            continue

        category = classification.get("category", "other")
        activity_type = classification.get("activity_type", "unknown")

        # Get enrichment data if available
        enrichment = enrichment_lookup.get(event_id) if enrichment_lookup else None

        # Prefer venue from classification (extracted from summary like "Yoga @ Vital")
        # Fall back to venue from location enrichment
        venue_from_classification = classification.get("venue")
        venue_name = venue_from_classification or (enrichment.venue_name if enrichment else None)

        activity_event = ActivityEvent(
            id=event_id,
            summary=classification.get("summary"),
            date=classification.get("date"),
            hours=classification.get("hours", 0) or 0,
            category=category,
            activity_type=activity_type,
            venue_name=venue_name,
            neighborhood=enrichment.neighborhood if enrichment else None,
        )

        by_category[category]["events"].append(activity_event)
        by_category[category]["total_hours"] += classification.get("hours", 0) or 0
        if activity_event.venue_name:
            by_category[category]["venues"][activity_event.venue_name] += 1
        if activity_type:
            by_category[category]["types"][activity_type] += 1

    return {
        cat: ActivityCategoryStats(
            category=cat,
            event_count=len(data["events"]),
            total_hours=round(data["total_hours"], 1),
            top_venues=data["venues"].most_common(5),
            top_activities=data["types"].most_common(5),
        )
        for cat, data in by_category.items()
    }


def suggest_merges(
    inferred: list[InferredFriend],
    email_friends: list[FriendStats],
) -> list[MergeSuggestion]:
    """Suggest links between inferred names and email friends."""
    suggestions = []

    for inf in inferred:
        for ef in email_friends:
            email_prefix = ef.email.split("@")[0].lower()
            # Check if inferred name appears in email prefix
            if inf.normalized_name in email_prefix or email_prefix in inf.normalized_name:
                # Check if display name also matches
                display_match = ef.display_name and inf.normalized_name in ef.display_name.lower()
                confidence = "high" if display_match else "medium"
                suggestions.append(
                    MergeSuggestion(
                        inferred_name=inf.name,
                        suggested_email=ef.email,
                        confidence=confidence,
                        reason=f"'{inf.name}' matches email prefix '{email_prefix}'",
                    )
                )

    return suggestions


def apply_enrichments_to_friend_stats(
    friend_stats: list[FriendStats],
    enrichment_lookup: dict[str, LocationEnrichment],
) -> list[FriendStats]:
    """Apply location enrichments to FriendStats events.

    Args:
        friend_stats: List of FriendStats to update.
        enrichment_lookup: Dict mapping event_id -> LocationEnrichment.

    Returns:
        The same list with events enriched.
    """
    for friend in friend_stats:
        for event in friend.events:
            if event.id in enrichment_lookup:
                e = enrichment_lookup[event.id]
                event.venue_name = e.venue_name
                event.neighborhood = e.neighborhood
                event.cuisine = e.cuisine
    return friend_stats


async def _call_openai_parallel(
    client: AsyncOpenAI,
    events: list[dict],
    prompt_template: str,
    parse_fn,
    model: str,
    timeout: float = REQUEST_TIMEOUT,
) -> list:
    """Call OpenAI with parallel batches for speed, with concurrency limit."""
    if not events:
        return []

    # Create batches
    batches = [events[i : i + BATCH_SIZE] for i in range(0, len(events), BATCH_SIZE)]

    # Use semaphore to limit concurrent requests
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_BATCHES)

    async def limited_batch(batch):
        async with semaphore:
            return await _call_openai_batch(
                client, batch, prompt_template, parse_fn, model=model, timeout=timeout
            )

    # Run batches with concurrency limit
    tasks = [limited_batch(batch) for batch in batches]
    results = await asyncio.gather(*tasks)

    # Flatten results
    all_results = []
    for batch_result in results:
        all_results.extend(batch_result)

    return all_results


async def _call_openai_batch(
    client: AsyncOpenAI,
    events: list[dict],
    prompt_template: str,
    parse_fn,
    model: str,
    timeout: float,
    max_retries: int = 5,
) -> list:
    """Call OpenAI for a single batch of events with retry logic."""
    prompt = prompt_template.format(events_json=json.dumps(events, separators=(",", ":")))
    last_error: Exception | None = None

    for attempt in range(max_retries):
        try:
            response = await client.responses.create(
                model=model,
                input=prompt,
                timeout=timeout,
            )

            content = response.output_text
            if not content:
                return []

            # Extract JSON from response (may be wrapped in markdown code block)
            json_str = content
            if "```json" in content:
                json_str = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                json_str = content.split("```")[1].split("```")[0].strip()

            try:
                data = json.loads(json_str)
                return parse_fn(data)
            except (json.JSONDecodeError, KeyError):
                return []

        except Exception as e:
            last_error = e
            error_str = str(e).lower()
            is_rate_limit = "429" in error_str or "rate_limit" in error_str
            is_timeout = "timeout" in error_str or "timed out" in error_str
            if is_rate_limit or is_timeout:
                # Exponential backoff: 5s, 10s, 20s, 40s, 80s
                wait_time = 5 * (2 ** attempt)
                await asyncio.sleep(wait_time)
                continue
            raise

    if last_error:
        raise last_error
    return []  # All retries failed


def _parse_location_results(data: dict) -> list[LocationEnrichment]:
    """Parse location enrichment results from LLM response."""
    results = data.get("results", [])
    return [
        LocationEnrichment(
            event_id=r.get("event_id", ""),
            venue_name=r.get("venue_name"),
            neighborhood=r.get("neighborhood"),
            city=r.get("city"),
            cuisine=r.get("cuisine"),
            latitude=r.get("latitude"),
            longitude=r.get("longitude"),
        )
        for r in results
    ]


def _parse_classification_results(data: dict) -> list[dict]:
    """Parse classification results from LLM response."""
    return data.get("results", [])


# ═══════════════════════════════════════════════════════════
# PARALLEL EXECUTION - Run both LLM operations concurrently
# ═══════════════════════════════════════════════════════════


async def enrich_and_classify_all(
    events: list[NormalizedEvent],
    api_key: str | None = None,
) -> tuple[
    dict[str, LocationEnrichment],
    list[InferredFriend],
    dict[str, ActivityCategoryStats],
]:
    """Run location enrichment AND classification in parallel.

    This is ~2x faster than sequential because both LLM operations
    run concurrently. The classification runs without enrichment data
    initially, then we patch in the location details afterward.

    Args:
        events: All normalized events.
        api_key: OpenAI API key.

    Returns:
        Tuple of (enrichment_lookup, inferred_friends, activity_stats).
    """
    # Run both async operations concurrently
    enrichment_lookup, (inferred_friends, activity_stats) = await asyncio.gather(
        enrich_all_events(events, api_key),
        classify_solo_events(events, enrichment_lookup=None, api_key=api_key),
    )

    # Patch enrichment data into inferred friend events
    for friend in inferred_friends:
        for event in friend.events:
            enrichment = enrichment_lookup.get(event.id)
            if enrichment:
                event.venue_name = event.venue_name or enrichment.venue_name
                event.neighborhood = enrichment.neighborhood
                event.cuisine = enrichment.cuisine

    return enrichment_lookup, inferred_friends, activity_stats


def enrich_and_classify_all_sync(
    events: list[NormalizedEvent],
    api_key: str | None = None,
) -> tuple[
    dict[str, LocationEnrichment],
    list[InferredFriend],
    dict[str, ActivityCategoryStats],
]:
    """Sync wrapper for enrich_and_classify_all (PARALLEL version)."""
    return asyncio.run(enrich_and_classify_all(events, api_key))


# ═══════════════════════════════════════════════════════════
# LEGACY SYNC WRAPPERS (sequential, for backwards compatibility)
# ═══════════════════════════════════════════════════════════


def enrich_all_events_sync(
    events: list[NormalizedEvent],
    api_key: str | None = None,
) -> dict[str, LocationEnrichment]:
    """Sync wrapper for enrich_all_events."""
    return asyncio.run(enrich_all_events(events, api_key))


def classify_solo_events_sync(
    events: list[NormalizedEvent],
    enrichment_lookup: dict[str, LocationEnrichment] | None = None,
    api_key: str | None = None,
) -> tuple[list[InferredFriend], dict[str, ActivityCategoryStats]]:
    """Sync wrapper for classify_solo_events."""
    return asyncio.run(classify_solo_events(events, enrichment_lookup, api_key))


def _data_dir() -> Path:
    return Path(os.environ.get("LIFELY_DATA_DIR", "data"))


def _load_llm_cache(data_dir: Path) -> dict:
    path = data_dir / LLM_CACHE_FILENAME
    if not path.exists():
        return {
            "locations_by_location": {},
            "classification_by_summary": {},
            "narrative_by_year": {},
            "insights_by_year": {},
            "experiments_by_year": {},
        }
    try:
        with open(path) as f:
            cache = json.load(f)
            cache.setdefault("narrative_by_year", {})
            cache.setdefault("insights_by_year", {})
            cache.setdefault("experiments_by_year", {})
            cache.setdefault("locations_by_location", {})
            cache.setdefault("classification_by_summary", {})
            return cache
    except Exception:
        return {
            "locations_by_location": {},
            "classification_by_summary": {},
            "narrative_by_year": {},
            "insights_by_year": {},
            "experiments_by_year": {},
        }


def _save_llm_cache(cache: dict, data_dir: Path) -> None:
    path = data_dir / LLM_CACHE_FILENAME
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(cache, f, indent=2)


def _cache_from_enrichment(enrichment: LocationEnrichment) -> dict:
    return {
        "venue_name": enrichment.venue_name,
        "neighborhood": enrichment.neighborhood,
        "city": enrichment.city,
        "cuisine": enrichment.cuisine,
        "latitude": enrichment.latitude,
        "longitude": enrichment.longitude,
    }


def _location_enrichment_from_cache(event_id: str, cached: dict) -> LocationEnrichment:
    return LocationEnrichment(
        event_id=event_id,
        venue_name=cached.get("venue_name"),
        neighborhood=cached.get("neighborhood"),
        city=cached.get("city"),
        cuisine=cached.get("cuisine"),
        latitude=cached.get("latitude"),
        longitude=cached.get("longitude"),
    )


# ═══════════════════════════════════════════════════════════
# STORY / INSIGHTS / EXPERIMENTS (stats-level LLM calls)
# ═══════════════════════════════════════════════════════════


def _stats_context_from_objects(
    time_stats: TimeStats,
    friend_stats: list[FriendStats],
    inferred_friends: list[InferredFriend],
    location_stats,
    activity_stats: dict[str, ActivityCategoryStats],
    year: int,
    top_n: int = 5,
) -> dict:
    """Build a compact stats payload for LLM calls (keep it small)."""
    month_names = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    events_per_month = time_stats.events_per_month or {}
    busiest_month_num = max(events_per_month, key=events_per_month.get) if events_per_month else None
    busiest_month = month_names[busiest_month_num] if busiest_month_num else None
    events_per_weekday = time_stats.events_per_weekday or {}
    busiest_weekday = max(events_per_weekday, key=events_per_weekday.get) if events_per_weekday else None

    def friend_payload(f: FriendStats) -> dict:
        venues = []
        hoods = set()
        for e in f.events:
            if e.venue_name and e.venue_name not in venues:
                venues.append(e.venue_name)
            if e.neighborhood:
                hoods.add(e.neighborhood)
        name = f.display_name or f.email.split("@")[0]
        return {
            "name": name,
            "events": f.event_count,
            "hours": f.total_hours,
            "venues": venues[:3],
            "neighborhoods": list(hoods)[:3],
        }

    def inferred_payload(f: InferredFriend) -> dict:
        venues = []
        hoods = set()
        for e in f.events:
            if e.venue_name and e.venue_name not in venues:
                venues.append(e.venue_name)
            if e.neighborhood:
                hoods.add(e.neighborhood)
        return {
            "name": f.name,
            "events": f.event_count,
            "hours": f.total_hours,
            "venues": venues[:3],
            "neighborhoods": list(hoods)[:3],
        }

    def activity_payload(a: ActivityCategoryStats) -> dict:
        return {
            "category": a.category,
            "events": a.event_count,
            "hours": a.total_hours,
            "top_activities": [name for name, _ in a.top_activities[:2]],
            "top_venues": [name for name, _ in a.top_venues[:2]],
        }

    locs = location_stats or None

    return {
        "year": year,
        "total_events": time_stats.total_events,
        "total_hours": time_stats.total_hours,
        "busiest_month": busiest_month,
        "busiest_weekday": busiest_weekday,
        "top_friends": [friend_payload(f) for f in friend_stats[:top_n]],
        "top_inferred_friends": [inferred_payload(f) for f in inferred_friends[:top_n]],
        "top_neighborhoods": locs.top_neighborhoods if locs else [],
        "top_venues": locs.top_venues if locs else [],
        "top_cuisines": locs.top_cuisines if locs else [],
        "activities": [activity_payload(a) for a in activity_stats.values()],
    }


NARRATIVE_PROMPT = """You are a warm, data-grounded concierge with a wink. Write a short narrative about this person's year.

Context (JSON):
{context_json}

Rules:
- 3-5 sentences.
- Ground every claim in provided data; do not invent specifics.
- Reference friends, venues, neighborhoods, cuisines, and activities sparingly but specifically.
- Keep tone warm, specific, never cringe. No emojis. No hashtags.

Return ONLY the narrative text, no JSON, no preamble."""

INSIGHTS_PROMPT = """You are summarizing patterns from a year of calendar stats.

Context (JSON):
{context_json}

Return JSON: {{"patterns": [{{"title": "...", "detail": "..."}}]}}
- 3 items max.
- Each detail should be concise (under 140 chars), data-grounded.
- Prioritize streaks, shifts (early vs late year), and notable pairs (person + neighborhood/venue).
"""

EXPERIMENTS_PROMPT = """You are suggesting forward-looking experiments for next year based on this year's stats.

Context (JSON):
{context_json}

Return JSON: {{"experiments": [{{"title": "...", "description": "..."}}]}}
- 3 items max.
- Make suggestions specific to the data (people, cuisines, neighborhoods, activities).
- Keep descriptions short (under 140 chars). No emojis."""


async def generate_story_and_insights(
    time_stats: TimeStats,
    friend_stats: list[FriendStats],
    inferred_friends: list[InferredFriend],
    location_stats,
    activity_stats: dict[str, ActivityCategoryStats],
    year: int,
    api_key: str | None = None,
) -> tuple[NarrativeOutput | None, list[Insight], list[ExperimentIdea]]:
    """Generate narrative, patterns, and experiments from stats (cached by year)."""
    api_key = api_key or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return None, [], []

    data_dir = _data_dir()
    cache = _load_llm_cache(data_dir)
    year_key = str(year)

    narrative_cached = cache.get("narrative_by_year", {}).get(year_key)
    insights_cached = cache.get("insights_by_year", {}).get(year_key, [])
    experiments_cached = cache.get("experiments_by_year", {}).get(year_key, [])

    context = _stats_context_from_objects(
        time_stats, friend_stats, inferred_friends, location_stats, activity_stats, year
    )
    context_json = json.dumps(context, separators=(",", ":"))

    client = AsyncOpenAI(api_key=api_key)

    narrative: NarrativeOutput | None = None
    patterns: list[Insight] = [Insight(title=i.get("title", ""), detail=i.get("detail", "")) for i in insights_cached]
    experiments: list[ExperimentIdea] = [
        ExperimentIdea(title=e.get("title", ""), description=e.get("description", "")) for e in experiments_cached
    ]

    if not narrative_cached:
        narrative_text = await _call_openai_text(client, NARRATIVE_PROMPT.format(context_json=context_json), NARRATIVE_MODEL)
        if narrative_text:
            cache["narrative_by_year"][year_key] = narrative_text
            narrative = NarrativeOutput(story=narrative_text.strip())
    else:
        narrative = NarrativeOutput(story=narrative_cached)

    if not insights_cached:
        patterns_json = await _call_openai_json(
            client, INSIGHTS_PROMPT.format(context_json=context_json), INSIGHTS_MODEL, key="patterns"
        )
        if patterns_json:
            cache["insights_by_year"][year_key] = patterns_json
            patterns = [Insight(title=i.get("title", ""), detail=i.get("detail", "")) for i in patterns_json]

    if not experiments_cached:
        experiments_json = await _call_openai_json(
            client, EXPERIMENTS_PROMPT.format(context_json=context_json), INSIGHTS_MODEL, key="experiments"
        )
        if experiments_json:
            cache["experiments_by_year"][year_key] = experiments_json
            experiments = [
                ExperimentIdea(title=e.get("title", ""), description=e.get("description", ""))
                for e in experiments_json
            ]

    _save_llm_cache(cache, data_dir)
    return narrative, patterns, experiments


def generate_story_and_insights_sync(
    time_stats: TimeStats,
    friend_stats: list[FriendStats],
    inferred_friends: list[InferredFriend],
    location_stats,
    activity_stats: dict[str, ActivityCategoryStats],
    year: int,
    api_key: str | None = None,
) -> tuple[NarrativeOutput | None, list[Insight], list[ExperimentIdea]]:
    """Sync wrapper."""
    return asyncio.run(
        generate_story_and_insights(
            time_stats, friend_stats, inferred_friends, location_stats, activity_stats, year, api_key
        )
    )


async def _call_openai_text(client: AsyncOpenAI, prompt: str, model: str, timeout: float = REQUEST_TIMEOUT) -> str:
    try:
        resp = await client.responses.create(
            model=model,
            input=prompt,
            timeout=timeout,
        )
        return (resp.output_text or "").strip()
    except Exception:
        return ""


async def _call_openai_json(
    client: AsyncOpenAI, prompt: str, model: str, key: str, timeout: float = REQUEST_TIMEOUT
) -> list[dict] | None:
    text = await _call_openai_text(client, prompt, model, timeout)
    if not text:
        return None
    json_str = text
    if "```json" in text:
        json_str = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        json_str = text.split("```")[1].split("```")[0].strip()
    try:
        data = json.loads(json_str)
        return data.get(key, [])
    except Exception:
        return None
