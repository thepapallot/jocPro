"""
Queue-based telemetry writer service for thread-safe batched database writes.
"""

import json
import queue
import threading
import time
from pathlib import Path
from typing import Any, Dict, Optional

from .config import BATCH_SIZE, BATCH_TIMEOUT_SECONDS, MAX_QUEUE_SIZE
from .database import DatabaseConnection


class TelemetryWriter:
    """Thread-safe queued writer for telemetry events."""
    
    def __init__(self, db_path: Path):
        """
        Initialize telemetry writer.
        
        Args:
            db_path: Path to database directory
        """
        self.db_path = Path(db_path)
        self.db = DatabaseConnection(self.db_path)
        self._queue = queue.Queue(maxsize=MAX_QUEUE_SIZE)
        self._shutdown = threading.Event()
        self._flush_lock = threading.Lock()
        self._shutdown_once_lock = threading.Lock()
        self._closed = False
        self._worker_thread = None
        self._start_worker()
    
    def _start_worker(self) -> None:
        """Start background worker thread for batch writes."""
        self._worker_thread = threading.Thread(
            target=self._worker_loop,
            daemon=True,
            name="TelemetryWriter-Worker",
        )
        self._worker_thread.start()
    
    def _worker_loop(self) -> None:
        """Main worker loop for batched writes."""
        buffer = []
        last_flush = time.time()
        
        while not self._shutdown.is_set():
            try:
                # Try to get item with timeout
                try:
                    item = self._queue.get(timeout=1.0)
                    buffer.append(item)
                except queue.Empty:
                    pass
                
                # Check if we should flush
                elapsed = time.time() - last_flush
                should_flush = (
                    len(buffer) >= BATCH_SIZE or
                    (len(buffer) > 0 and elapsed >= BATCH_TIMEOUT_SECONDS)
                )
                
                if should_flush and buffer:
                    self._flush_buffer(buffer)
                    buffer = []
                    last_flush = time.time()
            
            except Exception as e:
                print(f"Error in telemetry worker: {e}")
                # Continue despite errors
        
        # Final flush on shutdown
        if buffer:
            self._flush_buffer(buffer)
    
    def _flush_buffer(self, buffer: list) -> None:
        """
        Flush buffered writes to database.
        
        Args:
            buffer: List of (table_name, data_dict) tuples
        """
        if not buffer:
            return
        
        with self._flush_lock:
            try:
                self.db.begin_transaction()
                
                for table_name, data in buffer:
                    self._insert_row(table_name, data)
                
                self.db.end_transaction()
            except Exception as e:
                self.db.rollback()
                print(f"Error flushing telemetry buffer: {e}")
                raise
    
    def _insert_row(self, table_name: str, data: Dict[str, Any]) -> None:
        """
        Insert a single row into the database.
        
        Args:
            table_name: Target table name
            data: Dictionary of column_name -> value
        """
        # Validate table name to prevent injection
        valid_tables = {"sessions", "puzzles", "events"}
        if table_name not in valid_tables:
            raise ValueError(f"Invalid table name: {table_name}")
        
        # Build INSERT statement
        columns = ", ".join(data.keys())
        placeholders = ", ".join(["?" for _ in data])
        sql = f"INSERT INTO {table_name} ({columns}) VALUES ({placeholders})"
        
        # Execute
        self.db.execute(sql, tuple(data.values()))
    
    def record_session_start(
        self,
        company: str,
        expected_day: str,
        name: Optional[str] = None,
        expected_time: Optional[str] = None,
        place: Optional[str] = None,
        players_num: Optional[int] = None,
        language: Optional[str] = None,
        notes: Optional[str] = None,
        started_at: Optional[str] = None,
        ended_at: Optional[str] = None,
    ) -> int:
        """
        Record session start and return session_id.
        
        Args:
            company: Company or venue name
            expected_day: Session planned day value
            name: Group name
            expected_time: Planned time of the day
            place: Session place/location
            players_num: Number of players
            language: Session language
            notes: Free-form notes
            started_at: Optional explicit start timestamp
            ended_at: Optional explicit end timestamp
            
        Returns:
            session_id (for subsequent event tracking)
        """
        with self._flush_lock:
            self.db.execute(
                """
                INSERT INTO sessions (
                    company,
                    name,
                    expected_day,
                    expected_time,
                    place,
                    players_num,
                    language,
                    notes,
                    started_at,
                    ended_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    company,
                    name,
                    expected_day,
                    expected_time,
                    place,
                    players_num,
                    language,
                    notes,
                    started_at,
                    ended_at,
                ),
            )
            self.db.commit()
        
        # Get the inserted session_id
        cursor = self.db.execute("SELECT last_insert_rowid()")
        session_id = cursor.fetchone()[0]
        return session_id
    
    def record_puzzle_start(
        self,
        session_id: int,
        puzzle_num: int,
        round_num: Optional[int],
        order: int,
        started_at: Optional[str] = None,
        ended_at: Optional[str] = None,
    ) -> int:
        """
        Record a puzzle row and return puzzle_id.

        Args:
            session_id: Parent session ID
            puzzle_num: Puzzle number in the game
            round_num: Optional round number
            order: Position of the puzzle in the session flow
            started_at: Optional explicit start timestamp
            ended_at: Optional explicit end timestamp

        Returns:
            puzzle_id for subsequent event tracking
        """
        with self._flush_lock:
            self.db.execute(
                """
                INSERT INTO puzzles (session_id, puzzle_num, round_num, puzzle_order, started_at, ended_at)
                VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?)
                """,
                (session_id, puzzle_num, round_num, order, started_at, ended_at),
            )
            self.db.commit()

        cursor = self.db.execute("SELECT last_insert_rowid()")
        puzzle_id = cursor.fetchone()[0]
        return puzzle_id

    def record_event(
        self,
        session_id: int,
        puzzle_id: int,
        event_type: str,
        elapsed_ms: Optional[int] = None,
        data: Optional[Dict] = None,
    ) -> None:
        """
        Queue an event for batched write.
        
        Args:
            session_id: Session ID
            event_type: Type of event
            puzzle_id: Puzzle ID
            elapsed_ms: Milliseconds since session start
            data: Event data (will be JSON-encoded)
        """
        event_data = {
            "session_id": session_id,
            "event_type": event_type,
            "puzzle_id": puzzle_id,
            "elapsed_ms": elapsed_ms,
            "data": json.dumps(data) if data else None,
        }
        
        try:
            self._queue.put_nowait(("events", event_data))
        except queue.Full:
            print("Warning: telemetry queue full, dropping event")
    
    def update_session_fields(
        self,
        session_id: int,
        company: str,
        expected_day: str,
        name: Optional[str] = None,
        expected_time: Optional[str] = None,
        place: Optional[str] = None,
        players_num: Optional[int] = None,
        language: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> None:
        """Update editable fields of an existing session row."""
        with self._flush_lock:
            self.db.execute(
                """
                UPDATE sessions
                SET company = ?, name = ?, expected_day = ?, expected_time = ?,
                    place = ?, players_num = ?, language = ?, notes = ?
                WHERE session_id = ?
                """,
                (company, name, expected_day, expected_time, place, players_num, language, notes, session_id),
            )
            self.db.commit()

    def delete_session(self, session_id: int) -> None:
        """Delete a session and all dependent puzzle/event rows."""
        with self._flush_lock:
            # Drain queued event inserts first so delete order is deterministic.
            self.flush()
            try:
                self.db.begin_transaction()
                self.db.execute(
                    """
                    DELETE FROM events
                    WHERE session_id = ?
                    """,
                    (session_id,),
                )
                self.db.execute(
                    """
                    DELETE FROM puzzles
                    WHERE session_id = ?
                    """,
                    (session_id,),
                )
                self.db.execute(
                    """
                    DELETE FROM sessions
                    WHERE session_id = ?
                    """,
                    (session_id,),
                )
                self.db.end_transaction()
            except Exception:
                self.db.rollback()
                raise

    def start_session(self, session_id: int, started_at: Optional[str] = None) -> None:
        """Fill started_at for a session only if it has not been set yet (idempotent)."""
        with self._flush_lock:
            self.db.execute(
                """
                UPDATE sessions
                SET started_at = COALESCE(?, CURRENT_TIMESTAMP)
                WHERE session_id = ? AND started_at IS NULL
                """,
                (started_at, session_id),
            )
            self.db.commit()

    def end_session(self, session_id: int, ended_at: Optional[str] = None) -> None:
        """Update a session end timestamp immediately."""
        with self._flush_lock:
            self.db.execute(
                """
                UPDATE sessions
                SET ended_at = COALESCE(?, CURRENT_TIMESTAMP)
                WHERE session_id = ?
                """,
                (ended_at, session_id),
            )
            self.db.commit()

    def end_puzzle(self, puzzle_id: int, ended_at: Optional[str] = None) -> None:
        """Update a puzzle end timestamp immediately."""
        with self._flush_lock:
            self.db.execute(
                """
                UPDATE puzzles
                SET ended_at = COALESCE(?, CURRENT_TIMESTAMP)
                WHERE puzzle_id = ?
                """,
                (ended_at, puzzle_id),
            )
            self.db.commit()
    
    def flush(self) -> None:
        """Block until the in-memory queue has been drained."""
        while not self._queue.empty():
            time.sleep(0.05)
        time.sleep(0.05)
    
    def shutdown(self, timeout: int = 10) -> None:
        """
        Gracefully shutdown the writer, flushing all pending data.
        
        Args:
            timeout: Seconds to wait for worker thread to finish
        """
        with self._shutdown_once_lock:
            if self._closed:
                return
            self._closed = True

        self._shutdown.set()
        
        if self._worker_thread:
            self._worker_thread.join(timeout=timeout)
            if self._worker_thread.is_alive():
                print("Warning: telemetry worker did not shut down cleanly")
        
        self.db.close()
