"""Scoring rules for puzzles whose scoring has been defined.

Do not add placeholder scores for other puzzles: each rule must be agreed first.
Timing and gameplay execution belong in the puzzle classes; agreed scoring
parameters and their associated limits live here.
"""

SCORING_CONFIG = {
    "puzzle1": {
        "max_points": 100,
        "penalty_per_error": 3,
        "max_attempts": 30,
    },
    "puzzle3": {
        "points_per_correct": 10,
        "golden_multiplier": 2,
        "penalty_per_error": 0,
    },
    "puzzle4": {
        "max_points": 100,
        "penalty_per_time_band": 10,
        # Seconds from music start, shared by one or two rounds. Each reached
        # threshold subtracts one penalty (3:00 -> 90, 4:00 -> 80, ..., 8:00 -> 40).
        "penalty_thresholds_seconds": [180, 240, 300, 360, 420, 480],
        # Unsolved at 10:00 ends with exhaustion_points, not the last time band.
        "max_time_seconds": 600,
        "exhaustion_points": 0,
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
    "puzzle12": {
        "max_points": 100,
        "penalty_per_error": 10,
    },
}