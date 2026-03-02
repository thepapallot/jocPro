from .base import BasePuzzle
import threading
import time
import random

class Puzzle2(BasePuzzle):
    def __init__(self, mqtt_client):
        super().__init__(puzzle_id=2, mqtt_client=mqtt_client)
        
        # Predefined sequences per player (1..10)
        self.sequences = {
            1: [5, 0, 9, 6, 2],
            2: [4, 3, 9, 0, 7],
            3: [8, 1, 7, 2, 4],
            4: [0, 4, 8, 1, 3],
            5: [6, 7, 8, 4, 9],
            6: [3, 5, 1, 9, 0],
            7: [2, 6, 3, 7, 8],
            8: [9, 2, 5, 7, 1],
            9: [0, 8, 2, 5, 6],
            10: [1, 4, 6, 3, 5]
        }
        
        # Alarm mode remapping
        self.alarmChanges = {
            0: 2, 1: 3, 2: 0, 3: 1, 4: 5,
            5: 4, 6: 8, 7: 9, 8: 6, 9: 7
        }
        
        self.progress = {p: 0 for p in self.sequences.keys()}
        self.alarm_mode = False
        self.alarm_timer = None
        self.input_blocked = False
        self.block_until = 0
        
    def _snapshot(self):
        """Return player progress snapshot"""
        return [
            {"player": p, "progress": self.progress[p], "total": 5}
            for p in sorted(self.progress.keys())
        ]
        
    def reset(self):
        """Full reset of puzzle"""
        super().reset()
        with self.lock:
            self.progress = {p: 0 for p in self.sequences.keys()}
            self.alarm_mode = False
            self.input_blocked = False
            self.block_until = 0
            
            if self.alarm_timer:
                print(f"[Puzzle2] Cancelling existing alarm timer")
                self.alarm_timer.cancel()
                self.alarm_timer = None
                
            self._push({
                "players": self._snapshot(),
                "alarm_mode": False
            })
            
            # Schedule new alarm
            alarm_delay = random.randint(120, 240)
            print(f"[Puzzle2] Rescheduling alarm mode in {alarm_delay} seconds after reset")
            self.alarm_timer = threading.Timer(alarm_delay, self._enter_alarm_mode)
            self.alarm_timer.start()
            
    def on_start(self):
        """Called when puzzle becomes active"""
        with self.lock:
            self.progress = {p: 0 for p in self.sequences.keys()}
            self.alarm_mode = False
            self.input_blocked = False
            
            if self.alarm_timer:
                self.alarm_timer.cancel()
                self.alarm_timer = None
                
            self._push({
                "players": self._snapshot(),
                "alarm_mode": False
            })
            
            # Schedule alarm with random delay 2-4 minutes
            alarm_delay = random.randint(120, 240)
            print(f"[Puzzle2] Scheduling alarm mode in {alarm_delay} seconds")
            self.alarm_timer = threading.Timer(alarm_delay, self._enter_alarm_mode)
            self.alarm_timer.start()
            
    def stop(self):
        """Cleanup on puzzle stop"""
        with self.lock:
            if self.alarm_timer:
                try:
                    self.alarm_timer.cancel()
                except Exception:
                    pass
                self.alarm_timer = None
            self.input_blocked = False
            self.alarm_mode = False
            
    def get_state(self):
        """Return current puzzle state"""
        with self.lock:
            return {
                "puzzle_id": self.id,
                "players": self._snapshot(),
                "alarm_mode": self.alarm_mode
            }
            
    def _enter_alarm_mode(self):
        """Enter alarm mode - play sound and switch symbol mapping"""
        # Check if still active puzzle
        if self.mqtt_client.current_puzzle_id != self.id:
            print(f"[Puzzle2] Not current puzzle, cancelling alarm entry")
            return
            
        print(f"[Puzzle2] Playing alarm sound and blocking input for 5s")
        with self.lock:
            self.input_blocked = True
            self.block_until = time.time() + 5
            
            # Play alarm sound
            self._push({
                "play_alarm_sound": {
                    "url": "/static/audios/effects/canvi_laberint.wav"
                }
            })
            
        # Activate alarm mode after 5s
        def _later():
            time.sleep(5)
            with self.lock:
                self.alarm_mode = True
                self.input_blocked = False
                print(f"[Puzzle2] Alarm mode ACTIVE, pushing update to frontend")
                
                self._push({"alarm_mode": True})
                
                # Schedule exit after 60-150s
                alarm_duration = random.randint(60, 150)
                print(f"[Puzzle2] Scheduling alarm exit in {alarm_duration} seconds")
                self.alarm_timer = threading.Timer(alarm_duration, self._exit_alarm_mode)
                self.alarm_timer.start()
                
        threading.Thread(target=_later, daemon=True).start()
        
    def _exit_alarm_mode(self):
        """Exit alarm mode - play sound and revert mapping"""
        if self.mqtt_client.current_puzzle_id != self.id:
            print(f"[Puzzle2] Not current puzzle, cancelling alarm exit")
            return
            
        print(f"[Puzzle2] Playing normal sound and blocking input for 5s")
        with self.lock:
            self.input_blocked = True
            self.block_until = time.time() + 5
            
            self._push({
                "play_normal_sound": {
                    "url": "/static/audios/effects/canvi_laberint.wav"
                }
            })
            
        # Deactivate alarm mode after 5s
        def _later():
            time.sleep(5)
            with self.lock:
                self.alarm_mode = False
                self.input_blocked = False
                print(f"[Puzzle2] Alarm mode INACTIVE, pushing update to frontend")
                
                self._push({"alarm_mode": False})
                
                # Schedule next alarm entry after 120-240s
                alarm_delay = random.randint(120, 240)
                print(f"[Puzzle2] Scheduling next alarm mode in {alarm_delay} seconds")
                self.alarm_timer = threading.Timer(alarm_delay, self._enter_alarm_mode)
                self.alarm_timer.start()
                
        threading.Thread(target=_later, daemon=True).start()
        
    def handle_message(self, parts):
        """Handle MQTT message: P2,player,symbol"""
        if len(parts) < 3:
            return
            
        try:
            player = int(parts[1])
            symbol = int(parts[2])
        except ValueError:
            return
            
        with self.lock:
            # Block input during transition
            if self.input_blocked and time.time() < self.block_until:
                print(f"[Puzzle2] Input blocked, ignoring message from player {player}")
                return
                
            # Ignore if already solved
            if all(v >= 5 for v in self.progress.values()):
                return
                
            if player not in self.sequences:
                return
                
            current_index = self.progress[player]
            
            # Ignore already finished players
            if current_index >= 5:
                return
                
            # Get expected symbol (with alarm mapping if active)
            expected_raw = self.sequences[player][current_index]
            expected = self.alarmChanges.get(expected_raw, expected_raw) if self.alarm_mode else expected_raw
            
            if symbol == expected:
                # Correct symbol
                self.progress[player] += 1
                
                self._push({
                    "player_update": {
                        "player": player,
                        "progress": self.progress[player],
                        "total": 5
                    }
                })
                
                # Check if puzzle complete
                if all(v >= 5 for v in self.progress.values()):
                    # Cancel alarm timer
                    if self.alarm_timer:
                        self.alarm_timer.cancel()
                        self.alarm_timer = None
                        
                    self.solved = True
                    self.mqtt_client.send_message("FROM_FLASK", f"P{self.id}End")
                    self._push({"puzzle_solved": True})
                    
            else:
                # Wrong symbol - reset all non-finished players
                for p in self.progress:
                    if self.progress[p] < 5:
                        self.progress[p] = 0
                        
                # Block input during error animation (4 seconds)
                self.input_blocked = True
                self.block_until = time.time() + 4
                
                self._push({
                    "players": self._snapshot(),
                    "error_reset": {
                        "player": player,
                        "symbol": symbol,
                        "expected": expected
                    }
                })
                
                # Unblock after 4 seconds
                def _unblock_later():
                    time.sleep(4)
                    with self.lock:
                        self.input_blocked = False
                        print(f"[Puzzle2] Error flash finished, input unblocked")
                        
                threading.Thread(target=_unblock_later, daemon=True).start()