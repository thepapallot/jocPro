import sys,threading,subprocess
from pathlib import Path
REPO=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(REPO),str(REPO/'tests')]
from test_sessions import SessionTests,ROOT
from flask import render_template,jsonify
from werkzeug.serving import make_server,WSGIRequestHandler
case=SessionTests();case.setUp();app=case.app
app.template_folder=str(ROOT/'templates');app.static_folder=str(ROOT/'static')
@app.route('/welcome')
def welcome():return '',200
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
class Quiet(WSGIRequestHandler):
 def log(self,*a):pass
server=make_server('127.0.0.1',0,app,request_handler=Quiet);threading.Thread(target=server.serve_forever,daemon=True).start()
try:subprocess.run(['node',str(REPO/'tests/sessions_browser.cjs'),f'http://127.0.0.1:{server.server_port}'],check=True,timeout=45)
finally:server.shutdown();server.server_close();case.tearDown()
