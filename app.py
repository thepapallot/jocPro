from pathlib import Path
from player_window import register_player_window

from flask import Flask, render_template, redirect, url_for, request, Response, jsonify, stream_with_context, send_from_directory, abort
from mqtt import MQTTClient, create_puzzles
from config import PUZZLE_ORDER, PUZZLE_ALIASES, PUZZLE_FINAL, PUZZLE_TUTORIAL, SUBTITLE_LANG
import queue
import json
import threading

try:
    from telemetry import init_telemetry, TelemetryQueries
    _TELEMETRY_AVAILABLE = True
except ImportError:
    _TELEMETRY_AVAILABLE = False

app = Flask(__name__)
register_player_window(app)
BASE_DIR = Path(__file__).resolve().parent #Directori base del projecte jocPro/

# Telemetry init (non-fatal: app boots even if DB is unavailable)
_telemetry_writer = None
_telemetry_queries = None
if _TELEMETRY_AVAILABLE:
    try:
        _DB_PATH = BASE_DIR / 'data' / 'db'
        _telemetry_writer = init_telemetry(_DB_PATH)
        _telemetry_queries = TelemetryQueries(_DB_PATH)
    except Exception as _e:
        print(f'[telemetry] init failed, DB unavailable: {_e}')

mqtt_client = MQTTClient(app, puzzle_order=PUZZLE_ORDER)
SPECIAL_PUZZLE_IDS = {PUZZLE_TUTORIAL, PUZZLE_FINAL}
mqtt_client.set_special_puzzle_ids(
    tutorial_puzzle_id=PUZZLE_TUTORIAL,
    final_puzzle_id=PUZZLE_FINAL,
)
mqtt_client.set_telemetry_writer(_telemetry_writer)
mqtt_client.set_telemetry_queries(_telemetry_queries)

# Active confirmed game session (Phase: session confirmation only)
_active_game_lock = threading.Lock()
_active_game_session_id = None

LEGACY_ALIAS_TO_SCENE = {
    "simulacro": "scene_intro_simulacro",
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
    "apreta botons": "scene_intro_apreta_botons",
}

# Create puzzles based on PUZZLE_ORDER
create_puzzles(mqtt_client, PUZZLE_ORDER)

# Per-client SSE queues
_sse_clients_lock = threading.Lock()
_sse_clients = []  # list of queues, one per connected client

def push_state_update(data):
    if data.get("puzzle_solved") and data.get("puzzle_id") == mqtt_client.current_puzzle_id:
        mqtt_client.end_active_puzzle(data.get("puzzle_id"))
    with _sse_clients_lock:
        for q in _sse_clients:
            q.put(data)

mqtt_client.set_update_callback(push_state_update)

def is_playable_puzzle_id(puzzle_id):
    return puzzle_id in PUZZLE_ORDER or puzzle_id in SPECIAL_PUZZLE_IDS


def get_sequence_index(puzzle_id):
    if puzzle_id == PUZZLE_TUTORIAL:
        return 0
    if puzzle_id in PUZZLE_ORDER:
        return PUZZLE_ORDER.index(puzzle_id) + 1
    if puzzle_id == PUZZLE_FINAL:
        return len(PUZZLE_ORDER) + 1
    return None


def get_display_level(puzzle_id):
    if puzzle_id == PUZZLE_TUTORIAL:
        return "TUTORIAL"
    if puzzle_id == PUZZLE_FINAL:
        return "FINAL"
    sequence_index = get_sequence_index(puzzle_id)
    return sequence_index if sequence_index is not None else 1


def normalize_subtitle_lang(raw_lang):
    lang = str(raw_lang or "es").strip().lower()
    if lang in ("en", "eng"):
        return "eng"
    return "es"


def resolve_active_subtitle_lang():
    session_lang = mqtt_client.get_active_session_language()
    if session_lang:
        return normalize_subtitle_lang(session_lang)
    return DEFAULT_SUBTITLE_LANG


