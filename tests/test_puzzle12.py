import unittest
from unittest.mock import Mock, patch

from mqtt.puzzles.puzzle12 import Puzzle12


class Puzzle12TargetsTest(unittest.TestCase):
    def setUp(self):
        self.client = Mock()
        self.puzzle = Puzzle12(self.client)
        self.enterContext(patch('builtins.print'))

    def test_every_combination_requires_ten_buttons_of_exactly_one_color(self):
        self.assertEqual(len(self.puzzle.botons), 3)
        for level, combinations in enumerate(self.puzzle.botons, start=1):
            self.assertEqual(len(combinations), self.puzzle.counters[level - 1]['num_giff'])
            for combination, target in enumerate(combinations, start=1):
                with self.subTest(level=level, combination=combination):
                    self.assertEqual(len(target), 6)
                    self.assertEqual(target.count(10), 1)
                    self.assertTrue(all(isinstance(count, int) and 0 <= count <= 10
                                        for count in target))

    def test_reset_and_snapshot_publish_the_active_level_targets(self):
        self.assertEqual(self.puzzle.active_streaks, [3])
        for combination, target in enumerate(self.puzzle.botons[2], start=1):
            with self.subTest(combination=combination):
                with patch('mqtt.puzzles.puzzle12.random.choice', return_value=combination):
                    self.puzzle.reset()
                update = self.client.push_update.call_args.args[0]
                self.assertEqual(update['target'], list(target))
                self.assertEqual(update['level_id'], 3)
                self.assertEqual(update['duration'], 90)
                self.assertEqual(update['total_rounds'], 1)
                self.assertEqual(self.puzzle.get_state()['target'], list(target))

    def test_each_target_needs_tenth_terminal_and_cancels_when_it_releases(self):
        for level, combinations in enumerate(self.puzzle.botons, start=1):
            for combination, target in enumerate(combinations, start=1):
                with self.subTest(level=level, combination=combination):
                    puzzle = Puzzle12(self.client)
                    puzzle.current_streak = level
                    puzzle.current_giff = combination
                    puzzle.current_target = list(target)
                    shared_color = target.index(10)
                    with patch('mqtt.puzzles.puzzle12.threading.Timer') as timer:
                        for box in range(1, 11):
                            buttons = ''.join('1' if box <= count else '0' for count in target)
                            puzzle.handle_message(['P12', str(box), buttons])
                            if box < 10:
                                timer.assert_not_called()
                        timer.assert_called_once_with(2.0, puzzle._confirm_solved,
                                                      args=(puzzle._generation,))
                        timer.return_value.start.assert_called_once()
                        self.assertEqual(
                            [sum(state[color] for state in puzzle.box_states.values())
                             for color in range(6)],
                            list(target),
                        )
                        released = list(buttons)
                        released[shared_color] = '0'
                        puzzle.handle_message(['P12', '10', ''.join(released)])
                        timer.return_value.cancel.assert_called_once()
                        self.assertIsNone(puzzle._solve_timer)


