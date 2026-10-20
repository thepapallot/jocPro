from .base import BasePuzzle
from scoring import calculate_points
import threading
import random
import time

class Puzzle12(BasePuzzle):
    HELP_START_RESTART = 5

    def __init__(self, mqtt_client):
        super().__init__(puzzle_id=12, mqtt_client=mqtt_client)
        
        self.lock = threading.Lock()
        self.solved = False
        self.processing_wrong_result = False
        self.current_giff = 0
        self.active_streaks = [3]
        self.current_active_index = 0
        self.current_streak = self.active_streaks[self.current_active_index]
        self.streaks = len(self.active_streaks)
        self.counters = [
            { "id": 1, "duration": 30, "num_giff": 5 },
            { "id": 2, "duration": 45, "num_giff": 5 },
            { "id": 3, "duration": 90, "num_giff": 5 }
        ]
        # box_states[box_id] = list of 6 ints (0/1), box_id 1-based
        self.box_states = {}
        self.current_target = None
        self.timeout_count = 0
        self.total_points = 0
        self._solve_timer = None
        self._retry_timer = None
        self._generation = 0
        self._stopped = False

        #negre,verd,vermell,groc,blau,blanc
        # Each combination requires all ten terminals to hold one shared color.
        self.botons = (((10,2,5,2,2,2),(2,10,4,2,3,1),(3,3,10,3,1,3),(1,1,3,10,4,2),(4,1,1,5,10,3)),
                ((2,2,1,2,2,10),(10,1,2,1,2,2),(1,10,1,3,3,1),(2,1,10,2,1,1),(1,2,1,10,1,3)),
                ((4,4,4,4,10,4),(4,3,5,2,6,10),(10,4,6,4,8,2),(6,10,2,8,4,3),(4,5,10,3,4,4)))
                        #((0,4,4,4,4,2),(0,3,6,5,2,2),(0,5,3,2,3,5),(0,3,5,6,2,2),(0,2,2,4,8,2)))

    def _display_round(self):
        return self.current_active_index + 1

    def _set_active_round(self, index):
        self.current_active_index = index
        self.current_streak = self.active_streaks[index]

    def _prepare_target(self):
        self.current_giff = self.get_giff()
        self.current_target = list(self.botons[self.current_streak - 1][self.current_giff - 1])

    def _score_state(self):
        return {
            "timeout_count": self.timeout_count,
            "available_points": calculate_points("puzzle12", self.timeout_count),
            "total_points": self.total_points,
        }

    def _round_state(self):
        return {
            "puzzle_id": self.id,
            "round": self._display_round(),
            "total_rounds": self.streaks,
            "level_id": self.current_streak,
            "num_giff": self.current_giff,
            "target": self.current_target.copy() if self.current_target is not None else None,
            "duration": self.counters[self.current_streak - 1]["duration"],
            **self._score_state(),
        }

    def reset(self):
        print("Starting Puzzle 12")
        self.stop()
        super().reset()
        with self.lock:
            self._stopped = False
            self.processing_wrong_result = False
            self.timeout_count = 0
            self.total_points = 0
            self.box_states = {}
            self._set_active_round(0)
            self._prepare_target()
            self._push({**self._round_state(), "startRound": True})

    def handle_message(self, parts):
        # parts = ['P12', '<box_id>', '<buttons_string>']
        if len(parts) < 3:
            return
        try:
            box_id = int(parts[1])
            btn_str = parts[2].strip()
            buttons = [int(c) for c in btn_str]  # e.g. '110010' -> [1,1,0,0,1,0]
        except (ValueError, IndexError):
            return

        if not 1 <= box_id <= 10 or len(buttons) != 6 or any(v not in (0, 1) for v in buttons):
            return

        with self.lock:
            if self._stopped or self.solved or self.processing_wrong_result or self.current_target is None:
                return

            self.box_states[box_id] = buttons

            # Sum each button position across all boxes
            totals = [0] * 6
            for state in self.box_states.values():
                for i, v in enumerate(state):
                    totals[i] += v

            print(f"Received box {box_id} state: {buttons}, Totals so far: {totals}")

            target = self.current_target

            print(f"Totals: {totals}, Target: {target}")

            if totals == target:
                # Start 2-second confirmation timer if not already running
                if self._solve_timer is None:
                    self._solve_timer = threading.Timer(2.0, self._confirm_solved,
                                                        args=(self._generation,))
                    self._solve_timer.start()
                    print("Correct! Starting 2s confirmation timer.")
            else:
                # Cancel confirmation timer if state no longer matches
                if self._solve_timer is not None:
                    self._solve_timer.cancel()
                    self._solve_timer = None
                    self._generation += 1

    def _confirm_solved(self, generation):
        with self.lock:
            if (generation != self._generation or self._stopped or self.solved
                    or self.processing_wrong_result or self.current_target is None):
                return
            self._solve_timer = None
            # Re-check before publishing success.
            totals = [0] * 6
            for state in self.box_states.values():
                for i, v in enumerate(state):
                    totals[i] += v

            target = self.current_target

            if totals != target:
                print("State changed during confirmation, not solved.")
                return

            print(f"Streak {self.current_streak} solved!")
            self._push({"puzzle_id": self.id, "streak_solved": True})

            if self.current_active_index >= self.streaks - 1 or self.saltarPuzzle:
                self.mqtt_client.send_message("FROM_FLASK", f"P{self.id}End")
                time.sleep(3)  # Brief pause before declaring puzzle solved
                self.solved = True
                self.total_points = calculate_points("puzzle12", self.timeout_count)
                self._push({
                    "puzzle_id": self.id,
                    "puzzle_solved": True,
                    **self._score_state(),
                })
            else:
                time.sleep(4)  # Brief pause before next round
                self._set_active_round(self.current_active_index + 1)
                self.mqtt_client.start_next_round(self.id, self.current_streak)
                self._prepare_target()
                if self.current_streak == 4:
                    self.mqtt_client.send_message("FROM_FLASK", f"P{self.id}Color{self.current_giff}")
                self.box_states = {}
                self._push({**self._round_state(), "startRound": True})

    def get_state(self):
        with self.lock:
            return {
                **self._round_state(),
                "puzzle_solved": self.solved,
                "box_states": self.box_states.copy()
            }

    def get_giff(self):
        num_giff = self.counters[self.current_streak-1]["num_giff"]
        choices = [i for i in range(1, num_giff + 1) if i != self.current_giff]
        self.current_giff = random.choice(choices)
        return self.current_giff
    
    def timer_expired(self):
        print("Final puzzle timer expired. Resetting current round.")
        with self.lock:
            if self._stopped or self.solved or self.processing_wrong_result or self.current_target is None:
                return
            self.processing_wrong_result = True
            self.timeout_count += 1
            self._generation += 1
            generation = self._generation

            # Cancel solve confirmation timer if running
            if self._solve_timer is not None:
                self._solve_timer.cancel()
                self._solve_timer = None

            self._retry_timer = threading.Timer(5.0, self._restart_round, args=(generation,))
            self._retry_timer.start()

    def _restart_round(self, generation):
        with self.lock:
            if generation != self._generation or self._stopped or not self.processing_wrong_result:
                return
            self._retry_timer = None
            if self.timeout_count >= self.HELP_START_RESTART:
                self.current_target = [count if count == 10 else max(1, count - 1)
                                       for count in self.current_target]
            else:
                self._prepare_target()
            self.processing_wrong_result = False
            self.box_states = {}
            self._push({**self._round_state(), "startRound": True})

    def stop(self):
        with self.lock:
            self._stopped = True
            self._generation += 1
            for timer in (self._solve_timer, self._retry_timer):
                if timer is not None:
                    timer.cancel()
            self._solve_timer = None
            self._retry_timer = None
