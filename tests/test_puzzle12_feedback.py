"""Player feedback with real templates and isolated clocks, without MQTT."""
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
window.EventSource = class {};
window.previewRequests = [];
window.previewSounds = [];
window.Audio = class {
    constructor(url) { window.previewSounds.push(url); }
    play() { return Promise.resolve(); }
};
window.fetch = (url, options) => {
    window.previewRequests.push({url, options});
    return Promise.resolve({json: () => Promise.resolve({})});
};
window.requestAnimationFrame = () => 1;
window.cancelAnimationFrame = () => {};
const previewTimers = new Map();
let previewTime = 0;
let previewId = 0;
window.setTimeout = (callback, delay = 0) => {
    const id = ++previewId;
    previewTimers.set(id, {callback, due: previewTime + delay, repeat: 0});
    return id;
};
window.setInterval = (callback, delay) => {
    const id = window.setTimeout(callback, delay);
    previewTimers.get(id).repeat = delay;
    return id;
};
window.clearTimeout = window.clearInterval = id => previewTimers.delete(id);
window.advancePreview = milliseconds => {
    const end = previewTime + milliseconds;
    while (true) {
        const next = [...previewTimers.entries()].filter(([, timer]) => timer.due <= end)
            .sort((a, b) => a[1].due - b[1].due)[0];
        if (!next) break;
        const [id, timer] = next;
        previewTime = timer.due;
        if (timer.repeat) timer.due += timer.repeat;
        else previewTimers.delete(id);
        timer.callback();
    }
    previewTime = end;
};
window.previewCompleted = [];
window.PyramidLevelVictory = {active: false, complete: id => {window.PyramidLevelVictory.active=true;window.previewCompleted.push(id);}};
"""

CHECK = """
document.addEventListener('DOMContentLoaded', async () => {
    await document.fonts.ready;
    const checks = [];
    const test = (name, ok) => checks.push({name, ok});
    const good = document.getElementById('good-img');
    const wrong = document.getElementById('wrong-img');
    const wait = document.getElementById('wait-screen');
    const pattern = document.getElementById('button-pattern');
    const viewport = document.getElementById('final-viewport');
    const shown = element => getComputedStyle(element).display !== 'none';
    const target = [2, 2, 5, 2, 2, 2];
    const start = round => window.puzzle12Debug.push({startRound: true,
        round, total_rounds: 3, level_id: 3, target, duration: 2});
    const success = () => document.body.classList.contains('p12-success-state');
    const danger = () => document.body.classList.contains('p12-danger-state');
    const fits = element => {
        const bounds = viewport.getBoundingClientRect();
        const rect = element.getBoundingClientRect();
        return rect.left >= bounds.left && rect.right <= bounds.right &&
            rect.top >= bounds.top && rect.bottom <= bounds.bottom;
    };
    const checkFeedback = kind => {
        const element = kind === 'success' ? good : wrong;
        const rgb = kind === 'success' ? '45, 255, 155' : '241, 92, 104';
        test(kind + ' text fits', fits(element.firstElementChild));
        test(kind + ' has no image', !shown(wait) && !element.querySelector('img'));
        test(kind + ' gradient color', getComputedStyle(viewport, '::before').backgroundImage.includes(rgb));
        test(kind + ' gradient animation', getComputedStyle(viewport, '::before').animationName ===
            (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'none' : 'p12FeedbackPulse'));
    };
    start(1);
    test('initial round starts without countdown', !shown(wait) && !shown(good) && !shown(wrong));
    test('initial timer starts immediately', shown(document.getElementById('timer-overlay')) &&
        document.getElementById('timer-overlay').textContent === '00:02');
    test('no initial countdown beep', !window.previewSounds.some(url => url.endsWith('beep_countdown.wav')));
    test('button counts unchanged', shown(pattern) && pattern.children.length === 15);
    window.puzzle12Debug.success();
    test('phase success immediately green', success() && !danger() && shown(good) && !shown(pattern));
    checkFeedback('success');
    const language = window.PYRAMID_GAME.language;
    const messages = {
        es: ['NIVEL SUPERADO', 'SE ACABÓ EL TIEMPO'],
        ca: ['NIVELL SUPERAT', 'TEMPS ESGOTAT'],
        eng: ['LEVEL COMPLETED', 'TIME IS UP']
    }[language];
    test('success translation', good.textContent.trim() === messages[0]);
    start(2);
    window.advancePreview(4000);
    test('no extra popup or pyramid during pause', success() && shown(good) && !shown(wait) &&
        !shown(document.getElementById('p12-phase-popup')));
    window.advancePreview(2000);
    test('next round clears success', !success() && shown(wait) && !shown(good));
    window.advancePreview(3000);
    window.advancePreview(2000);
    test('timeout immediately red', danger() && !success() && shown(wrong) && !shown(good) && !shown(pattern));
    test('timeout translation', wrong.textContent.trim() === messages[1]);
    checkFeedback('timeout');
    test('timeout still notifies backend once', window.previewRequests.filter(item => item.url === '/timer_expired' && item.options.method === 'POST').length === 1);
    test('timeout sound unchanged', window.previewSounds.filter(url => url.endsWith('fase_nocompletada.wav')).length === 1);
    start(2);
    test('retry clears timeout', !danger() && !shown(wrong) && shown(wait));
    test('retry starts countdown at three', document.getElementById('countdown-number').textContent === '3' && !shown(pattern));
    window.advancePreview(2000);
    test('retry waits until countdown ends', document.getElementById('countdown-number').textContent === '1' && !shown(pattern));
    window.advancePreview(1000);
    test('retry starts pattern and full timer', shown(pattern) && !shown(wait) &&
        document.getElementById('timer-overlay').textContent === '00:02');
    window.puzzle12Debug.success();
    window.puzzle12Debug.solved();
    test('final confirmation delegates to the shared victory', window.previewCompleted.join(',') === '12');
    test('final confirmation never shows the old green screen', !shown(document.getElementById('p12-solved-banner')));
    window.puzzle12Debug.solved();
    window.advancePreview(4000);
    test('duplicate confirmation does not replay victory', window.previewCompleted.join(',') === '12');
    document.body.dataset.feedbackResult = JSON.stringify({width: innerWidth, height: innerHeight, checks});
});
"""


@unittest.skipUnless(shutil.which('google-chrome'), 'Chrome is required for layout checks')
class Puzzle12FeedbackTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app, _ = create_runtime()

        @app.route('/feedback-preview')
        def preview():
            language = request.args.get('lang', 'es')
            with app.test_client() as client:
                page = client.get('/puzzle/12?lang=' + language).get_data(as_text=True)
            page = re.sub(
                r'<script src="[^"]*(?:shell_guard|presentation-game-bridge|bgm_layer|level-victory)\.js"></script>',
                '', page)
            page = page.replace('<head>', '<head><script>' + SETUP + '</script>')
            return page.replace('</body>', '<script>' + CHECK + '</script></body>')

        cls.server = make_server('127.0.0.1', 0, app)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)

    def test_phase_timeout_retry_and_final_feedback(self):
        for width, height in [(1920, 1080), (1280, 720)]:
            for language in ['es', 'ca', 'en']:
                for reduced in [False, True]:
                    with self.subTest(width=width, height=height, language=language, reduced=reduced):
                        args = ['google-chrome', '--headless', '--no-sandbox', '--disable-gpu',
                                '--hide-scrollbars', f'--window-size={width},{height + 87}',
                                '--virtual-time-budget=1000', '--dump-dom']
                        if reduced:
                            args.append('--force-prefers-reduced-motion')
                        args.append(f'http://127.0.0.1:{self.server.server_port}/feedback-preview?lang={language}')
                        result = subprocess.run(args, capture_output=True, text=True, check=True, timeout=20)
                        match = re.search(r'data-feedback-result="([^"]*)"', result.stdout)
                        self.assertIsNotNone(match, 'Browser did not finish the feedback fixture')
                        data = json.loads(html.unescape(match[1]))
                        self.assertEqual((data['width'], data['height']), (width, height))
                        for check in data['checks']:
                            self.assertTrue(check['ok'], check['name'])


if __name__ == '__main__':
    unittest.main()