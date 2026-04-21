(function () {
    const COLOR_PREFIX = 'p8-color-';
    let snapshotLoaded = false;
    let symbolsOrder = [];
    let solved = false;
    let totalRounds = 3;
    let activeRound = 1;
    let completedRounds = 0;
    const roundCards = Array.from(document.querySelectorAll('.round-card'));
    const grid = document.getElementById('p8-grid');
    const roundsContainer = document.getElementById('p8-rounds');

    function setInputPhase(active) {
        if (!grid) return;
        grid.classList.toggle('p8-input-phase', active);
    }

    function clearColorClasses(el) {
        if (!el) return;
        el.classList.forEach(cls => {
            if (cls.startsWith(COLOR_PREFIX)) el.classList.remove(cls);
        });
    }

    function clearGrid() {
        setInputPhase(false);
        const slots = document.querySelectorAll('#p8-grid .p8-slot');
        slots.forEach(slot => { 
            slot.innerHTML = ''; 
            slot.classList.remove('p8-duo', 'p8-trio');
        });
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
            // Store token number on the frame so the CSS ::before always shows it
            const frame = slot.closest('.p8-frame');
            if (frame) frame.setAttribute('data-token', n);
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

    function setRoundTotal(nextTotal) {
        if (!Number.isInteger(nextTotal) || nextTotal < 1) return;
        totalRounds = nextTotal;
        if (roundsContainer) {
            roundsContainer.dataset.roundTotal = String(totalRounds);
            roundsContainer.classList.remove('is-pending');
        }
        roundCards.forEach(card => {
            const cardRound = Number(card.dataset.roundCard);
            card.hidden = cardRound > totalRounds;
        });
    }

    // NEW: update top-right streak
    function updateStreak(round) {
        const el = document.getElementById('streak');
        if (Number.isInteger(round) && round >= 1) {
            activeRound = Math.min(round, totalRounds);
            completedRounds = Math.max(completedRounds, Math.max(0, activeRound - 1));
        }
        if (el) {
            el.textContent = `${activeRound}/${totalRounds}`;
        }
        roundCards.forEach(card => {
            const cardRound = Number(card.dataset.roundCard);
            card.classList.remove('is-active', 'is-complete');
            if (cardRound > totalRounds) {
                return;
            }
            if (cardRound <= completedRounds) {
                card.classList.add('is-complete');
            } else if (cardRound === activeRound) {
                card.classList.add('is-active');
            }
        });
    }

    // Short effect player
    function playSound(url) {
        const audio = new Audio(url);
        audio.play().catch(err => console.warn("Audio play failed:", err));
    }
    const BTN_SOUND_URL = "/static/audios/effects/boto.wav";
    const PHASE_OK_SOUND_URL = "/static/audios/effects/fase_completada.wav";       // NEW
    const PHASE_KO_SOUND_URL = "/static/audios/effects/fase_nocompletada.wav";     // NEW
    const LLETRES_SOUND_URL = "/static/audios/effects/apareix_contingut.wav";                // NEW
    const PUZZLE_COMPLETE_SOUND_URL = "/static/audios/effects/nivel_completado.wav";

    function showSolvedBanner() {
        const banner = document.getElementById('p8-solved-banner');
        if (banner) banner.classList.remove('hidden');
        document.body.classList.add('p8-solved-flash');
    }

    function handleUpdate(d) {
        if (!d || d.puzzle_id !== 8) return;

        if (Number.isInteger(d.round_total)) {
            setRoundTotal(d.round_total);
        }

        const entersInputPhase = d.phase === 'input' || (d.clear === true && Array.isArray(d.symbols));

        // Show solved banner and flash when puzzle is solved
        if (d.puzzle_solved && !solved) {
            solved = true;
            playSound(PUZZLE_COMPLETE_SOUND_URL);
            showSolvedBanner();
            setTimeout(function () {
                var nextId = (typeof NEXT_PUZZLE_ID !== 'undefined' && NEXT_PUZZLE_ID !== null)
                    ? NEXT_PUZZLE_ID : 1;
                fetch('/videoPuzzles/' + nextId, { method: 'POST' })
                    .then(function (response) {
                        if (response.redirected) {
                            window.location.href = response.url;
                        } else {
                            // fallback: force navigation
                            window.location.href = '/videoPuzzles/' + nextId;
                        }
                    })
                    .catch(function () {
                        window.location.href = '/videoPuzzles/' + nextId;
                    });
            }, 5200);
            return;
        }

        // NEW: reflect current round
        if (Number.isInteger(d.round)) {
            updateStreak(d.round);
        }

        // Explicit clear (beginning of idle phase)
        if (d.clear) {
            clearGrid();
            if (!Number.isInteger(d.round)) {
                updateStreak(Math.min(completedRounds + 1, totalRounds));
            }
            // Play start-of-phase sound for idle
            playSound(LLETRES_SOUND_URL);
        }

        // Numbers phase start
        if (Array.isArray(d.token_numbers)) {
            renderNumbers(d.token_numbers);
            // Play start-of-phase sound for numbers
            playSound(LLETRES_SOUND_URL);
            return;
        }

        // Tokens phase start (when symbols arrive with phase 'tokens')
        if (Array.isArray(d.symbols) && d.phase === 'tokens') {
            symbolsOrder = d.symbols.slice();
            renderSymbols(symbolsOrder);
            playSound(LLETRES_SOUND_URL);
        }
        if (d.phase === 'tokens' && d.colors) {
            applyColorsMap(d.colors);
            return;
        }

        // Input phase setup: render symbols order but leave uncolored
        if (Array.isArray(d.symbols) && entersInputPhase) {
            symbolsOrder = d.symbols.slice();
            setInputPhase(true);
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
        if (d.input_update && entersInputPhase) {
            const { box, color, symbol } = d.input_update;
            if (typeof box === 'number' && typeof color === 'string') {
                colorBox(box, color, typeof symbol === 'string' ? symbol : undefined);
            }
            // Play boto.wav on each input update
            playSound(BTN_SOUND_URL);
            return;
        }

        // Input result feedback (optional UI handling could be added here)
        // d.input_result = { success: true|false }

        // NEW: results feedback per box + phase sound
        if (d.input_result) {
            if (d.input_result.box_results) {
                const results = d.input_result.box_results; // { "0": true, "1": false, ... } or numeric keys
                Object.entries(results).forEach(([boxStr, ok]) => {
                    const box = Number(boxStr);
                    const slot = document.querySelector(`#p8-grid .p8-slot[data-index="${box}"]`);
                    if (!slot || !slot.parentElement) return;
                    const frame = slot.parentElement; // .p8-frame
                    frame.classList.remove('p8-correct', 'p8-wrong');
                    frame.classList.add(ok ? 'p8-correct' : 'p8-wrong');
                });
            }
            if (d.input_result.success === true && Number.isInteger(d.round) && d.round >= 1) {
                completedRounds = Math.max(completedRounds, Math.min(d.round, totalRounds));
                updateStreak(Math.min(completedRounds + 1, totalRounds));
            }
            // Play phase result sound
            if (d.input_result.success === true) {
                playSound(PHASE_OK_SOUND_URL);
            } else if (d.input_result.success === false) {
                playSound(PHASE_KO_SOUND_URL);
            }
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
            loadSnapshotOnce();
            fetch("/start_puzzle/8", { method: "POST" })
                .catch(err => console.warn("Failed to start puzzle 8:", err));
        };
        es.onerror = () => {};
    }

    function installDebugHelpers() {
        const sampleNumbers = [18, 14, 17, 5, 20, 10, 13, 31, 35, 22];
        const sampleSymbols = ['alpha', 'beta', 'delta', 'epsilon', 'gamma', 'lambda', 'mu', 'omega', 'pi', 'sigma'];
        const sampleColors = {
            alpha: 'red',
            beta: 'yellow',
            delta: 'green',
            epsilon: 'blue',
            gamma: 'white',
            lambda: 'black',
            mu: 'red',
            omega: 'blue',
            pi: 'yellow',
            sigma: 'green'
        };
        const sampleSymbolsRound2B = ['gamma', 'alpha', 'sigma', 'mu', 'pi', 'beta', 'omega', 'delta', 'epsilon', 'lambda'];
        const sampleColorsRound2B = {
            gamma: 'black',
            alpha: 'blue',
            sigma: 'white',
            mu: 'yellow',
            pi: 'red',
            beta: 'green',
            omega: 'black',
            delta: 'blue',
            epsilon: 'white',
            lambda: 'red'
        };

        window.puzzle8Debug = {
            clear() {
                handleUpdate({ puzzle_id: 8, clear: true, round: 1 });
            },
            numbers(round = 1) {
                handleUpdate({ puzzle_id: 8, round, phase: 'numbers', token_numbers: sampleNumbers });
            },
            tokens(round = 1) {
                handleUpdate({ puzzle_id: 8, round, phase: 'tokens', symbols: sampleSymbols, colors: sampleColors });
            },
            input(round = 1) {
                handleUpdate({ puzzle_id: 8, round, phase: 'input', symbols: sampleSymbols, clear: true });
            },
            blackOnly(round = 1) {
                const blackColors = {
                    alpha: 'black',
                    beta: 'black',
                    delta: 'black',
                    epsilon: 'black',
                    gamma: 'black',
                    lambda: 'black',
                    mu: 'black',
                    omega: 'black',
                    pi: 'black',
                    sigma: 'black'
                };
                handleUpdate({ puzzle_id: 8, round, phase: 'tokens', symbols: sampleSymbols, colors: blackColors });
            },
            inputUpdate(box = 0, symbol = 'alpha', color = 'red', round = 1) {
                handleUpdate({
                    puzzle_id: 8,
                    round,
                    phase: 'input',
                    input_update: { box, symbol, color }
                });
            },
            result(success = true) {
                handleUpdate({
                    puzzle_id: 8,
                    phase: 'input',
                    input_result: {
                        success,
                        box_results: {
                            0: success, 1: success, 2: success, 3: success, 4: success,
                            5: success, 6: success, 7: success, 8: success, 9: success
                        }
                    }
                });
            },
            round2Preview() {
                this.clear();
                setTimeout(() => this.numbers(1), 300);
                setTimeout(() => this.tokens(1), 1200);
                setTimeout(() => this.input(1), 2400);
                setTimeout(() => this.result(true), 3200);
                setTimeout(() => this.clear(), 4300);
                setTimeout(() => this.numbers(2), 5200);
                setTimeout(() => {
                    handleUpdate({
                        puzzle_id: 8,
                        round: 2,
                        phase: 'tokens',
                        symbols: sampleSymbols,
                        colors: sampleColors
                    });
                }, 7000);
                setTimeout(() => {
                    handleUpdate({
                        puzzle_id: 8,
                        round: 2,
                        phase: 'tokens',
                        symbols: sampleSymbolsRound2B,
                        colors: sampleColorsRound2B
                    });
                }, 9800);
            },
            demoRound1() {
                this.clear();
                setTimeout(() => this.numbers(1), 500);
                setTimeout(() => this.tokens(1), 1800);
                setTimeout(() => this.input(1), 3600);
            }
        };
    }

    document.addEventListener('DOMContentLoaded', () => {
        setRoundTotal(totalRounds);
        installDebugHelpers();
        initSSE();
    });
})();
