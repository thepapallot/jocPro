"""
Configuration constants for telemetry database.
"""

# Database settings
DB_FILENAME = "telemetry.sqlite3"
DEFAULT_DB_PATH = "data/db"  # relative to project root

# Writer queue settings
BATCH_SIZE = 50  # flush when buffer reaches this size
BATCH_TIMEOUT_SECONDS = 30  # flush buffer every N seconds
MAX_QUEUE_SIZE = 500  # prevent unbounded memory growth

# SQLite pragmas for Raspberry Pi
PRAGMAS = {
    "journal_mode": "WAL",  # write-ahead logging
    "synchronous": "NORMAL",  # balance safety and speed for Pi
    "cache_size": -64000,  # 64MB cache (reasonable for Pi)
    "foreign_keys": "ON",
    "timeout": 5000,  # 5 second wait on locks
}

# Schema version
SCHEMA_VERSION = 3

# Event types (enum-like constants)
EVENT_TYPES = {
    "session_start": "session_start",
    "session_end": "session_end",
    "puzzle_start": "puzzle_start",
    "puzzle_end": "puzzle_end",
    "action": "action",
    "timer_event": "timer_event",
    "state_change": "state_change",
    "mistake": "mistake",
    "solved": "solved",
    "reset": "reset",
}
