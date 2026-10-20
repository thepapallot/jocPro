"""Quiz scores through the real MQTT/SSE callback into temporary SQLite."""
import ast
import queue
import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from mqtt.client import MQTTClient
from mqtt.puzzles.puzzle3 import Puzzle3
from scoring_config import SCORING_CONFIG
from telemetry.schema import init_schema
from telemetry.writer import TelemetryWriter
from telemetry.queries import TelemetryQueries


ROOT = Path(__file__).resolve().parents[1]


class Puzzle3PointsIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        folder = Path(self.tmp.name)
        init_schema(folder)
        self.writer = TelemetryWriter(folder)
        self.queries = TelemetryQueries(folder)
        self.session = self.writer.record_session_start('Quiz test', '2026-10-20')
        self.row = self.writer.record_puzzle_start(self.session, 3, 1, 2)
        self.client = MQTTClient.__new__(MQTTClient)
        self.client.lock = threading.Lock()
        self.client.telemetry_writer = self.writer
        self.client.telemetry_queries = self.queries
        self.client.active_session_id = self.session
        self.client.active_puzzle_row_id = self.row
        self.client.active_puzzle_num = 3
        self.client.current_puzzle_id = 3
        self.client.client = SimpleNamespace(publish=Mock())
        self.events = queue.Queue()
        namespace = dict(mqtt_client=self.client, _sse_clients_lock=threading.Lock(),
                         _sse_clients=[self.events])
        node = next(node for node in ast.parse((ROOT / 'app.py').read_text()).body
                    if isinstance(node, ast.FunctionDef) and node.name == 'push_state_update')
        exec(compile(ast.Module(body=[node], type_ignores=[]), 'isolated-quiz-callback', 'exec'), namespace)
        self.client.update_callback = namespace['push_state_update']
        self.now = 1000.0
        self.clock_patch = patch('mqtt.puzzles.puzzle3.time.monotonic', side_effect=lambda: self.now)
        self.timer_patch = patch('mqtt.puzzles.puzzle3.threading.Timer')
        self.clock_patch.start()
        self.timer_mock = self.timer_patch.start()
        self.puzzle = Puzzle3(self.client)
        self.puzzle.reset()

    def tearDown(self):
        self.puzzle.stop()
        self.timer_patch.stop()
        self.clock_patch.stop()
        self.writer.shutdown(timeout=2)
        self.queries.close()
        self.tmp.cleanup()

    def saved(self):
        return self.queries.get_session_puzzles(self.session)[0]

    def answer(self, success=True):
        question = self.puzzle.chosen_questions[self.puzzle.current_question_idx]
        for player, value in enumerate(question['correct']):
            answer = self.puzzle._normalize_expected_answer(value)
            if not success and player == 0:
                answer = 1 if answer == 5 else 5
            self.puzzle.handle_message(['P3', str(player), str(answer)])

    def advance(self):
        # The most recently created timer is the result transition.
        self.timer_mock.call_args.args[1]()
        if self.puzzle.golden_announcement:
            self.now += self.puzzle.golden_announcement_seconds
            self.timer_mock.call_args.args[1]()

    def finish(self):
        if self.puzzle.question_result is not None:
            self.advance()
        self.now += 300
        self.puzzle.timer_expired()

    def test_only_timeout_closes_row_and_saves_accumulated_points(self):
        for success in (True, False, True):
            self.answer(success)
            self.assertIsNone(self.saved()['ended_at'])
            self.assertEqual(self.saved()['total_points'], 0)
            self.advance()
        self.finish()
        self.assertEqual(self.saved()['total_points'], 20)
        self.assertIsNotNone(self.saved()['ended_at'])
        self.assertIsNone(self.client.active_puzzle_row_id)
        finals = [event for event in self.events.queue if event.get('puzzle_solved')]
        self.assertEqual(len(finals), 1)
        self.assertEqual(finals[0]['total_points'], 20)
        self.assertTrue(any(call.args == ('FROM_FLASK', 'P3End')
                            for call in self.client.client.publish.call_args_list))

    def test_no_correct_answers_saves_zero_and_closes_row(self):
        self.answer(False)
        self.finish()
        self.assertEqual(self.saved()['total_points'], 0)
        self.assertIsNotNone(self.saved()['ended_at'])

    def test_seven_correct_answers_do_not_finish_before_timeout(self):
        for _ in range(7):
            self.answer()
            self.advance()
        self.assertIsNone(self.saved()['ended_at'])
        self.finish()
        self.assertEqual(self.saved()['total_points'], 80)

    def test_golden_correct_and_incorrect_questions_persist_mixed_points(self):
        for number in range(1, 13):
            self.answer(success=number != 12)
            self.advance()
        self.finish()
        self.assertEqual(self.saved()['total_points'], 120)

    def test_duplicate_completion_cannot_overwrite_saved_points(self):
        self.answer()
        self.finish()
        self.answer()
        self.puzzle.timer_expired()
        self.client.push_update({'puzzle_id': 3, 'puzzle_solved': True, 'total_points': 100})
        self.assertEqual(self.saved()['total_points'], 10)
        self.assertEqual(self.puzzle.get_state()['total_points'], 10)

    def test_scoring_reads_shared_configuration(self):
        with patch.dict(SCORING_CONFIG, {'puzzle3': {'points_per_correct': 15, 'penalty_per_error': 0}}):
            self.answer()
            self.advance()
            self.answer()
        self.finish()
        self.assertEqual(self.saved()['total_points'], 30)


if __name__ == '__main__':
    unittest.main()