"""Minimal Google Places helper for resolving opaque Maps URLs.

Only used when a Google Maps link is present and we have a Places API key.
Falls back quietly on errors to avoid blocking the main pipeline.
"""

import json
import os
from pathlib import Path
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

from .models import LocationEnrichment

DEFAULT_DATA_DIR = Path(os.environ.get("LIFELY_DATA_DIR", "data"))
PLACES_CACHE_FILENAME = "places_cache.json"


def looks_like_maps_url(location: str) -> bool:
    """Return True if the string resembles a Google Maps share link."""
    try:
        parsed = urlparse(location)
    except Exception:
        return False

    host = parsed.netloc.lower()
    return any(
        key in host
        for key in (
            "maps.google.com",
            "google.com/maps",
            "goo.gl/maps",
            "maps.app.goo.gl",
        )
    )


def load_places_cache(data_dir: Path | None = None) -> dict:
    path = (data_dir or DEFAULT_DATA_DIR) / PLACES_CACHE_FILENAME
    if not path.exists():
        return {}
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return {}


def save_places_cache(cache: dict, data_dir: Path | None = None) -> None:
    path = (data_dir or DEFAULT_DATA_DIR) / PLACES_CACHE_FILENAME
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(cache, f, indent=2)


def resolve_place_from_location_string(
    location: str,
    api_key: str | None,
    cache: dict,
) -> LocationEnrichment | None:
    """Resolve a Google Maps URL or text using Places API.

    Returns LocationEnrichment with best-effort venue/name data or None.
    """
    if not api_key or not location:
        return None

    if location in cache:
        cached = cache[location]
        return LocationEnrichment(
            venue_name=cached.get("venue_name"),
            neighborhood=cached.get("neighborhood"),
            city=cached.get("city"),
            cuisine=cached.get("cuisine"),
            latitude=cached.get("latitude"),
            longitude=cached.get("longitude"),
        )

    place_id, name, address, types, lat, lng = _find_place(location, api_key)
    if not place_id and not name:
        return None

    latitude = lat
    longitude = lng
    if place_id:
        details = _get_place_details(place_id, api_key)
        if details:
            name = details.get("displayName", {}).get("text", name)
            address = details.get("formattedAddress", address)
            types = details.get("types", types)
            neighborhood, city = _derive_neighborhood_city(details.get("addressComponents", []))
            loc = details.get("location", {}) if isinstance(details, dict) else {}
            latitude = loc.get("latitude", latitude)
            longitude = loc.get("longitude", longitude)
        else:
            neighborhood, city = None, None
    else:
        neighborhood, city = None, None

    cuisine = _derive_cuisine(types)
    enrichment = LocationEnrichment(
        venue_name=name,
        neighborhood=neighborhood,
        city=city,
        cuisine=cuisine,
        latitude=latitude,
        longitude=longitude,
    )

    cache[location] = {
        "venue_name": enrichment.venue_name,
        "neighborhood": enrichment.neighborhood,
        "city": enrichment.city,
        "cuisine": enrichment.cuisine,
        "place_id": place_id,
        "address": address,
        "latitude": latitude,
        "longitude": longitude,
    }
    return enrichment


def _find_place(
    location: str, api_key: str
) -> tuple[str | None, str | None, str | None, list[str], float | None, float | None]:
    """Find a place using Places API (New) text search."""
    url = "https://places.googleapis.com/v1/places:searchText"
    payload = {"textQuery": location}
    field_mask = "places.id,places.displayName,places.formattedAddress,places.types,places.location"
    data = _http_post_json(url, payload, api_key, field_mask)
    places = data.get("places") if isinstance(data, dict) else None
    if not places:
        return None, None, None, [], None, None
    first = places[0]
    loc = first.get("location", {}) if isinstance(first, dict) else {}
    return (
        first.get("id"),
        (first.get("displayName") or {}).get("text"),
        first.get("formattedAddress"),
        first.get("types", []),
        loc.get("latitude"),
        loc.get("longitude"),
    )


def _get_place_details(place_id: str, api_key: str) -> dict | None:
    url = f"https://places.googleapis.com/v1/places/{quote(place_id)}"
    field_mask = "id,displayName,formattedAddress,addressComponents,types,location"
    return _http_get_json(url, api_key, field_mask)


def _derive_neighborhood_city(components: list[dict]) -> tuple[str | None, str | None]:
    neighborhood = None
    city = None

    for comp in components:
        types = comp.get("types", [])
        name = comp.get("longText") or comp.get("long_name")
        if not neighborhood and any(t in types for t in ("neighborhood", "sublocality", "sublocality_level_1")):
            neighborhood = name
        if not city and any(t in types for t in ("locality", "postal_town", "administrative_area_level_2")):
            city = name
        if neighborhood and city:
            break

    # NYC boroughs often appear as sublocality; use that as city if nothing else
    if not city:
        for comp in components:
            types = comp.get("types", [])
            if "sublocality" in types or "sublocality_level_1" in types:
                city = comp.get("longText") or comp.get("long_name")
                break

    return neighborhood, city


def _derive_cuisine(types: list[str]) -> str | None:
    for t in types:
        if t.endswith("_restaurant"):
            return t.removesuffix("_restaurant").replace("_", " ").title()
        if t.endswith("_food"):
            return t.removesuffix("_food").replace("_", " ").title()
    return None


def _http_get_json(url: str, api_key: str | None = None, field_mask: str | None = None) -> dict:
    headers = {}
    if api_key:
        headers["X-Goog-Api-Key"] = api_key
    if field_mask:
        headers["X-Goog-FieldMask"] = field_mask
    req = Request(url, headers=headers)
    try:
        with urlopen(req, timeout=10) as resp:
            if resp.status != 200:
                return {}
            data = resp.read()
            return json.loads(data.decode("utf-8"))
    except Exception:
        return {}


def _http_post_json(url: str, payload: dict, api_key: str, field_mask: str) -> dict:
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": field_mask,
    }
    body = json.dumps(payload).encode("utf-8")
    req = Request(url, data=body, headers=headers, method="POST")
    try:
        with urlopen(req, timeout=10) as resp:
            if resp.status != 200:
                return {}
            data = resp.read()
            return json.loads(data.decode("utf-8"))
    except Exception:
        return {}
