const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../static/js/test.js'), 'utf8');
const closeSource = source.slice(source.indexOf('  async function closeSelectedSession('), source.indexOf('  async function confirmSession('));

function harness(options = {}) {
    const calls = [], writes = [], errors = [], controls = [{disabled: false}];
    const context = {
        _loadedDbSessionId: 12,
        activeSession: {dbSessionId: 12, sessionName: 'Sessió de prova'},
        sessionActionBusy: false,
        window: {
            confirm: message => { calls.push(['confirm', message]); return options.confirm !== false; },
            PyramidSessions: {
                closed: id => calls.push(['closed', id]),
                error: message => errors.push(message),
                refreshEditor: () => calls.push(['refreshEditor'])
            }
        },
        document: {querySelectorAll: () => controls, getElementById: () => null},
        els: {},
        console: {warn() {}},
        getSessionField: () => ({value: 'Sessió de prova'}),
        saveSession: async () => {calls.push(['save']); if (options.saveError) throw Error('Save failed');},
        syncConfirmedSession: async () => calls.push(['sync']),
        refreshDbSessionList: async () => calls.push(['refresh']),
        switchTab: tab => calls.push(['tab', tab]),
        addSimpleEvent: text => calls.push(['event', text]),
        setStatus: text => calls.push(['status', text]),
        fetch: async (url, init = {}) => {
            writes.push([url, init.method || 'GET']);
            if (options.beforeFetch) await options.beforeFetch(url);
            const status = options.failedUrl === url ? 503 : 200;
            let body = {};
            if (url === '/test/session/12') body = {session: {session_id: 12, ended_at: options.unrecorded ? null : '2026-10-20 12:00:00'}};
            return {ok: status === 200, json: async () => body};
        }
    };
    vm.createContext(context);
    const runSource = source.slice(source.indexOf('  async function runSessionAction('), source.indexOf('  // Shared operations for the unified director;'));
    vm.runInContext(closeSource + runSource + '\nthis.closeSession=closeSelectedSession;this.runAction=runSessionAction;', context);
    return {context, calls, writes, errors, controls};
}

test('close session persists form, addresses selected row, verifies database and refreshes history', async () => {
    const h = harness();
    await h.context.closeSession();
    assert.match(h.calls[0][1], /Sessió de prova/);
    assert.match(h.calls[0][1], /puzzles incompletos no se darán por superados/);
    assert.deepEqual(h.writes, [['/test/session/12/close', 'POST'], ['/test/session/12', 'GET']]);
    assert.equal(h.calls[1][0], 'save');
    assert.ok(h.calls.some(call => call[0] === 'closed' && call[1] === 12));
    assert.ok(h.calls.some(call => call[0] === 'tab' && call[1] === 'sesiones'));
    assert.ok(h.calls.some(call => call[0] === 'status' && /Sesión cerrada/.test(call[1])));
});

test('cancelled confirmation performs no save, close or navigation', async () => {
    const h = harness({confirm: false});
    await h.context.closeSession();
    assert.deepEqual(h.writes, []);
    assert.equal(h.calls.length, 1);
});

test('unsaved drafts cannot request a session close', async () => {
    const h = harness();
    h.context._loadedDbSessionId = null;
    await assert.rejects(h.context.closeSession(), /Selecciona la sesión/);
    assert.deepEqual(h.writes, []);
    assert.deepEqual(h.calls, []);
});

test('old sessions close without activation even when another session is active', async () => {
    for (const active of [null, {dbSessionId: 99}]) {
        const h = harness();
        h.context.activeSession = active;
        await h.context.closeSession();
        assert.deepEqual(h.writes, [['/test/session/12/close', 'POST'], ['/test/session/12', 'GET']]);
        assert.equal(h.context.activeSession, active);
    }
});

test('header finalizes the active ID without saving another editor or archiving its selection', async () => {
    const h = harness();
    h.context._loadedDbSessionId = 99;
    await h.context.closeSession({active: true});
    assert.deepEqual(h.writes, [['/test/session/12/close', 'POST'], ['/test/session/12', 'GET']]);
    assert.ok(!h.calls.some(call => call[0] === 'save' || call[0] === 'closed'));
    assert.match(h.calls[0][1], /#12/);
});

test('save, HTTP and missing database closure errors never report success', async () => {
    for (const options of [{saveError: true}, {failedUrl: '/test/session/12/close'},
        {failedUrl: '/test/session/12'}, {unrecorded: true}]) {
        const h = harness(options);
        await assert.rejects(h.context.closeSession());
        assert.ok(!h.calls.some(call => call[0] === 'closed'));
        assert.ok(!h.calls.some(call => call[0] === 'status'));
        if (options.saveError) assert.deepEqual(h.writes, []);
    }
});

test('busy action prevents double close and restores controls after success or failure', async () => {
    let release;
    const gate = new Promise(resolve => {release = resolve;});
    const h = harness({beforeFetch: async () => gate});
    const first = h.context.runAction(h.context.closeSession);
    await h.context.runAction(h.context.closeSession);
    assert.equal(h.controls[0].disabled, true);
    release();
    await first;
    assert.equal(h.writes.filter(([url]) => url.endsWith('/close')).length, 1);
    assert.equal(h.controls[0].disabled, false);
    const failed = harness({failedUrl: '/test/session/12/close'});
    await failed.context.runAction(failed.context.closeSession);
    assert.equal(failed.errors.length, 1);
    assert.equal(failed.controls[0].disabled, false);
});

test('close button enables any started session but not drafts, future or closed sessions', () => {
    const template = fs.readFileSync(path.join(__dirname, '../templates/test.html'), 'utf8');
    assert.match(template, /id="gm-close-session-btn"[^>]*disabled/);
    assert.ok(template.indexOf('gm-close-session-btn') < template.indexOf('gm-saved-sessions'));
    assert.match(source, /getElementById\("gm-close-session-btn"\)\?\.addEventListener\("click", \(\) => runSessionAction\(closeSelectedSession\)\)/);
    const manager = fs.readFileSync(path.join(__dirname, '../static/js/session-manager.js'), 'utf8');
    const labels = manager.slice(manager.indexOf('  function actionLabels()'), manager.indexOf('  function render()'));
    for (const [selected, activeId, busy, expected] of [
        [null, null, false, true],
        [{session_id: 12}, 12, false, false],
        [{session_id: 12}, 99, false, true],
        [{session_id: 12, started_at: '2026-10-14'}, 99, false, false],
        [{session_id: 12, started_at: '2026-10-14'}, null, false, false],
        [{session_id: 12, ended_at: 'closed'}, 12, false, true],
        [{session_id: 12}, 12, true, true]
    ]) {
        const elements = new Map();
        const $ = id => {if (!elements.has(id)) elements.set(id, {}); return elements.get(id);};
        vm.runInNewContext(labels + '\nactionLabels();', {selected, activeId, dirty: false, callbacks: {busy: () => busy}, $});
        assert.equal($('gm-close-session-btn').disabled, expected);
    }
});