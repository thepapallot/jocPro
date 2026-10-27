"""Session metadata and reporting with a temporary DB, without app startup/MQTT."""
import ast
import sqlite3
import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch
from flask import Flask, request, jsonify
from telemetry.schema import init_schema
from telemetry.writer import TelemetryWriter
from telemetry.queries import TelemetryQueries
from mqtt.client import MQTTClient

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
            mqtt_client=SimpleNamespace(set_active_session_id=Mock(), stop_current_puzzle=Mock(),
                                        start_puzzle=Mock(), current_puzzle_id=None),
            is_playable_puzzle_id=lambda puzzle_id: puzzle_id in (2, 6, 11),
            PUZZLE_FINAL=6, render_presentation=Mock(return_value='presentation'),
            url_for=lambda name: '/videoTutorial')
        self.namespace = namespace
        wanted = {'session_form_fields','test_sessions_agenda','test_session_detail',
                  'test_session_update','test_session_save','test_session_delete',
                  'test_session_confirm','test_session_active','test_session_close',
                  'test_session_start','active_session_error','start_puzzle_route',
                  'restart_puzzle_route','start_puzzle_final','play_video_intro','final'}
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

    def test_close_old_session_without_reactivating_preserves_scores_and_other_active_run(self):
        old=self.create(name='Primeres 3 proves')
        self.writer.start_session(old, started_at='2026-10-14 10:00:00')
        pid=self.writer.record_puzzle_start(old,3,1,4)
        self.writer.end_puzzle(pid,total_points=60)
        before=self.client.get(f'/test/session/{old}').json
        current=self.create(name='Partida actual')
        self.client.post('/test/session/confirm',json={'session_id':current})
        self.writer.start_session(current)
        mqtt=self.namespace['mqtt_client']
        mqtt.set_active_session_id.reset_mock()
        result=self.client.post(f'/test/session/{old}/close')
        self.assertEqual(result.status_code,200,result.json)
        after=self.client.get(f'/test/session/{old}').json
        self.assertIsNotNone(after['session']['ended_at'])
        self.assertEqual(after['session']['started_at'],before['session']['started_at'])
        self.assertEqual(after['puzzles'],before['puzzles'])
        self.assertEqual(after['puzzles'][0]['total_points'],60)
        self.assertEqual(self.client.get('/test/session/active').json['session']['session_id'],current)
        self.assertIsNone(self.client.get(f'/test/session/{current}').json['session']['ended_at'])
        mqtt.set_active_session_id.assert_not_called()
        mqtt.stop_current_puzzle.assert_not_called()

    def test_close_old_run_after_reload_with_no_active_session(self):
        sid=self.create()
        self.writer.start_session(sid,started_at='2026-10-14 10:00:00')
        self.assertFalse(self.client.get('/test/session/active').json['active'])
        self.assertEqual(self.client.post(f'/test/session/{sid}/close').status_code,200)
        self.assertIsNotNone(self.client.get(f'/test/session/{sid}').json['session']['ended_at'])
        self.assertFalse(self.client.get('/test/session/active').json['active'])

    def test_close_active_stops_its_puzzle_and_clears_active_session(self):
        sid=self.create()
        self.client.post('/test/session/confirm',json={'session_id':sid})
        self.writer.start_session(sid)
        pid=self.writer.record_puzzle_start(sid,3,1,4)
        self.assertEqual(self.client.post(f'/test/session/{sid}/close').status_code,200)
        self.assertFalse(self.client.get('/test/session/active').json['active'])
        self.namespace['mqtt_client'].stop_current_puzzle.assert_called_once_with()
        self.namespace['mqtt_client'].set_active_session_id.assert_called_with(None)
        puzzle=self.client.get(f'/test/session/{sid}').json['puzzles'][0]
        self.assertEqual(puzzle['puzzle_id'],pid)
        self.assertEqual(puzzle['total_points'],0)
        self.assertIsNone(puzzle['ended_at'],'Closing a session does not award or complete unfinished puzzles')

    def test_close_is_idempotent_and_does_not_change_previous_end_time(self):
        sid=self.create('test')
        self.writer.start_session(sid)
        self.writer.end_session(sid,ended_at='2026-10-14 11:00:00')
        for _ in range(2):
            self.assertEqual(self.client.post(f'/test/session/{sid}/close').status_code,200)
        self.assertEqual(self.client.get(f'/test/session/{sid}').json['session']['ended_at'],'2026-10-14 11:00:00')
        self.namespace['mqtt_client'].stop_current_puzzle.assert_not_called()

    def test_close_rejects_missing_pending_and_unavailable_storage(self):
        self.assertEqual(self.client.post('/test/session/999/close').status_code,404)
        pending=self.create()
        self.assertEqual(self.client.post(f'/test/session/{pending}/close').status_code,409)
        self.assertIsNone(self.client.get(f'/test/session/{pending}').json['session']['ended_at'])
        for key in ('_telemetry_writer','_telemetry_queries'):
            with patch.dict(self.namespace,{key:None}):
                self.assertEqual(self.client.post(f'/test/session/{pending}/close').status_code,503)

    def test_close_write_failure_does_not_clear_active_or_report_success(self):
        sid=self.create()
        self.client.post('/test/session/confirm',json={'session_id':sid})
        with patch.object(self.writer,'end_session',side_effect=RuntimeError('Storage unavailable')):
            self.assertEqual(self.client.post(f'/test/session/{sid}/close').status_code,500)
        self.assertTrue(self.client.get('/test/session/active').json['active'])
        self.assertIsNone(self.client.get(f'/test/session/{sid}').json['session']['ended_at'])
        self.namespace['mqtt_client'].stop_current_puzzle.assert_not_called()

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

    def test_new_partida_always_gets_new_id_even_with_identical_details(self):
        first = self.create()
        second = self.create()
        self.assertNotEqual(first, second)
        self.assertFalse(self.client.get('/test/session/active').json['active'])
        self.assertIsNone(self.queries.get_session_stats(second)['started_at'])
        self.assertEqual(self.queries.get_session_puzzles(second), [])

    def test_started_or_legacy_recorded_session_requires_explicit_resume(self):
        for legacy in (False, True):
            with self.subTest(legacy=legacy):
                sid = self.create()
                if legacy:
                    self.writer.record_puzzle_start(sid, 2, 1, 1)
                else:
                    self.writer.start_session(sid)
                response = self.client.post('/test/session/confirm', json={'session_id': sid})
                self.assertEqual(response.status_code, 409)
                self.assertTrue(response.json['resume_required'])
                self.assertEqual(self.client.post('/test/session/confirm',
                    json={'session_id': sid, 'resume': True}).status_code, 200)
                self.assertEqual(self.client.post(f'/test/session/{sid}/close').status_code, 200)

    def test_legacy_recorded_session_blocks_switch_even_without_start_timestamp(self):
        first, other = self.create(), self.create()
        self.writer.record_puzzle_start(first, 2, 1, 1)
        self.client.post('/test/session/confirm', json={'session_id': first, 'resume': True})
        response = self.client.post('/test/session/confirm', json={'session_id': other})
        self.assertEqual(response.status_code, 409)
        self.assertIn(f'#{first}', response.json['error'])
        self.assertEqual(self.client.get('/test/session/active').json['session']['session_id'], first)

    def test_prepared_session_must_be_explicitly_started_before_any_puzzle(self):
        sid = self.create()
        self.client.post('/test/session/confirm', json={'session_id': sid})
        for route in ('/start_puzzle/2', '/restart_puzzle/2', '/start_puzzle_final'):
            self.assertEqual(self.client.post(route).status_code, 409)
        self.assertEqual(self.client.get('/videoIntro').status_code, 409)
        self.namespace['mqtt_client'].start_puzzle.assert_not_called()
        for payload in ({}, {'session_id': sid + 1}, {'session_id': str(sid)}):
            self.assertEqual(self.client.post('/test/session/start', json=payload).status_code, 409)
        self.assertEqual(self.client.post('/test/session/start', json={'session_id': sid}).status_code, 200)
        before = self.queries.get_session_stats(sid)['started_at']
        self.assertIsNotNone(before)
        for route in ('/start_puzzle/2', '/restart_puzzle/2', '/start_puzzle_final'):
            self.assertEqual(self.client.post(route).status_code, 200)
        self.assertEqual(self.client.get('/videoIntro').status_code, 200)
        self.assertEqual(self.client.post('/test/session/start', json={'session_id': sid}).status_code, 200)
        self.assertEqual(self.queries.get_session_stats(sid)['started_at'], before)
        self.assertEqual(len(self.queries.get_session_agenda()), 1)

    def test_no_session_or_closed_session_cannot_start_game(self):
        for route in ('/start_puzzle/2', '/restart_puzzle/2', '/start_puzzle_final', '/test/session/start'):
            self.assertEqual(self.client.post(route).status_code, 409)
        sid = self.create()
        self.client.post('/test/session/confirm', json={'session_id': sid})
        self.writer.start_session(sid)
        self.writer.end_session(sid)
        self.assertEqual(self.client.post('/start_puzzle/2').status_code, 409)
        self.assertFalse(self.client.get('/test/session/active').json['active'])
        self.namespace['mqtt_client'].start_puzzle.assert_not_called()

    def test_unavailable_database_is_an_error_not_an_inactive_session(self):
        sid = self.create()
        self.client.post('/test/session/confirm', json={'session_id': sid})
        with patch.dict(self.namespace, {'_telemetry_queries': None}):
            self.assertEqual(self.client.get('/test/session/active').status_code, 503)
            self.assertEqual(self.client.post('/start_puzzle/2').status_code, 503)
        self.assertEqual(self.client.get('/test/session/active').json['session']['session_id'], sid)

    def test_closing_presentation_uses_same_verified_session_close(self):
        sid = self.create()
        self.client.post('/test/session/confirm', json={'session_id': sid})
        self.writer.start_session(sid)
        self.assertEqual(self.client.get('/final').status_code, 200)
        self.assertIsNotNone(self.queries.get_session_stats(sid)['ended_at'])
        self.assertFalse(self.client.get('/test/session/active').json['active'])
        self.namespace['mqtt_client'].stop_current_puzzle.assert_called_once()

    def test_closing_presentation_does_not_hide_storage_failure(self):
        sid = self.create()
        self.client.post('/test/session/confirm', json={'session_id': sid})
        with patch.object(self.writer, 'end_session', side_effect=RuntimeError('Storage offline')):
            self.assertEqual(self.client.get('/final').status_code, 500)
        self.assertTrue(self.client.get('/test/session/active').json['active'])
        self.namespace['mqtt_client'].stop_current_puzzle.assert_not_called()

    def mqtt_runtime(self, sid):
        client = MQTTClient.__new__(MQTTClient)
        client.lock = threading.Lock()
        client.telemetry_writer = self.writer
        client.telemetry_queries = self.queries
        client.active_session_id = sid
        client.active_puzzle_row_id = None
        client.active_puzzle_num = None
        client.current_puzzle_id = None
        client.puzzle_order = [2]
        client.puzzles = {2: SimpleNamespace(reset=Mock(), stop=Mock())}
        client.client = SimpleNamespace(publish=Mock())
        return client

    def test_mqtt_starts_only_after_session_start_and_persists_before_timers(self):
        sid = self.create()
        mqtt = self.mqtt_runtime(sid)
        with self.assertRaises(ValueError):
            mqtt.start_puzzle(2)
        mqtt.puzzles[2].reset.assert_not_called()
        mqtt.client.publish.assert_not_called()
        self.assertEqual(self.queries.get_session_puzzles(sid), [])
        self.writer.start_session(sid)

        def verify_persistence():
            self.assertEqual(self.queries.get_session_puzzles(sid)[0]['puzzle_id'],
                             mqtt.active_puzzle_row_id)

        mqtt.puzzles[2].reset.side_effect = verify_persistence
        mqtt.start_puzzle(2)
        mqtt.end_active_puzzle(2, total_points=80)
        self.writer.end_session(sid)
        with self.assertRaises(ValueError):
            mqtt.start_puzzle(2)
        other = self.create()
        self.writer.start_session(other)
        mqtt.stop_current_puzzle()
        mqtt.set_active_session_id(other)
        mqtt.puzzles[2].reset.side_effect = None
        mqtt.start_puzzle(2)
        mqtt.end_active_puzzle(2, total_points=100)
        self.assertEqual([p['total_points'] for p in self.queries.get_session_puzzles(sid)], [80])
        self.assertEqual([p['total_points'] for p in self.queries.get_session_puzzles(other)], [100])

    def test_failed_puzzle_insert_never_starts_workers_or_reports_already_started(self):
        sid = self.create()
        self.writer.start_session(sid)
        mqtt = self.mqtt_runtime(sid)
        with patch.object(self.writer, 'record_puzzle_start', side_effect=sqlite3.OperationalError('Offline')):
            with self.assertRaises(sqlite3.OperationalError):
                mqtt.start_puzzle(2)
        self.assertIsNone(mqtt.current_puzzle_id)
        mqtt.puzzles[2].reset.assert_not_called()
        mqtt.client.publish.assert_not_called()

if __name__=='__main__': unittest.main()
