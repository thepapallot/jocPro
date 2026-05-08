from abc import ABC, abstractmethod
import threading

class BasePuzzle(ABC):
    def __init__(self, puzzle_id, mqtt_client):
        self.id = puzzle_id
        self.mqtt_client = mqtt_client
        self.lock = threading.Lock()
        self.solved = False
        self.saltarPuzzle = False
        self.alwaysCorrect = False
        
    @abstractmethod
    def handle_message(self, parts):
        """Handle incoming MQTT message"""
        pass
    
    @abstractmethod
    def get_state(self):
        """Return current state as dict"""
        pass
    
    def reset(self):
        """Reset puzzle to initial state"""
        with self.lock:
            self.solved = False
            self.saltarPuzzle = False
            self.alwaysCorrect = False

    def set_control_flags(self, saltar_puzzle=None, always_correct=None):
        with self.lock:
            if saltar_puzzle is not None:
                self.saltarPuzzle = bool(saltar_puzzle)
            if always_correct is not None:
                self.alwaysCorrect = bool(always_correct)
            return {
                "saltarPuzzle": self.saltarPuzzle,
                "alwaysCorrect": self.alwaysCorrect,
            }

    def get_control_flags(self):
        with self.lock:
            return {
                "saltarPuzzle": self.saltarPuzzle,
                "alwaysCorrect": self.alwaysCorrect,
            }
            
    def stop(self):
        """Stop any running timers/threads"""
        pass
        
    def timer_expired(self):
        """Handle timer expiration"""
        pass
            
    def _push(self, data):
        """Push update with puzzle metadata"""
        base = {"puzzle_id": self.id}
        base.update(data)
        self.mqtt_client.push_update(base)