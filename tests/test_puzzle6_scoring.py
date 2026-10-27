import json
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from mqtt.puzzles.puzzle6 import Puzzle6


class Puzzle6ScoringTests(unittest.TestCase):
    def setUp(self):
        self.threads = self.enterContext(patch("mqtt.puzzles.puzzle6.threading.Thread"))
        self.sleep = self.enterContext(patch("mqtt.puzzles.puzzle6.time.sleep"))
        self.client = SimpleNamespace(push_update=Mock(), send_message=Mock())
        self.puzzle = Puzzle6(self.client)

    def tearDown(self):
        for call in self.client.push_update.call_args_list:
            json.dumps(call.args[0], allow_nan=False)

    def test_reset_starts_at_full_score_and_clears_previous_run(self):
        self.puzzle.restart_count = 4
        self.puzzle.total_points = 60

        self.puzzle.reset()

        state = self.puzzle.get_state()
        self.assertEqual(state["restart_count"], 0)
        self.assertEqual(state["available_points"], 100)
        self.assertEqual(state["total_points"], 0)
        self.assertTrue(state["active"])
        self.assertIsNone(state["last_reset_box"])

    def test_each_restart_penalizes_once_and_duplicate_events_while_pending_are_ignored(self):
        self.puzzle.reset()
        self.puzzle.handle_message(["P6", "4"])
        self.puzzle.handle_message(["P6", "7"])

        state = self.puzzle.get_state()
        self.assertEqual(state["restart_count"], 1)
        self.assertEqual(state["available_points"], 90)
        self.assertEqual(state["last_reset_box"], 4)
        self.assertEqual(self.client.push_update.call_args.args[0]["available_points"], 90)

        restart = self.threads.call_args.kwargs["target"]
        restart()
        self.sleep.assert_called_once_with(10)
        self.assertTrue(self.puzzle.active)
        self.puzzle.handle_message(["P6", "7"])
        self.assertEqual(self.puzzle.get_state()["restart_count"], 2)
        self.assertEqual(self.puzzle.get_state()["available_points"], 80)

    def test_natural_completion_persists_score_and_floors_at_zero(self):
        self.puzzle.reset()
        self.puzzle.restart_count = 12
        self.puzzle.active = True
        self.puzzle.end_time = 99

        with patch("mqtt.puzzles.puzzle6.time.time", return_value=100):
            self.puzzle._monitor_loop()

        state = self.puzzle.get_state()
        self.assertTrue(state["puzzle_solved"])
        self.assertEqual(state["total_points"], 0)
        self.assertEqual(self.client.push_update.call_args.args[0]["total_points"], 0)
        self.client.send_message.assert_called_once_with("FROM_FLASK", "P6End")

    def test_game_master_completion_uses_same_score_and_is_idempotent(self):
        self.puzzle.reset()
        self.puzzle.restart_count = 3

        self.puzzle.complete_by_gm()
        self.puzzle.complete_by_gm()

        state = self.puzzle.get_state()
        self.assertTrue(state["puzzle_solved"])
        self.assertEqual(state["total_points"], 70)
        self.assertTrue(self.client.push_update.call_args.args[0]["forced_by_gm"])
        self.assertEqual(self.client.push_update.call_args.args[0]["total_points"], 70)
        self.client.send_message.assert_called_once_with("FROM_FLASK", "P6End")


if __name__ == "__main__":
    unittest.main()
