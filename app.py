from flask import Flask, render_template, redirect, url_for, request, Response
from mqtt_client import MQTTClient
import queue
import json
import time

app = Flask(__name__)
mqtt_client = MQTTClient(app)

# Queue to stream game state to frontend
state_queue = queue.Queue()

# Callback for MQTT to push updates to frontend
def push_state_update(data):
    print("Adding data to state_queue:", data)  # Debugging log
    state_queue.put(data)

mqtt_client.set_update_callback(push_state_update)

# Routes
@app.route('/')
def welcome():
    return render_template('welcome.html')

@app.route('/start', methods=['POST'])
def start():
    return redirect(url_for('play_video'))

@app.route('/video')
def play_video():
    return render_template('video.html')

@app.route('/puzzle/<int:puzzle_id>')
def puzzle(puzzle_id):
    mqtt_client.start_puzzle(puzzle_id)
    mqtt_client.send_message("FROM_FLASK", f"P{puzzle_id}Start")  # Send MQTT message for puzzle start
    if( puzzle_id == 1 ):
        push_state_update({"start_timer": True, "puzzle_id": puzzle_id})  # Send start_timer flag
    return render_template(f'puzzle{puzzle_id}.html')


@app.route('/state_stream')
def state_stream():
    def event_stream():
        while True:
            data = state_queue.get()  # Retrieve data from the queue
            print("Sending SSE data:", data)  # Debugging log
            yield f"data: {json.dumps(data)}\n\n"  # Send data to the client
    
    return Response(event_stream(), mimetype="text/event-stream")

@app.route('/current_state')
def current_state():
    return mqtt_client.get_current_state()

@app.route('/timer_expired', methods=['POST'])
def timer_expired():
    print("Timer expired. Resetting puzzle.")
    mqtt_client.reset_current_puzzle()  # Reset the current puzzle
    push_state_update({"start_timer": True})  # Send start_timer flag to restart the timer
    return '', 204