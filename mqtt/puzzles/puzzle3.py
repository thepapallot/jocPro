from .base import BasePuzzle
import importlib
import threading
import time
import random

class Puzzle3(BasePuzzle):
    def __init__(self, mqtt_client):
        super().__init__(puzzle_id=3, mqtt_client=mqtt_client)

        self.easy_bank = []
        self.medium_bank = []
        self.hard_bank = []
        self.company_bank = []
        self._load_question_banks()

        self.chosen_questions = []       # 10 questions for the current set
        self.current_question_idx = 0    # index in chosen_questions (0..9)
        self.streak = 0                  # number of correctly answered questions in current run (0..10)
        self.total_required = 10         # need 10 correct in a row
        self.total_players = 10
        self.answered_players = {}       # {player: answer_idx}
        self.correct_question_ids = set()  # (source, id) tuples for questions solved correctly

    def _active_session_language(self):
        return self.mqtt_client.get_active_session_language()

    def _language_suffix_candidates(self):
        language = self._active_session_language()
        if language in ("ca", "cat"):
            return ["CAT", "ESP"]
        if language in ("eng", "en"):
            # Keep ENY candidate for compatibility with requested naming,
            # then fall back to current ENG files.
            return ["ENY", "ENG", "ESP"]
        if language in ("es", "esp"):
            return ["ESP"]
        return ["ESP"]

    def _import_questions(self, base_module, suffix_candidates):
        for suffix in suffix_candidates:
            module_name = f"{base_module}_{suffix}"
            try:
                module = importlib.import_module(module_name)
                return module.QUESTIONS
            except ModuleNotFoundError:
                continue
        return []

    def _load_question_banks(self):
        suffix_candidates = self._language_suffix_candidates()

        easy_questions = self._import_questions(
            "data.puzzle3.easy_questions.easy", suffix_candidates
        )
        medium_questions = self._import_questions(
            "data.puzzle3.medium_questions.medium", suffix_candidates
        )
        hard_questions = self._import_questions(
            "data.puzzle3.hard_questions.hard", suffix_candidates
        )

        if not easy_questions:
            from data.puzzle3.easy_questions.easy_ESP import QUESTIONS as easy_questions
        if not medium_questions:
            from data.puzzle3.medium_questions.medium_ESP import QUESTIONS as medium_questions
        if not hard_questions:
            from data.puzzle3.hard_questions.hard_ESP import QUESTIONS as hard_questions

        from data.puzzle3.company_questions.questions import QUESTIONS as company_questions

        self.easy_bank = [{**q, "_source": "easy"} for q in easy_questions]
        self.medium_bank = [{**q, "_source": "medium"} for q in medium_questions]
        self.hard_bank = [{**q, "_source": "hard"} for q in hard_questions]
        self.company_bank = [{**q, "_source": "company"} for q in company_questions]

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
            self._load_question_banks()
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
