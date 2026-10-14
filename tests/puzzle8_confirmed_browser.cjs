// Real templates with victory_runtime_fixture.py; simulated SSE, no MQTT/hardware.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const {WebSocket} = require('undici');
const base = process.argv[2] || 'http://127.0.0.1:8766';
const out = path.resolve(__dirname, '../output/memory-confirmados');
fs.mkdirSync(out, {recursive: true});
const profile = fs.mkdtempSync('/tmp/memory-chrome-');
const chrome = cp.spawn('google-chrome', ['--headless', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=0', '--user-data-dir=' + profile, '--hide-scrollbars',
    '--mute-audio', 'about:blank'], {stdio: 'ignore'});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let ws, session, id = 0;
const pending = new Map(), errors = [], reports = [];
function command(method, params = {}, sessionId = session) {
    return new Promise((resolve, reject) => {
        const n = ++id;
        pending.set(n, {resolve, reject});
        ws.send(JSON.stringify({id: n, method, params, ...(sessionId ? {sessionId} : {})}));
    });
}
async function evaluate(expression) {
    const result = await command('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
}
const inner = expression => evaluate(`(()=>{const w=document.getElementById('game-shell-frame').contentWindow;return (${expression});})()`);
async function until(expression) {
    for (let i = 0; i < 100; i++) {
        if (await evaluate(expression)) return;
        await delay(50);
    }
    throw Error('Timeout: ' + expression);
}
const symbols = ['alpha', 'beta', 'delta', 'epsilon', 'gamma', 'lambda', 'mu', 'omega', 'pi', 'sigma'];
const sets = [0, 1].map(offset => ({
    symbols: symbols.map((_, index) => symbols[(index + offset) % 10]),
    colors: Object.fromEntries(symbols.map(symbol => [symbol, offset ? 'blue' : 'red']))
}));
const saved = {1: [{symbol: 'delta', color: 'blue'}, {symbol: 'beta', color: 'black'}]};
const push = data => inner(`w.auditPush(${JSON.stringify({puzzle_id: 8, round: 1, round_total: 1,
    confirmed_boxes: [1], confirmed_entries: saved, ...data})})`);
const inspect = () => inner(`(()=>{
    const frames=[...w.document.querySelectorAll('.p8-frame')];
    return frames.map(frame=>({
        correct:frame.classList.contains('p8-correct'),wrong:frame.classList.contains('p8-wrong'),
        filled:frame.querySelectorAll('.p8-answer.is-filled').length,
        symbols:[...frame.querySelectorAll('.p8-symbol-mask')].map(n=>n.dataset.symbol),
        colors:[...frame.querySelectorAll('.p8-symbol-mask')].map(n=>w.getComputedStyle(n).backgroundColor)
    }));
})()`);
(async () => {
    try {
        for (let i = 0; i < 100 && !fs.existsSync(profile + '/DevToolsActivePort'); i++) await delay(50);
        const [port, endpoint] = fs.readFileSync(profile + '/DevToolsActivePort', 'utf8').trim().split('\n');
        ws = new WebSocket('ws://127.0.0.1:' + port + endpoint);
        await new Promise(resolve => ws.addEventListener('open', resolve, {once: true}));
        ws.addEventListener('message', event => {
            const message = JSON.parse(event.data);
            if (message.id) {
                const item = pending.get(message.id);
                pending.delete(message.id);
                message.error ? item.reject(message.error) : item.resolve(message.result);
            } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
        });
        const target = await command('Target.createTarget', {url: 'about:blank'}, null);
        session = (await command('Target.attachToTarget', {targetId: target.targetId, flatten: true}, null)).sessionId;
        await command('Page.enable');
        await command('Runtime.enable');
        for (const lang of ['es', 'ca', 'eng']) for (const [width, height] of [[1920, 1080], [1280, 720]]) {
            await command('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false});
            await command('Page.navigate', {url: base + '/?shell_target=/puzzle/8&lang=' + lang});
            await until('!!document.getElementById("game-shell-frame")?.contentWindow.auditStreams?.length');
            await inner('w.document.fonts.ready');
            for (const phase of ['numbers', 'tokens', 'input']) {
                await push({phase, clear: phase !== 'tokens', symbols, symbol_sets: sets});
                const frames = await inspect();
                assert.equal(frames[1].correct, true, 'confirmed frame stays green in ' + phase);
                assert.deepEqual(frames[1].symbols, ['delta', 'beta'], 'confirmed arrival order survives');
                assert.deepEqual(frames[1].colors, ['rgb(0, 102, 255)', 'rgb(0, 0, 0)']);
                assert.equal(frames[1].filled, 2);
                assert.equal(frames[0].filled, phase === 'tokens' ? 2 : 0);
                const layout = await inner(`(()=>{
                    // Measure content, not answer pseudo-elements: the existing memory
                    // halo deliberately extends 6px beyond each answer's border.
                    const nodes=[...w.document.querySelectorAll('.p8-frame,.p8-answer-content,#p8-instruction-detail')];
                    return {overflow:nodes.filter(n=>{const r=n.getBoundingClientRect();return r.left<0||r.right>w.innerWidth+1||r.bottom>w.innerHeight+1||n.scrollWidth>n.clientWidth+1||n.scrollHeight>n.clientHeight+1}).map(n=>({node:n.className||n.id,width:n.clientWidth,scrollWidth:n.scrollWidth,height:n.clientHeight,scrollHeight:n.scrollHeight,bounds:n.getBoundingClientRect().toJSON()})),
                    missingImages:[...w.document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)};
                })()`);
                assert.deepEqual(layout.overflow, []);
                assert.deepEqual(layout.missingImages, []);
                const shot = await command('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
                fs.writeFileSync(`${out}/${lang}-${width}-${phase}.png`, Buffer.from(shot.data, 'base64'));
                reports.push({lang, width, height, phase, ...layout});
            }
            await push({phase: 'input', input_update: {box: 0, symbol: 'alpha', color: 'red'}});
            assert.equal((await inspect())[0].filled, 1);
            assert.equal((await inspect())[1].correct, true);
            // Reconnection snapshots restore all input without duplicating saved entries.
            await push({phase: 'input', clear: true, symbols, input_entries: {
                ...saved, 0: [{symbol: 'alpha', color: 'red'}]
            }});
            assert.equal((await inspect())[0].filled, 1);
            assert.equal((await inspect())[1].filled, 2);
            const entries = Object.fromEntries(symbols.map((_, box) => [box,
                saved[box] || sets.map(set => ({symbol: set.symbols[box], color: set.colors[set.symbols[box]]}))
            ]));
            const result = {success: false, box_results: Object.fromEntries(symbols.map((_, box) => [box, box === 1]))};
            await push({phase: 'input', clear: true, symbols, input_entries: entries});
            await push({phase: 'input', input_result: result});
            assert.equal(await inner("w.document.getElementById('p8-retry-screen').hidden"), true);
            assert.equal(await inner("w.document.getElementById('p8-grid-wrap').hidden"), false);
            const results = await inspect();
            assert.ok(results.every(frame => frame.filled === 2), 'all registered letters remain visible');
            assert.ok(results.every((frame, box) => box === 1 ? frame.correct && !frame.wrong : frame.wrong && !frame.correct));
            // Recovery during the five-second board review retains both letters and result colours.
            await push({phase: 'input', clear: true, symbols, input_entries: entries, input_result: result});
            assert.deepEqual(await inspect(), results);
            const resultShot = await command('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
            fs.writeFileSync(`${out}/${lang}-${width}-results.png`, Buffer.from(resultShot.data, 'base64'));
            reports.push({lang, width, height, phase: 'results', frames: results});
            await push({phase: 'retry', retry_summary: {errors: 9, accumulated_correct: 1},
                phase_duration_ms: 10000, phase_remaining_ms: 10000});
            const retry = await inner(`(()=>{
                const screen=w.document.getElementById('p8-retry-screen');
                const nodes=[screen,...screen.querySelectorAll('strong,span,h2'),w.document.getElementById('p8-instruction-detail')];
                return {visible:!screen.hidden&&w.getComputedStyle(screen).display!=='none',
                    gridHidden:w.getComputedStyle(w.document.getElementById('p8-grid-wrap')).display==='none',
                    errors:w.document.getElementById('p8-retry-errors').textContent,
                    correct:w.document.getElementById('p8-retry-correct').textContent,
                    seconds:w.document.getElementById('p8-retry-countdown-value').textContent,
                    next:w.document.getElementById('p8-retry-next').textContent,
                    overflow:nodes.filter(n=>{const r=n.getBoundingClientRect();return r.left<0||r.right>w.innerWidth+1||r.bottom>w.innerHeight+1||n.scrollWidth>n.clientWidth+1||n.scrollHeight>n.clientHeight+1}).map(n=>n.id||n.className)};
            })()`);
            assert.equal(retry.visible, true);
            assert.equal(retry.gridHidden, true);
            assert.equal(retry.errors, '9');
            assert.equal(retry.correct, '1');
            assert.equal(retry.seconds, '10');
            assert.equal(retry.next, {es: 'El siguiente intento empieza en:', ca: 'El següent intent comença en:', eng: 'The next attempt starts in:'}[lang]);
            assert.deepEqual(retry.overflow, []);
            const retryShot = await command('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
            fs.writeFileSync(`${out}/${lang}-${width}-retry.png`, Buffer.from(retryShot.data, 'base64'));
            reports.push({lang, width, height, phase: 'retry', ...retry});
            await until(`document.getElementById('game-shell-frame').contentWindow.document.getElementById('p8-retry-countdown-value').textContent==='9'`);
            await push({phase: 'retry', retry_summary: {errors: 9, accumulated_correct: 1},
                phase_duration_ms: 10000, phase_remaining_ms: 3400});
            assert.equal(await inner("w.document.getElementById('p8-retry-countdown-value').textContent"), '4');
            await push({phase: 'numbers', clear: true, confirmed_boxes: [], confirmed_entries: {}});
            assert.equal(await inner("w.document.getElementById('p8-retry-screen').hidden"), true);
            assert.equal(await inner("w.document.getElementById('p8-grid-wrap').hidden"), false);
            assert.ok((await inspect()).every(frame => frame.filled === 0 && !frame.correct && !frame.wrong));
        }
        assert.deepEqual(errors, []);
        fs.writeFileSync(out + '/verification.json', JSON.stringify({reports, errors}, null, 2));
        console.log('Memory confirmations verified: ' + reports.length + ' phase/language/resolution checks');
    } finally {
        ws?.close();
        chrome.kill('SIGTERM');
    }
})().catch(error => {console.error(error); process.exitCode = 1;});