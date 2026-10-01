from .base import BasePuzzle
from collections import Counter
import threading
import time
import random

class Puzzle8(BasePuzzle):
    NUMBERS_DURATION_SECONDS = 5
    TOKENS_DURATION_SECONDS = 6

    def __init__(self, mqtt_client):
        super().__init__(puzzle_id=8, mqtt_client=mqtt_client)
        
        # Symbol and color palettes
        self.symbols = ["alpha", "beta", "delta", "epsilon", "gamma", 
                       "lambda", "mu", "omega", "pi", "sigma"]
        self.palette = ["yellow", "black", "white", "red", "blue", "green"]
        
        # Token numbers for each box
        self.token_numbers = [18, 14, 17, 5, 20, 10, 13, 31, 35, 22]
        
        # Round configuration
        self.round_total = 1
        self.round = 0
        self.phase = "idle"
        self._timers = []
        self._phase_duration_ms = 0
        self._phase_deadline = None
        
        # Target data shown during "tokens" phase
        self.target_symbols_order = []      # Box order symbols (round 1 compatibility)
        self.target_colors_per_symbol = {}  # symbol -> color (round 1)
        self.target_sets = []               # Multi-part tokens: [{symbols: [...], colors: {...}}, ...]
        self._tokens_part = 0               # Current part displayed in tokens phase
        
        # Player inputs during "input" phase
        self.player_colors = {}   # boxIndex -> list of colors
        self.player_symbols = {}  # boxIndex -> list of symbols
        
        # MQTT code mappings
        self.color_code_map = {
            2: "yellow", 4: "black", 6: "white",
            1: "red", 3: "blue", 5: "green"
        }
        self.symbol_code_map = {
            0: "alpha", 1: "beta", 2: "delta", 3: "epsilon", 4: "gamma",
            5: "lambda", 6: "mu", 7: "omega", 8: "pi", 9: "sigma"
        }
        self.symbol_name_to_code = {name: code for code, name in self.symbol_code_map.items()}
        self.numbers_code_map = {
            0: 5, 1: 10, 2: 13, 3: 14, 4: 17,
            5: 18, 6: 20, 7: 22, 8: 31, 9: 35
        }
        self.number_to_code_map = {number: code for code, number in self.numbers_code_map.items()}
        self.color_name_to_code = {name: code for code, name in self.color_code_map.items()}

    def _push(self, data):
        payload = {"round_total": self.round_total, "token_numbers": self.token_numbers[:]}
        payload.update(self._phase_timing_locked())
        payload.update(data)
        super()._push(payload)

    def _set_phase_timing_locked(self, seconds):
        self._phase_duration_ms = seconds * 1000
        self._phase_deadline = time.monotonic() + seconds if seconds else None

    def _phase_timing_locked(self):
        remaining_ms = 0
        if self._phase_deadline is not None:
            remaining_ms = max(0, round((self._phase_deadline - time.monotonic()) * 1000))
        return {
            "phase_duration_ms": self._phase_duration_ms,
            "phase_remaining_ms": min(self._phase_duration_ms, remaining_ms),
        }
        
    def _schedule(self, fn, delay):
        """Schedule a function to run after delay seconds"""
        t = threading.Timer(delay, fn)
        self._timers.append(t)
        t.start()
        
    def _cancel_timers(self):
        """Cancel all scheduled timers"""
        for t in self._timers:
            try:
                t.cancel()
            except Exception:
                pass
        self._timers.clear()
        
    def reset(self):
        """Full reset"""
        super().reset()
        with self.lock:
            self._cancel_timers()
            self.round = 1
            self.solved = False
            self._show_numbers_locked()
            
    def stop(self):
        """Cleanup on puzzle stop"""
        with self.lock:
            self._cancel_timers()
            self.phase = "idle"
            self._set_phase_timing_locked(0)
            self.player_colors.clear()
            self.player_symbols.clear()

    def _build_solution_rows_locked(self):
        """Build a per-terminal solution snapshot for the simulator."""
        rows = []
        for box, token_number in enumerate(self.token_numbers):
            entries = []
            for part_index, target_set in enumerate(self.target_sets):
                if box >= len(target_set.get("symbols", [])):
                    continue
                symbol_name = target_set["symbols"][box]
                color_name = target_set["colors"].get(symbol_name)
                entries.append({
                    "part": part_index + 1,
                    "symbol": symbol_name,
                    "symbol_code": self.symbol_name_to_code.get(symbol_name),
                    "color": color_name,
                    "color_code": self.color_name_to_code.get(color_name)
                })

            rows.append({
                "box": box,
                "token": token_number,
                "token_code": self.number_to_code_map.get(token_number),
                "entries": entries
            })
        return rows

    def _build_input_status_locked(self, required):
        """Match unordered symbol/color pairs, preserving duplicate counts."""
        status = {}
        for box in range(10):
            expected = Counter()
            for target_set in self.target_sets[:required]:
                if box >= len(target_set.get("symbols", [])):
                    continue
                symbol_name = target_set["symbols"][box]
                expected[(symbol_name, target_set["colors"].get(symbol_name))] += 1

            actual_symbols = self.player_symbols.get(box, [])
            actual_colors = self.player_colors.get(box, [])
            count = min(len(actual_symbols), len(actual_colors))
            actual = Counter(zip(actual_symbols, actual_colors))

            # Any unexpected pair or extra repetition is still incorrect.
            if actual - expected:
                status[box] = "wrong"
            elif count == required and required > 0 and actual == expected:
                status[box] = "complete"
            elif count > 0:
                status[box] = "partial"
            else:
                status[box] = "pending"
        return status
            
    def get_state(self):
        """Return current puzzle state"""
        with self.lock:
            state = {
                "puzzle_id": self.id,
                "round_total": self.round_total,
                "round": self.round,
                "phase": self.phase,
                "token_numbers": self.token_numbers[:],
                "puzzle_solved": self.solved
            }
            state.update(self._phase_timing_locked())

            if self.target_sets:
                state["solution_rows"] = self._build_solution_rows_locked()
            
            if self.phase == "numbers":
                state["token_numbers"] = self.token_numbers
                
            elif self.phase == "tokens":
                if self.target_sets:
                    state["symbol_sets"] = [
                        {
                            "symbols": target_set["symbols"][:],
                            "colors": target_set["colors"].copy()
                        }
                        for target_set in self.target_sets
                    ]
                    # Keep the original fields for older displays and tools.
                    state["symbols"] = self.target_sets[0]["symbols"][:]
                    state["colors"] = self.target_sets[0]["colors"].copy()
                else:
                    state["symbols"] = self.target_symbols_order[:]
                    state["colors"] = self.target_colors_per_symbol.copy()
                    
            elif self.phase == "input":
                state["clear"] = True
                # Provide first set symbols for reference
                if self.target_sets:
                    state["symbols"] = self.target_sets[0]["symbols"][:]
                else:
                    state["symbols"] = self.target_symbols_order[:]
                    
                # Flatten latest input (last of each list)
                flat_colors = {box: cols[-1] for box, cols in self.player_colors.items() if cols}
                flat_symbols = {box: syms[-1] for box, syms in self.player_symbols.items() if syms}
                state["input_colors"] = flat_colors
                state["input_symbols"] = flat_symbols
                state["input_required"] = max(1, len(self.target_sets))
                state["input_counts"] = {
                    box: min(len(self.player_symbols.get(box, [])), len(self.player_colors.get(box, [])))
                    for box in range(10)
                }
                state["input_entries"] = {
                    box: [
                        {"symbol": symbol, "color": color}
                        for symbol, color in zip(
                            self.player_symbols.get(box, []),
                            self.player_colors.get(box, [])
                        )
                    ]
                    for box in range(10)
                    if self.player_symbols.get(box) and self.player_colors.get(box)
                }
                state["input_status"] = self._build_input_status_locked(state["input_required"])
            else:
                state["clear"] = True
                
            return state
            
    def _show_numbers(self):
        """Phase 1: Let players locate their token for five seconds."""
        with self.lock:
            if self.mqtt_client.current_puzzle_id != self.id:
                return
            self._show_numbers_locked()

    def _show_numbers_locked(self):
        """Start or retry immediately, without an empty-screen interval."""
        self.phase = "numbers"
        self.target_symbols_order = []
        self.target_colors_per_symbol = {}
        self.target_sets = []
        self._tokens_part = 0
        self.player_colors = {}
        self.player_symbols = {}
        self._set_phase_timing_locked(self.NUMBERS_DURATION_SECONDS)
        self._push({
            "clear": True,
            "round": self.round,
            "phase": self.phase,
            "token_numbers": self.token_numbers
        })
        self._schedule(self._show_tokens, self.NUMBERS_DURATION_SECONDS)
            
    def _show_tokens(self):
        """Phase 2: Show both symbol/color combinations at the same time."""
        with self.lock:
            if self.mqtt_client.current_puzzle_id != self.id:
                return
                
            self.phase = "tokens"
            self._tokens_part = 0
            symbols1 = random.sample(self.symbols, len(self.symbols))

            # Avoid showing the same Greek letter twice on a single token.
            symbols2 = random.sample(self.symbols, len(self.symbols))
            while any(first == second for first, second in zip(symbols1, symbols2)):
                symbols2 = random.sample(self.symbols, len(self.symbols))

            colors1 = {symbol: random.choice(self.palette) for symbol in symbols1}
            colors2 = {symbol: random.choice(self.palette) for symbol in symbols2}
            self.target_sets = [
                {"symbols": symbols1, "colors": colors1},
                {"symbols": symbols2, "colors": colors2}
            ]
            self.target_symbols_order = symbols1[:]
            self.target_colors_per_symbol = colors1.copy()

            symbol_sets = [
                {"symbols": symbols1, "colors": colors1},
                {"symbols": symbols2, "colors": colors2}
            ]
            self._set_phase_timing_locked(self.TOKENS_DURATION_SECONDS)
            self._push({
                "round": self.round,
                "phase": self.phase,
                "symbol_sets": symbol_sets,
                # Compatibility fields for the simulator and older clients.
                "symbols": symbols1,
                "colors": colors1
            })
            # Preserve the previous six-second memorisation time.
            self._schedule(self._enter_input_phase, self.TOKENS_DURATION_SECONDS)
                
    def _show_tokens_part2(self):
        """Show second set of symbols/colors"""
        with self.lock:
            if self.mqtt_client.current_puzzle_id != self.id:
                return
                
            if not self.target_sets or len(self.target_sets) < 2:
                self._enter_input_phase()
                return
                
            self._tokens_part = 1
            part2 = self.target_sets[1]
            self._push({"round": self.round, "phase": self.phase,"symbols": part2["symbols"], "colors": part2["colors"]})
            
            # If round 3, schedule part 3; else go to input
            if len(self.target_sets) >= 3:
                self._schedule(self._show_tokens_part3, 3)
            else:
                self._schedule(self._enter_input_phase, 3)
                
    def _show_tokens_part3(self):
        """Show third set of symbols/colors (round 3 only)"""
        with self.lock:
            if self.mqtt_client.current_puzzle_id != self.id:
                return
                
            if len(self.target_sets) < 3:
                self._enter_input_phase()
                return
                
            self._tokens_part = 2
            part3 = self.target_sets[2]
            self._push({"round": self.round, "phase": self.phase,"symbols": part3["symbols"], "colors": part3["colors"]})
            self._schedule(self._enter_input_phase, 3)
            
    def _enter_input_phase(self):
        """Phase 3: Players input their answers"""
        with self.lock:
            if self.mqtt_client.current_puzzle_id != self.id:
                return
                
            self.phase = "input"
            self._set_phase_timing_locked(0)
            self.player_colors = {}
            self.player_symbols = {}
            
            base_symbols = (self.target_sets[0]["symbols"] if self.target_sets 
                          else self.target_symbols_order[:])
            self._push({
                "clear": True,
                "round": self.round,
                "phase": self.phase,
                "symbols": base_symbols
            })
            
    def _evaluate_inputs_locked(self):
        """Evaluate player inputs when all boxes filled"""
        required = max(1, len(self.target_sets))
        
        # Ensure all boxes have required entries
        for i in range(10):
            if (len(self.player_colors.get(i, [])) < required or 
                len(self.player_symbols.get(i, [])) < required):
                return
                
        # Use the same unordered matching for the simulator and final result.
        input_status = self._build_input_status_locked(required)
        box_results = {box: status == "complete" for box, status in input_status.items()}
                                 
        success = all(box_results.values())

        # alwaysCorrect: override evaluation — display real inputs but mark everything correct
        if self.alwaysCorrect:
            success = True
            box_results = {i: True for i in range(10)}

        # Show results in separate thread
        def _flow():
            time.sleep(2)
            with self.lock:
                self._push({
                    "round": self.round, "phase": self.phase,
                    "input_result": {
                        "success": success,
                        "box_results": box_results
                    }
                })
                
            time.sleep(5)
            
            with self.lock:
                if self.mqtt_client.current_puzzle_id != self.id:
                    return
                # saltarPuzzle: treat round 1 success as a full win
                saltar = self.saltarPuzzle
                if success and (self.round >= self.round_total or saltar):
                    # Puzzle solved!
                    self.solved = True
                    self.mqtt_client.send_message("FROM_FLASK", f"P{self.id}End")
                    self._push({"puzzle_solved": True})
                    return
                    
                if success and self.round < self.round_total:
                    self.round += 1
                    self.mqtt_client.start_next_round(self.id, self.round)

                self._show_numbers_locked()
                
        threading.Thread(target=_flow, daemon=True).start()
        
    def handle_message(self, parts):
        """
        Handle MQTT message: P8,symbolCode,tokenNumber,colorCode
        
        Example: P8,2,18,1 -> symbol=delta, token=18 (box 0), color=red
        """
        if len(parts) < 4:
            return
            
        with self.lock:
            if self.solved or self.phase != "input":
                return
                
            try:
                symbol_code = int(parts[1])
                print("Received symbol code:", symbol_code)
                token_number = int(parts[2])
                print("Received token number:", token_number)
                color_code = int(parts[3])
                print("Received color code:", color_code)
            except ValueError:
                return
                
            # Map codes to names
            symbol_name = self.symbol_code_map.get(symbol_code)
            color_name = self.color_code_map.get(color_code)
            token_number_mapped = self.numbers_code_map.get(token_number)
            
            if symbol_name is None or color_name is None:
                return
                
            # Find box index from token number
            try:
                box = self.token_numbers.index(token_number_mapped)
            except ValueError:
                return
                
            if not (0 <= box <= 9):
                return
                
            # Get or create entry lists for this box
            syms = self.player_symbols.setdefault(box, [])
            cols = self.player_colors.setdefault(box, [])
            
            # The single round requires both displayed associations.
            required = len(self.target_sets)
            
            # Capacity rule: allow up to required entries
            if len(cols) >= required:
                return

            # Preserve arrival order for display; correctness is order-independent.
            syms.append(symbol_name)
            cols.append(color_name)
            
            self._push({
                "round": self.round, "phase": self.phase,
                "input_update": {
                    "box": box,
                    "symbol": symbol_name,
                    "color": color_name
                }
            })
            
            # Check if all boxes now have required entries
            if all(len(self.player_colors.get(i, [])) >= required for i in range(10)):
                self._evaluate_inputs_locked()
