"""Minimal Google Places helper for resolving opaque Maps URLs.

Only used when a Google Maps link is present and we have a Places API key.
Falls back quietly on errors to avoid blocking the main pipeline.
"""

import json
import os
from pathlib import Path
from urllib.parse import quote_plus, urlparse
from urllib.request import urlopen

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
        )

    place_id, name, address, types = _find_place(location, api_key)
    if not place_id and not name:
        return None

    if place_id:
        details = _get_place_details(place_id, api_key)
        if details:
            name = details.get("name", name)
            address = details.get("formatted_address", address)
            types = details.get("types", types)
            neighborhood, city = _derive_neighborhood_city(details.get("address_components", []))
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
    )

    cache[location] = {
        "venue_name": enrichment.venue_name,
        "neighborhood": enrichment.neighborhood,
        "city": enrichment.city,
        "cuisine": enrichment.cuisine,
        "place_id": place_id,
        "address": address,
    }
    return enrichment


def _find_place(location: str, api_key: str) -> tuple[str | None, str | None, str | None, list[str]]:
    """Find a place_id using Places Find Place from text."""
    url = (
        "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
        f"?input={quote_plus(location)}&inputtype=textquery"
        "&fields=place_id,name,formatted_address,types"
        f"&key={api_key}"
    )
    data = _http_get_json(url)
    candidates = data.get("candidates") if isinstance(data, dict) else None
    if not candidates:
        return None, None, None, []
    first = candidates[0]
    return (
        first.get("place_id"),
        first.get("name"),
        first.get("formatted_address"),
        first.get("types", []),
    )


def _get_place_details(place_id: str, api_key: str) -> dict | None:
    url = (
        "https://maps.googleapis.com/maps/api/place/details/json"
        f"?place_id={quote_plus(place_id)}"
        "&fields=name,formatted_address,address_components,types"
        f"&key={api_key}"
    )
    return _http_get_json(url)


def _derive_neighborhood_city(components: list[dict]) -> tuple[str | None, str | None]:
    neighborhood = None
    city = None

    for comp in components:
        types = comp.get("types", [])
        if not neighborhood and any(t in types for t in ("neighborhood", "sublocality", "sublocality_level_1")):
            neighborhood = comp.get("long_name")
        if not city and any(t in types for t in ("locality", "postal_town", "administrative_area_level_2")):
            city = comp.get("long_name")
        if neighborhood and city:
            break

    # NYC boroughs often appear as sublocality; use that as city if nothing else
    if not city:
        for comp in components:
            types = comp.get("types", [])
            if "sublocality" in types or "sublocality_level_1" in types:
                city = comp.get("long_name")
                break

    return neighborhood, city


def _derive_cuisine(types: list[str]) -> str | None:
    for t in types:
        if t.endswith("_restaurant"):
            return t.removesuffix("_restaurant").replace("_", " ").title()
        if t.endswith("_food"):
            return t.removesuffix("_food").replace("_", " ").title()
    return None


def _http_get_json(url: str) -> dict:
    try:
        with urlopen(url, timeout=10) as resp:
            if resp.status != 200:
                return {}
            data = resp.read()
            return json.loads(data.decode("utf-8"))
    except Exception:
        return {}
