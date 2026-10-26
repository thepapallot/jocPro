"""Isolated music regression server. Never import app.py or the MQTT client.

Run: python3 tests/puzzle4_rounds_fixture.py (127.0.0.1:8774).
Only selected AST route definitions are executed; Puzzle4 runs with sleeping
and background workers mocked. No database, broker, or hardware is used.
"""
import ast
import sys
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from flask import jsonify, render_template, request
from presentation_fixture import create_runtime
from mqtt.puzzles.puzzle4 import Puzzle4

ROOT = Path(__file__).resolve().parents[1]
app, mqtt = create_runtime()
mqtt.app = app
mqtt.events = []
mqtt.messages = []
mqtt.rounds = []
mqtt.push_update = lambda data: mqtt.events.append(data)
mqtt.send_message = lambda *args: mqtt.messages.append(args)
mqtt.start_next_round = lambda *args: mqtt.rounds.append(args)
mqtt.puzzles[4] = Puzzle4(mqtt)
failure = None
requests = []

# Compile only the two real route functions; never execute module startup.
tree = ast.parse((ROOT / 'app.py').read_text())
nodes = [node for node in tree.body if isinstance(node, ast.FunctionDef)
         and node.name in {'test_lab', 'test_puzzle4_round_options'}]
assert len(nodes) == 2
import config
namespace = dict(app=app, mqtt_client=mqtt, jsonify=jsonify, request=request,
                 render_template=render_template,
                 **{key: getattr(config, key) for key in
                    ('PUZZLE_ORDER', 'PUZZLE_ALIASES', 'PUZZLE_TUTORIAL', 'PUZZLE_FINAL')})
exec(compile(ast.Module(body=nodes, type_ignores=[]), str(ROOT / 'app.py'), 'exec'), namespace)

STUB = '''<script>
window.musicRoundsFixture=true;window.auditStreams=[];window.auditAudios=[];
window.EventSource=class {constructor(url){this.url=url;auditStreams.push(this);}close(){}};
window.auditPush=data=>auditStreams.forEach(s=>s.onmessage?.({data:JSON.stringify(data)}));
window.Audio=class extends EventTarget {
 constructor(src=''){super();this.src=src;this.currentTime=0;this.volume=1;this.paused=true;}
 setAttribute(){} load(){} pause(){this.paused=true;}
 play(){this.paused=false;auditAudios.push(this.src);return Promise.resolve();}
};
const nativeFetch=window.fetch.bind(window);
window.fetch=(url,options={})=>{
 const p=new URL(url,location.href).pathname;
 // Pass the real music endpoint and all assets through to Flask.
 if(p==='/test/puzzle4/round_options'||p.startsWith('/audit/')||p.startsWith('/static/'))return nativeFetch(url,options);
 const values={'/test/sessions':{sessions:[],active_session_id:null},
 '/test/session/active':{session:null},'/current_state':{},
 '/test/system_status':{mqtt_connected:false,puzzles_initialized:true}};
 if(p.startsWith('/test/')||p==='/current_state'||p.startsWith('/start_puzzle/'))
   return Promise.resolve(new Response(JSON.stringify(values[p]||{}),{headers:{'Content-Type':'application/json'}}));
 return nativeFetch(url,options);
};
</script>'''


@app.after_request
def inject_isolation(response):
    response.headers['X-Music-Rounds-Fixture'] = 'isolated-no-mqtt'
    if response.mimetype == 'text/html':
        response.direct_passthrough = False
        response.set_data(response.get_data(as_text=True).replace('<head>', '<head>' + STUB, 1))
    return response


@app.before_request
def inject_failure():
    global failure
    # Exercise pages directly instead of launching the production player shell.
    if request.path == '/static/js/shell_guard.js':
        return '// Isolated direct-page preview.', 200, {'Content-Type': 'application/javascript'}
    if request.path != '/test/puzzle4/round_options':
        return None
    requests.append({'method': request.method, 'body': request.get_json(silent=True)})
    if failure:
        mode, failure = failure, None
        if mode == 'http':
            return jsonify(error='injected_failure'), 503
        if mode == 'invalid':
            return jsonify(second_round_enabled='not-a-boolean')
        if mode == 'json':
            return 'not json', 200, {'Content-Type': 'application/json'}
        if mode == 'committed-error':
            mqtt.puzzles[4].set_second_round_enabled(request.json['second_round_enabled'])
            return jsonify(error='injected_after_commit'), 503
    return None


@app.route('/audit/identity')
def identity():
    return jsonify(fixture='music-rounds-isolated', mqtt=False, workers=False)


@app.route('/audit/control', methods=['POST'])
def control():
    global failure
    data = request.get_json()
    puzzle = mqtt.puzzles[4]
    action = data['action']
    if action == 'fresh':
        mqtt.puzzles[4] = puzzle = Puzzle4(mqtt)
        mqtt.current_puzzle_id = None
        mqtt.events.clear()
        mqtt.messages.clear()
        mqtt.rounds.clear()
        requests.clear()
        failure = None
    elif action == 'failure':
        assert data['mode'] in ('http', 'invalid', 'json', 'committed-error')
        failure = data['mode']
    elif action == 'start':
        mqtt.current_puzzle_id = 4
        with patch('mqtt.puzzles.puzzle4.threading.Thread', return_value=Mock()):
            puzzle.reset()
    elif action == 'validate':
        puzzle.played_sequence = puzzle._get_current_required_order().copy()
        # Run actual validation synchronously; suppress waits and worker launch.
        with patch('mqtt.puzzles.puzzle4.time.sleep'), patch.object(puzzle, '_play_sample_with_delay'):
            puzzle._handle_validation(True)
    elif action == 'other-puzzle':
        mqtt.current_puzzle_id = 3
    else:
        return jsonify(error='unknown_action'), 400
    return jsonify(state=puzzle.get_state(), options=puzzle.get_round_options(),
                   events=mqtt.events, messages=mqtt.messages, rounds=mqtt.rounds,
                   requests=requests, active=mqtt.current_puzzle_id)


if __name__ == '__main__':
    # Single request thread makes scoped worker/time patches deterministic.
    app.run(host='127.0.0.1', port=8774, debug=False, threaded=False, use_reloader=False)