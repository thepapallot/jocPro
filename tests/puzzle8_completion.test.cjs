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
    getElement('p8-solved-banner');
    const listeners = {};
    let stream;
    const timers = [];
    const sounds = [];
    const victories = [];
    const victory = {active:false,complete(id){victories.push(id);this.active=true;}};
    const context = vm.createContext({
        window: {PyramidLevelVictory:victory}, console,
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
        elements, timers, sounds, victories,
        update: data => stream.onmessage({data: JSON.stringify({puzzle_id: 8, ...data})})
    };
}

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
