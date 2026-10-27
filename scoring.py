"""Shared, side-effect-free score calculation.

For attempt-based puzzles, errors is the number of failed attempts, not the
number of incorrect player submissions. The first attempt has zero errors.
"""

import math

from scoring_config import SCORING_CONFIG


def calculate_points(puzzle_id, errors):
    """Return the available/earned score, never below zero.

    Unknown puzzle keys raise KeyError instead of silently granting a score.
    """
    if isinstance(errors, bool) or not isinstance(errors, int) or errors < 0:
        raise ValueError("errors must be a non-negative integer")
    rules = SCORING_CONFIG[puzzle_id]
    return max(0, rules["max_points"] - rules["penalty_per_error"] * errors)


def get_max_attempts(puzzle_id):
    """Return the configured attempt limit for an attempt-based puzzle."""
    return SCORING_CONFIG[puzzle_id]["max_attempts"]


def calculate_time_points(puzzle_id, elapsed_seconds):
    """Subtract a penalty for each reached (>=) time threshold, floored at zero.

    Accept finite, non-negative int/float seconds, excluding bool. Unknown puzzle
    keys raise KeyError. Exhaustion is handled by the puzzle, not by this helper:
    Puzzles 2 and 4 still have 40 time-based points at their 600-second limit.
    """
    if (isinstance(elapsed_seconds, bool)
            or not isinstance(elapsed_seconds, (int, float))
            or elapsed_seconds < 0
            or (isinstance(elapsed_seconds, float) and not math.isfinite(elapsed_seconds))):
        raise ValueError("elapsed_seconds must be a finite non-negative int or float")
    rules = SCORING_CONFIG[puzzle_id]
    reached_bands = sum(elapsed_seconds >= threshold
                        for threshold in rules["penalty_thresholds_seconds"])
    return max(0, rules["max_points"] - rules["penalty_per_time_band"] * reached_bands)


def calculate_correct_points(puzzle_id, correct_count):
    """Score a timed quiz by correct questions, without an invented score cap."""
    if isinstance(correct_count, bool) or not isinstance(correct_count, int) or correct_count < 0:
        raise ValueError("correct_count must be a non-negative integer")
    return SCORING_CONFIG[puzzle_id]["points_per_correct"] * correct_count