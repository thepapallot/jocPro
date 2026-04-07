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
from .puzzles.puzzleFinal import PuzzleFinal


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
    10: Puzzle10
}

def create_puzzles(mqtt_client, puzzle_order):
    """Create and register puzzles based on PUZZLE_ORDER"""
    puzzles = []
    for puzzle_id in puzzle_order:
        if puzzle_id in PUZZLE_CLASSES:
            puzzle = PUZZLE_CLASSES[puzzle_id](mqtt_client)
            mqtt_client.register_puzzle(puzzle)
            puzzles.append(puzzle)
    mqtt_client.register_puzzle(PuzzleFinal(mqtt_client))  # Register final puzzle with ID -1
    puzzles.append(PuzzleFinal)
    return puzzles