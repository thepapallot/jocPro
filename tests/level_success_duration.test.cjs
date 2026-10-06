const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

for (let id = 1; id <= 12; id += 1) {
    test(`puzzle ${id} holds its final success screen for four seconds in every mode`, () => {
        const source = fs.readFileSync(path.join(__dirname, `../static/js/puzzle${id}.js`), 'utf8');
        if (id === 7) {
            assert.match(source, /setTimeout\(\(\) => \(window\.location\.href = '\/puzzleSuperat\/7'\), 4000\)/);
        } else if (id === 9) {
            assert.match(source, /setTimeout\(\(\) => \{\s*window\.location\.href = '\/puzzleSuperat\/9';\s*\}, 4000\)/);
        } else {
            const start = source.indexOf(`PyramidGameFlow?.complete(${id})`);
            assert.notEqual(start, -1);
            const timerEnd = source.slice(start).match(/\}, ([^\n]+)\);/);
            assert.ok(timerEnd, 'the completion callback must have a fixed timeout');
            assert.equal(timerEnd[1], '4000');
        }
        if ([7, 9, 12].includes(id)) {
            assert.match(source, new RegExp(`getElementById\\('p${id}-solved-banner'\\)\\?\\.classList\\.remove\\('hidden'\\)`));
        }
    });
}