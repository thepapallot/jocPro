"""Deterministic maze timing and persistence checks, without MQTT or hardware."""
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
from mqtt.puzzles.puzzle2 import Puzzle2
from scoring_config import SCORING_CONFIG
from telemetry.queries import TelemetryQueries
from telemetry.schema import init_schema
from telemetry.writer import TelemetryWriter
from test_puzzle4_scoring import ManualClock


ROOT = Path(__file__).resolve().parents[1]


class Puzzle2Runtime:
    def __init__(self, case, client=None):
        self.clock = ManualClock()
        case.enterContext(patch('mqtt.puzzles.puzzle2.time.monotonic',
                                side_effect=lambda: self.clock.now))
        case.enterContext(patch('mqtt.puzzles.puzzle2.threading.Timer',
                                side_effect=self.clock.timer))
        case.enterContext(patch('mqtt.puzzles.puzzle2.random.randint', return_value=20))
        case.enterContext(patch('builtins.print'))
        self.client = client or SimpleNamespace(
            current_puzzle_id=2, push_update=Mock(), send_message=Mock())
        self.puzzle = Puzzle2(self.client)
        case.addCleanup(self.puzzle.stop)
        self.puzzle.reset()
        self.origin = self.clock.now

    def at(self, elapsed):
        self.clock.advance(self.origin + elapsed - self.clock.now)

    def solve(self):
        # Respect whichever mapping is active at the instant of submission.
        for player, sequence in self.puzzle.sequences.items():
            for raw in sequence[self.puzzle.progress[player]:]:
                symbol = self.puzzle.alarmChanges[raw] if self.puzzle.alarm_mode else raw
                self.puzzle.handle_message(['P2', str(player), str(symbol)])


