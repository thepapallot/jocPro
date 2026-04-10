from .base import BasePuzzle
import threading
import time

class Puzzle6(BasePuzzle):
    def __init__(self, mqtt_client):
        super().__init__(puzzle_id=6, mqtt_client=mqtt_client)
        
        self.duration_seconds = 60  # 1 minute countdown
        self.end_time = None
        self.active = False
        self.restart_pending = False
        self.restart_deadline = None
        self.last_reset_box = None
        self.last_reset_message = None
        self.monitor_thread = None
        self.last_sent_remaining = None
        self.solvePuzzle = False
        
    def _start_countdown_locked(self):
        """Start or restart the countdown timer"""
        self.active = True
        self.restart_pending = False
        self.restart_deadline = None
        self.last_sent_remaining = None
        
        start_ts = int(time.time())
        self.end_time = start_ts + self.duration_seconds
        
        self._push({
            "countdown_start": {
                "duration": self.duration_seconds,
                "start_ts": start_ts
            }
        })
        
        # Spawn monitor thread
        self.monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.monitor_thread.start()
        
    def _monitor_loop(self):
        """Background thread that monitors countdown and sends periodic updates"""
        while True:
            with self.lock:
                if not self.active or self.solved:
                    break
                    
                remaining = int(self.end_time - time.time())
                if remaining < 0:
                    remaining = 0
                    
                # Send tick updates every 10 seconds to reduce network traffic
                if remaining != self.last_sent_remaining and remaining % 10 == 0:
                    self._push({
                        "countdown_tick": {"remaining": remaining}
                    })
                    self.last_sent_remaining = remaining
                    
                # Check if countdown finished
                if remaining <= 0:
                    self.solved = True
                    self.active = False
                    self.mqtt_client.send_message("FROM_FLASK", "P6End")
                    self._push({
                        "puzzle_solved": True
                    })
                    break
                    
            time.sleep(1)
            
    def reset(self):
        """Full reset - restart countdown"""
        super().reset()
        with self.lock:
            self.solvePuzzle = False
            if not self.solved:
                self._start_countdown_locked()
                
    def stop(self):
        """Cleanup on puzzle stop"""
        with self.lock:
            self.active = False
            self.restart_pending = False
            self.restart_deadline = None
            self.last_sent_remaining = None
            # Monitor thread will exit on next iteration due to active=False
            
    def get_state(self):
        """Return current puzzle state"""
        with self.lock:
            remaining = None
            if self.active and self.end_time:
                remaining = max(0, int(self.end_time - time.time()))
                
            waiting_seconds = None
            if self.restart_pending and self.restart_deadline:
                waiting_seconds = max(0, int(self.restart_deadline - time.time()))
                
            return {
                "puzzle_id": self.id,
                "active": self.active,
                "remaining": remaining if remaining is not None else self.duration_seconds,
                "duration": self.duration_seconds,
                "restart_pending": self.restart_pending,
                "waiting_seconds": waiting_seconds,
                "last_reset_box": self.last_reset_box,
                "last_reset_message": self.last_reset_message,
                "puzzle_solved": self.solved
            }
            
    def handle_message(self, parts):
        """
        Handle MQTT message: P6,boxNumber
        
        When a box loses power, trigger 10-second reset sequence
        """
        if self.solvePuzzle:
            return

        if len(parts) < 2:
            return
            
        try:
            box = int(parts[1])
        except ValueError:
            return
            
        with self.lock:
            if self.solved:
                return
                
            # Ignore if already waiting to restart
            if self.restart_pending:
                return
                
            # Trigger reset sequence
            self.active = False
            self.restart_pending = True
            self.last_reset_box = box
            self.last_reset_message = f"Caja Numero {box} sin energía, cargando sistema..."
            self.restart_deadline = time.time() + 10
            
            self._push({
                "countdown_reset": {
                    "box": box,
                    "message": self.last_reset_message,
                    "waiting_seconds": 10
                }
            })
            
            # Schedule restart after 10 seconds
            def _restart_countdown():
                time.sleep(10)
                with self.lock:
                    if self.solved:
                        return
                    self.restart_pending = False
                    self.mqtt_client.send_message("FROM_FLASK", "P6Start")
                    self._start_countdown_locked()
                    
            threading.Thread(target=_restart_countdown, daemon=True).start()