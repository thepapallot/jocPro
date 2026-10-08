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
        state = self.puzzle.get_state()
        self.assertEqual(state['sequences'][1], [5, 0, 9, 6, 2])
        self.assertEqual(state['sequences'][10], [1, 4, 6, 3, 5])

    def test_alarm_mode_keeps_displayed_sequence_unchanged(self):
        self.puzzle.alarm_mode = True
        state = self.puzzle.get_state()
        self.assertEqual(state['sequences'][1], [5, 0, 9, 6, 2])
        self.assertEqual(state['players'][0]['sequence'], [5, 0, 9, 6, 2])

    def test_alarm_mode_expects_remapped_mqtt_symbol_without_changing_display(self):
        self.puzzle.alarm_mode = True

        # Serpent 1 displays symbol 5, but accepts its alarm mapping, symbol 4, over MQTT.
        self.puzzle.handle_message(['P2', '1', '4'])

        self.assertEqual(self.puzzle.progress[1], 1)
        self.assertEqual(self.puzzle.get_state()['sequences'][1][0], 5)

    def test_alarm_mode_rejects_displayed_symbol_when_mqtt_mapping_differs(self):
        self.puzzle.alarm_mode = True

        self.puzzle.handle_message(['P2', '1', '5'])

        self.assertEqual(self.puzzle.progress[1], 0)
        self.assertEqual(self.puzzle.error_counter, 1)
        self.assertEqual(self.client.push_update.call_args.args[0]['error_increment']['expected'], 4)


if __name__ == '__main__':
    unittest.main()
