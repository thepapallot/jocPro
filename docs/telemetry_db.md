# Telemetry Database Documentation

## Overview

The telemetry system is a standalone SQLite-based event logging and analytics storage layer for the game platform. It captures game sessions, player actions, answers, and timing data for analysis and reporting.

**Current Status**: Standalone database layer with no integration into game flow yet. Phase 2 will integrate telemetry capture into the MQTT/Flask backend.

## Architecture

### Package Structure

```
telemetry/
├── __init__.py          # Public API exports
├── config.py            # Configuration and constants
├── schema.py            # DDL and schema bootstrap
├── database.py          # SQLite connection and pragmas
├── writer.py            # Queue-based writer service
└── queries.py           # Report query helpers

scriptsDb/
├── init_telemetry_db.py           # Initialize database
├── seed_telemetry_sample.py       # Seed with sample data
└── telemetry_report_preview.py    # Display sample reports
```

### Database Location

- **Runtime path**: `data/db/telemetry.sqlite3`
- **Side files**: `data/db/telemetry.sqlite3-wal` and `data/db/telemetry.sqlite3-shm` (created at runtime, gitignored)

### Schema Overview

#### `sessions` table
Records of individual puzzle plays.

| Column | Type | Notes |
|--------|------|-------|
| session_id | INTEGER PRIMARY KEY | Auto-increment |
| puzzle_id | INTEGER | Puzzle identifier |
| location | TEXT | Optional venue/company name |
| started_at | DATETIME | Session start timestamp |
| completed_at | DATETIME | Session completion timestamp |
| success | BOOLEAN | Whether puzzle was solved |
| duration_seconds | REAL | Total session duration |
| metadata | TEXT | JSON: player_name, team_id, difficulty, etc. |

#### `events` table
Append-only log of all actions/state changes.

| Column | Type | Notes |
|--------|------|-------|
| event_id | INTEGER PRIMARY KEY | Auto-increment |
| session_id | INTEGER FK | Reference to sessions |
| event_type | TEXT | Type of event (puzzle_start, answer, timer_event, etc.) |
| puzzle_id | INTEGER | Puzzle identifier |
| timestamp | DATETIME | When event occurred |
| elapsed_ms | INTEGER | Milliseconds since session start |
| data | TEXT | JSON payload with event details |

#### `answers` table
Normalized answer records for quick accuracy/error analysis.

| Column | Type | Notes |
|--------|------|-------|
| answer_id | INTEGER PRIMARY KEY | Auto-increment |
| session_id | INTEGER FK | Reference to sessions |
| event_id | INTEGER FK | Optional link to events table |
| question_id | TEXT | Question identifier |
| round_number | INTEGER | Round number |
| user_answer | TEXT | Player's answer |
| correct_answer | TEXT | Expected answer |
| is_correct | BOOLEAN | Whether answer was correct |
| timestamp | DATETIME | When answer was submitted |
| attempt_number | INTEGER | Which attempt this was |

#### `timings` table
Phase and round duration records.

| Column | Type | Notes |
|--------|------|-------|
| timing_id | INTEGER PRIMARY KEY | Auto-increment |
| session_id | INTEGER FK | Reference to sessions |
| phase_name | TEXT | Name of phase (round_1, input, wait_for_others, etc.) |
| phase_number | INTEGER | Ordinal phase number |
| started_at | DATETIME | Phase start time |
| ended_at | DATETIME | Phase end time |
| duration_ms | INTEGER | Duration in milliseconds |
| metadata | TEXT | JSON with phase context |

## Quick Start

### 1. Initialize Database

```bash
python scriptsDb/init_telemetry_db.py
```

Or with info display:

```bash
python scriptsDb/init_telemetry_db.py --info
```

This creates:
- `data/db/` directory if needed
- `data/db/telemetry.sqlite3` SQLite database
- All schema tables and indexes
- WAL mode enabled for safe concurrent writes on Raspberry Pi

### 2. Seed Sample Data (Optional)

```bash
python scriptsDb/seed_telemetry_sample.py
```

Or with custom session count:

```bash
python scriptsDb/seed_telemetry_sample.py --sessions 10
```

### 3. Generate Sample Reports

```bash
python scriptsDb/telemetry_report_preview.py
```

Or look back further:

```bash
python scriptsDb/telemetry_report_preview.py --days 30
```

## Python API Usage

### Initialize Telemetry

```python
from pathlib import Path
from telemetry import init_telemetry, TelemetryQueries

# Initialize and get writer
writer = init_telemetry(Path("data/db"))

# Later, gracefully shut down
writer.shutdown()
```

### Record Session and Events

