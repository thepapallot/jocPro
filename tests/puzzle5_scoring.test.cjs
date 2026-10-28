const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function chrono(nextId = 12, snapshot = {}) {
    const elements = new Map(), listeners = {}, timers = new Map();
    const sounds = [], victories = [], navigations = [], countdowns = [];
    const requests = [];
    let rejectSnapshot = false;
    let stream, timerId = 0;
    const element = id => {
        if (!elements.has(id)) elements.set(id, {
            textContent: '', hidden: true, style: {}, dataset: {},
            classList: {values: new Set(),
                add(...values) {values.forEach(v => this.values.add(v));},
                remove(...values) {values.forEach(v => this.values.delete(v));},
                contains(value) {return this.values.has(value);},
                toggle(value, on) {on ? this.values.add(value) : this.values.delete(value);}},
            querySelector: selector => element(id + selector)
        });
        return elements.get(id);
    };
    const boxes = Array.from({length: 10}, (_, i) => element('box' + i));
    const window = {NEXT_PUZZLE_ID: nextId, PYRAMID_GAME: {language: 'ca', finalId: 6},
        location: {assign: url => navigations.push(url)}, addEventListener() {},
        PyramidCountdownAudio: {reset() {}, tick: (_, value) => countdowns.push(value)},
        PyramidLevelVictory: {active: false, complete(id) {victories.push(id); this.active = true;}}};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../static/js/puzzle5.js'), 'utf8'), {
        window, document: {getElementById: element,
            querySelectorAll: selector => selector === '.player-box' ? boxes : [],
            addEventListener: (name, handler) => {listeners[name] = handler;}},
        console: {log() {}, warn() {}, error() {}}, Date,
        Audio: class {constructor(url) {this.url = url;} play() {sounds.push(this.url); return Promise.resolve();}},
        EventSource: class {constructor() {stream = this;}},
        fetch: url => {
            requests.push(url);
            if (url === '/current_state' && rejectSnapshot) {
                rejectSnapshot = false;
                return Promise.reject(new Error('Simulated snapshot failure'));
            }
            return Promise.resolve({json: () => Promise.resolve(snapshot)});
        },
        setTimeout: (fn, delay) => {timers.set(++timerId, {fn, delay}); return timerId;},
        setInterval: (fn, delay) => {timers.set(++timerId, {fn, delay}); return timerId;},
        clearTimeout: id => timers.delete(id), clearInterval: id => timers.delete(id)
    });
    listeners.DOMContentLoaded();
    return {window, boxes, element, timers, sounds, victories, navigations, countdowns,
        requests, failNextSnapshot: () => {rejectSnapshot = true;},
        open: () => stream.onopen(),
        push: data => window.puzzle5Debug.push(data),
        sse: data => stream.onmessage({data: JSON.stringify({puzzle_id: 5, ...data})})};
}

test('every event updates authoritative attempt/points and margin, including preparation snapshots', () => {
    const game = chrono();
    const state = {round: 1, waiting: true, active_round: false, objective: 30,
        waiting_seconds: 9, attempt: 4, max_attempts: 10, available_points: 70, limit: 22};
    game.push(state);
    game.sse(state);
    assert.equal(game.element('streak-attempt').textContent, 'INTENTO 4/10');
    assert.equal(game.element('p5-points-value').textContent, '70');
    assert.equal(game.element('p5-preparation-limit').textContent, '22 S');
    assert.equal(game.element('error-limit-text').textContent, '22 S');
    assert.equal(game.element('objective-text').textContent, '30');
    assert.equal(game.element('p5-countdown-value').textContent, '9 s');
    game.push({countdown_message: 'retry', waiting_seconds: 9, attempt: 5,
        available_points: 60, limit: 26});
    assert.equal(game.element('p5-preparation-limit').textContent, '26 S');
    game.push({round: 1, objective: 30});
    assert.equal(game.element('error-limit-text').textContent, '26 S', 'no stale per-round fallback');
    assert.deepEqual(game.victories, []);
});

test('initial five-second preparation and nine-second retry remain distinct', () => {
    const game = chrono();
    game.window.puzzle5Debug.countdown();
    assert.equal(game.element('p5-countdown-value').textContent, '5 s');
    assert.equal(game.element('p5-preparation-limit').textContent, '10 S');
    game.window.puzzle5Debug.countdown(9, null, 2);
    assert.equal(game.element('p5-countdown-value').textContent, '9 s');
    assert.equal(game.element('p5-preparation-limit').textContent, '14 S');
    assert.equal(game.element('streak-attempt').textContent, 'INTENTO 2/10');
    assert.equal(game.element('p5-points-value').textContent, '90');
    game.push({waiting: true, round: 1, countdown_deadline: (Date.now() + 3200) / 1000});
    assert.equal(game.element('p5-countdown-value').textContent, '4 s');
});

