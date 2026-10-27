const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../static/js/test.js'), 'utf8');
const confirmCode = source.slice(source.indexOf('  async function confirmSession('),
    source.indexOf('  function goToSessionControl('));
const beginCode = source.slice(source.indexOf('  async function beginConfirmedSession('),
    source.indexOf('  function renderActiveSession('));

function harness({existing = null, accept = true, active = null} = {}) {
    const writes = [], confirmations = [], calls = [];
    const context = {
        _loadedDbSessionId: existing?.session_id ?? null,
        activeSession: active,
        activeSessionKey: 'cache',
        window: {
            confirm: message => {confirmations.push(message); return accept;},
            localStorage: {setItem() {}},
            PyramidLanguage: {normalize: value => value},
        },
        saveSession: async () => {calls.push('save'); context._loadedDbSessionId ??= 12;},
        fetch: async (url, options = {}) => {
            if (options.method === 'POST') writes.push({url, body: JSON.parse(options.body)});
            return {ok: true, json: async () => url.startsWith('/test/session/1')
                ? {session: existing, puzzles: Array.from({length: existing?.puzzle_count || 0}, () => ({}))}
                : {session: existing || {session_id: 12, language: 'es'}}};
        },
        renderActiveSession() {}, resetSessionControl() {}, resetGameState() {}, addSimpleEvent() {}, setStatus() {},
        goToSessionControl: () => calls.push('control'),
        syncConfirmedSession: async () => calls.push('sync'),
    };
    vm.createContext(context);
    vm.runInContext(confirmCode + beginCode, context);
    return {context, writes, confirmations, calls};
}

test('new draft is created once and then prepared, without starting the game', async () => {
    const h = harness();
    await h.context.confirmSession();
    assert.equal(h.context._loadedDbSessionId, 12);
    assert.deepEqual(h.writes, [{url: '/test/session/confirm', body: {session_id: 12, resume: false}}]);
    assert.deepEqual(h.calls, ['save', 'control', 'sync']);
    assert.equal(h.confirmations.length, 0);
});

for (const started_at of [null, '2026-10-26 10:00:00']) {
    test(`resuming records is explicit even with legacy started_at=${started_at}`, async () => {
        const h = harness({existing: {session_id: 11, name: 'Ahir', started_at, puzzle_count: 3}});
        await h.context.confirmSession();
        assert.match(h.confirmations[0], /#11/);
        assert.match(h.confirmations[0], /3 registros/);
        assert.match(h.confirmations[0], /No se creará una partida nueva/);
        assert.equal(h.writes[0].body.resume, true);
    });
}

test('cancel resume never saves, activates or enters control', async () => {
    const h = harness({existing: {session_id: 11, puzzle_count: 3}, accept: false});
    await h.context.confirmSession();
    assert.deepEqual(h.writes, []);
    assert.deepEqual(h.calls, []);
});

test('archived sessions cannot be prepared even by calling the handler directly', async () => {
    const h = harness({existing: {session_id: 11, ended_at: '2026-10-26'}});
    await assert.rejects(h.context.confirmSession(), /finalizada/);
    assert.deepEqual(h.writes, []);
    assert.deepEqual(h.calls, []);
});

test('returning to the already active ID saves without reactivation or restart', async () => {
    const h = harness({existing: {session_id: 11, started_at: '2026-10-26'},
        active: {dbSessionId: 11}});
    await h.context.confirmSession();
    assert.deepEqual(h.writes, []);
    assert.deepEqual(h.calls, ['save', 'control']);
});

test('only changing the active ID resets the GM control', async () => {
    for (const id of [11, 12]) {
        const h = harness({active: {dbSessionId: id}});
        let resets = 0;
        h.context.resetSessionControl = () => resets++;
        await h.context.confirmSession();
        assert.equal(resets, id === 12 ? 0 : 1);
    }
});

test('a late state response from the previous session cannot restore its final selection', async () => {
    const code = source.slice(source.indexOf('  async function refreshCurrentState('),
        source.indexOf('  function bindEvents('));
    for (const failed of [false, true]) {
        let resolve;
        const context = {
            controlStateLoading: false, controlSessionRevision: 0,
            currentGameState: {puzzle_id: null}, controlInitialSelectionSynced: false,
            fetch: () => new Promise(done => {resolve = done;}),
            window: {dispatchEvent() {}}, Event: class {},
        };
        vm.createContext(context);
        vm.runInContext(code, context);
        const pending = context.refreshCurrentState();
        context.controlSessionRevision++;
        resolve({ok: !failed, json: async () => ({puzzle_id: 6})});
        await pending;
        assert.equal(context.currentGameState.puzzle_id, null);
        assert.equal(context.controlInitialSelectionSynced, false);
        assert.equal(context.controlStateLoading, false);
    }
});

test('changing sessions cancels a pending selected-puzzle action', async () => {
    const code = source.slice(source.indexOf('  async function assertSelectedPuzzleActive('),
        source.indexOf('  function renderControlLiveState('));
    let resolve;
    const context = {
        controlSessionRevision: 0, currentGameState: null,
        fetch: () => new Promise(done => {resolve = done;}),
    };
    vm.createContext(context);
    vm.runInContext(code, context);
    const pending = context.assertSelectedPuzzleActive();
    context.controlSessionRevision++;
    resolve({ok: true, json: async () => ({puzzle_id: 6})});
    await assert.rejects(pending, /La partida ha cambiado/);
    assert.equal(context.currentGameState, null);
});

test('start explicitly addresses the active ID and cancellation has no side effects', async () => {
    for (const accept of [false, true]) {
        const h = harness({accept, active: {dbSessionId: 11, sessionName: 'Grup'}});
        await h.context.beginConfirmedSession();
        assert.match(h.confirmations[0], /#11/);
        assert.deepEqual(h.writes, accept
            ? [{url: '/test/session/start', body: {session_id: 11}}] : []);
    }
});

test('browser reload cannot silently restore the old active session as an editor draft', () => {
    const code = source.slice(source.indexOf('  function loadActiveSession('),
        source.indexOf('  async function beginConfirmedSession('));
    const calls = [];
    const context = {
        activeSession: {dbSessionId: 11}, activeSessionKey: 'cache',
        clearSessionForm: () => calls.push('fresh'),
        window: {localStorage: {removeItem: () => calls.push('clear')}},
        renderActiveSession() {},
    };
    vm.runInNewContext(code + '\nloadActiveSession();', context);
    assert.equal(context.activeSession, null);
    assert.deepEqual(calls, ['fresh', 'clear']);
});

test('failed active-session verification never masquerades as no active session', async () => {
    const code = source.slice(source.indexOf('  async function syncConfirmedSession('),
        source.indexOf('  function addSimpleEvent('));
    for (const response of [
        {ok: false, json: async () => ({error: 'Offline'})},
        {ok: true, json: async () => ({error: 'Invalid payload'})},
    ]) {
        const context = {
            activeSession: {dbSessionId: 11},
            els: {headerSessionStatus: {}},
            fetch: async () => response,
        };
        vm.createContext(context);
        vm.runInContext(code, context);
        await assert.rejects(context.syncConfirmedSession());
        assert.equal(context.activeSession.dbSessionId, 11);
        assert.equal(context.els.headerSessionStatus.textContent, 'Sin verificar');
    }
});