class Puzzle12RetryTests(unittest.TestCase):
    def setUp(self):
        self.client = Mock()
        self.puzzle = Puzzle12(self.client)
        self.enterContext(patch('builtins.print'))
        self.timer = self.enterContext(patch('mqtt.puzzles.puzzle12.threading.Timer'))
        self.choice = self.enterContext(patch('mqtt.puzzles.puzzle12.random.choice', return_value=1))
        self.enterContext(patch('mqtt.puzzles.puzzle12.time.sleep'))
        self.puzzle.reset()

    def retry(self):
        self.puzzle.timer_expired()
        callback = self.timer.call_args.args[1]
        args = self.timer.call_args.kwargs['args']
        callback(*args)

    def solve(self):
        for box in range(1, 11):
            buttons = ''.join('1' if box <= count else '0'
                              for count in self.puzzle.current_target)
            self.puzzle.handle_message(['P12', str(box), buttons])
        callback = self.timer.call_args.args[1]
        callback(*self.timer.call_args.kwargs['args'])

    def test_scoring_all_retries_and_zero_does_not_end_puzzle(self):
        for retries in (0, 1, 4, 5, 9, 10, 12):
            with self.subTest(retries=retries):
                self.puzzle.reset()
                for _ in range(retries):
                    self.retry()
                state = self.puzzle.get_state()
                self.assertFalse(state['puzzle_solved'])
                self.assertEqual(state['timeout_count'], retries)
                self.assertEqual(state['total_points'], 0)
                self.assertEqual(state['available_points'], max(0, 100 - 10 * retries))
                self.solve()
                self.assertEqual(self.puzzle.get_state()['total_points'], max(0, 100 - 10 * retries))
                self.assertTrue(self.client.push_update.call_args.args[0]['puzzle_solved'])
                self.assertEqual(self.client.push_update.call_args.args[0]['total_points'],
                                 max(0, 100 - 10 * retries))

    def test_fifth_retry_starts_monotonic_help_and_keeps_ten(self):
        original = self.puzzle.current_target.copy()
        for _ in range(4):
            self.retry()
            self.assertEqual(self.puzzle.current_target, original)
        self.assertEqual(self.choice.call_count, 5)
        previous = original
        for retry in range(5, 16):
            self.retry()
            target = self.puzzle.current_target
            expected = [count if count == 10 else max(1, count - 1) for count in previous]
            self.assertEqual(target, expected)
            self.assertEqual(target.count(10), 1)
            self.assertEqual(self.puzzle.current_giff, 1)
            self.assertEqual(self.choice.call_count, 5)
            self.assertEqual(self.puzzle.get_state()['target'], target)
            self.assertEqual(self.client.push_update.call_args.args[0]['target'], target)
            previous = target.copy()
        self.assertEqual(sum(previous), 15)
        self.assertEqual(self.puzzle.botons[2][0], tuple(original))

    def test_duplicate_timeout_only_penalizes_once_and_clears_boxes(self):
        self.puzzle.box_states = {1: [1] * 6}
        self.puzzle.timer_expired()
        self.puzzle.timer_expired()
        self.assertEqual(self.puzzle.timeout_count, 1)
        self.timer.assert_called_once()
        callback = self.timer.call_args.args[1]
        args = self.timer.call_args.kwargs['args']
        callback(*args)
        self.assertEqual(self.puzzle.box_states, {})
        pushes = self.client.push_update.call_count
        callback(*args)
        self.assertEqual(self.client.push_update.call_count, pushes)

    def test_reset_clears_score_help_boxes_and_pending_retry(self):
        for _ in range(6):
            self.retry()
        self.puzzle.timer_expired()
        callback = self.timer.call_args.args[1]
        args = self.timer.call_args.kwargs['args']
        self.puzzle.reset()
        callback(*args)
        self.assertEqual(self.puzzle.timeout_count, 0)
        self.assertEqual(self.puzzle.total_points, 0)
        self.assertEqual(self.puzzle.current_target, list(self.puzzle.botons[2][0]))
        self.assertEqual(self.puzzle.box_states, {})
        self.assertFalse(self.puzzle.processing_wrong_result)

    def test_stop_invalidates_retry_and_solve_callbacks(self):
        for mode in ('retry', 'solve'):
            with self.subTest(mode=mode):
                self.puzzle.reset()
                if mode == 'retry':
                    self.puzzle.timer_expired()
                else:
                    self.puzzle.box_states = {
                        box: [int(box <= count) for count in self.puzzle.current_target]
                        for box in range(1, 11)
                    }
                    self.puzzle.handle_message(['P12', '10', '000010'])
                callback = self.timer.call_args.args[1]
                args = self.timer.call_args.kwargs['args']
                self.puzzle.stop()
                pushes = self.client.push_update.call_count
                callback(*args)
                self.assertEqual(self.client.push_update.call_count, pushes)
                self.assertFalse(self.puzzle.solved)

    def test_reduced_target_is_validated_not_original_pattern(self):
        original = self.puzzle.current_target.copy()
        for _ in range(5):
            self.retry()
        self.puzzle.box_states = {
            box: [int(box <= count) for count in original] for box in range(1, 11)
        }
        self.puzzle._confirm_solved(self.puzzle._generation)
        self.assertFalse(self.puzzle.solved)
        self.solve()
        self.assertTrue(self.puzzle.solved)
        self.assertEqual(self.puzzle.total_points, 50)

    def test_snapshot_target_cannot_mutate_active_target(self):
        state = self.puzzle.get_state()
        state['target'][0] = 99
        self.assertNotEqual(self.puzzle.current_target[0], 99)

    def test_invalid_terminal_or_button_payload_cannot_satisfy_target(self):
        for box, buttons in ((0, '111111'), (11, '111111'), (1, '1111111'),
                             (1, '11111'), (1, '211111')):
            self.puzzle.handle_message(['P12', str(box), buttons])
        self.assertEqual(self.puzzle.box_states, {})
        self.timer.assert_not_called()


if __name__ == '__main__':
    unittest.main()