class Puzzle2ScoringTests(unittest.TestCase):
    def runtime(self):
        return Puzzle2Runtime(self)

    def terminal_events(self, runtime):
        return [call.args[0] for call in runtime.client.push_update.call_args_list
                if call.args[0].get('puzzle_solved') or call.args[0].get('puzzle_exhausted')]

    def test_all_time_band_boundaries_are_inclusive(self):
        for index, threshold in enumerate([180, 240, 300, 360, 420, 480]):
            for offset, expected in [(-0.001, 100 - 10 * index),
                                     (0, 90 - 10 * index),
                                     (0.001, 90 - 10 * index)]:
                with self.subTest(elapsed=threshold + offset):
                    runtime = self.runtime()
                    # Delay workers to test exact submission times, even during
                    # an alarm that would otherwise block input for five seconds.
                    runtime.clock.now = runtime.origin + threshold + offset
                    runtime.solve()
                    state = runtime.puzzle.get_state()
                    self.assertTrue(state['puzzle_solved'])
                    self.assertEqual(state['total_points'], expected)
                    self.assertEqual(len(self.terminal_events(runtime)), 1)

    def test_snapshot_and_updates_expose_only_available_points_until_finished(self):
        runtime = self.runtime()
        state = runtime.puzzle.get_state()
        self.assertEqual(state['available_points'], 100)
        self.assertEqual(state['time_remaining_seconds'], 600)
        self.assertEqual(state['elapsed_seconds'], 0)
        self.assertFalse(state['puzzle_exhausted'])
        self.assertNotIn('total_points', state)
        runtime.at(240)
        self.assertEqual(runtime.puzzle.get_state()['available_points'], 80)
        for call in runtime.client.push_update.call_args_list:
            self.assertNotIn('total_points', call.args[0])

    def test_state_exposes_score_bands_for_the_live_hud(self):
        state = self.runtime().puzzle.get_state()
        rules = SCORING_CONFIG['puzzle2']
        self.assertEqual(state['max_points'], rules['max_points'])
        self.assertEqual(state['penalty_per_time_band'], rules['penalty_per_time_band'])
        self.assertEqual(state['penalty_thresholds_seconds'], rules['penalty_thresholds_seconds'])
        self.assertEqual(state['max_time_seconds'], rules['max_time_seconds'])

    def test_errors_are_counted_without_reset_or_points_penalty(self):
        runtime = self.runtime()
        runtime.puzzle.handle_message(['P2', '1', '5'])
        for _ in range(20):
            runtime.puzzle.handle_message(['P2', '1', '1'])
        self.assertEqual(runtime.puzzle.error_counter, 20)
        self.assertEqual(runtime.puzzle.progress[1], 1)
        runtime.solve()
        self.assertEqual(runtime.puzzle.total_points, 100)

    def test_alarm_blocks_for_five_seconds_and_preserves_fixed_sequences(self):
        runtime = self.runtime()
        runtime.at(20)
        runtime.puzzle.handle_message(['P2', '1', '5'])
        self.assertEqual(runtime.puzzle.progress[1], 0)
        runtime.at(25)
        self.assertTrue(runtime.puzzle.alarm_mode)
        runtime.puzzle.handle_message(['P2', '1', '4'])
        self.assertEqual(runtime.puzzle.progress[1], 1)
        self.assertEqual(runtime.puzzle.get_state()['sequences'][1][0], 5)
        runtime.at(45)
        self.assertTrue(runtime.puzzle.input_blocked)
        runtime.at(50)
        self.assertFalse(runtime.puzzle.alarm_mode)
        self.assertFalse(runtime.puzzle.input_blocked)
        self.assertEqual(runtime.puzzle.get_state()['elapsed_seconds'], 50)

    def test_deadline_exhausts_without_input_and_ignores_later_workers(self):
        runtime = self.runtime()
        runtime.at(600)
        state = runtime.puzzle.get_state()
        self.assertTrue(state['puzzle_exhausted'])
        self.assertFalse(state['puzzle_solved'])
        self.assertEqual(state['total_points'], 0)
        self.assertEqual(state['elapsed_seconds'], 600)
        self.assertEqual(state['time_remaining_seconds'], 0)
        count = runtime.client.push_update.call_count
        runtime.solve()
        runtime.puzzle.complete_by_gm()
        for timer in list(runtime.clock.timers):
            timer.function()
        self.assertEqual(runtime.client.push_update.call_count, count)
        self.assertEqual(len(self.terminal_events(runtime)), 1)
        runtime.client.send_message.assert_called_once_with('FROM_FLASK', 'P2End')
        self.assertTrue(all(timer.cancelled or timer.fired for timer in runtime.clock.timers))

    def test_submission_at_deadline_is_rejected_even_when_timer_is_delayed(self):
        for elapsed in [600, 600.001, 700]:
            with self.subTest(elapsed=elapsed):
                runtime = self.runtime()
                runtime.clock.now = runtime.origin + elapsed
                runtime.solve()
                self.assertTrue(runtime.puzzle.exhausted)
                self.assertEqual(runtime.puzzle.total_points, 0)
                self.assertTrue(all(value == 0 for value in runtime.puzzle.progress.values()))
                self.assertEqual(runtime.puzzle.get_state()['elapsed_seconds'], 600)

    def test_success_just_before_deadline_is_frozen_and_sent_once(self):
        runtime = self.runtime()
        runtime.clock.now = runtime.origin + 599.999
        runtime.solve()
        runtime.at(900)
        runtime.solve()
        runtime.puzzle.complete_by_gm()
        state = runtime.puzzle.get_state()
        self.assertEqual(state['total_points'], 40)
        self.assertAlmostEqual(state['elapsed_seconds'], 599.999)
        self.assertTrue(state['puzzle_solved'])
        self.assertFalse(state['puzzle_exhausted'])
        self.assertEqual(len(self.terminal_events(runtime)), 1)
        runtime.client.send_message.assert_called_once_with('FROM_FLASK', 'P2End')

    def test_last_progress_push_cannot_change_accepted_score_or_cross_deadline(self):
        for elapsed, expected in [(179.999, 100), (599.999, 40)]:
            with self.subTest(elapsed=elapsed):
                runtime = self.runtime()
                runtime.puzzle.progress = {player: 5 for player in runtime.puzzle.sequences}
                runtime.puzzle.progress[10] = 4
                runtime.clock.now = runtime.origin + elapsed

                def slow_push(payload):
                    if 'player_update' in payload:
                        runtime.clock.now += 2

                runtime.client.push_update.side_effect = slow_push
                runtime.puzzle.handle_message(['P2', '10', '5'])
                self.assertEqual(runtime.puzzle.total_points, expected)
                self.assertAlmostEqual(runtime.puzzle.get_state()['elapsed_seconds'], elapsed)
                self.assertTrue(runtime.puzzle.solved)

    def test_stop_and_reset_invalidate_alarm_and_transition_callbacks(self):
        for elapsed in [0, 20, 25, 45]:
            for operation in ['stop', 'reset']:
                with self.subTest(elapsed=elapsed, operation=operation):
                    runtime = self.runtime()
                    runtime.at(elapsed)
                    old_timers = list(runtime.clock.timers)
                    getattr(runtime.puzzle, operation)()
                    count = runtime.client.push_update.call_count
                    for timer in old_timers:
                        timer.function()
                    self.assertEqual(runtime.client.push_update.call_count, count)
                    self.assertTrue(all(timer.cancelled for timer in old_timers if not timer.fired))
                    if operation == 'reset':
                        state = runtime.puzzle.get_state()
                        self.assertEqual(state['elapsed_seconds'], 0)
                        self.assertEqual(state['available_points'], 100)
                    else:
                        runtime.solve()
                        self.assertEqual(runtime.client.push_update.call_count, count)

    def test_reset_after_exhaustion_starts_a_fresh_budget(self):
        runtime = self.runtime()
        runtime.at(600)
        runtime.puzzle.reset()
        state = runtime.puzzle.get_state()
        self.assertFalse(state['puzzle_exhausted'])
        self.assertNotIn('total_points', state)
        self.assertEqual(state['time_remaining_seconds'], 600)
        self.assertEqual(state['error_counter'], 0)
        runtime.solve()
        self.assertEqual(runtime.puzzle.total_points, 100)

    def test_early_deadline_callback_rearms_until_real_deadline(self):
        runtime = self.runtime()
        deadline = runtime.clock.timers[0]
        runtime.at(100)
        deadline.fired = True
        deadline.function()
        self.assertFalse(runtime.puzzle.exhausted)
        runtime.at(600)
        self.assertTrue(runtime.puzzle.exhausted)

    def test_maximum_time_comes_from_configuration_and_must_be_positive_finite(self):
        for invalid in [None, True, 0, -1, float('inf'), float('nan')]:
            with self.subTest(invalid=invalid):
                with patch.dict(SCORING_CONFIG['puzzle2'], max_time_seconds=invalid):
                    with self.assertRaises(ValueError):
                        Puzzle2(Mock())
        with patch.dict(SCORING_CONFIG['puzzle2'], max_time_seconds=60):
            runtime = self.runtime()
            runtime.at(60)
            self.assertTrue(runtime.puzzle.exhausted)


