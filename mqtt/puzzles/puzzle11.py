from .base import BasePuzzle
import random

class Puzzle11(BasePuzzle):
    def __init__(self, mqtt_client):
        super().__init__(puzzle_id=10, mqtt_client=mqtt_client)


    def reset(self):
        super().reset()
        with self.lock:
            self._push({
                "puzzle_solved": False
            })

    def handle_message(self, parts):
        # Expect: P11,box,code
        
        with self.lock:
            if self.solved:
                return

            
    def get_state(self):
        with self.lock:
            return {
                "puzzle_id": self.id,
            }

    def timer_expired(self):
        with self.lock:
            if self.solved:
                return
