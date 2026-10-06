"""Isolated browser checks: no app startup, broker or hardware connections."""
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
window.previewAudios = [];
window.Audio = class extends EventTarget {
    constructor(url) { super(); this.url = url; window.previewAudios.push(this); }
    play() {
        if (window.rejectNextAudioPlay) {
            window.rejectNextAudioPlay = false;
            return Promise.reject(new Error('Simulated playback failure'));
        }
        this.dispatchEvent(new Event('playing'));
        return Promise.resolve();
    }
    pause() { this.paused = true; }
};
window.fetch = () => Promise.resolve({json: () => Promise.resolve({})});
window.requestAnimationFrame = callback => { window.motionFrame = callback; return 1; };
window.cancelAnimationFrame = () => {};
Math.random = () => 0.99;
"""

CHECK = """
document.addEventListener('DOMContentLoaded', async () => {
    await document.fonts.ready;
    const hz = Number(new URLSearchParams(location.search).get('hz'));
    const head = document.querySelector('.snake-player[data-player="1"] .snake-head');
    const stage = document.getElementById('p2-snake-stage');
    const position = () => [parseFloat(head.style.left), parseFloat(head.style.top)];
    window.motionFrame(0);
    const start = position();
    for (let frame = 1; frame <= Math.floor(1.8 * hz); frame++) {
        window.motionFrame(frame * 1000 / hz);
    }
    window.motionFrame(1800);
    const end = position();
    const scale = stage.getBoundingClientRect().width / stage.clientWidth;
    const physicalDistance = (end[0] - start[0]) * scale;
    const beforeResize = position();
    window.dispatchEvent(new Event('resize'));
    const afterResize = position();
    window.puzzle2Debug.progress(1, 1);
    const afterUpdate = position();
    window.motionFrame(20000);
    const afterPause = position();
    window.puzzle2Debug.error(1);
    window.motionFrame(20180);
    const marker = document.querySelector('.snake-error-marker');
    const segment = document.querySelectorAll('.snake-player[data-player="1"] .snake-segment')[1];
    const bounds = stage.getBoundingClientRect();
    const allFit = [...stage.querySelectorAll('.snake-head,.snake-segment,.snake-error-marker')].every(el => {
        const r = el.getBoundingClientRect();
        return r.left >= bounds.left - .1 && r.right <= bounds.right + .1 &&
            r.top >= bounds.top - .1 && r.bottom <= bounds.bottom + .1;
    });
    document.body.dataset.motionResult = JSON.stringify({
        width: innerWidth, height: innerHeight, hz,
        logicalDistance: end[0] - start[0], physicalDistance, scale,
        stableOnResize: JSON.stringify(beforeResize) === JSON.stringify(afterResize),
        stableOnUpdate: JSON.stringify(beforeResize) === JSON.stringify(afterUpdate),
        stableAfterPause: JSON.stringify(afterUpdate) === JSON.stringify(afterPause),
        markerFollows: marker.style.left === segment.style.left && marker.style.top === segment.style.top,
        allFit
    });
});
"""

CHECK_ALARM = """
document.addEventListener('DOMContentLoaded', async () => {
    const stage = document.getElementById('p2-snake-stage');
    const checks = [];
    const test = (name, ok) => checks.push({name, ok});
    const active = () => document.body.classList.contains('p2-alarm-sounding');
    const start = () => {
        window.puzzle2Debug.push({play_alarm_sound: {url: '/fixture-alarm.wav'}});
        return window.previewAudios.at(-1);
    };
    const normalBackground = getComputedStyle(stage).backgroundColor;
    test('initially normal', !active());
    const first = start();
    test('red gradient during playback', active() && getComputedStyle(stage, '::before').backgroundImage.includes('radial-gradient'));
    test('no rectangular background fill', getComputedStyle(stage).backgroundColor === normalBackground);
    test('gradient fades out at edges', getComputedStyle(stage, '::before').backgroundImage.includes('rgba(0, 0, 0, 0) 72%'));
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    test('motion preference respected', getComputedStyle(stage, '::before').animationName === (reduced ? 'none' : 'p2-alarm-background'));
    const second = start();
    test('previous audio stopped', first.paused && active());
    first.dispatchEvent(new Event('ended'));
    test('old ended event does not stop new effect', active());
    second.dispatchEvent(new Event('ended'));
    test('normal immediately after audio ends', !active() && getComputedStyle(stage).backgroundColor === normalBackground);
    start().dispatchEvent(new Event('error'));
    test('audio error clears effect', !active());
    window.rejectNextAudioPlay = true;
    start();
    await Promise.resolve();
    test('rejected playback clears effect', !active());
    const interrupted = start();
    window.puzzle2Debug.push({play_normal_sound: {url: '/fixture-normal.wav'}});
    test('normal audio interrupts alarm', interrupted.paused && !active());
    start();
    window.puzzle2Debug.reset();
    test('reset clears effect', !active());
    start();
    window.puzzle2Debug.solved();
    test('solved clears effect', !active());
    document.body.dataset.alarmResult = JSON.stringify({width: innerWidth, height: innerHeight, checks});
});
"""


@unittest.skipUnless(shutil.which('google-chrome'), 'Chrome is required for layout checks')
class Puzzle2MotionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app, _ = create_runtime()

        @app.route('/motion-preview')
        @app.route('/alarm-preview')
        def preview():
            with app.test_client() as client:
                page = client.get('/puzzle/2').get_data(as_text=True)
            page = re.sub(
                r'<script src="[^"]*(?:shell_guard|presentation-game-bridge|bgm_layer)\.js"></script>',
                '', page)
            page = page.replace('<head>', '<head><script>' + SETUP + '</script>')
            check = CHECK_ALARM if request.path == '/alarm-preview' else CHECK
            return page.replace('</body>', '<script>' + check + '</script></body>')

        cls.server = make_server('127.0.0.1', 0, app)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)

    def test_same_logical_speed_at_every_resolution_and_refresh_rate(self):
        # Chrome's outer window height includes 87px of browser chrome.
        for width, height in [(1920, 1080), (1280, 720)]:
            for hz in [30, 60, 144]:
                with self.subTest(width=width, height=height, hz=hz):
                    result = subprocess.run([
                        'google-chrome', '--headless', '--no-sandbox', '--disable-gpu',
                        '--hide-scrollbars', f'--window-size={width},{height + 87}',
                        '--virtual-time-budget=1000', '--dump-dom',
                        f'http://127.0.0.1:{self.server.server_port}/motion-preview?hz={hz}',
                    ], capture_output=True, text=True, check=True, timeout=20)
                    match = re.search(r'data-motion-result="([^"]*)"', result.stdout)
                    self.assertIsNotNone(match, 'Browser did not finish the fixture')
                    data = json.loads(html.unescape(match[1]))
                    self.assertEqual((data['width'], data['height']), (width, height))
                    self.assertAlmostEqual(data['logicalDistance'], 360, places=5)
                    self.assertAlmostEqual(data['physicalDistance'] / data['scale'], 360, places=5)
                    for key in ['stableOnResize', 'stableOnUpdate', 'stableAfterPause', 'markerFollows', 'allFit']:
                        self.assertTrue(data[key], (key, data))

    def test_alarm_background_follows_audio_lifecycle(self):
        for width, height in [(1920, 1080), (1280, 720)]:
            for reduced in [False, True]:
                with self.subTest(width=width, height=height, reduced=reduced):
                    args = ['google-chrome', '--headless', '--no-sandbox', '--disable-gpu',
                            '--hide-scrollbars', f'--window-size={width},{height + 87}',
                            '--virtual-time-budget=1000', '--dump-dom']
                    if reduced:
                        args.append('--force-prefers-reduced-motion')
                    args.append(f'http://127.0.0.1:{self.server.server_port}/alarm-preview')
                    result = subprocess.run(args, capture_output=True, text=True, check=True, timeout=20)
                    match = re.search(r'data-alarm-result="([^"]*)"', result.stdout)
                    self.assertIsNotNone(match, 'Browser did not finish the audio fixture')
                    data = json.loads(html.unescape(match[1]))
                    for check in data['checks']:
                        self.assertTrue(check['ok'], check['name'])


if __name__ == '__main__':
    unittest.main()