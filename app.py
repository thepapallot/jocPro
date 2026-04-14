from pathlib import Path

from flask import Flask, render_template, redirect, url_for, request, Response, jsonify, stream_with_context, send_from_directory, abort
from mqtt import MQTTClient, create_puzzles
from config import PUZZLE_ORDER, PUZZLE_ALIASES, PROVA_FINAL  # Import config from config.py
import queue
import json
import threading

app = Flask(__name__)
BASE_DIR = Path(__file__).resolve().parent #Directori base del projecte jocPro/

mqtt_client = MQTTClient(app, puzzle_order=PUZZLE_ORDER)

LEGACY_ALIAS_TO_SCENE = {
    "sumas": "scene_intro_sumas",
    "laberinto": "scene_intro_laberinto",
    "trivial": "scene_intro_trivial",
    "musica": "scene_intro_musica",
    "cronometro": "scene_intro_cronometro",
    "energia": "scene_intro_energia",
    "segments": "scene_intro_segments",
    "segments dificil": "scene_intro_segments",
    "memory": "scene_intro_memory",
    "token a lloc": "scene_intro_token_a_lloc",
}

# Create puzzles based on PUZZLE_ORDER
create_puzzles(mqtt_client, PUZZLE_ORDER)

# Per-client SSE queues
_sse_clients_lock = threading.Lock()
_sse_clients = []  # list of queues, one per connected client

def push_state_update(data):
    with _sse_clients_lock:
        for q in _sse_clients:
            q.put(data)

mqtt_client.set_update_callback(push_state_update)

def resolve_intro_scene_for_puzzle(puzzle_id):
    alias = PUZZLE_ALIASES.get(puzzle_id)
    if not alias:
        return None

    alias = str(alias).strip().lower()
    candidate = LEGACY_ALIAS_TO_SCENE.get(alias, alias)

    if not candidate.startswith("scene_"):
        candidate = f"scene_intro_{candidate}"

    scene_dir = (BASE_DIR / "scenes" / candidate)
    if (scene_dir / "config.json").exists():
        return candidate

    return None

# Routes
@app.route('/')
def welcome():
    redirect_flag = request.args.get('redirect_flag', 'start')  # Default to 'start' if not provided
    print(redirect_flag)
    idx = None
    if redirect_flag.startswith('puzzle'):
        raw = redirect_flag[len('puzzle'):]
        try:
            idx = int(raw)

        except ValueError:
            pass
    #elif redirect_flag == 'indexFinal':
     #   idx = -1

    return render_template(
        'welcome.html',
        redirect_flag=redirect_flag,
        idx=idx
    )

@app.route('/videoIntro')
def play_video_intro():
    next_url = url_for('welcome', redirect_flag='puzzle1')
    target = f"{url_for('scene_player')}?scene=scene_intro_game&next={next_url}"
    return redirect(target)

@app.route('/videoPuzzles/<int:idx_puzzle_id>', methods=['GET','POST'])
def play_video_puzzles(idx_puzzle_id): 
    puzzle_id = None
    if 1 <= idx_puzzle_id <= len(PUZZLE_ORDER):
        puzzle_id = PUZZLE_ORDER[idx_puzzle_id - 1]

    if puzzle_id is None:
        return redirect(url_for('welcome'))

    scene_id = resolve_intro_scene_for_puzzle(puzzle_id)

    next_url = url_for('puzzle', puzzle_id=puzzle_id)

    if not scene_id:
        return redirect(next_url)

    target = f"{url_for('scene_player')}?scene={scene_id}&next={next_url}"
    return redirect(target)

@app.route('/direct/<int:idx_puzzle_id>', methods=['GET'])
def play_directa_explicacio_puzzles(idx_puzzle_id): 
    # Render a page that immediately submits a POST to /videoPuzzles/<idx>
    return render_template('directaExplicacioPuzzle.html', idx_puzzle_id=idx_puzzle_id)

@app.route('/explicacioPuzzles/<int:idx_puzzle_id>', methods=['GET','POST'])
def play_explicacio_puzzles(idx_puzzle_id): 
    puzzle_id = 0
    if 0 <= idx_puzzle_id <= len(PUZZLE_ORDER):
        puzzle_id= PUZZLE_ORDER[idx_puzzle_id-1]  # index mapping
    return render_template('explicacioPuzzle.html', puzzle_id=puzzle_id)


@app.route('/puzzleSuperat/<int:puzzle_id>', methods=['GET', 'POST'])
def puzzle_superat(puzzle_id): 
    # Determine 1-based index for next puzzle (used in redirect_flag=puzzleN)
    idx = None
    final = False
    if puzzle_id in PUZZLE_ORDER:
        idx = PUZZLE_ORDER.index(puzzle_id)
        if idx == len(PUZZLE_ORDER)-1:
            final = True #it means that we have solved the last puzzle    

    return render_template(
        'videoSuperat.html',
        idx_puzzle_id=idx+1,
        final=final,
        prova_final=PROVA_FINAL
    )

@app.route('/videoJocFinal', methods=['GET','POST'])
def play_joc_final(): 
    next_url = url_for('puzzle_final')
    target = f"{url_for('scene_player')}?scene=scene_video_final&next={next_url}"
    return redirect(target)


##### Scene Player: rutas aisladas para intros híbridas de frontend #####
@app.route('/player/')
def scene_player():
    return send_from_directory(BASE_DIR / 'player', 'index.html')

@app.route('/player/<path:filename>')
def scene_player_assets(filename):
    return send_from_directory(BASE_DIR / 'player', filename)

