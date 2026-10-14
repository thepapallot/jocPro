import json
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from mqtt.puzzles.puzzle5 import Puzzle5
from scoring_config import SCORING_CONFIG


class FakeTimer:
    """No sleeping/threads; force even cancelled callbacks to model races."""
    instances = []

    def __init__(self, delay, callback):
        self.delay = delay
        self.callback = callback
        self.cancelled = False
        self.started = False
        self.daemon = False
        self.instances.append(self)

    def start(self):
        self.started = True

    def cancel(self):
        self.cancelled = True

    def fire(self):
        self.callback()


class Puzzle5ScoringTest(unittest.TestCase):
    def setUp(self):
        FakeTimer.instances = []
        self.enterContext(patch('mqtt.puzzles.puzzle5.threading.Timer', FakeTimer))
        self.thread = self.enterContext(patch('mqtt.puzzles.puzzle5.threading.Thread'))
        self.sleep = self.enterContext(patch('mqtt.puzzles.puzzle5.time.sleep'))
        self.clock = self.enterContext(patch('mqtt.puzzles.puzzle5.time.time', return_value=1000))
        self.client = SimpleNamespace(
            push_update=Mock(), send_message=Mock(), start_next_round=Mock(),
        )
        self.puzzle = Puzzle5(self.client)
        self.puzzle.reset()

    def tearDown(self):
        # Check the complete contract on every event, including terminal phases.
        for call in self.client.push_update.call_args_list:
            data = call.args[0]
            for key in ('attempt', 'max_attempts', 'available_points', 'total_points',
                        'puzzle_exhausted', 'auto_advance', 'limit', 'objective'):
                self.assertIn(key, data)
            json.dumps(data, allow_nan=False)
        self.thread.assert_not_called()
        self.sleep.assert_not_called()

    def fire(self, delay):
        timer = self.puzzle._round_start_timer
        self.assertIsNotNone(timer)
        self.assertEqual(timer.delay, delay)
        self.assertTrue(timer.started)
        self.assertTrue(timer.daemon)
        timer.fire()
        return timer

    def start(self):
        self.fire(5)

    def submit(self, player, error):
        self.puzzle.handle_message(['P5', str(player), str(error)])

    def fill(self, total):
        # One nonzero signed error avoids floating-point boundary ambiguity.
        for player in range(10):
            self.submit(player, -total if player == 0 else 0)

    def result(self, total):
        self.fill(total)
        self.fire(2)
        return self.puzzle.get_state()['round_result']

    def retry(self):
        self.fire(5)
        self.fire(9)

    def test_initial_countdown_snapshot_and_every_push_include_scoring(self):
        state = self.puzzle.get_state()
        self.assertEqual(state['round'], 0)
        self.assertEqual(state['objective'], 30)
        self.assertEqual(state['limit'], 10)
        self.assertEqual(state['attempt'], 1)
        self.assertEqual(state['max_attempts'], 10)
        self.assertEqual(state['available_points'], 100)
        self.assertEqual(state['total_points'], 0)
        self.assertTrue(state['waiting'])
        self.assertFalse(state['active_round'])
        self.assertEqual(state['countdown_deadline'], 1005)
        self.assertEqual(state['waiting_seconds'], 5)
        self.assertIn('countdown_message', state)
        self.clock.return_value = 1003.2
        self.assertEqual(self.puzzle.get_state()['waiting_seconds'], 2)
        self.submit(0, 0)
        self.client.send_message.assert_not_called()
        self.start()
        self.submit(0, -1)
        for call in self.client.push_update.call_args_list:
            data = call.args[0]
            for key in ('attempt', 'max_attempts', 'available_points', 'total_points',
                        'puzzle_exhausted', 'auto_advance', 'limit', 'objective'):
                self.assertIn(key, data)
            json.dumps(data, allow_nan=False)

    def test_all_ten_attempts_points_margins_and_retry_only_increments_on_start(self):
        self.start()
        for attempt in range(1, 11):
            state = self.puzzle.get_state()
            self.assertEqual(state['attempt'], attempt)
            self.assertEqual(state['round'], 1)
            self.assertEqual(state['total_rounds'], 1)
            self.assertEqual(state['limit'], 10 + 4 * (attempt - 1))
            self.assertEqual(state['available_points'], 110 - 10 * attempt)
            self.assertEqual(state['total_points'], 0)
            result = self.result(state['limit'] + 1 if attempt < 10 else state['limit'])
            self.assertEqual(result['success'], attempt == 10)
            self.assertFalse(self.puzzle.solved)
            self.fire(5)
            if attempt < 10:
                pending = self.puzzle.get_state()
                self.assertEqual(pending['attempt'], attempt)
                self.assertEqual(pending['available_points'], 110 - 10 * attempt)
                self.assertEqual(pending['limit'], 10 + 4 * attempt)
                self.assertEqual(pending['objective'], 30)
                self.assertEqual(pending['waiting_seconds'], 9)
                self.assertEqual(pending['countdown_deadline'], 1009)
                self.assertNotIn('round_result', pending)
                self.assertEqual(pending['times'], [])
                for _ in range(3):
                    self.puzzle.get_state()
                    self.submit(0, 0)
                self.assertEqual(self.puzzle.attempt, attempt)
                self.fire(9)
        self.assertTrue(self.puzzle.solved)
        self.assertEqual(self.puzzle.total_points, 10)
        self.assertFalse(self.puzzle.exhausted)
        self.assertIsNone(self.puzzle._round_start_timer)
        self.assertEqual(self.client.send_message.call_count, 11)
        self.client.send_message.assert_called_with('FROM_FLASK', 'P5_End')
        self.client.start_next_round.assert_not_called()

    def test_first_success_awards_one_hundred_after_result_display_not_before(self):
        self.start()
        self.assertTrue(self.result(10)['success'])
        state = self.puzzle.get_state()
        self.assertEqual(state['total_points'], 0)
        self.assertFalse(state['puzzle_solved'])
        self.assertEqual(len(state['times']), 10)
        self.assertEqual(state['round_result'], {'success': True, 'total': 10, 'limit': 10})
        self.fire(5)
        state = self.puzzle.get_state()
        self.assertEqual(state['total_points'], 100)
        self.assertTrue(state['puzzle_solved'])
        self.assertTrue(state['round_result']['success'])
        self.assertEqual(len(state['times']), 10)
        self.assertEqual(self.client.push_update.call_args.args[0]['total_points'], 100)
        self.client.send_message.assert_called_with('FROM_FLASK', 'P5_End')

    def test_second_success_awards_ninety_and_above_boundary_fails(self):
        self.start()
        self.assertFalse(self.result(10.000001)['success'])
        self.retry()
        self.assertTrue(self.result(14)['success'])
        self.fire(5)
        self.assertEqual(self.puzzle.total_points, 90)

    def test_total_is_sum_of_absolute_errors(self):
        self.start()
        self.submit(0, -6)
        self.submit(1, 6)
        for player in range(2, 10):
            self.submit(player, 0)
        self.fire(2)
        self.assertEqual(self.puzzle.get_state()['round_result'],
                         {'success': False, 'total': 12, 'limit': 10})

    def test_tenth_failure_result_then_exhausted_five_seconds_then_advance(self):
        self.start()
        for attempt in range(1, 11):
            self.assertFalse(self.result(100)['success'])
            self.assertFalse(self.puzzle.exhausted)
            self.fire(5)
            if attempt < 10:
                self.fire(9)
        state = self.puzzle.get_state()
        self.assertEqual(state['attempt'], 10)
        self.assertTrue(state['puzzle_exhausted'])
        self.assertFalse(state['auto_advance'])
        self.assertFalse(state['puzzle_solved'])
        self.assertFalse(state['waiting'])
        self.assertFalse(state['active_round'])
        self.assertEqual(state['available_points'], 0)
        self.assertEqual(state['total_points'], 0)
        self.assertEqual(state['round_result']['limit'], 46)
        self.assertEqual(len(state['times']), 10)
        count = self.client.push_update.call_count
        self.submit(0, 0)
        self.puzzle.get_state()
        self.assertEqual(self.client.push_update.call_count, count)
        timer = self.fire(5)
        self.assertTrue(self.puzzle.get_state()['auto_advance'])
        timer.fire()
        self.assertEqual(self.client.push_update.call_count, count + 1)
        self.assertIsNone(self.puzzle._round_start_timer)
        self.assertEqual(self.puzzle.attempt, 10)
        self.assertEqual(self.client.send_message.call_count, 11)
        self.assertEqual(sum(call.args == ('FROM_FLASK', 'P5_End')
                             for call in self.client.send_message.call_args_list), 1)
        self.assertFalse(any(call.args[0]['puzzle_solved']
                             for call in self.client.push_update.call_args_list))

    def test_duplicates_invalid_players_nonfinite_and_malformed_are_ignored(self):
        self.start()
        self.submit(0, -2)
        count = self.client.push_update.call_count
        for parts in ([], ['P5'], ['P5', '0'], ['P5', '0', '0', 'extra'],
                      ['P8', '1', '0'], ['P5', 'one', '0'], ['P5', '1.5', '0'],
                      ['P5', '1', None], ['P5', None, '0']):
            self.puzzle.handle_message(parts)
        for player, error in ((0, 9), (-1, 0), (10, 0), (9999, 0),
                              (1, 'nan'), (1, 'inf'), (1, '-inf'), (1, 'invalid')):
            self.submit(player, error)
        self.assertEqual(self.client.push_update.call_count, count)
        self.assertEqual(self.puzzle.get_state()['times'], [{'player': 0, 'time': -2}])
        self.assertEqual(len(FakeTimer.instances), 1)

    def test_aggregate_overflow_cannot_publish_nonfinite_json(self):
        self.start()
        self.submit(0, 1e308)
        count = self.client.push_update.call_count
        self.submit(1, 1e308)
        self.assertEqual(self.client.push_update.call_count, count)
        json.dumps(self.puzzle.get_state(), allow_nan=False)

    def test_single_evaluation_and_one_shot_callbacks_no_extra_submissions(self):
        self.start()
        self.fill(0)
        self.assertFalse(self.puzzle.active_round)
        self.assertEqual(len(FakeTimer.instances), 2)
        count = self.client.push_update.call_count
        for player in range(12):
            self.submit(player, 0)
        with self.puzzle.lock:
            self.puzzle._evaluate_round_locked()
        self.assertEqual(self.client.push_update.call_count, count)
        self.assertEqual(len(FakeTimer.instances), 2)
        evaluation = self.fire(2)
        count = self.client.push_update.call_count
        evaluation.fire()
        self.assertEqual(self.client.push_update.call_count, count)
        completion = self.fire(5)
        count = self.client.push_update.call_count
        completion.fire()
        self.assertEqual(self.client.push_update.call_count, count)
        self.thread.assert_not_called()
        self.sleep.assert_not_called()

    def test_old_evaluation_cannot_modify_an_already_active_restarted_run(self):
        self.start()
        self.fill(0)
        old_evaluation = self.puzzle._round_start_timer
        self.puzzle.reset()
        self.start()
        self.submit(0, -3)
        before = self.puzzle.get_state()
        self.client.push_update.reset_mock()
        self.client.send_message.reset_mock()
        old_evaluation.fire()
        self.assertEqual(self.puzzle.get_state(), before)
        self.client.push_update.assert_not_called()
        self.client.send_message.assert_not_called()

    def test_retry_start_is_one_shot_and_completed_snapshot_is_independent(self):
        self.start()
        self.result(11)
        self.fire(5)
        retry_timer = self.fire(9)
        count = self.client.push_update.call_count
        retry_timer.fire()
        self.assertEqual(self.puzzle.attempt, 2)
        self.assertEqual(self.client.push_update.call_count, count)
        self.result(14)
        self.fire(5)
        state = self.puzzle.get_state()
        state['times'][0]['time'] = 999
        state['round_result']['success'] = False
        self.assertTrue(self.puzzle.get_state()['round_result']['success'])
        self.assertEqual(self.puzzle.get_state()['times'][0]['time'], -14)
        count = self.client.push_update.call_count
        self.submit(0, 0)
        with self.puzzle.lock:
            self.puzzle._start_round_locked(1)
        self.assertEqual(self.client.push_update.call_count, count)
        self.assertEqual(self.puzzle.total_points, 90)

    def advance_to_phase(self, phase):
        if phase == 'initial':
            return
        self.start()
        self.fill(100 if phase in ('retry', 'exhausted') else 0)
        if phase == 'evaluation':
            return
        self.fire(2)
        if phase == 'result':
            return
        self.fire(5)
        if phase == 'retry':
            return
        for _ in range(9):
            self.fire(9)
            self.result(100)
            self.fire(5)

    def test_stop_and_reset_invalidate_all_pending_phases_even_forced_callbacks(self):
        for phase in ('initial', 'evaluation', 'result', 'retry', 'exhausted'):
            for action in ('stop', 'reset'):
                with self.subTest(phase=phase, action=action):
                    self.puzzle.reset()
                    self.advance_to_phase(phase)
                    old_timer = self.puzzle._round_start_timer
                    old_timers = list(FakeTimer.instances)
                    getattr(self.puzzle, action)()
                    self.assertTrue(old_timer.cancelled)
                    self.client.push_update.reset_mock()
                    self.client.send_message.reset_mock()
                    before = self.puzzle.get_state()
                    for timer in old_timers:
                        timer.fire()
                    self.submit(0, 0)
                    self.assertEqual(self.puzzle.get_state(), before)
                    self.client.push_update.assert_not_called()
                    self.client.send_message.assert_not_called()
                    if action == 'reset':
                        self.assertEqual(before['attempt'], 1)
                        self.assertEqual(before['total_points'], 0)
                        self.assertEqual(before['available_points'], 100)
                        self.assertFalse(before['puzzle_exhausted'])
                        self.assertFalse(before['auto_advance'])
                        self.start()
                        self.client.send_message.assert_called_once_with('FROM_FLASK', 'P5_Round2')

    def test_configuration_controls_scores_and_attempt_cap_without_local_formula(self):
        rules = {'max_points': 77, 'penalty_per_error': 13, 'max_attempts': 2}
        with patch.dict(SCORING_CONFIG, {'puzzle5': rules}):
            self.puzzle.reset()
            self.start()
            self.assertEqual(self.puzzle.get_state()['available_points'], 77)
            self.assertEqual(self.puzzle.max_attempts, 2)
            self.result(100)
            self.retry()
            self.assertEqual(self.puzzle.get_state()['available_points'], 64)
            self.result(14)
            self.fire(5)
            self.assertEqual(self.puzzle.total_points, 64)
            self.puzzle.reset()
            self.start()
            self.result(100)
            self.retry()
            self.result(100)
            self.fire(5)
            self.assertTrue(self.puzzle.exhausted)
            self.assertEqual(self.puzzle.attempt, 2)
            self.assertEqual(self.puzzle.total_points, 0)

    def test_round_success_preserves_next_round_semantics(self):
        self.puzzle.round_objectives[2] = 40
        self.puzzle.round_limits[2] = 12
        self.puzzle.total_rounds = 2
        self.start()
        self.result(10)
        self.fire(5)
        self.client.start_next_round.assert_called_once_with(5, 2)
        state = self.puzzle.get_state()
        self.assertEqual(state['objective'], 40)
        self.assertEqual(state['limit'], 12)
        self.assertFalse(state['puzzle_solved'])
        self.fire(5)
        self.assertEqual(self.puzzle.current_round, 2)
        self.assertEqual(self.puzzle.attempt, 1)
        self.result(12)
        self.fire(5)
        self.assertTrue(self.puzzle.solved)


if __name__ == '__main__':
    unittest.main()