class Puzzle2PointsIntegrationTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        folder = Path(tmp.name)
        init_schema(folder)
        self.writer = TelemetryWriter(folder)
        self.addCleanup(self.writer.shutdown, timeout=2)
        self.queries = TelemetryQueries(folder)
        self.addCleanup(self.queries.close)
        self.session = self.writer.record_session_start('Maze test', '2026-10-27')
        self.row = self.writer.record_puzzle_start(self.session, 2, 1, 1)
        self.client = MQTTClient.__new__(MQTTClient)
        self.client.lock = threading.Lock()
        self.client.telemetry_writer = self.writer
        self.client.active_puzzle_row_id = self.row
        self.client.active_puzzle_num = 2
        self.client.current_puzzle_id = 2
        self.client.client = SimpleNamespace(publish=Mock())
        self.events = queue.Queue()
        app = Flask('isolated-maze-scoring')
        namespace = dict(app=app, mqtt_client=self.client, request=request, jsonify=jsonify,
                         _sse_clients_lock=threading.Lock(), _sse_clients=[self.events])
        nodes = [node for node in ast.parse((ROOT / 'app.py').read_text()).body
                 if isinstance(node, ast.FunctionDef)
                 and node.name in {'push_state_update', 'test_force_end'}]
        exec(compile(ast.Module(body=nodes, type_ignores=[]),
                     'isolated-maze-callback', 'exec'), namespace)
        self.client.update_callback = namespace['push_state_update']
        self.runtime = Puzzle2Runtime(self, self.client)
        self.client.puzzles = {2: self.runtime.puzzle}
        self.http = app.test_client()

    def saved(self):
        return self.queries.get_session_puzzles(self.session)[0]

    def test_success_persists_time_points_and_closes_row_once(self):
        self.runtime.clock.now = self.runtime.origin + 300
        self.runtime.solve()
        self.assertEqual(self.saved()['total_points'], 70)
        self.assertIsNotNone(self.saved()['ended_at'])
        self.assertIsNone(self.client.active_puzzle_row_id)
        self.runtime.puzzle.complete_by_gm()
        self.assertEqual(self.saved()['total_points'], 70)
        self.client.client.publish.assert_any_call('FROM_FLASK', 'P2End')

    def test_timeout_closes_row_with_zero_and_emits_exhausted_not_success(self):
        self.runtime.at(600)
        self.assertEqual(self.saved()['total_points'], 0)
        self.assertIsNotNone(self.saved()['ended_at'])
        terminal = [event for event in self.events.queue if event.get('puzzle_exhausted')]
        self.assertEqual(len(terminal), 1)
        self.assertFalse(terminal[0]['puzzle_solved'])
        self.assertEqual(terminal[0]['total_points'], 0)

    def test_gm_completion_uses_same_score_and_cancels_pending_alarm(self):
        self.runtime.at(240)
        for _ in range(2):
            response = self.http.post('/test/force_end', json={'puzzle_id': 2})
            self.assertEqual(response.status_code, 200)
        self.assertEqual(self.saved()['total_points'], 80)
        self.assertIsNotNone(self.saved()['ended_at'])
        terminal = [event for event in self.events.queue if event.get('puzzle_solved')]
        self.assertEqual(len(terminal), 1)
        self.assertTrue(terminal[0]['forced_by_gm'])
        self.assertTrue(all(timer.cancelled or timer.fired for timer in self.runtime.clock.timers))

    def test_gm_completion_after_deadline_cannot_award_success(self):
        self.runtime.clock.now = self.runtime.origin + 600
        response = self.http.post('/test/force_end', json={'puzzle_id': 2})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(self.runtime.puzzle.exhausted)
        self.assertFalse(self.runtime.puzzle.solved)
        self.assertEqual(self.saved()['total_points'], 0)
        self.assertIsNotNone(self.saved()['ended_at'])


if __name__ == '__main__':
    unittest.main()
