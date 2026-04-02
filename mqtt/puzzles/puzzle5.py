from .base import BasePuzzle
import threading
import time

class Puzzle5(BasePuzzle):
    def __init__(self, mqtt_client):
        super().__init__(puzzle_id=5, mqtt_client=mqtt_client)
        
        # Round configuration
        self.round_objectives = {1: 10, 2: 30, 3: 60}  # Target times per round (seconds)
        self.round_limits = {1: 20, 2: 30, 3: 50}      # Maximum total error allowed per round
        
        # State
        self.current_round = 0
        self.round_times = {}  # round -> {player: error_time}
        self.active_round = False
        self.waiting = False
        self._round_start_timer = None
        
    def reset(self):
        """Full reset - identical to on_start"""
        super().reset()
        with self.lock:
            self.current_round = 0
            self.round_times = {}
            self.solved = False
            self.active_round = False
            self.waiting = True
            self._cancel_timer()
            
            # Push countdown message
            self._push({
                "countdown_message": "Ronda empieza en 10 segundos",
                "waiting_seconds": 10,
                "objective": self.round_objectives[1],
            })
            
            # Schedule round 1 start
            self._schedule_round_start(1, delay=10)
            
    def stop(self):
        """Cleanup on puzzle stop"""
        self._cancel_timer()
        with self.lock:
            self.active_round = False
            self.waiting = False
            
    def get_state(self):
        """Return current puzzle state"""
        with self.lock:
            round_number = self.current_round
            current_times = self.round_times.get(round_number, {})
            total = sum(abs(t) for t in current_times.values()) if current_times else 0
            limit = self.round_limits.get(round_number) if round_number else None
            objective = self.round_objectives.get(round_number) if round_number else None
            
            return {
                "puzzle_id": self.id,
                "round": round_number,
                "times": [{"player": p, "time": t} for p, t in sorted(current_times.items())],
                "total": total,
                "limit": limit,
                "objective": objective,
                "puzzle_solved": self.solved,
                "active_round": self.active_round,
                "waiting": self.waiting,
            }
            
    def handle_message(self, parts):
        """
        Handle MQTT message: P5,player,error_time
        
        Examples:
        - P5,3,-1.5  -> Player 3 finished 1.5 seconds early (10-1.5=8.5s total)
        - P5,7,3.35  -> Player 7 finished 3.35 seconds late (10+3.35=13.35s total)
        """
        if len(parts) < 3:
            return
            
        try:
            player = int(parts[1])
            error_time = float(parts[2])
        except ValueError:
            return
            
        with self.lock:
            # Ignore if puzzle solved, round not active, or still in initial countdown
            if self.solved or not self.active_round or self.current_round == 0:
                return
                
            times = self.round_times.setdefault(self.current_round, {})
            
            # Ignore duplicate player submissions
            if player in times:
                return
                
            # Store the error time (can be negative for early, positive for late)
            times[player] = error_time
            
            # Calculate total error using absolute values
            total = sum(abs(t) for t in times.values())
            limit = self.round_limits[self.current_round]
            
            # Push incremental update
            self._push({
                "round": self.current_round,
                "player_time": {"player": player, "time": error_time},
                "times": [{"player": p, "time": v} for p, v in sorted(times.items())],
                "total": total,
                "limit": limit
            })
            
            # If all 10 players have submitted, evaluate the round
            if len(times) >= 10:
                self._evaluate_round_locked()
                
    # --- Internal helpers ---
    
    def _cancel_timer(self):
        """Cancel any pending round start timer"""
        if self._round_start_timer:
            try:
                self._round_start_timer.cancel()
            except Exception:
                pass
            self._round_start_timer = None
            
    def _schedule_round_start(self, round_number, delay):
        """Schedule a round to start after delay seconds"""
        def _later():
            time.sleep(delay)
            with self.lock:
                if not self.solved:
                    self._start_round_locked(round_number)
                    
        self._round_start_timer = threading.Timer(0, _later)
        self._round_start_timer.start()
        
    def _start_round_locked(self, round_number):
        """Start a specific round"""
        self.current_round = round_number
        self.round_times[round_number] = {}
        self.active_round = True
        self.waiting = False
        
        # Send MQTT message to Arduino/hardware
        self.mqtt_client.send_message("FROM_FLASK", f"P5_Round{round_number}")
        
        # Push update to frontend
        self._push({
            "round": round_number,
            "round_start": True,
            "objective": self.round_objectives[round_number],
            "limit": self.round_limits[round_number]
        })
        
    def _evaluate_round_locked(self):
        """Evaluate round result after all players submit"""
        def _delayed_evaluation():
            # Wait 2 seconds with all boxes filled
            time.sleep(2)
            
            with self.lock:
                round_number = self.current_round
                times = self.round_times.get(round_number, {})
                
                # Calculate total error using absolute values
                total = sum(abs(t) for t in times.values())
                limit = self.round_limits[round_number]
                success = total <= limit
                
                self.active_round = False
                
                # Send result immediately (triggers green/red color)
                self._push({
                    "round": round_number,
                    "round_result": {
                        "success": success,
                        "total": total,
                        "limit": limit
                    }
                })
                
            # Wait 5 more seconds showing the colored result
            time.sleep(5)
            
            with self.lock:
                if success:
                    if round_number >= 3:
                        # Puzzle completed!
                        self.solved = True
                        self.mqtt_client.send_message("FROM_FLASK", "P5_End")
                        self._push({
                            "puzzle_solved": True
                        })
                    else:
                        # Schedule next round with 10-second countdown
                        self.waiting = True
                        next_round = round_number + 1
                        
                        self._push({
                            "countdown_message": f"Ronda {next_round} empieza en 10 segundos",
                            "waiting_seconds": 10,
                            "objective": self.round_objectives[next_round],
                        })
                        
                        self._schedule_round_start(next_round, delay=10)
                else:
                    # Failed - retry same round with 9-second countdown
                    self.round_times[round_number] = {}
                    self.waiting = True
                    
                    self._push({
                        "countdown_message": f"Ronda {round_number} reinicia en 9 segundos",
                        "waiting_seconds": 9,
                        "objective": self.round_objectives[round_number]
                    })
                    
                    self._schedule_round_start(round_number, delay=9)
                    
        # Run evaluation in separate thread to avoid blocking
        threading.Thread(target=_delayed_evaluation, daemon=True).start()