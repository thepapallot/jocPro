from .base import BasePuzzle
import threading
import time
import random
import math

from scoring import calculate_time_points
from scoring_config import SCORING_CONFIG

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
        self.error_counter = 0
        self.exhausted = False
        self.total_points = None
        self.max_time_seconds = SCORING_CONFIG["puzzle2"]["max_time_seconds"]
        if (isinstance(self.max_time_seconds, bool)
                or not isinstance(self.max_time_seconds, (int, float))
                or not math.isfinite(self.max_time_seconds)
                or self.max_time_seconds <= 0):
            raise ValueError("Puzzle2 requires a finite positive max_time_seconds")
        self._active = False
        self._started_at = None
        self._frozen_elapsed = None
        self._generation = 0
        self._timers = set()

    def _elapsed_locked(self):
        if self._frozen_elapsed is not None:
            return self._frozen_elapsed
        if self._started_at is None:
            return 0.0
        return max(0.0, time.monotonic() - self._started_at)

    def _scoring_state_locked(self):
        elapsed = self._elapsed_locked()
        state = {
            "puzzle_solved": self.solved,
            "puzzle_exhausted": self.exhausted,
            "elapsed_seconds": elapsed,
            "time_remaining_seconds": max(0.0, self.max_time_seconds - elapsed),
            "available_points": (self.total_points if self.total_points is not None
                                 else calculate_time_points("puzzle2", elapsed)),
            # Lets the screen keep its HUD live between events.
            "max_points": SCORING_CONFIG["puzzle2"]["max_points"],
            "penalty_per_time_band": SCORING_CONFIG["puzzle2"]["penalty_per_time_band"],
            "penalty_thresholds_seconds": list(SCORING_CONFIG["puzzle2"]["penalty_thresholds_seconds"]),
            "max_time_seconds": self.max_time_seconds,
        }
        if self.solved or self.exhausted:
            state["total_points"] = self.total_points
        return state

    def _push(self, data):
        payload = self._scoring_state_locked()
        payload.update(data)
        super()._push(payload)

    def _invalidate_locked(self):
        self._generation += 1
        for timer in self._timers:
            timer.cancel()
        self._timers.clear()
        self.alarm_timer = None

    def _schedule_locked(self, delay, callback):
        generation = self._generation

        def run():
            with self.lock:
                self._timers.discard(timer)
                if (generation != self._generation or not self._active
                        or self.mqtt_client.current_puzzle_id != self.id):
                    return
                if not self._expire_locked():
                    callback()

        timer = threading.Timer(delay, run)
        timer.daemon = True
        self._timers.add(timer)
        timer.start()
        return timer

    def _finish_locked(self, exhausted=False, forced_by_gm=False):
        self._frozen_elapsed = (self.max_time_seconds if exhausted
                                else self._elapsed_locked())
        self.total_points = (SCORING_CONFIG["puzzle2"]["exhaustion_points"] if exhausted
                             else calculate_time_points("puzzle2", self._frozen_elapsed))
        self.solved = not exhausted
        self.exhausted = exhausted
        self._active = False
        self._invalidate_locked()
        self.input_blocked = False
        self.alarm_mode = False
        self.mqtt_client.send_message("FROM_FLASK", f"P{self.id}End")
        payload = {"alarm_mode": False}
        if forced_by_gm:
            payload["forced_by_gm"] = True
        self._push(payload)

    def _expire_locked(self):
        if self._active and self._elapsed_locked() >= self.max_time_seconds:
            self._finish_locked(exhausted=True)
            return True
        return self.exhausted

    def _deadline_locked(self):
        # A timer can wake early; the monotonic deadline remains authoritative.
        self._schedule_locked(self.max_time_seconds - self._elapsed_locked(),
                              self._deadline_locked)

    def complete_by_gm(self):
        with self.lock:
            if not self._active or self._expire_locked():
                return
            self._finish_locked(forced_by_gm=True)
        
    def get_player_sequence(self, player):
        """Return the fixed sequence shown on screen, independent of alarm mode."""
        if player not in self.sequences:
            return []
        return self.sequences[player].copy()

    def _snapshot(self):
        """Return player progress snapshot"""
        return [
            {
                "player": p,
                "progress": self.progress[p],
                "total": 5,
                "sequence": self.get_player_sequence(p),
            }
            for p in sorted(self.progress.keys())
        ]

    def reset(self):
        """Full reset of puzzle"""
        with self.lock:
            self._invalidate_locked()
            self.solved = False
            self.saltarPuzzle = False
            self.alwaysCorrect = False
            self.exhausted = False
            self.total_points = None
            self._active = True
            self._started_at = time.monotonic()
            self._frozen_elapsed = None
            self.error_counter = 0
            self.progress = {p: 0 for p in self.sequences.keys()}
            self.alarm_mode = False
            self.input_blocked = False
            self.block_until = 0

            sequences = {
                p: self.get_player_sequence(p)
                for p in sorted(self.sequences.keys())
            }
            self._push({
                "players": self._snapshot(),
                "sequences": sequences,
                "alarm_mode": False,
                "error_counter": 0
            })

            # Schedule new alarm
            alarm_delay = random.randint(20, 40)
            print(f"[Puzzle2] Rescheduling alarm mode in {alarm_delay} seconds after reset")
            self._schedule_locked(self.max_time_seconds, self._deadline_locked)
            self.alarm_timer = self._schedule_locked(alarm_delay, self._enter_alarm_mode)


    def stop(self):
        """Cleanup on puzzle stop"""
        with self.lock:
            self._frozen_elapsed = self._elapsed_locked()
            self._active = False
            self._invalidate_locked()
            self.input_blocked = False
            self.alarm_mode = False
            
    def get_state(self):
        """Return current puzzle state"""
        with self.lock:
            sequences = {
                p: self.get_player_sequence(p)
                for p in sorted(self.sequences.keys())
            }
            state = {
                "puzzle_id": self.id,
                "players": self._snapshot(),
                "sequences": sequences,
                "alarm_mode": self.alarm_mode,
                "error_counter": self.error_counter
            }
            state.update(self._scoring_state_locked())
            return state
            
    def _enter_alarm_mode(self):
        """Enter alarm mode - play sound and switch symbol mapping"""
        print(f"[Puzzle2] Playing alarm sound and blocking input for 5s")
        self._begin_alarm_transition_locked(True)
        
    def _exit_alarm_mode(self):
        """Exit alarm mode - play sound and revert mapping"""
        print(f"[Puzzle2] Playing normal sound and blocking input for 5s")
        self._begin_alarm_transition_locked(False)

    def _begin_alarm_transition_locked(self, alarm_mode):
        self.input_blocked = True
        self.block_until = time.monotonic() + 5
        sound_key = "play_alarm_sound" if alarm_mode else "play_normal_sound"
        self._push({
            sound_key: {"url": "/static/audios/effects/canvi_laberint.wav"},
            "sequences": {p: self.get_player_sequence(p) for p in self.sequences},
            "alarm_mode": self.alarm_mode,
        })

        def finish_transition():
            self.alarm_mode = alarm_mode
            self.input_blocked = False
            self._push({
                "alarm_mode": alarm_mode,
                "sequences": {p: self.get_player_sequence(p) for p in self.sequences},
            })
            callback = self._exit_alarm_mode if alarm_mode else self._enter_alarm_mode
            self.alarm_timer = self._schedule_locked(random.randint(20, 40), callback)

        self.alarm_timer = self._schedule_locked(5, finish_transition)
        
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
            if not self._active or self._expire_locked():
                return
            # Block input during transition
            if self.input_blocked and time.monotonic() < self.block_until:
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
                
            # The displayed sequence stays fixed; alarm mode changes only the MQTT symbol expected.
            expected_raw = self.sequences[player][current_index]
            expected = self.alarmChanges.get(expected_raw, expected_raw) if self.alarm_mode else expected_raw
            
            if symbol == expected:
                # Correct symbol
                self.progress[player] += 1
                complete = all(v >= 5 for v in self.progress.values())
                if complete:
                    self._frozen_elapsed = self._elapsed_locked()
                
                self._push({
                    "player_update": {
                        "player": player,
                        "progress": self.progress[player],
                        "total": 5
                    }
                })
                
                # Check if puzzle complete
                if complete:
                    self._finish_locked()
                    
            else:
                # Wrong symbol - increment shared error counter
                self.error_counter += 1
                print(f"[Puzzle2] Error by player {player}, counter {self.error_counter}")

                # Report errors without resetting progress or blocking input.
                self._push({
                    "error_increment": {
                        "player": player,
                        "symbol": symbol,
                        "expected": expected
                    },
                    "error_counter": self.error_counter
                })