test('tenth failure retains results until exhaustion, then waits for authorized navigation exactly once', () => {
    const game = chrono();
    const times = Array.from({length: 10}, (_, player) => ({player, time: 5}));
    game.push({round: 1, objective: 30, attempt: 10, available_points: 10, limit: 46,
        times, round_result: {success: false, total: 50, limit: 46}});
    assert.equal(game.element('p5-exhausted-screen').hidden, true);
    assert.ok(game.boxes.every(box => box.classList.contains('result-failure')));
    assert.equal(game.element('box0.box-time').textContent, '35.0');
    assert.equal(game.element('error-text').textContent, '50.0 / 46');
    assert.equal(game.timers.size, 0, 'no client timer replaces backend phase timing');
    const exhausted = {attempt: 10, available_points: 0, total_points: 0, puzzle_exhausted: true};
    game.push(exhausted);
    assert.equal(game.element('p5-exhausted-screen').hidden, false);
    assert.equal(game.element('puzzle5-shell').style.display, 'none');
    assert.equal(game.element('p5-exhausted-score').textContent, '10 intentos · 0 puntos');
    assert.equal(game.element('streak-attempt').textContent, 'INTENTO 10/10');
    assert.equal(game.element('p5-points-value').textContent, '0');
    assert.deepEqual(game.navigations, []);
    assert.deepEqual(game.victories, []);
    game.push({...exhausted, auto_advance: true});
    game.sse({...exhausted, auto_advance: true});
    assert.deepEqual(game.navigations, ['/presentacio/12?lang=ca']);
    assert.deepEqual(game.victories, []);
    assert.equal(game.sounds.length, 1, 'exhaustion has no victory/failure sound');
});

test('exhaustion recovery supports final fallback and invalid next ids do not navigate', () => {
    const game = chrono(null);
    game.push({puzzle_exhausted: true, auto_advance: true, attempt: 10, available_points: 0});
    assert.deepEqual(game.navigations, ['/presentacio/6?lang=ca']);
    const invalid = chrono('12');
    invalid.push({puzzle_exhausted: true, auto_advance: true});
    assert.deepEqual(invalid.navigations, []);
});

test('snapshot restores result colors and margins without repeating feedback audio', async () => {
    const state = {puzzle_id: 5, round: 1, waiting: true, active_round: false, objective: 30,
        attempt: 3, max_attempts: 10, available_points: 80, limit: 18,
        times: [{player: 0, time: -2}], round_result: {success: false, total: 20, limit: 18}};
    const game = chrono(12, state);
    game.open();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(game.element('players-section').style.display, 'grid');
    assert.equal(game.element('box0.box-time').textContent, '28.0');
    assert.ok(game.boxes[0].classList.contains('result-failure'));
    assert.equal(game.element('p5-preparation-limit').textContent, '18 S');
    assert.deepEqual(game.sounds, []);
    game.sse(state);
    assert.deepEqual(game.sounds, []);
});

test('successful result is not victory; puzzle_solved starts shared celebration once', () => {
    const game = chrono();
    game.window.puzzle5Debug.success(10, 40);
    assert.equal(game.element('error-text').textContent, '40.0 / 46');
    assert.equal(game.element('streak-attempt').textContent, 'INTENTO 10/10');
    assert.equal(game.element('p5-points-value').textContent, '10');
    assert.deepEqual(game.victories, []);
    game.push({round_result: {success: true, total: 40, limit: 46}, puzzle_solved: true});
    game.push({puzzle_solved: true});
    assert.deepEqual(game.victories, [5]);
    assert.deepEqual(game.navigations, []);
});

test('other puzzle payloads do not alter chrono state', () => {
    const game = chrono();
    game.push({puzzle_id: 8, attempt: 10, available_points: 0, puzzle_exhausted: true, auto_advance: true});
    assert.equal(game.element('streak-attempt').textContent, 'INTENTO 1/10');
    assert.equal(game.element('p5-points-value').textContent, '100');
    assert.deepEqual(game.navigations, []);
});

test('reconnection reloads current scoring after the idempotent start request', async () => {
    const state = {puzzle_id: 5, round: 1, attempt: 2, max_attempts: 10,
        available_points: 90, limit: 14, objective: 30};
    const game = chrono(12, state);
    game.open();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(game.element('streak-attempt').textContent, 'INTENTO 2/10');
    assert.equal(game.element('p5-points-value').textContent, '90');
    Object.assign(state, {attempt: 4, available_points: 70, limit: 22});
    game.open();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(game.element('streak-attempt').textContent, 'INTENTO 4/10');
    assert.equal(game.element('p5-points-value').textContent, '70');
    assert.equal(game.element('error-limit-text').textContent, '22 S');
    assert.deepEqual(game.requests, ['/start_puzzle/5', '/current_state',
        '/start_puzzle/5', '/current_state']);
});

test('a failed snapshot request does not prevent recovery on the next connection', async () => {
    const game = chrono(12, {puzzle_id: 5, attempt: 10, available_points: 0,
        puzzle_exhausted: true, auto_advance: true});
    game.failNextSnapshot();
    game.open();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(game.navigations, []);
    game.open();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(game.navigations, ['/presentacio/12?lang=ca']);
});