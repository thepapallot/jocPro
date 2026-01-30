import random
import time
import threading
import json
import os
import paho.mqtt.client as mqtt
from data.puzzle3_questions import QUESTIONS as P3_QUESTIONS

# --- Puzzle Framework -------------------------------------------------

class PuzzleBase:
    def __init__(self, mqtt_client, puzzle_id):
        self.mqtt_client = mqtt_client
        self.id = puzzle_id

    # Called when puzzle becomes active
    def on_start(self):
        pass

    # Handle an MQTT payload already split in parts (e.g. ["P1","12","20"])
    def handle_message(self, parts):
        pass

    # Reset (timer expires or internal logic)
    def reset(self):
        pass

    # Provide current state snapshot
    def get_state(self):
        return {}

    def on_timer_expired(self):
        # Default behavior: full reset
        self.reset()

class Puzzle1(PuzzleBase):
    def __init__(self, mqtt_client, puzzle_id):
        super().__init__(mqtt_client, puzzle_id)
        self.lock = threading.Lock()
        self.suma_results_pool = [5,6,7,8,9,30,32,33,34,41,42,43,44,10,11,12,28,29,31,35,36,37,38,39,40,13,15,16,27,14,17,24,25,26,18,20,21,23,22]
        self.operations_with_metadata = []
        self.processing_wrong_result = False
        # NEW round data
        self.round = 1
        self.round_sizes = {1: 4, 2: 7, 3: 15}

    def _reset_operations(self, size=None):
        size = size or self.round_sizes[self.round]
        self.operations_with_metadata = [
            [result, index + 1, "N"]
            for index, result in enumerate(random.sample(self.suma_results_pool, size))
        ]

    def on_start(self):
        with self.lock:
            self.round = 1  # NEW: start from round 1
            self._reset_operations()
            self.processing_wrong_result = False
            self.mqtt_client.push_update({
                "operations": self.operations_with_metadata.copy(),
                "puzzle_id": self.id,
                "round": self.round
            })

    def reset(self):
        with self.lock:
            self.round = 1  # NEW: full reset returns to round 1
            self._reset_operations()
            self.processing_wrong_result = False
            self.mqtt_client.push_update({
                "operations": self.operations_with_metadata.copy(),
                "start_timer": True,
                "puzzle_id": self.id,
                "round": self.round
            })

    def get_state(self):
        with self.lock:
            return {
                "puzzle_id": self.id,
                "operations": self.operations_with_metadata.copy(),
                "round": self.round
            }

    def handle_message(self, parts):
        # Expect format: P1,a,b
        if len(parts) < 3:
            return
        try:
            a, b = map(int, parts[1:3])
        except ValueError:
            return
        self._check_sum_or_reset(a, b)

    def _check_sum_or_reset(self, a, b):
        with self.lock:
            if self.processing_wrong_result:
                return
            result = a + b
            for op in self.operations_with_metadata:
                if op[0] == result and op[2] == "N":
                    op[2] = "Y"
                    solved_text = f"{a} + {b} = {result}"
                    self.mqtt_client.push_update({
                        "puzzle_id": self.id,  # added
                        "operations": self.operations_with_metadata.copy(),
                        "solved": {"result": result, "text": solved_text},
                        "round": self.round
                    })
                    # Round completion?
                    if all(o[2] == "Y" for o in self.operations_with_metadata):
                        if self.round < 3:
                            # Advance to next round
                            self.round += 1
                            self.processing_wrong_result = False
                            self._reset_operations()
                            # Notify round transition with fresh ops
                            self.mqtt_client.push_update({
                                "puzzle_id": self.id,  # added
                                "operations": self.operations_with_metadata.copy(),
                                "round": self.round,
                                "round_start": True,
                                "start_timer": True  # NEW: reset timer for new round
                            })
                        else:
                            # Final puzzle solved
                            self.mqtt_client.send_message("FROM_FLASK", f"P{self.id}End")
                            self.mqtt_client.push_update({
                                "puzzle_id": self.id,  # added
                                "puzzle_solved": True,
                                "round": self.round
                            })
                    return
            # Incorrect
            self.processing_wrong_result = True
            self.mqtt_client.push_update({
                "puzzle_id": self.id,  # added
                "operations": self.operations_with_metadata.copy(),
                "incorrect": {"result": result, "text": f"{a} + {b} = {result}"},
                "round": self.round
            })
            threading.Thread(target=self._delayed_reset, daemon=True).start()

    def _delayed_reset(self):
        time.sleep(3)  # was 5: reset after 3 seconds
        with self.lock:
            self.processing_wrong_result = False
            self._reset_operations()
            self.mqtt_client.push_update({
                "puzzle_id": self.id,  # added
                "operations": self.operations_with_metadata.copy(),
                "round": self.round,
                "start_timer": True  # restart timer after wrong-op reset
            })

    def on_timer_expired(self):
        # Only reset current round (do not revert to round 1). Delay 5s so UI can show message and 00:00 in red.
        with self.lock:
            if self.processing_wrong_result:
                return  # avoid overlapping resets
            self.processing_wrong_result = True  # block inputs during timeout grace period

        def _later():
            time.sleep(5)
            with self.lock:
                self._reset_operations()
                self.processing_wrong_result = False
                self.mqtt_client.push_update({
                    "puzzle_id": self.id,  # ensure client processes it
                    "operations": self.operations_with_metadata.copy(),
                    "round": self.round,
                    "start_timer": True  # restart timer after the 5s pause
                })
        threading.Thread(target=_later, daemon=True).start()

