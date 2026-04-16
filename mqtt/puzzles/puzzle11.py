from .base import BasePuzzle

STEPS_TOTAL = 10
STEP_SEQUENCES = [
    [(6, 5, -1), (6, -1, 5)],
    [(2, 10, -1), (5, 10, -1)],
    [(2, 13, -1), (2, 13, -1), (2, 13, -1)],
    [(1, 14, -1), (1, -1, 1), (1, -1, 5), (1, -1, 2)],
    [(1, 17, -1), (2, 17, -1), (3, 17, -1)],
    [(9, 18, -1), (9, -1, 4), (9, -1, 4)],
    [(0, 20, -1)],
    [(3, 22, -1), (4, 22, -1), (4, -1, 2)],
    [(7, 31, -1), (7, 31, -1), (7, -1, 1)],
    [(8, 35, -1)],
]

class Puzzle11(BasePuzzle):
    def __init__(self, mqtt_client):
        super().__init__(puzzle_id=11, mqtt_client=mqtt_client)
        self.current_step = 0
        self.current_substep = 0
        self.completed_steps = []
        self.event_count = 0
        self.substep_success_count = 0
        self.step_completion_count = 0

    def reset(self):
        super().reset()
        with self.lock:
            self.current_step = 0
            self.current_substep = 0
            self.completed_steps = []
            self.event_count = 0
            self.substep_success_count = 0
            self.step_completion_count = 0
            self._push({
                "current_step": self.current_step,
                "current_substep": self.current_substep,
                "completed_steps": list(self.completed_steps),
                "puzzle_solved": False,
                "event_count": self.event_count,
                "substep_success_count": self.substep_success_count,
                "step_completion_count": self.step_completion_count,
            })

    def handle_message(self, parts):
        # Expect: P11,box,token,color
        if len(parts) < 4:
            return

        try:
            box = int(parts[1])
            token = int(parts[2])
            color = int(parts[3])
        except ValueError:
            return

        with self.lock:
            if self.solved:
                return

            self.event_count += 1

            if self.current_step >= STEPS_TOTAL:
                return

            current_sequence = STEP_SEQUENCES[self.current_step]
            expected = current_sequence[self.current_substep]
            received = (box, token, color)

            if received != expected:
                # Incorrect input in the middle is ignored without reset.
                return

            self.current_substep += 1
            self.substep_success_count += 1

            step_completed = self.current_substep >= len(current_sequence)
            if step_completed:
                self.completed_steps.append(self.current_step)
                self.current_step += 1
                self.current_substep = 0
                self.step_completion_count += 1

            if self.current_step >= STEPS_TOTAL:
                self.solved = True
                self.mqtt_client.send_message("FROM_FLASK", f"P{self.id}End")
                self._push({
                    "current_step": self.current_step,
                    "current_substep": self.current_substep,
                    "completed_steps": list(self.completed_steps),
                    "puzzle_solved": True,
                    "event_count": self.event_count,
                    "substep_success_count": self.substep_success_count,
                    "step_completion_count": self.step_completion_count,
                })
            else:
                self._push({
                    "current_step": self.current_step,
                    "current_substep": self.current_substep,
                    "completed_steps": list(self.completed_steps),
                    "puzzle_solved": False,
                    "event_count": self.event_count,
                    "substep_success_count": self.substep_success_count,
                    "step_completion_count": self.step_completion_count,
                })

    def get_state(self):
        with self.lock:
            return {
                "puzzle_id": self.id,
                "current_step": self.current_step,
                "current_substep": self.current_substep,
                "completed_steps": list(self.completed_steps),
                "puzzle_solved": self.solved,
                "event_count": self.event_count,
                "substep_success_count": self.substep_success_count,
                "step_completion_count": self.step_completion_count,
            }

    def timer_expired(self):
        pass
