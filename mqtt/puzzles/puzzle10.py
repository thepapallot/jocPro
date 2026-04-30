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
            3: "204",  # purple, red, green
            4: "033",  # red, yellow, yellow
            5: "431",  # green, yellow, blue
            6: "140",  # blue, green, red
            7: "222",  # purple, purple, purple
            8: "110",  # blue, blue, red
            9: "423",  # green, purple, yellow
            10: "333",  # yellow, yellow, yellow
            11: "443",  # green, green, yellow
            12: "020",  # red, purple, red
            13: "410",  # green, blue, red
            14: "324",  # yellow, purple, green
            15: "141",  # blue, green, blue
            16: "024",  # red, purple, green
            17: "113",  # blue, blue, yellow
            18: "324",  # yellow, purple, green
            19: "440",  # green, green, red

        }

        # Round duration source of truth for frontend timer (seconds).
        self.round_seconds = 90
        self.box_ids = list(range(10))
        self.code_pool = list(self.solution_codes.values())
        self.initial_box_codes = {box: self.solution_codes[box] for box in self.box_ids}

        self.solved_boxes = set()
        self.current_codes = self.initial_box_codes.copy()
        self.used_unsolved_combinations = {}

    def reset(self):
        super().reset()
        with self.lock:
            self.solved_boxes = set()
            self.solved = False
            self.current_codes = self.initial_box_codes.copy()
            self.used_unsolved_combinations = {}
            self._remember_current_unsolved_combination()
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
            self.mqtt_client.send_message("FROM_FLASK", f"P10Solved{box}")

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
        unsolved_boxes = [b for b in self.box_ids if b not in self.solved_boxes]
        if len(unsolved_boxes) == 0:
            return

        solved_codes = {self.current_codes[b] for b in self.solved_boxes if b in self.current_codes}
        available_pool = [code for code in self.code_pool if code not in solved_codes]
        if len(available_pool) < len(unsolved_boxes):
            return

        unsolved_boxes = tuple(unsolved_boxes)
        used_for_this_unsolved_set = self.used_unsolved_combinations.setdefault(unsolved_boxes, set())
        used_for_this_unsolved_set.add(tuple(self.current_codes[b] for b in unsolved_boxes))

        attempts = 0
        max_attempts = 5000
        while attempts < max_attempts:
            attempts += 1
            sampled_codes = random.sample(available_pool, len(unsolved_boxes))
            candidate = tuple(sampled_codes)
            if any(candidate[i] == self.current_codes[box] for i, box in enumerate(unsolved_boxes)):
                continue
            if candidate in used_for_this_unsolved_set:
                continue

            for box, code in zip(unsolved_boxes, candidate):
                self.current_codes[box] = code
            used_for_this_unsolved_set.add(candidate)
            return

    def _remember_current_unsolved_combination(self):
        unsolved_boxes = tuple(b for b in self.box_ids if b not in self.solved_boxes)
        if len(unsolved_boxes) == 0:
            return

        used_for_this_unsolved_set = self.used_unsolved_combinations.setdefault(unsolved_boxes, set())
        used_for_this_unsolved_set.add(tuple(self.current_codes[b] for b in unsolved_boxes))