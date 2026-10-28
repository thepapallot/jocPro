// Chrome regression against victory_runtime_fixture.py only: fake SSE, no app/MQTT.
// Run the fixture separately, then: node tests/puzzle5_browser.cjs [fixture URL]
// Use --allow-missing-local-audio only when the USB audio pack is not installed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const {WebSocket} = require('undici');
const base = process.argv[2] || 'http://127.0.0.1:8766';
const allowMissingLocalAudio = process.argv.includes('--allow-missing-local-audio');
const out = path.resolve(__dirname, '../output/chrono-revisio');
fs.mkdirSync(out, {recursive: true});
const profile = fs.mkdtempSync('/tmp/chrono-chrome-');
const chrome = cp.spawn('google-chrome', ['--headless', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=0', '--user-data-dir=' + profile, '--mute-audio', 'about:blank'], {stdio: 'ignore'});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let ws, session, id = 0;
const pending = new Map(), errors = [], networkFailures = [], reports = [], defects = [], localizationIssues = [];
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
const push = data => inner(`w.auditPush(${JSON.stringify({puzzle_id: 5, round: 1,
    objective: 30, attempt: 1, max_attempts: 10, available_points: 100,
    limit: 10, total_points: 0, auto_advance: false, ...data})})`);
const names = {ca: 'Pols del Temps', es: 'Pulso de Tiempo', eng: 'Pulse of Time'};
const attempts = {ca: 'INTENT 2/10', es: 'INTENTO 2/10', eng: 'ATTEMPT 2/10'};
const exhaustedCopy = {
    ca: ['INTENTS ESGOTATS', '10 intents · 0 punts', 'Continuem amb el següent nivell'],
    es: ['INTENTOS AGOTADOS', '10 intentos · 0 puntos', 'Continuamos con el siguiente nivel'],
    eng: ['NO ATTEMPTS LEFT', '10 attempts · 0 points', 'Moving on to the next level']
};
async function inspect(lang, width, height, phase, selectors) {
    const layout = await inner(`(()=>{
        const doc=w.document, scale=doc.getElementById('game-stage').getBoundingClientRect().width/1920;
        const canvas=doc.createElement('canvas').getContext('2d');
        const nodes=[...new Set(${JSON.stringify(selectors)}.flatMap(s=>[...doc.querySelectorAll(s)]))];
        const rect=r=>({left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height});
        const clipped=(r,n,includeSelf=false)=>{
            const by=[];
            if(r.left < -1 || r.top < -1 || r.right>w.innerWidth+1 || r.bottom>w.innerHeight+1)by.push('viewport');
            for(let p=includeSelf?n:n.parentElement;p;p=p.parentElement){
                const s=w.getComputedStyle(p),b=p.getBoundingClientRect();
                if(/hidden|clip|auto|scroll/.test(s.overflowX)&&(r.left<b.left-1||r.right>b.right+1))by.push((p.id||p.className)+':x');
                if(/hidden|clip|auto|scroll/.test(s.overflowY)&&(r.top<b.top-1||r.bottom>b.bottom+1))by.push((p.id||p.className)+':y');
            }
            return by;
        };
        return {viewport:[w.innerWidth,w.innerHeight],scale,fontLoaded:doc.fonts.check('900 100px PiramideDisplay'),
            missingImages:[...doc.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src),
            nodes:nodes.map(n=>{
                const s=w.getComputedStyle(n),r=n.getBoundingClientRect();
                let visible=!!n.getClientRects().length&&r.width>0&&r.height>0;
                for(let p=n;p;p=p.parentElement){const ps=w.getComputedStyle(p);if(ps.display==='none'||ps.visibility==='hidden'||Number(ps.opacity)===0)visible=false;}
                const ranges=[];
                for(const child of n.childNodes)if(child.nodeType===3&&child.textContent.trim()){
                    const range=doc.createRange();range.selectNodeContents(child);
                    for(const rr of range.getClientRects())ranges.push({bounds:rect(rr),clippedBy:clipped(rr,n,true)});
                }
                canvas.font=[s.fontStyle,s.fontWeight,s.fontSize,s.fontFamily].join(' ');
                const m=canvas.measureText(n.textContent);
                // Range boxes can exceed a tight line-height without clipped ink. Record both.
                return {node:n.id||n.className||n.tagName,text:n.textContent.trim(),visible,
                    bounds:rect(r),clippedBy:clipped(r,n),ranges,
                    overflowX:n.scrollWidth>n.clientWidth+1,overflowY:n.scrollHeight>n.clientHeight+1,
                    font:s.fontFamily,fontSize:s.fontSize,lineHeight:s.lineHeight,
                    inkHeight:m.actualBoundingBoxAscent+m.actualBoundingBoxDescent};
            })};
    })()`);
    // scrollHeight alone is not clipping: existing tight numeric lines have visible overflow.
    const expected = layout.nodes.filter(n => !n.visible || n.clippedBy.length || n.ranges.some(r => r.clippedBy.length));
    if (expected.length) defects.push({lang, width, phase, nodes: expected});
    const overlap = await inner(`(()=>{
        const nodes=[...w.document.querySelectorAll('.game-corner-identity h1,#streak,.game-corner-progress')];
        const found=[];
        for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
            const a=nodes[i].getBoundingClientRect(),b=nodes[j].getBoundingClientRect();
            if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)
                found.push([nodes[i].id||nodes[i].className,nodes[j].id||nodes[j].className]);
        }
        return found;
    })()`);
    if (overlap.length) defects.push({lang, width, phase, overlap});
    assert.deepEqual(layout.viewport, [width, height]);
    assert.equal(layout.fontLoaded, true);
    assert.deepEqual(layout.missingImages, []);
    const shot = await command('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
    fs.writeFileSync(`${out}/${lang}-${width}-${phase}.png`, Buffer.from(shot.data, 'base64'));
    reports.push({lang, width, height, phase, ...layout});
}
const header = ['.game-corner-identity h1', '#streak', '#streak-attempt', '#p5-points', '#p5-points-value'];
const countdown = ['.game-corner-identity h1', '#objective-card', '#p5-preparation-title', '#objective-text',
    '#objective-subtext', '#p5-preparation-countdown', '#p5-countdown-value',
    '#p5-preparation-hint', '#p5-preparation-margin', '#p5-preparation-limit'];
const board = [...header, '#brief-objective', '#players-section', '.player-box', '.box-label',
    '.brief-label', '.box-time', '.box-error', '#error-section', '.error-meta', '#error-limit-text', '#error-text'];
(async () => {
    try {
        assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'local isolated fixture only');
        const fixtureHtml = await (await fetch(base + '/')).text();
        assert.ok(fixtureHtml.includes('window.auditPush=data=>auditStreams'), 'refuse non-fixture server before navigation');
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
            else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args);
            else if (message.method === 'Network.responseReceived' && message.params.response.status >= 400)
                networkFailures.push({url: message.params.response.url, status: message.params.response.status});
            else if (message.method === 'Network.loadingFailed' && !message.params.canceled)
                networkFailures.push(message.params);
        });
        const target = await command('Target.createTarget', {url: 'about:blank'}, null);
        session = (await command('Target.attachToTarget', {targetId: target.targetId, flatten: true}, null)).sessionId;
        await command('Page.enable');
        await command('Runtime.enable');
        await command('Network.enable');
        for (const lang of ['ca', 'es', 'eng']) for (const [width, height] of [[1920, 1080], [1280, 720]]) {
            await command('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false});
            await command('Page.navigate', {url: base + '/?shell_target=%2Fpuzzle%2F5%3Fsession_id%3D1&lang=' + lang});
            await until('!!document.getElementById("game-shell-frame")?.contentWindow.auditStreams?.length');
            await inner('w.document.fonts.ready');
            assert.equal(await inner("w.document.querySelector('.game-corner-identity h1').textContent"), names[lang]);
            const earned = await evaluate('PyramidRun.snapshot().completedIds');
            await push({round: 0, waiting: true, active_round: false, waiting_seconds: 5,
                countdown_deadline: (Date.now() + 5000) / 1000});
            assert.equal(await inner("w.document.getElementById('p5-countdown-value').textContent"), '5 s');
            assert.equal(await inner("w.getComputedStyle(w.document.getElementById('players-section')).display"), 'none');
            await inspect(lang, width, height, 'initial', countdown);
            if (lang === 'eng') {
                const spanish = await inner(`['p5-preparation-title','p5-preparation-countdown','p5-preparation-hint','p5-preparation-margin'].map(id=>({id,text:w.document.getElementById(id).textContent})).filter(n=>/Preparados|Preparación|Empezad|Margen de error/.test(n.text))`);
                localizationIssues.push(...spanish.map(n => ({lang, width, ...n})));
            }
            await until("document.getElementById('game-shell-frame').contentWindow.document.getElementById('p5-countdown-value').textContent==='4 s'");
            await push({round_start: true, times: [], total: 0});
            // Partial then complete board: positive errors contribute absolute values.
            const times = Array.from({length: 10}, (_, player) => ({player, time: player % 2 ? -5 : 5}));
            await push({times: times.slice(0, 5), total: 25, player_time: times[4]});
            assert.equal(await inner("w.document.querySelectorAll('.player-box.filled').length"), 5);
            await inspect(lang, width, height, 'play', board.filter(s => s !== '.box-error'));
            if (lang === 'eng' && await inner("w.document.querySelector('.brief-label').textContent") === 'Objetivo')
                localizationIssues.push({lang, width, id: 'brief-objective', text: 'Objetivo'});
            await push({times, total: 50, round_result: {success: false, total: 50, limit: 10}});
            assert.equal(await inner("w.document.querySelectorAll('.result-failure').length"), 10);
            assert.equal(await inner("w.document.getElementById('error-text').textContent"), '50.0 / 10');
            await inspect(lang, width, height, 'failure', board);
            await push({attempt: 2, available_points: 90, limit: 14, countdown_message: 'retry', waiting_seconds: 9});
            assert.equal(await inner("w.document.getElementById('p5-countdown-value').textContent"), '9 s');
            assert.equal(await inner("w.document.getElementById('p5-preparation-limit').textContent"), '14 S');
            assert.equal(await inner("w.document.getElementById('streak-attempt').textContent"), attempts[lang]);
            assert.equal(await inner("w.document.getElementById('p5-points-value').textContent"), '90');
            await inspect(lang, width, height, 'retry', countdown);
            await until("document.getElementById('game-shell-frame').contentWindow.document.getElementById('p5-countdown-value').textContent==='8 s'");
            // Deadline recovery takes priority over a stale waiting_seconds value.
            await push({attempt: 2, available_points: 90, limit: 14, waiting: true, active_round: false,
                waiting_seconds: 9, countdown_deadline: (Date.now() + 3200) / 1000});
            assert.equal(await inner("w.document.getElementById('p5-countdown-value').textContent"), '4 s');
            // Expiring preparation never fabricates the terminal's start signal.
            await push({attempt: 2, waiting: true, active_round: false, waiting_seconds: 0});
            assert.equal(await inner("w.document.getElementById('p5-countdown-value').textContent"), '…');
            assert.equal(await inner("w.getComputedStyle(w.document.getElementById('players-section')).display"), 'none');
            await push({attempt: 10, available_points: 10, limit: 46, times,
                round_result: {success: false, total: 50, limit: 46}});
            await inspect(lang, width, height, 'tenth-failure', board);
            assert.equal(await inner("w.document.getElementById('p5-exhausted-screen').hidden"), true);
            // One real five-second review, without advancing browser clocks.
            if (lang === 'ca' && width === 1920) {
                await delay(5200);
                assert.equal(await inner("w.document.getElementById('p5-exhausted-screen').hidden"), true);
                assert.equal(await inner("w.document.querySelectorAll('.result-failure').length"), 10);
            }
            await push({attempt: 10, available_points: 0, limit: 46, puzzle_exhausted: true});
            assert.equal(await inner("w.document.getElementById('p5-exhausted-screen').hidden"), false);
            assert.equal(await inner('w.PyramidLevelVictory.active'), false);
            assert.equal(await inner("w.getComputedStyle(w.document.getElementById('puzzle5-shell')).display"), 'none');
            assert.deepEqual(await inner("[...w.document.querySelectorAll('#p5-exhausted-screen h2,#p5-exhausted-screen p')].map(n=>n.textContent)"), exhaustedCopy[lang]);
            await inspect(lang, width, height, 'exhausted', ['.game-corner-identity h1', '#p5-exhausted-screen',
                '#p5-exhausted-screen h2', '#p5-exhausted-screen p']);
            assert.deepEqual(await evaluate('PyramidRun.snapshot().completedIds'), earned);
            const nextId = await inner('w.NEXT_PUZZLE_ID ?? w.PYRAMID_GAME.finalId');
            await push({attempt: 10, available_points: 0, puzzle_exhausted: true, auto_advance: true});
            await until(`document.getElementById('game-shell-frame').contentWindow.location.pathname===${JSON.stringify('/presentacio/' + nextId)}`);
            assert.equal(await inner('w.location.search'), '?lang=' + lang);
            assert.deepEqual(await evaluate('PyramidRun.snapshot().completedIds'), earned);
            // Successful result board without publishing puzzle_solved (no celebration).
            await command('Page.navigate', {url: base + '/?shell_target=%2Fpuzzle%2F5%3Fsession_id%3D1&lang=' + lang});
            await until('!!document.getElementById("game-shell-frame")?.contentWindow.auditStreams?.length');
            await inner('w.document.fonts.ready');
            await push({times: times.map(t => ({...t, time: t.time / 10})),
                round_result: {success: true, total: 5, limit: 10}});
            assert.equal(await inner("w.document.querySelectorAll('.result-success').length"), 10);
            assert.equal(await inner('w.PyramidLevelVictory.active'), false);
            await inspect(lang, width, height, 'success', board);
        }
        console.log(JSON.stringify({checks: reports.length, layoutDefects: defects.length, errors,
            localizationIssues, missingResources: [...new Set(networkFailures.map(n => n.url || n.errorText))]}, null, 2));
        assert.deepEqual(errors, [], 'no JavaScript errors');
        assert.deepEqual(defects, [], 'visible, unclipped content in every phase');
        assert.deepEqual(localizationIssues, [], 'English preparation must not fall back to Spanish');
        // The browser may request a favicon the app does not supply. USB audio
        // is optional only when the caller explicitly requests a visual-only run.
        const unexpectedFailures = networkFailures.filter(failure => {
            const resource = failure.url ? new URL(failure.url).pathname : '';
            return resource !== '/favicon.ico' &&
                !(allowMissingLocalAudio && failure.status === 404 && resource.startsWith('/static/audios/'));
        });
        assert.deepEqual(unexpectedFailures, [], 'no unexpected missing resources or failed requests');
    } finally {
        fs.writeFileSync(out + '/verification.json', JSON.stringify({allowMissingLocalAudio,
            reports, defects, errors, localizationIssues, networkFailures}, null, 2));
        ws?.close();
        const chromeClosed = new Promise(resolve => {
            if (chrome.exitCode !== null) resolve();
            else chrome.once('close', resolve);
        });
        if (chrome.exitCode === null) chrome.kill('SIGTERM');
        await chromeClosed;
        fs.rmSync(profile, {recursive: true, force: true, maxRetries: 30, retryDelay: 200});
    }
})().catch(error => {console.error(error.message); process.exitCode = 1;});