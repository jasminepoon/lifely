"""CLI entrypoint for Lifely.

Usage:
    uv run lifely
    uv run lifely --year 2024
    uv run lifely --no-cache
    uv run lifely --enrich  # Enable LLM enrichment (requires OPENAI_API_KEY)
"""

import argparse
import json
import os
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from .auth import get_calendar_service, get_user_email
from .fetch import fetch_events_for_year
from .models import (
    ActivityCategoryStats,
    FriendStats,
    InferredFriend,
    LocationStats,
    MergeSuggestion,
    TimeStats,
)
from .normalize import normalize_events
from .stats import compute_friend_stats, compute_location_stats, compute_time_stats

console = Console()


def main() -> None:
    """Main CLI entrypoint."""
    parser = argparse.ArgumentParser(
        description="Lifely - Google Calendar Wrapped",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--year",
        type=int,
        default=2025,
        help="Year to analyze",
    )
    parser.add_argument(
        "--no-cache",
        action="store_true",
        help="Force refresh from API (ignore cached data)",
    )
    parser.add_argument(
        "--top",
        type=int,
        default=10,
        help="Number of top friends to show",
    )
    parser.add_argument(
        "--enrich",
        action="store_true",
        help="Enable LLM enrichment for locations (requires OPENAI_API_KEY)",
    )
    args = parser.parse_args()

    try:
        run(year=args.year, use_cache=not args.no_cache, top_n=args.top, enrich=args.enrich)
    except FileNotFoundError as e:
        console.print(f"[red]Error:[/red] {e}")
        console.print("\nSee README.md for setup instructions.")
        raise SystemExit(1)
    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        raise SystemExit(1)


def run(year: int, use_cache: bool, top_n: int, enrich: bool = False) -> None:
    """Run the full analysis pipeline."""
    console.print(f"\n[bold]Lifely - {year} Calendar Wrapped[/bold]\n")

    # Step 1: Authenticate
    console.print("Authenticating with Google Calendar...", end=" ")
    service = get_calendar_service()
    user_email = get_user_email(service)
    console.print(f"[green]OK[/green] ({user_email})")

    # Step 2: Fetch events
    console.print(f"Fetching events for {year}...", end=" ")
    raw_events = fetch_events_for_year(service, year=year, use_cache=use_cache)
    console.print(f"[green]OK[/green] ({len(raw_events)} events)")

    # Step 3: Normalize
    console.print("Normalizing events...", end=" ")
    events = normalize_events(raw_events, user_email)
    console.print(f"[green]OK[/green] ({len(events)} normalized)")

    # Step 4: Compute stats
    console.print("Computing statistics...", end=" ")
    friend_stats = compute_friend_stats(events)
    time_stats = compute_time_stats(events)
    console.print("[green]OK[/green]")

    # Step 5: LLM Enrichment (optional)
    location_stats = None
    enrichment_lookup = None
    inferred_friends: list[InferredFriend] = []
    activity_stats: dict[str, ActivityCategoryStats] = {}
    merge_suggestions: list[MergeSuggestion] = []

    if enrich:
        if not os.environ.get("OPENAI_API_KEY"):
            console.print("[yellow]Warning:[/yellow] OPENAI_API_KEY not set, skipping enrichment")
        else:
            from .llm_enrich import (
                apply_enrichments_to_friend_stats,
                classify_solo_events_sync,
                enrich_all_events_sync,
                suggest_merges,
            )

            # Step 5a: Enrich locations (async parallel batches)
            console.print("Enriching locations with LLM...", end=" ")
            enrichment_lookup = enrich_all_events_sync(events)
            friend_stats = apply_enrichments_to_friend_stats(friend_stats, enrichment_lookup)
            location_stats = compute_location_stats(friend_stats, enrichment_lookup)
            console.print(f"[green]OK[/green] ({len(enrichment_lookup)} locations)")

            # Step 5b: Classify solo events (async parallel batches)
            console.print("Classifying events...", end=" ")
            inferred_friends, activity_stats = classify_solo_events_sync(
                events, enrichment_lookup
            )
            console.print(f"[green]OK[/green] ({len(inferred_friends)} inferred friends, {len(activity_stats)} activity categories)")

            # Step 5c: Suggest merges
            merge_suggestions = suggest_merges(inferred_friends, friend_stats)

    # Step 6: Display results
    console.print()
    _display_wrapped(
        time_stats, friend_stats, location_stats, inferred_friends, activity_stats, year, top_n
    )

    # Step 7: Save to JSON
    _save_stats(friend_stats, time_stats, location_stats, inferred_friends, activity_stats, year)


