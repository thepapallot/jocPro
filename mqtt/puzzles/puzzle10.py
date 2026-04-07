from .base import BasePuzzle
import random

class Puzzle10(BasePuzzle):
    def __init__(self, mqtt_client):
        super().__init__(puzzle_id=10, mqtt_client=mqtt_client)

        # Box codes are 3-color segments encoded as digits.
        # Color table: red=0, blue=1, purple=2, yellow=3, green=4
        self.solution_codes = {
            0: "042",  # red, green, purple
            1: "414",  # green, blue, green
            2: "323",  # yellow, purple, yellow
            3: "104",  # blue, red, green
            4: "033",  # red, yellow, yellow
            5: "431",  # green, yellow, blue
            6: "104",  # blue, red, green
            7: "222",  # purple, purple, purple
            8: "110",  # blue, blue, red
            9: "423",  # green, purple, yellow
        }

        # Round duration source of truth for frontend timer (seconds).
        self.round_seconds = 60

        self.solved_boxes = set()
        self.current_codes = self.solution_codes.copy()

    def reset(self):
        super().reset()
        with self.lock:
            self.solved_boxes = set()
            self.solved = False
            self.current_codes = self.solution_codes.copy()
            self._push({
                "solved_boxes": sorted(self.solved_boxes),
                "box_targets": self.current_codes.copy(),
                "round_seconds": self.round_seconds,
                "puzzle_solved": False
            })

    def handle_message(self, parts):
        # Expect: P10,box,code (e.g. P10,3,213)
        if len(parts) < 3:
            return

        try:
            box = int(parts[1])
        except ValueError:
            return

        if not (0 <= box <= 9):
            return

        code = parts[2].strip()

        with self.lock:
            if self.solved:
                return

            if box in self.solved_boxes:
                return

            expected = self.current_codes.get(box)
            if expected is None:
                return

            if code != expected:
                return

            self.solved_boxes.add(box)

            self._push({
                "solved_box": box,
                "solved_boxes": sorted(self.solved_boxes)
            })

            if len(self.solved_boxes) >= 10:
                self.solved = True
                self.mqtt_client.send_message("FROM_FLASK", f"P{self.id}End")
                self._push({
                    "puzzle_solved": True,
                    "solved_boxes": sorted(self.solved_boxes)
                })

    def get_state(self):
        with self.lock:
            return {
                "puzzle_id": self.id,
                "solved_boxes": sorted(self.solved_boxes),
                "box_targets": self.current_codes.copy(),
                "round_seconds": self.round_seconds,
                "puzzle_solved": self.solved
            }

    def timer_expired(self):
        with self.lock:
            if self.solved:
                return

            self._reshuffle_unsolved_locked()
            self._push({
                "solved_boxes": sorted(self.solved_boxes),
                "box_targets": self.current_codes.copy(),
                "round_seconds": self.round_seconds,
                "reshuffled": True
            })

    def _reshuffle_unsolved_locked(self):
        unsolved_boxes = [b for b in self.current_codes.keys() if b not in self.solved_boxes]
        if len(unsolved_boxes) <= 1:
            return

        unsolved_codes = [self.current_codes[b] for b in unsolved_boxes]
        random.shuffle(unsolved_codes)
        for box, code in zip(unsolved_boxes, unsolved_codes):
            self.current_codes[box] = code