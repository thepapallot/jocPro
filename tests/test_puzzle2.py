import unittest
from types import SimpleNamespace
from unittest.mock import Mock

from mqtt.puzzles.puzzle2 import Puzzle2


class Puzzle2AlarmSequenceTest(unittest.TestCase):
    def setUp(self):
        self.client = SimpleNamespace(
            current_puzzle_id=2,
            send_message=Mock(),
            push_update=Mock(),
        )
        self.puzzle = Puzzle2(self.client)

    def test_state_exposes_player_sequences(self):
        self.puzzle.reset()
        state = self.puzzle.get_state()
        self.assertEqual(state['sequences'][1], [5, 0, 9, 6, 2])
        self.assertEqual(state['sequences'][10], [1, 4, 6, 3, 5])

    def test_alarm_mode_flips_the_expected_sequence(self):
        self.puzzle.alarm_mode = True
        self.assertEqual(self.puzzle.get_player_sequence(1), [4, 2, 7, 8, 0])


if __name__ == '__main__':
    unittest.main()
