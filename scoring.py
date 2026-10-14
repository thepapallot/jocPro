"""Shared, side-effect-free score calculation.

For attempt-based puzzles, errors is the number of failed attempts, not the
number of incorrect player submissions. The first attempt has zero errors.
"""

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