def _display_wrapped(
    time_stats: TimeStats,
    friend_stats: list[FriendStats],
    location_stats: LocationStats | None,
    inferred_friends: list[InferredFriend],
    activity_stats: dict[str, ActivityCategoryStats],
    year: int,
    top_n: int,
) -> None:
    """Display wrapped-style insights."""
    month_names = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    # Header
    console.print(Panel(f"[bold]{year} Wrapped[/bold]", style="cyan"))

    # Quick stats
    console.print(f"\n[bold]Your Year in Numbers[/bold]")
    console.print(f"  {time_stats.total_events:,} events")
    if time_stats.events_per_month:
        busiest_month = max(time_stats.events_per_month, key=time_stats.events_per_month.get)  # type: ignore
        console.print(f"  Busiest month: [cyan]{month_names[busiest_month]}[/cyan]")
    if time_stats.events_per_weekday:
        busiest_day = max(time_stats.events_per_weekday, key=time_stats.events_per_weekday.get)  # type: ignore
        console.print(f"  Busiest day: [cyan]{busiest_day}[/cyan]")

    # Location insights (if enriched)
    if location_stats and location_stats.top_neighborhoods:
        console.print(f"\n[bold]Your NYC Footprint[/bold]")
        if location_stats.top_neighborhoods:
            hoods = ", ".join(f"[cyan]{h}[/cyan] ({c})" for h, c in location_stats.top_neighborhoods[:3])
            console.print(f"  Top neighborhoods: {hoods}")
        if location_stats.top_venues:
            venues = ", ".join(f"[cyan]{v}[/cyan] ({c})" for v, c in location_stats.top_venues[:3])
            console.print(f"  Top spots: {venues}")
        if location_stats.top_cuisines:
            cuisines = ", ".join(f"[cyan]{c}[/cyan] ({n})" for c, n in location_stats.top_cuisines[:3])
            console.print(f"  Top cuisines: {cuisines}")

    # Activity insights (if enriched)
    if activity_stats:
        console.print(f"\n[bold]Your Activities[/bold]")
        # Sort by event count
        sorted_cats = sorted(activity_stats.values(), key=lambda x: x.event_count, reverse=True)
        for cat_stats in sorted_cats[:4]:
            total = cat_stats.event_count
            top_act = cat_stats.top_activities[0] if cat_stats.top_activities else None
            top_venue = cat_stats.top_venues[0] if cat_stats.top_venues else None

            line = f"  [cyan]{cat_stats.category.title()}[/cyan]: {total} sessions"
            if top_act:
                line += f" (mostly {top_act[0]})"
            console.print(line)
            if top_venue:
                console.print(f"      [dim]@ {top_venue[0]}[/dim]")

    # Top friends with context (email-based)
    if friend_stats:
        console.print(f"\n[bold]Your People (Calendar Invites)[/bold]")
        for i, friend in enumerate(friend_stats[:top_n], 1):
            name = friend.display_name or friend.email.split("@")[0]
            console.print(f"\n  [bold]#{i} {name}[/bold] ({friend.event_count} events)")

            # Show venues/neighborhoods they visited together
            venues = []
            neighborhoods = set()
            for e in friend.events:
                if e.venue_name and e.venue_name not in venues:
                    venues.append(e.venue_name)
                if e.neighborhood:
                    neighborhoods.add(e.neighborhood)

            if venues:
                console.print(f"      [dim]{', '.join(venues[:4])}[/dim]")
            if neighborhoods:
                console.print(f"      [dim]({', '.join(sorted(neighborhoods)[:3])})[/dim]")

    # Inferred friends (from event titles)
    if inferred_friends:
        console.print(f"\n[bold]Your People (From Event Titles)[/bold]")
        for i, friend in enumerate(inferred_friends[:top_n], 1):
            console.print(f"\n  [bold]#{i} {friend.name}[/bold] ({friend.event_count} events)")

            # Show venues/neighborhoods
            venues = []
            neighborhoods = set()
            for e in friend.events:
                if e.venue_name and e.venue_name not in venues:
                    venues.append(e.venue_name)
                if e.neighborhood:
                    neighborhoods.add(e.neighborhood)

            if venues:
                console.print(f"      [dim]{', '.join(venues[:4])}[/dim]")
            if neighborhoods:
                console.print(f"      [dim]({', '.join(sorted(neighborhoods)[:3])})[/dim]")