DEFAULT_SUBTITLE_LANG = normalize_subtitle_lang(SUBTITLE_LANG)

@app.context_processor
def inject_player_defaults():
    return {
        "default_subtitle_lang": resolve_active_subtitle_lang(),
        "game_puzzle_order": PUZZLE_ORDER,
        "game_language": "ca" if mqtt_client.get_active_session_language() in ("ca", "cat") else resolve_active_subtitle_lang(),
    }


def presentation_page_data(scene_id, next_url="", puzzle_id=None, initial_step=0):
    # These pages are visual only: opening one never starts hardware.
    language = request.args.get("lang") or mqtt_client.get_active_session_language() or SUBTITLE_LANG
    language = "eng" if language in ("en", "eng") else "ca" if language in ("ca", "cat") else "es"
    sequence = [PUZZLE_TUTORIAL, *PUZZLE_ORDER, PUZZLE_FINAL]
    routes = {"welcome": url_for('welcome', embed=1), "opening": url_for('play_video_intro'), "closing": url_for('final')}
    for index, pid in enumerate(sequence):
        routes[f"puzzle-{pid}"] = url_for('puzzle_presentation', puzzle_id=pid)
        if index + 1 < len(sequence):
            routes[f"success-{pid}"] = url_for('play_video_puzzles', puzzle_id=sequence[index + 1])
    return {"routes": routes, "sceneId": scene_id, "nextUrl": next_url, "puzzleId": puzzle_id,
            "initialStep": initial_step, "language": language, "order": PUZZLE_ORDER,
            "tutorialId": PUZZLE_TUTORIAL, "finalId": PUZZLE_FINAL, "mode": "live"}


def render_presentation(scene_id, next_url="", puzzle_id=None, initial_step=0):
    return render_template("presentation.html", presentation_page=presentation_page_data(
        scene_id, next_url, puzzle_id, initial_step))


# Routes
@app.route('/')
def welcome():
    return render_template('welcome.html', presentation_page=presentation_page_data('welcome', url_for('play_video_intro')))

@app.route('/videoIntro')
def play_video_intro():
    # If a session is confirmed and telemetry is available, mark it as started (idempotent).
    with _active_game_lock:
        _sid = _active_game_session_id
    if _sid is not None and _telemetry_writer is not None:
        try:
            _telemetry_writer.start_session(_sid)
        except Exception as _e:
            print(f'[telemetry] start_session failed: {_e}')
    return render_presentation('opening', url_for('play_video_tutorial'))


@app.route('/videoBetweenIntroGame')
def play_video_between_intro_game():
    return redirect(url_for('play_video_tutorial'))


@app.route('/videoTutorial', methods=['GET', 'POST'])
def play_video_tutorial():
    if not is_playable_puzzle_id(PUZZLE_TUTORIAL):
        return redirect(url_for('welcome'))
    return render_presentation('puzzle', url_for('puzzle', puzzle_id=PUZZLE_TUTORIAL), PUZZLE_TUTORIAL)

@app.route('/videoPuzzles/<int:puzzle_id>', methods=['GET','POST'])
def play_video_puzzles(puzzle_id):
    if not is_playable_puzzle_id(puzzle_id):
        return redirect(url_for('welcome'))

    if puzzle_id in PUZZLE_ORDER:
        index = PUZZLE_ORDER.index(puzzle_id)
        previous = PUZZLE_TUTORIAL if index == 0 else PUZZLE_ORDER[index - 1]
    elif puzzle_id == PUZZLE_FINAL and PUZZLE_ORDER:
        previous = PUZZLE_ORDER[-1]
    else:
        return redirect(url_for('puzzle_presentation', puzzle_id=puzzle_id))
    return render_presentation(f'success-{previous}', url_for('puzzle_presentation', puzzle_id=puzzle_id))


@app.route('/presentacio/<int:puzzle_id>')
def puzzle_presentation(puzzle_id):
    if not is_playable_puzzle_id(puzzle_id):
        abort(404)
    return render_presentation('puzzle', url_for('puzzle', puzzle_id=puzzle_id), puzzle_id)

