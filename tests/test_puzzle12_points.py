"""Real completion-to-SQLite callback, without starting Flask or MQTT."""
import ast
import queue
import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from flask import Flask, jsonify, request

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
        self.client.puzzles = {12: self.puzzle}
        app = Flask('isolated-puzzle12-gm')
        route = next(node for node in ast.parse((ROOT / 'app.py').read_text()).body
                     if isinstance(node, ast.FunctionDef) and node.name == 'test_force_end')
        route_namespace = dict(app=app, mqtt_client=self.client,
                               request=request, jsonify=jsonify)
        exec(compile(ast.Module(body=[route], type_ignores=[]),
                     'isolated-gm-route', 'exec'), route_namespace)
        self.http = app.test_client()

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

    def force_complete(self):
        response = self.http.post('/test/force_end', json={'puzzle_id': 12})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['end_payload'], 'P12End')

    def test_gm_button_persists_one_hundred_and_publishes_scored_success(self):
        self.force_complete()
        self.assertEqual(self.saved()['total_points'], 100)
        self.assertIsNotNone(self.saved()['ended_at'])
        self.assertIsNone(self.client.active_puzzle_row_id)
        self.assertEqual(self.puzzle.get_state()['total_points'], 100)
        terminal = [event for event in self.events.queue if event.get('puzzle_solved')]
        self.assertEqual(len(terminal), 1)
        self.assertTrue(terminal[0]['forced_by_gm'])
        self.assertEqual(terminal[0]['total_points'], 100)
        self.client.client.publish.assert_any_call('FROM_FLASK', 'P12End')

    def test_gm_button_keeps_penalties_and_zero_floor(self):
        for _ in range(5):
            self.retry()
        self.force_complete()
        self.assertEqual(self.saved()['total_points'], 50)

    def test_gm_button_can_finish_at_zero_points(self):
        for _ in range(12):
            self.retry()
        self.force_complete()
        self.assertEqual(self.saved()['total_points'], 0)
        self.assertIsNotNone(self.saved()['ended_at'])

    def test_gm_button_during_retry_cancels_late_callbacks(self):
        self.puzzle.timer_expired()
        callback = self.timer.call_args.args[1]
        args = self.timer.call_args.kwargs['args']
        timer = self.puzzle._retry_timer
        self.force_complete()
        timer.cancel.assert_called_once()
        count = self.events.qsize()
        callback(*args)
        self.puzzle.timer_expired()
        self.assertEqual(self.events.qsize(), count)
        self.assertEqual(self.saved()['total_points'], 90)
        self.assertFalse(self.puzzle.processing_wrong_result)

    def test_gm_button_during_confirmation_saves_only_once(self):
        for box in range(1, 11):
            buttons = ''.join('1' if box <= count else '0' for count in self.puzzle.current_target)
            self.puzzle.handle_message(['P12', str(box), buttons])
        callback = self.timer.call_args.args[1]
        args = self.timer.call_args.kwargs['args']
        timer = self.puzzle._solve_timer
        with patch.object(self.writer, 'end_puzzle', wraps=self.writer.end_puzzle) as end:
            self.force_complete()
            self.force_complete()
            callback(*args)
            self.client.push_update(self.puzzle.get_state())
            end.assert_called_once_with(self.row, total_points=100)
        timer.cancel.assert_called_once()
        terminal = [event for event in self.events.queue if event.get('puzzle_solved')]
        # The explicit snapshot is also solved, but does not re-score.
        self.assertEqual(sum(bool(event.get('forced_by_gm')) for event in terminal), 1)
        self.assertEqual(self.saved()['total_points'], 100)

    def test_gm_button_after_normal_success_preserves_score_without_second_end(self):
        self.retry()
        self.complete()
        self.client.client.publish.reset_mock()
        self.force_complete()
        self.client.client.publish.assert_not_called()
        self.assertEqual(self.saved()['total_points'], 90)

    def test_gm_button_rejects_other_active_puzzle_without_scoring(self):
        self.client.current_puzzle_id = 4
        response = self.http.post('/test/force_end', json={'puzzle_id': 12})
        self.assertEqual(response.status_code, 409)
        self.assertFalse(self.puzzle.solved)
        self.assertIsNone(self.saved()['ended_at'])


if __name__ == '__main__':
    unittest.main()