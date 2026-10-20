"""Shared scoring tests; no MQTT, Flask startup or persistent database."""
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from mqtt.puzzles.puzzle8 import Puzzle8
from scoring import calculate_correct_points, calculate_points, get_max_attempts
from scoring_config import SCORING_CONFIG


class ScoringTests(unittest.TestCase):
    def test_config_contains_only_agreed_puzzles(self):
        self.assertEqual(set(SCORING_CONFIG), {"puzzle1", "puzzle3", "puzzle5", "puzzle8", "puzzle12"})

    def test_buttons_score_timeouts_without_an_attempt_limit(self):
        self.assertNotIn("max_attempts", SCORING_CONFIG["puzzle12"])
        for timeouts in range(16):
            self.assertEqual(calculate_points("puzzle12", timeouts), max(0, 100 - 10 * timeouts))

    def test_quiz_scores_only_correct_questions_without_a_cap(self):
        for count in (0, 1, 6, 7, 20):
            self.assertEqual(calculate_correct_points("puzzle3", count), count * 10)
        self.assertEqual(SCORING_CONFIG["puzzle3"]["penalty_per_error"], 0)
        with patch.dict(SCORING_CONFIG, {"puzzle3": {"points_per_correct": 15}}):
            self.assertEqual(calculate_correct_points("puzzle3", 3), 45)
        for count in (-1, 1.5, "2", None, True, False):
            with self.subTest(count=count), self.assertRaises(ValueError):
                calculate_correct_points("puzzle3", count)

    def test_points_for_each_failed_attempt_and_floor(self):
        for puzzle_id, penalty, max_attempts in (("puzzle1", 3, 30),
                             ("puzzle5", 10, 10),
                             ("puzzle8", 10, 10)):
            for errors in range(11):
                with self.subTest(puzzle=puzzle_id, errors=errors):
                    self.assertEqual(calculate_points(puzzle_id, errors),
                                     max(0, 100 - penalty * errors))
            self.assertEqual(calculate_points(puzzle_id, 1000000), 0)
            self.assertEqual(get_max_attempts(puzzle_id), max_attempts)

    def test_unknown_puzzles_do_not_get_invented_scores(self):
        for function, args in ((calculate_points, ("puzzle2", 0)),
                       (get_max_attempts, ("puzzle2",))):
            with self.assertRaises(KeyError):
                function(*args)

    def test_invalid_errors_are_rejected(self):
        for errors in (-1, 1.5, "2", None, True, False):
            with self.subTest(errors=errors):
                with self.assertRaises(ValueError):
                    calculate_points("puzzle5", errors)

    def test_configuration_is_the_only_source_of_points_and_penalties(self):
        with patch.dict(SCORING_CONFIG, {
            "example": {"max_points": 150, "penalty_per_error": 15, "max_attempts": 10},
        }):
            self.assertEqual(calculate_points("example", 2), 120)
            self.assertEqual(calculate_points("example", 11), 0)
        self.assertNotIn("example", SCORING_CONFIG)

    def test_memory_reads_shared_configuration_and_resets_attempt_limit(self):
        client = SimpleNamespace(push_update=Mock(), current_puzzle_id=8,
                                 send_message=Mock())
        puzzle = Puzzle8(client)
        puzzle._schedule = Mock()
        rules = {"max_points": 70, "penalty_per_error": 15, "max_attempts": 4}
        with patch.dict(SCORING_CONFIG, {"puzzle8": rules}):
            puzzle.reset()
            self.assertEqual(puzzle.get_state()["max_attempts"], 4)
            self.assertEqual(puzzle.get_state()["available_points"], 70)
            puzzle.attempt = 3
            self.assertEqual(puzzle.get_state()["available_points"], 40)
            puzzle.exhausted = True
            self.assertEqual(puzzle.get_state()["available_points"], 0)
        puzzle.reset()
        self.assertEqual(puzzle.get_state()["max_attempts"], 10)
        self.assertEqual(puzzle.get_state()["available_points"], 100)


if __name__ == "__main__":
    unittest.main()