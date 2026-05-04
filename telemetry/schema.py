"""
SQLite schema definition and bootstrap logic for telemetry database.
"""

import sqlite3
from pathlib import Path

from .config import DB_FILENAME, PRAGMAS, SCHEMA_VERSION

SCHEMA_DDL = """
-- Metadata table for schema versioning
CREATE TABLE IF NOT EXISTS schema_info (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    version INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Session-level metadata
CREATE TABLE IF NOT EXISTS sessions (
    session_id INTEGER PRIMARY KEY AUTOINCREMENT,
    company TEXT NOT NULL,
    name TEXT,
    expected_day TEXT NOT NULL,
    expected_time TEXT,
    place TEXT,
    players_num INTEGER,
    language TEXT,
    notes TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_sessions_company_day
    ON sessions(company, expected_day);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at
    ON sessions(started_at);

-- Puzzle runs inside a session
CREATE TABLE IF NOT EXISTS puzzles (
    puzzle_id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    puzzle_num INTEGER NOT NULL,
    round_num INTEGER,
    puzzle_order INTEGER NOT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    FOREIGN KEY(session_id) REFERENCES sessions(session_id)
);
CREATE INDEX IF NOT EXISTS idx_puzzles_session_order
    ON puzzles(session_id, puzzle_order);
CREATE INDEX IF NOT EXISTS idx_puzzles_num
    ON puzzles(puzzle_num);

-- Event log (append-only)
CREATE TABLE IF NOT EXISTS events (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    puzzle_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    elapsed_ms INTEGER,  -- milliseconds since session start
    data TEXT,  -- JSON payload
    FOREIGN KEY(session_id) REFERENCES sessions(session_id),
    FOREIGN KEY(puzzle_id) REFERENCES puzzles(puzzle_id)
);
CREATE INDEX IF NOT EXISTS idx_events_session_elapsed
    ON events(session_id, elapsed_ms);
CREATE INDEX IF NOT EXISTS idx_events_type
    ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_puzzle
    ON events(puzzle_id);
"""

INDEXES_DDL = """
-- Additional composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_events_session_type
    ON events(session_id, event_type);
CREATE INDEX IF NOT EXISTS idx_puzzles_session_num
    ON puzzles(session_id, puzzle_num);
"""

DROPPABLE_TABLES = ["events", "puzzles", "answers", "timings", "sessions", "schema_info"]


def _apply_pragmas(cursor: sqlite3.Cursor) -> None:
    for pragma_name, pragma_value in PRAGMAS.items():
        if pragma_name == "timeout":
            continue
        cursor.execute(f"PRAGMA {pragma_name} = {pragma_value}")


def _get_existing_schema_version(cursor: sqlite3.Cursor) -> int:
    try:
        cursor.execute("SELECT version FROM schema_info WHERE id = 1")
        row = cursor.fetchone()
        return row[0] if row else 0
    except sqlite3.OperationalError:
        return 0


def _rebuild_schema(cursor: sqlite3.Cursor) -> None:
    cursor.execute("PRAGMA foreign_keys = OFF")
    for table_name in DROPPABLE_TABLES:
        cursor.execute(f"DROP TABLE IF EXISTS {table_name}")
    cursor.execute("PRAGMA foreign_keys = ON")


def _initialize_schema(cursor: sqlite3.Cursor) -> None:
    cursor.executescript(SCHEMA_DDL)
    cursor.executescript(INDEXES_DDL)
    cursor.execute(
        """
        INSERT INTO schema_info (id, version)
        VALUES (1, ?)
        ON CONFLICT(id) DO UPDATE SET
            version = excluded.version,
            last_updated_at = CURRENT_TIMESTAMP
        """,
        (SCHEMA_VERSION,),
    )


def init_schema(db_path: Path) -> None:
    """
    Initialize database schema idempotently.
    
    Args:
        db_path: Path to SQLite database directory
    
    Raises:
        sqlite3.DatabaseError: if schema initialization fails
    """
    db_path.mkdir(parents=True, exist_ok=True)
    db_file = db_path / DB_FILENAME
    
    conn = sqlite3.connect(str(db_file), timeout=PRAGMAS.get("timeout", 5000) / 1000.0)
    try:
        cursor = conn.cursor()
        _apply_pragmas(cursor)
        current_version = _get_existing_schema_version(cursor)
        if current_version not in (0, SCHEMA_VERSION):
            _rebuild_schema(cursor)
        _initialize_schema(cursor)
        
        conn.commit()
    finally:
        conn.close()


def get_schema_version(db_path: Path) -> int:
    """Get current schema version from database."""
    db_file = db_path / DB_FILENAME
    
    if not db_file.exists():
        return 0
    
    conn = sqlite3.connect(str(db_file))
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT version FROM schema_info WHERE id = 1")
        row = cursor.fetchone()
        return row[0] if row else 0
    except sqlite3.OperationalError:
        # Table doesn't exist yet
        return 0
    finally:
        conn.close()
