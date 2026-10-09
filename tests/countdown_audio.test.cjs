const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup(blocked = false) {
    const plays = [], listeners = {};
    let audio;
    const window = {addEventListener: (event, fn) => { listeners[event] = fn; }};
    vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../static/js/countdown-audio.js'), 'utf8'), {
        window,
        Audio: class {
            constructor(url) { audio = this; this.url = url; }
            pause() { this.paused = true; }
            play() {
                this.paused = false;
                plays.push({time: this.currentTime, volume: this.volume, rate: this.playbackRate});
                return blocked ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve();
            }
        }
    });
    return {api: window.PyramidCountdownAudio, plays, audio, listeners};
}

test('first number sounds once; repeated snapshots and frame ticks do not repeat it', () => {
    const {api, plays, audio} = setup();
    for (const seconds of [3, 3, 3, 2, 2, 1, 1, 0, 0]) api.tick('timer', seconds);
    assert.equal(plays.length, 3);
    assert.ok(plays.every(p => p.time === 0));
    assert.equal(audio.paused, true);
});

test('skipped seconds never queue late beeps; a new round can start with the same number', () => {
    const {api, plays} = setup();
    api.tick('timer', 5);
    api.tick('timer', 2);
    assert.equal(plays.length, 2);
    api.reset('timer');
    api.tick('timer', 2);
    assert.equal(plays.length, 3);
    for (const value of [0, -1, NaN, undefined]) api.tick('timer', value);
    assert.equal(plays.length, 3);
});

test('urgency options are preserved and leaving the page stops the sound', () => {
    const {api, plays, audio, listeners} = setup();
    api.tick('final', 4, {volume: 0.42, playbackRate: 1.16});
    assert.deepEqual(plays[0], {time: 0, volume: 0.42, rate: 1.16});
    listeners.pagehide();
    assert.equal(audio.paused, true);
});

test('blocked playback is discarded without interrupting the countdown or retrying old numbers', async () => {
    const {api, plays} = setup(true);
    api.tick('timer', 3);
    await Promise.resolve();
    api.tick('timer', 3);
    api.tick('timer', 2);
    await Promise.resolve();
    assert.equal(plays.length, 2);
});
