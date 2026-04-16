from .base import BasePuzzle

STEPS_TOTAL = 10

class Puzzle11(BasePuzzle):
    def __init__(self, mqtt_client):
        super().__init__(puzzle_id=11, mqtt_client=mqtt_client)
        self.current_step = 0
        self.completed_steps = []
        self.event_count = 0

    def reset(self):
        super().reset()
        with self.lock:
            self.current_step = 0
            self.completed_steps = []
            self.event_count = 0
            self._push({
                "current_step": self.current_step,
                "completed_steps": list(self.completed_steps),
                "puzzle_solved": False,
                "event_count": self.event_count,
            })

    def handle_message(self, parts):
        # Expect: P11,step_index (0-based)
        if len(parts) < 2:
            return
        try:
            step = int(parts[1])
        except ValueError:
            return

        with self.lock:
            if self.solved:
                return

            self.event_count += 1

            if step != self.current_step:
                self._push({
                    "current_step": self.current_step,
                    "completed_steps": list(self.completed_steps),
                    "puzzle_solved": False,
                    "event_count": self.event_count,
                })
                return

            self.completed_steps.append(step)
            self.current_step += 1

            if self.current_step >= STEPS_TOTAL:
                self.solved = True
                self.mqtt_client.send_message("FROM_FLASK", f"P{self.id}End")
                self._push({
                    "current_step": self.current_step,
                    "completed_steps": list(self.completed_steps),
                    "puzzle_solved": True,
                    "event_count": self.event_count,
                })
            else:
                self._push({
                    "current_step": self.current_step,
                    "completed_steps": list(self.completed_steps),
                    "puzzle_solved": False,
                    "event_count": self.event_count,
                })

    def get_state(self):
        with self.lock:
            return {
                "puzzle_id": self.id,
                "current_step": self.current_step,
                "completed_steps": list(self.completed_steps),
                "puzzle_solved": self.solved,
                "event_count": self.event_count,
            }

    def timer_expired(self):
        pass
