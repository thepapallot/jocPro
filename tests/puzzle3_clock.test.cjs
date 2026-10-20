const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const script = name => fs.readFileSync(path.join(__dirname, '../static/js', name), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));

// Real quiz controller, minimal DOM. Full ten-row rendering is covered by the
// isolated browser regressions; no server, MQTT or client clock is used here.
function quiz(snapshot = {}) {
    const elements = new Map(), listeners = {}, sounds = [], victories = [], requests = [], timers = [];
    let stream, snapshotProvider = () => Promise.resolve(snapshot);
    const element = id => {
        if (['player-status', 'player-summary', 'feedback'].includes(id) || id.startsWith('pchip-')) return null;
        if (!elements.has(id)) elements.set(id, {
            textContent: '', innerHTML: '', hidden: false, clientHeight: 0, style: {},
            querySelector: selector => element(id + selector), querySelectorAll: () => []
        });
        return elements.get(id);
    };
    const window = {addEventListener() {}, PyramidLanguage: {apply() {}},
        PyramidCountdownAudio: {tick() {}, reset() {}},
        PyramidLevelVictory: {active: false, complete: id => victories.push(id)}};
    vm.runInNewContext(script('puzzle3.js'), {
        window, document: {getElementById: element, querySelectorAll: () => [],
            addEventListener: (name, fn) => { listeners[name] = fn; },
            fonts: {ready: Promise.resolve(), addEventListener() {}}},
        console: {warn() {}}, getComputedStyle: () => ({paddingTop: '0', paddingBottom: '0'}),
        ResizeObserver: class {observe() {}}, requestAnimationFrame() {return 1;},
        Audio: class {constructor(url) {this.url = url;} play() {sounds.push(this.url); return Promise.resolve();}},
        EventSource: class {constructor() {stream = this;}},
        fetch: url => {
            requests.push(url);
            return url === '/current_state' ? snapshotProvider().then(data => ({json: () => data})) : Promise.resolve({});
        },
        setTimeout: (fn, ms) => timers.push({fn, ms}), Date
    });
    listeners.DOMContentLoaded();
    return {element, sounds, victories, requests, timers,
        snapshotProvider: fn => {snapshotProvider = fn;},
        open: () => stream.onopen(),
        push: data => stream.onmessage({data: JSON.stringify({puzzle_id: 3, ...data})})};
}
const question = (id = 1) => ({id, q: 'Question ' + id, answers: []});
const result = success => ({success, player_answers: {}, correct_answers: []});

test('HUD displays only server time and points; partial ticks never erase the question or award victory', () => {
    const game = quiz();
    assert.equal(game.element('timer').textContent, '05:00');
    game.push({question: question(), remaining: 299, duration: 300, total_points: 20});
    game.push({remaining: 61});
    assert.equal(game.element('timer').textContent, '01:01');
    assert.equal(game.element('streak').textContent, '20');
    assert.equal(game.element('question-text.quiz-fit-content').textContent, 'Question 1');
    game.push({puzzle_id: 8, remaining: 12, total_points: 0});
    assert.equal(game.element('timer').textContent, '01:01');
    game.push({remaining: 0});
    assert.equal(game.element('timer').textContent, '00:00');
    assert.deepEqual(game.victories, []);
    assert.deepEqual(game.timers, [], 'no local countdown or automatic question advance');
});

test('more than six fully correct questions keep playing; failures keep earned points and advance on server question', () => {
    const game = quiz();
    for (let n = 1; n <= 7; n++) {
        game.push({question: question(n), question_number: n, question_result: null});
        game.push({question_result: result(true), total_points: n * 10, correct_count: n});
        assert.equal(game.element('streak').textContent, String(n * 10));
    }
    assert.deepEqual(game.victories, []);
    game.push({question: question(8), question_number: 8, question_result: null});
    game.push({question_result: result(false), total_points: 70, correct_count: 7});
    game.push({remaining: 100});
    assert.equal(game.element('streak').textContent, '70');
    assert.equal(game.element('answer-change-hint').hidden, true);
    assert.deepEqual(game.timers, [], 'the seven-second reveal belongs to the server');
    game.push({question: question(9), question_number: 9, question_result: null});
    assert.equal(game.element('question-text.quiz-fit-content').textContent, 'Question 9');
    assert.equal(game.element('answer-change-hint').hidden, false);
});

