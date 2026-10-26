"""Real completion callback and temporary SQLite; never start app.py or MQTT."""
import ast
import queue
import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from mqtt.client import MQTTClient
from telemetry.schema import init_schema
from telemetry.writer import TelemetryWriter
from telemetry.queries import TelemetryQueries
from test_puzzle4_scoring import Puzzle4Runtime


ROOT = Path(__file__).resolve().parents[1]


class Puzzle4PointsIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        folder = Path(self.tmp.name)
        init_schema(folder)
        self.writer = TelemetryWriter(folder)
        self.queries = TelemetryQueries(folder)
        self.session = self.writer.record_session_start('Test', '2026-10-26')
        self.row = self.writer.record_puzzle_start(self.session, 4, 1, 1)
        self.client = MQTTClient.__new__(MQTTClient)
        self.client.lock = threading.Lock()
        self.client.telemetry_writer = self.writer
        self.client.active_puzzle_row_id = self.row
        self.client.active_puzzle_num = 4
        self.client.current_puzzle_id = 4
        self.client.active_session_id = self.session
        self.client.puzzle_order = [4]
        self.client.tutorial_puzzle_id = 11
        self.client.final_puzzle_id = 6
        self.client.client = SimpleNamespace(publish=Mock())
        self.client.app = SimpleNamespace(static_folder='/nonexistent-puzzle4-test-audio')
        self.events = queue.Queue()
        namespace = dict(mqtt_client=self.client, _sse_clients_lock=threading.Lock(),
                         _sse_clients=[self.events])
        node = next(node for node in ast.parse((ROOT / 'app.py').read_text()).body
                    if isinstance(node, ast.FunctionDef) and node.name == 'push_state_update')
        exec(compile(ast.Module(body=[node], type_ignores=[]),
                     'isolated-score-callback', 'exec'), namespace)
        self.client.update_callback = namespace['push_state_update']
        self.runtime = Puzzle4Runtime(self, client=self.client)
        self.puzzle = self.runtime.puzzle

    def tearDown(self):
        self.puzzle.stop()
        self.writer.shutdown(timeout=2)
        self.queries.close()
        self.tmp.cleanup()

    def saved(self):
        return self.queries.get_session_puzzles(self.session)[0]

    def test_first_success_saves_one_hundred_via_real_callback(self):
        self.runtime.at(100)
        self.runtime.submit()
        self.runtime.clock.advance(2)
        self.assertTrue(self.puzzle.solved)
        self.assertEqual(self.saved()['total_points'], 100)
        self.assertIsNotNone(self.saved()['ended_at'])
        self.assertIsNone(self.client.active_puzzle_row_id)

    def test_two_rounds_save_score_for_total_time(self):
        self.puzzle.set_second_round_enabled(True)
        self.runtime.at(100)
        self.runtime.submit()
        self.runtime.at(200)
        rows = self.queries.get_session_puzzles(self.session)
        self.assertEqual(len(rows), 2)
        self.assertIsNotNone(rows[0]['ended_at'])
        self.assertIsNone(rows[1]['ended_at'])
        self.runtime.at(300)
        self.runtime.submit()
        self.runtime.clock.advance(2)
        rows = self.queries.get_session_puzzles(self.session)
        self.assertEqual([row['total_points'] for row in rows], [0, 70])
        self.assertTrue(all(row['ended_at'] for row in rows))

    def test_two_rounds_exhaustion_does_not_award_points_for_first_round(self):
        self.puzzle.set_second_round_enabled(True)
        self.runtime.at(100)
        self.runtime.submit()
        self.runtime.at(600)
        rows = self.queries.get_session_puzzles(self.session)
        self.assertEqual(len(rows), 2)
        self.assertEqual([row['total_points'] for row in rows], [0, 0])
        self.assertTrue(all(row['ended_at'] for row in rows))

    def test_late_final_audio_saves_submission_points_only_after_success(self):
        self.runtime.at(599)
        self.runtime.audio.return_value = 20
        self.runtime.submit()
        self.runtime.at(601)
        self.assertIsNone(self.saved()['ended_at'])
        self.assertEqual(self.client.active_puzzle_row_id, self.row)
        self.runtime.at(621)
        self.assertEqual(self.saved()['total_points'], 40)
        self.assertIsNotNone(self.saved()['ended_at'])

    def test_exhaustion_closes_row_with_zero_and_without_solved_event(self):
        self.runtime.at(600)
        self.assertEqual(self.saved()['total_points'], 0)
        self.assertIsNotNone(self.saved()['ended_at'])
        events = list(self.events.queue)
        self.assertTrue(any(event.get('puzzle_exhausted') for event in events))
        self.assertFalse(any(event.get('puzzle_solved') for event in events))
        self.client.client.publish.assert_any_call('FROM_FLASK', 'P4End')

    def test_failure_feedback_and_snapshots_do_not_end_or_award_points(self):
        self.runtime.at(240)
        self.runtime.submit(correct=False)
        self.runtime.clock.advance(3)
        state = self.puzzle.get_state()
        self.client.push_update(state)
        self.assertNotIn('total_points', state)
        self.assertEqual(state['available_points'], 80)
        self.assertEqual(self.saved()['total_points'], 0)
        self.assertIsNone(self.saved()['ended_at'])
        self.assertEqual(self.client.active_puzzle_row_id, self.row)

    def test_duplicate_callbacks_and_late_workers_persist_exactly_once(self):
        with patch.object(self.writer, 'end_puzzle', wraps=self.writer.end_puzzle) as end:
            self.runtime.at(240)
            self.runtime.submit()
            self.runtime.clock.advance(2)
            for timer in list(self.runtime.clock.timers):
                timer.function()
            self.puzzle._handle_validation(True)
            self.puzzle.timer_expired()
            self.runtime.submit()
            self.client.push_update({'puzzle_id': 4, 'puzzle_solved': True, 'total_points': 0})
            self.client.push_update(self.puzzle.get_state())
            end.assert_called_once_with(self.row, total_points=80)
        self.assertEqual(self.saved()['total_points'], 80)

    def test_duplicate_exhaustion_persists_zero_once(self):
        with patch.object(self.writer, 'end_puzzle', wraps=self.writer.end_puzzle) as end:
            self.runtime.at(600)
            self.runtime.submit()
            self.puzzle.timer_expired()
            self.client.push_update(self.puzzle.get_state())
            end.assert_called_once_with(self.row, total_points=0)

    def test_stop_invalidates_pending_success_without_closing_row(self):
        self.runtime.at(240)
        self.runtime.audio.return_value = 20
        self.runtime.submit()
        self.puzzle.stop()
        for timer in list(self.runtime.clock.timers):
            timer.function()
        self.runtime.at(700)
        self.assertIsNone(self.saved()['ended_at'])
        self.assertEqual(self.saved()['total_points'], 0)

    def test_event_from_different_puzzle_cannot_score_active_row(self):
        self.client.push_update({'puzzle_id': 8, 'puzzle_solved': True, 'total_points': 100})
        self.assertIsNone(self.saved()['ended_at'])


if __name__ == '__main__':
    unittest.main()