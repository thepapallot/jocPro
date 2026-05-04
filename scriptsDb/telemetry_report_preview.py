#!/usr/bin/env python3
"""
Run sample telemetry reports and display results.

Usage:
    python scriptsDb/telemetry_report_preview.py
    python scriptsDb/telemetry_report_preview.py --db-path /path/to/db
"""

import argparse
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from telemetry import TelemetryQueries


def main():
    parser = argparse.ArgumentParser(
        description="Generate and display telemetry reports"
    )
    parser.add_argument(
        "--db-path",
        type=Path,
        default=Path("data/db"),
        help="Path to database directory (default: data/db)",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=7,
        help="Look back N days (default: 7)",
    )
    
    args = parser.parse_args()
    
    # Check if database exists
    db_file = args.db_path / "telemetry.sqlite3"
    if not db_file.exists():
        print(f"✗ Database not found at {db_file}")
        print("  Run 'python scriptsDb/init_telemetry_db.py' first")
        return 1
    
    try:
        queries = TelemetryQueries(args.db_path)
        
        # Get all sessions
        print("=" * 70)
        print("TELEMETRY REPORT PREVIEW")
        print("=" * 70)
        
        sessions = queries.get_all_sessions(days_back=args.days, limit=10)
        print(f"\n📊 Recent Sessions (last {args.days} days, showing up to 10):")
        print("-" * 70)
        
        if sessions:
            for session in sessions:
                print(
                    f"  Session {session['session_id']}: Company {session['company']}, "
                    f"Group {session['name'] or 'N/A'}, Expected {session['expected_day']} {session['expected_time'] or 'N/A'}, "
                    f"Place {session['place'] or 'N/A'}, Players {session['players_num'] or 'N/A'}, "
                    f"Lang {session['language'] or 'N/A'}, Notes {session['notes'] or '-'}, "
                    f"Started {session['started_at']}, Ended {session['ended_at'] or 'N/A'}"
                )
        else:
            print("  (No sessions found)")
        
        # Puzzle stats by number
        print(f"\n⏱️  Puzzle Run Statistics (last {args.days} days):")
        print("-" * 70)
        
        for puzzle_num in [1, 2, 3, 4, 5]:
            stats = queries.get_puzzle_stats_by_number(
                puzzle_num=puzzle_num,
                days_back=args.days,
            )
            
            if stats and stats.get("total_runs", 0) > 0:
                print(f"\n  Puzzle {puzzle_num}:")
                print(f"    Total runs: {stats['total_runs']}")
                print(f"    Avg round number: {stats['avg_round_num']:.1f}")
                
                avg_dur = stats['avg_duration_seconds']
                min_dur = stats['min_duration_seconds']
                max_dur = stats['max_duration_seconds']
                
                if avg_dur is not None:
                    print(
                        f"    Avg duration: {avg_dur:.1f}s "
                        f"(min: {min_dur:.1f}s, max: {max_dur:.1f}s)"
                    )
                else:
                    print("    Avg duration: N/A")
        
        # Event distribution
        print(f"\n📈 Event Distribution (last {args.days} days):")
        print("-" * 70)
        
        event_counts = queries.get_event_counts_by_type(days_back=args.days)
        if event_counts:
            for event_type, count in sorted(event_counts.items(), key=lambda x: x[1], reverse=True):
                print(f"  {event_type}: {count}")
        else:
            print("  (No events found)")
        
        # Puzzles inside the most recent session
        print(f"\n🧩 Puzzles In Most Recent Session:")
        print("-" * 70)

        if sessions:
            recent_session_id = sessions[0]["session_id"]
            for puzzle in queries.get_session_puzzles(recent_session_id):
                print(
                    f"  Puzzle row {puzzle['puzzle_id']}: puzzle_num={puzzle['puzzle_num']}, "
                    f"round={puzzle['round_num']}, order={puzzle['puzzle_order']}, "
                    f"ended_at={puzzle['ended_at'] or 'N/A'}"
                )

            print(f"\n📝 Event Timeline For Session {recent_session_id}:")
            print("-" * 70)
            for event in queries.get_session_action_timeline(recent_session_id)[:10]:
                print(
                    f"  {event['elapsed_ms']}ms | puzzle_id={event['puzzle_id']} | "
                    f"{event['event_type']} | {event['data']}"
                )
        
        print("\n" + "=" * 70)
        print("Report generated successfully")
        print("=" * 70)
        
        queries.close()
        return 0
    
    except Exception as e:
        print(f"✗ Error generating report: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
