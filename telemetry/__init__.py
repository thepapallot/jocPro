"""
Telemetry package for game event logging and analytics.

Provides standalone SQLite-based storage for sessions, puzzle runs, and events.
"""

import atexit
from pathlib import Path
from typing import Optional

from .database import DatabaseConnection, get_db_info, get_journal_mode
from .queries import TelemetryQueries
from .schema import init_schema, get_schema_version
from .writer import TelemetryWriter

__version__ = "0.1.0"
__all__ = [
    "init_telemetry",
    "TelemetryWriter",
    "TelemetryQueries",
    "DatabaseConnection",
    "init_schema",
    "get_schema_version",
    "get_db_info",
    "get_journal_mode",
]


def _shutdown_telemetry_writer(writer: TelemetryWriter) -> None:
    try:
        writer.shutdown(timeout=2)
    except Exception as exc:
        print(f"[telemetry] shutdown failed: {exc}")


def init_telemetry(db_path: Optional[Path] = None) -> TelemetryWriter:
    """
    Initialize telemetry database and return ready writer.
    
    Creates database directory, initializes schema, and starts background writer service.
    
    Args:
        db_path: Path to database directory. Defaults to data/db relative to current directory.
        
    Returns:
        TelemetryWriter instance ready for use
        
    Example:
        from telemetry import init_telemetry
        
        writer = init_telemetry(Path("data/db"))
        session_id = writer.record_session_start(
            company="Example Co",
            name="Group A",
            expected_day="2026-05-04",
            expected_time="10:00",
            place="Main Hall",
            players_num=6,
            language="ENG",
            notes="Birthday event",
        )
        puzzle_id = writer.record_puzzle_start(session_id, puzzle_num=1, round_num=1, order=0)
        writer.record_event(session_id, puzzle_id, "puzzle_start")
    """
    if db_path is None:
        db_path = Path("data/db")
    else:
        db_path = Path(db_path)
    
    # Initialize schema
    init_schema(db_path)
    
    # Return ready writer
    writer = TelemetryWriter(db_path)
    atexit.register(_shutdown_telemetry_writer, writer)
    return writer
