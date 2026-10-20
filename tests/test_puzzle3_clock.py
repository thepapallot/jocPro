"""Deterministic quiz lifecycle tests: no broker, wall-clock waits or real timers."""
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from mqtt.puzzles.puzzle3 import Puzzle3


class FakeTimer:
    def __init__(self, interval, function):
        self.interval = interval
        self.function = function
        self.cancelled = False

    def start(self):
        pass

    def cancel(self):
        self.cancelled = True

    def fire(self):
        # Deliberately also fire cancelled callbacks to simulate reset/stop races.
        self.function()


class Puzzle3ClockTests(unittest.TestCase):
    def setUp(self):
        self.now = 1000.0
        self.timer_patch = patch('mqtt.puzzles.puzzle3.threading.Timer', FakeTimer)
        self.clock_patch = patch('mqtt.puzzles.puzzle3.time.monotonic', side_effect=lambda: self.now)
        self.timer_patch.start()
        self.clock_patch.start()
        self.addCleanup(self.timer_patch.stop)
        self.addCleanup(self.clock_patch.stop)
        self.client = SimpleNamespace(get_active_session_language=lambda: 'ca',
                                      push_update=Mock(), send_message=Mock())
        self.puzzle = Puzzle3(self.client)
        self.puzzle.reset()
        self.addCleanup(self.puzzle.stop)

    def answer(self, success=True):
        question = self.puzzle.chosen_questions[self.puzzle.current_question_idx]
        expected = [self.puzzle._normalize_expected_answer(v) for v in question['correct']]
        for player, value in enumerate(expected):
            if not success and player == 0:
                value = 1 if value == 5 else 5
            self.puzzle.handle_message(['P3', str(player), str(value)])

    def advance(self):
        self.puzzle._next_question_timer.fire()

    def test_starts_at_five_minutes_with_no_points(self):
        state = self.puzzle.get_state()
        self.assertEqual(state['remaining'], 300)
        self.assertEqual(state['duration'], 300)
        self.assertEqual(state['total_points'], 0)
        self.assertFalse(state['puzzle_solved'])

    def test_more_than_six_correct_questions_keep_playing(self):
        for count in range(1, 14):
            self.answer()
            state = self.puzzle.get_state()
            self.assertEqual(state['total_points'], count * 10)
            self.assertEqual(state['correct_count'], count)
            self.assertFalse(state['puzzle_solved'])
            self.advance()
        self.assertEqual(self.puzzle.get_state()['question_number'], 14)
        self.client.send_message.assert_not_called()

    def test_wrong_answers_advance_and_do_not_deduct_or_reset_points(self):
        for success, points in ((True, 10), (False, 10), (True, 20), (False, 20)):
            number = self.puzzle.display_question_number
            self.answer(success)
            self.assertEqual(self.puzzle.total_points, points)
            self.advance()
            self.assertEqual(self.puzzle.display_question_number, number + 1)

    def test_clock_runs_during_result_and_tick_is_a_partial_update(self):
        self.answer()
        self.now += 4
        self.puzzle._clock_timer.fire()
        event = self.client.push_update.call_args.args[0]
        self.assertEqual(event['remaining'], 296)
        self.assertEqual(event['total_points'], 10)
        self.assertNotIn('question', event)
        self.assertNotIn('question_result', event)
        self.assertTrue(self.puzzle.get_state()['question_result']['success'])

    def test_partial_answers_and_results_are_recoverable_snapshots(self):
        self.puzzle.handle_message(['P3', '0', '5'])
        self.assertEqual(self.puzzle.get_state()['answered_map'], {0: 5})
        self.answer()
        state = self.puzzle.get_state()
        self.assertEqual(len(state['question_result']['player_answers']), 10)
        state['question_result']['player_answers'].clear()
        self.assertEqual(len(self.puzzle.get_state()['question_result']['player_answers']), 10)
        self.advance()
        self.assertNotIn('question_result', self.puzzle.get_state())
        self.assertEqual(self.puzzle.get_state()['answered_map'], {})

    def test_timeout_finishes_once_with_accumulated_points(self):
        self.answer()
        pending = self.puzzle._next_question_timer
        self.now += 300
        self.puzzle._clock_timer.fire()
        self.assertTrue(self.puzzle.solved)
        self.assertEqual(self.puzzle.get_state()['remaining'], 0)
        self.assertEqual(self.puzzle.get_state()['total_points'], 10)
        self.assertTrue(pending.cancelled)
        events = self.client.push_update.call_count
        pending.fire()
        self.answer()
        self.puzzle.timer_expired()
        self.assertEqual(self.client.push_update.call_count, events)
        self.client.send_message.assert_called_once_with('FROM_FLASK', 'P3End')
        self.assertEqual(sum(bool(c.args[0].get('puzzle_solved'))
                             for c in self.client.push_update.call_args_list), 1)

    def test_timeout_also_finishes_with_zero_points(self):
        self.now += 300
        self.puzzle.timer_expired()
        self.assertTrue(self.puzzle.solved)
        self.assertEqual(self.client.push_update.call_args.args[0]['total_points'], 0)

    def test_early_client_timeout_cannot_shorten_run(self):
        self.puzzle.timer_expired()
        self.assertFalse(self.puzzle.solved)
        self.assertEqual(self.puzzle.get_state()['remaining'], 300)

    def test_last_answer_at_deadline_does_not_award_points(self):
        question = self.puzzle.chosen_questions[0]
        for player, value in enumerate(question['correct'][:9]):
            answer = self.puzzle._normalize_expected_answer(value)
            self.puzzle.handle_message(['P3', str(player), str(answer)])
        self.now += 300
        answer = self.puzzle._normalize_expected_answer(question['correct'][9])
        self.puzzle.handle_message(['P3', '9', str(answer)])
        self.assertTrue(self.puzzle.solved)
        self.assertEqual(self.puzzle.total_points, 0)

    def test_next_question_callback_checks_deadline(self):
        self.answer()
        number = self.puzzle.display_question_number
        self.now += 300
        self.advance()
        self.assertTrue(self.puzzle.solved)
        self.assertEqual(self.puzzle.display_question_number, number)

    def test_reset_invalidates_all_pending_callbacks(self):
        self.answer()
        old_clock = self.puzzle._clock_timer
        old_question = self.puzzle._next_question_timer
        self.now += 20
        self.puzzle.reset()
        state = self.puzzle.get_state()
        old_clock.fire()
        old_question.fire()
        self.assertEqual(self.puzzle.get_state(), state)
        self.assertEqual(state['total_points'], 0)
        self.assertEqual(state['question_number'], 1)
        self.assertEqual(state['remaining'], 300)

    def test_stop_blocks_old_callbacks_and_hardware(self):
        self.answer()
        clock = self.puzzle._clock_timer
        question = self.puzzle._next_question_timer
        self.puzzle.stop()
        events = self.client.push_update.call_count
        self.now += 300
        clock.fire()
        question.fire()
        self.answer()
        self.puzzle.timer_expired()
        self.assertEqual(self.client.push_update.call_count, events)
        self.client.send_message.assert_not_called()

    def test_completed_submission_cannot_score_twice(self):
        self.answer()
        self.answer()
        self.assertEqual(self.puzzle.total_points, 10)
        transition = self.puzzle._next_question_timer
        transition.fire()
        number = self.puzzle.display_question_number
        transition.fire()
        self.assertEqual(self.puzzle.display_question_number, number)

    def test_malformed_messages_do_not_change_state(self):
        state = self.puzzle.get_state()
        for parts in ([], ['P3'], ['P3', '0', '0'], ['P3', '-1', '5'],
                      ['P3', '10', '1'], ['P5', '0', '5'], ['P3', 'x', '5']):
            self.puzzle.handle_message(parts)
        self.assertEqual(self.puzzle.get_state(), state)


if __name__ == '__main__':
    unittest.main()