import random
import time
import threading
import json
import paho.mqtt.client as mqtt

class MQTTClient:
    def __init__(self, app):
        self.app = app
        self.client = mqtt.Client()
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message

        self.client.connect("localhost", 1883, 60)
        self.client.loop_start()

        self.lock = threading.Lock()
        self.suma_results = [5,6,7,8,9,30,32,33,34,41,42,43,44,10,11,12,28,29,31,35,36,37,38,39,40,13,15,16,27,14,17,24,25,26,18,20,21,23,22]
        self.current_operations = []
        self.operations_with_metadata = []
        self.start_time = time.time()
        self.update_callback = None
        self.processing_wrong_result = False  # Flag to prevent processing during reset

        self.reset_operations()

    def on_connect(self, client, userdata, flags, rc):
        print("Connected with result code " + str(rc))
        self.client.subscribe("TO_FLASK")

    def on_message(self, client, userdata, msg):
        topic = msg.topic
        payload = msg.payload.decode()
        print(f"Received MQTT message on topic '{topic}': {payload}")  # Debugging log

        if topic == "P1":
            try:
                a, b = map(int, payload.split(','))
                self.check_sum_or_reset(a, b)
            except Exception as e:
                print("Invalid message payload:", payload, "Error:", e)

    def set_update_callback(self, callback):
        self.update_callback = callback

    def push_update(self, data):
        print("Pushing update to state_queue:", data)  # Debugging log
        if self.update_callback:
            self.update_callback(data)

    def send_message(self, topic, message):
        self.client.publish(topic, message)

    def reset_operations(self):
        self.current_operations = random.sample(self.suma_results, 15)
        self.operations_with_metadata = [
            [result, index + 1, "N"] for index, result in enumerate(self.current_operations)
        ]
        print("🔄 Operaciones reiniciadas:", self.operations_with_metadata)  # Debugging log

    def check_sum_or_reset(self, a, b):
        with self.lock:
            if self.processing_wrong_result:
                print("🚫 Ignoring MQTT message because a wrong result is being processed.")
                return

            result = a + b
            for operation in self.operations_with_metadata:
                if operation[0] == result and operation[2] == "N":
                    # ✅ Correct sum n
                    operation[2] = "Y"  # Mark as solved
                    solved_text = f"{a} + {b} = {result}"
                    print("✅ Acierto:", solved_text)

                    self.push_update({
                        "operations": self.operations_with_metadata.copy(),
                        "solved": {"result": result, "text": solved_text}
                    })

                    # Check if all operations are solved
                    if all(op[2] == "Y" for op in self.operations_with_metadata):
                        print("🎉 Puzzle completed!")
                        self.send_message("FROM_FLASK", "P1End")  # Send MQTT message for puzzle completion
                    return

            # ❌ Incorrect sum, restart the game after 5 seconds
            print(f"❌ Incorrect result: {a} + {b} = {result}. Marking as incorrect.")
            self.processing_wrong_result = True  # Set the flag to prevent further processing
            self.push_update({
                "operations": self.operations_with_metadata.copy(),
                "incorrect": {"result": result, "text": f"{a} + {b} = {result}"}
            })

            # Start a separate thread to handle the reset logic
            reset_thread = threading.Thread(target=self.handle_reset_with_timer)
            reset_thread.start()

    def handle_reset_with_timer(self):
        # Wait 5 seconds before resetting the game
        time.sleep(5)
        with self.lock:
            self.reset_operations()
            self.push_update({
                "operations": self.operations_with_metadata.copy(),
                "start_timer": True  # Send start_timer flag to restart the timer
            })
            self.processing_wrong_result = False  # Reset the flag
            print("🔄 Operations reset completed and timer restarted.")

    def get_current_state(self):
        with self.lock:
            return {
                "operations": self.operations_with_metadata.copy()
            }

    def start_phase(self):
        with self.lock:
            self.reset_operations()
            print("Starting phase with operations:", self.operations_with_metadata)  # Debugging log
            self.push_update({
                "operations": self.operations_with_metadata.copy()
            })

