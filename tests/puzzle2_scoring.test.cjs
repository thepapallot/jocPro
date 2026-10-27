const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../static/js/puzzle2.js'), 'utf8');

async function fixture(language = 'es', snapshot = {}) {
    const listeners = {};
    const streams = [];
    const redirects = [];
    const audios = [];
    let victories = 0;
    let cancelled = 0;
    let frames = 0;
    const window = {
        NEXT_PUZZLE_ID: 3,
        PYRAMID_GAME: {language},
        location: {assign: url => redirects.push(url)},
        addEventListener() {},
        PyramidLevelVictory: {complete: () => { victories++; }},
    };
    const context = {
        window, console, Map,
        document: {
            getElementById: () => null,
            addEventListener: (name, callback) => { listeners[name] = callback; },
            body: {classList: {toggle() {}, remove() {}}},
        },
        Audio: class {
            constructor() { audios.push(this); }
            addEventListener() {}
            play() { return Promise.resolve(); }
            pause() { this.paused = true; }
        },
        fetch: async () => ({json: async () => snapshot}),
        EventSource: class { constructor() { streams.push(this); } },
        requestAnimationFrame: () => ++frames,
        cancelAnimationFrame: () => { cancelled++; },
        setTimeout() {},
    };
    vm.runInNewContext(source, context);
    listeners.DOMContentLoaded();
    const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
    await flush();
    return {
        window, redirects, audios, streams, flush,
        victories: () => victories,
        cancelled: () => cancelled,
        push: data => window.puzzle2Debug.push(data),
        setSnapshot: value => { snapshot = value; },
    };
}

for (const language of ['ca', 'es', 'eng']) {
    test(`timeout advances without victory and preserves ${language}`, async () => {
        const page = await fixture(language);
        page.push({play_alarm_sound: {url: '/alarm.wav'}});
        page.push({puzzle_exhausted: true, total_points: 0});
        page.push({puzzle_solved: true});
        page.push({puzzle_exhausted: true, total_points: 0});
        assert.deepEqual(page.redirects, [`/presentacio/3?lang=${language}`]);
        assert.equal(page.victories(), 0);
        assert.equal(page.audios[0].paused, true);
        assert.equal(page.cancelled(), 1);
    });

    test(`exhausted snapshot advances on initial load in ${language}`, async () => {
        const page = await fixture(language, {puzzle_id: 2, puzzle_exhausted: true, total_points: 0});
        assert.deepEqual(page.redirects, [`/presentacio/3?lang=${language}`]);
        assert.equal(page.victories(), 0);
    });
}

test('SSE open recovers a timeout missed between the initial fetch and connection', async () => {
    const page = await fixture();
    page.setSnapshot({puzzle_id: 2, puzzle_exhausted: true});
    page.streams[0].onopen();
    await page.flush();
    assert.deepEqual(page.redirects, ['/presentacio/3?lang=es']);
    assert.equal(page.victories(), 0);
});

test('success still celebrates exactly once instead of advancing as exhausted', async () => {
    const page = await fixture();
    page.push({puzzle_solved: true, total_points: 90});
    page.push({puzzle_solved: true, total_points: 90});
    assert.equal(page.victories(), 1);
    assert.deepEqual(page.redirects, []);
});

test('timeout uses configured final fallback and language URL helper', async () => {
    const page = await fixture();
    page.window.NEXT_PUZZLE_ID = null;
    page.window.PYRAMID_GAME.finalId = 6;
    page.window.PyramidLanguage = {
        current: () => 'ca',
        path: (url, language) => `${url}?lang=${language}&fixture=1`,
    };
    page.push({puzzle_exhausted: true});
    assert.deepEqual(page.redirects, ['/presentacio/6?lang=ca&fixture=1']);
});
