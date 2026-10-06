const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function memory() {
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
    const listeners = {};
    let stream;
    const timers = [];
    const sounds = [];
    const context = vm.createContext({
        window: {}, console,
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
        elements, timers, sounds,
        update: data => stream.onmessage({data: JSON.stringify({puzzle_id: 8, ...data})})
    };
}

test('a successful Memory round shows the green completion screen without navigating', () => {
    const game = memory();
    game.update({phase: 'input', input_result: {success: true, box_results: {}}});
    assert.equal(game.elements.get('p8-instruction-title').textContent, 'NIVEL COMPLETADO');
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
    assert.equal(game.elements.get('p8-instruction-title').textContent, 'COMPLETA LAS DOS FORMAS');
});

test('final completion shows the green screen and schedules navigation only once', () => {
    const game = memory();
    game.update({puzzle_solved: true});
    game.update({puzzle_solved: true});
    assert.equal(game.elements.get('p8-instruction-title').textContent, 'NIVEL COMPLETADO');
    assert.equal(game.elements.get('p8-solved-banner').classList.contains('hidden'), false);
    assert.equal(game.timers.length, 1);
});

test('the final success sound plays at answer validation, not five seconds later or twice', () => {
    const game = memory();
    game.update({round: 1, round_total: 1, phase: 'input', input_result: {success: true, box_results: {}}});
    assert.deepEqual(game.sounds, ['/static/audios/effects/nivel_completado.wav']);
    assert.equal(game.timers.length, 0);
    game.update({puzzle_solved: true});
    assert.equal(game.sounds.length, 1);
    assert.equal(game.timers.length, 1);
});

test('an intermediate success retains the phase sound', () => {
    const game = memory();
    game.update({round: 1, round_total: 2, phase: 'input', input_result: {success: true, box_results: {}}});
    assert.deepEqual(game.sounds, ['/static/audios/effects/fase_completada.wav']);
});