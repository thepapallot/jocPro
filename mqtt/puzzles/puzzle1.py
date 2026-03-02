from .base import BasePuzzle
import threading
import time
import random

class Puzzle1(BasePuzzle):
    def __init__(self, mqtt_client):
        super().__init__(puzzle_id=1, mqtt_client=mqtt_client)
        self.suma_results_pool = [
            5, 6, 7, 8, 9, 30, 32, 33, 34, 41, 42, 43, 44, 10, 11, 12, 
            28, 29, 31, 35, 36, 37, 38, 39, 40, 13, 15, 16, 27, 14, 17, 
            24, 25, 26, 18, 20, 21, 23, 22
        ]
        self.operations_with_metadata = []
        self.processing_wrong_result = False
        self.round = 1
        self.round_sizes = {1: 4, 2: 7, 3: 15}
        
    def _reset_operations(self, size=None):
        """Generate random operations for current round"""
        size = size or self.round_sizes[self.round]
        self.operations_with_metadata = [
            [result, index + 1, "N"]
            for index, result in enumerate(random.sample(self.suma_results_pool, size))
        ]
        
    def reset(self):
        """Full reset returns to round 1"""
        super().reset()
        with self.lock:
            self.round = 1
            self._reset_operations()
            self.processing_wrong_result = False
            self._push({
                "operations": self.operations_with_metadata.copy(),
                "start_timer": True,
                "round": self.round
            })
            
    def on_start(self):
        """Called when puzzle becomes active"""
        with self.lock:
            self.round = 1
            self._reset_operations()
            self.processing_wrong_result = False
            self._push({
                "operations": self.operations_with_metadata.copy(),
                "round": self.round,
                "start_timer": True
            })
            
    def stop(self):
        """Cleanup on puzzle stop"""
        with self.lock:
            self.processing_wrong_result = False
            
    def get_state(self):
        """Return current puzzle state"""
        with self.lock:
            return {
                "puzzle_id": self.id,
                "operations": self.operations_with_metadata.copy(),
                "round": self.round
            }
            
    def handle_message(self, parts):
        """Handle MQTT message: P1,a,b"""
        if len(parts) < 3:
            return
        try:
            a, b = map(int, parts[1:3])
        except ValueError:
            return
        self._check_sum_or_reset(a, b)
        
    def _check_sum_or_reset(self, a, b):
        """Validate sum and update state"""
        with self.lock:
            if self.processing_wrong_result:
                return
                
            result = a + b
            
            # Check if result matches any unsolved operation
            for op in self.operations_with_metadata:
                if op[0] == result and op[2] == "N":
                    op[2] = "Y"
                    solved_text = f"{a} + {b} = {result}"
                    
                    self._push({
                        "operations": self.operations_with_metadata.copy(),
                        "solved": {"result": result, "text": solved_text},
                        "round": self.round
                    })
                    
                    # Check if round is complete
                    if all(o[2] == "Y" for o in self.operations_with_metadata):
                        if self.round < 3:
                            # Advance to next round with countdown
                            next_round = self.round + 1
                            
                            # Notify streak completion
                            self._push({
                                "streak_completed": True,
                                "round": self.round,
                                "next_round": next_round
                            })
                            
                            def _countdown_and_advance():
                                time.sleep(3)  # Show last solved message
                                
                                # Countdown 5..1
                                for sec in range(5, 0, -1):
                                    self._push({
                                        "countdown_next_round": {"seconds": sec},
                                        "round": self.round,
                                        "next_round": next_round
                                    })
                                    time.sleep(1)
                                    
                                # Start next round
                                with self.lock:
                                    self.round = next_round
                                    self.processing_wrong_result = False
                                    self._reset_operations()
                                    self._push({
                                        "operations": self.operations_with_metadata.copy(),
                                        "round": self.round,
                                        "round_start": True,
                                        "start_timer": True
                                    })
                                    
                            threading.Thread(target=_countdown_and_advance, daemon=True).start()
                        else:
                            # Puzzle complete
                            self.solved = True
                            self.mqtt_client.send_message("FROM_FLASK", f"P{self.id}End")
                            self._push({
                                "puzzle_solved": True,
                                "round": self.round
                            })
                    return
                    
            # Incorrect answer
            self.processing_wrong_result = True
            self._push({
                "operations": self.operations_with_metadata.copy(),
                "incorrect": {"result": result, "text": f"{a} + {b} = {result}"},
                "round": self.round
            })
            threading.Thread(target=self._delayed_reset, daemon=True).start()
            
    def _delayed_reset(self):
        """Reset operations after wrong answer"""
        time.sleep(3)
        with self.lock:
            self.processing_wrong_result = False
            self._reset_operations()
            self._push({
                "operations": self.operations_with_metadata.copy(),
                "round": self.round,
                "start_timer": True
            })
            
    def timer_expired(self):
        """Handle timer expiration - reset current round only"""
        with self.lock:
            if self.processing_wrong_result:
                return
            self.processing_wrong_result = True
            
        def _later():
            time.sleep(5)  # Show timeout message
            with self.lock:
                self._reset_operations()
                self.processing_wrong_result = False
                self._push({
                    "operations": self.operations_with_metadata.copy(),
                    "round": self.round,
                    "start_timer": True
                })
                
        threading.Thread(target=_later, daemon=True).start()