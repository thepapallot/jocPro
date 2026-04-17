from .puzzles.puzzle1 import Puzzle1
from .puzzles.puzzle2 import Puzzle2
from .puzzles.puzzle3 import Puzzle3
from .puzzles.puzzle4 import Puzzle4
from .puzzles.puzzle5 import Puzzle5
from .puzzles.puzzle6 import Puzzle6
from .puzzles.puzzle7 import Puzzle7
from .puzzles.puzzle8 import Puzzle8
from .puzzles.puzzle9 import Puzzle9
from .puzzles.puzzle10 import Puzzle10
from .puzzles.puzzle11 import Puzzle11
from .puzzles.puzzle12 import Puzzle12
from config import PUZZLE_FINAL, PUZZLE_TUTORIAL


PUZZLE_CLASSES = {
    1: Puzzle1,
    2: Puzzle2,
    3: Puzzle3,
    4: Puzzle4,
    5: Puzzle5,
    6: Puzzle6,
    7: Puzzle7,
    8: Puzzle8,
    9: Puzzle9,
    10: Puzzle10,
    11: Puzzle11,
    12: Puzzle12
}

def create_puzzles(mqtt_client, puzzle_order):
    """Create and register puzzles based on PUZZLE_ORDER"""
    puzzles = []
    registered_ids = []
    for puzzle_id in list(puzzle_order) + [PUZZLE_TUTORIAL, PUZZLE_FINAL]:
        if puzzle_id in registered_ids:
            continue
        registered_ids.append(puzzle_id)
        if puzzle_id in PUZZLE_CLASSES:
            puzzle = PUZZLE_CLASSES[puzzle_id](mqtt_client)
            mqtt_client.register_puzzle(puzzle)
            puzzles.append(puzzle)
    return puzzles