```python
# Start a session
session_id = writer.record_session_start(
    puzzle_id=1,
    location="Barcelona Office",
    metadata={"player_name": "Alice", "team_id": 5}
)

# Record events
writer.record_event(
    session_id=session_id,
    event_type="puzzle_start",
    puzzle_id=1,
    elapsed_ms=0,
    data={"difficulty": "medium"}
)

# Record an answer
writer.record_answer(
    session_id=session_id,
    question_id="Q1",
    round_number=1,
    user_answer="blue",
    correct_answer="blue",
    is_correct=True,
    attempt_number=1
)

# Record timing
writer.record_timing(
    session_id=session_id,
    phase_name="round_1",
    phase_number=1,
    duration_ms=15000
)
```

### Query Reports

```python
from telemetry import TelemetryQueries

queries = TelemetryQueries(Path("data/db"))

# Get completion stats for a puzzle
stats = queries.get_completion_stats_by_puzzle(puzzle_id=1, days_back=7)
print(f"Puzzle 1: {stats['success_rate']:.1%} success rate")

# Get error analysis
errors = queries.get_error_rate_by_puzzle(puzzle_id=1, days_back=7)
print(f"Puzzle 1: {errors['accuracy_percent']:.1f}% answer accuracy")

# Get timeline of all events in a session
timeline = queries.get_session_action_timeline(session_id=42)
for event in timeline:
    print(f"{event['elapsed_ms']}ms: {event['event_type']}")

# Find most repeated mistakes
mistakes = queries.get_repeated_mistakes(puzzle_id=1, days_back=7, limit=5)
for mistake in mistakes:
    print(f"'{mistake['user_answer']}' repeated {mistake['frequency']} times")

queries.close()
```

## Configuration

Key settings in `telemetry/config.py`:

```python
# Database path
DB_FILENAME = "telemetry.sqlite3"
DEFAULT_DB_PATH = "data/db"

# Writer queue settings
BATCH_SIZE = 50                    # Flush when reaching 50 events
BATCH_TIMEOUT_SECONDS = 30         # Or every 30 seconds
MAX_QUEUE_SIZE = 500               # Prevent unbounded memory

# SQLite pragmas for Raspberry Pi
PRAGMAS = {
    "journal_mode": "WAL",          # Write-ahead logging for safety
    "synchronous": "NORMAL",        # Balance speed and safety
    "cache_size": -64000,           # 64MB cache
    "foreign_keys": "ON",
    "timeout": 5000,                # 5s lock timeout
}
```

## Writer Behavior

The `TelemetryWriter` uses a background thread for batched writes:

1. **Session start/end**: Written immediately (critical path)
2. **Events and answers**: Queued for batch writes
3. **Batch flush triggers**:
   - Buffer reaches 50 items
   - 30 seconds elapsed
   - Writer shutdown

This design balances:
- **Durability**: WAL mode + immediate session writes
- **Performance**: Batch writes reduce I/O overhead
- **Memory**: Bounded queue prevents runaway growth
- **Concurrency**: Thread-safe with locks for Raspberry Pi

## Integration Plan (Phase 2)

When integrating with the game app, telemetry will hook into:

| Game Component | Hook Point | Capture |
|---|---|---|
| MQTT Client | `start_puzzle()` | Session start |
| Puzzle Classes | `handle_message()` | Player actions |
| Puzzle Classes | `_push()` | State transitions |
| Puzzle Classes | Answer handlers | Answer submission + correctness |

No changes to game routes or SSE contracts will be made.

## Performance Notes

### Raspberry Pi Considerations

- **WAL mode**: Allows reads during writes; better than journal mode for Pi
- **Batching**: Reduces SD card wear and write latency
- **Connection pooling**: Thread-local connections avoid lock contention
- **Typical throughput**: ~100–500 events/second

### Benchmarks

Example from sample data generation:
- 5 sessions × 8 events + 4 answers + 1 timing each = 65 DB operations
- Time: ~200ms (batched)
- Queue depth: max 5 items at a time

## Troubleshooting

### Database locked errors
- Ensure WAL mode is enabled: `PRAGMA journal_mode`
- Check timeout setting: `PRAGMA timeout`
- Reduce batch size if needed (config.py)

### Missing schema tables
- Run `init_telemetry_db.py` again
- Check file permissions on `data/db/`

### Large database file
- Check WAL checkpoint settings
- Monitor row counts per table
- Implement retention policy (future enhancement)

## Next Steps

1. ✅ Standalone telemetry layer complete
2. ⏳ Integration with Flask app (Phase 2)
3. ⏳ Integration with MQTT puzzle events (Phase 2)
4. ⏳ Retention and export utilities (Phase 3)
5. ⏳ Central dashboard aggregation (Phase 4)
