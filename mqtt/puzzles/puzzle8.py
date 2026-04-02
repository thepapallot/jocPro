from .base import BasePuzzle
import threading
import time
import random

class Puzzle8(BasePuzzle):
    def __init__(self, mqtt_client):
        super().__init__(puzzle_id=8, mqtt_client=mqtt_client)
        
        # Symbol and color palettes
        self.symbols = ["alpha", "beta", "delta", "epsilon", "gamma", 
                       "lambda", "mu", "omega", "pi", "sigma"]
        self.palette = ["yellow", "black", "white", "red", "blue", "green"]
        
        # Token numbers for each box
        self.token_numbers = [18, 14, 17, 5, 20, 10, 13, 31, 35, 22]
        
        # Round configuration
        self.round_total = 3
        self.round = 0
        self.phase = "idle"
        self._timers = []
        
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
        self.numbers_code_map = {
            0: 5, 1: 10, 2: 13, 3: 14, 4: 17,
            5: 18, 6: 20, 7: 22, 8: 31, 9: 35
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
            self.phase = "idle"
            self.target_symbols_order = []
            self.target_colors_per_symbol = {}
            self.target_sets = []
            self._tokens_part = 0
            self.player_colors = {}
            self.player_symbols = {}
            self.solved = False
            
            # Clear frames
            self._push({"clear": True})
            
            # Wait 5s then show numbers
            self._schedule(self._show_numbers, 5)
            
    def stop(self):
        """Cleanup on puzzle stop"""
        with self.lock:
            self._cancel_timers()
            self.phase = "idle"
            self.player_colors.clear()
            self.player_symbols.clear()
            
    def get_state(self):
        """Return current puzzle state"""
        with self.lock:
            state = {
                "puzzle_id": self.id,
                "round": self.round,
                "phase": self.phase,
                "puzzle_solved": self.solved
            }
            
            if self.phase == "numbers":
                state["token_numbers"] = self.token_numbers
                
            elif self.phase == "tokens":
                # Serve currently displayed part
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
            else:
                state["clear"] = True
                
            return state
            
    def _show_numbers(self):
        """Phase 1: Show token numbers for 3 seconds"""
        with self.lock:
            if self.mqtt_client.current_puzzle_id != self.id:
                return
                
            self.phase = "numbers"
            self._push({"round": self.round, "phase": self.phase,"token_numbers": self.token_numbers})
            self._schedule(self._show_tokens, 3)
            
    def _show_tokens(self):
        """Phase 2: Show symbol/color combinations"""
        with self.lock:
            if self.mqtt_client.current_puzzle_id != self.id:
                return
                
            self.phase = "tokens"
            self._tokens_part = 0
            self.target_sets = []
            
            # Round 3: Three sequential sets (3s each)
            if self.round == 3:
                symbols1 = random.sample(self.symbols, len(self.symbols))
                colors1 = {s: random.choice(self.palette) for s in symbols1}
                
                symbols2 = random.sample(self.symbols, len(self.symbols))
                colors2 = {s: random.choice(self.palette) for s in symbols2}
                
                symbols3 = random.sample(self.symbols, len(self.symbols))
                colors3 = {s: random.choice(self.palette) for s in symbols3}
                
                self.target_sets = [
                    {"symbols": symbols1, "colors": colors1},
                    {"symbols": symbols2, "colors": colors2},
                    {"symbols": symbols3, "colors": colors3}
                ]
                
                # Compatibility fields
                self.target_symbols_order = symbols1[:]
                self.target_colors_per_symbol = colors1.copy()
                
                # Show part 1
                self._push({"round": self.round, "phase": self.phase,"symbols": symbols1, "colors": colors1})
                self._schedule(self._show_tokens_part2, 3)
                
            # Round 2: Two sequential sets (3s each)
            elif self.round == 2:
                symbols1 = random.sample(self.symbols, len(self.symbols))
                colors1 = {s: random.choice(self.palette) for s in symbols1}
                
                symbols2 = random.sample(self.symbols, len(self.symbols))
                colors2 = {s: random.choice(self.palette) for s in symbols2}
                
                self.target_sets = [
                    {"symbols": symbols1, "colors": colors1},
                    {"symbols": symbols2, "colors": colors2}
                ]
                
                self.target_symbols_order = symbols1[:]
                self.target_colors_per_symbol = colors1.copy()
                
                self._push({"round": self.round, "phase": self.phase,"symbols": symbols1, "colors": colors1})
                self._schedule(self._show_tokens_part2, 3)
                
            # Round 1: Single set (5s)
            else:
                symbols = random.sample(self.symbols, len(self.symbols))
                colors = {s: random.choice(self.palette) for s in symbols}
                
                self.target_sets = [{"symbols": symbols, "colors": colors}]
                self.target_symbols_order = symbols[:]
                self.target_colors_per_symbol = colors.copy()
                
                self._push({"round": self.round, "phase": self.phase,"symbols": symbols, "colors": colors})
                self._schedule(self._enter_input_phase, 5)
                
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
            self.player_colors = {}
            self.player_symbols = {}
            
            base_symbols = (self.target_sets[0]["symbols"] if self.target_sets 
                          else self.target_symbols_order[:])
            self._push({"clear": True, "symbols": base_symbols})
            
    def _evaluate_inputs_locked(self):
        """Evaluate player inputs when all boxes filled"""
        # Required entries per box equals round number (1, 2, or 3)
        required = max(1, min(self.round, len(self.target_sets)))
        
        # Ensure all boxes have required entries
        for i in range(10):
            if (len(self.player_colors.get(i, [])) < required or 
                len(self.player_symbols.get(i, [])) < required):
                return
                
        # Build per-box results
        box_results = {}
        
        if required >= 2:
            # Multi-part: compare each position against corresponding set
            for i in range(10):
                cs = self.player_symbols.get(i, [])
                cc = self.player_colors.get(i, [])
                ok = True
                
                for pos in range(required):
                    s_list = self.target_sets[pos]["symbols"]
                    c_map = self.target_sets[pos]["colors"]
                    
                    if cs[pos] != s_list[i] or cc[pos] != c_map.get(s_list[i]):
                        ok = False
                        break
                        
                box_results[i] = ok
        else:
            # Single-part: simple comparison
            s = self.target_sets[0]["symbols"]
            c = self.target_sets[0]["colors"]
            
            for i in range(10):
                cs = self.player_symbols.get(i, [])
                cc = self.player_colors.get(i, [])
                box_results[i] = (len(cs) >= 1 and len(cc) >= 1 and 
                                 cs[0] == s[i] and cc[0] == c.get(s[i]))
                                 
        success = all(box_results.values())
        
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
                if success and self.round >= self.round_total:
                    # Puzzle solved!
                    self.solved = True
                    self.mqtt_client.send_message("FROM_FLASK", f"P{self.id}End")
                    self._push({"puzzle_solved": True})
                    return
                    
                # Reset for next round or retry
                self.phase = "idle"
                self.player_colors.clear()
                self.player_symbols.clear()
                self._push({"clear": True})
                
                if success and self.round < self.round_total:
                    self.round += 1
                    
                self._schedule(self._show_numbers, 5)
                
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
            
            # Required entries per box = round number
            required = max(1, min(self.round, len(self.target_sets)))
            
            # Capacity rule: allow up to required entries
            if len(cols) >= required:
                return
                
            # Append in order
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