import paho.mqtt.client as mqtt
import json
import threading
from typing import Optional

class MQTTClient:
    def __init__(self, app, puzzle_order):
        self.app = app
        self.puzzle_order = puzzle_order
        self.tutorial_puzzle_id = None
        self.final_puzzle_id = None
        self.puzzles = {}
        self.current_puzzle_id = None
        self.current_puzzle_index = 0
        self.update_callback = None
        self.lock = threading.Lock()
        self.connected = False
        self.last_connect_rc = None
        self.telemetry_writer = None
        self.active_session_id = None
        self.active_puzzle_row_id = None
        self.active_puzzle_num = None
        
        # MQTT setup
        self.client = mqtt.Client()
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message
        self.client.connect("localhost", 1883, 60)
        self.client.loop_start()
        
    def _on_connect(self, client, userdata, flags, rc):
        print(f"Connected to MQTT broker: {rc}")
        self.connected = (rc == 0)
        self.last_connect_rc = rc
        client.subscribe("TO_FLASK")

    def _on_disconnect(self, client, userdata, rc):
        self.connected = False
        self.last_connect_rc = rc
        
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

    def set_special_puzzle_ids(self, tutorial_puzzle_id: Optional[int] = None, final_puzzle_id: Optional[int] = None):
        with self.lock:
            self.tutorial_puzzle_id = tutorial_puzzle_id
            self.final_puzzle_id = final_puzzle_id

    def set_telemetry_writer(self, telemetry_writer):
        with self.lock:
            self.telemetry_writer = telemetry_writer

    def set_active_session_id(self, session_id: Optional[int]):
        with self.lock:
            self.active_session_id = session_id
            if session_id is None:
                self.active_puzzle_row_id = None
                self.active_puzzle_num = None

    def _resolve_puzzle_order(self, puzzle_id: int) -> int:
        if puzzle_id in self.puzzle_order:
            return self.puzzle_order.index(puzzle_id) + 1
        if self.tutorial_puzzle_id is not None and puzzle_id == self.tutorial_puzzle_id:
            return 0
        if self.final_puzzle_id is not None and puzzle_id == self.final_puzzle_id:
            return len(self.puzzle_order) + 1
        return -1

    def _record_puzzle_start_locked(self, puzzle_id: int, round_num: int = 1):
        self.active_puzzle_row_id = None
        self.active_puzzle_num = None
        if self.telemetry_writer is None or self.active_session_id is None:
            return

        puzzle_order = self._resolve_puzzle_order(puzzle_id)
        if puzzle_order < 0:
            return

        try:
            puzzle_row_id = self.telemetry_writer.record_puzzle_start(
                session_id=self.active_session_id,
                puzzle_num=puzzle_id,
                round_num=round_num,
                order=puzzle_order,
            )
            self.active_puzzle_row_id = puzzle_row_id
            self.active_puzzle_num = puzzle_id
        except Exception as e:
            print(f"[telemetry] record_puzzle_start failed: {e}")

    def start_next_round(self, puzzle_id: int, round_num: int):
        telemetry_writer = None
        active_session_id = None
        active_row_id = None
        puzzle_order = -1

        with self.lock:
            if round_num <= 1:
                return
            if self.telemetry_writer is None or self.active_session_id is None:
                return
            if self.active_puzzle_num is not None and self.active_puzzle_num != puzzle_id:
                return

            telemetry_writer = self.telemetry_writer
            active_session_id = self.active_session_id
            active_row_id = self.active_puzzle_row_id
            puzzle_order = self._resolve_puzzle_order(puzzle_id)

        if puzzle_order < 0:
            return

        if active_row_id is not None:
            try:
                telemetry_writer.end_puzzle(active_row_id)
            except Exception as e:
                print(f"[telemetry] end_puzzle failed: {e}")

        try:
            puzzle_row_id = telemetry_writer.record_puzzle_start(
                session_id=active_session_id,
                puzzle_num=puzzle_id,
                round_num=round_num,
                order=puzzle_order,
            )
        except Exception as e:
            print(f"[telemetry] record_puzzle_start failed: {e}")
            return

        with self.lock:
            if self.active_session_id != active_session_id:
                return
            self.active_puzzle_row_id = puzzle_row_id
            self.active_puzzle_num = puzzle_id

    def end_active_puzzle(self, puzzle_num: Optional[int] = None):
        with self.lock:
            if self.active_puzzle_row_id is None or self.telemetry_writer is None:
                return
            if puzzle_num is not None and self.active_puzzle_num is not None and puzzle_num != self.active_puzzle_num:
                return

            puzzle_row_id = self.active_puzzle_row_id
            self.active_puzzle_row_id = None
            self.active_puzzle_num = None

        try:
            self.telemetry_writer.end_puzzle(puzzle_row_id)
        except Exception as e:
            print(f"[telemetry] end_puzzle failed: {e}")
            
    def start_puzzle(self, puzzle_id):
        with self.lock:
            if puzzle_id not in self.puzzles:
                return
            self.stop_current_puzzle()
            self.current_puzzle_id = puzzle_id
            self.puzzles[puzzle_id].reset()
            self._record_puzzle_start_locked(puzzle_id)
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
        #if self.current_puzzle_id == -1:
        #    self.puzzles[-1].timer_expired()
