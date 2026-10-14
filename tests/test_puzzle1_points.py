"""Sum completion scores through the real callback into temporary SQLite."""
import ast
import queue
import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from mqtt.client import MQTTClient
from mqtt.puzzles.puzzle1 import Puzzle1
from scoring_config import SCORING_CONFIG
from telemetry.schema import init_schema
from telemetry.writer import TelemetryWriter
from telemetry.queries import TelemetryQueries


ROOT = Path(__file__).resolve().parents[1]


class Puzzle1PointsIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        folder = Path(self.tmp.name)
        init_schema(folder)
        self.writer = TelemetryWriter(folder)
        self.queries = TelemetryQueries(folder)
        self.session = self.writer.record_session_start('Test', '2026-10-14')
        self.row = self.writer.record_puzzle_start(self.session, 1, 1, 2)
        self.client = MQTTClient.__new__(MQTTClient)
        self.client.lock = threading.Lock()
        self.client.telemetry_writer = self.writer
        self.client.active_puzzle_row_id = self.row
        self.client.active_puzzle_num = 1
        self.client.current_puzzle_id = 1
        self.client.client = SimpleNamespace(publish=Mock())
        self.events = queue.Queue()
        namespace = dict(mqtt_client=self.client, _sse_clients_lock=threading.Lock(),
                         _sse_clients=[self.events])
        node = next(node for node in ast.parse((ROOT / 'app.py').read_text()).body
                    if isinstance(node, ast.FunctionDef) and node.name == 'push_state_update')
        exec(compile(ast.Module(body=[node], type_ignores=[]), 'isolated-score-callback', 'exec'), namespace)
        self.client.update_callback = namespace['push_state_update']
        self.puzzle = Puzzle1(self.client)
        self.puzzle.reset()

    def tearDown(self):
        self.puzzle.stop()
        self.writer.shutdown(timeout=2)
        self.queries.close()
        self.tmp.cleanup()

    def saved(self):
        return self.queries.get_session_puzzles(self.session)[0]

    def solve(self):
        for result, _, status in self.puzzle.get_state()['operations']:
            if status == 'N':
                self.puzzle.handle_message(['P1', '2', str(result - 2)])

    def error_and_restart(self, timeout=False):
        with patch('mqtt.puzzles.puzzle1.threading.Thread') as thread:
            if timeout:
                self.puzzle.timer_expired()
            else:
                self.puzzle.handle_message(['P1', '100', '100'])
            worker = thread.call_args.kwargs
            with patch('mqtt.puzzles.puzzle1.time.sleep'):
                worker['target'](*worker.get('args', ()))

    def test_clean_success_saves_one_hundred_points_and_closes_row(self):
        self.solve()
        self.assertTrue(self.puzzle.solved)
        self.assertEqual(self.puzzle.get_state()['total_points'], 100)
        self.assertEqual(self.saved()['total_points'], 100)
        self.assertIsNotNone(self.saved()['ended_at'])
        self.assertIsNone(self.client.active_puzzle_row_id)
        events = list(self.events.queue)
        final = [event for event in events if event.get('puzzle_solved')]
        self.assertEqual(len(final), 1)
        self.assertEqual(final[0]['total_points'], 100)
        self.assertTrue(any(call.args == ('FROM_FLASK', 'P1End')
                            for call in self.client.client.publish.call_args_list))

    def test_wrong_sum_and_timeout_each_deduct_three_points(self):
        self.error_and_restart()
        self.error_and_restart(timeout=True)
        self.assertEqual(self.puzzle.round_errors, 2)
        self.solve()
        self.assertEqual(self.saved()['total_points'], 94)

    def test_failure_alone_does_not_close_or_score_the_row(self):
        self.error_and_restart()
        self.assertIsNone(self.saved()['ended_at'])
        self.assertEqual(self.saved()['total_points'], 0)
        self.assertEqual(self.client.active_puzzle_row_id, self.row)

    def test_nonblocking_repetition_does_not_add_a_failed_attempt(self):
        self.puzzle.round_errors = 10
        result = self.puzzle.get_state()['operations'][0][0]
        self.puzzle.handle_message(['P1', '2', str(result - 2)])
        self.puzzle.handle_message(['P1', '2', str(result - 2)])
        self.assertEqual(self.puzzle.round_errors, 10)
        self.assertFalse(self.puzzle.processing_wrong_result)
        self.solve()
        self.assertEqual(self.saved()['total_points'], 70)

    def test_replayed_messages_cannot_change_the_saved_score(self):
        self.puzzle.round_errors = 3
        self.solve()
        self.puzzle.handle_message(['P1', '100', '100'])
        self.puzzle.timer_expired()
        self.client.push_update({'puzzle_id': 1, 'puzzle_solved': True, 'total_points': 100})
        self.assertEqual(self.saved()['total_points'], 91)
        self.assertEqual(self.puzzle.get_state()['total_points'], 91)

    def test_reset_clears_earned_points_and_error_count(self):
        self.puzzle.round_errors = 2
        self.solve()
        self.puzzle.reset()
        self.assertEqual(self.puzzle.get_state()['total_points'], 0)
        self.assertEqual(self.puzzle.round_errors, 0)
        self.assertFalse(self.puzzle.solved)
        self.assertEqual(self.saved()['total_points'], 94)

    def test_uses_shared_configuration_instead_of_local_constants(self):
        self.puzzle.round_errors = 2
        rules = {'max_points': 80, 'penalty_per_error': 7, 'max_attempts': 30}
        with patch.dict(SCORING_CONFIG, {'puzzle1': rules}):
            self.solve()
        self.assertEqual(self.saved()['total_points'], 66)

    def test_points_never_become_negative(self):
        self.puzzle.round_errors = 40
        self.solve()
        self.assertEqual(self.saved()['total_points'], 0)
        self.assertIsNotNone(self.saved()['ended_at'])


if __name__ == '__main__':
    unittest.main()