# Legacy entry points resolve to the same new HTML pages.
@app.route('/direct/<int:idx_puzzle_id>')
def play_directa_explicacio_puzzles(idx_puzzle_id):
    return redirect(url_for('puzzle_presentation', puzzle_id=idx_puzzle_id))

@app.route('/explicacioPuzzles/<int:idx_puzzle_id>', methods=['GET', 'POST'])
def play_explicacio_puzzles(idx_puzzle_id):
    if not 1 <= idx_puzzle_id <= len(PUZZLE_ORDER):
        abort(404)
    return redirect(url_for('puzzle_presentation', puzzle_id=PUZZLE_ORDER[idx_puzzle_id - 1]))

@app.route('/puzzleSuperat/<int:puzzle_id>', methods=['GET', 'POST'])
def puzzle_superat(puzzle_id):
    sequence = [PUZZLE_TUTORIAL, *PUZZLE_ORDER, PUZZLE_FINAL]
    if puzzle_id not in sequence:
        abort(404)
    index = sequence.index(puzzle_id)
    return redirect(url_for('play_video_puzzles', puzzle_id=sequence[index + 1]) if index + 1 < len(sequence) else url_for('final'))

@app.route('/player/')
def scene_player():
    scene_id = request.args.get('scene', 'scene_intro_game')
    if scene_id == 'scene_intro_game':
        target = url_for('play_video_intro')
    elif scene_id == 'scene_tutorial':
        target = url_for('play_video_tutorial')
    elif scene_id == 'scene_final':
        target = url_for('final')
    else:
        matching = [pid for pid, alias in PUZZLE_ALIASES.items()
                    if LEGACY_ALIAS_TO_SCENE.get(alias) == scene_id and is_playable_puzzle_id(pid)]
        if not matching:
            abort(404)
        target = url_for('puzzle_presentation', puzzle_id=matching[0])
    return redirect(target + ('?lang=' + presentation_page_data('welcome')['language']))

@app.route('/player/<path:filename>')
def scene_player_assets(filename):
    if filename == 'index.html':
        return scene_player()
    return send_from_directory(BASE_DIR / 'player', filename)

@app.route('/final', methods=['GET', 'POST'])
def final():
    global _active_game_session_id
    with _active_game_lock:
        _sid = _active_game_session_id
        _active_game_session_id = None
    mqtt_client.set_active_session_id(None)
    if _sid is not None and _telemetry_writer is not None:
        try:
            _telemetry_writer.end_session(_sid)
        except Exception as _e:
            print(f'[telemetry] end_session failed: {_e}')
    return render_presentation('closing')

@app.route('/final-loop', methods=['GET'])
def final_loop():
    return render_presentation('closing', initial_step=1)


@app.route('/puzzle/final', methods=['GET', 'POST'])
def puzzle_final():
    print("STARTING PUZZLE FINAL")
    mqtt_client.stop_current_puzzle()
    mqtt_client.set_current_sequence_index(get_sequence_index(PUZZLE_FINAL) or len(PUZZLE_ORDER) + 1)
    return render_template(f'puzzle{PUZZLE_FINAL}.html', current_level='FINAL', puzzle_id=PUZZLE_FINAL, final_puzzle_id=PUZZLE_FINAL)