class Puzzle2(PuzzleBase):
    def __init__(self, mqtt_client, puzzle_id):
        super().__init__(mqtt_client, puzzle_id)
        self.lock = threading.Lock()
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
        self.alarmChanges = {
            0: 2, 1: 3, 2: 0, 3: 1, 4: 5, 5: 4, 6: 8, 7: 9, 8: 6, 9: 7
        }
        self.progress = {p: 0 for p in self.sequences.keys()}  # counts validated symbols
        self.alarm_mode = False
        self.alarm_timer = None
        self.input_blocked = False
        self.block_until = 0  # timestamp when block expires

    def _snapshot(self):
        return [{"player": p, "progress": self.progress[p], "total": 5} for p in sorted(self.progress.keys())]

    def on_start(self):
        with self.lock:
            # Reset progress on each start
            self.progress = {p: 0 for p in self.sequences.keys()}
            self.alarm_mode = False
            if self.alarm_timer:
                self.alarm_timer.cancel()
                self.alarm_timer = None
            self.mqtt_client.push_update({
                "puzzle_id": self.id,
                "players": self._snapshot(),
                "alarm_mode": False
            })
            # Schedule alarm mode after random 2–4 minutes (120–240s)
            alarm_delay = random.randint(120, 240)
            print(f"[Puzzle2] Scheduling alarm mode in {alarm_delay} seconds")
            self.alarm_timer = threading.Timer(alarm_delay, self._enter_alarm_mode)
            self.alarm_timer.start()

    def reset(self):
        with self.lock:
            self.progress = {p: 0 for p in self.sequences.keys()}
            self.alarm_mode = False
            if self.alarm_timer:
                print(f"[Puzzle2] Cancelling existing alarm timer")
                self.alarm_timer.cancel()
                self.alarm_timer = None
            self.mqtt_client.push_update({
                "puzzle_id": self.id,
                "players": self._snapshot(),
                "alarm_mode": False
            })
            # Restart alarm schedule with random delay
            alarm_delay = random.randint(120, 240)
            print(f"[Puzzle2] Rescheduling alarm mode in {alarm_delay} seconds after reset")
            self.alarm_timer = threading.Timer(alarm_delay, self._enter_alarm_mode)
            self.alarm_timer.start()

    def get_state(self):
        with self.lock:
            return {
                "puzzle_id": self.id,
                "players": self._snapshot(),
                "alarm_mode": self.alarm_mode
            }

    def _enter_alarm_mode(self):
        # Check if still on puzzle 2
        if self.mqtt_client.current_puzzle_id != self.id:
            print(f"[Puzzle2] Not current puzzle, cancelling alarm entry")
            return
        print(f"[Puzzle2] Playing alarm sound and blocking input for 5s")
        with self.lock:
            self.input_blocked = True
            self.block_until = time.time() + 5
            # Push sound event
            self.mqtt_client.push_update({
                "puzzle_id": self.id,
                "play_alarm_sound": {
                    "url": "/static/audios/effects/alarma.mp3"
                }
            })
        # Schedule actual mode change after 5s
        def _later():
            time.sleep(5)
            with self.lock:
                self.alarm_mode = True
                self.input_blocked = False
                print(f"[Puzzle2] Alarm mode ACTIVE, pushing update to frontend")
                self.mqtt_client.push_update({
                    "puzzle_id": self.id,
                    "alarm_mode": True
                })
                # Schedule exit after random 60–150s
                alarm_duration = random.randint(60, 150)
                print(f"[Puzzle2] Scheduling alarm exit in {alarm_duration} seconds")
                self.alarm_timer = threading.Timer(alarm_duration, self._exit_alarm_mode)
                self.alarm_timer.start()
        threading.Thread(target=_later, daemon=True).start()

    def _exit_alarm_mode(self):
        # Check if still on puzzle 2
        if self.mqtt_client.current_puzzle_id != self.id:
            print(f"[Puzzle2] Not current puzzle, cancelling alarm exit")
            return
        print(f"[Puzzle2] Playing normal sound and blocking input for 5s")
        with self.lock:
            self.input_blocked = True
            self.block_until = time.time() + 5
            # Push sound event
            self.mqtt_client.push_update({
                "puzzle_id": self.id,
                "play_normal_sound": {
                    "url": "/static/audios/effects/backToNormal.mp3"
                }
            })
        # Schedule actual mode change after 5s
        def _later():
            time.sleep(5)
            with self.lock:
                self.alarm_mode = False
                self.input_blocked = False
                print(f"[Puzzle2] Alarm mode INACTIVE, pushing update to frontend")
                self.mqtt_client.push_update({
                    "puzzle_id": self.id,
                    "alarm_mode": False
                })
                # Schedule next alarm entry after random 120–240s
                alarm_delay = random.randint(120, 240)
                print(f"[Puzzle2] Scheduling next alarm mode in {alarm_delay} seconds")
                self.alarm_timer = threading.Timer(alarm_delay, self._enter_alarm_mode)
                self.alarm_timer.start()
        threading.Thread(target=_later, daemon=True).start()

    def handle_message(self, parts):
        # Expect: P2,a,b where a=player (1..10), b=symbol (int)
        if len(parts) < 3:
            return
        try:
            player = int(parts[1])
            symbol = int(parts[2])
        except ValueError:
            return
        with self.lock:
            # Block input during transition period
            if self.input_blocked and time.time() < self.block_until:
                print(f"[Puzzle2] Input blocked, ignoring message from player {player}")
                return
            # Ignore if puzzle already fully solved
            if all(v >= 5 for v in self.progress.values()):
                return
            if player not in self.sequences:
                return
            current_index = self.progress[player]
            # Ignore input from already finished player
            if current_index >= 5:
                return
            expected_raw = self.sequences[player][current_index]
            # Apply alarm mapping if alarm_mode is active
            expected = self.alarmChanges.get(expected_raw, expected_raw) if self.alarm_mode else expected_raw
            if symbol == expected:
                self.progress[player] += 1
                self.mqtt_client.push_update({
                    "puzzle_id": self.id,
                    "player_update": {
                        "player": player,
                        "progress": self.progress[player],
                        "total": 5
                    }
                })
                if all(v >= 5 for v in self.progress.values()):
                    # Cancel alarm timer if still running
                    if self.alarm_timer:
                        self.alarm_timer.cancel()
                        self.alarm_timer = None
                    self.mqtt_client.send_message("FROM_FLASK", f"P{self.id}End")
                    self.mqtt_client.push_update({
                        "puzzle_id": self.id,
                        "puzzle_solved": True
                    })
            else:
                # Wrong answer: reset every non-finished player to 0, keep finished ones
                for p in self.progress:
                    if self.progress[p] < 5:
                        self.progress[p] = 0
                self.mqtt_client.push_update({
                    "puzzle_id": self.id,
                    "players": self._snapshot(),
                    "error_reset": {
                        "player": player,
                        "symbol": symbol,
                        "expected": expected
                    }
                })

