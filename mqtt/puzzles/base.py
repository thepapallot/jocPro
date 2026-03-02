from abc import ABC, abstractmethod
import threading

from abc import ABC, abstractmethod
import threading

class BasePuzzle(ABC):
    def __init__(self, puzzle_id, mqtt_client):
        self.id = puzzle_id
        self.mqtt_client = mqtt_client
        self.lock = threading.Lock()
        self.solved = False
        
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