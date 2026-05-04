#!/usr/bin/env python3
"""
Seed telemetry database with sample data for testing and validation.

Usage:
    python scriptsDb/seed_telemetry_sample.py
    python scriptsDb/seed_telemetry_sample.py --db-path /path/to/db --sessions 5
"""

import argparse
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from telemetry import init_telemetry


def generate_sample_data(num_sessions: int = 3, db_path: Path = Path("data/db")) -> None:
    """Generate and insert sample telemetry data."""
    
    writer = init_telemetry(db_path)
    base_start = datetime(2026, 5, 1, 9, 0, 0)
    
    puzzle_numbers = [1, 2, 3, 4, 5]
    companies = ["Barcelona Office", "Madrid Office", "Valencia Office", "Test Lab"]
    event_types = [
        "puzzle_start",
        "puzzle_end",
        "action",
        "timer_event",
        "state_change",
        "mistake",
        "solved",
        "reset",
    ]
    
    print(f"Generating {num_sessions} sample sessions...")
    
    for session_num in range(num_sessions):
        company = random.choice(companies)
        session_start = base_start + timedelta(days=session_num, minutes=random.randint(0, 90))
        session_end = session_start
        expected_day = session_start.date().isoformat()
        expected_time = session_start.strftime("%H:%M")
        group_name = f"Group {session_num + 1}"
        players_num = random.randint(3, 8)
        language = random.choice(["CAT", "ESP", "ENG"])
        notes = random.choice(["", "VIP group", "Team building", "Needs assistance"]) or None
        
        session_id = writer.record_session_start(
            company=company,
            name=group_name,
            expected_day=expected_day,
            expected_time=expected_time,
            place=company,
            players_num=players_num,
            language=language,
            notes=notes,
            started_at=session_start.strftime("%Y-%m-%d %H:%M:%S"),
        )
        
        print(
            f"  Session {session_id}: Company {company}, Group {group_name}, "
            f"Expected {expected_day} {expected_time}, Players {players_num}"
        )

        puzzle_runs = random.randint(2, 4)
        elapsed_cursor = 0
        for order in range(puzzle_runs):
            puzzle_num = random.choice(puzzle_numbers)
            round_num = random.randint(1, 3)
            puzzle_start = session_start + timedelta(milliseconds=elapsed_cursor)
            puzzle_id = writer.record_puzzle_start(
                session_id=session_id,
                puzzle_num=puzzle_num,
                round_num=round_num,
                order=order,
                started_at=puzzle_start.strftime("%Y-%m-%d %H:%M:%S"),
            )

            num_events = random.randint(3, 8)
            for event_num in range(num_events):
                elapsed_cursor += random.randint(500, 2000)
                event_type = random.choice(event_types)
                event_data = {
                    "order": order,
                    "round_num": round_num,
                    "detail": random.choice(["button", "sensor", "screen", "timer"]),
                    "value": random.randint(1, 100),
                }
                writer.record_event(
                    session_id=session_id,
                    puzzle_id=puzzle_id,
                    event_type=event_type,
                    elapsed_ms=elapsed_cursor,
                    data=event_data,
                )

            puzzle_end = session_start + timedelta(milliseconds=elapsed_cursor + random.randint(1000, 4000))
            writer.end_puzzle(puzzle_id, ended_at=puzzle_end.strftime("%Y-%m-%d %H:%M:%S"))
            session_end = max(session_end, puzzle_end)

        writer.end_session(session_id, ended_at=session_end.strftime("%Y-%m-%d %H:%M:%S"))
    
    print("\nFlushing data to database...")
    writer.flush()
    
    # Give worker thread time to process
    import time
    time.sleep(2)
    
    writer.shutdown()
    
    print("✓ Sample data inserted successfully")


def main():
    parser = argparse.ArgumentParser(
        description="Seed telemetry database with sample data"
    )
    parser.add_argument(
        "--db-path",
        type=Path,
        default=Path("data/db"),
        help="Path to database directory (default: data/db)",
    )
    parser.add_argument(
        "--sessions",
        type=int,
        default=3,
        help="Number of sample sessions to generate (default: 3)",
    )
    
    args = parser.parse_args()
    
    try:
        generate_sample_data(num_sessions=args.sessions, db_path=args.db_path)
        return 0
    except Exception as e:
        print(f"✗ Error seeding database: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