class Puzzle3(PuzzleBase):
    def __init__(self, mqtt_client, puzzle_id):
        super().__init__(mqtt_client, puzzle_id)
        self.lock = threading.Lock()
        self.question_bank = P3_QUESTIONS
        self.chosen_questions = []       # 10 randomly selected questions
        self.current_question_idx = 0    # index in chosen_questions (0..9)
        self.streak = 0                  # number of correctly answered questions in current run (0..10)
        self.total_required = 10         # need 10 correct in a row
        self.total_players = 10
        self.answered_players = {}

    def _choose_new_set(self):
        # Pick 10 random questions from the bank
        import random
        self.chosen_questions = random.sample(self.question_bank, min(10, len(self.question_bank)))
        self.current_question_idx = 0
        self.streak = 0
        self.answered_players = {}

    def _push_question(self):
        if self.current_question_idx >= len(self.chosen_questions):
            return
        q = self.chosen_questions[self.current_question_idx]
        self.mqtt_client.push_update({
            "puzzle_id": self.id,
            "question": {
                "id": q["id"],
                "q": q["q"],
                "answers": q["answers"]
            },
            "streak": self.streak,
            "target": self.total_required,
            "answered_players": list(self.answered_players.keys()),
            "answered_map": self.answered_players,
            "total_players": self.total_players
        })

    def _schedule_next_question(self, delay=5):
        def _later():
            time.sleep(delay)
            with self.lock:
                if self.streak >= self.total_required:
                    return  # already solved
                self.current_question_idx += 1
                if self.current_question_idx >= len(self.chosen_questions):
                    return
                self.answered_players = {}
                self._push_question()
        threading.Thread(target=_later, daemon=True).start()

    def on_start(self):
        with self.lock:
            self._choose_new_set()
            self._push_question()

    def reset(self):
        with self.lock:
            self._choose_new_set()
            self._push_question()

    def get_state(self):
        with self.lock:
            if self.current_question_idx >= len(self.chosen_questions):
                return {"puzzle_id": self.id, "streak": self.streak, "target": self.total_required}
            q = self.chosen_questions[self.current_question_idx]
            return {
                "puzzle_id": self.id,
                "question": {
                    "id": q["id"],
                    "q": q["q"],
                    "answers": q["answers"]
                },
                "streak": self.streak,
                "target": self.total_required,
                "answered_players": list(self.answered_players.keys()),
                "total_players": self.total_players
            }

    def handle_message(self, parts):
        # Format: P3,player,answerIndex
        if len(parts) < 3:
            return
        try:
            player = int(parts[1])
            answer_idx = int(parts[2])
        except ValueError:
            return
        with self.lock:
            # If puzzle already solved ignore
            if self.streak >= self.total_required:
                return
            # Validate player range
            if not (0 <= player < self.total_players):
                return
            # Ensure valid question
            if self.current_question_idx >= len(self.chosen_questions):
                return
            q = self.chosen_questions[self.current_question_idx]
            # Ignore duplicate answers from same player for this question
            if player in self.answered_players:
                return
            correct_idx = q.get("correct", 0)
            # Record player answer
            self.answered_players[player] = answer_idx
            # Emit incremental update so UI can mark answered
            self.mqtt_client.push_update({
                "puzzle_id": self.id,
                "player_answer": {
                    "player": player,
                    "answer": answer_idx
                },
                "streak": self.streak,
                "target": self.total_required
            })
            # If all players answered, evaluate
            if len(self.answered_players) >= self.total_players:
                all_correct = all(ans == correct_idx for ans in self.answered_players.values())
                # Capture player_answers BEFORE resetting
                player_answers_snapshot = self.answered_players.copy()
                if all_correct:
                    self.streak += 1
                else:
                    # Failure: reset to new set of 10 questions
                    self._choose_new_set()
                # Send result with captured snapshot
                self.mqtt_client.push_update({
                    "puzzle_id": self.id,
                    "question_result": {
                        "success": all_correct,
                        "correct_answer": correct_idx,
                        "player_answers": player_answers_snapshot  # use snapshot
                    },
                    "streak": self.streak,
                    "target": self.total_required
                })
                # Puzzle solved?
                if self.streak >= self.total_required:
                    self.mqtt_client.send_message("FROM_FLASK", f"P{self.id}End")
                    self.mqtt_client.push_update({
                        "puzzle_id": self.id,
                        "puzzle_solved": True,
                        "streak": self.streak,
                        "target": self.total_required
                    })
                    return
                # Advance to next question or restart with new set
                if all_correct:
                    self._schedule_next_question(delay=3)  # increased from 2 to 3
                else:
                    def _later():
                        time.sleep(3)  # increased from 2 to 3
                        with self.lock:
                            self._push_question()
                    threading.Thread(target=_later, daemon=True).start()

