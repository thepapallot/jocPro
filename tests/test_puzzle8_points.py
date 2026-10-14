"""Actual score-to-telemetry path, with temporary SQLite and no Flask/MQTT startup."""
import ast
import queue
import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from mqtt.client import MQTTClient
from mqtt.puzzles.puzzle8 import Puzzle8
from telemetry.schema import init_schema
from telemetry.writer import TelemetryWriter
from telemetry.queries import TelemetryQueries


ROOT = Path(__file__).resolve().parents[1]


class Puzzle8PointsIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        folder = Path(self.tmp.name)
        init_schema(folder)
        self.writer = TelemetryWriter(folder)
        self.queries = TelemetryQueries(folder)
        self.session = self.writer.record_session_start('Test', '2026-10-14')
        self.row = self.writer.record_puzzle_start(self.session, 8, 1, 3)
        self.client = MQTTClient.__new__(MQTTClient)
        self.client.lock = threading.Lock()
        self.client.telemetry_writer = self.writer
        self.client.active_puzzle_row_id = self.row
        self.client.active_puzzle_num = 8
        self.client.current_puzzle_id = 8
        self.client.client = SimpleNamespace(publish=Mock())
        self.events = queue.Queue()
        namespace = dict(mqtt_client=self.client, _sse_clients_lock=threading.Lock(),
                         _sse_clients=[self.events])
        node = next(node for node in ast.parse((ROOT / 'app.py').read_text()).body
                    if isinstance(node, ast.FunctionDef) and node.name == 'push_state_update')
        exec(compile(ast.Module(body=[node], type_ignores=[]), 'isolated-score-callback', 'exec'), namespace)
        self.client.update_callback = namespace['push_state_update']

    def tearDown(self):
        self.writer.shutdown(timeout=2)
        self.queries.close()
        self.tmp.cleanup()

    def result(self, attempt, success):
        puzzle = Puzzle8(self.client)
        puzzle.phase = 'input'
        puzzle.round = 1
        puzzle.attempt = attempt
        puzzle._schedule = Mock()
        symbols = puzzle.symbols
        puzzle.target_sets = [
            {'symbols': symbols[:], 'colors': dict.fromkeys(symbols, 'red')},
            {'symbols': symbols[1:] + symbols[:1], 'colors': dict.fromkeys(symbols, 'blue')},
        ]
        for box in range(10):
            puzzle.player_symbols[box] = [target['symbols'][box] for target in puzzle.target_sets]
            puzzle.player_colors[box] = ['red', 'blue']
        if not success:
            puzzle.player_symbols[0] = [symbols[0], symbols[0]]
            puzzle.player_colors[0] = ['red', 'red']
        with patch('mqtt.puzzles.puzzle8.threading.Thread') as thread:
            with puzzle.lock:
                puzzle._evaluate_inputs_locked()
            with patch('mqtt.puzzles.puzzle8.time.sleep'):
                thread.call_args.kwargs['target']()
        return puzzle

    def saved(self):
        return self.queries.get_session_puzzles(self.session)[0]

    def test_first_success_is_saved_once_on_the_active_puzzle_row(self):
        puzzle = self.result(1, True)
        self.assertTrue(puzzle.solved)
        self.assertEqual(self.saved()['total_points'], 100)
        self.assertIsNotNone(self.saved()['ended_at'])
        self.assertIsNone(self.client.active_puzzle_row_id)
        self.client.push_update({'puzzle_id': 8, 'puzzle_solved': True, 'total_points': 100})
        self.assertEqual(self.saved()['total_points'], 100)

    def test_success_after_two_retries_saves_eighty_points(self):
        self.result(3, True)
        self.assertEqual(self.saved()['total_points'], 80)

    def test_exhaustion_closes_the_run_at_zero_without_solved_event(self):
        puzzle = self.result(10, False)
        self.assertTrue(puzzle.exhausted)
        self.assertFalse(puzzle.solved)
        self.assertEqual(self.saved()['total_points'], 0)
        self.assertIsNotNone(self.saved()['ended_at'])
        events = []
        while not self.events.empty():
            events.append(self.events.get_nowait())
        self.assertTrue(any(event.get('puzzle_exhausted') for event in events))
        self.assertFalse(any(event.get('puzzle_solved') for event in events))

    def test_nonterminal_failure_does_not_end_or_score_the_run(self):
        self.result(1, False)
        self.assertEqual(self.saved()['total_points'], 0)
        self.assertIsNone(self.saved()['ended_at'])
        self.assertEqual(self.client.active_puzzle_row_id, self.row)

    def test_delayed_event_from_another_puzzle_cannot_score_this_run(self):
        self.client.push_update({'puzzle_id': 3, 'puzzle_solved': True, 'total_points': 100})
        self.client.end_active_puzzle(3, total_points=100)
        self.assertIsNone(self.saved()['ended_at'])
        self.assertEqual(self.saved()['total_points'], 0)

    def test_old_end_calls_preserve_existing_points_and_sessions_have_no_total(self):
        self.writer.end_puzzle(self.row, total_points=90)
        self.writer.end_puzzle(self.row)
        self.assertEqual(self.saved()['total_points'], 90)
        self.assertNotIn('total_points', self.queries.get_session_stats(self.session))

    def test_writer_rejects_invalid_points_without_ending_the_puzzle(self):
        for points in [-1, 1.5, '100', True]:
            with self.subTest(points=points):
                with self.assertRaises(ValueError):
                    self.writer.end_puzzle(self.row, total_points=points)
        self.assertIsNone(self.saved()['ended_at'])


if __name__ == '__main__':
    unittest.main()