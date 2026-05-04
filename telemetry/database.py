"""
SQLite connection management and database utilities.
"""

import sqlite3
import threading
from pathlib import Path
from typing import Optional

from .config import PRAGMAS


class DatabaseConnection:
    """Thread-safe SQLite database connection wrapper."""
    
    def __init__(self, db_path: Path):
        """
        Initialize database connection.
        
        Args:
            db_path: Path to database directory
        """
        self.db_path = Path(db_path)
        self.db_file = self.db_path / "telemetry.sqlite3"
        self._local = threading.local()
        self._lock = threading.Lock()
    
    def get_connection(self) -> sqlite3.Connection:
        """
        Get thread-local connection (creates if needed).
        
        Returns:
            sqlite3.Connection instance
        """
        if not hasattr(self._local, "connection") or self._local.connection is None:
            self._local.connection = self._create_connection()
        return self._local.connection
    
    def _create_connection(self) -> sqlite3.Connection:
        """Create and configure SQLite connection."""
        conn = sqlite3.connect(str(self.db_file), timeout=PRAGMAS.get("timeout", 5000) / 1000.0, check_same_thread=False)
        
        # Apply pragmas for Raspberry Pi
        for pragma_name, pragma_value in PRAGMAS.items():
            if pragma_name != "timeout":  # timeout already handled in connect()
                if isinstance(pragma_value, int):
                    conn.execute(f"PRAGMA {pragma_name} = {pragma_value}")
                else:
                    conn.execute(f"PRAGMA {pragma_name} = {pragma_value}")
        
        # Enable row factory for dict-like access
        conn.row_factory = sqlite3.Row
        
        return conn
    
    def close(self) -> None:
        """Close thread-local connection."""
        if hasattr(self._local, "connection") and self._local.connection:
            self._local.connection.close()
            self._local.connection = None
    
    def execute(self, sql: str, params: tuple = ()) -> sqlite3.Cursor:
        """
        Execute SQL statement and return cursor.
        
        Args:
            sql: SQL statement
            params: Query parameters
            
        Returns:
            Cursor with results
        """
        conn = self.get_connection()
        return conn.execute(sql, params)
    
    def executemany(self, sql: str, params_list: list) -> None:
        """
        Execute SQL statement with multiple parameter sets.
        
        Args:
            sql: SQL statement
            params_list: List of parameter tuples
        """
        conn = self.get_connection()
        conn.executemany(sql, params_list)
    
    def commit(self) -> None:
        """Commit pending transaction."""
        conn = self.get_connection()
        conn.commit()
    
    def rollback(self) -> None:
        """Rollback pending transaction."""
        conn = self.get_connection()
        conn.rollback()
    
    def begin_transaction(self) -> None:
        """Begin explicit transaction."""
        conn = self.get_connection()
        conn.execute("BEGIN")
    
    def end_transaction(self) -> None:
        """End (commit) explicit transaction."""
        conn = self.get_connection()
        conn.commit()


def get_journal_mode(db_path: Path) -> Optional[str]:
    """
    Check current journal mode (should be WAL for safety).
    
    Args:
        db_path: Path to database directory
        
    Returns:
        Journal mode string or None if DB doesn't exist
    """
    db_file = db_path / "telemetry.sqlite3"
    if not db_file.exists():
        return None
    
    conn = sqlite3.connect(str(db_file))
    try:
        cursor = conn.cursor()
        cursor.execute("PRAGMA journal_mode")
        result = cursor.fetchone()
        return result[0] if result else None
    finally:
        conn.close()


def get_db_info(db_path: Path) -> dict:
    """
    Get database info (size, tables, row counts).
    
    Args:
        db_path: Path to database directory
        
    Returns:
        Dictionary with DB stats
    """
    db_file = db_path / "telemetry.sqlite3"
    
    if not db_file.exists():
        return {"exists": False}
    
    info = {
        "exists": True,
        "size_bytes": db_file.stat().st_size,
        "tables": {},
    }
    
    # Check for WAL side files
    wal_file = Path(str(db_file) + "-wal")
    shm_file = Path(str(db_file) + "-shm")
    info["wal_file_exists"] = wal_file.exists()
    info["shm_file_exists"] = shm_file.exists()
    
    conn = sqlite3.connect(str(db_file))
    try:
        cursor = conn.cursor()
        
        # Get journal mode
        cursor.execute("PRAGMA journal_mode")
        info["journal_mode"] = cursor.fetchone()[0]
        
        # Get row counts per table
        cursor.execute(
            """
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
            """
        )
        tables = cursor.fetchall()
        
        for (table_name,) in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            count = cursor.fetchone()[0]
            info["tables"][table_name] = count
    finally:
        conn.close()
    
    return info