@app.route('/puzzle/<int:puzzle_id>', methods=['GET', 'POST'])
def puzzle(puzzle_id):
    print("STARTING PUZZLE", puzzle_id)
    
    if not is_playable_puzzle_id(puzzle_id):
        return "Invalid puzzle", 404
    
    mqtt_client.stop_current_puzzle()
    
    puzzle_index = get_sequence_index(puzzle_id)
    mqtt_client.set_current_sequence_index(puzzle_index or 0)

    # Determine next_puzzle_id according to requirements
    next_puzzle_id = None
    if puzzle_id == PUZZLE_TUTORIAL:
        # After tutorial, go to first in PUZZLE_ORDER
        next_puzzle_id = PUZZLE_ORDER[0] if PUZZLE_ORDER else None
    elif puzzle_id in PUZZLE_ORDER:
        idx = PUZZLE_ORDER.index(puzzle_id)
        if idx < len(PUZZLE_ORDER) - 1:
            next_puzzle_id = PUZZLE_ORDER[idx + 1]
        else:
            next_puzzle_id = PUZZLE_FINAL
            
    display_level = get_display_level(puzzle_id)
    puzzle_context = {}
    if puzzle_id == 8:
        # Show the token identities on the first paint, before the event stream opens.
        puzzle_context["token_numbers"] = mqtt_client.puzzles[8].token_numbers[:]
    return render_template(
        f'puzzle{puzzle_id}.html', current_level=display_level,
        next_puzzle_id=next_puzzle_id, puzzle_id=puzzle_id, final_puzzle_id=PUZZLE_FINAL, **puzzle_context
    )

@app.route('/puzzle4_sample_finished', methods=['POST'])
def puzzle4_sample_finished():
    # Simulate MQTT message: P4,4,0 (button 4 = sample finished)
    mqtt_client.puzzles[4].handle_message(['P4', '4', '0'])
    return '', 204

#To start the puzzle from frontend
@app.route('/start_puzzle/<int:puzzle_id>', methods=['POST'])
def start_puzzle_route(puzzle_id):
    if not is_playable_puzzle_id(puzzle_id):
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
    mqtt_client.start_puzzle(PUZZLE_FINAL)
    return jsonify({"status": "started", "puzzle_id": PUZZLE_FINAL}), 200

@app.route('/restart_puzzle/<int:puzzle_id>', methods=['POST'])
def restart_puzzle_route(puzzle_id):
    if not is_playable_puzzle_id(puzzle_id):
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
        test_puzzle_aliases=PUZZLE_ALIASES,
        test_puzzle_tutorial=PUZZLE_TUTORIAL,
        test_puzzle_final=PUZZLE_FINAL
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

    puzzle3 = mqtt_client.puzzles.get(3)
    if puzzle3 is None:
        return jsonify({"error": "puzzle3_not_found"}), 404

    with puzzle3.lock:
        idx = puzzle3.current_question_idx
        chosen = puzzle3.chosen_questions
        if idx >= len(chosen):
            return jsonify({"error": "question_not_found"}), 404
        current = chosen[idx]

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


def _parse_test_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    text = str(value).strip().lower()
    if text in ("1", "true", "yes", "on"):
        return True
    if text in ("0", "false", "no", "off", ""):
        return False
    raise ValueError(f"invalid_bool:{value}")


@app.route('/test/puzzle_flags', methods=['POST'])
def test_set_puzzle_flags():
    data = request.get_json(silent=True) or {}

    puzzle_id = data.get("puzzle_id")
    if puzzle_id is None:
        puzzle_id = mqtt_client.current_puzzle_id

    try:
        puzzle_id = int(puzzle_id)
    except (TypeError, ValueError):
        return jsonify({"error": "invalid_puzzle"}), 400

    puzzle = mqtt_client.puzzles.get(puzzle_id)
    if puzzle is None:
        return jsonify({"error": "puzzle_not_found"}), 404

    has_saltar = "saltarPuzzle" in data
    has_always = "alwaysCorrect" in data
    if not has_saltar and not has_always:
        return jsonify({"error": "no_flags_provided"}), 400

    try:
        saltar_value = _parse_test_bool(data.get("saltarPuzzle")) if has_saltar else None
        always_value = _parse_test_bool(data.get("alwaysCorrect")) if has_always else None
    except ValueError:
        return jsonify({"error": "invalid_flag_value"}), 400

    flags = puzzle.set_control_flags(
        saltar_puzzle=saltar_value,
        always_correct=always_value,
    )

    return jsonify({
        "status": "ok",
        "puzzle_id": puzzle_id,
        "saltarPuzzle": bool(flags.get("saltarPuzzle", False)),
        "alwaysCorrect": bool(flags.get("alwaysCorrect", False)),
    }), 200