class Puzzle4(PuzzleBase):
    def __init__(self, mqtt_client, puzzle_id):
        super().__init__(mqtt_client, puzzle_id)
        self.lock = threading.Lock()
        self.AUDIO_SUBDIR = "audios/"
        self.streak1_folder = "P4_F1"
        self.streak2_folder = "P4_F2"
        self.streak1_sample = f"{self.streak1_folder}/song.mp3"
        self.streak2_sample = f"{self.streak2_folder}/song.mp3"
        self.streak1_sample_duration = 25  # seconds
        self.streak2_sample_duration = 36  # seconds
        self.streak1_track_map = {
            0: ("0", "WrongSongs/wrong2.mp3"), 1: ("1", f"{self.streak1_folder}/pista2.mp3"),
            2: ("2", "WrongSongs/wrong5.mp3"), 3: ("3", f"{self.streak1_folder}/pista4.mp3"),
            4: ("4", "WrongSongs/wrong1.mp3"), 5: ("5", f"{self.streak1_folder}/pista1.mp3"),
            6: ("6", "WrongSongs/wrong3.mp3"), 7: ("7", "WrongSongs/wrong4.mp3"),
            8: ("8", f"{self.streak1_folder}/pista3.mp3"), 9: ("9", "WrongSongs/wrong6.mp3"),
        }
        self.streak1_required_order = ["5", "1", "8", "3"]
        self.streak2_track_map = {
            0: ("0", f"{self.streak2_folder}/pista3.mp3"), 1: ("1", f"{self.streak2_folder}/pista2.mp3"),
            2: ("2", f"{self.streak2_folder}/pista7.mp3"), 3: ("3", "WrongSongs/wrong8.mp3"),
            4: ("4", "WrongSongs/wrong7.mp3"), 5: ("5", f"{self.streak2_folder}/pista6.mp3"),
            6: ("6", f"{self.streak2_folder}/pista1.mp3"), 7: ("7", f"{self.streak2_folder}/pista8.mp3"),
            8: ("8", f"{self.streak2_folder}/pista5.mp3"), 9: ("9", f"{self.streak2_folder}/pista4.mp3"),
        }
        self.streak2_required_order = ["6", "1", "0", "9", "8", "5", "2", "7"]
        self.total_required = 2
        self.streak = 0
        self.storing = False
        self.current_progress = 0
        self.played_sequence = []
        self.history = []
        self.solved = False
        self.playing_sample = False
        self.validating = False  # NEW: flag to block input during validation

    def _get_current_track_map(self):
        return self.streak1_track_map if self.streak == 0 else self.streak2_track_map

    def _get_current_required_order(self):
        return self.streak1_required_order if self.streak == 0 else self.streak2_required_order

    def _play_sample_with_delay(self, sample_url, duration):
        """Play sample and automatically unblock after duration"""
        def _delayed_unblock():
            time.sleep(duration)
            with self.lock:
                if not self.solved and self.playing_sample:
                    self.playing_sample = False
                    print(f"[Puzzle4] Sample finished after {duration}s, unblocking input")
                    self.mqtt_client.push_update({
                        "puzzle_id": self.id,
                        "playing_sample": False,
                        "streak": self.streak,
                        "total_required": self.total_required
                    })
        threading.Thread(target=_delayed_unblock, daemon=True).start()

    def on_start(self):
        with self.lock:
            self.streak = 0
            self.storing = False
            self.current_progress = 0
            self.played_sequence = []
            self.history = []
            self.solved = False
            self.playing_sample = True
            # Delay initial push so the frontend is ready before autoplay
            def _later():
                time.sleep(3)
                with self.lock:
                    if self.solved:
                        return
                    # Push sample start after delay
                    self.mqtt_client.push_update({
                        "puzzle_id": self.id, "streak": 0, "total_required": 2, "storing": False,
                        "current_progress": 0, "played_sequence": [], "playing_sample": True,
                        "sample_song": {"url": f"/static/{self.AUDIO_SUBDIR}{self.streak1_sample}"}, "listening": True
                    })
                    # Start unblock timer after pushing
                    self._play_sample_with_delay(self.streak1_sample, self.streak1_sample_duration)
            threading.Thread(target=_later, daemon=True).start()

    def reset(self):
        self.on_start()

    def get_state(self):
        with self.lock:
            state = {
                "puzzle_id": self.id, "streak": self.streak, "total_required": self.total_required,
                "storing": self.storing, "current_progress": self.current_progress,
                "played_sequence": self.played_sequence.copy(), "history": self.history[-25:],
                "puzzle_solved": self.solved, "playing_sample": self.playing_sample
            }
            # NEW: include sample_song in snapshot while sample is playing
            if self.playing_sample:
                sample_rel = self.streak1_sample if self.streak == 0 else self.streak2_sample
                state["sample_song"] = {"url": f"/static/{self.AUDIO_SUBDIR}{sample_rel}"}
            return state

    def handle_message(self, parts):
        if len(parts) < 2: return
        try:
            button = int(parts[1])
            song = int(parts[2]) if len(parts) >= 3 else 0
        except ValueError: return
        
        with self.lock:
            if self.solved: return
            
            if button == 4:
                # Manual sample finish (can be kept as backup)
                self.playing_sample = False
                self.mqtt_client.push_update({"puzzle_id": self.id, "playing_sample": False, "streak": self.streak, "total_required": self.total_required})
                return
            
            if self.playing_sample:
                print(f"[Puzzle4] Ignoring input while playing sample")
                return
            
            # NEW: Block input during validation
            if self.validating:
                print(f"[Puzzle4] Ignoring input during validation")
                return
            
            if button == 3:
                self.storing = True
                self.current_progress = 0
                self.played_sequence = []
                self.mqtt_client.push_update({"puzzle_id": self.id, "storing": True, "streak": self.streak, "total_required": self.total_required, "current_progress": 0, "played_sequence": []})
                return
            
            if button == 1:
                self.storing = False
                self.mqtt_client.push_update({"puzzle_id": self.id, "storing": False, "streak": self.streak, "total_required": self.total_required})
                return
            
            if button == 2:
                self.current_progress = 0
                self.played_sequence = []
                self.mqtt_client.push_update({"puzzle_id": self.id, "reset_attempt": True, "streak": self.streak, "total_required": self.total_required, "current_progress": 0, "played_sequence": []})
                return
            
            if button == 0:
                track_map = self._get_current_track_map()
                required_order = self._get_current_required_order()
                if song not in track_map: return
                track_name, rel_path = track_map[song]
                rel_path_full = f"{self.AUDIO_SUBDIR}{rel_path}"
                full_fs_path = os.path.join(self.mqtt_client.app.static_folder, rel_path_full)
                if not os.path.exists(full_fs_path):
                    print(f"[Puzzle4] Audio file NOT FOUND: {full_fs_path}")
                self.history.append(track_name)
                
                if self.storing:
                    if len(self.played_sequence) < len(required_order):
                        self.played_sequence.append(str(song))
                    
                    # Check if sequence is complete (all boxes filled)
                    if len(self.played_sequence) >= len(required_order):
                        # Mark as validating to block further input
                        self.validating = True
                        
                        def _validate_after_delay():
                            time.sleep(2)  # wait 2 seconds before validation
                            with self.lock:
                                is_correct = self.played_sequence == required_order
                                print(f"[Puzzle4] Validating: Expected={required_order}, Got={self.played_sequence}, Correct={is_correct}")
                                
                                # Send validation result (triggers green/red flash)
                                self.mqtt_client.push_update({
                                    "puzzle_id": self.id,
                                    "sequence_correct": is_correct,
                                    "streak": self.streak,
                                    "total_required": self.total_required
                                })
                                
                                # Wait 10 seconds while flashing
                                time.sleep(10)
                                
                                if is_correct:
                                    self.streak += 1
                                    temp_sequence = self.played_sequence.copy()
                                    self.played_sequence = []
                                    self.storing = False
                                    self.current_progress = 0
                                    self.validating = False
                                    
                                    if self.streak >= self.total_required:
                                        # Show "Nivel Completado" message
                                        self.mqtt_client.push_update({
                                            "puzzle_id": self.id,
                                            "show_completion": True,
                                            "streak": self.streak,
                                            "total_required": self.total_required
                                        })
                                        
                                        # Wait 10 seconds showing completion message
                                        time.sleep(5)
                                        
                                        # Then solve the puzzle
                                        self.solved = True
                                        self.mqtt_client.send_message("FROM_FLASK", f"P{self.id}End")
                                        self.mqtt_client.push_update({
                                            "puzzle_id": self.id,
                                            "puzzle_solved": True,
                                            "streak": self.streak,
                                            "total_required": self.total_required,
                                            "played_sequence": temp_sequence,
                                            "play_final": {"url": f"/static/{self.AUDIO_SUBDIR}{self.streak2_folder}/correcta.mp3"}
                                        })
                                    else:
                                        # Advance to next streak - play sample
                                        self.playing_sample = True
                                        sample_url = f"/static/{self.AUDIO_SUBDIR}{self.streak2_sample}"
                                        self.mqtt_client.push_update({
                                            "puzzle_id": self.id,
                                            "song_completed": True,
                                            "streak": self.streak,
                                            "total_required": self.total_required,
                                            "storing": False,
                                            "current_progress": 0,
                                            "played_sequence": [],
                                            "playing_sample": True,
                                            "sample_song": {"url": sample_url}
                                        })
                                        self._play_sample_with_delay(self.streak2_sample, self.streak2_sample_duration)
                                else:
                                    # Wrong sequence
                                    self.current_progress = 0
                                    self.played_sequence = []
                                    self.validating = False
                                    self.mqtt_client.push_update({
                                        "puzzle_id": self.id,
                                        "streak": self.streak,
                                        "total_required": self.total_required,
                                        "current_progress": 0,
                                        "played_sequence": []
                                    })
                        
                        threading.Thread(target=_validate_after_delay, daemon=True).start()
                
                # Always push play event
                self.mqtt_client.push_update({
                    "puzzle_id": self.id,
                    "play": {"track": track_name, "code": song, "url": f"/static/{rel_path_full}"},
                    "current_progress": len(self.played_sequence),
                    "streak": self.streak,
                    "total_required": self.total_required,
                    "played_sequence": self.played_sequence.copy()
                })

