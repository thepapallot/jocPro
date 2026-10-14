const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function memory(nextId = 3) {
    const elements = new Map();
    const getElement = id => {
        if (!elements.has(id)) elements.set(id, {
            dataset: {}, textContent: '', hidden: false, style: {},
            classList: {
                values: new Set(['hidden']),
                add(value) { this.values.add(value); },
                remove(value) { this.values.delete(value); },
                contains(value) { return this.values.has(value); }
            },
            querySelectorAll: () => []
        });
        return elements.get(id);
    };
    getElement('p8-solved-banner');
    const listeners = {};
    let stream;
    const timers = [];
    const sounds = [];
    const victories = [];
    const navigations = [];
    const victory = {active:false,complete(id){victories.push(id);this.active=true;}};
    const context = vm.createContext({
        window: {PyramidLevelVictory:victory, NEXT_PUZZLE_ID:nextId,
            PYRAMID_GAME:{language:'ca',finalId:6}, location:{assign:url=>navigations.push(url)}}, console,
        document: {
            getElementById: getElement,
            addEventListener: (name, handler) => { listeners[name] = handler; }
        },
        EventSource: class { constructor() { stream = this; } },
        Audio: class {
            constructor(url) { this.url = url; }
            play() { sounds.push(this.url); return Promise.resolve(); }
        },
        setTimeout: (handler, delay) => timers.push({handler, delay}),
        cancelAnimationFrame() {},
        requestAnimationFrame: () => 1,
        performance: {now: () => 0}
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../static/js/puzzle8.js'), 'utf8'), context);
    listeners.DOMContentLoaded();
    return {
        elements, timers, sounds, victories, navigations,
        update: data => stream.onmessage({data: JSON.stringify({puzzle_id: 8, ...data})})
    };
}

test('attempt and available points follow the backend without counting repeated updates', () => {
    const game = memory();
    const state = {phase: 'numbers', attempt: 3, max_attempts: 10, available_points: 80};
    game.update(state);
    game.update(state);
    assert.match(game.elements.get('p8-instruction-step').textContent, /INTENTO 3\/10 · 80 PUNTOS EN JUEGO/);
    assert.deepEqual(game.navigations, []);
});

test('exhaustion shows zero points without victory and advances only after backend authorization', () => {
    const game = memory();
    const exhausted = {phase: 'exhausted', puzzle_exhausted: true, attempt: 10,
        available_points: 0, total_points: 0, phase_duration_ms: 5000, phase_remaining_ms: 5000};
    game.update(exhausted);
    assert.equal(game.elements.get('p8-exhausted-screen').hidden, false);
    assert.equal(game.elements.get('p8-grid-wrap').hidden, true);
    assert.equal(game.elements.get('p8-retry-screen').hidden, true);
    assert.equal(game.elements.get('p8-exhausted-score').textContent, '10 intentos · 0 puntos');
    assert.equal(game.elements.get('p8-countdown').hidden, true);
    assert.deepEqual(game.victories, []);
    assert.deepEqual(game.sounds, []);
    assert.deepEqual(game.navigations, []);
    game.update({...exhausted, auto_advance: true});
    game.update({...exhausted, auto_advance: true});
    assert.deepEqual(game.navigations, ['/presentacio/3?lang=ca']);
    assert.deepEqual(game.victories, []);
});

test('recovering exhaustion already finished opens the next briefing, including the final fallback', () => {
    const game = memory(null);
    game.update({phase: 'exhausted', puzzle_exhausted: true, attempt: 10, total_points: 0, auto_advance: true});
    assert.deepEqual(game.navigations, ['/presentacio/6?lang=ca']);
    assert.deepEqual(game.victories, []);
});

test('a failed attempt shows container totals and the ten-second retry countdown', () => {
    const game = memory();
    game.update({phase: 'input', input_result: {success: false, box_results: {}}});
    assert.equal(game.elements.get('p8-retry-screen').hidden, true);
    assert.equal(game.elements.get('p8-grid-wrap').hidden, false);
    game.update({phase: 'retry', phase_duration_ms: 10000, phase_remaining_ms: 10000,
        confirmed_boxes: [0, 1, 2, 3, 4, 5, 6, 7],
        retry_summary: {errors: 2, accumulated_correct: 8}});
    assert.equal(game.elements.get('p8-retry-screen').hidden, false);
    assert.equal(game.elements.get('p8-grid-wrap').hidden, true);
    assert.equal(game.elements.get('p8-retry-errors').textContent, '2');
    assert.equal(game.elements.get('p8-retry-correct').textContent, '8');
    assert.equal(game.elements.get('p8-retry-countdown-value').textContent, '10');
    assert.deepEqual(game.sounds, ['/static/audios/effects/fase_nocompletada.wav']);
    assert.deepEqual(game.victories, []);
    // Recovering an ongoing pause uses its remaining time, without another failure sound.
    game.update({phase: 'retry', phase_duration_ms: 10000, phase_remaining_ms: 4300,
        retry_summary: {errors: 2, accumulated_correct: 8}});
    assert.equal(game.elements.get('p8-retry-countdown-value').textContent, '5');
    assert.equal(game.sounds.length, 1);
    game.update({phase: 'numbers'});
    assert.equal(game.elements.get('p8-retry-screen').hidden, true);
    assert.equal(game.elements.get('p8-grid-wrap').hidden, false);
});

test('a result snapshot restores the board without repeating its failure sound', () => {
    const game = memory();
    game.update({phase: 'input', clear: true, symbols: [], input_entries: {},
        input_result: {success: false, box_results: {}}});
    assert.equal(game.elements.get('p8-retry-screen').hidden, true);
    assert.equal(game.elements.get('p8-grid-wrap').hidden, false);
    assert.deepEqual(game.sounds, []);
});

test('a successful Memory round shows the green completion screen without navigating', () => {
    const game = memory();
    game.update({phase: 'input', input_result: {success: true, box_results: {}}});
    assert.equal(game.elements.get('p8-instruction-title').textContent, 'NIVEL SUPERADO');
    assert.equal(game.elements.get('p8-instruction-detail').textContent, '');
    assert.equal(game.elements.get('p8-countdown').hidden, true);
    assert.equal(game.elements.get('p8-solved-banner').classList.contains('hidden'), false);
    assert.equal(game.timers.length, 0, 'a round does not trigger navigation');
    game.update({phase: 'numbers'});
    assert.equal(game.elements.get('p8-instruction-title').textContent, 'ATENTOS A LA PANTALLA');
    assert.equal(game.elements.get('p8-solved-banner').classList.contains('hidden'), true);
});

test('an incorrect answer does not display completion', () => {
    const game = memory();
    game.update({phase: 'input', input_result: {success: false, box_results: {}}});
    assert.equal(game.elements.get('p8-instruction-title').textContent, 'COMPLETAD LAS DOS FORMAS');
});

test('final completion starts the shared celebration only once and leaves navigation to the GM', () => {
    const game = memory();
    game.update({puzzle_solved: true});
    game.update({puzzle_solved: true});
    assert.equal(game.elements.get('p8-instruction-title').textContent, 'NIVEL SUPERADO');
    assert.equal(game.elements.get('p8-solved-banner').classList.contains('hidden'), true);
    assert.deepEqual(game.victories,[8]);
    assert.equal(game.timers.length, 0);
});

test('answer validation keeps phase feedback; only puzzle_solved starts the final celebration', () => {
    const game = memory();
    game.update({round: 1, round_total: 1, phase: 'input', input_result: {success: true, box_results: {}}});
    assert.deepEqual(game.sounds, ['/static/audios/effects/fase_completada.wav']);
    assert.deepEqual(game.victories,[]);
    assert.equal(game.timers.length, 0);
    assert.equal(game.elements.get('p8-solved-banner').classList.contains('hidden'), true);
    game.update({puzzle_solved: true});
    assert.equal(game.sounds.length, 1);
    assert.equal(game.timers.length, 0);
    assert.deepEqual(game.victories,[8]);
    assert.equal(game.elements.get('p8-solved-banner').classList.contains('hidden'), true);
});

test('an intermediate success retains the phase sound', () => {
    const game = memory();
    game.update({round: 1, round_total: 2, phase: 'input', input_result: {success: true, box_results: {}}});
    assert.deepEqual(game.sounds, ['/static/audios/effects/fase_completada.wav']);
});