@app.route('/test/system_status', methods=['GET'])
def test_system_status():
    """Operational health for the GM panel.

    Flask is already serving this endpoint when the panel can call it, so this
    route deliberately reports/refreshes services instead of trying to spawn a
    second Flask process from inside the running Flask app.
    """
    state = mqtt_client.get_current_state() or {}
    return jsonify({
        "flask": "ok",
        "mqtt_connected": bool(getattr(mqtt_client, "connected", False)),
        "mqtt_last_connect_rc": getattr(mqtt_client, "last_connect_rc", None),
        "current_puzzle_id": mqtt_client.current_puzzle_id,
        "current_puzzle_index": mqtt_client.current_puzzle_index,
        "current_state_available": bool(state),
        "known_puzzles": sorted(mqtt_client.puzzles.keys()),
        "note": "No se arranca Flask desde Flask; este endpoint comprueba el proceso activo y el estado MQTT."
    }), 200


@app.route('/test/initialize_system', methods=['POST'])
def test_initialize_system():
    # Safe initialization from an already running Flask server: publish a light
    # status message and return health. Starting another Flask process here would
    # be fragile and can duplicate ports/workers.
    try:
        mqtt_client.send_message("FROM_FLASK", "GM_SYSTEM_CHECK")
    except Exception as exc:
        return jsonify({"status": "warning", "error": str(exc)}), 200

    return jsonify({
        "status": "ok",
        "message": "Sistema comprobado desde el servidor Flask activo.",
        "mqtt_connected": bool(getattr(mqtt_client, "connected", False))
    }), 200


@app.route('/test/force_end', methods=['POST'])
def test_force_end():
    data = request.get_json(silent=True) or {}
    puzzle_id = data.get("puzzle_id") or mqtt_client.current_puzzle_id
    try:
        puzzle_id = int(puzzle_id)
    except (TypeError, ValueError):
        return jsonify({"error": "invalid_puzzle"}), 400

    if mqtt_client.current_puzzle_id != puzzle_id:
        return jsonify({"error": "puzzle_not_active"}), 409

    puzzle = mqtt_client.puzzles.get(puzzle_id)
    if puzzle is None:
        return jsonify({"error": "puzzle_not_found"}), 404

    end_payload = "P5_End" if puzzle_id == 5 else f"P{puzzle_id}End"
    try:
        with puzzle.lock:
            puzzle.solved = True
        mqtt_client.send_message("FROM_FLASK", end_payload)
        puzzle._push({"puzzle_solved": True, "forced_by_gm": True})
    except Exception as exc:
        return jsonify({"error": "force_end_failed", "detail": str(exc)}), 500

    return jsonify({"status": "sent", "puzzle_id": puzzle_id, "end_payload": end_payload}), 200


@app.route('/test/session/<int:session_id>', methods=['PATCH'])
def test_session_update(session_id):
    if _telemetry_writer is None:
        return jsonify({'error': 'telemetry_unavailable'}), 503
    data = request.get_json(silent=True) or {}
    try:
        _telemetry_writer.update_session_fields(
            session_id=session_id,
            company=str(data.get('company') or ''),
            expected_day=str(data.get('expected_day') or ''),
            name=data.get('name') or None,
            expected_time=data.get('expected_time') or None,
            place=data.get('place') or None,
            players_num=int(data['players_num']) if data.get('players_num') else None,
            language=data.get('language') or None,
            notes=data.get('notes') or None,
        )
    except Exception as exc:
        return jsonify({'error': 'update_failed', 'detail': str(exc)}), 500
    return jsonify({'session_id': session_id}), 200


