"""Open the local projector in a normal browser window, never a web popup."""
import shutil
import subprocess
from urllib.parse import urlencode
from flask import jsonify, request


def register_player_window(app):
    @app.post('/test/player-window')
    def open_player_window():
        # This opens a desktop application on the server, so only its local GM may use it.
        if request.remote_addr not in {'127.0.0.1', '::1'}:
            return jsonify(error='Abre el control desde el ordenador del juego.'), 403
        if request.headers.get('Origin') != request.host_url.rstrip('/'):
            return jsonify(error='Origen de la solicitud no permitido.'), 403
        data = request.get_json(silent=True) or {}
        target = data.get('path', '/')
        if not isinstance(target, str) or not target.startswith('/') or target.startswith('//'):
            return jsonify(error='Pantalla no válida.'), 400
        agents = ['firefox'] if 'Firefox/' in request.user_agent.string else ['google-chrome', 'chromium', 'chromium-browser']
        executable = next((found for name in agents if (found := shutil.which(name))), None)
        if not executable:
            return jsonify(error='No se encuentra el navegador para abrir una ventana normal.'), 503
        params = {'shell_target': target} if target != '/' else {}
        url = request.host_url + ('?' + urlencode(params) if params else '')
        try:
            subprocess.Popen([executable, '--new-window', url], stdin=subprocess.DEVNULL,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except OSError:
            return jsonify(error='No se ha podido abrir la ventana del navegador.'), 503
        return jsonify(status='opened')
