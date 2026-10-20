"""Scoring rules for puzzles whose scoring has been defined.

Do not add placeholder scores for other puzzles: each rule must be agreed first.
Timing and gameplay rules belong in the puzzle classes, not in this file.
"""

SCORING_CONFIG = {
    "puzzle1": {
        "max_points": 100,
        "penalty_per_error": 3,
        "max_attempts": 30,
    },
    "puzzle3": {
        "points_per_correct": 10,
        "penalty_per_error": 0,
    },
    "puzzle5": {
        "max_points": 100,
        "penalty_per_error": 10,
        "max_attempts": 10,
    },
    "puzzle8": {
        "max_points": 100,
        "penalty_per_error": 10,
        "max_attempts": 10,
    },
}