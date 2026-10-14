"""Cronómetro -> real telemetry callback -> temporary SQLite, without startup."""
import ast
import queue
import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from mqtt.client import MQTTClient
from mqtt.puzzles.puzzle5 import Puzzle5
from telemetry.schema import init_schema
from telemetry.writer import TelemetryWriter
from telemetry.queries import TelemetryQueries


ROOT = Path(__file__).resolve().parents[1]


class Puzzle5PointsIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        folder = Path(self.tmp.name)
        init_schema(folder)
        self.writer = TelemetryWriter(folder)
        self.queries = TelemetryQueries(folder)
        self.session = self.writer.record_session_start('Test', '2026-10-14')
        self.row = self.writer.record_puzzle_start(self.session, 5, 1, 3)
        self.client = MQTTClient.__new__(MQTTClient)
        self.client.lock = threading.Lock()
        self.client.telemetry_writer = self.writer
        self.client.active_puzzle_row_id = self.row
        self.client.active_puzzle_num = 5
        self.client.current_puzzle_id = 5
        self.client.client = SimpleNamespace(publish=Mock())
        self.events = queue.Queue()
        namespace = dict(mqtt_client=self.client, _sse_clients_lock=threading.Lock(),
                         _sse_clients=[self.events])
        node = next(node for node in ast.parse((ROOT / 'app.py').read_text()).body
                    if isinstance(node, ast.FunctionDef) and node.name == 'push_state_update')
        exec(compile(ast.Module(body=[node], type_ignores=[]), 'isolated-score-callback', 'exec'), namespace)
        self.client.update_callback = namespace['push_state_update']
        self.enterContext(patch('mqtt.puzzles.puzzle5.threading.Timer'))
        self.puzzle = Puzzle5(self.client)
        self.puzzle.reset()

    def tearDown(self):
        self.puzzle.stop()
        self.writer.shutdown(timeout=2)
        self.queries.close()
        self.tmp.cleanup()

    def finish(self, attempt, success):
        with self.puzzle.lock:
            self.puzzle._start_round_locked(1)
            self.puzzle.attempt = attempt
            limit = self.puzzle._limit_locked()
        for player in range(10):
            error = (limit if success else limit + 1) if player == 0 else 0
            self.puzzle.handle_message(['P5', str(player), str(error)])
        with self.puzzle.lock:
            self.puzzle._show_result_locked()
            self.puzzle._finish_result_locked()

    def saved(self):
        return self.queries.get_session_puzzles(self.session)[0]

    def test_success_saves_shared_score_once(self):
        self.finish(3, True)
        self.assertEqual(self.saved()['total_points'], 80)
        self.assertIsNotNone(self.saved()['ended_at'])
        self.assertIsNone(self.client.active_puzzle_row_id)
        self.client.push_update({'puzzle_id': 5, 'puzzle_solved': True, 'total_points': 100})
        self.assertEqual(self.saved()['total_points'], 80)

    def test_tenth_success_saves_ten_points(self):
        self.finish(10, True)
        self.assertTrue(self.puzzle.solved)
        self.assertEqual(self.saved()['total_points'], 10)

    def test_failure_does_not_close_or_score_the_run(self):
        self.finish(1, False)
        self.assertIsNone(self.saved()['ended_at'])
        self.assertEqual(self.saved()['total_points'], 0)
        self.assertEqual(self.client.active_puzzle_row_id, self.row)

    def test_exhaustion_closes_at_zero_without_victory(self):
        self.finish(10, False)
        self.assertTrue(self.puzzle.exhausted)
        self.assertFalse(self.puzzle.solved)
        self.assertIsNotNone(self.saved()['ended_at'])
        self.assertEqual(self.saved()['total_points'], 0)
        events = []
        while not self.events.empty():
            events.append(self.events.get_nowait())
        self.assertTrue(any(event.get('puzzle_exhausted') for event in events))
        self.assertFalse(any(event.get('puzzle_solved') for event in events))


if __name__ == '__main__':
    unittest.main()