@app.route('/scenes/<scene_id>/config.json')
def scene_config(scene_id):
    scene_dir = (BASE_DIR / 'scenes' / scene_id).resolve()
    scenes_root = (BASE_DIR / 'scenes').resolve()

    if scenes_root not in scene_dir.parents:
        abort(404)

    config_path = scene_dir / 'config.json'
    if not config_path.exists():
        abort(404)

    return send_from_directory(scene_dir, 'config.json')
##### Fin Scene Player #####

@app.route('/final', methods=['GET', 'POST'])
def final():
    return render_template('final.html')

@app.route('/final-loop', methods=['GET'])
def final_loop():
    return render_template('finalLoop.html')


@app.route('/puzzle/final', methods=['GET', 'POST'])
def puzzle_final():
    print("STARTING PUZZLE FINAL")
    mqtt_client.stop_current_puzzle()
    #mqtt_client.send_message("FROM_FLASK", f"PFinalStart")
    mqtt_client.set_current_sequence_index(-1)
    return render_template(f'puzzleFinal.html', current_level=-1)

@app.route('/puzzle/<int:puzzle_id>', methods=['GET', 'POST'])
def puzzle(puzzle_id):
    print("STARTING PUZZLE", puzzle_id)
    
    # Ensure puzzle_id is in configured order
    if puzzle_id not in PUZZLE_ORDER:
        return "Invalid puzzle", 404
    
    mqtt_client.stop_current_puzzle()
    
    puzzle_index = PUZZLE_ORDER.index(puzzle_id) + 1  # 1-based sequence position
    mqtt_client.set_current_sequence_index(puzzle_index)
    #mqtt_client.send_message("FROM_FLASK", f"P{puzzle_id}Start")

    return render_template(f'puzzle{puzzle_id}.html', current_level=mqtt_client.current_puzzle_index)

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
        print("Invalid puzzle_id:", puzzle_id)
        return jsonify({"error": "invalid puzzle"}), 404
    # Prevent restarting if already current
    if mqtt_client.current_puzzle_id == puzzle_id:
        print("Puzzle already started:", puzzle_id)
        return jsonify({"status": "already_started"}), 200
    
    mqtt_client.start_puzzle(puzzle_id)
    return jsonify({"status": "started", "puzzle_id": puzzle_id}), 200

@app.route('/start_puzzle_final', methods=['POST'])
def start_puzzle_final():
    #mqtt_client.send_message("FROM_FLASK", f"PFinalStart")
    mqtt_client.start_puzzle(-1)
    return jsonify({"status": "started", "puzzle_id": "final"}), 200

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
    client_queue = queue.Queue()
    with _sse_clients_lock:
        _sse_clients.append(client_queue)

    @stream_with_context
    def event_stream():
        try:
            yield ': init\n\n'
            while True:
                try:
                    data = client_queue.get(timeout=15)
                    print("Sending SSE data:", data)
                    yield f"data: {json.dumps(data)}\n\n"
                except queue.Empty:
                    yield ': keep-alive\n\n'
        except GeneratorExit:
            print("Client disconnected from SSE.")
        finally:
            with _sse_clients_lock:
                _sse_clients.remove(client_queue)

    resp = Response(event_stream(), mimetype="text/event-stream")
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


##### Entorn de desenvolupament per fer Tests#####
@app.route('/test', methods=['GET'])
def test_lab():
    return render_template(
        'test.html',
        current_level=0,
        test_puzzle_order=PUZZLE_ORDER,
        test_puzzle_aliases=PUZZLE_ALIASES
    )

@app.route('/test/send', methods=['POST'])
def test_send_message():
    data = request.get_json(silent=True) or {}
    topic = (data.get('topic') or 'TO_FLASK').strip()
    payloads = data.get('payloads')
    payload = data.get('payload')

    if payloads is None:
        payloads = [payload]

    clean_payloads = [
        str(item).strip()
        for item in payloads
        if item is not None and str(item).strip()
    ]

    if not clean_payloads:
        return jsonify({"error": "empty_payload"}), 400

    for item in clean_payloads:
        mqtt_client.send_message(topic, item)

    return jsonify({
        "status": "sent",
        "topic": topic,
        "count": len(clean_payloads),
        "payloads": clean_payloads
    }), 200


@app.route('/test/puzzle3_solution', methods=['GET'])
def test_puzzle3_solution():
    state = mqtt_client.get_current_state() or {}
    question = state.get("question") or {}
    question_id = question.get("id")

    if state.get("puzzle_id") != 3 or question_id is None:
        return jsonify({"error": "puzzle3_not_active"}), 404

    from data.puzzle3_questions import QUESTIONS as P3_QUESTIONS

    question_map = {item["id"]: item for item in P3_QUESTIONS}
    current = question_map.get(question_id)
    if not current:
        return jsonify({"error": "question_not_found"}), 404

    correct_index = current.get("correct")
    answers = current.get("answers", [])
    correct_text = None
    if isinstance(correct_index, int) and 1 <= correct_index <= len(answers):
        correct_text = answers[correct_index - 1]

    return jsonify({
        "question_id": question_id,
        "correct_answer": correct_index,
        "correct_text": correct_text
    }), 200


@app.route('/test/puzzle6/solve', methods=['POST'])
def test_puzzle6_solve():
    data = request.get_json(silent=True) or {}
    solve_value = data.get("solvePuzzle", True)
    solve_puzzle = str(solve_value).strip().lower() in ("1", "true", "yes", "on")

    puzzle6 = mqtt_client.puzzles.get(6)
    if puzzle6 is None:
        return jsonify({"error": "puzzle6_not_found"}), 404

    with puzzle6.lock:
        puzzle6.solvePuzzle = solve_puzzle

    return jsonify({"status": "ok", "puzzle_id": 6, "solvePuzzle": solve_puzzle}), 200


if __name__ == '__main__':
    app.run(debug=True)
