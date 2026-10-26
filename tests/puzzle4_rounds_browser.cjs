// Run the isolated fixture separately, then node tests/puzzle4_rounds_browser.cjs.
// Real templates/scripts + AST-extracted route + real Puzzle4; no app startup.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const {WebSocket} = require('undici');
const base = process.argv[2] || 'http://127.0.0.1:8774';
const out = path.resolve(__dirname, '../output/music-rounds');
const report = {passed: [], defects: [], layouts: [], resources: [], exceptions: [], network: [],
    limitations: ['Simulated SSE/audio and hardware; no acoustic or room-distance readability validation.',
        'Puzzle4 validation uses mocked sleeps/workers; browser inter-round timers remain real.']};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let chrome, profile, ws, session, id = 0;
const pending = new Map();
function command(method, params = {}, sessionId = session) {
    return new Promise((resolve, reject) => {
        const key = ++id;
        const timer = setTimeout(() => {pending.delete(key); reject(Error('CDP timeout: ' + method));}, 15000);
        pending.set(key, {resolve, reject, timer});
        ws.send(JSON.stringify({id: key, method, params, ...(sessionId ? {sessionId} : {})}));
    });
}
async function evaluate(expression) {
    const r = await command('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
}
async function until(expression) {
    for (let n = 0; n < 120; n++) {
        if (await evaluate(expression)) return;
        await delay(50);
    }
    throw Error('Timed out: ' + expression);
}
async function api(action, data = {}) {
    const response = await fetch(base + '/audit/control', {method: 'POST',
        headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action, ...data})});
    assert.equal(response.status, 200);
    return response.json();
}
async function option(value) {
    const response = await fetch(base + '/test/puzzle4/round_options', {method: 'POST',
        headers: {'Content-Type': 'application/json'}, body: JSON.stringify({second_round_enabled: value})});
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {second_round_enabled: value});
}
async function check(name, fn) {
    try {await fn(); report.passed.push(name);}
    catch (error) {report.defects.push({case: name, error: error.stack || String(error)});}
}
async function navigate(url) {
    await command('Page.navigate', {url: base + url});
    await until('document.readyState === "complete" && window.musicRoundsFixture === true');
    await evaluate('document.fonts.ready.then(()=>true)');
    if (url.startsWith('/test')) {
        assert.equal(await visible('#director-music-options'), false, 'music controls hidden without a player context');
        await evaluate(`window.auditPlayer={connected:true,state:{phase:'slides',kind:'puzzle',puzzleId:4,
            name:'Código Sonoro',labels:['Música'],step:0}};
            window.PyramidGM.snapshot=()=>window.auditPlayer;`);
        await until('!document.getElementById("director-music-options").hidden');
    }
}
const visibleFn = `(n)=>{if(!n)return false;const r=n.getBoundingClientRect();
 if(!r.width||!r.height)return false;for(let p=n;p;p=p.parentElement){const s=getComputedStyle(p);
 if(p.hidden||s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;}return true;}`;
