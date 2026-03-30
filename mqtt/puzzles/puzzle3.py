from .base import BasePuzzle
import threading
import time
import random

class Puzzle3(BasePuzzle):
    def __init__(self, mqtt_client):
        super().__init__(puzzle_id=3, mqtt_client=mqtt_client)
        
        # Import question bank
        from data.puzzle3_questions import QUESTIONS as P3_QUESTIONS
        self.question_bank = P3_QUESTIONS
        
        self.chosen_questions = []       # 10 randomly selected questions
        self.current_question_idx = 0    # index in chosen_questions (0..9)
        self.streak = 0                  # number of correctly answered questions in current run (0..10)
        self.total_required = 10         # need 10 correct in a row
        self.total_players = 10
        self.answered_players = {}       # {player: answer_idx}

    def _checkpoint_for_streak(self, streak):
        """Return the last unlocked checkpoint based on solved questions."""
        if streak >= 6:
            return 6
        if streak >= 3:
            return 3
        return 0
        
    def _choose_new_set(self):
        """Pick 10 random questions from the bank"""
        self.chosen_questions = random.sample(
            self.question_bank, 
            min(10, len(self.question_bank))
        )
        self.current_question_idx = 0
        self.streak = 0
        self.answered_players = {}
        
    def _push_question(self):
        """Send current question to frontend"""
        if self.current_question_idx >= len(self.chosen_questions):
            return
            
        q = self.chosen_questions[self.current_question_idx]
        self._push({
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
        """Schedule next question after delay"""
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
        
    def reset(self):
        """Full reset to start"""
        super().reset()
        with self.lock:
            self._choose_new_set()
            self._push_question()
            
    def on_start(self):
        """Called when puzzle becomes active"""
        with self.lock:
            self._choose_new_set()
            self._push_question()
            
    def stop(self):
        """Cleanup on puzzle stop"""
        with self.lock:
            self.answered_players = {}
            
    def get_state(self):
        """Return current puzzle state"""
        with self.lock:
            if self.current_question_idx >= len(self.chosen_questions):
                return {
                    "puzzle_id": self.id,
                    "streak": self.streak,
                    "target": self.total_required
                }
                
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
        """Handle MQTT message: P3,player,answerIndex"""
        if len(parts) < 3:
            return
            
        try:
            player = int(parts[1])
            answer_idx = int(parts[2])
        except ValueError:
            return
            
        with self.lock:
            # Ignore if already solved
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
            self._push({
                "player_answer": {
                    "player": player,
                    "answer": answer_idx
                },
                "streak": self.streak,
                "target": self.total_required
            })
            
            # If all players answered, evaluate
            if len(self.answered_players) >= self.total_players:
                all_correct = all(
                    ans == correct_idx 
                    for ans in self.answered_players.values()
                )
                
                # Capture player_answers BEFORE resetting
                player_answers_snapshot = self.answered_players.copy()
                
                if all_correct:
                    self.streak += 1
                else:
                    # Failure: return to last unlocked checkpoint within current set
                    checkpoint = self._checkpoint_for_streak(self.streak)
                    self.streak = checkpoint
                    self.current_question_idx = checkpoint
                    self.answered_players = {}
                    
                # Send result with captured snapshot
                self._push({
                    "question_result": {
                        "success": all_correct,
                        "correct_answer": correct_idx,
                        "player_answers": player_answers_snapshot
                    },
                    "streak": self.streak,
                    "target": self.total_required
                })
                
                # Puzzle solved?
                if self.streak >= self.total_required:
                    self.solved = True
                    self.mqtt_client.send_message("FROM_FLASK", f"P{self.id}End")
                    self._push({
                        "puzzle_solved": True,
                        "streak": self.streak,
                        "target": self.total_required
                    })
                    return
                    
                # Advance to next question or restart with new set
                if all_correct:
                    # Correct: move to next question after 5s
                    self._schedule_next_question(delay=5)
                else:
                    # Wrong: show result for 5s, then restart with new set
                    def _later():
                        time.sleep(5)
                        with self.lock:
                            self._push_question()
                            
                    threading.Thread(target=_later, daemon=True).start()
