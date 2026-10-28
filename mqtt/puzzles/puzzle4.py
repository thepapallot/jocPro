from .base import BasePuzzle
import threading
import time
import os
import wave
import math

from scoring import calculate_time_points
from scoring_config import SCORING_CONFIG

class Puzzle4(BasePuzzle):
    def __init__(self, mqtt_client):
        super().__init__(puzzle_id=4, mqtt_client=mqtt_client)
        
        # Audio configuration
        self.AUDIO_SUBDIR = "audios/"
        self.streak1_folder = "P4_F1"
        self.streak2_folder = "P4_F2"
        self.streak1_sample = f"{self.streak1_folder}/song.wav"
        self.streak2_sample = f"{self.streak2_folder}/song.wav"
        self.streak1_sample_duration = 25  # seconds
        self.streak2_sample_duration = 36  # seconds
        
        # Track mappings for streak 1 (4 correct tracks)
        self.streak1_track_map = {
            0: ("0", "WrongSongs/wrong2.wav"),
            1: ("1", f"{self.streak1_folder}/pista2.wav"),
            2: ("2", "WrongSongs/wrong5.wav"),
            3: ("3", f"{self.streak1_folder}/pista4.wav"),
            4: ("4", "WrongSongs/wrong1.wav"),
            5: ("5", f"{self.streak1_folder}/pista1.wav"),
            6: ("6", "WrongSongs/wrong3.wav"),
            7: ("7", "WrongSongs/wrong4.wav"),
            8: ("8", f"{self.streak1_folder}/pista3.wav"),
            9: ("9", "WrongSongs/wrong6.wav"),
        }
        self.streak1_required_order = ["5", "1", "8", "3"]
        
        # Track mappings for streak 2 (8 correct tracks)
        self.streak2_track_map = {
            0: ("0", f"{self.streak2_folder}/pista3.wav"),
            1: ("1", f"{self.streak2_folder}/pista2.wav"),
            2: ("2", f"{self.streak2_folder}/pista7.wav"),
            3: ("3", "WrongSongs/wrong8.wav"),
            4: ("4", f"{self.streak2_folder}/pista6.wav"),
            5: ("5", "WrongSongs/wrong7.wav"),
            6: ("6", f"{self.streak2_folder}/pista1.wav"),
            7: ("7", f"{self.streak2_folder}/pista8.wav"),
            8: ("8", f"{self.streak2_folder}/pista5.wav"),
            9: ("9", f"{self.streak2_folder}/pista4.wav"),
        }
        self.streak2_required_order = ["6", "1", "0", "9", "8", "4", "2", "7"]
        
        # State
        # Operator preference survives reset/start, including selection in earlier puzzles.
        self.second_round_enabled = False
        self.total_required = 1
        self.streak = 0
        self.storing = False
        self.current_progress = 0
        self.played_sequence = []
        self.history = []
        self.playing_sample = False
        self.validating = False
        self.VALIDATION_FEEDBACK_SECONDS = 3
        self.exhausted = False
        self.total_points = None
        self.max_time_seconds = SCORING_CONFIG["puzzle4"]["max_time_seconds"]
        if (isinstance(self.max_time_seconds, bool)
                or not isinstance(self.max_time_seconds, (int, float))
                or not math.isfinite(self.max_time_seconds)
                or self.max_time_seconds <= 0):
            raise ValueError("Puzzle4 requires a finite positive max_time_seconds")
        self._generation = 0
        self._timers = set()
        self._active = False
        self._started_at = None
        self._completed_at = None
        self._frozen_elapsed = None
        self._validation_started = False
        self._rounds_committed = False

    def set_second_round_enabled(self, enabled):
        with self.lock:
            self.second_round_enabled = enabled
            # Once round one is validated, finish the committed flow. Never
            # interrupt a running second round or reopen a completed puzzle.
            if (self.streak == 0 and not self.solved and not self.exhausted
                    and not self._rounds_committed):
                self.total_required = 2 if enabled else 1
            return {"second_round_enabled": self.second_round_enabled}

    def get_round_options(self):
        with self.lock:
            return {"second_round_enabled": self.second_round_enabled}
        
    def _get_current_track_map(self):
        """Get track map for current streak"""
        return self.streak1_track_map if self.streak == 0 else self.streak2_track_map
        
    def _get_current_required_order(self):
        """Get required order for current streak"""
        return self.streak1_required_order if self.streak == 0 else self.streak2_required_order

    def _get_audio_duration(self, rel_path_full):
        """Return wav duration in seconds when available."""
        full_fs_path = os.path.join(self.mqtt_client.app.static_folder, rel_path_full)
        if not os.path.exists(full_fs_path):
            return 0

        try:
            with wave.open(full_fs_path, "rb") as wav_file:
                frames = wav_file.getnframes()
                framerate = wav_file.getframerate()
                if framerate <= 0:
                    return 0
                return frames / float(framerate)
        except Exception as exc:
            print(f"[Puzzle4] Failed to read audio duration for {full_fs_path}: {exc}")
            return 0
        
    def _play_sample_with_delay(self, sample_url, duration):
        """Called with self.lock held, like all scheduling helpers."""
        def unblock():
            self.playing_sample = False
            self._push({
                "playing_sample": False,
                "streak": self.streak,
                "total_required": self.total_required,
                "current_progress": self.current_progress,
                "played_sequence": [],
                "storing": False,
            })
        self._schedule_locked(duration, unblock)

    def _elapsed_locked(self):
        if self._frozen_elapsed is not None:
            return self._frozen_elapsed
        if self._started_at is None:
            return 0.0
        end = self._completed_at if self._completed_at is not None else time.monotonic()
        return max(0.0, end - self._started_at)

    def _scoring_state_locked(self):
        elapsed = self._elapsed_locked()
        state = {
            "puzzle_exhausted": self.exhausted,
            "elapsed_seconds": elapsed,
            "time_remaining_seconds": max(0.0, self.max_time_seconds - elapsed),
            "available_points": (self.total_points if self.total_points is not None
                                 else calculate_time_points("puzzle4", elapsed)),
            # Lets the screen keep its HUD live between events.
            "max_points": SCORING_CONFIG["puzzle4"]["max_points"],
            "penalty_per_time_band": SCORING_CONFIG["puzzle4"]["penalty_per_time_band"],
            "penalty_thresholds_seconds": list(SCORING_CONFIG["puzzle4"]["penalty_thresholds_seconds"]),
            "max_time_seconds": self.max_time_seconds,
        }
        # Only terminal events may carry earned points to the app callback.
        if self.solved or self.exhausted:
            state["total_points"] = self.total_points
        return state

    def _push(self, data):
        # All callers hold the same non-reentrant puzzle lock. The app callback
        # does not acquire it; do not call public locking methods from here.
        payload = self._scoring_state_locked()
        payload.update(data)
        super()._push(payload)

    def _invalidate_locked(self):
        self._generation += 1
        for timer in self._timers:
            timer.cancel()
        self._timers.clear()
        self._validation_started = False

    def _schedule_locked(self, delay, callback):
        generation = self._generation

        def run():
            with self.lock:
                self._timers.discard(timer)
                if generation != self._generation or not self._active:
                    return
                if self._expire_locked():
                    return
                callback()

        timer = threading.Timer(max(0, delay), run)
        timer.daemon = True
        self._timers.add(timer)
        timer.start()

    def _expire_locked(self):
        if (not self._active or self._completed_at is not None
                or self._elapsed_locked() < self.max_time_seconds):
            return False
        self.exhausted = True
        self.total_points = SCORING_CONFIG["puzzle4"]["exhaustion_points"]
        self._frozen_elapsed = self.max_time_seconds
        self._active = False
        self.storing = self.playing_sample = self.validating = False
        self._invalidate_locked()
        self.mqtt_client.send_message("FROM_FLASK", f"P{self.id}End")
        self._push({"puzzle_solved": False, "playing_sample": False,
                    "storing": False})
        return True

    def _deadline_locked(self):
        # An early timer wakeup must not disable the hard deadline.
        if self._completed_at is None:
            self._schedule_locked(self.max_time_seconds - self._elapsed_locked(),
                                  self._deadline_locked)

    def timer_expired(self):
        with self.lock:
            self._expire_locked()

    def _start_sample_locked(self):
        sample = self.streak1_sample if self.streak == 0 else self.streak2_sample
        duration = (self.streak1_sample_duration if self.streak == 0
                    else self.streak2_sample_duration)
        duration = self._get_audio_duration(f"{self.AUDIO_SUBDIR}{sample}") or duration
        self.playing_sample = True
        self._push({
            "streak": -1, "streak_bis": self.streak,
            "total_required": self.total_required, "storing": False,
            "current_progress": 0, "played_sequence": [],
            "playing_sample": True,
            "sample_song": {"url": f"/static/{self.AUDIO_SUBDIR}{sample}"},
            "listening": True,
        })
        self._play_sample_with_delay(sample, duration)

    def reset(self):
        """Start one monotonic budget, including samples and both rounds."""
        with self.lock:
            self._invalidate_locked()
            self._started_at = time.monotonic()
            self._completed_at = self._frozen_elapsed = None
            self._active = True
            self.solved = self.exhausted = False
            self.saltarPuzzle = self.alwaysCorrect = False
            self.total_points = None
            self._rounds_committed = False
            self.total_required = 2 if self.second_round_enabled else 1
            self.streak = 0
            self.storing = self.validating = False
            self.current_progress = 0
            self.played_sequence = []
            self.history = []
            self.playing_sample = True
            self._schedule_locked(self.max_time_seconds, self._deadline_locked)
            self._schedule_locked(3, self._start_sample_locked)

    def stop(self):
        with self.lock:
            self._frozen_elapsed = self._elapsed_locked()
            self._active = False
            self.storing = self.playing_sample = self.validating = False
            self._invalidate_locked()

    def get_state(self):
        with self.lock:
            self._expire_locked()
            return {
                "puzzle_id": self.id,
                "streak": self.streak,
                "total_required": self.total_required,
                "storing": self.storing,
                "current_progress": self.current_progress,
                "played_sequence": self.played_sequence.copy(),
                "history": self.history[-25:],
                "puzzle_solved": self.solved,
                "playing_sample": self.playing_sample,
                **self._scoring_state_locked(),
            }

    def _handle_validation(self, is_correct, final_track_duration=0,
                           generation=None, submitted_at=None):
        """Compatibility entry point; playback/feedback now use cancellable timers.

        MQTT reserves the submission under the lock, not in a delayed worker.
        Optional generation identifies externally queued validation work.
        """
        with self.lock:
            if generation is not None and generation != self._generation:
                return
            if not self._active or self._expire_locked():
                return
            self._begin_validation_locked(is_correct, final_track_duration, submitted_at)

    def _begin_validation_locked(self, is_correct, duration, submitted_at=None):
        if self._validation_started:
            return
        self._validation_started = True
        self.validating = True
        if is_correct:
            self._rounds_committed = True
        if is_correct and (self.streak + 1 >= self.total_required or self.saltarPuzzle):
            # Capture acceptance BEFORE audio playback. The deadline callback
            # cannot exhaust a valid submission that arrived strictly before it.
            now = time.monotonic()
            submitted_at = now if submitted_at is None else min(now, submitted_at)
            if submitted_at - self._started_at >= self.max_time_seconds:
                self._expire_locked()
                return
            self._completed_at = max(self._started_at, submitted_at)
        self._schedule_locked(duration, lambda: self._finish_track_locked(is_correct))

    def _finish_track_locked(self, is_correct):
        self._push({"validation_feedback": is_correct})
        if not is_correct:
            self._schedule_locked(self.VALIDATION_FEEDBACK_SECONDS,
                                  self._clear_validation_locked)
            return

        sequence = self.played_sequence.copy()
        self.streak += 1
        self.played_sequence = []
        self.storing = False
        self.current_progress = 0
        self.playing_sample = True
        if self._completed_at is not None:
            self._schedule_locked(2, lambda: self._complete_locked(sequence))
            return
        self.mqtt_client.start_next_round(self.id, self.streak + 1)
        self._push({"show_completion": True, "streak": self.streak,
                    "total_required": self.total_required})
        self._schedule_locked(self.VALIDATION_FEEDBACK_SECONDS,
                              lambda: self._countdown_locked(5))

    def _clear_validation_locked(self):
        self.current_progress = 0
        self.played_sequence = []
        self.storing = self.validating = False
        self._validation_started = False
        self._push({"streak": self.streak, "total_required": self.total_required,
                    "storing": False, "current_progress": 0, "played_sequence": []})

    def _countdown_locked(self, seconds):
        if seconds == 0:
            self.validating = False
            self._validation_started = False
            self._start_sample_locked()
            return
        self._push({"sample_countdown_seconds": seconds, "streak": -1,
                    "total_required": self.total_required})
        self._schedule_locked(2, lambda: self._countdown_locked(seconds - 1))

    def _complete_locked(self, sequence):
        self.total_points = calculate_time_points("puzzle4", self._elapsed_locked())
        self._frozen_elapsed = self._elapsed_locked()
        self.solved = True
        self._active = False
        self.storing = self.playing_sample = self.validating = False
        self._invalidate_locked()
        self.mqtt_client.send_message("FROM_FLASK", f"P{self.id}End")
        self._push({
            "puzzle_solved": True, "streak": self.streak,
            "total_required": self.total_required, "played_sequence": sequence,
            "playing_sample": False,
            "play_final": {"url": f"/static/{self.AUDIO_SUBDIR}{self.streak2_folder}/correcta.mp3"},
        })

    def handle_message(self, parts):
        """Handle MQTT message: P4,button,song"""
        if len(parts) < 2:
            return
            
        try:
            button = int(parts[1])
            song = int(parts[2]) if len(parts) >= 3 else 0
        except ValueError:
            return
            
        with self.lock:
            submitted_at = time.monotonic()
            if not self._active or self._expire_locked():
                return
                
            # Block during sample playback
            if self.playing_sample:
                print(f"[Puzzle4] Ignoring input while playing sample")
                return
                
            # Block during validation
            if self.validating:
                print(f"[Puzzle4] Ignoring input during validation")
                return
                
            # Button 4: Play sample
            if button == 4:
                sample_url = (self.streak1_sample if self.streak == 0 
                            else self.streak2_sample)
                self._push({
                    "play_mostra": True,
                    "url": f"/static/{self.AUDIO_SUBDIR}{sample_url}"
                })
                return
                
            # Button 3: Start storing
            if button == 3:
                if self.storing:
                    return

                self.storing = True
                self.current_progress = len(self.played_sequence)
                self._push({
                    "storing": True,
                    "streak": self.streak,
                    "total_required": self.total_required,
                    "current_progress": self.current_progress,
                    "played_sequence": self.played_sequence.copy()
                })
                return

            # Button 1: Delete last stored track
            if button == 1:
                removed = False
                if self.played_sequence:
                    self.played_sequence.pop()
                    removed = True

                self.storing = False
                self.current_progress = len(self.played_sequence)
                payload = {
                    "storing": False,
                    "streak": self.streak,
                    "total_required": self.total_required,
                    "current_progress": self.current_progress,
                    "played_sequence": self.played_sequence.copy()
                }
                if removed:
                    payload["removed_last"] = True

                self._push(payload)
                return

            # Button 2: Not used
            if button == 2:
                return
                
            # Button 0: Play track
            if button == 0:
                track_map = self._get_current_track_map()
                required_order = self._get_current_required_order()
                
                if song not in track_map:
                    return
                    
                track_name, rel_path = track_map[song]
                rel_path_full = f"{self.AUDIO_SUBDIR}{rel_path}"
                full_fs_path = os.path.join(
                    self.mqtt_client.app.static_folder,
                    rel_path_full
                )
                
                if not os.path.exists(full_fs_path):
                    print(f"[Puzzle4] Audio file NOT FOUND: {full_fs_path}")
                    
                self.history.append(track_name)
                
                # Add to sequence if storing
                if self.storing:
                    if len(self.played_sequence) < len(required_order):
                        self.played_sequence.append(str(song))

                    # One-shot recording: disarm after capturing one track.
                    self.storing = False
                    self.current_progress = len(self.played_sequence)
                        
                    # Check if sequence complete
                    if len(self.played_sequence) >= len(required_order):
                        self.validating = True
                        is_correct = self.played_sequence == required_order or self.alwaysCorrect
                        duration = self._get_audio_duration(rel_path_full)
                        self._begin_validation_locked(is_correct, duration, submitted_at)
                        
                        print(f"[Puzzle4] Validating: Expected={required_order}, "
                              f"Got={self.played_sequence}, Correct={is_correct}")
                        
                        # Push with validation result. Frontend can play last track with special feedback
                        self._push({
                            "sequence_correct": is_correct,
                            "play": {
                                "track": track_name,
                                "code": song,
                                "url": f"/static/{rel_path_full}",
                                "duration": duration
                            },
                            "current_progress": self.current_progress,
                            "storing": False,
                            "streak": self.streak,
                            "total_required": self.total_required,
                            "played_sequence": self.played_sequence.copy()
                        })
                                                
                        
                        return
                        
                # Normal play without validation
                self._push({
                    "play": {
                        "track": track_name,
                        "code": song,
                        "url": f"/static/{rel_path_full}",
                        "duration": self._get_audio_duration(rel_path_full)
                    },
                    "current_progress": self.current_progress,
                    "storing": self.storing,
                    "streak": self.streak,
                    "total_required": self.total_required,
                    "played_sequence": self.played_sequence.copy()
                })
                