async function visible(selector) {return evaluate(`(${visibleFn})(document.querySelector(${JSON.stringify(selector)}))`);}
async function screenshot(name) {
    const shot = await command('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
    fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(shot.data, 'base64'));
}
async function push(data) {
    await evaluate(`auditPush(${JSON.stringify({puzzle_id: 4, ...data})})`);
}
async function layout(name, selectors, gm = false) {
    const result = await evaluate(`(()=>{
      const visible=${visibleFn}, issues=[], rect=r=>({x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height});
      const clip=(r,n)=>{const reasons=[];
        if(r.left < -1||r.top < -1||r.right>innerWidth+1||r.bottom>innerHeight+1)reasons.push('viewport');
        for(let p=n;p;p=p.parentElement){const s=getComputedStyle(p),b=p.getBoundingClientRect();
          if(/hidden|clip|auto|scroll/.test(s.overflowX)&&(r.left<b.left-1||r.right>b.right+1))reasons.push((p.id||p.className)+':x');
          if(/hidden|clip|auto|scroll/.test(s.overflowY)&&(r.top<b.top-1||r.bottom>b.bottom+1))reasons.push((p.id||p.className)+':y');}
        return reasons;};
      const nodes=[...new Set(${JSON.stringify(selectors)}.flatMap(s=>[...document.querySelectorAll(s)]))].map(n=>{
        const shown=visible(n),r=n.getBoundingClientRect(),s=getComputedStyle(n),ranges=[];
        const walker=document.createTreeWalker(n,NodeFilter.SHOW_TEXT);
        while(walker.nextNode()){const t=walker.currentNode;if(!t.textContent.trim()||!visible(t.parentElement))continue;
                    // Slot codes are deliberately indented offscreen; players see the ::after note instead.
                    if(t.parentElement.matches('.progress-box.note-slot')&&parseFloat(getComputedStyle(t.parentElement).textIndent)<-1000)continue;
          const range=document.createRange();range.selectNodeContents(t);
          for(const b of range.getClientRects())ranges.push({rect:rect(b),clipped:clip(b,t.parentElement)});}
        const clipped=shown?clip(r,n.parentElement):[];
        if(!shown||clipped.length||ranges.some(t=>t.clipped.length))issues.push(n.id||n.className);
        return {node:n.id||n.className,text:n.textContent.trim(),visible:shown,rect:rect(r),clipped,ranges,
          fontSize:s.fontSize,lineHeight:s.lineHeight};});
      const a=document.querySelector('#status-section')?.getBoundingClientRect(),b=document.querySelector('#progress-section')?.getBoundingClientRect();
      if(a&&b&&Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)issues.push('status/progress overlap');
      return {viewport:[innerWidth,innerHeight],nodes,issues,missingImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)};
    })()`);
    report.layouts.push({name, gm, ...result});
    await screenshot(name);
    assert.ok(result.nodes.length, 'layout selectors must match');
    assert.deepEqual(result.missingImages, [], 'images decode');
    assert.deepEqual(result.issues, [], 'visible content must fit viewport and clipping ancestors');
}
const playerSelectors = ['.game-corner-identity h1', '.legend-copy', '.legend-caption', '#status-section', '#status-text', '#progress-section'];
async function noSpoilers() {
    assert.equal(await visible('#streak2-container'), false, 'future eight-slot round hidden');
    const leaks = await evaluate(`(()=>{const v=${visibleFn};return [...document.querySelectorAll('body *')]
      .filter(n=>v(n)&&[...n.childNodes].some(t=>t.nodeType===3&&/(?:ronda|round|fase|phase)\\s*(?:[12]|dos|two)|[12]\\s*\\/\\s*2|segunda ronda|second round/i.test(t.textContent)))
      .map(n=>({node:n.id||n.className,text:n.textContent.trim()}));})()`);
    assert.deepEqual(leaks, [], 'no visible round count or future-round text');
}
async function click(selector) {
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);
    const p = await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await command('Input.dispatchMouseEvent', {type: 'mousePressed', ...p, button: 'left', clickCount: 1});
    await command('Input.dispatchMouseEvent', {type: 'mouseReleased', ...p, button: 'left', clickCount: 1});
}
const checkbox = 'document.getElementById("music-second-round")';
async function gmReady(expected) {
    await until(`${checkbox} && !${checkbox}.disabled && ${checkbox}.checked === ${expected}`);
}
async function run() {
    fs.mkdirSync(out, {recursive: true});
    assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
    const identity = await fetch(base + '/audit/identity');
    assert.equal(identity.headers.get('X-Music-Rounds-Fixture'), 'isolated-no-mqtt');
    assert.deepEqual(await identity.json(), {fixture: 'music-rounds-isolated', mqtt: false, workers: false});
    // Integration independently tests the real AST route and real Puzzle4 state.
    await check('endpoint/default one round and strict boolean validation', async () => {
        await api('fresh');
        assert.deepEqual(await (await fetch(base + '/test/puzzle4/round_options')).json(), {second_round_enabled: false});
        for (const body of [null, [], {}, {second_round_enabled: 1}, {second_round_enabled: 'false'}]) {
            const r = await fetch(base + '/test/puzzle4/round_options', {method: 'POST',
                headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
            assert.equal(r.status, 400);
        }
        assert.equal((await api('start')).state.total_required, 1);
        const done = await api('validate');
        assert.equal(done.state.puzzle_solved, true);
        assert.equal(done.events.some(e => e.show_completion), false);
        assert.deepEqual(done.rounds, []);
        assert.deepEqual(done.messages, [['FROM_FLASK', 'P4End']]);
    });
    await check('endpoint/preselection survives start; no SSE from options on another puzzle', async () => {
        await api('fresh'); await api('other-puzzle'); await option(true);
        const selected = await api('other-puzzle');
        assert.deepEqual(selected.events, []); assert.equal(selected.active, 3);
        assert.equal((await api('start')).state.total_required, 2);
        assert.equal((await api('start')).options.second_round_enabled, true);
    });
    await check('endpoint/toggle during first round; committed second round cannot be interrupted', async () => {
        await api('fresh'); await api('start'); await option(true); await option(false);
        assert.equal((await api('other-puzzle')).state.total_required, 1);
        await option(true);
        const next = await api('validate');
        assert.equal(next.state.streak, 1); assert.equal(next.state.puzzle_solved, false);
        assert.deepEqual(next.rounds, [[4, 2]]);
        await option(false);
        const done = await api('validate');
        assert.equal(done.state.total_required, 2); assert.equal(done.state.puzzle_solved, true);
        await option(true);
        assert.equal((await api('other-puzzle')).state.puzzle_solved, true, 'cannot reopen completion');
    });
    profile = fs.mkdtempSync('/tmp/music-rounds-chrome-');
    chrome = cp.spawn('google-chrome', ['--headless', '--no-sandbox', '--disable-gpu', '--mute-audio',
        '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], {stdio: 'ignore'});
    for (let n = 0; n < 100 && !fs.existsSync(profile + '/DevToolsActivePort'); n++) await delay(50);
    const [port, endpoint] = fs.readFileSync(profile + '/DevToolsActivePort', 'utf8').trim().split('\n');
    ws = new WebSocket('ws://127.0.0.1:' + port + endpoint);
    await new Promise((resolve, reject) => {ws.addEventListener('open', resolve, {once: true}); ws.addEventListener('error', reject, {once: true});});
    ws.addEventListener('message', event => {
        const m = JSON.parse(event.data);
        if (m.id && pending.has(m.id)) {
            const p = pending.get(m.id); pending.delete(m.id); clearTimeout(p.timer);
            m.error ? p.reject(Error(JSON.stringify(m.error))) : p.resolve(m.result);
        } else if (m.method === 'Runtime.exceptionThrown') report.exceptions.push(m.params.exceptionDetails);
        else if (m.method === 'Network.responseReceived' && m.params.response.status >= 400)
            report.network.push({url: m.params.response.url, status: m.params.response.status});
    });
    const target = await command('Target.createTarget', {url: 'about:blank'}, null);
    session = (await command('Target.attachToTarget', {targetId: target.targetId, flatten: true}, null)).sessionId;
    await command('Page.enable'); await command('Runtime.enable'); await command('Network.enable');
    for (const lang of ['ca', 'es', 'eng']) for (const [width, height] of [[1920,1080], [1280,720]]) {
        const prefix = `${lang}-${width}`;
        await command('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false});
        await api('fresh');
        await navigate('/puzzle/4?lang=' + lang);
        await until('auditStreams.length > 0');
        await check(prefix + '/initial hidden rounds and localized title', async () => {
            assert.equal(await evaluate("document.querySelector('.game-corner-identity h1').textContent"),
                {ca:'Codi Sonor',es:'Código Sonoro',eng:'Sound Code'}[lang]);
            await noSpoilers();
            assert.equal(await visible('#streak1-container'), false);
            await layout(prefix + '-initial', playerSelectors);
        });
        await push({streak: -1, streak_bis: 0, total_required: 2, playing_sample: true, storing: false,
            sample_song: {url: '/static/audios/P4_F1/song.wav'}, played_sequence: []});
        await check(prefix + '/enabled option does not reveal future round during first sample', async () => {
            await noSpoilers(); assert.equal(await visible('#streak1-container'), false);
            await layout(prefix + '-sample', playerSelectors);
        });
        for (const [phase, sequence, storing] of [['search',[],false], ['record',['5','1'],true],
            ['full',['5','1','8','3'],true]]) {
            await push({streak: 0, total_required: 2, playing_sample: false, storing,
                current_progress: sequence.length, played_sequence: sequence});
            await check(prefix + '/' + phase + ' first round layout and secrecy', async () => {
                await noSpoilers(); assert.equal(await visible('#streak1-container'), true);
                assert.equal(await evaluate("document.querySelectorAll('#streak1-container .filled').length"), sequence.length);
                await layout(prefix + '-' + phase, [...playerSelectors, '#streak1-container', '#streak1-container .progress-box']);
            });
        }
        await push({validation_feedback: false});
        await check(prefix + '/wrong sequence does not reveal second round', async () => {await noSpoilers();});
        // Use events produced by the real backend, including its committed phase switch.
        await api('fresh'); await option(true); await api('start');
        const transition = await api('validate');
        await push(transition.events.find(e => e.validation_feedback));
        await push(transition.events.find(e => e.show_completion));
        await check(prefix + '/first completion keeps second board hidden during real pause', async () => {
            assert.equal(await visible('#streak2-container'), false);
            await until('!document.getElementById("p4-phase-popup").classList.contains("hidden")');
            await delay(250);
            await layout(prefix + '-phase-popup', ['#p4-phase-popup', '#p4-phase-popup-line1', '#p4-phase-popup-line2']);
        });
        await push(transition.events.find(e => e.sample_countdown_seconds === 5));
        await until('document.getElementById("p4-phase-popup").classList.contains("hidden")');
        await delay(100);
        await push(transition.events.find(e => e.sample_song));
        await check(prefix + '/second sample still hides sequence board', async () => {
            assert.equal(await visible('#streak2-container'), false);
            await layout(prefix + '-second-sample', playerSelectors);
        });
        await push({streak: 1, total_required: 2, playing_sample: false, storing: true,
            current_progress: 7, played_sequence: ['6','1','0','9','8','4','2']});
        await check(prefix + '/actual second phase exposes only eight-slot board', async () => {
            assert.equal(await visible('#streak1-container'), false);
            assert.equal(await visible('#streak2-container'), true);
            assert.equal(await evaluate("document.querySelectorAll('#streak2-container .filled').length"), 7);
            await layout(prefix + '-second-record', [...playerSelectors, '#streak2-container', '#streak2-container .progress-box']);
        });
        await check(prefix + '/deadline stops audio and advances once without celebrating', async () => {
            await api('fresh'); await api('start');
            const terminal = await api('expire');
            assert.equal(terminal.state.total_points, 0);
            assert.equal(terminal.state.puzzle_solved, false);
            await evaluate('window.auditVictoryCalls=[];window.PyramidLevelVictory.complete=id=>auditVictoryCalls.push(id);');
            await push({show_completion: true, streak: 1, total_required: 2});
            await push({sample_song: {url:'/static/audios/P4_F2/song.wav'}, playing_sample:true, streak: -1});
            const result = await evaluate(`(()=>{
                const nextId=window.NEXT_PUZZLE_ID ?? window.PYRAMID_GAME?.finalId;
                auditPush(${JSON.stringify(terminal.events.find(e => e.puzzle_exhausted))});
                auditPush({puzzle_id:4,puzzle_exhausted:true,total_points:0});
                auditPush({puzzle_id:4,puzzle_solved:true});
                return {nextId,status:document.getElementById('status-text').textContent,
                    victory:auditVictoryCalls,
                    audioPaused:auditAudioObjects.filter(a=>/P4_|fase_/.test(a.src)).every(a=>a.paused),
                    popupHidden:document.getElementById('p4-phase-popup').classList.contains('hidden')};
            })()`);
            const expected = {ca:'Temps esgotat · 0 punts',es:'Tiempo agotado · 0 puntos',eng:'Time is up · 0 points'}[lang];
            assert.equal(result.status, expected);
            assert.deepEqual(result.victory, []);
            assert.equal(result.audioPaused, true);
            assert.equal(result.popupHidden, true);
            await until(`location.pathname === '/presentacio/${result.nextId}' && new URLSearchParams(location.search).get('lang') === '${lang}'`);
        });
        await check(prefix + '/reconnection to exhausted snapshot advances automatically', async () => {
            await navigate('/puzzle/4?lang=' + lang);
            await until('auditStreams.length > 0');
            const nextId = await evaluate('window.NEXT_PUZZLE_ID ?? window.PYRAMID_GAME?.finalId');
            await evaluate(`window.auditCurrentState={puzzle_id:4,puzzle_exhausted:true,total_points:0};
                auditStreams.find(s=>typeof s.onopen==='function').onopen();`);
            await until(`location.pathname === '/presentacio/${nextId}' && new URLSearchParams(location.search).get('lang') === '${lang}'`);
        });
        await navigate('/test?panel=juego&lang=' + lang);
        await gmReady(false);
        await check(prefix + '/visible GM checkbox in music presentation before gameplay', async () => {
            assert.equal(await evaluate('document.querySelector("[data-gm-panel=juego]").hidden'), false);
            assert.equal(await evaluate(`${checkbox}.closest('#director-game') === null`), true);
            assert.equal(await visible('#director-game'), false);
            await layout(prefix + '-gm', ['.director-music-options', '.director-music-toggle', '#music-round-help', '#music-round-status'], true);
        });
    }
    await check('GM/music option appears only for music and retains selection across navigation', async () => {
        await click('#music-second-round'); await gmReady(true);
        for (const puzzleId of [1, 3, 5, 8, 12, 6, null]) {
            await evaluate(`window.auditPlayer.state.puzzleId=${JSON.stringify(puzzleId)};`);
            await until('document.getElementById("director-music-options").hidden');
            assert.equal(await visible('#music-second-round'), false);
        }
        await evaluate('window.auditPlayer.state.puzzleId=4;window.auditPlayer.state.phase="game";');
        await until('!document.getElementById("director-music-options").hidden');
        await gmReady(true);
        await evaluate('window.auditPlayer.connected=false;');
        await until('document.getElementById("director-music-options").hidden');
    });
    await check('GM/save before music, reload persistence and focus resynchronization', async () => {
        await api('fresh'); await api('other-puzzle');
        await navigate('/test?panel=juego'); await gmReady(false);
        await click('#music-second-round'); await gmReady(true);
        assert.deepEqual((await api('other-puzzle')).events, []);
        await navigate('/test?panel=juego'); await gmReady(true);
        await option(false); await evaluate('window.dispatchEvent(new Event("focus"))'); await gmReady(false);
        await click('#music-second-round'); await gmReady(true);
        assert.equal((await api('start')).state.total_required, 2);
        await click('#music-second-round'); await gmReady(false);
        assert.equal((await api('other-puzzle')).state.total_required, 1);
    });
    for (const mode of ['http', 'invalid', 'json', 'committed-error']) {
        await check('GM/write failure ' + mode + ', rollback, disabled and refresh recovery', async () => {
            await api('fresh'); await navigate('/test?panel=juego'); await gmReady(false);
            await api('failure', {mode}); await click('#music-second-round');
            await until('document.getElementById("music-round-status").textContent.startsWith("No se pudo confirmar")');
            assert.equal(await evaluate(`${checkbox}.checked`), false);
            assert.equal(await evaluate(`${checkbox}.disabled`), true);
            await screenshot('gm-error-' + mode);
            await click('#director-refresh'); await gmReady(mode === 'committed-error');
        });
    }
    await check('GM/initial read failure is safe and refresh recovers', async () => {
        await api('fresh'); await api('failure', {mode:'http'});
        await navigate('/test?panel=juego');
        await until('document.getElementById("music-round-status").textContent.startsWith("No se pudo consultar")');
        assert.equal(await evaluate(`${checkbox}.checked`), false);
        assert.equal(await evaluate(`${checkbox}.disabled`), true);
        await click('#director-refresh'); await gmReady(false);
    });
    await check('resources/all referenced player and GM images exist on disk', async () => {
        // Check every browser-requested image plus CSS URLs, not just visible img tags.
        const files = ['templates/puzzle4.html','templates/base.html','static/css/puzzle4.css','static/css/game-surface.css'];
        const urls = new Set(report.network.filter(n => /\/static\/images\//.test(n.url)).map(n => new URL(n.url).pathname));
        for (const file of files) {
            const text = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
            for (const match of text.matchAll(/(?:\/static\/)?images\/[\w/.-]+\.(?:png|svg|webp|jpe?g)/g))
                urls.add('/static/' + match[0].replace(/^\/static\//, ''));
        }
        for (const url of urls) report.resources.push({url, exists: fs.existsSync(path.resolve(__dirname, '..', url.slice(1)))});
        assert.deepEqual(report.resources.filter(r => !r.exists), []);
    });
    await check('runtime/no uncaught browser exceptions', async () => assert.deepEqual(report.exceptions, []));
    await check('network/no missing images/scripts/styles (injected 503 and favicon excluded)', async () => {
        assert.deepEqual(report.network.filter(n => !n.url.endsWith('/favicon.ico') &&
            !(n.status === 503 && n.url.endsWith('/test/puzzle4/round_options'))), []);
    });
}
run().catch(error => report.defects.push({case: 'runner', error: error.stack || String(error)})).finally(async () => {
    if (ws) {
        try {await command('Browser.close', {}, null);} catch {}
        ws.close();
    }
    if (chrome && chrome.exitCode === null) {
        const exited = new Promise(resolve => chrome.once('exit', resolve)); chrome.kill('SIGTERM'); await exited;
    }
    if (profile) fs.rmSync(profile, {recursive: true, force: true});
    fs.mkdirSync(out, {recursive: true});
    fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({passed: report.passed.length, defects: report.defects, layouts: report.layouts.length,
        missingResources: report.resources.filter(r => !r.exists), report: 'output/music-rounds/verification.json'}, null, 2));
    process.exitCode = report.defects.length ? 1 : 0;
});