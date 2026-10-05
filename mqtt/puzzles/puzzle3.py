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

        self.chosen_questions = []       # 6 questions for the current set
        self.current_question_idx = 0    # index in chosen_questions (0..5)
        self.display_question_number = 1 # visible progress counter; does not advance on misses
        self.streak = 0                  # number of correctly answered questions in current run (0..6)
        self.total_required = 6          # need 6 correct in a row
        self.easy_required = 2
        self.medium_required = 3
        self.hard_required = 1
        self.correct_by_difficulty = {"easy": 0, "medium": 0, "hard": 0}
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

    def _shuffle_question_display(self, question):
        """Randomize the displayed answer order without losing the correctness data."""
        if not isinstance(question, dict):
            return question

        question = question.copy()
        answers = question.get("answers")
        correct = question.get("correct")
        if isinstance(correct, list) and isinstance(answers, list) and len(correct) == len(answers):
            pairs = list(zip(answers, correct))
            random.shuffle(pairs)
            question["answers"] = [item for item, _ in pairs]
            question["correct"] = [value for _, value in pairs]
        return question

    def _checkpoint_for_streak(self, streak):
        """Return the last unlocked checkpoint based on solved questions."""
        if streak >= 6:
            return 6
        if streak >= 3:
            return 3
        return 0

    def _stage_progress(self):
        """Visible difficulty gate for the six-question round.

        1/6 and 2/6 are easy, 3/6 to 5/6 are medium, and 6/6 is hard.
        Because wrong answers do not advance the progress slot, the stage is based
        on the current visible question number, not the number of solved questions.
        """
        slot = self.display_question_number
        if slot <= 2:
            return "easy"
        if slot <= 5:
            return "medium"
        return "hard"

    def _pick_question_for_stage(self, stage, excluded=None):
        """Pick a question from the active stage, excluding already-used ones."""
        bank_by_stage = {
            "easy": self.easy_bank,
            "medium": self.medium_bank,
            "hard": self.hard_bank,
        }
        bank = bank_by_stage.get(stage, [])
        excluded_pairs = set(excluded or [])
        candidates = [
            q for q in bank
            if (q.get("_source"), q.get("id")) not in self.correct_question_ids
            and (q.get("_source"), q.get("id")) not in excluded_pairs
        ]
        if not candidates:
            return None
        return random.choice(candidates)
        
    def _choose_new_set(self):
        """Pick 6 questions in difficulty order: 2 easy, 3 medium, 1 hard.
        The progression is enforced by the same order as the game goals:
        easy until 2 correct, medium until 3 more correct, then hard for the final slot.
        Company questions are injected with priority, at most one per difficulty tier."""

        def available(bank):
            return [q for q in bank if (q["_source"], q["id"]) not in self.correct_question_ids]

        easy_pool    = available(self.easy_bank)
        medium_pool  = available(self.medium_bank)
        hard_pool    = available(self.hard_bank)
        company_pool = available(self.company_bank)

        # Base selection per tier, respecting the requested order.
        easy_chosen   = random.sample(easy_pool,   min(2, len(easy_pool)))
        medium_chosen = random.sample(medium_pool, min(3, len(medium_pool)))
        hard_chosen   = random.sample(hard_pool,   min(1, len(hard_pool)))

        chosen = easy_chosen + medium_chosen + hard_chosen

        if len(chosen) < 6:
            remaining = [
                q for q in easy_pool + medium_pool + hard_pool
                if q not in chosen
            ]
            fill_needed = 6 - len(chosen)
            if fill_needed > 0 and remaining:
                chosen.extend(random.sample(remaining, min(fill_needed, len(remaining))))

        # Inject company questions: at most 1 per tier, spread across the set.
        if company_pool:
            n_inject = min(len(company_pool), 3)
            company_sample = random.sample(company_pool, n_inject)

            tier_ranges = [(0, 1), (2, 4), (5, 5)]
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
        self.display_question_number = 1
        self.streak = 0
        self.correct_by_difficulty = {"easy": 0, "medium": 0, "hard": 0}
        self.answered_players = {}
        # Keep self.correct_question_ids so correctly solved questions
        # are not reintroduced when creating new sets after failures.
        
    def _push_question(self):
        """Send current question to frontend."""
        if self.current_question_idx >= len(self.chosen_questions):
            return

        q = self.chosen_questions[self.current_question_idx]
        stage = self._stage_progress()
        current_pair = (q.get("_source"), q.get("id"))
        replacement = self._pick_question_for_stage(stage, excluded={current_pair})
        if replacement is not None:
            q = replacement

        # Shuffle the final question, including replacements after a wrong answer.
        # Store that same order for MQTT validation and state snapshots.
        q = self._shuffle_question_display(q)
        self.chosen_questions[self.current_question_idx] = q

        self._push({
            "question": {
                "id": q["id"],
                "q": q["q"],
                "answers": q["answers"]
            },
            "question_number": self.display_question_number,
            "streak": self.streak,
            "target": self.total_required,
            "total_players": self.total_players
        })
        
    def _schedule_next_question(self, delay=5, advance=True):
        """Schedule next question after delay. Wrong answers keep the same display slot."""
        def _later():
            time.sleep(delay)
            with self.lock:
                if self.streak >= self.total_required:
                    return  # already solved

                if advance:
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
                "question_number": self.display_question_number,
                "streak": self.streak,
                "target": self.total_required,
                "answered_players": list(self.answered_players.keys()),
                "total_players": self.total_players
            }
            
    def _normalize_green_red_answer(self, answer_value):
        """Accept the hardware contract: 1=red, 5=green."""
        if isinstance(answer_value, str):
            normalized = answer_value.strip().lower()
            if normalized in ("red", "r", "1"):
                return 1
            if normalized in ("green", "g", "5"):
                return 5
            return None

        try:
            normalized = int(answer_value)
        except (TypeError, ValueError):
            return None

        if normalized in (1, 5):
            return normalized
        return None

    def _normalize_expected_answer(self, expected_value):
        """Normalize question data like Y/N or bool to the red/green scheme."""
        if isinstance(expected_value, str):
            normalized = expected_value.strip().upper()
            if normalized in ("Y", "YES", "TRUE", "GREEN", "G"):
                return 5
            if normalized in ("N", "NO", "FALSE", "RED", "R"):
                return 1
            return None

        if isinstance(expected_value, bool):
            return 5 if expected_value else 1

        try:
            normalized = int(expected_value)
        except (TypeError, ValueError):
            return None

        if normalized in (1, 5):
            return normalized
        return None

    def handle_message(self, parts):
        """Handle MQTT message: P3,answerSlot,answerIndex

        answerSlot is the answer being answered (0..9). answerIndex uses the hardware
        color contract: 1=red, 5=green. Until all slots are answered, the same answer
        slot may be updated with a new value.
        """
        if len(parts) < 3:
            return

        try:
            player = int(parts[1])
            answer_idx = self._normalize_green_red_answer(parts[2])
        except ValueError:
            return

        if answer_idx is None:
            return

        with self.lock:
            # Ignore if already solved
            if self.streak >= self.total_required:
                return

            # Validate answer slot range: there are 10 answer positions, 0..9.
            if not (0 <= player < self.total_players):
                return

            # Ensure valid question
            if self.current_question_idx >= len(self.chosen_questions):
                return

            q = self.chosen_questions[self.current_question_idx]
            correct_values = q.get("correct", [])

            # Before all ten entries are filled, allow edits for the same slot.
            if len(self.answered_players) >= self.total_players and player in self.answered_players:
                return

            # Record/update the answer for this answer slot.
            self.answered_players[player] = answer_idx

            # Emit incremental update so UI can mark answered.
            self._push({
                "player_answer": {
                    "player": player,
                    "answer": answer_idx
                },
                "streak": self.streak,
                "target": self.total_required
            })

            # When every answer slot has been answered, check if the set is correct.
            if len(self.answered_players) >= self.total_players:
                expected_by_slot = []
                for idx in range(self.total_players):
                    raw_expected = correct_values[idx] if idx < len(correct_values) else 0
                    normalized = self._normalize_expected_answer(raw_expected)
                    if normalized is None:
                        normalized = 0
                    expected_by_slot.append(normalized)

                all_correct = all(
                    self.answered_players.get(slot, 0) == expected_by_slot[slot]
                    for slot in range(self.total_players)
                )

                player_answers_snapshot = self.answered_players.copy()

                if all_correct:
                    self.streak += 1
                    difficulty = q.get("_source")
                    if difficulty in self.correct_by_difficulty:
                        self.correct_by_difficulty[difficulty] += 1
                    self.display_question_number = min(
                        self.display_question_number + 1,
                        self.total_required
                    )
                    self.correct_question_ids.add((q.get("_source"), q.get("id")))
                else:
                    # No penalization and no repeats: a miss does not count toward the
                    # visible progress, but the round still moves on to the next question.
                    self.answered_players = {}

                self._push({
                    "question_result": {
                        "success": all_correct,
                        "correct_answer": expected_by_slot,
                        "correct_answers": expected_by_slot,
                        "player_answers": player_answers_snapshot
                    },
                    "streak": self.streak,
                    "target": self.total_required,
                    "question_number": self.display_question_number
                })

                if self.streak >= self.total_required:
                    self.solved = True
                    self.mqtt_client.send_message("FROM_FLASK", f"P{self.id}End")
                    self._push({
                        "puzzle_solved": True,
                        "streak": self.streak,
                        "target": self.total_required
                    })
                    return

                if all_correct:
                    # Correct answers advance to the next slot.
                    self._schedule_next_question(delay=7, advance=True)
                else:
                    # Wrong answers keep the same progress slot but fetch a fresh question
                    # from the current valid difficulty stage.
                    self._schedule_next_question(delay=7, advance=False)
