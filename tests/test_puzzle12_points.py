"""Real completion-to-SQLite callback, without starting Flask or MQTT."""
import ast
import queue
import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from mqtt.client import MQTTClient
from mqtt.puzzles.puzzle12 import Puzzle12
from telemetry.schema import init_schema
from telemetry.writer import TelemetryWriter
from telemetry.queries import TelemetryQueries


ROOT = Path(__file__).resolve().parents[1]


class Puzzle12PointsIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        folder = Path(self.tmp.name)
        init_schema(folder)
        self.writer = TelemetryWriter(folder)
        self.queries = TelemetryQueries(folder)
        self.session = self.writer.record_session_start('Test', '2026-10-20')
        self.row = self.writer.record_puzzle_start(self.session, 12, 1, 3)
        self.client = MQTTClient.__new__(MQTTClient)
        self.client.lock = threading.Lock()
        self.client.telemetry_writer = self.writer
        self.client.active_puzzle_row_id = self.row
        self.client.active_puzzle_num = 12
        self.client.current_puzzle_id = 12
        self.client.client = SimpleNamespace(publish=Mock())
        self.events = queue.Queue()
        namespace = dict(mqtt_client=self.client, _sse_clients_lock=threading.Lock(),
                         _sse_clients=[self.events])
        node = next(node for node in ast.parse((ROOT / 'app.py').read_text()).body
                    if isinstance(node, ast.FunctionDef) and node.name == 'push_state_update')
        exec(compile(ast.Module(body=[node], type_ignores=[]), 'isolated-score-callback', 'exec'), namespace)
        self.client.update_callback = namespace['push_state_update']
        self.puzzle = Puzzle12(self.client)
        self.enterContext(patch('builtins.print'))
        self.timer = self.enterContext(patch('mqtt.puzzles.puzzle12.threading.Timer'))
        self.enterContext(patch('mqtt.puzzles.puzzle12.time.sleep'))
        self.puzzle.reset()

    def tearDown(self):
        self.puzzle.stop()
        self.writer.shutdown(timeout=2)
        self.queries.close()
        self.tmp.cleanup()

    def saved(self):
        return self.queries.get_session_puzzles(self.session)[0]

    def retry(self):
        self.puzzle.timer_expired()
        self.timer.call_args.args[1](*self.timer.call_args.kwargs['args'])

    def complete(self):
        for box in range(1, 11):
            buttons = ''.join('1' if box <= count else '0' for count in self.puzzle.current_target)
            self.puzzle.handle_message(['P12', str(box), buttons])
        self.timer.call_args.args[1](*self.timer.call_args.kwargs['args'])

    def test_first_success_persists_one_hundred_points(self):
        self.complete()
        self.assertEqual(self.saved()['total_points'], 100)
        self.assertIsNotNone(self.saved()['ended_at'])
        self.assertIsNone(self.client.active_puzzle_row_id)
        self.client.push_update({'puzzle_id': 12, 'puzzle_solved': True, 'total_points': 0})
        self.assertEqual(self.saved()['total_points'], 100)

    def test_fifth_restart_help_success_persists_fifty_points(self):
        for _ in range(5):
            self.retry()
        self.complete()
        self.assertEqual(self.saved()['total_points'], 50)
        self.assertIsNotNone(self.saved()['ended_at'])

    def test_zero_points_continues_until_solved_then_closes(self):
        for _ in range(12):
            self.retry()
        self.assertIsNone(self.saved()['ended_at'])
        self.assertEqual(self.saved()['total_points'], 0)
        self.assertEqual(self.client.active_puzzle_row_id, self.row)
        self.complete()
        self.assertEqual(self.saved()['total_points'], 0)
        self.assertIsNotNone(self.saved()['ended_at'])


if __name__ == '__main__':
    unittest.main()