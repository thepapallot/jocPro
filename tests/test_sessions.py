"""Session metadata and reporting with a temporary DB, without app startup/MQTT."""
import ast
import sqlite3
import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from flask import Flask, request, jsonify
from telemetry.schema import init_schema
from telemetry.writer import TelemetryWriter
from telemetry.queries import TelemetryQueries

ROOT = Path(__file__).resolve().parents[1]

class SessionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name)
        init_schema(self.path)
        self.writer = TelemetryWriter(self.path)
        self.queries = TelemetryQueries(self.path)
        self.app = Flask(__name__)
        namespace = dict(app=self.app, request=request, jsonify=jsonify,
            _telemetry_writer=self.writer, _telemetry_queries=self.queries,
            _active_game_lock=threading.Lock(), _active_game_session_id=None,
            mqtt_client=SimpleNamespace(set_active_session_id=lambda _:None))
        wanted = {'session_form_fields','test_sessions_agenda','test_session_detail',
                  'test_session_update','test_session_save','test_session_delete',
                  'test_session_confirm','test_session_active'}
        nodes = [n for n in ast.parse((ROOT/'app.py').read_text()).body if isinstance(n,ast.FunctionDef) and n.name in wanted]
        exec(compile(ast.Module(body=nodes,type_ignores=[]),'isolated-sessions','exec'),namespace)
        self.client = self.app.test_client()

    def tearDown(self):
        self.writer.shutdown(timeout=2)
        self.queries.close()
        self.tmp.cleanup()

    def create(self, kind='real', **fields):
        data = dict(name='Grupo',company='Empresa',expected_day='2026-10-07',
                    players_num=10,language='ca',session_type=kind,game_master='GM',notes='Preparación')
        data.update(fields)
        response = self.client.post('/test/session/save',json=data)
        self.assertEqual(response.status_code,201,response.json)
        return response.json['session_id']

    def test_test_session_survives_reload_and_stays_out_of_real_reports(self):
        real = self.create()
        test = self.create('test',name='Ensayo',players_num=1)
        for sid in [real,test]:
            self.writer.start_session(sid)
            pid = self.writer.record_puzzle_start(sid,1,1,1)
            self.writer.end_puzzle(pid)
            self.writer.end_session(sid)
            self.writer.record_event(sid,pid,'solved')
        self.writer.shutdown(timeout=2)
        self.assertEqual({s['session_id'] for s in self.client.get('/test/sessions').json['sessions']},{real,test})
        detail = self.client.get(f'/test/session/{test}').json
        self.assertEqual(detail['session']['session_type'],'test')
        self.assertEqual(len(detail['puzzles']),1)
        self.assertEqual(self.queries.get_puzzle_stats_by_number(1)['total_runs'],1)
        self.assertEqual([s['session_id'] for s in self.queries.get_all_sessions()],[real])
        self.assertEqual(self.queries.get_event_counts_by_type(),{'solved':1})
        self.assertEqual(self.queries.get_event_counts_by_type(1),{'solved':1})

    def test_validation_updates_and_protected_active_session(self):
        sid=self.create('test')
        self.assertEqual(self.client.post('/test/session/save',json={'session_type':'other'}).status_code,400)
        self.assertEqual(self.client.patch(f'/test/session/{sid}',json={'observations':'Buena coordinación'}).status_code,200)
        self.assertEqual(self.client.get(f'/test/session/{sid}').json['session']['observations'],'Buena coordinación')
        self.assertEqual(self.client.post('/test/session/confirm',json={'session_id':sid}).status_code,200)
        self.assertEqual(self.client.delete(f'/test/session/{sid}').status_code,409)
        self.writer.start_session(sid)
        self.assertEqual(self.client.patch(f'/test/session/{sid}',json={'session_type':'real'}).status_code,400)
        other=self.create()
        self.assertEqual(self.client.post('/test/session/confirm',json={'session_id':other}).status_code,409)
        self.writer.end_session(sid)
        self.assertEqual(self.client.post('/test/session/confirm',json={'session_id':sid}).status_code,409)
        self.assertEqual(self.client.post('/test/session/confirm',json={'session_id':other}).status_code,200)
        self.assertEqual(self.client.delete(f'/test/session/{sid}').status_code,200)
        self.assertEqual(self.client.get(f'/test/session/{sid}').status_code,404)

    def test_metadata_rejects_invalid_players_and_retains_distinct_notes(self):
        for players in [0,9,21,10.5,'ten']:
            self.assertEqual(self.client.post('/test/session/save',json=dict(name='X',company='X',expected_day='2026-10-07',players_num=players)).status_code,400)
        sid=self.create(observations='Resultado')
        row=self.client.get(f'/test/session/{sid}').json['session']
        self.assertEqual((row['notes'],row['observations'],row['game_master']),('Preparación','Resultado','GM'))

    def test_additive_migration_keeps_existing_sessions(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)
            db=sqlite3.connect(path/'telemetry.sqlite3')
            db.executescript('''
                CREATE TABLE schema_info(id INTEGER PRIMARY KEY,version INTEGER,created_at TEXT,last_updated_at TEXT);
                INSERT INTO schema_info(id,version) VALUES(1,3);
                CREATE TABLE sessions(session_id INTEGER PRIMARY KEY,company TEXT,name TEXT,expected_day TEXT,expected_time TEXT,place TEXT,players_num INTEGER,language TEXT,notes TEXT,started_at TEXT,ended_at TEXT);
                INSERT INTO sessions(session_id,company,expected_day,notes) VALUES(8,'Empresa','2026-10-07','Conservar');
            ''');db.commit();db.close()
            init_schema(path);init_schema(path)
            db=sqlite3.connect(path/'telemetry.sqlite3')
            self.assertEqual(db.execute('SELECT session_id,notes,session_type FROM sessions').fetchall(),[(8,'Conservar','real')]);db.close()

if __name__=='__main__': unittest.main()