class Puzzle5(PuzzleBase):
    def __init__(self, mqtt_client, puzzle_id):
        super().__init__(mqtt_client, puzzle_id)
        self.lock = threading.Lock()
        self.round_objectives = {1: 10, 2: 30, 3: 60}  # Objective times per round
        self.round_limits = {1: 20, 2: 30, 3: 50}      # Error limits per round
        self.current_round = 0
        self.round_times = {}  # round -> {player: time}
        self.solved = False
        self.active_round = False
        self.waiting = False

    def on_start(self):
        print("Hola Manola")
        with self.lock:
            self.current_round = 0
            self.round_times = {}
            self.solved = False
            self.active_round = False
            self.waiting = True
            # Push countdown message
            print("PRE PUSH")
            self.mqtt_client.push_update({
                "puzzle_id": self.id,
                "countdown_message": "Ronda empieza en 10 segundos",
                "waiting_seconds": 10
            })
            print("POST PUSH")
            # Schedule round 1
            self._schedule_round_start(1, delay=10)
            print("FINAL")

    def reset(self):
        # Full restart identical to on_start
        self.on_start()

    def get_state(self):
        with self.lock:
            round_number = self.current_round  # frontend expects `round`
            current_times = self.round_times.get(round_number, {})
            total = sum(abs(t) for t in current_times.values()) if current_times else 0
            limit = self.round_limits.get(round_number) if round_number else None
            objective = self.round_objectives.get(round_number) if round_number else None

            state = {
                "puzzle_id": self.id,
                "round": round_number,  # IMPORTANT: align with frontend
                "times": [{"player": p, "time": t} for p, t in sorted(current_times.items())],
                "total": total,
                "limit": limit,
                "objective": objective,
                "puzzle_solved": self.solved,
                "active_round": self.active_round,
                "waiting": self.waiting,
            }

            
            '''# If we are in the initial countdown (round 0 waiting), provide countdown fields too
            if self.waiting and not self.active_round:
                if self.countdown_end_ts is not None:
                    remaining = max(0, int(self.countdown_end_ts - time.time()))
                    state.update({
                        "countdown_message": "Ronda empieza en 10 segundos" if self.current_round == 0 else f"Ronda {self.current_round} empieza pronto",
                        "waiting_seconds": remaining
                    })
            '''
                    
            return state

    def handle_message(self, parts):
        # Expect: P5,player,error_time
        # Example: P5,3,-1 means player 3 finished 1 second early (10-1=9s total)
        # Example: P5,3,3.35 means player 3 finished 3.35 seconds late (10+3.35=13.35s total)
        if len(parts) < 3:
            return
        try:
            player = int(parts[1])
            error_time = float(parts[2])
        except ValueError:
            return
        with self.lock:
            if self.solved or not self.active_round or self.current_round == 0:
                return
            times = self.round_times.setdefault(self.current_round, {})
            # Ignore duplicate player submissions
            if player in times:
                return
            # Store the actual error time (can be negative or positive)
            times[player] = error_time
            # Calculate total using absolute values
            total = sum(abs(t) for t in times.values())
            limit = self.round_limits[self.current_round]
            # Push incremental update
            self.mqtt_client.push_update({
                "puzzle_id": self.id,
                "round": self.current_round,
                "player_time": {"player": player, "time": error_time},
                "times": [{"player": p, "time": v} for p, v in sorted(times.items())],
                "total": total,
                "limit": limit
            })
            # If we have 10 players, evaluate
            if len(times) >= 10:
                self._evaluate_round_locked()

    # --- Internal helpers ---

    def _schedule_round_start(self, round_number, delay):
        def _later():
            import time
            time.sleep(delay)
            with self.lock:
                if self.solved:
                    return
                self._start_round_locked(round_number)
        import threading
        threading.Thread(target=_later, daemon=True).start()

    def _start_round_locked(self, round_number):
        self.current_round = round_number
        self.round_times[round_number] = {}
        self.active_round = True
        self.waiting = False
        # Send MQTT message to FROM_FLASK topic
        self.mqtt_client.send_message("FROM_FLASK", f"P5_Round{round_number}")
        # Push update to frontend
        self.mqtt_client.push_update({
            "puzzle_id": self.id,
            "round": round_number,
            "round_start": True,
            "objective": self.round_objectives[round_number],
            "limit": self.round_limits[round_number]
        })

    def _evaluate_round_locked(self):
        # NEW: Delay then show results, then delay again before countdown
        def _delayed_evaluation():
            time.sleep(2)  # Wait 2 seconds with boxes filled
            with self.lock:
                round_number = self.current_round
                times = self.round_times.get(round_number, {})
                # Use absolute values for total error
                total = sum(abs(t) for t in times.values())
                limit = self.round_limits[round_number]
                success = total <= limit
                self.active_round = False
                
                # Send result immediately (triggers green/red color)
                self.mqtt_client.push_update({
                    "puzzle_id": self.id,
                    "round": round_number,
                    "round_result": {
                        "success": success,
                        "total": total,
                        "limit": limit
                    }
                })
                
                # Wait 5 more seconds showing the color
                time.sleep(5)
                
                if success:
                    if round_number >= 3:
                        # Puzzle solved
                        self.solved = True
                        self.mqtt_client.send_message("FROM_FLASK", "P5_End")
                        self.mqtt_client.push_update({
                            "puzzle_id": self.id,
                            "puzzle_solved": True
                        })
                    else:
                        # Schedule next round after color display - 10 second countdown
                        self.waiting = True
                        next_round = round_number + 1
                        self.mqtt_client.push_update({
                            "puzzle_id": self.id,
                            "countdown_message": f"Ronda {next_round} empieza en 10 segundos",
                            "waiting_seconds": 10
                        })
                        self._schedule_round_start(next_round, delay=10)  # changed from 3 to 10
                else:
                    # Retry same round after color display - keep 3 seconds for retry
                    self.round_times[round_number] = {}
                    self.waiting = True
                    self.mqtt_client.push_update({
                        "puzzle_id": self.id,
                        "countdown_message": f"Ronda {round_number} reinicia en 3 segundos",
                        "waiting_seconds": 3
                    })
                    self._schedule_round_start(round_number, delay=3)
        
        threading.Thread(target=_delayed_evaluation, daemon=True).start()