@app.route('/test/session/<int:session_id>', methods=['DELETE'])
def test_session_delete(session_id):
    global _active_game_session_id
    if _telemetry_writer is None:
        return jsonify({'error': 'telemetry_unavailable'}), 503
    try:
        _telemetry_writer.delete_session(session_id)
    except Exception as exc:
        return jsonify({'error': 'delete_failed', 'detail': str(exc)}), 500

    with _active_game_lock:
        if _active_game_session_id == session_id:
            _active_game_session_id = None
            mqtt_client.set_active_session_id(None)

    return jsonify({'session_id': session_id, 'deleted': True}), 200


@app.route('/test/session/confirm', methods=['POST'])
def test_session_confirm():
    global _active_game_session_id
    if _telemetry_queries is None:
        return jsonify({'error': 'telemetry_unavailable'}), 503

    data = request.get_json(silent=True) or {}
    raw_session_id = data.get('session_id')
    try:
        session_id = int(raw_session_id)
    except (TypeError, ValueError):
        return jsonify({'error': 'invalid_session_id'}), 400

    try:
        session = _telemetry_queries.get_session_stats(session_id)
    except Exception as exc:
        return jsonify({'error': 'query_failed', 'detail': str(exc)}), 500

    if not session:
        return jsonify({'error': 'session_not_found'}), 404

    if session.get('ended_at'):
        return jsonify({'error': 'session_already_ended'}), 409

    with _active_game_lock:
        _active_game_session_id = session_id
    mqtt_client.set_active_session_id(session_id)

    return jsonify({'status': 'confirmed', 'session': session}), 200


@app.route('/test/session/active', methods=['GET'])
def test_session_active():
    """Return the currently confirmed session, or {"active": false} if none."""
    global _active_game_session_id
    with _active_game_lock:
        _sid = _active_game_session_id
    if _sid is None:
        return jsonify({'active': False}), 200
    if _telemetry_queries is None:
        return jsonify({'active': False}), 200
    try:
        session = _telemetry_queries.get_session_stats(_sid)
    except Exception as exc:
        return jsonify({'error': 'query_failed', 'detail': str(exc)}), 500
    if not session:
        # Session disappeared from DB — clear stale global
        with _active_game_lock:
            _active_game_session_id = None
        mqtt_client.set_active_session_id(None)
        return jsonify({'active': False}), 200
    return jsonify({'active': True, 'session': session}), 200


@app.route('/test/session/start', methods=['POST'])
def test_session_start():
    """Write started_at for the confirmed session (idempotent). Used by GM Start button."""
    with _active_game_lock:
        _sid = _active_game_session_id
    if _sid is None:
        return jsonify({'error': 'no_active_session'}), 409
    if _telemetry_writer is None:
        return jsonify({'error': 'telemetry_unavailable'}), 503
    try:
        _telemetry_writer.start_session(_sid)
    except Exception as exc:
        return jsonify({'error': 'start_failed', 'detail': str(exc)}), 500
    return jsonify({'status': 'started', 'session_id': _sid}), 200


@app.route('/test/session/save', methods=['POST'])
def test_session_save():
    if _telemetry_writer is None:
        return jsonify({'error': 'telemetry_unavailable'}), 503
    data = request.get_json(silent=True) or {}
    try:
        session_id = _telemetry_writer.record_session_start(
            company=str(data.get('company') or ''),
            expected_day=str(data.get('expected_day') or ''),
            name=data.get('name') or None,
            expected_time=data.get('expected_time') or None,
            place=data.get('place') or None,
            players_num=int(data['players_num']) if data.get('players_num') else None,
            language=data.get('language') or None,
            notes=data.get('notes') or None,
            started_at=None,
            ended_at=None,
        )
    except Exception as exc:
        return jsonify({'error': 'save_failed', 'detail': str(exc)}), 500
    return jsonify({'session_id': session_id}), 201


@app.route('/test/sessions/pending', methods=['GET'])
def test_sessions_pending():
    if _telemetry_queries is None:
        return jsonify([]), 200
    try:
        sessions = _telemetry_queries.get_pending_sessions()
    except Exception as exc:
        return jsonify({'error': 'query_failed', 'detail': str(exc)}), 500
    return jsonify(sessions), 200


if __name__ == '__main__':
    app.run(debug=True)
