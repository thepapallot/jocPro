from .base import BasePuzzle
from scoring import calculate_points, get_max_attempts
import math
import threading
import time


class Puzzle5(BasePuzzle):
    def __init__(self, mqtt_client):
        super().__init__(puzzle_id=5, mqtt_client=mqtt_client)
        self.initial_countdown_seconds = 5
        self.round_objectives = {1: 30}
        self.round_limits = {1: 10}
        self.total_rounds = len(self.round_objectives)
        self.current_round = 0
        self.round_times = {}
        self.active_round = False
        self.waiting = False
        self.waiting_deadline = None
        self.countdown_message = None
        self.attempt = 1
        self.max_attempts = get_max_attempts('puzzle5')
        self.total_points = 0
        self.exhausted = False
        self.auto_advance = False
        self.round_result = None
        self._pending_round = None
        self._pending_retry = False
        self._evaluating = False
        self._stopped = True
        self._run_serial = 0
        self._timer_serial = 0
        self._round_start_timer = None

    def reset(self):
        """Reset atomically, invalidating every callback from the previous run."""
        with self.lock:
            self._run_serial += 1
            self._cancel_timer()
            self.solved = False
            self.saltarPuzzle = False
            self.alwaysCorrect = False
            self.current_round = 0
            self.round_times = {}
            self.active_round = False
            self.waiting = False
            self.attempt = 1
            self.max_attempts = get_max_attempts('puzzle5')
            self.total_points = 0
            self.exhausted = False
            self.auto_advance = False
            self.round_result = None
            self._evaluating = False
            self._stopped = False
            self._begin_countdown_locked(1, self.initial_countdown_seconds)

    def stop(self):
        with self.lock:
            self._run_serial += 1
            self._stopped = True
            self._cancel_timer()
            self.active_round = False
            self.waiting = False
            self.waiting_deadline = None
            self.countdown_message = None
            self._pending_round = None
            self._pending_retry = False
            self._evaluating = False

    def _limit_locked(self):
        round_number = self._pending_round or self.current_round or 1
        # Preparation previews the next margin, without consuming an attempt.
        attempt = self.attempt + int(self._pending_retry)
        return self.round_limits[round_number] + 4 * (attempt - 1)

    def _state_locked(self):
        times = self.round_times.get(self.current_round, {})
        state = {
            'puzzle_id': self.id,
            'round': self.current_round,
            'total_rounds': self.total_rounds,
            'times': [{'player': p, 'time': t} for p, t in sorted(times.items())],
            'total': sum(abs(t) for t in times.values()),
            'limit': self._limit_locked(),
            'objective': self.round_objectives[self._pending_round or self.current_round or 1],
            'puzzle_solved': self.solved,
            'active_round': self.active_round,
            'waiting': self.waiting,
            'countdown_deadline': self.waiting_deadline,
            'waiting_seconds': max(0, math.ceil(self.waiting_deadline - time.time()))
            if self.waiting and self.waiting_deadline is not None else None,
            'attempt': self.attempt,
            'max_attempts': self.max_attempts,
            'available_points': 0 if self.exhausted else calculate_points('puzzle5', self.attempt - 1),
            'total_points': self.total_points,
            'puzzle_exhausted': self.exhausted,
            'auto_advance': self.auto_advance,
        }
        if self.countdown_message is not None:
            state['countdown_message'] = self.countdown_message
        if self.round_result is not None:
            state['round_result'] = dict(self.round_result)
        return state

    def get_state(self):
        with self.lock:
            return self._state_locked()

    def _push(self, data):
        """Internal callers hold self.lock; every event includes scoring/state."""
        state = self._state_locked()
        state.update(data)
        super()._push(state)

    def handle_message(self, parts):
        """Accept one finite signed error per terminal: P5,player,error_time."""
        if len(parts) != 3 or parts[0] != 'P5':
            return
        try:
            player = int(parts[1])
            error_time = float(parts[2])
        except (ValueError, TypeError, OverflowError):
            return
        if not 0 <= player < 10 or not math.isfinite(error_time):
            return
        with self.lock:
            if (self._stopped or self.solved or self.exhausted or self._evaluating
                    or not self.active_round or self.current_round == 0
                    or self.attempt > self.max_attempts):
                return
            times = self.round_times.setdefault(self.current_round, {})
            if player in times:
                return
            # Even finite individual values must not overflow the JSON total.
            if not math.isfinite(sum(abs(t) for t in times.values()) + abs(error_time)):
                return
            times[player] = error_time
            self._push({'player_time': {'player': player, 'time': error_time}})
            if len(times) == 10:
                self._evaluate_round_locked()

    def _cancel_timer(self):
        """Called under the lock, including during reset/stop."""
        self._timer_serial += 1
        if self._round_start_timer is not None:
            self._round_start_timer.cancel()
            self._round_start_timer = None

    def _schedule_locked(self, delay, callback):
        self._cancel_timer()
        run_serial = self._run_serial
        timer_serial = self._timer_serial

        def later():
            with self.lock:
                if (self._stopped or run_serial != self._run_serial
                        or timer_serial != self._timer_serial):
                    return
                self._round_start_timer = None
                # A fired callback is one-shot, even if invoked again externally.
                self._timer_serial += 1
                callback()

        self._round_start_timer = threading.Timer(delay, later)
        self._round_start_timer.daemon = True
        self._round_start_timer.start()

    def _begin_countdown_locked(self, round_number, delay, retry=False):
        self.waiting = True
        self.active_round = False
        self.waiting_deadline = time.time() + delay
        self._pending_round = round_number
        self._pending_retry = retry
        self.round_result = None
        self.round_times[round_number] = {}
        action = 'reinicia' if retry else 'empieza'
        self.countdown_message = f'Ronda {round_number} {action} en {delay} segundos'
        self._push({})
        self._schedule_round_start(round_number, delay)

    def _schedule_round_start(self, round_number, delay):
        self._schedule_locked(delay, lambda: self._start_round_locked(round_number))

    def _start_round_locked(self, round_number):
        if (self._stopped or self.solved or self.exhausted or not self.waiting
                or self._pending_round != round_number):
            return
        if self._pending_retry:
            if self.attempt >= self.max_attempts:
                return
            self.attempt += 1
        self.current_round = round_number
        self.round_times[round_number] = {}
        self.active_round = True
        self.waiting = False
        self.waiting_deadline = None
        self.countdown_message = None
        self._pending_round = None
        self._pending_retry = False
        self._evaluating = False
        self.round_result = None
        # This single logical round is hardware round 2.
        self.mqtt_client.send_message('FROM_FLASK', 'P5_Round2')
        self._push({'round_start': True})

    def _evaluate_round_locked(self):
        if self._evaluating or not self.active_round:
            return
        self._evaluating = True
        self.active_round = False
        self._schedule_locked(2, self._show_result_locked)

    def _show_result_locked(self):
        times = self.round_times[self.current_round]
        total = sum(abs(t) for t in times.values())
        limit = self._limit_locked()
        self.round_result = {'success': total <= limit, 'total': total, 'limit': limit}
        self._push({})
        self._schedule_locked(5, self._finish_result_locked)

    def _finish_result_locked(self):
        if self.round_result['success']:
            if self.current_round >= self.total_rounds or self.saltarPuzzle:
                self.solved = True
                self.total_points = calculate_points('puzzle5', self.attempt - 1)
                self._evaluating = False
                self.mqtt_client.send_message('FROM_FLASK', 'P5_End')
                self._push({})
            else:
                next_round = self.current_round + 1
                self.mqtt_client.start_next_round(self.id, next_round)
                self._begin_countdown_locked(next_round, self.initial_countdown_seconds)
        elif self.attempt >= self.max_attempts:
            self.exhausted = True
            self._evaluating = False
            self.mqtt_client.send_message('FROM_FLASK', 'P5_End')
            self._push({})
            self._schedule_locked(5, self._finish_exhausted_locked)
        else:
            self._begin_countdown_locked(self.current_round, 9, retry=True)

    def _finish_exhausted_locked(self):
        self.auto_advance = True
        self._push({})