class Puzzle6(PuzzleBase):
    def __init__(self, mqtt_client, puzzle_id):
        super().__init__(mqtt_client, puzzle_id)
        import threading
        self.lock = threading.Lock()
        self.duration_seconds = 60  # 5 minutes
        self.end_time = None
        self.active = False
        self.restart_pending = False
        self.restart_deadline = None
        self.last_reset_box = None
        self.last_reset_message = None
        self.solved = False
        self.monitor_thread = None
        self.last_sent_remaining = None

    # Internal helpers
    def _start_countdown_locked(self):
        import time, threading
        self.active = True
        self.restart_pending = False
        self.restart_deadline = None
        self.last_sent_remaining = None
        start_ts = int(time.time())
        self.end_time = start_ts + self.duration_seconds
        self.mqtt_client.push_update({
            "puzzle_id": self.id,
            "countdown_start": {
                "duration": self.duration_seconds,
                "start_ts": start_ts
            }
        })
        # Spawn monitor thread
        t = threading.Thread(target=self._monitor_loop, daemon=True)
        self.monitor_thread = t
        t.start()

    def _monitor_loop(self):
        import time
        while True:
            with self.lock:
                if not self.active or self.solved:
                    break
                remaining = int(self.end_time - time.time())
                if remaining < 0:
                    remaining = 0
                # Optional tick (only if second changed to avoid spam)
                if remaining != self.last_sent_remaining and remaining % 10 == 0:  # send every 10s for light traffic
                    self.mqtt_client.push_update({
                        "puzzle_id": self.id,
                        "countdown_tick": {"remaining": remaining}
                    })
                    self.last_sent_remaining = remaining
                if remaining <= 0:
                    # Solved
                    self.solved = True
                    self.active = False
                    self.mqtt_client.send_message("FROM_FLASK", "P6End")
                    self.mqtt_client.push_update({
                        "puzzle_id": self.id,
                        "puzzle_solved": True
                    })
                    break
            time.sleep(1)

    def on_start(self):
        with self.lock:
            if self.solved:
                return
            self._start_countdown_locked()

    def reset(self):
        with self.lock:
            if self.solved:
                return
            self._start_countdown_locked()

    def get_state(self):
        import time
        with self.lock:
            remaining = None
            if self.active and self.end_time:
                remaining = max(0, int(self.end_time - time.time()))
            waiting_seconds = None
            if self.restart_pending and self.restart_deadline:
                waiting_seconds = max(0, int(self.restart_deadline - time.time()))
            return {
                "puzzle_id": self.id,
                "active": self.active,
                "remaining": remaining if remaining is not None else self.duration_seconds,
                "duration": self.duration_seconds,
                "restart_pending": self.restart_pending,
                "waiting_seconds": waiting_seconds,
                "last_reset_box": self.last_reset_box,
                "last_reset_message": self.last_reset_message,
                "puzzle_solved": self.solved
            }

    def handle_message(self, parts):
        # Format: P6,<boxNumber>
        if len(parts) < 2:
            return
        try:
            box = int(parts[1])
        except ValueError:
            return
        with self.lock:
            if self.solved:
                return
            # Ignore if already waiting to restart
            if self.restart_pending:
                return
            # Trigger reset sequence
            self.active = False
            self.restart_pending = True
            self.last_reset_box = box
            self.last_reset_message = f"Caja Numero {box} sin energía, cargando sistema..."
            self.restart_deadline = __import__("time").time() + 10
            #self.mqtt_client.send_message("FROM_FLASK", "P6Fail")
            self.mqtt_client.push_update({
                "puzzle_id": self.id,
                "countdown_reset": {
                    "box": box,
                    "message": self.last_reset_message,
                    "waiting_seconds": 10
                }
            })
            # Schedule restart
            def _later():
                import time
                time.sleep(10)
                with self.lock:
                    if self.solved:
                        return
                    self.restart_pending = False
                    self.mqtt_client.send_message("FROM_FLASK", "P6Start")
                    self._start_countdown_locked()
            import threading
            threading.Thread(target=_later, daemon=True).start()

class Puzzle7(PuzzleBase):
    def __init__(self, mqtt_client, puzzle_id):
        super().__init__(mqtt_client, puzzle_id)
        self.lock = threading.Lock()
        self.solved_boxes = set()
        self.solved = False
        # NEW: solutions per box (string codes with leading zeros preserved)
        self.solution_codes = {
            0: "0424",
            1: "4143",
            2: "1234",
            3: "1134",
            4: "3333",
            5: "4310",
            6: "1143",
            7: "2220",
            8: "1111",
            9: "2234",
        }

    def on_start(self):
        with self.lock:
            self.solved_boxes = set()
            self.solved = False
            self.mqtt_client.push_update({
                "puzzle_id": self.id,
                "solved_boxes": sorted(self.solved_boxes),
                "puzzle_solved": False
            })

    def reset(self):
        self.on_start()

    def get_state(self):
        with self.lock:
            return {
                "puzzle_id": self.id,
                "solved_boxes": sorted(self.solved_boxes),
                "puzzle_solved": self.solved
            }

    def handle_message(self, parts):
        # Expect: P7,boxIndex,code (code is a string like "0341")
        if len(parts) < 3:
            return
        try:
            box = int(parts[1])
        except ValueError:
            return
        if not (0 <= box <= 9):
            return
        code = parts[2].strip()  # keep as string to preserve leading zeros

        with self.lock:
            if self.solved:
                return
            # If already solved, ignore any further checks
            if box in self.solved_boxes:
                return

            expected = self.solution_codes.get(box)
            if expected is None:
                return  # no configured solution, ignore

            # Validate received code for this box
            if code != expected:
                return  # wrong code, do nothing

            # Correct: mark solved
            self.solved_boxes.add(box)
            self.mqtt_client.push_update({
                "puzzle_id": self.id,
                "solved_box": box,
                "solved_boxes": sorted(self.solved_boxes)
            })

            # If all boxes solved, finish puzzle
            if len(self.solved_boxes) >= 10:
                self.solved = True
                self.mqtt_client.send_message("FROM_FLASK", f"P{self.id}End")
                self.mqtt_client.push_update({
                    "puzzle_id": self.id,
                    "puzzle_solved": True,
                    "solved_boxes": sorted(self.solved_boxes)
                })

