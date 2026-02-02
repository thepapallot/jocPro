from flask import Flask, render_template, redirect, url_for, request, Response, jsonify, stream_with_context
from mqtt_client import MQTTClient
import queue
import json
import time

app = Flask(__name__)

# Configurable order of puzzles (reorder or insert/remove to change flow)
PUZZLE_ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

mqtt_client = MQTTClient(app, puzzle_order=PUZZLE_ORDER)

# Queue to stream game state to frontend
state_queue = queue.Queue()

# Callback for MQTT to push updates to frontend
def push_state_update(data):
    #print("Adding data to state_queue:", data)  # Debugging log
    state_queue.put(data)

mqtt_client.set_update_callback(push_state_update)

# Routes
@app.route('/')
def welcome():
    redirect_flag = request.args.get('redirect_flag', 'start')
    print(redirect_flag)
    idx = None
    if redirect_flag.startswith('puzzle'):
        raw = redirect_flag[len('puzzle'):]
        try:
            idx = int(raw)
            
            
        except ValueError:
            pass
    return render_template(
        'welcome.html',
        redirect_flag=redirect_flag,
        idx=idx
    )

@app.route('/videoIntro')
def play_video_intro():
    return render_template('videoIntro.html')

@app.route('/videoPuzzles/<int:idx_puzzle_id>', methods=['GET', 'POST'])
def play_video_puzzles(idx_puzzle_id): 
    return render_template('videoPuzzle.html', idx_puzzle_id=idx_puzzle_id)

@app.route('/explicacioPuzzles/<int:idx_puzzle_id>', methods=['GET', 'POST'])
def play_explicacio_puzzles(idx_puzzle_id): 
    puzzle_id = 0
    if 0 <= idx_puzzle_id < len(PUZZLE_ORDER):
        puzzle_id= PUZZLE_ORDER[idx_puzzle_id-1]  # index mapping
    return render_template('explicacioPuzzle.html', puzzle_id=puzzle_id)



@app.route('/puzzleSuperat/<int:puzzle_id>', methods=['GET', 'POST'])
def puzzle_superat(puzzle_id): 
    # Determine 1-based index for next puzzle (used in redirect_flag=puzzleN)
    idx = None
    if puzzle_id in PUZZLE_ORDER:
        idx = PUZZLE_ORDER.index(puzzle_id)
    return render_template(
        'videoSuperat.html',
        idx_puzzle_id=idx+1
    )

@app.route('/puzzle/<int:puzzle_id>', methods=['GET', 'POST'])
def puzzle(puzzle_id):
    print("STARTING PUZZLE", puzzle_id)
    # Ensure puzzle_id is in configured order
    if puzzle_id not in PUZZLE_ORDER:
        return "Invalid puzzle", 404
    # Stop any running puzzle and start the requested one (handles F5 or revisits)
    mqtt_client.stop_current_puzzle()
    #mqtt_client.start_puzzle(puzzle_id)
    # Keep MQTT start message for hardware side-effects if needed
    puzzle_index = PUZZLE_ORDER.index(puzzle_id) + 1  # 1-based sequence position
    mqtt_client.send_message("FROM_FLASK", f"P{puzzle_id}Start")
    if puzzle_id == 1:
        push_state_update({"start_timer": True, "puzzle_id": puzzle_id})
    return render_template(f'puzzle{puzzle_id}.html')

@app.route('/puzzle4_sample_finished', methods=['POST'])
def puzzle4_sample_finished():
    # Simulate MQTT message: P4,4,0 (button 4 = sample finished)
    mqtt_client.puzzles[4].handle_message(['P4', '4', '0'])
    return '', 204

#To start the puzzle from frontend
@app.route('/start_puzzle/<int:puzzle_id>', methods=['POST'])
def start_puzzle_route(puzzle_id):
    # Validate puzzle_id in configured order
    if puzzle_id not in PUZZLE_ORDER:
        return jsonify({"error": "invalid puzzle"}), 404
    # Prevent restarting if already current
    if mqtt_client.current_puzzle_id == puzzle_id:
        return jsonify({"status": "already_started"}), 200
    mqtt_client.start_puzzle(puzzle_id)
    return jsonify({"status": "started", "puzzle_id": puzzle_id}), 200


@app.route('/restart_puzzle/<int:puzzle_id>', methods=['POST'])
def restart_puzzle_route(puzzle_id):
    if puzzle_id not in PUZZLE_ORDER:
        return jsonify({"error": "invalid puzzle"}), 404
    # Stop whatever is running, then start requested puzzle
    mqtt_client.stop_current_puzzle()
    mqtt_client.start_puzzle(puzzle_id)
    return jsonify({"status": "restarted", "puzzle_id": puzzle_id}), 200

@app.route('/state_stream')
def state_stream():
    @stream_with_context
    def event_stream():
        # Immediate flush to open the stream on the client
        yield ': init\n\n'
        while True:
            data = state_queue.get()
            print("Sending SSE data:", data)
            yield f"data: {json.dumps(data)}\n\n"
    resp = Response(event_stream(), mimetype="text/event-stream")
    # Prevent buffering/caching
    resp.headers['Cache-Control'] = 'no-cache'
    resp.headers['Connection'] = 'keep-alive'
    resp.headers['X-Accel-Buffering'] = 'no'
    return resp

@app.route('/current_state')
def current_state():
    return mqtt_client.get_current_state()

@app.route('/timer_expired', methods=['POST'])
def timer_expired():
    print("Timer expired. Resetting current round/puzzle.")
    mqtt_client.timer_expired()
    return '', 204

