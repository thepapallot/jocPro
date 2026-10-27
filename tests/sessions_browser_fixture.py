import os,sys,threading,subprocess,tempfile
from pathlib import Path
REPO=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(REPO),str(REPO/'tests')]
from test_sessions import SessionTests,ROOT
from flask import render_template,jsonify,request
from presentation_fixture import create_runtime
from werkzeug.serving import make_server,WSGIRequestHandler
case=SessionTests();case.setUp();app=case.app
app.template_folder=str(ROOT/'templates');app.static_folder=str(ROOT/'static')
namespace=app.view_functions['test_session_confirm'].__globals__
visual_app,_=create_runtime()
@app.route('/')
@app.route('/presentacio/<int:puzzle_id>')
def welcome(puzzle_id=None):
 with visual_app.test_client() as client:
  return client.get(request.full_path).get_data(as_text=True)
def closing_preview():
 with visual_app.test_client() as client:
  return client.get(request.full_path).get_data(as_text=True)
app.view_functions['final']=closing_preview
@app.route('/audit')
def audit():
 return render_template('test.html',test_puzzle_order=[2,3,8,1,5,12,4],test_puzzle_aliases={},test_puzzle_tutorial=11,test_puzzle_final=6,game_language='ca')
@app.route('/current_state')
def state():return jsonify(puzzle_id=None)
@app.route('/test/<path:other>',methods=['GET','POST','HEAD'])
def stub(other):return jsonify({})
@app.route('/audit/finished',methods=['POST'])
def finished():
 sid=case.create(name='Grupo finalizado',observations='Buena coordinación')
 case.writer.start_session(sid);pid=case.writer.record_puzzle_start(sid,1,1,1);case.writer.end_puzzle(pid);case.writer.end_session(sid)
 return jsonify(session_id=sid)
@app.route('/audit/results',methods=['POST'])
def recorded_results():
 sid=namespace['_active_game_session_id']
 case.writer.start_session(sid)
 pid=case.writer.record_puzzle_start(sid,3,1,4)
 case.writer.end_puzzle(pid,total_points=60)
 return jsonify(session_id=sid)
@app.route('/audit/old',methods=['POST'])
def old_runs():
 ids=[]
 for name in ('Primeres 3 proves','Provant puntuatge','Primeres 3 proves 2.0'):
  sid=case.create(name=name)
  case.writer.start_session(sid,started_at='2026-10-14 10:00:00')
  pid=case.writer.record_puzzle_start(sid,3,1,4)
  case.writer.end_puzzle(pid,total_points=60)
  ids.append(sid)
 return jsonify(session_ids=ids)
class Quiet(WSGIRequestHandler):
 def log(self,*a):pass
server=make_server('127.0.0.1',0,app,threaded=True,request_handler=Quiet);threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with tempfile.TemporaryDirectory(prefix='session-browser-') as output:
  subprocess.run(['node',str(REPO/'tests/sessions_browser.cjs'),f'http://127.0.0.1:{server.server_port}'],
                 env={**os.environ,'SESSION_BROWSER_OUTPUT':output},check=True,timeout=60)
finally:server.shutdown();server.server_close();case.tearDown()