class Puzzle8(PuzzleBase):
    def __init__(self, mqtt_client, puzzle_id):
        super().__init__(mqtt_client, puzzle_id)
        self.lock = threading.Lock()
        self.symbols = ["alpha", "beta", "delta", "epsilon", "gamma", "lambda", "mu", "omega", "pi", "sigma"]
        self.palette = ["yellow", "black", "white", "red", "blue", "green"]
        # Flow state
        self.token_numbers = [18, 14, 17, 5, 20, 10, 13, 31, 35, 22]
        self.round_total = 3
        self.round = 0
        self.phase = "idle"
        self._timers = []
        # Targets shown during "tokens" phase
        self.target_symbols_order = []      # list in box order (kept for round 1 compatibility)
        self.target_colors_per_symbol = {}  # symbol -> color (round 1)
        # NEW: support multi-part tokens phase for round 2
        self.target_sets = []               # list of parts: [{symbols: [...], colors: {sym: color}}, ...]
        self._tokens_part = 0               # which part is displayed in tokens phase
        # Player inputs in "input" phase
        self.player_colors = {}             # boxIndex -> list of colors in order
        self.player_symbols = {}            # boxIndex -> list of symbols in order
        # Map numeric MQTT color codes to names
        self.color_code_map = {
            0: "yellow",
            1: "black",
            2: "white",
            3: "red",
            4: "blue",
            5: "green",
        }
        # NEW: map numeric symbol codes to names (alpha=0, beta=1, delta=2, epsilon=3, gamma=4, lambda=5, mu=6, omega=7, pi=8, sigma=9)
        self.symbol_code_map = {
            0: "alpha", 1: "beta", 2: "delta", 3: "epsilon", 4: "gamma",
            5: "lambda", 6: "mu", 7: "omega", 8: "pi", 9: "sigma"
        }
        self.solved = False

    def _schedule(self, fn, delay):
        t = threading.Timer(delay, fn)
        self._timers.append(t)
        t.start()

    def _cancel_timers(self):
        for t in self._timers:
            try: t.cancel()
            except: pass
        self._timers.clear()

    def _push(self, data):
        base = {"puzzle_id": self.id, "round": self.round, "phase": self.phase}
        base.update(data)
        self.mqtt_client.push_update(base)

    def on_start(self):
        with self.lock:
            self._cancel_timers()
            self.round = 1  # start from round 1 normally
            self.phase = "idle"
            self.target_symbols_order = []
            self.target_colors_per_symbol = {}
            # NEW: reset multi-part targets and inputs
            self.target_sets = []
            self._tokens_part = 0
            self.player_colors = {}
            self.player_symbols = {}
            self.solved = False
            # 1) clear frames
            self._push({"clear": True})
            # 2) wait 5s then numbers
            self._schedule(self._show_numbers, 5)

    def reset(self):
        with self.lock:
            self._cancel_timers()
        self.on_start()

    def get_state(self):
        with self.lock:
            state = {"puzzle_id": self.id, "round": self.round, "phase": self.phase, "puzzle_solved": self.solved}
            if self.phase == "numbers":
                state["token_numbers"] = self.token_numbers
            elif self.phase == "tokens":
                # NEW: serve the currently displayed part (round 2) or round-1 simple set
                if self.target_sets:
                    part = max(0, min(self._tokens_part, len(self.target_sets) - 1))
                    current = self.target_sets[part]
                    state["symbols"] = current["symbols"][:]
                    state["colors"] = current["colors"].copy()
                else:
                    state["symbols"] = self.target_symbols_order[:]
                    state["colors"] = self.target_colors_per_symbol.copy()
            elif self.phase == "input":
                state["clear"] = True
                # Provide first set symbols for reference (frontend uses input updates to render actual)
                if self.target_sets:
                    state["symbols"] = self.target_sets[0]["symbols"][:]
                else:
                    state["symbols"] = self.target_symbols_order[:]
                # Flatten latest input for hydration (last of each list)
                flat_colors = {box: cols[-1] for box, cols in self.player_colors.items() if cols}
                flat_symbols = {box: syms[-1] for box, syms in self.player_symbols.items() if syms}
                state["input_colors"] = flat_colors
                state["input_symbols"] = flat_symbols
            else:
                state["clear"] = True
            return state

    def _show_numbers(self):
        with self.lock:
            if self.mqtt_client.current_puzzle_id != self.id: return
            # 3) show numbers (3s)
            self.phase = "numbers"
            self._push({"token_numbers": self.token_numbers})
            self._schedule(self._show_tokens, 3)

    def _show_tokens(self):
        with self.lock:
            if self.mqtt_client.current_puzzle_id != self.id: return
            import random
            self.phase = "tokens"
            self._tokens_part = 0
            self.target_sets = []
            # ROUND 3: three sequential symbol/color sets (3s each)
            if self.round == 3:
                symbols1 = random.sample(self.symbols, len(self.symbols)); colors1 = {s: random.choice(self.palette) for s in symbols1}
                symbols2 = random.sample(self.symbols, len(self.symbols)); colors2 = {s: random.choice(self.palette) for s in symbols2}
                symbols3 = random.sample(self.symbols, len(self.symbols)); colors3 = {s: random.choice(self.palette) for s in symbols3}
                self.target_sets = [
                    {"symbols": symbols1, "colors": colors1},
                    {"symbols": symbols2, "colors": colors2},
                    {"symbols": symbols3, "colors": colors3},
                ]
                # Keep compatibility fields pointing to part 1
                self.target_symbols_order = symbols1[:]
                self.target_colors_per_symbol = colors1.copy()
                # Show part 1, then 2, then 3
                self._push({"symbols": symbols1, "colors": colors1})
                self._schedule(self._show_tokens_part2, 3)
            elif self.round == 2:
                # ...existing code for two parts...
                symbols1 = random.sample(self.symbols, len(self.symbols)); colors1 = {s: random.choice(self.palette) for s in symbols1}
                symbols2 = random.sample(self.symbols, len(self.symbols)); colors2 = {s: random.choice(self.palette) for s in symbols2}
                self.target_sets = [
                    {"symbols": symbols1, "colors": colors1},
                    {"symbols": symbols2, "colors": colors2},
                ]
                self.target_symbols_order = symbols1[:]
                self.target_colors_per_symbol = colors1.copy()
                self._push({"symbols": symbols1, "colors": colors1})
                self._schedule(self._show_tokens_part2, 3)
            else:
                # Round 1: single set for 5s
                symbols = random.sample(self.symbols, len(self.symbols)); colors = {s: random.choice(self.palette) for s in symbols}
                self.target_sets = [{"symbols": symbols, "colors": colors}]
                self.target_symbols_order = symbols[:]
                self.target_colors_per_symbol = colors.copy()
                self._push({"symbols": symbols, "colors": colors})
                self._schedule(self._enter_input_phase, 5)

    def _show_tokens_part2(self):
        with self.lock:
            if self.mqtt_client.current_puzzle_id != self.id: return
            if not self.target_sets or len(self.target_sets) < 2:
                self._enter_input_phase(); return
            self._tokens_part = 1
            part2 = self.target_sets[1]
            self._push({"symbols": part2["symbols"], "colors": part2["colors"]})
            # If round 3, schedule part 3; else go to input
            if len(self.target_sets) >= 3:
                self._schedule(self._show_tokens_part3, 3)
            else:
                self._schedule(self._enter_input_phase, 3)

    # NEW: round-3 tokens third part, then go to input
    def _show_tokens_part3(self):
        with self.lock:
            if self.mqtt_client.current_puzzle_id != self.id: return
            if len(self.target_sets) < 3:
                self._enter_input_phase(); return
            self._tokens_part = 2
            part3 = self.target_sets[2]
            self._push({"symbols": part3["symbols"], "colors": part3["colors"]})
            self._schedule(self._enter_input_phase, 3)

    def _enter_input_phase(self):
        with self.lock:
            if self.mqtt_client.current_puzzle_id != self.id: return
            self.phase = "input"
            self.player_colors = {}
            self.player_symbols = {}
            base_symbols = self.target_sets[0]["symbols"] if self.target_sets else self.target_symbols_order[:]
            self._push({"clear": True, "symbols": base_symbols})

    def _evaluate_inputs_locked(self):
        # Required entries per box equals the round (1, 2, or 3)
        required = max(1, min(self.round, len(self.target_sets)))
        # Ensure all boxes filled with required items
        for i in range(10):
            if len(self.player_colors.get(i, [])) < required or len(self.player_symbols.get(i, [])) < required:
                return
        # Build per-box results
        box_results = {}
        if required >= 2:
            # Compare each position against corresponding target set
            for i in range(10):
                cs = self.player_symbols.get(i, [])
                cc = self.player_colors.get(i, [])
                ok = True
                for pos in range(required):
                    s_list = self.target_sets[pos]["symbols"]; c_map = self.target_sets[pos]["colors"]
                    if cs[pos] != s_list[i] or cc[pos] != c_map.get(s_list[i]):
                        ok = False; break
                box_results[i] = ok
        else:
            s = self.target_sets[0]["symbols"]; c = self.target_sets[0]["colors"]
            for i in range(10):
                cs = self.player_symbols.get(i, []); cc = self.player_colors.get(i, [])
                box_results[i] = (len(cs) >= 1 and len(cc) >= 1 and cs[0] == s[i] and cc[0] == c.get(s[i]))
        success = all(box_results.values())
        def _flow():
            time.sleep(2)
            with self.lock:
                self._push({"input_result": {"success": success, "box_results": box_results}})
            time.sleep(5)
            with self.lock:
                if success and self.round >= self.round_total:
                    self.solved = True
                    self.mqtt_client.send_message("FROM_FLASK", f"P{self.id}End")
                    self._push({"puzzle_solved": True})
                    return
                self.phase = "idle"
                self.player_colors.clear()
                self.player_symbols.clear()
                self._push({"clear": True})
                if success and self.round < self.round_total:
                    self.round += 1
                self._schedule(self._show_numbers, 5)
        threading.Thread(target=_flow, daemon=True).start()

    def handle_message(self, parts):
        # Accept during input phase: P8,<symbolCode>,<tokenNumber>,<colorCode>
        if len(parts) < 3: return
        with self.lock:
            if self.solved: return
            if self.phase != "input": return
            required = max(1, min(self.round, len(self.target_sets)))
            box = None; symbol_name = None; color_name = None
            if len(parts) >= 4:
                try:
                    symbol_code = int(parts[1]); token_number = int(parts[2]); color_code = int(parts[3])
                except ValueError:
                    return
                symbol_name = self.symbol_code_map.get(symbol_code)
                color_name = self.color_code_map.get(color_code)
                if symbol_name is None or color_name is None: return
                try:
                    box = self.token_numbers.index(token_number)
                except ValueError:
                    return
            else:
                return
            if box is None or not (0 <= box <= 9) or symbol_name is None or color_name is None:
                return
            syms = self.player_symbols.setdefault(box, [])
            cols = self.player_colors.setdefault(box, [])
            # Capacity rule: allow up to `required` entries
            if len(cols) >= required:
                return
            # Append in order
            syms.append(symbol_name)
            cols.append(color_name)
            self._push({"input_update": {"box": box, "symbol": symbol_name, "color": color_name}})
            if all(len(self.player_colors.get(i, [])) >= required for i in range(10)):
                self._evaluate_inputs_locked()

