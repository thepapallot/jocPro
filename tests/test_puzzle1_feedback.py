"""Real sum screen with fake SSE/clock, without app startup or hardware."""
import html
import json
import re
import shutil
import subprocess
import threading
import unittest

from flask import request
from werkzeug.serving import make_server
from presentation_fixture import create_runtime


SETUP = """
window.EventSource = class { constructor() { window.sumStream = this; } };
window.Audio = class { play() { return Promise.resolve(); } pause() {} };
window.previewRequests = [];
window.fetch = url => {
    window.previewRequests.push(url);
    return Promise.resolve({json: () => Promise.resolve({})});
};
window.PyramidLevelVictory = {active: false, complete() { this.active = true; }};
let clock = 0, timerId = 0;
const timers = new Map();
window.setTimeout = (fn, delay = 0) => {
    timers.set(++timerId, {fn, due: clock + delay, repeat: 0}); return timerId;
};
window.setInterval = (fn, delay) => {
    const id = window.setTimeout(fn, delay); timers.get(id).repeat = delay; return id;
};
window.clearTimeout = window.clearInterval = id => timers.delete(id);
window.advance = duration => {
    const end = clock + duration;
    while (true) {
        const next = [...timers].filter(([, t]) => t.due <= end).sort((a,b) => a[1].due-b[1].due)[0];
        if (!next) break;
        const [id, t] = next;
        clock = t.due;
        if (t.repeat) t.due += t.repeat; else timers.delete(id);
        t.fn();
    }
    clock = end;
};
"""

CHECK = """
document.addEventListener('DOMContentLoaded', async () => {
    await document.fonts.ready;
    const checks = [];
    const test = (name, ok) => checks.push({name, ok: Boolean(ok)});
    const push = data => window.sumStream.onmessage({data: JSON.stringify({puzzle_id:1, ...data})});
    const board = [[5,1,'Y'],[8,2,'N'],[12,3,'N'],[17,4,'N']];
    const start = () => push({round:1, round_size:4, operations:board, start_timer:true});
    const duplicate = resets => push({operations:board, incorrect:{result:5,
        text:'Suma ya realizada  2 + 3 = 5', reason:'already_solved', display_ms:5000, resets_round:resets}});
    const timer = () => document.getElementById('timer').textContent;
    const danger = () => document.body.classList.contains('p1-danger-state');
    const message = () => document.getElementById('objective-message').textContent;
    const completed = () => document.querySelectorAll('.op.correct').length;
    start();
    window.advance(3000);
    duplicate(false);
    test('nonblocking error visible', danger() && message().length > 0);
    test('solved tile preserved', completed() === 1);
    window.advance(5000);
    test('clock continues without reset', timer() === '00:37');
    test('feedback clears without recovery event', !danger() && message() === '');
    test('board still preserved', completed() === 1 && document.querySelectorAll('.op').length === 4);
    const bounds = document.getElementById('puzzle-container').getBoundingClientRect();
    test('board fits viewport', bounds.left >= 0 && bounds.right <= innerWidth + 1 && bounds.top >= 0 && bounds.bottom <= innerHeight + 1);
    duplicate(false);
    window.advance(1000);
    push({solved:{result:8,text:'4 + 4 = 8'}});
    test('new valid sum accepted during feedback', completed() === 2 && !danger());
    window.advance(4000);
    test('old error does not return', !danger() && message() === '');
    start();
    duplicate(true);
    window.advance(5000);
    test('resetting error still pauses clock', timer() === '00:45');
    start();
    test('restart clears danger', !danger());
    window.advance(44000);
    duplicate(false);
    window.advance(1000);
    const timeoutMessage = message();
    test('timeout during feedback still notifies backend', window.previewRequests.filter(url => url === '/timer_expired').length === 1);
    test('timeout visible', timer() === '00:00' && danger() && timeoutMessage.length > 0);
    window.advance(5000);
    test('stale feedback never clears timeout', danger() && message() === timeoutMessage);
    start();
    duplicate(false);
    push({puzzle_solved:true});
    window.advance(6000);
    test('final completion stops clock', window.PyramidLevelVictory.active && timer() === '00:45');
    document.body.dataset.sumChecks = JSON.stringify(checks);
});
"""


@unittest.skipUnless(shutil.which('google-chrome'), 'Chrome is required')
class Puzzle1FeedbackTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app, _ = create_runtime()

        @app.route('/sum-feedback-preview')
        def preview():
            with app.test_client() as client:
                page = client.get('/puzzle/1?lang=' + request.args.get('lang', 'ca')).get_data(as_text=True)
            page = re.sub(
                r'<script src="[^"]*(?:shell_guard|presentation-game-bridge|bgm_layer|level-victory)\.js"></script>',
                '', page)
            return page.replace('<head>', '<head><script>' + SETUP + '</script>').replace(
                '</body>', '<script>' + CHECK + '</script></body>')

        cls.server = make_server('127.0.0.1', 0, app)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)

    def test_feedback_and_clock(self):
        for width, height in [(1920, 1080), (1280, 720)]:
            for language in ['ca', 'es', 'en']:
                with self.subTest(width=width, height=height, language=language):
                    result = subprocess.run([
                        'google-chrome', '--headless', '--no-sandbox', '--disable-gpu',
                        '--hide-scrollbars', f'--window-size={width},{height + 87}',
                        '--virtual-time-budget=1500', '--dump-dom',
                        f'http://127.0.0.1:{self.server.server_port}/sum-feedback-preview?lang={language}'
                    ], capture_output=True, text=True, check=True, timeout=25)
                    match = re.search(r'data-sum-checks="([^"]*)"', result.stdout)
                    self.assertIsNotNone(match, result.stderr[-2000:])
                    checks = json.loads(html.unescape(match.group(1)))
                    self.assertTrue(checks)
                    self.assertEqual([item['name'] for item in checks if not item['ok']], [])


if __name__ == '__main__':
    unittest.main()