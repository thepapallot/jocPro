(function () {
    const COLOR_PREFIX = 'p8-color-';
    const TOTAL_ROUNDS = 3; // NEW
    let snapshotLoaded = false;
    let symbolsOrder = [];
    let solved = false; // NEW: prevent multiple redirects

    function clearColorClasses(el) {
        if (!el) return;
        el.classList.forEach(cls => {
            if (cls.startsWith(COLOR_PREFIX)) el.classList.remove(cls);
        });
    }

    function clearGrid() {
        const slots = document.querySelectorAll('#p8-grid .p8-slot');
        slots.forEach(slot => { 
            slot.innerHTML = ''; 
            slot.classList.remove('p8-duo', 'p8-trio'); // NEW: reset duo and trio layout
        });
        // Also clear any result feedback classes
        const frames = document.querySelectorAll('#p8-grid .p8-frame');
        frames.forEach(f => {
            f.classList.remove('p8-correct', 'p8-wrong');
        });
    }

    function createNumberElement(n) {
        const div = document.createElement('div');
        div.className = 'p8-number';
        div.textContent = String(n);
        return div;
    }

    function createSymbolElement(symbol) {
        const div = document.createElement('div');
        div.className = `p8-symbol-mask p8-${symbol}`;
        div.setAttribute('data-symbol', symbol);
        div.setAttribute('aria-label', symbol);
        return div;
    }

    function renderNumbers(nums) {
        if (!Array.isArray(nums) || nums.length === 0) return;
        const slots = document.querySelectorAll('#p8-grid .p8-slot');
        slots.forEach(slot => {
            const idx = Number(slot.getAttribute('data-index'));
            slot.innerHTML = '';
            const n = nums[idx];
            if (n == null) return;
            slot.appendChild(createNumberElement(n));
        });
    }

    function renderSymbols(symbols) {
        if (!Array.isArray(symbols) || symbols.length === 0) return;
        const slots = document.querySelectorAll('#p8-grid .p8-slot');
        slots.forEach(slot => {
            const idx = Number(slot.getAttribute('data-index'));
            const name = symbols[idx];
            slot.innerHTML = '';
            if (!name) return;
            const el = createSymbolElement(name);
            slot.appendChild(el);
        });
    }

    // Render or reuse a symbol in a slot on demand
    function ensureSymbolAt(boxIndex, symbolOverride) {
        const slot = document.querySelector(`#p8-grid .p8-slot[data-index="${boxIndex}"]`);
        if (!slot) return null;

        // If empty, create the first element
        if (!slot.firstElementChild) {
            const symbol = symbolOverride || symbolsOrder[boxIndex];
            if (!symbol) return null;
            const el = createSymbolElement(symbol);
            slot.appendChild(el);
            return el;
        }

        // If a second or third input arrives, append a second or third element even if the symbol is the same
        if (symbolOverride && slot.children.length < 3) {
            const el = createSymbolElement(symbolOverride);
            slot.appendChild(el);
            const count = slot.children.length;
            if (count === 2) slot.classList.add('p8-duo');
            if (count === 3) slot.classList.add('p8-trio');
            return el;
        }

        // Default to the first element (shouldn't happen when backend limits to 3 inputs)
        return slot.firstElementChild;
    }

    function applyColorsMap(colors) {
        if (!colors || typeof colors !== 'object') return;
        Object.entries(colors).forEach(([symbol, color]) => {
            const el = document.querySelector(`[data-symbol="${symbol}"]`);
            if (!el || typeof color !== 'string' || !color) return;
            clearColorClasses(el);
            el.classList.add(`${COLOR_PREFIX}${color}`);
        });
    }

    function colorBox(boxIndex, color, symbolOverride) {
        const el = ensureSymbolAt(boxIndex, symbolOverride);
        if (!el) return;
        clearColorClasses(el);
        el.classList.add(`${COLOR_PREFIX}${color}`);
    }

    // NEW: update top-right streak
    function updateStreak(round) {
        const el = document.getElementById('streak');
        if (!el) return;
        if (Number.isInteger(round) && round >= 1) {
            el.textContent = `${round}/${TOTAL_ROUNDS}`;
        }
    }

    function handleUpdate(d) {
        if (!d || d.puzzle_id !== 8) return;

        // NEW: redirect when puzzle solved
        if (d.puzzle_solved && !solved) {
            solved = true;
            setTimeout(() => { window.location.href = '/puzzleSuperat/8'; }, 500);
            return;
        }

        // NEW: reflect current round
        if (Number.isInteger(d.round)) {
            updateStreak(d.round);
        }

        // Explicit clear
        if (d.clear) {
            clearGrid();
        }

        // Numbers phase
        if (Array.isArray(d.token_numbers)) {
            renderNumbers(d.token_numbers);
            return;
        }

        // Tokens phase (show target order and colors)
        if (Array.isArray(d.symbols) && d.phase === 'tokens') {
            symbolsOrder = d.symbols.slice();
            renderSymbols(symbolsOrder);
        }
        if (d.phase === 'tokens' && d.colors) {
            applyColorsMap(d.colors);
            return;
        }

        // Input phase setup: render symbols order but leave uncolored
        if (Array.isArray(d.symbols) && d.phase === 'input') {
            symbolsOrder = d.symbols.slice();
            // frames remain empty; hydrate partial inputs if present
            if (d.input_symbols && d.input_colors) {
                Object.entries(d.input_symbols).forEach(([boxStr, sym]) => {
                    const box = Number(boxStr);
                    const color = d.input_colors[boxStr];
                    if (!Number.isNaN(box) && typeof sym === 'string' && typeof color === 'string') {
                        colorBox(box, color, sym);
                    }
                });
            } else if (d.input_colors) {
                Object.entries(d.input_colors).forEach(([boxStr, color]) => {
                    const box = Number(boxStr);
                    if (!Number.isNaN(box)) colorBox(box, color);
                });
            }
            return;
        }

        // Incremental input update with explicit symbol
        if (d.input_update && d.phase === 'input') {
            const { box, color, symbol } = d.input_update;
            if (typeof box === 'number' && typeof color === 'string') {
                colorBox(box, color, typeof symbol === 'string' ? symbol : undefined);
            }
            return;
        }

        // Input result feedback (optional UI handling could be added here)
        // d.input_result = { success: true|false }

        // NEW: results feedback per box
        if (d.input_result && d.input_result.box_results) {
            const results = d.input_result.box_results; // { "0": true, "1": false, ... } or numeric keys
            Object.entries(results).forEach(([boxStr, ok]) => {
                const box = Number(boxStr);
                const slot = document.querySelector(`#p8-grid .p8-slot[data-index="${box}"]`);
                if (!slot || !slot.parentElement) return;
                const frame = slot.parentElement; // .p8-frame
                frame.classList.remove('p8-correct', 'p8-wrong');
                frame.classList.add(ok ? 'p8-correct' : 'p8-wrong');
            });
            return;
        }
    }

    function loadSnapshotOnce() {
        if (snapshotLoaded) return;
        snapshotLoaded = true;
        fetch('/current_state')
            .then(r => r.json())
            .then(handleUpdate)
            .catch(() => {});
    }

    function initSSE() {
        const es = new EventSource('/state_stream');
        es.onmessage = evt => { try { handleUpdate(JSON.parse(evt.data)); } catch {} };
        es.onopen = () => {
            // Start Puzzle 2 when SSE is connected
            fetch("/start_puzzle/8", { method: "POST" })
                .catch(err => console.warn("Failed to start puzzle 8:", err));
        };
        es.onerror = () => {};
    }

    document.addEventListener('DOMContentLoaded',initSSE);
})();
