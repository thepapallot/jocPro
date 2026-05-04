#!/usr/bin/env python3
"""
Initialize telemetry database schema.

Usage:
    python scriptsDb/init_telemetry_db.py
    python scriptsDb/init_telemetry_db.py --db-path /path/to/db
"""

import argparse
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from telemetry import init_telemetry, get_db_info, get_journal_mode


def main():
    parser = argparse.ArgumentParser(
        description="Initialize telemetry database"
    )
    parser.add_argument(
        "--db-path",
        type=Path,
        default=Path("data/db"),
        help="Path to database directory (default: data/db)",
    )
    parser.add_argument(
        "--info",
        action="store_true",
        help="Display database information after initialization",
    )
    
    args = parser.parse_args()
    
    print(f"Initializing telemetry database at {args.db_path}...")
    
    try:
        # Initialize telemetry (creates DB and schema)
        writer = init_telemetry(args.db_path)
        writer.shutdown()
        
        print("✓ Database initialized successfully")
        
        # Display info if requested
        if args.info:
            print("\nDatabase Information:")
            info = get_db_info(args.db_path)
            print(f"  Exists: {info.get('exists', False)}")
            print(f"  Size: {info.get('size_bytes', 0)} bytes")
            print(f"  Journal Mode: {info.get('journal_mode', 'unknown')}")
            print(f"  WAL File: {info.get('wal_file_exists', False)}")
            print(f"  SHM File: {info.get('shm_file_exists', False)}")
            
            print("\n  Table Row Counts:")
            for table, count in info.get("tables", {}).items():
                print(f"    {table}: {count} rows")
        
        return 0
    
    except Exception as e:
        print(f"✗ Error initializing database: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
