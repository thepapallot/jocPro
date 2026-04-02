from .base import BasePuzzle
import threading
import time

class Puzzle9(BasePuzzle):
    def __init__(self, mqtt_client):
        super().__init__(puzzle_id=9, mqtt_client=mqtt_client)
        
        self.lock = threading.Lock()
        self.box_tokens = {i: None for i in range(0,10)}
        self.solution = {
            1: 6, 2: 3, 3: 7, 4: 0, 5: 8,
            6: 4, 7: 2, 8: 1, 9: 9, 0: 5
        } ## 0->5, 1->10, 2->13, 3->14, 4->17, 5->18, 6->20, 7->22, 8->31, 9->35  
        self.solved = False
        self._good_timer_running = False

    def reset(self):
        with self.lock:
            self.box_tokens = {i: None for i in range(0,10)}
            self.solved = False
            self._good_timer_running = False
            self._push({
                "box_tokens": self.box_tokens.copy(),
                "status": "start",
                "puzzle_solved": False
            })

    def handle_message(self, parts):
        # Expect: P9,box,token  (token -1 means empty)
        if len(parts) < 3:
            return
        try:
            box = int(parts[1])
            token = int(parts[2])
        except ValueError:
            return
        if not (0 <= box <= 9):  # CHANGED
            return

        with self.lock:
            if self.solved:
                return

            previous_token = self.box_tokens[box]
            new_token = None if token == -1 else token
            self.box_tokens[box] = new_token
            status = self._compute_status_locked()

            play_sound = not (new_token is None and previous_token is not None)

            self._push({
                "box_update": {"box": box, "token": self.box_tokens[box]},
                "playsound": play_sound,
                "boxes": self.box_tokens.copy(),
                "status": status
            })

            if status == "good" and not self._good_timer_running:
                self._good_timer_running = True
                threading.Thread(target=self._finish_after_delay, daemon=True).start()

    def get_state(self):
        with self.lock:
            return {
                "puzzle_id": self.id,
                "boxes": self.box_tokens.copy(),
                "status": self._compute_status_locked(),
                "puzzle_solved": self.solved
            }
        
    # --- helpers ---

    def _compute_status_locked(self):
        any_token = any(v is not None for v in self.box_tokens.values())
        all_filled = all(v is not None for v in self.box_tokens.values())
        if not any_token:
            return "start"
        if not all_filled:
            return "half"
        # all filled:
        correct = all(self.box_tokens[b] == t for b, t in self.solution.items())
        return "good" if correct else "wrong"

    def _finish_after_delay(self):
        time.sleep(3)
        with self.lock:
            # Re-check (players could have changed tokens during the 5s)
            if self.solved:
                return
            if self._compute_status_locked() != "good":
                self._good_timer_running = False
                return
            self.solved = True

        self.mqtt_client.send_message("FROM_FLASK", f"P{self.id}End")
        self._push({
            "puzzle_solved": True,
            "status": "good"
        })