def _save_stats(
    friend_stats: list[FriendStats],
    time_stats: TimeStats,
    location_stats: LocationStats | None,
    inferred_friends: list[InferredFriend],
    activity_stats: dict[str, ActivityCategoryStats],
    year: int,
) -> None:
    """Save statistics to JSON file."""
    data_dir = Path("data")
    data_dir.mkdir(parents=True, exist_ok=True)

    output: dict = {
        "year": year,
        "time_stats": {
            "total_events": time_stats.total_events,
            "total_hours": time_stats.total_hours,
            "events_per_month": time_stats.events_per_month,
            "hours_per_month": time_stats.hours_per_month,
            "events_per_weekday": time_stats.events_per_weekday,
            "busiest_day": time_stats.busiest_day,
        },
        "friend_stats": [
            {
                "email": f.email,
                "display_name": f.display_name,
                "event_count": f.event_count,
                "total_hours": f.total_hours,
                "events": [
                    {
                        "id": e.id,
                        "summary": e.summary,
                        "date": e.date,
                        "hours": e.hours,
                        "location_raw": e.location_raw,
                        "venue_name": e.venue_name,
                        "neighborhood": e.neighborhood,
                        "cuisine": e.cuisine,
                    }
                    for e in f.events
                ],
            }
            for f in friend_stats
        ],
    }

    if location_stats:
        output["location_stats"] = {
            "top_neighborhoods": location_stats.top_neighborhoods,
            "top_venues": location_stats.top_venues,
            "top_cuisines": location_stats.top_cuisines,
        }

    if inferred_friends:
        output["inferred_friends"] = [
            {
                "name": f.name,
                "normalized_name": f.normalized_name,
                "event_count": f.event_count,
                "total_hours": f.total_hours,
                "linked_email": f.linked_email,
                "events": [
                    {
                        "id": e.id,
                        "summary": e.summary,
                        "date": e.date,
                        "hours": e.hours,
                        "location_raw": e.location_raw,
                        "venue_name": e.venue_name,
                        "neighborhood": e.neighborhood,
                        "cuisine": e.cuisine,
                    }
                    for e in f.events
                ],
            }
            for f in inferred_friends
        ]

    if activity_stats:
        output["activity_stats"] = {
            cat: {
                "category": stats.category,
                "event_count": stats.event_count,
                "total_hours": stats.total_hours,
                "top_venues": stats.top_venues,
                "top_activities": stats.top_activities,
            }
            for cat, stats in activity_stats.items()
        }

    output_path = data_dir / f"stats_{year}.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    console.print(f"\n[dim]Stats saved to {output_path}[/dim]")


if __name__ == "__main__":
    main()
