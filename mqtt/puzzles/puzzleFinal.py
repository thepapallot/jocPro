from .base import BasePuzzle
import threading
import random
import time

class PuzzleFinal(BasePuzzle):
    def __init__(self, mqtt_client):
        super().__init__(puzzle_id=-1, mqtt_client=mqtt_client)
        
        self.lock = threading.Lock()
        self.solved = False
        self.processing_wrong_result = False
        self.current_giff = 0
        self.current_streak = 0
        self.streaks = 4
        self.counters = [
            { "id": 1, "duration": 30, "num_giff": 5 },
            { "id": 2, "duration": 45, "num_giff": 5 },
            { "id": 3, "duration": 90, "num_giff": 5 },
            { "id": 4, "duration": 90, "num_giff": 5 }
        ]
        # box_states[box_id] = list of 6 ints (0/1), box_id 1-based
        self.box_states = {}
        self._solve_timer = None  # threading.Timer for 5-second confirmation

        #negre,verd,vermell,groc,blau,blanc
        self.botons = (((2,2,1,2,2,1),(2,1,2,1,2,2),(1,1,1,3,3,1),(2,1,3,2,1,1),(1,2,1,2,1,3)),
                        ((2,2,5,2,2,2),(2,3,4,2,3,1),(3,3,2,3,1,3),(1,1,3,4,4,2),(4,1,1,5,1,3)),
                        ((4,4,4,4,5,4),(4,3,5,2,6,5),(1,4,6,4,8,2),(6,2,2,8,4,3),(4,5,5,3,4,4)),
                        ((0,4,4,4,4,2),(0,3,6,5,2,2),(0,5,3,2,3,5),(0,3,5,6,2,2),(0,2,2,4,8,2)))

    def on_start(self):
        print("Starting Final Puzzle")
        with self.lock:
            self.current_streak = 1
            self.current_giff = self.get_giff()
            self.solved = False
            self._push({
                "puzzle_id": self.id,
                "startRound": True,
                "round": self.current_streak,
                "total_rounds": self.streaks,
                "num_giff": self.current_giff,
                "duration": self.counters[self.current_streak - 1]["duration"]
            })

    def reset(self):
        self.on_start()

    def handle_message(self, parts):
        # parts = ['P-1', '<box_id>', '<buttons_string>']
        if len(parts) < 3:
            return
        try:
            box_id = int(parts[1])
            btn_str = parts[2].strip()
            buttons = [int(c) for c in btn_str]  # e.g. '110010' -> [1,1,0,0,1,0]
        except (ValueError, IndexError):
            return

        with self.lock:
            if self.solved or self.processing_wrong_result:
                return

            self.box_states[box_id] = buttons

            # Sum each button position across all boxes
            totals = [0] * 6
            for state in self.box_states.values():
                for i, v in enumerate(state):
                    totals[i] += v

            print(f"Received box {box_id} state: {buttons}, Totals so far: {totals}")

            # Target: botons[streak_index][giff_index]
            streak_idx = self.current_streak - 1
            giff_idx = self.current_giff - 1
            target = list(self.botons[streak_idx][giff_idx])

            print(f"Totals: {totals}, Target: {target}")

            if totals == target:
                # Start 5-second confirmation timer if not already running
                if self._solve_timer is None:
                    self._solve_timer = threading.Timer(5.0, self._confirm_solved)
                    self._solve_timer.start()
                    print("Correct! Starting 5s confirmation timer.")
            else:
                # Cancel confirmation timer if state no longer matches
                if self._solve_timer is not None:
                    self._solve_timer.cancel()
                    self._solve_timer = None

    def _confirm_solved(self):
        with self.lock:
            self._push({
                    "puzzle_id": self.id,
                    "streak_solved": True,
                })
            self._solve_timer = None
            # Re-check in case state changed during the 5 seconds
            totals = [0] * 6
            for state in self.box_states.values():
                for i, v in enumerate(state):
                    totals[i] += v

            streak_idx = self.current_streak - 1
            giff_idx = self.current_giff - 1
            target = list(self.botons[streak_idx][giff_idx])

            if totals != target:
                print("State changed during confirmation, not solved.")
                return

            print(f"Streak {self.current_streak} solved!")

            if self.current_streak >= self.streaks:
                self.mqtt_client.send_message("FROM_FLASK", f"P{self.id}End")
                time.sleep(3)  # Brief pause before declaring puzzle solved
                self.solved = True
                self._push({
                    "puzzle_id": self.id,
                    "puzzle_solved": True
                })
            else:
                time.sleep(4)  # Brief pause before next round
                self.current_streak += 1
                self.current_giff = self.get_giff()
                if self.current_streak == 4:
                    self.mqtt_client.send_message("FROM_FLASK", f"P{self.id}Color{self.current_giff}")
                self.box_states = {}
                self._push({
                    "puzzle_id": self.id,
                    "startRound": True,
                    "round": self.current_streak,
                    "total_rounds": self.streaks,
                    "num_giff": self.current_giff,
                    "duration": self.counters[self.current_streak - 1]["duration"]
                })

    def get_state(self):
        with self.lock:
            return {
                "puzzle_id": self.id,
                "puzzle_solved": self.solved
            }

    def get_giff(self):
        num_giff = self.counters[self.current_streak-1]["num_giff"]
        choices = [i for i in range(1, num_giff + 1) if i != self.current_giff]
        self.current_giff = random.choice(choices)
        return self.current_giff
    
    def timer_expired(self):
        print("Final puzzle timer expired. Resetting current round.")
        with self.lock:
            if self.processing_wrong_result:
                return
            self.processing_wrong_result = True

            # Cancel solve confirmation timer if running
            if self._solve_timer is not None:
                self._solve_timer.cancel()
                self._solve_timer = None

            def _later():
                time.sleep(5)
                with self.lock:
                    self.current_giff = self.get_giff()
                    if self.current_streak == 4:
                        self.mqtt_client.send_message("FROM_FLASK", f"P{self.id}Color{self.current_giff}")
                    self.solved = False
                    self.processing_wrong_result = False
                    self.box_states = {}
                    self._push({
                        "puzzle_id": self.id,
                        "startRound": True,
                        "round": self.current_streak,
                        "total_rounds": self.streaks,
                        "num_giff": self.current_giff,
                        "duration": self.counters[self.current_streak - 1]["duration"]
                    })

            threading.Thread(target=_later, daemon=True).start()
