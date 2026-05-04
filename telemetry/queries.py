"""
Query helpers for telemetry reporting and analytics.
"""

from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

from .database import DatabaseConnection


class TelemetryQueries:
    """Query helpers for telemetry analytics."""
    
    def __init__(self, db_path: Path):
        """
        Initialize query helper.
        
        Args:
            db_path: Path to database directory
        """
        self.db_path = Path(db_path)
        self.db = DatabaseConnection(self.db_path)
    
    def get_session_stats(self, session_id: int) -> Optional[Dict[str, Any]]:
        """
        Get statistics for a single session.
        
        Args:
            session_id: Session ID
            
        Returns:
            Dictionary with session stats or None if not found
        """
        cursor = self.db.execute(
            """
            SELECT 
                session_id,
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
            FROM sessions
            WHERE session_id = ?
            """,
            (session_id,),
        )
        
        row = cursor.fetchone()
        if not row:
            return None
        
        return dict(row)
    
    def get_puzzle_stats_by_number(
        self,
        puzzle_num: int,
        days_back: int = 7,
    ) -> Dict[str, Any]:
        """
        Get execution statistics for a puzzle number.
        
        Args:
            puzzle_num: Puzzle number from the game flow
            days_back: Look back N days
            
        Returns:
            Dictionary with occurrence and duration stats
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days_back)
        
        cursor = self.db.execute(
            """
            SELECT
                COUNT(*) as total_runs,
                AVG((julianday(ended_at) - julianday(started_at)) * 86400.0) as avg_duration_seconds,
                MIN((julianday(ended_at) - julianday(started_at)) * 86400.0) as min_duration_seconds,
                MAX((julianday(ended_at) - julianday(started_at)) * 86400.0) as max_duration_seconds,
                AVG(COALESCE(round_num, 1)) as avg_round_num
            FROM puzzles
            WHERE puzzle_num = ? AND started_at >= ?
            """,
            (puzzle_num, cutoff_date.isoformat()),
        )
        
        row = cursor.fetchone()
        if not row:
            return {}

        return dict(row)
    
    def get_session_action_timeline(self, session_id: int) -> List[Dict[str, Any]]:
        """
        Get chronological sequence of all events/actions in a session.

        Args:
            session_id: Session ID

        Returns:
            List of events in elapsed order
        """
        cursor = self.db.execute(
            """
            SELECT
                event_id,
                puzzle_id,
                event_type,
                elapsed_ms,
                data
            FROM events
            WHERE session_id = ?
            ORDER BY elapsed_ms ASC, event_id ASC
            """,
            (session_id,),
        )

        return [dict(row) for row in cursor.fetchall()]

    def get_session_puzzles(self, session_id: int) -> List[Dict[str, Any]]:
        """Get the ordered puzzles played within a session."""
        cursor = self.db.execute(
            """
            SELECT
                puzzle_id,
                session_id,
                puzzle_num,
                round_num,
                puzzle_order,
                started_at,
                ended_at
            FROM puzzles
            WHERE session_id = ?
            ORDER BY puzzle_order ASC, puzzle_id ASC
            """,
            (session_id,),
        )

        return [dict(row) for row in cursor.fetchall()]

    def get_all_sessions(
        self,
        company: Optional[str] = None,
        days_back: int = 7,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Get list of sessions, optionally filtered by company."""
        cutoff_date = datetime.utcnow() - timedelta(days=days_back)
        if company is not None:
            cursor = self.db.execute(
                """
                SELECT
                    session_id,
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
                FROM sessions
                WHERE company = ? AND started_at >= ?
                ORDER BY started_at DESC
                LIMIT ?
                """,
                (company, cutoff_date.isoformat(), limit),
            )
        else:
            cursor = self.db.execute(
                """
                SELECT
                    session_id,
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
                FROM sessions
                WHERE started_at >= ?
                ORDER BY started_at DESC
                LIMIT ?
                """,
                (cutoff_date.isoformat(), limit),
            )
        
        return [dict(row) for row in cursor.fetchall()]
    
    def get_event_counts_by_type(
        self,
        puzzle_num: Optional[int] = None,
        days_back: int = 7,
    ) -> Dict[str, int]:
        """
        Get counts of events by type.
        
        Args:
            puzzle_num: Filter by puzzle number (None = all)
            days_back: Look back N days
            
        Returns:
            Dictionary of event_type -> count
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days_back)
        
        if puzzle_num is not None:
            cursor = self.db.execute(
                """
                SELECT
                    e.event_type,
                    COUNT(*) as count
                FROM events e
                JOIN puzzles p ON p.puzzle_id = e.puzzle_id
                WHERE p.puzzle_num = ? AND p.started_at >= ?
                GROUP BY e.event_type
                """,
                (puzzle_num, cutoff_date.isoformat()),
            )
        else:
            cursor = self.db.execute(
                """
                SELECT
                    event_type,
                    COUNT(*) as count
                FROM events
                    WHERE session_id IN (
                        SELECT session_id FROM sessions WHERE started_at >= ?
                    )
                GROUP BY event_type
                """,
                (cutoff_date.isoformat(),),
            )
        
        return {row[0]: row[1] for row in cursor.fetchall()}
    
    def close(self) -> None:
        """Close database connection."""
        self.db.close()
