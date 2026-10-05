"""Run the actual HTML route functions without importing app startup or connecting MQTT."""
import ast
import threading
from types import SimpleNamespace
from pathlib import Path
from flask import Flask, render_template, redirect, url_for, request, send_from_directory, abort, jsonify
from config import PUZZLE_ORDER, PUZZLE_ALIASES, PUZZLE_FINAL, PUZZLE_TUTORIAL, SUBTITLE_LANG

ROOT = Path(__file__).resolve().parents[1]

class FakeMQTT:
    current_puzzle_id = None
    def __init__(self):
        self.starts = []
        self.puzzles = {8: SimpleNamespace(token_numbers=[18,14,17,5,20,10,13,31,35,22])}
    def get_active_session_language(self):
        return 'ca'
    def stop_current_puzzle(self):
        self.current_puzzle_id = None
    def set_current_sequence_index(self, index):
        pass
    def set_active_session_id(self, session_id):
        pass
    def start_puzzle(self, puzzle_id):
        self.current_puzzle_id = puzzle_id
        self.starts.append(puzzle_id)


def create_runtime():
    app = Flask(__name__, template_folder=str(ROOT / 'templates'), static_folder=str(ROOT / 'static'))
    app.config['TESTING'] = True
    mqtt = FakeMQTT()
    namespace = dict(globals(), app=app, mqtt_client=mqtt, BASE_DIR=ROOT,
                     SPECIAL_PUZZLE_IDS={PUZZLE_TUTORIAL, PUZZLE_FINAL},
                     _active_game_lock=threading.Lock(), _active_game_session_id=None, _telemetry_writer=None)
    functions = {'is_playable_puzzle_id', 'get_sequence_index', 'get_display_level',
                 'normalize_subtitle_lang', 'resolve_active_subtitle_lang', 'inject_player_defaults',
                 'presentation_page_data', 'render_presentation', 'welcome', 'play_video_intro',
                 'play_video_between_intro_game', 'play_video_tutorial', 'play_video_puzzles',
                 'puzzle_presentation', 'play_directa_explicacio_puzzles', 'play_explicacio_puzzles',
                 'puzzle_superat', 'scene_player', 'scene_player_assets', 'final', 'final_loop',
                 'puzzle_final', 'puzzle', 'start_puzzle_route'}
    nodes = []
    for node in ast.parse((ROOT / 'app.py').read_text()).body:
        if isinstance(node, ast.FunctionDef) and node.name in functions:
            nodes.append(node)
        elif isinstance(node, ast.Assign) and any(isinstance(target, ast.Name) and target.id in
                {'LEGACY_ALIAS_TO_SCENE', 'DEFAULT_SUBTITLE_LANG'} for target in node.targets):
            nodes.append(node)
    exec(compile(ast.Module(body=nodes, type_ignores=[]), str(ROOT / 'app.py'), 'exec'), namespace)
    return app, mqtt
