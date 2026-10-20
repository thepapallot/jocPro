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
        if self.puzzle.golden_announcement:
            self.puzzle._golden_timer.fire()

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
            self.assertEqual(state['total_points'], (count + count // self.puzzle.golden_every) * 10)
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

    def test_clock_tick_is_a_partial_update_while_answering(self):
        self.now += 4
        self.puzzle._clock_timer.fire()
        event = self.client.push_update.call_args.args[0]
        self.assertEqual(event['remaining'], 296)
        self.assertFalse(event['clock_paused'])
        self.assertNotIn('question', event)
        self.assertNotIn('question_result', event)

    def test_correct_and_wrong_results_freeze_exact_time_until_next_question(self):
        for success in (True, False):
            with self.subTest(success=success):
                self.puzzle.reset()
                self.now += 0.25
                stale_clock = self.puzzle._clock_timer
                self.answer(success)
                state = self.puzzle.get_state()
                event = self.client.push_update.call_args.args[0]
                self.assertTrue(event['clock_paused'])
                self.assertTrue(state['clock_paused'])
                self.assertEqual(state['question_result']['success'], success)
                self.assertEqual(self.puzzle._next_question_timer.interval, 7)
                self.assertTrue(stale_clock.cancelled)
                events = self.client.push_update.call_count
                self.now += 20  # A late result callback must not consume game time.
                stale_clock.fire()
                self.puzzle.timer_expired()
                self.answer(not success)
                self.assertEqual(self.puzzle.get_state(), state)
                self.assertEqual(self.client.push_update.call_count, events)
                self.advance()
                resumed = self.puzzle.get_state()
                self.assertFalse(resumed['clock_paused'])
                self.assertEqual(resumed['remaining'], state['remaining'])
                self.assertEqual(self.puzzle.deadline - self.now, 299.75)
                self.assertIsNotNone(self.puzzle._clock_timer)
                self.assertFalse(self.client.push_update.call_args.args[0]['clock_paused'])
                self.now += 1
                self.assertEqual(self.puzzle.get_state()['remaining'], state['remaining'] - 1)

    def test_golden_result_also_freezes_time(self):
        self.enter_golden_announcement()
        self.puzzle._golden_timer.fire()
        self.answer()
        state = self.puzzle.get_state()
        self.now += 4
        self.assertEqual(self.puzzle.get_state(), state)
        self.assertTrue(state['clock_paused'])
        self.assertEqual(state['total_points'], 20)
        self.advance()
        self.assertFalse(self.puzzle.get_state()['clock_paused'])

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
        self.advance()
        self.answer()
        pending = self.puzzle._next_question_timer
        self.advance()
        self.now += 300
        self.puzzle._clock_timer.fire()
        self.assertTrue(self.puzzle.solved)
        self.assertEqual(self.puzzle.get_state()['remaining'], 0)
        self.assertEqual(self.puzzle.get_state()['total_points'], 20)
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

    def test_result_near_timeout_resumes_with_exact_fractional_time(self):
        self.now = self.puzzle.deadline - 0.5
        self.answer()
        number = self.puzzle.display_question_number
        self.now += 300
        self.advance()
        self.assertFalse(self.puzzle.solved)
        self.assertEqual(self.puzzle.display_question_number, number + 1)
        self.assertEqual(self.puzzle.deadline - self.now, 0.5)
        self.now += 0.5
        self.puzzle.timer_expired()
        self.assertTrue(self.puzzle.solved)

    def test_reset_invalidates_all_pending_callbacks(self):
        old_clock = self.puzzle._clock_timer
        self.answer()
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
        clock = self.puzzle._clock_timer
        self.answer()
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

    def enter_golden_announcement(self):
        for _ in range(self.puzzle.golden_every - 2):
            self.answer(False)
            self.advance()
        self.answer(False)
        self.puzzle._next_question_timer.fire()
        self.assertTrue(self.puzzle.golden_announcement)

    def test_every_sixth_question_is_medium_even_after_errors(self):
        self.assertEqual(self.puzzle.golden_every, 6)
        for number in range(1, 16):
            state = self.puzzle.get_state()
            question = self.puzzle.chosen_questions[self.puzzle.current_question_idx]
            golden = number % self.puzzle.golden_every == 0
            self.assertEqual(question['_source'], 'medium' if golden else 'easy')
            self.assertEqual(state['golden_question'], golden)
            self.assertEqual(state['question_points'], 20 if golden else 10)
            self.answer(False)
            self.advance()
        self.assertEqual(self.puzzle.total_points, 0)

    def test_golden_announcement_freezes_exact_time_and_blocks_answers(self):
        self.enter_golden_announcement()
        state = self.puzzle.get_state()
        self.assertTrue(state['clock_paused'])
        self.assertTrue(state['golden_announcement'])
        self.assertNotIn('question', state)
        self.assertEqual(self.puzzle._golden_timer.interval, 4)
        self.now += 4
        self.answer()
        self.puzzle.timer_expired()
        self.assertEqual(self.puzzle.answered_players, {})
        self.assertEqual(self.puzzle.get_state(), state)
        self.puzzle._golden_timer.fire()
        revealed = self.puzzle.get_state()
        self.assertFalse(revealed['clock_paused'])
        self.assertIn('question', revealed)
        self.assertEqual(revealed['remaining'], state['remaining'])
        self.now += 1
        self.assertEqual(self.puzzle.get_state()['remaining'], state['remaining'] - 1)
        self.answer()
        self.assertEqual(self.puzzle.total_points, 20)

    def test_golden_warning_near_timeout_does_not_expire_or_gain_fractional_time(self):
        for _ in range(self.puzzle.golden_every - 2):
            self.answer(False)
            self.advance()
        stale_clock = self.puzzle._clock_timer
        self.now = self.puzzle.deadline - 0.5
        self.answer(False)
        self.now += 7
        self.puzzle._next_question_timer.fire()
        self.assertEqual(self.puzzle.get_state()['remaining'], 1)
        events = self.client.push_update.call_count
        self.now += 4
        stale_clock.fire()
        self.puzzle.timer_expired()
        self.assertFalse(self.puzzle.solved)
        self.assertEqual(self.client.push_update.call_count, events)
        reveal = self.puzzle._golden_timer
        reveal.fire()
        deadline = self.puzzle.deadline
        self.assertEqual(deadline - self.now, 0.5)
        reveal.fire()
        self.assertEqual(self.puzzle.deadline, deadline, 'Duplicate reveal must not extend time')
        self.now += 0.5
        self.puzzle.timer_expired()
        self.assertTrue(self.puzzle.solved)

    def test_reset_and_stop_invalidate_a_pending_golden_warning(self):
        for action in ('reset', 'stop'):
            self.puzzle.reset()
            self.enter_golden_announcement()
            reveal = self.puzzle._golden_timer
            getattr(self.puzzle, action)()
            state = self.puzzle.get_state()
            events = self.client.push_update.call_count
            reveal.fire()
            self.assertEqual(self.puzzle.get_state(), state)
            self.assertEqual(self.client.push_update.call_count, events)

    def test_hard_and_company_banks_never_enter_the_new_pattern(self):
        self.puzzle.company_bank = [dict(self.puzzle.easy_bank[0], _source='company')]
        for _ in range(3):
            self.puzzle._choose_new_set()
            self.assertEqual([q['_source'] for q in self.puzzle.chosen_questions],
                             ['easy'] * (self.puzzle.golden_every - 1) + ['medium'])


if __name__ == '__main__':
    unittest.main()