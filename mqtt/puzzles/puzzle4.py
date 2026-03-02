from .base import BasePuzzle
import threading
import time
import os

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
            4: ("4", "WrongSongs/wrong7.wav"),
            5: ("5", f"{self.streak2_folder}/pista6.wav"),
            6: ("6", f"{self.streak2_folder}/pista1.wav"),
            7: ("7", f"{self.streak2_folder}/pista8.wav"),
            8: ("8", f"{self.streak2_folder}/pista5.wav"),
            9: ("9", f"{self.streak2_folder}/pista4.wav"),
        }
        self.streak2_required_order = ["6", "1", "0", "9", "8", "5", "2", "7"]
        
        # State
        self.total_required = 2
        self.streak = 0
        self.storing = False
        self.current_progress = 0
        self.played_sequence = []
        self.history = []
        self.playing_sample = False
        self.validating = False
        
    def _get_current_track_map(self):
        """Get track map for current streak"""
        return self.streak1_track_map if self.streak == 0 else self.streak2_track_map
        
    def _get_current_required_order(self):
        """Get required order for current streak"""
        return self.streak1_required_order if self.streak == 0 else self.streak2_required_order
        
    def _play_sample_with_delay(self, sample_url, duration):
        """Play sample and automatically unblock after duration"""
        def _delayed_unblock():
            time.sleep(duration)
            with self.lock:
                if not self.solved and self.playing_sample:
                    self.playing_sample = False
                    print(f"[Puzzle4] Sample finished after {duration}s, unblocking input")
                    self._push({
                        "playing_sample": False,
                        "streak": self.streak,
                        "total_required": self.total_required,
                        "current_progress": self.current_progress,
                        "played_sequence": [],
                        "storing": False
                    })
        threading.Thread(target=_delayed_unblock, daemon=True).start()
        
    def reset(self):
        """Full reset"""
        super().reset()
        self.on_start()
        
    def on_start(self):
        """Called when puzzle becomes active"""
        with self.lock:
            self.streak = 0
            self.storing = False
            self.current_progress = 0
            self.played_sequence = []
            self.history = []
            self.solved = False
            self.playing_sample = True
            
            # Delay initial push so frontend is ready
            def _later():
                time.sleep(3)
                with self.lock:
                    if self.solved:
                        return
                    # Push sample start
                    self._push({
                        "streak": -1,
                        "total_required": 2,
                        "storing": False,
                        "current_progress": 0,
                        "played_sequence": [],
                        "playing_sample": True,
                        "sample_song": {
                            "url": f"/static/{self.AUDIO_SUBDIR}{self.streak1_sample}"
                        },
                        "listening": True
                    })
                    # Start unblock timer
                    self._play_sample_with_delay(
                        self.streak1_sample,
                        self.streak1_sample_duration
                    )
            threading.Thread(target=_later, daemon=True).start()
            
    def stop(self):
        """Cleanup on puzzle stop"""
        with self.lock:
            self.playing_sample = False
            self.validating = False
            
    def get_state(self):
        """Return current puzzle state"""
        with self.lock:
            return {
                "puzzle_id": self.id,
                "streak": self.streak,
                "total_required": self.total_required,
                "storing": self.storing,
                "current_progress": self.current_progress,
                "played_sequence": self.played_sequence.copy(),
                "history": self.history[-25:],
                "puzzle_solved": self.solved,
                "playing_sample": self.playing_sample
            }
            
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
            if self.solved:
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
                self.storing = True
                self.current_progress = 0
                self.played_sequence = []
                self._push({
                    "storing": True,
                    "streak": self.streak,
                    "total_required": self.total_required,
                    "current_progress": 0,
                    "played_sequence": []
                })
                return
                
            # Button 1: Stop storing
            if button == 1:
                self.storing = False
                self._push({
                    "storing": False,
                    "streak": self.streak,
                    "total_required": self.total_required
                })
                return
                
            # Button 2: Reset attempt
            if button == 2:
                self.current_progress = 0
                self.played_sequence = []
                self._push({
                    "reset_attempt": True,
                    "streak": self.streak,
                    "total_required": self.total_required,
                    "current_progress": 0,
                    "played_sequence": []
                })
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
                        
                    # Check if sequence complete
                    if len(self.played_sequence) >= len(required_order):
                        self.validating = True
                        is_correct = self.played_sequence == required_order
                        print(f"[Puzzle4] Validating: Expected={required_order}, "
                              f"Got={self.played_sequence}, Correct={is_correct}")
                        
                        # Push with validation result
                        self._push({
                            "sequence_correct": is_correct,
                            "play": {
                                "track": track_name,
                                "code": song,
                                "url": f"/static/{rel_path_full}"
                            },
                            "current_progress": len(self.played_sequence),
                            "streak": self.streak,
                            "total_required": self.total_required,
                            "played_sequence": self.played_sequence.copy()
                        })
                        
                        # Handle validation result in separate thread
                        threading.Thread(
                            target=self._handle_validation,
                            args=(is_correct,),
                            daemon=True
                        ).start()
                        return
                        
                # Normal play without validation
                self._push({
                    "play": {
                        "track": track_name,
                        "code": song,
                        "url": f"/static/{rel_path_full}"
                    },
                    "current_progress": len(self.played_sequence),
                    "streak": self.streak,
                    "total_required": self.total_required,
                    "played_sequence": self.played_sequence.copy()
                })
                
    def _handle_validation(self, is_correct):
        """Handle sequence validation result"""
        if is_correct:
            with self.lock:
                self.streak += 1
                temp_sequence = self.played_sequence.copy()
                self.played_sequence = []
                self.storing = False
                self.current_progress = 0
                self.playing_sample = True
                self.validating = False
                
                # Check if puzzle solved
                if self.streak >= self.total_required:
                    # Show completion message
                    self._push({
                        "show_completion": True,
                        "streak": self.streak,
                        "total_required": self.total_required
                    })
                    
                    time.sleep(5)
                    
                    # Solve puzzle
                    self.solved = True
                    self.mqtt_client.send_message("FROM_FLASK", f"P{self.id}End")
                    self._push({
                        "puzzle_solved": True,
                        "streak": self.streak,
                        "total_required": self.total_required,
                        "played_sequence": temp_sequence,
                        "play_final": {
                            "url": f"/static/{self.AUDIO_SUBDIR}{self.streak2_folder}/correcta.mp3"
                        }
                    })
                else:
                    # Countdown to next streak sample
                    for sec in [5, 4, 3, 2, 1]:
                        time.sleep(2)
                        with self.lock:
                            self._push({
                                "sample_countdown_seconds": sec,
                                "streak": -1
                            })
                            
                    time.sleep(2)
                    
                    # Play streak 2 sample
                    with self.lock:
                        if self.solved:
                            return
                        self._push({
                            "streak": -1,
                            "total_required": 2,
                            "storing": False,
                            "current_progress": 0,
                            "played_sequence": [],
                            "playing_sample": True,
                            "sample_song": {
                                "url": f"/static/{self.AUDIO_SUBDIR}{self.streak2_sample}"
                            },
                            "listening": True
                        })
                        self._play_sample_with_delay(
                            self.streak2_sample,
                            self.streak2_sample_duration
                        )
        else:
            # Wrong sequence - reset
            with self.lock:
                self.current_progress = 0
                self.played_sequence = []
                self.validating = False
                self._push({
                    "streak": self.streak,
                    "total_required": self.total_required,
                    "current_progress": 0,
                    "played_sequence": []
                })