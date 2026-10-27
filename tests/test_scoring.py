"""Shared scoring tests; no MQTT, Flask startup or persistent database."""
import math
import unittest
from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import Mock, patch

from mqtt.puzzles.puzzle8 import Puzzle8
from scoring import (calculate_correct_points, calculate_points,
                     calculate_time_points, get_max_attempts)
from scoring_config import SCORING_CONFIG


class ScoringTests(unittest.TestCase):
    def test_config_contains_only_agreed_puzzles(self):
        self.assertEqual(set(SCORING_CONFIG),
                         {"puzzle1", "puzzle2", "puzzle3", "puzzle4", "puzzle5", "puzzle6", "puzzle8", "puzzle12"})

    def test_maze_uses_the_agreed_music_time_bands_without_error_penalties(self):
        self.assertEqual(SCORING_CONFIG["puzzle2"], SCORING_CONFIG["puzzle4"])
        self.assertNotIn("penalty_per_error", SCORING_CONFIG["puzzle2"])
        for elapsed in (0, 179.999, 180, 240, 300, 360, 420, 480, 599.999):
            self.assertEqual(calculate_time_points("puzzle2", elapsed),
                             calculate_time_points("puzzle4", elapsed))

    def test_music_config_contains_exactly_the_agreed_time_rules(self):
        self.assertEqual(SCORING_CONFIG["puzzle4"], {
            "max_points": 100,
            "penalty_per_time_band": 10,
            "penalty_thresholds_seconds": [180, 240, 300, 360, 420, 480],
            "max_time_seconds": 600,
            "exhaustion_points": 0,
        })

    def test_time_points_across_all_bands(self):
        for elapsed, expected in ((0, 100), (90, 100), (179, 100),
                                  (210, 90), (270, 80), (330, 70),
                                  (390, 60), (450, 50), (540, 40)):
            with self.subTest(elapsed=elapsed):
                self.assertEqual(calculate_time_points("puzzle4", elapsed), expected)

    def test_time_points_at_exact_thresholds_and_either_side(self):
        for band, threshold in enumerate((180, 240, 300, 360, 420, 480), start=1):
            for elapsed, expected in (
                    (threshold - 1e-9, 100 - 10 * (band - 1)),
                    (math.nextafter(threshold, -math.inf), 100 - 10 * (band - 1)),
                    (threshold, 100 - 10 * band),
                    (float(threshold), 100 - 10 * band),
                    (math.nextafter(threshold, math.inf), 100 - 10 * band),
                    (threshold + 1e-9, 100 - 10 * band)):
                with self.subTest(threshold=threshold, elapsed=elapsed):
                    self.assertEqual(calculate_time_points("puzzle4", elapsed), expected)

    def test_time_points_do_not_apply_puzzle_exhaustion(self):
        for elapsed in (599.999999999, 600, 600.000000001, 601, 1000000):
            with self.subTest(elapsed=elapsed):
                self.assertEqual(calculate_time_points("puzzle4", elapsed), 40)
        with patch.dict(SCORING_CONFIG["puzzle4"], {
            "max_time_seconds": 1, "exhaustion_points": 7,
        }):
            self.assertEqual(calculate_time_points("puzzle4", 600), 40)

    def test_time_points_accept_nonnegative_ints_and_floats(self):
        for elapsed, expected in ((0, 100), (0.0, 100), (-0.0, 100),
                                  (12.5, 100), (10 ** 1000, 40)):
            with self.subTest(elapsed=elapsed):
                self.assertEqual(calculate_time_points("puzzle4", elapsed), expected)

    def test_invalid_elapsed_seconds_are_rejected(self):
        for elapsed in (-1, -0.001, -math.ulp(0.0), "180", None, True, False,
                        math.nan, math.inf, -math.inf, [], {}, 1 + 0j):
            with self.subTest(elapsed=elapsed), self.assertRaises(ValueError):
                calculate_time_points("puzzle4", elapsed)

    def test_time_points_read_mutated_configuration_without_cached_rules(self):
        rules = SCORING_CONFIG["puzzle4"]
        original_thresholds = rules["penalty_thresholds_seconds"][:]
        try:
            with patch.dict(rules, {"max_points": 150, "penalty_per_time_band": 15}):
                rules["penalty_thresholds_seconds"][:] = [10, 20, 30]
                self.assertEqual(calculate_time_points("puzzle4", 9.5), 150)
                self.assertEqual(calculate_time_points("puzzle4", 10), 135)
                self.assertEqual(calculate_time_points("puzzle4", 30), 105)
        finally:
            rules["penalty_thresholds_seconds"][:] = original_thresholds
        self.assertEqual(calculate_time_points("puzzle4", 180), 90)

    def test_time_points_use_configured_keys_and_floor_at_zero(self):
        with patch.dict(SCORING_CONFIG, {"example": {
            "max_points": 25,
            "penalty_per_time_band": 15,
            "penalty_thresholds_seconds": [1, 2, 3],
        }}):
            for elapsed, expected in ((0, 25), (1, 10), (2, 0), (3, 0), (100, 0)):
                with self.subTest(elapsed=elapsed):
                    self.assertEqual(calculate_time_points("example", elapsed), expected)
            with patch.dict(SCORING_CONFIG["example"], {"penalty_thresholds_seconds": []}):
                self.assertEqual(calculate_time_points("example", 100), 25)
        self.assertNotIn("example", SCORING_CONFIG)

    def test_time_points_are_repeatable_and_do_not_mutate_configuration(self):
        original_config = deepcopy(SCORING_CONFIG)
        for elapsed in (480, 0, 240, 480):
            expected = {480: 40, 0: 100, 240: 80}[elapsed]
            self.assertEqual(calculate_time_points("puzzle4", elapsed), expected)
        self.assertEqual(SCORING_CONFIG, original_config)

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

    def test_puzzle6_scores_one_hundred_minus_ten_per_restart(self):
        self.assertEqual(SCORING_CONFIG["puzzle6"], {
            "max_points": 100,
            "penalty_per_error": 10,
        })
        for restart_count in range(13):
            with self.subTest(restart_count=restart_count):
                self.assertEqual(calculate_points("puzzle6", restart_count),
                                 max(0, 100 - 10 * restart_count))

    def test_unknown_puzzles_do_not_get_invented_scores(self):
        for function, args in ((calculate_points, ("undefined", 0)),
                       (calculate_time_points, ("undefined", 0)),
                       (get_max_attempts, ("undefined",))):
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