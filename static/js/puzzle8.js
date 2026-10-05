(function () {
    const COLOR_PREFIX = 'p8-color-';
    const grid = document.getElementById('p8-grid');
    const slots = Array.from(grid.querySelectorAll('.p8-slot'));
    const instruction = document.getElementById('p8-instruction');
    const instructionStep = document.getElementById('p8-instruction-step');
    const instructionTitle = document.getElementById('p8-instruction-title');
    const instructionDetail = document.getElementById('p8-instruction-detail');
    const countdown = document.getElementById('p8-countdown');
    const countdownValue = document.getElementById('p8-countdown-value');
    const timeTrack = document.getElementById('p8-time-track');
    const timeFill = document.getElementById('p8-time-fill');
    let symbolsOrder = [];
    let solved = false;
    let countdownFrame = null;

    const instructions = {
        idle: ['', '', ''],
        numbers: ['ATENTOS A LA PANTALLA', 'Prepárate: aparecerán dos formas', 'PASO 1 DE 3 · PREPARACIÓN'],
        tokens: ['MEMORIZA LAS DOS FORMAS', 'Recuerda también sus colores', 'PASO 2 DE 3 · MEMORIA'],
        input: ['COMPLETA LAS DOS FORMAS', 'Pasa tu token por dos terminales, en cualquier orden', 'PASO 3 DE 3 · RESPUESTA']
    };

    function stopCountdown() {
        if (countdownFrame !== null) cancelAnimationFrame(countdownFrame);
        countdownFrame = null;
        countdown.hidden = true;
        timeTrack.hidden = true;
    }

    function syncCountdown(data) {
        if (data.puzzle_solved || !['numbers', 'tokens'].includes(data.phase)) {
            if (data.phase || data.clear || data.puzzle_solved) stopCountdown();
            return;
        }

        const durationMs = Number(data.phase_duration_ms);
        const remainingMs = Number(data.phase_remaining_ms);
        if (!Number.isFinite(durationMs) || durationMs <= 0 || !Number.isFinite(remainingMs)) {
            stopCountdown();
            return;
        }

        if (countdownFrame !== null) cancelAnimationFrame(countdownFrame);
        // Use the server's remaining time, including on a reload/reconnection.
        // A monotonic browser clock keeps the animation independent of wall-clock changes.
        const deadline = performance.now() + Math.max(0, Math.min(remainingMs, durationMs));
        countdown.hidden = false;
        timeTrack.hidden = false;
        function tick() {
            const leftMs = Math.max(0, deadline - performance.now());
            const seconds = String(Math.ceil(leftMs / 1000));
            if (countdownValue.textContent !== seconds) countdownValue.textContent = seconds;
            timeFill.style.transform = `scaleX(${leftMs / durationMs})`;
            countdownFrame = leftMs > 0 ? requestAnimationFrame(tick) : null;
        }
        tick();
    }

    function setPhase(phase) {
        grid.dataset.phase = phase;
        instruction.dataset.phase = phase;
        const [title, detail, step] = instructions[phase] || instructions.idle;
        instructionStep.textContent = step;
        instructionTitle.textContent = title;
        instructionDetail.textContent = detail;
    }

    function renderTokenNumbers(numbers) {
        if (!Array.isArray(numbers)) return;
        slots.forEach((slot, index) => {
            const number = numbers[index];
            if (number == null) return;
            const frame = slot.closest('.p8-frame');
            frame.dataset.token = String(number);
            frame.setAttribute('aria-label', `Token ${number}`);
            frame.querySelector('.p8-number').textContent = String(number);
        });
    }

    function resetAnswers() {
        slots.forEach(slot => {
            slot.closest('.p8-frame').classList.remove('p8-correct', 'p8-wrong');
            slot.querySelectorAll('.p8-answer').forEach(answer => {
                answer.classList.remove('is-filled');
                answer.setAttribute('aria-label', 'Forma pendiente');
                const placeholder = document.createElement('span');
                placeholder.className = 'p8-placeholder';
                placeholder.setAttribute('aria-hidden', 'true');
                const terminal = document.createElement('span');
                terminal.className = 'p8-terminal-mark';
                placeholder.appendChild(terminal);
                answer.querySelector('.p8-answer-content').replaceChildren(placeholder);
            });
        });
    }

    function fillAnswer(answer, symbol, color) {
        if (!answer || !symbol) return;
        const element = document.createElement('div');
        element.className = `p8-symbol-mask p8-${symbol}`;
        element.dataset.symbol = symbol;
        element.setAttribute('role', 'img');
        element.setAttribute('aria-label', `${symbol}, ${color || ''}`);
        if (typeof color === 'string' && color) {
            element.classList.add(`${COLOR_PREFIX}${color}`);
        }
        answer.querySelector('.p8-answer-content').replaceChildren(element);
        answer.classList.add('is-filled');
        answer.setAttribute('aria-label', 'Forma registrada');
    }

    function renderSymbolSets(symbolSets) {
        resetAnswers();
        setPhase('tokens');
        slots.forEach((slot, index) => {
            const answers = slot.querySelectorAll('.p8-answer');
            symbolSets.slice(0, 2).forEach((symbolSet, step) => {
                const symbol = symbolSet?.symbols?.[index];
                fillAnswer(answers[step], symbol, symbolSet?.colors?.[symbol]);
            });
        });
    }

    function colorBox(boxIndex, color, symbolOverride) {
        const slot = slots[boxIndex];
        if (!slot) return;
        // Replace the next pending marker without moving the other position.
        const answer = slot.querySelector('.p8-answer:not(.is-filled)');
        fillAnswer(answer, symbolOverride || symbolsOrder[boxIndex], color);
    }

    function playSound(url) {
        const audio = new Audio(url);
        audio.play().catch(err => console.warn('Audio play failed:', err));
    }
    const BTN_SOUND_URL = '/static/audios/effects/boto.wav';
    const PHASE_OK_SOUND_URL = '/static/audios/effects/fase_completada.wav';
    const PHASE_KO_SOUND_URL = '/static/audios/effects/fase_nocompletada.wav';
    const LLETRES_SOUND_URL = '/static/audios/effects/apareix_contingut.wav';
    const PUZZLE_COMPLETE_SOUND_URL = '/static/audios/effects/nivel_completado.wav';

    function handleUpdate(data) {
        if (!data || data.puzzle_id !== 8) return;
        const previousPhase = grid.dataset.phase;
        renderTokenNumbers(data.token_numbers);
        syncCountdown(data);

        if (data.puzzle_solved && !solved) {
            solved = true;
            playSound(PUZZLE_COMPLETE_SOUND_URL);
            document.getElementById('p8-solved-banner')?.classList.remove('hidden');
            document.body.classList.add('p8-solved-flash');
            setTimeout(() => {
                if (window.PyramidGameFlow?.complete(8)) return;
                const nextId = window.NEXT_PUZZLE_ID ?? 1;
                fetch('/videoPuzzles/' + nextId, { method: 'POST' })
                    .then(response => {
                        window.location.href = response.redirected
                            ? response.url : '/videoPuzzles/' + nextId;
                    })
                    .catch(() => { window.location.href = '/videoPuzzles/' + nextId; });
            }, window.PyramidGameFlow?.managed ? 1300 : 5200);
            return;
        }

        if (data.clear) {
            resetAnswers();
            setPhase(data.phase || 'numbers');
        }

        if (data.phase === 'numbers') {
            resetAnswers();
            setPhase('numbers');
            if (previousPhase !== 'numbers') playSound(LLETRES_SOUND_URL);
            return;
        }

        if (data.phase === 'tokens') {
            symbolsOrder = data.symbols || data.symbol_sets?.[0]?.symbols || [];
            const sets = data.symbol_sets || [{ symbols: data.symbols, colors: data.colors }];
            renderSymbolSets(sets);
            if (previousPhase !== 'tokens') playSound(LLETRES_SOUND_URL);
            return;
        }

        const entersInputPhase = data.phase === 'input' || (data.clear && Array.isArray(data.symbols));
        if (entersInputPhase) {
            setPhase('input');
        }

        if (Array.isArray(data.symbols) && entersInputPhase) {
            symbolsOrder = data.symbols.slice();
            resetAnswers();
            if (data.input_entries) {
                Object.entries(data.input_entries).forEach(([box, entries]) => {
                    if (!Array.isArray(entries)) return;
                    entries.slice(0, 2).forEach(entry => {
                        if (typeof entry?.symbol === 'string' && typeof entry?.color === 'string') {
                            colorBox(Number(box), entry.color, entry.symbol);
                        }
                    });
                });
            } else if (data.input_colors) {
                Object.entries(data.input_colors).forEach(([box, color]) => {
                    colorBox(Number(box), color, data.input_symbols?.[box]);
                });
            }
            if (previousPhase !== 'input') playSound(LLETRES_SOUND_URL);
            return;
        }

        if (data.input_update && entersInputPhase) {
            const { box, color, symbol } = data.input_update;
            if (Number.isInteger(box) && typeof color === 'string') {
                colorBox(box, color, symbol);
            }
            playSound(BTN_SOUND_URL);
            return;
        }

        if (data.input_result) {
            Object.entries(data.input_result.box_results || {}).forEach(([box, ok]) => {
                const frame = slots[Number(box)]?.closest('.p8-frame');
                if (!frame) return;
                frame.classList.remove('p8-correct', 'p8-wrong');
                frame.classList.add(ok ? 'p8-correct' : 'p8-wrong');
            });
            playSound(data.input_result.success ? PHASE_OK_SOUND_URL : PHASE_KO_SOUND_URL);
        }
    }

    function initSSE() {
        const stream = new EventSource('/state_stream');
        stream.onmessage = event => {
            try { handleUpdate(JSON.parse(event.data)); } catch (error) {
                console.warn('Could not render memory update:', error);
            }
        };
        stream.onopen = () => {
            // Start first so an old idle snapshot cannot erase the initial tokens.
            // The start endpoint is idempotent; reconnects restore the current phase.
            fetch('/start_puzzle/8', { method: 'POST' })
                .then(response => {
                    if (!response.ok) throw new Error('Could not start memory');
                    return fetch('/current_state');
                })
                .then(response => response.json())
                .then(handleUpdate)
                .catch(error => console.warn('Failed to start puzzle 8:', error));
        };
    }

    function installDebugHelpers() {
        const numbers = [18, 14, 17, 5, 20, 10, 13, 31, 35, 22];
        const symbols = ['alpha', 'beta', 'delta', 'epsilon', 'gamma', 'lambda', 'mu', 'omega', 'pi', 'sigma'];
        const colors = ['red', 'yellow', 'green', 'blue', 'white', 'black'];
        const symbolSets = [0, 3].map(offset => {
            const order = symbols.map((_, index) => symbols[(index + offset) % symbols.length]);
            return {
                symbols: order,
                colors: Object.fromEntries(order.map((symbol, index) => [symbol, colors[(index + offset) % colors.length]]))
            };
        });
        const update = data => {
            const durationMs = data.phase === 'numbers' ? 5000 : data.phase === 'tokens' ? 6000 : 0;
            handleUpdate({
                puzzle_id: 8, round: 1, token_numbers: numbers,
                phase_duration_ms: durationMs, phase_remaining_ms: durationMs, ...data
            });
        };
        window.puzzle8Debug = {
            clear() { update({ clear: true }); },
            numbers() { update({ phase: 'numbers' }); },
            tokens() { update({ phase: 'tokens', symbol_sets: symbolSets }); },
            input() { update({ phase: 'input', clear: true, symbols }); },
            blackOnly() {
                update({ phase: 'tokens', symbol_sets: symbolSets.map(set => ({
                    symbols: set.symbols,
                    colors: Object.fromEntries(symbols.map(symbol => [symbol, 'black']))
                })) });
            },
            inputUpdate(box = 0, symbol = 'alpha', color = 'red') {
                update({ phase: 'input', input_update: { box, symbol, color } });
            },
            result(success = true) {
                update({ phase: 'input', input_result: {
                    success,
                    box_results: Object.fromEntries(slots.map((_, index) => [index, success]))
                } });
            },
            demoRound1() {
                this.numbers();
                setTimeout(() => this.tokens(), 5000);
                setTimeout(() => this.input(), 11000);
            }
        };
    }

    document.addEventListener('DOMContentLoaded', () => {
        resetAnswers();
        installDebugHelpers();
        initSSE();
    });
})();
