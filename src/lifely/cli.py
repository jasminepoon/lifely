"""CLI entrypoint for Lifely.

Usage:
    uv run lifely
    uv run lifely --year 2024
    uv run lifely --no-cache
"""

import argparse
import json
from pathlib import Path

from rich.console import Console
from rich.table import Table

from .auth import get_calendar_service, get_user_email
from .fetch import fetch_events_for_year
from .models import TimeStats
from .normalize import normalize_events
from .stats import compute_friend_stats, compute_time_stats

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
    args = parser.parse_args()

    try:
        run(year=args.year, use_cache=not args.no_cache, top_n=args.top)
    except FileNotFoundError as e:
        console.print(f"[red]Error:[/red] {e}")
        console.print("\nSee README.md for setup instructions.")
        raise SystemExit(1)
    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
        raise SystemExit(1)


def run(year: int, use_cache: bool, top_n: int) -> None:
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

    # Step 5: Display results
    console.print()
    _display_time_stats(time_stats, year)
    console.print()
    _display_friend_stats(friend_stats, top_n)

    # Step 6: Save to JSON
    _save_stats(friend_stats, time_stats, year)


def _display_time_stats(stats: TimeStats, year: int) -> None:
    """Display time-based statistics."""
    console.print(f"[bold]Time Stats ({year})[/bold]")
    console.print(f"  Total events: {stats.total_events:,}")
    console.print(f"  Total hours: {stats.total_hours:,.1f}")

    if stats.busiest_day:
        date, count, hours = stats.busiest_day
        console.print(f"  Busiest day: {date} ({count} events, {hours} hours)")

    # Find busiest month
    if stats.events_per_month:
        busiest_month = max(stats.events_per_month, key=stats.events_per_month.get)  # type: ignore
        month_names = [
            "",
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
        ]
        console.print(
            f"  Busiest month: {month_names[busiest_month]} "
            f"({stats.events_per_month[busiest_month]} events)"
        )


def _display_friend_stats(stats: list, top_n: int) -> None:
    """Display friend statistics in a table."""
    console.print(f"[bold]Top {top_n} Friends by Hours Together[/bold]")

    table = Table(show_header=True, header_style="bold")
    table.add_column("#", justify="right", width=3)
    table.add_column("Name", width=30)
    table.add_column("Events", justify="right", width=8)
    table.add_column("Hours", justify="right", width=8)

    for i, friend in enumerate(stats[:top_n], 1):
        name = friend.display_name or friend.email
        table.add_row(
            str(i),
            name,
            str(friend.event_count),
            f"{friend.total_hours:.1f}",
        )

    console.print(table)


def _save_stats(friend_stats: list, time_stats: TimeStats, year: int) -> None:
    """Save statistics to JSON file."""
    data_dir = Path("data")
    data_dir.mkdir(parents=True, exist_ok=True)

    output = {
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
                    }
                    for e in f.events
                ],
            }
            for f in friend_stats
        ],
    }

    output_path = data_dir / f"stats_{year}.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    console.print(f"\n[dim]Stats saved to {output_path}[/dim]")


if __name__ == "__main__":
    main()
