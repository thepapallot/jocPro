"""Deterministic Puzzle4 timing tests; no app, broker, audio or real workers."""
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from mqtt.puzzles.puzzle4 import Puzzle4
from scoring_config import SCORING_CONFIG


class ManualClock:
    """Timer queue that can also replay canceled callbacks to simulate races."""

    def __init__(self):
        self.now = 1000.0
        self.timers = []

    def timer(self, delay, callback):
        clock = self

        class Timer:
            def __init__(self):
                self.due = clock.now + delay
                self.function = callback
                self.cancelled = False
                self.fired = False
                self.daemon = False

            def start(self):
                clock.timers.append(self)

            def cancel(self):
                self.cancelled = True

        return Timer()

    def advance(self, seconds):
        target = self.now + seconds
        while True:
            pending = [timer for timer in self.timers
                       if not timer.cancelled and not timer.fired and timer.due <= target]
            if not pending:
                break
            timer = min(pending, key=lambda item: item.due)
            self.now = max(self.now, timer.due)
            timer.fired = True
            timer.function()
        self.now = target


class Puzzle4Runtime:
    def __init__(self, case, client=None, two_rounds=False):
        self.clock = ManualClock()
        case.enterContext(patch('mqtt.puzzles.puzzle4.time.monotonic',
                                side_effect=lambda: self.clock.now))
        case.enterContext(patch('mqtt.puzzles.puzzle4.threading.Timer',
                                side_effect=self.clock.timer))
        case.enterContext(patch('builtins.print'))
        self.client = client or SimpleNamespace(
            app=SimpleNamespace(static_folder='/nonexistent-puzzle4-test-audio'),
            push_update=Mock(), send_message=Mock(), start_next_round=Mock())
        self.puzzle = Puzzle4(self.client)
        case.addCleanup(self.puzzle.stop)
        self.audio = case.enterContext(patch.object(self.puzzle, '_get_audio_duration', return_value=0))
        self.puzzle.set_second_round_enabled(two_rounds)
        self.puzzle.reset()
        self.origin = self.clock.now

    def at(self, elapsed):
        self.clock.advance(self.origin + elapsed - self.clock.now)

    def submit(self, correct=True):
        order = self.puzzle._get_current_required_order().copy()
        if not correct:
            order[-1] = '0' if order[-1] != '0' else '1'
        for song in order:
            self.puzzle.handle_message(['P4', '3'])
            self.puzzle.handle_message(['P4', '0', song])


