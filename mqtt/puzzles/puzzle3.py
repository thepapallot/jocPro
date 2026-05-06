from .base import BasePuzzle
import threading
import time
import random

class Puzzle3(BasePuzzle):
    def __init__(self, mqtt_client):
        super().__init__(puzzle_id=3, mqtt_client=mqtt_client)

        # Import question banks and tag each question with its source
        from data.puzzle3.easy_questions.easy_ESP import QUESTIONS as EASY_Q
        from data.puzzle3.medium_questions.medium_ESP import QUESTIONS as MEDIUM_Q
        from data.puzzle3.hard_questions.hard_ESP import QUESTIONS as HARD_Q
        from data.puzzle3.company_questions.questions import QUESTIONS as COMPANY_Q

        self.easy_bank    = [{**q, "_source": "easy"}    for q in EASY_Q]
        self.medium_bank  = [{**q, "_source": "medium"}  for q in MEDIUM_Q]
        self.hard_bank    = [{**q, "_source": "hard"}    for q in HARD_Q]
        self.company_bank = [{**q, "_source": "company"} for q in COMPANY_Q]

        self.chosen_questions = []       # 10 questions for the current set
        self.current_question_idx = 0    # index in chosen_questions (0..9)
        self.streak = 0                  # number of correctly answered questions in current run (0..10)
        self.total_required = 10         # need 10 correct in a row
        self.total_players = 10
        self.answered_players = {}       # {player: answer_idx}
        self.correct_question_ids = set()  # (source, id) tuples for questions solved correctly

    def _checkpoint_for_streak(self, streak):
        """Return the last unlocked checkpoint based on solved questions."""
        if streak >= 6:
            return 6
        if streak >= 3:
            return 3
        return 0
        
    def _choose_new_set(self):
        """Pick 10 questions: 3 easy (slots 0-2), 3 medium (slots 3-5), 4 hard (slots 6-9).
        Company questions are injected with priority, at most one per difficulty tier."""

        def available(bank):
            return [q for q in bank if (q["_source"], q["id"]) not in self.correct_question_ids]

        easy_pool    = available(self.easy_bank)
        medium_pool  = available(self.medium_bank)
        hard_pool    = available(self.hard_bank)
        company_pool = available(self.company_bank)

        # Base selection per tier
        easy_chosen   = random.sample(easy_pool,   min(3, len(easy_pool)))
        medium_chosen = random.sample(medium_pool, min(3, len(medium_pool)))
        hard_chosen   = random.sample(hard_pool,   min(4, len(hard_pool)))

        chosen = easy_chosen + medium_chosen + hard_chosen  # ordered by difficulty

        # Inject company questions: at most 1 per tier, spread across the set
        if company_pool:
            n_inject = min(len(company_pool), 3)
            company_sample = random.sample(company_pool, n_inject)

            # One replacement slot per tier zone
            tier_ranges = [(0, 2), (3, 5), (6, len(chosen) - 1)]
            for i, (lo, hi) in enumerate(tier_ranges):
                if i >= len(company_sample):
                    break
                if lo >= len(chosen):
                    break
                hi = min(hi, len(chosen) - 1)
                slot = random.randint(lo, hi)
                chosen[slot] = company_sample[i]

        self.chosen_questions = chosen
        self.current_question_idx = 0
        self.streak = 0
        self.answered_players = {}
        # Keep self.correct_question_ids so correctly solved questions
        # are not reintroduced when creating new sets after failures.
        
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
            self.correct_question_ids = set()
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
                    self.correct_question_ids.add((q.get("_source"), q.get("id")))
                else:
                    # Failure: return to last unlocked checkpoint within current set.
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
                    # Wrong: show result for 5s, then load a new set and resume from checkpoint
                    checkpoint = self.streak

                    def _later(saved_checkpoint=checkpoint):
                        time.sleep(5)
                        with self.lock:
                            self._choose_new_set()
                            if self.chosen_questions:
                                self.current_question_idx = min(
                                    saved_checkpoint,
                                    len(self.chosen_questions) - 1
                                )
                                self.streak = self.current_question_idx
                            self._push_question()
                            
                    threading.Thread(target=_later, daemon=True).start()