test('persistent result snapshots and ticks retain feedback without replaying sound; repeated question ids can advance', () => {
    const game = quiz(), state = {question: question(), question_number: 2, question_result: result(false)};
    game.push({question: question(), question_number: 1});
    game.push(state);
    const soundCount = game.sounds.length;
    game.push({remaining: 292});
    game.push(state);
    assert.equal(game.sounds.length, soundCount);
    assert.equal(game.element('answer-change-hint').hidden, true);
    game.push({question: state.question, remaining: 291});
    assert.equal(game.element('answer-change-hint').hidden, true, 'an omitted result is not an explicit next-question event');
    assert.equal(game.sounds.length, soundCount);
    game.push({question: question(), question_number: 2, question_result: null});
    assert.equal(game.element('answer-change-hint').hidden, false);
    assert.equal(game.sounds.length, soundCount + 1);
});

test('refresh/reconnect silently restores persistent result and never restarts the five-minute game', async () => {
    const state = {puzzle_id: 3, question: question(5), question_number: 6, remaining: 123,
        total_points: 30, answered_map: {}, question_result: result(true)};
    const game = quiz(state);
    game.open(); await settle();
    assert.equal(game.element('timer').textContent, '02:03');
    assert.equal(game.element('streak').textContent, '30');
    assert.equal(game.element('answer-change-hint').hidden, true);
    assert.deepEqual(game.sounds, []);
    game.push(state);
    assert.deepEqual(game.sounds, []);
    state.remaining = 100;
    game.open(); await settle();
    assert.equal(game.element('timer').textContent, '01:40');
    assert.deepEqual(game.requests, ['/start_puzzle/3', '/current_state', '/current_state']);
});

test('a stale recovery response cannot overwrite a newer live event', async () => {
    const game = quiz({puzzle_id: 3, remaining: 199, total_points: 40});
    let release;
    game.snapshotProvider(() => new Promise(resolve => {release = resolve;}));
    game.open(); await settle();
    game.push({remaining: 199, total_points: 40});
    game.snapshotProvider(() => Promise.resolve({puzzle_id: 3, remaining: 198, total_points: 40}));
    release({puzzle_id: 3, remaining: 250, total_points: 10}); await settle();
    assert.equal(game.element('timer').textContent, '03:18');
    assert.equal(game.element('streak').textContent, '40');
    assert.equal(game.requests.filter(url => url === '/current_state').length, 2);
});

test('expiry, including zero points on refresh, completes exactly once and ignores subsequent events', async () => {
    const game = quiz({puzzle_id: 3, remaining: 0, duration: 300, total_points: 0, puzzle_solved: true});
    game.open(); await settle();
    game.push({puzzle_solved: true, total_points: 0, remaining: 0});
    game.push({remaining: 200, total_points: 90});
    assert.deepEqual(game.victories, [3]);
    assert.equal(game.element('timer').textContent, '00:00');
    assert.equal(game.element('streak').textContent, '0');
});

test('ca/es/en briefings explain the same timed, additive scoring and seven-second results', () => {
    const context = vm.createContext({window: {}, URL, URLSearchParams, location: {search: ''},
        document: {currentScript: {src: 'http://localhost/static/js/presentation-flow.js'}}});
    for (const name of ['puzzle-names.js', 'presentation-story.js', 'presentation-flow.js']) vm.runInContext(script(name), context);
    const quiz = context.window.PyramidFlow.find(scene => scene.puzzleId === 3);
    for (const lang of ['ca', 'es', 'eng']) {
        assert.match(quiz.copy[lang].objectiveLead, /5/);
        const attention = quiz.attentionCopy[lang].text;
        for (const number of [10, 4, 6, 5]) assert.match(attention, new RegExp('\\b' + number + '\\b'));
        assert.match(quiz.copy[lang].notes.at(-1), /7/);
    }
    assert.match(quiz.attentionCopy.ca.text, /errors no resten/);
    assert.match(quiz.attentionCopy.es.text, /errores no restan/);
    assert.match(quiz.attentionCopy.eng.text, /do not deduct/);
});