class Puzzle9(PuzzleBase):
    def __init__(self, mqtt_client, puzzle_id):
        super().__init__(mqtt_client, puzzle_id)
        self.lock = threading.Lock()
        # CHANGED: Boxes are 0..9
        self.box_tokens = {i: None for i in range(0, 10)}
        # CHANGED: solution remapped so "Box 10 -> Token 22" becomes box 0
        self.solution = {
            1: 18, 2: 14, 3: 17, 4: 5, 5: 20,
            6: 10, 7: 13, 8: 31, 9: 35, 0: 22
        }
        self.solved = False
        self._good_timer_running = False

    def on_start(self):
        with self.lock:
            self.box_tokens = {i: None for i in range(0, 10)}  # CHANGED
            self.solved = False
            self._good_timer_running = False
            self.mqtt_client.push_update({
                "puzzle_id": self.id,
                "boxes": self.box_tokens.copy(),
                "status": "start",
                "puzzle_solved": False
            })

    def reset(self):
        self.on_start()

    def get_state(self):
        with self.lock:
            return {
                "puzzle_id": self.id,
                "boxes": self.box_tokens.copy(),
                "status": self._compute_status_locked(),
                "puzzle_solved": self.solved
            }

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

            self.box_tokens[box] = None if token == -1 else token
            status = self._compute_status_locked()

            self.mqtt_client.push_update({
                "puzzle_id": self.id,
                "box_update": {"box": box, "token": self.box_tokens[box]},
                "boxes": self.box_tokens.copy(),
                "status": status
            })

            if status == "good" and not self._good_timer_running:
                self._good_timer_running = True
                threading.Thread(target=self._finish_after_delay, daemon=True).start()

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
        time.sleep(5)
        with self.lock:
            # Re-check (players could have changed tokens during the 5s)
            if self.solved:
                return
            if self._compute_status_locked() != "good":
                self._good_timer_running = False
                return
            self.solved = True

        self.mqtt_client.send_message("FROM_FLASK", f"P{self.id}End")
        self.mqtt_client.push_update({
            "puzzle_id": self.id,
            "puzzle_solved": True,
            "status": "good"
        })

# --- Placeholder for future puzzles (copy & adapt Puzzle1) -------------
# class Puzzle2(PuzzleBase):
#     def on_start(self): ...
#     def handle_message(self, parts): ...
#     etc.

# --- MQTT Client -------------------------------------------------------

class MQTTClient:
    def __init__(self, app, puzzle_order):
        self.app = app
        self.puzzle_order = puzzle_order[:]  # copy
        self.client = mqtt.Client()
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.connect("localhost", 1883, 60)
        self.client.loop_start()

        self.lock = threading.Lock()
        self.update_callback = None
        self.current_puzzle_id = None

        # Puzzle registry
        self.puzzles = {}
        self._register_default_puzzles()

    # Register puzzle handler instances
    def _register_default_puzzles(self):
        # Add new puzzles here
        self.register_puzzle(Puzzle1(self, 1))
        self.register_puzzle(Puzzle2(self, 2))
        self.register_puzzle(Puzzle3(self, 3))
        self.register_puzzle(Puzzle4(self, 4))
        self.register_puzzle(Puzzle5(self, 5))
        self.register_puzzle(Puzzle6(self, 6))
        self.register_puzzle(Puzzle7(self, 7))  # NEW
        self.register_puzzle(Puzzle8(self, 8))  # NEW
        self.register_puzzle(Puzzle9(self, 9))  # NEW
        # Reserve slots for 3..10 as you implement them

    def register_puzzle(self, puzzle_obj):
        self.puzzles[puzzle_obj.id] = puzzle_obj

    def on_connect(self, client, userdata, flags, rc):
        print("Connected with result code", rc)
        self.client.subscribe("TO_FLASK")

    def on_message(self, client, userdata, msg):
        payload = msg.payload.decode()
        if msg.topic != "TO_FLASK":
            return
        parts = payload.split(',')
        if not parts:
            return
        # Expect first token like "P1"
        head = parts[0]
        if not head.startswith('P'):
            return
        try:
            pid = int(head[1:])
        except ValueError:
            return
        # Route only if puzzle exists
        puzzle = self.puzzles.get(pid)
        if not puzzle:
            return
        # Optionally enforce only current puzzle processes:
        if self.current_puzzle_id is not None and pid != self.current_puzzle_id:
            return
        puzzle.handle_message(parts)

    def set_update_callback(self, callback):
        self.update_callback = callback

    def push_update(self, data):
        if self.update_callback:
            self.update_callback(data)

    def send_message(self, topic, message):
        self.client.publish(topic, message)

    def start_puzzle(self, puzzle_id):
        with self.lock:
            if puzzle_id not in self.puzzles:
                print(f"Puzzle {puzzle_id} not registered")
                return

            # NEW: avoid restarting the same puzzle on browser refresh (F5)
            #if self.current_puzzle_id == puzzle_id:
                #return

            self.current_puzzle_id = puzzle_id
            self.puzzles[puzzle_id].on_start()

    def reset_current_puzzle(self):
        with self.lock:
            if self.current_puzzle_id in self.puzzles:
                self.puzzles[self.current_puzzle_id].reset()

    def get_current_state(self):
        with self.lock:
            if self.current_puzzle_id in self.puzzles:
                return self.puzzles[self.current_puzzle_id].get_state()
            return {}

    def timer_expired(self):
        with self.lock:
            if self.current_puzzle_id in self.puzzles:
                puzzle = self.puzzles[self.current_puzzle_id]
                if hasattr(puzzle, "on_timer_expired"):
                    puzzle.on_timer_expired()
                else:
                    puzzle.reset()
