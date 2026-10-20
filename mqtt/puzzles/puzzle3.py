from .base import BasePuzzle
from scoring import calculate_correct_points
from scoring_config import SCORING_CONFIG
import importlib
import math
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

        self.chosen_questions = []       # Refillable batches, not a completion target.
        self.current_question_idx = 0
        self.display_question_number = 1
        self.streak = 0                  # Legacy alias for total correct questions.
        self.correct_count = 0
        self.total_points = 0
        self.duration = 5 * 60
        self.golden_every = 6
        self.golden_announcement_seconds = 4
        self.golden_announcement = False
        self._paused_remaining = None
        self._golden_timer = None
        self._clock_serial = 0
        self.deadline = None
        self.question_result = None
        self._stopped = True
        self._run_serial = 0
        self._clock_timer = None
        self._next_question_timer = None
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

    def _stage_progress(self):
        """Every fifth displayed question is medium; all others are easy."""
        return "medium" if self.display_question_number % self.golden_every == 0 else "easy"

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
        """Refill exclusively from easy/medium, never hard or company questions."""
        chosen = []
        for offset in range(self.golden_every):
            number = self.display_question_number + offset
            stage = "medium" if number % self.golden_every == 0 else "easy"
            bank = self.medium_bank if stage == "medium" else self.easy_bank
            candidates = [q for q in bank
                          if (q["_source"], q["id"]) not in self.correct_question_ids
                          and q not in chosen]
            if not candidates:
                # Recycle only this tier; do not substitute another difficulty.
                self.correct_question_ids.difference_update(
                    (q["_source"], q["id"]) for q in bank)
                candidates = [q for q in bank if q not in chosen] or bank
            chosen.append(random.choice(candidates))
        self.chosen_questions = chosen
        self.current_question_idx = 0
        self.answered_players = {}
        # Correctly solved questions remain excluded until their tier runs out.
        
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

        if stage == "medium":
            self._begin_golden_announcement_locked()
        else:
            self._publish_question_locked()

    def _publish_question_locked(self):
        q = self.chosen_questions[self.current_question_idx]

        self._push({
            "question": {
                "id": q["id"],
                "q": q["q"],
                "answers": q["answers"]
            },
            "question_number": self.display_question_number,
            "question_result": None,
            "answered_players": [],
            "answered_map": {},
            "total_players": self.total_players
        })

    def _begin_golden_announcement_locked(self):
        """Freeze exact server time and keep the upcoming question private."""
        self._paused_remaining = max(0, self.deadline - time.monotonic())
        self.golden_announcement = True
        self._clock_serial += 1
        if self._clock_timer is not None:
            self._clock_timer.cancel()
            self._clock_timer = None
        run_serial = self._run_serial
        question_number = self.display_question_number
        self._push({"golden_announcement": True})

        def reveal():
            with self.lock:
                if (self._stopped or self.solved or run_serial != self._run_serial
                        or not self.golden_announcement
                        or question_number != self.display_question_number):
                    return
                self._golden_timer = None
                self.deadline = time.monotonic() + self._paused_remaining
                self._paused_remaining = None
                self.golden_announcement = False
                self._publish_question_locked()
                self._schedule_clock_locked()

        self._golden_timer = threading.Timer(self.golden_announcement_seconds, reveal)
        self._golden_timer.daemon = True
        self._golden_timer.start()
        
    def _schedule_next_question(self, delay=5, advance=True):
        """Both correct and incorrect results advance; old callbacks are harmless."""
        run_serial = self._run_serial
        result = self.question_result

        def _later():
            with self.lock:
                if (run_serial != self._run_serial or self._stopped or self.solved
                        or self.question_result is not result or result is None):
                    return
                self._next_question_timer = None
                if self._expire_if_due_locked():
                    return
                self.current_question_idx += 1
                self.display_question_number += 1
                if self.current_question_idx >= len(self.chosen_questions):
                    self._choose_new_set()
                self.question_result = None
                self.answered_players = {}
                self._push_question()

        self._next_question_timer = threading.Timer(delay, _later)
        self._next_question_timer.daemon = True
        self._next_question_timer.start()

    def _remaining_locked(self):
        if self.solved:
            return 0
        if self._paused_remaining is not None:
            return max(0, math.ceil(self._paused_remaining))
        if self.deadline is None:
            return self.duration
        return max(0, math.ceil(self.deadline - time.monotonic()))

    def _hud_locked(self):
        return {
            "remaining": self._remaining_locked(),
            "duration": self.duration,
            "total_points": self.total_points,
            "correct_count": self.correct_count,
            "streak": self.streak,
            "puzzle_solved": self.solved,
            "golden_question": self._stage_progress() == "medium",
            "golden_announcement": self.golden_announcement,
            "clock_paused": self.golden_announcement,
            "question_points": self._question_points_locked(),
        }

    def _question_points_locked(self):
        multiplier = SCORING_CONFIG["puzzle3"].get("golden_multiplier", 2) if self._stage_progress() == "medium" else 1
        return calculate_correct_points("puzzle3", 1) * multiplier

    def _push(self, data):
        """Internal callers hold the puzzle lock; partial events retain the HUD."""
        state = self._hud_locked()
        state.update(data)
        super()._push(state)

    def _cancel_timers_locked(self):
        self._clock_serial += 1
        for timer in (self._clock_timer, self._next_question_timer, self._golden_timer):
            if timer is not None:
                timer.cancel()
        self._clock_timer = None
        self._next_question_timer = None
        self._golden_timer = None

    def _expire_if_due_locked(self):
        if self.solved or self._stopped:
            return True
        if self.golden_announcement:
            return False
        if self.deadline is None or time.monotonic() < self.deadline:
            return False
        self.solved = True
        self._cancel_timers_locked()
        self.mqtt_client.send_message("FROM_FLASK", f"P{self.id}End")
        self._push({"puzzle_solved": True})
        return True

    def _schedule_clock_locked(self):
        run_serial = self._run_serial
        self._clock_serial += 1
        clock_serial = self._clock_serial

        def tick():
            with self.lock:
                if (run_serial != self._run_serial or clock_serial != self._clock_serial
                    or self._stopped or self.solved or self.golden_announcement):
                    return
                self._clock_timer = None
                if not self._expire_if_due_locked():
                    self._push({})
                    self._schedule_clock_locked()

        delay = min(1, max(0, self.deadline - time.monotonic()))
        self._clock_timer = threading.Timer(delay, tick)
        self._clock_timer.daemon = True
        self._clock_timer.start()
        
    def reset(self):
        """Start one authoritative five-minute run, invalidating old timers."""
        with self.lock:
            self._run_serial += 1
            self._cancel_timers_locked()
            self.solved = False
            self.saltarPuzzle = False
            self.alwaysCorrect = False
            self._stopped = False
            self.correct_count = 0
            self.streak = 0
            self.total_points = 0
            self.display_question_number = 1
            self.question_result = None
            self.golden_announcement = False
            self._paused_remaining = None
            self.correct_by_difficulty = {"easy": 0, "medium": 0, "hard": 0}
            self._load_question_banks()
            self.correct_question_ids = set()
            self._choose_new_set()
            self.deadline = time.monotonic() + self.duration
            self._push_question()
            self._schedule_clock_locked()

    def stop(self):
        """Cleanup on puzzle stop"""
        with self.lock:
            self._run_serial += 1
            self._stopped = True
            self._cancel_timers_locked()
            self.answered_players = {}

    def timer_expired(self):
        """A client timeout cannot shorten the server-owned run."""
        with self.lock:
            self._expire_if_due_locked()
            
    def get_state(self):
        """Return current puzzle state"""
        with self.lock:
            state = {
                "puzzle_id": self.id,
                **self._hud_locked(),
                "question_number": self.display_question_number,
                "answered_players": list(self.answered_players),
                "answered_map": dict(self.answered_players),
                "total_players": self.total_players,
            }
            if not self.golden_announcement and self.current_question_idx < len(self.chosen_questions):
                q = self.chosen_questions[self.current_question_idx]
                state["question"] = {
                    "id": q["id"],
                    "q": q["q"],
                    "answers": list(q["answers"]),
                }
            if self.question_result is not None:
                state["question_result"] = {
                    **self.question_result,
                    "correct_answer": list(self.question_result["correct_answer"]),
                    "correct_answers": list(self.question_result["correct_answers"]),
                    "player_answers": dict(self.question_result["player_answers"]),
                }
            return state
            
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
        if len(parts) != 3 or parts[0] != "P3":
            return

        try:
            player = int(parts[1])
            answer_idx = self._normalize_green_red_answer(parts[2])
        except (TypeError, ValueError):
            return

        if answer_idx is None:
            return

        with self.lock:
            if self._expire_if_due_locked() or self.golden_announcement:
                return

            # Validate answer slot range: there are 10 answer positions, 0..9.
            if not (0 <= player < self.total_players):
                return

            # Ensure valid question
            if self.current_question_idx >= len(self.chosen_questions):
                return

            q = self.chosen_questions[self.current_question_idx]
            correct_values = q.get("correct", [])

            # A completed submission stays closed throughout the result window.
            # The next-question transition clears it before publishing the question.
            if len(self.answered_players) >= self.total_players:
                return

            # Record/update the answer for this answer slot.
            self.answered_players[player] = answer_idx

            # Emit incremental update so UI can mark answered.
            self._push({
                "player_answer": {
                    "player": player,
                    "answer": answer_idx
                }
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
                ) and expected_by_slot.count(5) == 4 and expected_by_slot.count(1) == 6

                player_answers_snapshot = self.answered_players.copy()

                if all_correct:
                    self.correct_count += 1
                    self.streak = self.correct_count
                    self.total_points += self._question_points_locked()
                    difficulty = q.get("_source")
                    if difficulty in self.correct_by_difficulty:
                        self.correct_by_difficulty[difficulty] += 1
                    self.correct_question_ids.add((q.get("_source"), q.get("id")))

                self.question_result = {
                    "success": all_correct,
                    "correct_answer": expected_by_slot,
                    "correct_answers": expected_by_slot,
                    "player_answers": player_answers_snapshot,
                }
                self._push({
                    "question_result": self.question_result,
                    "question_number": self.display_question_number
                })

                self._schedule_next_question(delay=7, advance=True)
