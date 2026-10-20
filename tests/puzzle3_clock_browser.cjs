// Real templates/controllers against victory_runtime_fixture.py ONLY. No app/MQTT.
// Start that fixture, then run: node tests/puzzle3_clock_browser.cjs [fixture URL]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const {WebSocket} = require('undici');
const base = process.argv[2] || 'http://127.0.0.1:8766';
const out = path.resolve(__dirname, '../output/quiz-clock');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const expected = [5, 1, 5, 1, 5, 1, 5, 1, 1, 1];
const question = id => ({id, q: '¿Qué países forman parte de Europa?',
    answers: ['España', 'Japón', 'Francia', 'Brasil', 'Italia', 'Egipto', 'Alemania', 'Canadá', 'Australia', 'India']});
const result = success => ({success, correct_answers: expected,
    player_answers: Object.fromEntries(expected.map((answer, player) => [player, !success && player === 0 ? 1 : answer]))});
const pending = new Map(), errors = [], failedRequests = [], reports = [];
let chrome, ws, session, serial = 0;
function command(method, params = {}, sessionId = session) {
    const id = ++serial;
    return new Promise((resolve, reject) => {
        pending.set(id, {resolve, reject});
        ws.send(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}));
    });
}
async function evaluate(expression) {
    const data = await command('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
    if (data.exceptionDetails) throw Error(JSON.stringify(data.exceptionDetails));
    return data.result.value;
}
const inner = expression => evaluate(`(()=>{const w=document.getElementById('game-shell-frame').contentWindow;return (${expression});})()`);
const push = data => inner(`w.auditPush(${JSON.stringify({puzzle_id: 3, ...data})})`);
async function until(expression) {
    for (let i = 0; i < 100; i++) {
        try { if (await evaluate(expression)) return; } catch {}
        await delay(50);
    }
    throw Error('Timeout: ' + expression);
}
async function navigate(route, lang) {
    await command('Page.navigate', {url: base + '/?shell_target=' + encodeURIComponent(route) + '&lang=' + lang});
    await until(`document.getElementById('game-shell-frame')?.contentWindow.location.pathname===${JSON.stringify(route)}`);
    await until(`!!document.getElementById('game-shell-frame').contentWindow.${route === '/puzzle/3' ? 'puzzle3Debug' : 'PyramidBriefing'}`);
    await inner('w.document.fonts.ready');
}
async function recover(state) {
    await inner(`(()=>{
        w.auditSnapshot=${JSON.stringify({puzzle_id: 3, ...state})};
        if(!w.clockOriginalFetch){
            w.clockOriginalFetch=w.fetch;
            w.fetch=(url,...args)=>String(url).includes('/current_state')
                ?Promise.resolve(new w.Response(JSON.stringify(w.auditSnapshot),{headers:{'Content-Type':'application/json'}}))
                :w.clockOriginalFetch(url,...args);
        }
        w.auditStreams[0].onopen();
        return new Promise(resolve=>w.setTimeout(resolve,0));
    })()`);
}
async function inspect(lang, width, height, phase, selectors) {
    await inner('Promise.all([...w.document.images].map(i=>i.decode().catch(()=>{})))');
    const layout = await inner(`(()=>{
        const nodes=${JSON.stringify(selectors)}.flatMap(s=>[...w.document.querySelectorAll(s)]);
        const clipped=[];
        for(const n of nodes){
            const bounds=n.getBoundingClientRect();
            if(!bounds.width||!bounds.height||bounds.left<0||bounds.top<0||bounds.right>w.innerWidth+1||bounds.bottom>w.innerHeight+1)clipped.push(n.id||n.className);
            const range=w.document.createRange();range.selectNodeContents(n);
            for(const r of range.getClientRects())for(let p=n;p;p=p.parentElement){
                const s=w.getComputedStyle(p),b=p.getBoundingClientRect();
                if((/hidden|clip|auto|scroll/.test(s.overflowX)&&(r.left<b.left-1||r.right>b.right+1))||
                   (/hidden|clip|auto|scroll/.test(s.overflowY)&&(r.top<b.top-1||r.bottom>b.bottom+1)))clipped.push(n.id||n.className);
            }
        }
        const hud=[...w.document.querySelectorAll('.game-corner-identity,#streak-panel,.game-corner-progress')];
        const overlaps=[];
        for(let i=0;i<hud.length;i++)for(let j=i+1;j<hud.length;j++){
            const a=hud[i].getBoundingClientRect(),b=hud[j].getBoundingClientRect();
            if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)overlaps.push([hud[i].className,hud[j].className]);
        }
        return {viewport:[w.innerWidth,w.innerHeight],clipped:[...new Set(clipped)],overlaps,
            text:nodes.map(n=>n.textContent.trim()),missingImages:[...w.document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)};
    })()`);
    reports.push({lang, width, height, phase, ...layout});
    const screenshot = await command('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
    fs.writeFileSync(`${out}/${lang}-${width}-${phase}.png`, Buffer.from(screenshot.data, 'base64'));
    assert.deepEqual(layout.viewport, [width, height]);
    assert.deepEqual(layout.clipped, [], `${lang}/${width}/${phase}: clipped text`);
    assert.deepEqual(layout.overlaps, [], `${lang}/${width}/${phase}: overlapping HUD`);
    assert.deepEqual(layout.missingImages, []);
}
(async () => {
    try {
        assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
        assert.ok((await (await fetch(base + '/')).text()).includes('window.auditPush=data=>auditStreams'), 'refuse real app before navigation');
        fs.mkdirSync(out, {recursive: true});
        const profile = fs.mkdtempSync('/tmp/quiz-clock-chrome-');
        chrome = cp.spawn('google-chrome', ['--headless', '--no-sandbox', '--disable-gpu', '--mute-audio',
            '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], {stdio: 'ignore'});
        for (let i = 0; i < 100 && !fs.existsSync(profile + '/DevToolsActivePort'); i++) await delay(50);
        const [port, endpoint] = fs.readFileSync(profile + '/DevToolsActivePort', 'utf8').trim().split('\n');
        ws = new WebSocket('ws://127.0.0.1:' + port + endpoint);
        await new Promise(resolve => ws.addEventListener('open', resolve, {once: true}));
        ws.addEventListener('message', event => {
            const message = JSON.parse(event.data);
            if (message.id) {
                const item = pending.get(message.id); pending.delete(message.id);
                message.error ? item.reject(message.error) : item.resolve(message.result);
            } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
            else if (message.method === 'Network.responseReceived' && message.params.response.status >= 400)
                failedRequests.push({url: message.params.response.url, status: message.params.response.status});
        });
        const target = await command('Target.createTarget', {url: 'about:blank'}, null);
        session = (await command('Target.attachToTarget', {targetId: target.targetId, flatten: true}, null)).sessionId;
        await command('Page.enable'); await command('Runtime.enable'); await command('Network.enable');
        for (const lang of ['ca', 'es', 'eng']) for (const [width, height] of [[1920, 1080], [1280, 720]]) {
            await command('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false});
            await navigate('/puzzle/3', lang);
            await recover({question: question(1), question_number: 1, remaining: 300, duration: 300, total_points: 0,
                answered_map: {0: 5, 1: 1}, question_result: null});
            assert.equal(await inner("w.document.getElementById('timer').textContent"), '05:00');
            assert.deepEqual(await inner("[...w.document.querySelectorAll('.answer-reminder strong')].map(n=>n.textContent)"),
                {ca: ['CORRECTES', 'INCORRECTES'], es: ['CORRECTAS', 'INCORRECTAS'], eng: ['CORRECT', 'INCORRECT']}[lang]);
            assert.equal(await inner("w.document.querySelectorAll('.answer-row.green,.answer-row.red').length"), 2);
            assert.equal(await inner('w.document.getAnimations().length'), 0, 'snapshot restoration is stable');
            await push({remaining: 299});
            assert.equal(await inner("w.document.querySelectorAll('.answer-row.green,.answer-row.red').length"), 2, 'ticks preserve choices');
            await inspect(lang, width, height, 'playing', ['.game-corner-identity h1', '.quiz-hud-stat', '#question-text', '.answer-index', '.answer-text', '#answer-change-hint']);
            for (let n = 1; n <= 7; n++) {
                await push({question: question(n), question_number: n, question_result: null});
                await push({question_result: result(true), total_points: n * 10, correct_count: n});
            }
            assert.equal(await inner('w.PyramidLevelVictory.active'), false, 'no six-question victory');
            assert.equal(await inner("w.document.getElementById('streak').textContent"), '70');
            await push({question: question(8), question_number: 8, question_result: null});
            const failed = {question: question(8), question_number: 8, remaining: 190, duration: 300,
                total_points: 70, correct_count: 7, clock_paused: true,
                answered_map: result(false).player_answers, question_result: result(false)};
            await push(failed);
            const soundCount = await inner('w.auditAudios.length');
            await push({remaining: 190});
            await recover(failed);
            assert.equal(await inner('w.auditAudios.length'), soundCount, 'result recovery does not repeat sounds');
            assert.equal(await inner("w.document.querySelectorAll('.answer-row.correct').length"), 9);
            assert.equal(await inner("w.document.querySelectorAll('.answer-row.wrong').length"), 1);
            assert.equal(await inner("w.document.getElementById('answer-change-hint').hidden"), true);
            assert.equal(await inner("w.document.getElementById('timer').textContent"), '03:10');
            assert.equal(await inner("w.document.getElementById('timer').classList.contains('is-clock-paused')"), true);
            assert.equal(await inner("w.document.getElementById('quiz-stage').inert"), false, 'paused results remain visible');
            assert.equal(await inner("w.auditRequests.filter(r=>r.url==='/start_puzzle/3').length"), 1, 'reconnection never restarts');
            await inspect(lang, width, height, 'result', ['.quiz-hud-stat', '#question-text', '.answer-text']);
            const goldenWarning = {golden_announcement: true, golden_question: true, clock_paused: true,
                question_number: 6, question_points: 20, remaining: 190, total_points: 40};
            await push(goldenWarning);
            assert.equal(await inner("w.document.getElementById('golden-announcement').hidden"), false);
            assert.equal(await inner("w.getComputedStyle(w.document.getElementById('quiz-stage')).visibility"), 'hidden');
            assert.equal(await inner("w.document.getElementById('quiz-stage').inert"), true);
            await push({remaining: 190});
            await recover(goldenWarning);
            assert.equal(await inner("w.document.getElementById('timer').textContent"), '03:10');
            assert.equal(await inner("w.document.getElementById('golden-announcement').hidden"), false, 'snapshot preserves warning');
            await inspect(lang, width, height, 'golden-warning', ['#golden-announcement h2', '#golden-announcement p', '.golden-clock-paused', '.golden-multiplier', '.quiz-hud-stat']);
            await push({question: question(6), question_number: 6, question_result: null,
                golden_announcement: false, golden_question: true, clock_paused: false, question_points: 20, remaining: 190});
            assert.equal(await inner("w.document.getElementById('golden-announcement').hidden"), true);
            assert.equal(await inner("w.document.getElementById('golden-question-badge').hidden"), false);
            assert.equal(await inner("w.document.getElementById('quiz-stage').inert"), false);
            assert.equal(await inner("w.document.getElementById('timer').classList.contains('is-clock-paused')"), false);
            await inspect(lang, width, height, 'golden-question', ['#golden-question-badge', '#question-text', '.answer-text']);
            await push({question_result: result(true), total_points: 60, correct_count: 5, clock_paused: true});
            assert.equal(await inner("w.document.getElementById('streak').textContent"), '60');
            await push({question: question(7), question_number: 7, question_result: null,
                golden_announcement: false, golden_question: false, clock_paused: false, question_points: 10});
            assert.equal(await inner("w.document.getElementById('golden-question-badge').hidden"), true);
            await navigate('/puzzle/3', lang);
            await recover({...failed, remaining: 180});
            assert.equal(await inner("w.document.querySelectorAll('.answer-row.correct').length"), 9, 'fresh page restores result rows');
            assert.equal(await inner("w.document.querySelectorAll('.answer-row.wrong').length"), 1);
            assert.equal(await inner("w.auditAudios.filter(a=>/(correcte|incorrecte|apareix_contingut)[.]wav$/.test(a.src)).length"), 0, 'fresh page restores silently');
            await push({question: question(9), question_number: 9, question_result: null});
            assert.equal(await inner("w.document.querySelectorAll('.answer-row.correct,.answer-row.wrong').length"), 0);
            assert.equal(await inner("w.document.getElementById('streak').textContent"), '70', 'wrong questions do not deduct points');
            await navigate('/puzzle/3', lang);
            await inner('(()=>{w.clockVictoryCalls=0;const complete=w.PyramidLevelVictory.complete;w.PyramidLevelVictory.complete=id=>{w.clockVictoryCalls++;complete(id);};})()');
            await recover({remaining: 0, duration: 300, total_points: 0, puzzle_solved: true});
            await push({remaining: 0, total_points: 0, puzzle_solved: true});
            assert.equal(await inner('w.PyramidLevelVictory.active'), true, 'zero points still completes at server timeout');
            assert.equal(await inner('w.clockVictoryCalls'), 1);
            assert.equal(await inner("w.document.getElementById('timer').textContent"), '00:00');
            await navigate('/presentacio/3', lang);
            const attentionStep = await inner("w.PyramidFlow.find(s=>s.puzzleId===3).steps.indexOf('attention')");
            await inner(`w.postMessage({type:'pyramid-presentation-command',action:'step',value:${attentionStep}},location.origin)`);
            await until("document.getElementById('game-shell-frame').contentWindow.document.querySelector('.b-attention:not([hidden])')");
            await inspect(lang, width, height, 'attention', ['.b-attention-card h2', '.b-attention-card p']);
            assert.equal(await inner('w.auditRequests.length'), 0, 'briefing never starts a puzzle');
        }
        assert.deepEqual(errors, []);
        assert.deepEqual(failedRequests.filter(r => !r.url.endsWith('/favicon.ico')), []);
        console.log(`QUIZ clock verified: ${reports.length} layouts, 3 languages, 2 resolutions; no MQTT/hardware. ${out}`);
    } finally {
        if (fs.existsSync(out)) fs.writeFileSync(out + '/verification.json', JSON.stringify({reports, errors, failedRequests}, null, 2));
        ws?.close(); chrome?.kill('SIGTERM');
    }
})().catch(error => {console.error(error); process.exitCode = 1;});