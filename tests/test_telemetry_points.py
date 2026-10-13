"""Puzzle-only points storage and migration, without Flask or MQTT startup."""
import sqlite3
import tempfile
import unittest
from pathlib import Path

from telemetry.config import SCHEMA_VERSION
from telemetry.queries import TelemetryQueries
from telemetry.schema import SCHEMA_DDL, init_schema


class TelemetryPointsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name)
        init_schema(self.path)
        self.db = sqlite3.connect(self.path / 'telemetry.sqlite3')
        self.db.execute('PRAGMA foreign_keys = ON')
        self.queries = TelemetryQueries(self.path)

    def tearDown(self):
        self.queries.close()
        self.db.close()
        self.tmp.cleanup()

    def session(self):
        return self.db.execute("""
            INSERT INTO sessions(company, expected_day) VALUES ('Test', '2026-10-13')
        """).lastrowid

    def puzzle(self, session_id, number, points=0, round_num=1):
        return self.db.execute("""
            INSERT INTO puzzles(session_id, puzzle_num, puzzle_order, round_num, total_points)
            VALUES (?, ?, ?, ?, ?)
        """, (session_id, number, number, round_num, points)).lastrowid

    def assert_no_session_total(self, db):
        self.assertNotIn('total_points', [row[1] for row in db.execute('PRAGMA table_info(sessions)')])
        self.assertEqual(db.execute("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'puzzles_points_%'").fetchall(), [])

    def test_defaults_are_zero(self):
        sid = self.session()
        pid = self.db.execute('INSERT INTO puzzles(session_id, puzzle_num, puzzle_order) VALUES (?, 3, 1)', (sid,)).lastrowid
        self.assertEqual(self.db.execute(
            'SELECT total_points FROM puzzles WHERE puzzle_id = ?', (pid,)
        ).fetchone()[0], 0)
        self.assert_no_session_total(self.db)

    def test_puzzle_points_remain_linked_to_their_session(self):
        first, second = self.session(), self.session()
        self.puzzle(first, 3, 12)
        self.puzzle(first, 8, 5)
        self.puzzle(second, 3, 100)
        self.db.commit()
        self.assertEqual([p['total_points'] for p in self.queries.get_session_puzzles(first)], [12, 5])
        self.assertEqual([p['total_points'] for p in self.queries.get_session_puzzles(second)], [100])
        self.assert_no_session_total(self.db)

    def test_point_updates_moves_and_deletes_work_without_triggers(self):
        first, second = self.session(), self.session()
        pid = self.puzzle(first, 3, 10)
        self.puzzle(second, 8, 4)
        self.db.execute('UPDATE puzzles SET total_points = 25 WHERE puzzle_id = ?', (pid,))
        self.db.execute('UPDATE puzzles SET session_id = ? WHERE puzzle_id = ?', (second, pid))
        self.assertEqual(self.db.execute('SELECT session_id, total_points FROM puzzles WHERE puzzle_id = ?', (pid,)).fetchone(), (second, 25))
        self.db.execute('DELETE FROM puzzles WHERE puzzle_id = ?', (pid,))
        self.assertEqual(self.db.execute('SELECT total_points FROM puzzles WHERE session_id = ?', (second,)).fetchall(), [(4,)])
        self.db.execute('DELETE FROM puzzles WHERE session_id = ?', (second,))
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM puzzles').fetchone()[0], 0)
        self.assert_no_session_total(self.db)

    def test_only_puzzle_queries_expose_points(self):
        sid = self.session()
        self.puzzle(sid, 3, 6, round_num=1)
        self.puzzle(sid, 3, 9, round_num=2)
        self.db.commit()
        self.assertEqual([p['total_points'] for p in self.queries.get_session_puzzles(sid)], [6, 9])
        for row in (self.queries.get_session_stats(sid), self.queries.get_all_sessions()[0],
                    self.queries.get_pending_sessions()[0], self.queries.get_session_agenda()[0]):
            self.assertNotIn('total_points', row)

    def check_migration(self, version):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)
            db = sqlite3.connect(path / 'telemetry.sqlite3')
            if version == 3:
                old_ddl = SCHEMA_DDL.replace('    total_points INTEGER NOT NULL DEFAULT 0,\n', '')
            else:
                old_ddl = SCHEMA_DDL.replace('    observations TEXT,\n', '    observations TEXT,\n    total_points INTEGER NOT NULL DEFAULT 0,\n')
            db.executescript(old_ddl)
            db.execute('INSERT INTO schema_info(id, version) VALUES (1, ?)', (version,))
            db.execute("INSERT INTO sessions(session_id, company, expected_day) VALUES (8, 'Keep', '2026-10-13')")
            db.execute('INSERT INTO puzzles(puzzle_id, session_id, puzzle_num, puzzle_order) VALUES (9, 8, 3, 1)')
            db.execute("INSERT INTO events(event_id, session_id, puzzle_id, event_type) VALUES (10, 8, 9, 'solved')")
            if version == 4:
                db.execute('UPDATE puzzles SET total_points = 20')
                db.execute('UPDATE sessions SET total_points = 20')
                for action, name in [('INSERT', 'insert'), ('UPDATE', 'update'), ('DELETE', 'delete')]:
                    db.executescript(f'''
                        CREATE TRIGGER puzzles_points_{name} AFTER {action} ON puzzles
                        BEGIN
                            UPDATE sessions SET total_points = (
                                SELECT COALESCE(SUM(total_points), 0) FROM puzzles
                                WHERE puzzles.session_id = sessions.session_id
                            );
                        END;
                    ''')
            db.commit()
            db.close()
            init_schema(path)
            init_schema(path)
            with sqlite3.connect(path / 'telemetry.sqlite3') as db:
                self.assertEqual(db.execute('SELECT version FROM schema_info').fetchone()[0], SCHEMA_VERSION)
                self.assertEqual(db.execute('SELECT session_id, company FROM sessions').fetchall(), [(8, 'Keep')])
                self.assertEqual(db.execute('SELECT puzzle_id, total_points FROM puzzles').fetchall(), [(9, 20 if version == 4 else 0)])
                self.assertEqual(db.execute('SELECT event_id, event_type FROM events').fetchall(), [(10, 'solved')])
                self.assert_no_session_total(db)
                self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(), [])
                db.execute('UPDATE puzzles SET total_points = 30 WHERE puzzle_id = 9')
                db.commit()
            init_schema(path)
            with sqlite3.connect(path / 'telemetry.sqlite3') as db:
                self.assertEqual(db.execute('SELECT total_points FROM puzzles').fetchone()[0], 30)
                self.assert_no_session_total(db)

    def test_version_three_migrates_without_losing_records(self):
        self.check_migration(3)

    def test_version_four_removes_session_total_and_preserves_puzzle_scores(self):
        self.check_migration(4)

    def test_unsupported_versions_do_not_delete_data(self):
        sid = self.session()
        self.puzzle(sid, 3, 10)
        for version in (2, SCHEMA_VERSION + 1):
            with self.subTest(version=version):
                self.db.execute('UPDATE schema_info SET version = ?', (version,))
                self.db.commit()
                with self.assertRaisesRegex(ValueError, 'database preserved'):
                    init_schema(self.path)
                self.assertEqual(self.db.execute('SELECT total_points FROM puzzles').fetchone()[0], 10)
                self.assertEqual(self.db.execute('SELECT COUNT(*) FROM puzzles').fetchone()[0], 1)
                self.assertEqual(self.db.execute('SELECT version FROM schema_info').fetchone()[0], version)


if __name__ == '__main__':
    unittest.main()