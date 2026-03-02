import paho.mqtt.client as mqtt
import json
import threading

class MQTTClient:
    def __init__(self, app, puzzle_order):
        self.app = app
        self.puzzle_order = puzzle_order
        self.puzzles = {}
        self.current_puzzle_id = None
        self.current_puzzle_index = 0
        self.update_callback = None
        self.lock = threading.Lock()
        
        # MQTT setup
        self.client = mqtt.Client()
        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message
        self.client.connect("localhost", 1883, 60)
        self.client.loop_start()
        
    def _on_connect(self, client, userdata, flags, rc):
        print(f"Connected to MQTT broker: {rc}")
        client.subscribe("TO_FLASK")
        
    def _on_message(self, client, userdata, msg):
        try:
            topic = msg.topic
            payload = msg.payload.decode('utf-8')
            parts = payload.split(',')
            
            # Route to appropriate puzzle
            if parts[0].startswith('P') and len(parts[0]) > 1:
                puzzle_id = int(parts[0][1:])
                if puzzle_id in self.puzzles:
                    self.puzzles[puzzle_id].handle_message(parts)
        except Exception as e:
            print(f"Error in _on_message: {e}")
    
    def register_puzzle(self, puzzle):
        with self.lock:
            self.puzzles[puzzle.id] = puzzle
            
    def start_puzzle(self, puzzle_id):
        with self.lock:
            if puzzle_id not in self.puzzles:
                return
            self.stop_current_puzzle()
            self.current_puzzle_id = puzzle_id
            self.puzzles[puzzle_id].reset()
            self.send_message("FROM_FLASK", f"P{puzzle_id}Start")
            
    def stop_current_puzzle(self):
        if self.current_puzzle_id and self.current_puzzle_id in self.puzzles:
            self.puzzles[self.current_puzzle_id].stop()
        self.current_puzzle_id = None
            
    def push_update(self, data):
        if self.update_callback:
            self.update_callback(data)
        topic = f"puzzles/{data.get('puzzle_id', 'unknown')}"
        self.client.publish(topic, json.dumps(data))
        
    def set_update_callback(self, callback):
        self.update_callback = callback
        
    def set_current_sequence_index(self, index):
        self.current_puzzle_index = index
        
    def send_message(self, topic, message):
        self.client.publish(topic, message)
        
    def get_current_state(self):
        if self.current_puzzle_id and self.current_puzzle_id in self.puzzles:
            return self.puzzles[self.current_puzzle_id].get_state()
        return {}
        
    def timer_expired(self):
        if self.current_puzzle_id and self.current_puzzle_id in self.puzzles:
            self.puzzles[self.current_puzzle_id].timer_expired()