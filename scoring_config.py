"""Scoring rules for puzzles whose scoring has been defined.

Do not add placeholder scores for other puzzles: each rule must be agreed first.
Timing and gameplay rules belong in the puzzle classes, not in this file.
"""

SCORING_CONFIG = {
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