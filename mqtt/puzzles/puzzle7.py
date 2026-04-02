from .base import BasePuzzle
import threading

class Puzzle7(BasePuzzle):
    def __init__(self, mqtt_client):
        super().__init__(puzzle_id=7, mqtt_client=mqtt_client)
        
        # Solution codes per box (strings to preserve leading zeros)
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
        
        self.solved_boxes = set()
        
    def reset(self):
        """Full reset"""
        super().reset()
        with self.lock:
            self.solved_boxes = set()
            self.solved = False
            self._push({
                "solved_boxes": sorted(self.solved_boxes),
                "puzzle_solved": False
            })
            
    def stop(self):
        """Cleanup on puzzle stop"""
        pass
        
    def get_state(self):
        """Return current puzzle state"""
        with self.lock:
            return {
                "puzzle_id": self.id,
                "solved_boxes": sorted(self.solved_boxes),
                "puzzle_solved": self.solved
            }
            
    def handle_message(self, parts):
        """
        Handle MQTT message: P7,boxIndex,code
        
        Examples:
        - P7,0,0424  -> Box 0 submitted code "0424"
        - P7,5,4310  -> Box 5 submitted code "4310"
        
        Code is kept as string to preserve leading zeros
        """
        if len(parts) < 3:
            return
            
        try:
            box = int(parts[1])
        except ValueError:
            return
            
        # Validate box range
        if not (0 <= box <= 9):
            return
            
        # Keep code as string to preserve leading zeros
        code = parts[2].strip()
        
        with self.lock:
            # Ignore if puzzle already solved
            if self.solved:
                return
                
            # Ignore if box already solved
            if box in self.solved_boxes:
                return
                
            # Get expected code for this box
            expected = self.solution_codes.get(box)
            if expected is None:
                return  # No configured solution
                
            # Validate code
            if code != expected:
                return  # Wrong code, ignore silently
                
            # Correct code - mark box as solved
            self.solved_boxes.add(box)
            
            self._push({
                "solved_box": box,
                "solved_boxes": sorted(self.solved_boxes)
            })
            
            # Check if all boxes solved (10 total)
            if len(self.solved_boxes) >= 10:
                self.solved = True
                self.mqtt_client.send_message("FROM_FLASK", f"P{self.id}End")
                self._push({
                    "puzzle_solved": True,
                    "solved_boxes": sorted(self.solved_boxes)
                })