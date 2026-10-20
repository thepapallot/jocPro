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
                    shared_color = target.index(10)
                    with patch('mqtt.puzzles.puzzle12.threading.Timer') as timer:
                        for box in range(1, 11):
                            buttons = ''.join('1' if box <= count else '0' for count in target)
                            puzzle.handle_message(['P12', str(box), buttons])
                            if box < 10:
                                timer.assert_not_called()
                        timer.assert_called_once_with(2.0, puzzle._confirm_solved)
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


if __name__ == '__main__':
    unittest.main()