class Puzzle4ScoringTests(unittest.TestCase):
    def runtime(self, **kwargs):
        return Puzzle4Runtime(self, **kwargs)

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
                    runtime.at(threshold + offset)
                    runtime.submit()
                    runtime.clock.advance(2)
                    self.assertEqual(runtime.puzzle.get_state()['total_points'], expected)
                    self.assertEqual(len(self.terminal_events(runtime)), 1)

    def test_snapshot_exposes_budget_but_not_unearned_points(self):
        runtime = self.runtime()
        state = runtime.puzzle.get_state()
        self.assertEqual(state['available_points'], 100)
        self.assertEqual(state['elapsed_seconds'], 0)
        self.assertEqual(state['time_remaining_seconds'], 600)
        self.assertFalse(state['puzzle_exhausted'])
        self.assertNotIn('total_points', state)
        runtime.at(240)
        self.assertEqual(runtime.puzzle.get_state()['available_points'], 80)
        for call in runtime.client.push_update.call_args_list:
            self.assertNotIn('total_points', call.args[0])

    def test_same_total_elapsed_scores_equally_in_one_and_two_rounds(self):
        for two_rounds in [False, True]:
            with self.subTest(two_rounds=two_rounds):
                runtime = self.runtime(two_rounds=two_rounds)
                if two_rounds:
                    runtime.at(100)
                    runtime.submit()
                    runtime.at(200)
                    self.assertEqual(runtime.puzzle.streak, 1)
                    self.assertEqual(runtime.puzzle.get_state()['elapsed_seconds'], 200)
                    runtime.client.start_next_round.assert_called_once_with(4, 2)
                    self.assertFalse(runtime.puzzle.playing_sample)
                runtime.at(300)
                runtime.submit()
                runtime.clock.advance(2)
                state = runtime.puzzle.get_state()
                self.assertTrue(state['puzzle_solved'])
                self.assertEqual(state['total_points'], 70)
                self.assertEqual(state['elapsed_seconds'], 300)

    def test_last_track_and_celebration_do_not_cross_a_scoring_band(self):
        runtime = self.runtime()
        runtime.at(179)
        runtime.audio.return_value = 20
        runtime.submit()
        runtime.at(201)
        state = runtime.puzzle.get_state()
        self.assertEqual(state['total_points'], 100)
        self.assertEqual(state['elapsed_seconds'], 179)
        self.assertEqual(state['time_remaining_seconds'], 421)

    def test_celebration_alone_does_not_cross_a_scoring_band(self):
        runtime = self.runtime()
        runtime.at(179)
        runtime.submit()
        runtime.at(181)
        self.assertEqual(runtime.puzzle.total_points, 100)

    def test_correct_final_submission_before_deadline_survives_long_playback(self):
        runtime = self.runtime()
        runtime.at(599.999)
        runtime.audio.return_value = 25
        runtime.submit()
        runtime.at(601)
        self.assertFalse(runtime.puzzle.exhausted)
        self.assertFalse(runtime.puzzle.solved)
        runtime.at(627)
        self.assertTrue(runtime.puzzle.solved)
        self.assertEqual(runtime.puzzle.total_points, 40)
        self.assertAlmostEqual(runtime.puzzle.get_state()['elapsed_seconds'], 599.999)
        runtime.client.send_message.assert_called_once_with('FROM_FLASK', 'P4End')

    def test_submission_at_or_after_deadline_is_rejected_even_if_timer_is_late(self):
        for elapsed in [600, 600.001, 700]:
            with self.subTest(elapsed=elapsed):
                runtime = self.runtime()
                runtime.at(599)
                runtime.clock.now = runtime.origin + elapsed  # OS delayed the timer callback
                runtime.submit()
                state = runtime.puzzle.get_state()
                self.assertTrue(state['puzzle_exhausted'])
                self.assertFalse(state['puzzle_solved'])
                self.assertEqual(state['total_points'], 0)
                self.assertEqual(state['elapsed_seconds'], 600)
                self.assertEqual(state['time_remaining_seconds'], 0)
                self.assertEqual(len(self.terminal_events(runtime)), 1)
                runtime.client.send_message.assert_called_once_with('FROM_FLASK', 'P4End')

    def test_deadline_exhausts_without_any_input(self):
        runtime = self.runtime()
        runtime.at(600)
        self.assertTrue(runtime.puzzle.exhausted)
        self.assertFalse(runtime.puzzle.solved)
        self.assertEqual(runtime.puzzle.total_points, 0)
        self.assertTrue(all(timer.cancelled or timer.fired for timer in runtime.clock.timers))

    def test_wrong_last_track_listening_cannot_reserve_success(self):
        runtime = self.runtime()
        runtime.at(599)
        runtime.audio.return_value = 25
        runtime.submit(correct=False)
        runtime.at(630)
        self.assertTrue(runtime.puzzle.exhausted)
        self.assertFalse(runtime.puzzle.solved)
        self.assertFalse(any('validation_feedback' in call.args[0]
                             for call in runtime.client.push_update.call_args_list))

    def test_round_one_correct_track_crossing_deadline_still_exhausts(self):
        runtime = self.runtime(two_rounds=True)
        runtime.at(599)
        runtime.audio.return_value = 25
        runtime.submit()
        runtime.at(630)
        self.assertTrue(runtime.puzzle.exhausted)
        self.assertFalse(runtime.puzzle.solved)
        runtime.client.start_next_round.assert_not_called()

    def test_timeout_cancels_failure_feedback_reset(self):
        runtime = self.runtime()
        runtime.at(598)
        runtime.submit(correct=False)
        runtime.clock.advance(0)
        self.assertTrue(runtime.puzzle.validating)
        runtime.at(600)
        count = runtime.client.push_update.call_count
        for timer in list(runtime.clock.timers):
            timer.function()  # include callbacks that raced with cancellation
        self.assertEqual(runtime.client.push_update.call_count, count)
        self.assertTrue(runtime.puzzle.exhausted)

    def test_timeout_cancels_round_countdown_and_sample_workers(self):
        for submitted in [585, 590]:
            with self.subTest(submitted=submitted):
                runtime = self.runtime(two_rounds=True)
                runtime.at(submitted)
                runtime.submit()
                runtime.at(599)
                runtime.at(600)
                count = runtime.client.push_update.call_count
                for timer in list(runtime.clock.timers):
                    timer.function()
                self.assertTrue(runtime.puzzle.exhausted)
                self.assertEqual(runtime.client.push_update.call_count, count)

    def test_stop_and_reset_invalidate_every_queued_callback(self):
        for phase in ['initial', 'sample', 'validation', 'feedback', 'countdown', 'final']:
            for operation in ['stop', 'reset']:
                with self.subTest(phase=phase, operation=operation):
                    runtime = self.runtime(two_rounds=phase == 'countdown')
                    if phase == 'sample':
                        runtime.at(3)
                    elif phase not in ['initial', 'sample']:
                        runtime.at(100)
                        runtime.audio.return_value = 5 if phase == 'validation' else 0
                        runtime.submit(correct=phase != 'feedback')
                        if phase != 'validation':
                            runtime.clock.advance(0)
                    generation = runtime.puzzle._generation
                    old_timers = list(runtime.clock.timers)
                    getattr(runtime.puzzle, operation)()
                    count = runtime.client.push_update.call_count
                    rounds = runtime.client.start_next_round.call_count
                    for timer in old_timers:
                        timer.function()
                    runtime.puzzle._handle_validation(True, generation=generation)
                    self.assertEqual(runtime.client.push_update.call_count, count)
                    self.assertEqual(runtime.client.start_next_round.call_count, rounds)
                    runtime.client.send_message.assert_not_called()
                    self.assertTrue(all(timer.cancelled for timer in old_timers if not timer.fired))
                    if operation == 'reset':
                        self.assertEqual(runtime.puzzle.get_state()['elapsed_seconds'], 0)
                        self.assertNotIn('total_points', runtime.puzzle.get_state())
                    else:
                        runtime.submit()
                        self.assertEqual(runtime.client.push_update.call_count, count)

    def test_reset_reopens_exhausted_run_and_preserves_round_preference(self):
        runtime = self.runtime(two_rounds=True)
        runtime.at(600)
        runtime.puzzle.reset()
        self.assertEqual(runtime.puzzle.total_required, 2)
        self.assertFalse(runtime.puzzle.exhausted)
        self.assertEqual(runtime.puzzle.get_state()['available_points'], 100)
        self.assertEqual(runtime.puzzle.get_state()['time_remaining_seconds'], 600)

    def test_round_choice_is_committed_at_correct_submission_not_audio_end(self):
        for two_rounds in [False, True]:
            with self.subTest(two_rounds=two_rounds):
                runtime = self.runtime(two_rounds=two_rounds)
                runtime.at(100)
                runtime.audio.return_value = 5
                runtime.submit()
                runtime.puzzle.set_second_round_enabled(not two_rounds)
                self.assertEqual(runtime.puzzle.total_required, 2 if two_rounds else 1)
                runtime.at(107)
                self.assertEqual(runtime.puzzle.solved, not two_rounds)
                runtime.puzzle.reset()
                self.assertEqual(runtime.puzzle.total_required, 1 if two_rounds else 2)

    def test_round_choice_can_still_change_during_wrong_validation(self):
        runtime = self.runtime()
        runtime.at(100)
        runtime.audio.return_value = 5
        runtime.submit(correct=False)
        runtime.puzzle.set_second_round_enabled(True)
        self.assertEqual(runtime.puzzle.total_required, 2)
        runtime.at(108)
        runtime.submit()
        runtime.at(113)
        self.assertEqual(runtime.puzzle.streak, 1)
        self.assertFalse(runtime.puzzle.solved)

    def test_late_mqtt_duplicate_validation_and_deadline_never_repeat_terminal(self):
        for success in [True, False]:
            with self.subTest(success=success):
                runtime = self.runtime()
                runtime.at(200)
                if success:
                    runtime.submit()
                    runtime.puzzle._handle_validation(True)
                    runtime.at(202)
                else:
                    runtime.at(600)
                count = runtime.client.push_update.call_count
                runtime.submit()
                runtime.puzzle._handle_validation(True)
                runtime.puzzle.timer_expired()
                for timer in list(runtime.clock.timers):
                    timer.function()
                runtime.at(900)
                self.assertEqual(runtime.client.push_update.call_count, count)
                self.assertEqual(len(self.terminal_events(runtime)), 1)
                runtime.client.send_message.assert_called_once_with('FROM_FLASK', 'P4End')

    def test_direct_validation_entry_remains_available_with_optional_metadata(self):
        runtime = self.runtime()
        runtime.at(240)
        runtime.puzzle.played_sequence = runtime.puzzle.streak1_required_order.copy()
        runtime.puzzle._handle_validation(True, 10, runtime.puzzle._generation,
                                          runtime.clock.now)
        runtime.at(252)
        self.assertEqual(runtime.puzzle.total_points, 80)

    def test_state_exposes_score_bands_for_the_live_hud(self):
        state = self.runtime().puzzle.get_state()
        config = SCORING_CONFIG['puzzle4']
        self.assertEqual(state['max_points'], config['max_points'])
        self.assertEqual(state['penalty_per_time_band'], config['penalty_per_time_band'])
        self.assertEqual(state['penalty_thresholds_seconds'], config['penalty_thresholds_seconds'])
        self.assertEqual(state['max_time_seconds'], config['max_time_seconds'])

    def test_maximum_time_is_read_from_configuration_and_must_be_finite(self):
        for invalid in [None, True, 0, -1, float('inf'), float('nan')]:
            with self.subTest(invalid=invalid):
                with patch.dict(SCORING_CONFIG['puzzle4'], max_time_seconds=invalid):
                    with self.assertRaises(ValueError):
                        Puzzle4(Mock())
        with patch.dict(SCORING_CONFIG['puzzle4'], max_time_seconds=60):
            runtime = self.runtime()
            runtime.at(60)
            self.assertTrue(runtime.puzzle.exhausted)

    def test_early_deadline_wakeup_is_rearmed(self):
        runtime = self.runtime()
        deadline = runtime.clock.timers[0]
        runtime.at(200)
        deadline.fired = True
        deadline.function()
        self.assertFalse(runtime.puzzle.exhausted)
        runtime.at(600)
        self.assertTrue(runtime.puzzle.exhausted)


if __name__ == '__main__':
    unittest.main()