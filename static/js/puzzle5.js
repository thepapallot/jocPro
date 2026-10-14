(function() {
    const tr = (key, fallback, values = {}) => window.PyramidLanguage?.t?.('game.' + key, fallback, values) ?? fallback;
    const puzzleShellEl = document.getElementById('puzzle5-shell');
    const objectiveCardEl = document.getElementById('objective-card');
    const briefObjectiveEl = document.getElementById('brief-objective');
    const briefObjectiveValueEl = document.getElementById('brief-objective-value');
    const briefObjectiveUnitEl = document.getElementById('brief-objective-unit');
    const objectiveEl = document.getElementById('objective-text');
    const objectiveSubtextEl = document.getElementById('objective-subtext');
    const errorEl = document.getElementById('error-text');
    const errorLimitTextEl = document.getElementById('error-limit-text');
    const streakEl = document.getElementById('streak');
    const preparationLimitEl = document.getElementById('p5-preparation-limit');
    const exhaustedScreen = document.getElementById('p5-exhausted-screen');
    let attempt = 1;
    let maxAttempts = 10;
    let availablePoints = 100;
    let leaving = false;
    const playerBoxes = document.querySelectorAll('.player-box');
    const playersSection = document.getElementById('players-section');
    const errorSection = document.getElementById('error-section');
    const roundSteps = document.querySelectorAll('.round-step');
    
    const preparationCountdownEl = document.getElementById('p5-countdown-value');
    let solved = false;
    let currentRound = 0;
    let countdownInterval = null;
    let roundObjectives = 30;
    let roundLimits = 10;
    let lastRoundResult = null;  // Track if we just showed a result
    let snapshotPending = false;
    let activeCountdownDeadlineMs = null;

    // Sound helpers and URLs
    function playSound(url) {
        const audio = new Audio(url);
        audio.play().catch(err => console.warn("Audio play failed:", err));
    }
    const BTN_SOUND_URL = "/static/audios/effects/boto.wav";
    const ROUND_OK_SOUND_URL = "/static/audios/effects/fase_completada.wav";
    const ROUND_KO_SOUND_URL = "/static/audios/effects/fase_nocompletada.wav";
    function setDisplayMode(mode = 'play') {
        const isCountdown = mode === 'countdown';
        if (puzzleShellEl) {
            puzzleShellEl.classList.toggle('is-countdown', isCountdown);
        }
        if (objectiveCardEl) {
            objectiveCardEl.classList.toggle('is-countdown', isCountdown);
        }
        if (briefObjectiveEl) {
            briefObjectiveEl.classList.toggle('is-hidden', isCountdown);
        }
    }

    function setObjectiveValue(value, unit = 's') {
        if (objectiveEl) {
            objectiveEl.textContent = String(value);
        }
        if (objectiveSubtextEl) {
            objectiveSubtextEl.textContent = unit === 'segundos' ? tr('seconds', unit) : unit;
        }
        if (briefObjectiveValueEl && value !== '') {
            briefObjectiveValueEl.textContent = `${value}`;
        }
        if (briefObjectiveUnitEl) {
            briefObjectiveUnitEl.textContent = unit === 'segundos' ? 's' : unit;
        }
    }

    function clearCountdown(preserveSound = false) {
        if (!preserveSound) window.PyramidCountdownAudio?.reset('p5-preparation');
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        activeCountdownDeadlineMs = null;
    }

    function computeRemainingSeconds(waitingSeconds) {
        if (activeCountdownDeadlineMs) {
            return Math.max(0, Math.ceil((activeCountdownDeadlineMs - Date.now()) / 1000));
        }

        const numericWaitingSeconds = Number(waitingSeconds);
        if (Number.isFinite(numericWaitingSeconds)) {
            return Math.max(0, Math.ceil(numericWaitingSeconds));
        }

        return Math.max(0, Number(waitingSeconds) || 0);
    }

    function showCountdownMessage(message, waitingSeconds, deadline) {
        playersSection.style.display = 'none';
        errorSection.style.display = 'none';
        setDisplayMode('countdown');
        clearCountdown(true);
        setObjectiveValue(roundObjectives || '—', 'segundos');
        const deadlineMs = Number(deadline) * 1000;
        const duration = Math.max(0, Number(waitingSeconds) || 0);
        activeCountdownDeadlineMs = Number.isFinite(deadlineMs) && deadlineMs > 0
            ? deadlineMs : Date.now() + duration * 1000;
        const tick = () => {
            const remaining = computeRemainingSeconds();
            preparationCountdownEl.textContent = remaining > 0 ? `${remaining} s` : '…';
            window.PyramidCountdownAudio?.tick('p5-preparation', remaining);
            // Finishing preparation does not tell players to count: each terminal gives its own signal.
            if (remaining === 0) clearCountdown();
        };
        tick();
        if (activeCountdownDeadlineMs) countdownInterval = setInterval(tick, 100);
    }

    function showGameUI(round) {

        // Clear any countdown interval
        clearCountdown();
        setDisplayMode('play');

        // Show boxes and error counter
        playersSection.style.display = 'grid';
        errorSection.style.display = 'block';
        // Update objective text
        if (round && roundObjectives) {
            setObjectiveValue(roundObjectives, 's');
        }
    }

    function showWaitingState({ objective = roundObjectives, message = null,
        waitingSeconds = null, deadline = null } = {}) {
        if (objective) roundObjectives = objective;
        showCountdownMessage(message, waitingSeconds, deadline);
    }

    function updateStreak(round) {
        if (streakEl) {
            streakEl.textContent = tr('chronoAttemptPoints',
                `INTENTO ${attempt}/${maxAttempts} · ${availablePoints} PUNTOS EN JUEGO`,
                {attempt, limit: maxAttempts, points: availablePoints});
        }
        roundSteps.forEach(step => {
            const stepRound = Number(step.dataset.roundStep);
            step.classList.remove('is-current', 'is-complete');
            if (round > stepRound) {
                step.classList.add('is-complete');
            } else if (round === stepRound) {
                step.classList.add('is-current');
            }
        });
    }

    function updateErrorCounter(total, limit, result) {
        if (errorEl) {
            errorEl.textContent = `${total.toFixed(1)} / ${limit}`;
            
            // Remove any previous result classes
            errorEl.classList.remove('success-result', 'failure-result');
            
            // Add result class if provided
            if (result === 'success') {
                errorEl.classList.add('success-result');
            } else if (result === 'failure') {
                errorEl.classList.add('failure-result');
            }
        }

        if (errorLimitTextEl) {
            const numericLimit = Number(limit);
            if (Number.isFinite(numericLimit)) {
                errorLimitTextEl.textContent = `${numericLimit.toFixed(0)} S`;
            }
        }
    }

    function resolvePhaseLimit(explicitLimit = null) {
        const numericExplicit = Number(explicitLimit);
        if (Number.isFinite(numericExplicit) && numericExplicit > 0) {
            return numericExplicit;
        }

        const knownCurrentLimit = Number(roundLimits);
        return Number.isFinite(knownCurrentLimit) && knownCurrentLimit > 0 ? knownCurrentLimit : 10;
    }

    function refreshPhaseLimitLabel(explicitLimit = null) {
        if (!errorLimitTextEl) {
            return;
        }
        const limit = resolvePhaseLimit(explicitLimit);
        errorLimitTextEl.textContent = `${limit.toFixed(0)} S`;
        if (preparationLimitEl) preparationLimitEl.textContent = `${limit.toFixed(0)} S`;
    }

    function updatePlayerBoxes(times) {
        const objective = roundObjectives || 30;
        
        // Reset all boxes
        playerBoxes.forEach(box => {
            box.classList.remove('filled', 'error-positive', 'error-negative');
            const timeEl = box.querySelector('.box-time');
            if (timeEl) {
                timeEl.textContent = '';
            }
            const errorEl = box.querySelector('.box-error');
            if (errorEl) {
                errorEl.textContent = '';
            }
        });
        
        // Fill boxes for players who submitted times
        if (Array.isArray(times)) {
            times.forEach(item => {
                const playerIndex = item.player;
                if (playerIndex >= 0 && playerIndex < playerBoxes.length) {
                    const box = playerBoxes[playerIndex];
                    box.classList.add('filled');
                    if (item.time > 0) {
                        box.classList.add('error-positive');
                    } else if (item.time < 0) {
                        box.classList.add('error-negative');
                    }
                    
                    const timeEl = box.querySelector('.box-time');
                    if (timeEl) {
                        // Display objective + error time
                        const totalTime = objective + item.time;
                        timeEl.textContent = `${totalTime.toFixed(1)}`;
                    }

                    const errorEl = box.querySelector('.box-error');
                    if (errorEl) {
                        // The shared margin sums absolute errors, so show the
                        // same positive contribution for this terminal.
                        errorEl.textContent = `ERROR: ${Math.abs(item.time).toFixed(1)} S`;
                    }
                }
            });
        }
    }

    function setRoundResultVisual(result = null) {
        playerBoxes.forEach(box => {
            box.classList.remove('result-success', 'result-failure');
            if (result === 'success') {
                box.classList.add('result-success');
            } else if (result === 'failure') {
                box.classList.add('result-failure');
            }
        });
    }

    function handleUpdate(d,func) {
        if (window.PyramidLevelVictory?.active) return;
        if (!d || d.puzzle_id !== 5) return;

        if (Number.isInteger(d.attempt)) attempt = d.attempt;
        if (Number.isInteger(d.max_attempts)) maxAttempts = d.max_attempts;
        if (Number.isInteger(d.available_points)) availablePoints = d.available_points;
        const limit = Number(d.limit);
        if (Number.isFinite(limit) && limit > 0) roundLimits = limit;
        refreshPhaseLimitLabel();
        updateStreak(currentRound);

        // Results remain on the board until the backend publishes exhaustion.
        // No local timer, victory or progress is authorized by a failed attempt.
        if (d.puzzle_exhausted) {
            clearCountdown();
            puzzleShellEl.style.display = 'none';
            exhaustedScreen.hidden = false;
            document.getElementById('p5-exhausted-score').textContent = tr('memoryExhaustedScore',
                `${attempt} intentos · 0 puntos`, {attempt});
            if (d.auto_advance) advanceAfterExhaustion();
            return;
        }
        exhaustedScreen.hidden = true;
        puzzleShellEl.style.display = '';

        // If backend snapshot says we're waiting but didn't include countdown_message,
        // rebuild the best possible UI instead of staying blank.
        if (d.waiting && !d.active_round && !d.countdown_message && !d.round_result && (d.round === 0 || d.round === undefined)) {
            currentRound = 0;
            roundObjectives = d.objective || roundObjectives;
            roundLimits = d.limit || roundLimits;
            refreshPhaseLimitLabel(d.limit);
            updateStreak(1);
            showWaitingState({
                objective: roundObjectives,
                message: d.countdown_message,
                waitingSeconds: d.waiting_seconds,
                deadline: d.countdown_deadline
            });
            return;
        }

        if (d.waiting && !d.active_round && !d.countdown_message && !d.round_result && d.round) {
            currentRound = d.round;
            roundLimits = d.limit || roundLimits;
            roundObjectives = d.objective || roundObjectives;
            refreshPhaseLimitLabel(d.limit);
            updateStreak(d.round);

            if (Array.isArray(d.times) && d.times.length && !(Number(d.waiting_seconds) > 0 || Number(d.countdown_deadline) * 1000 > Date.now())) {
                showGameUI(d.round);
                updatePlayerBoxes(d.times);
                if (d.total !== undefined && d.limit !== undefined) {
                    updateErrorCounter(d.total, d.limit);
                }
            } else {
                showWaitingState({
                    objective: roundObjectives,
                    message: d.countdown_message,
                    waitingSeconds: d.waiting_seconds,
                    deadline: d.countdown_deadline
                });
            }
            return;
        }

        // Handle countdown message - ALWAYS hide boxes during countdown
        if (d.countdown_message) {
            // Clear boxes and colors first if we had a result
            if (lastRoundResult) {
                playerBoxes.forEach(box => {
                    box.classList.remove('filled', 'error-positive', 'error-negative', 'result-success', 'result-failure');
                    const timeEl = box.querySelector('.box-time');
                    if (timeEl) {
                        timeEl.textContent = '';
                    }
                });
                
                if (errorEl) {
                    errorEl.classList.remove('success-result', 'failure-result');
                }
                
                lastRoundResult = null;
            }
            
            roundObjectives = d.objective || roundObjectives;
            refreshPhaseLimitLabel(d.limit);
            showCountdownMessage(d.countdown_message, d.waiting_seconds, d.countdown_deadline);

            return;
        }

        // Update round and show game UI
        if (d.round_start || d.round) {
            currentRound = d.round;
            roundLimits = d.limit || roundLimits;
            roundObjectives = d.objective || roundObjectives;
            refreshPhaseLimitLabel(d.limit);
            setRoundResultVisual(null);
            showGameUI(d.round);
            updateStreak(d.round);
            // Update error counter limit when round changes
            if (d.limit !== undefined) {
                updateErrorCounter(0, d.limit);
            }
        }

        // Update error counter
        if (d.total !== undefined && d.limit !== undefined && !d.round_result) {
            updateErrorCounter(d.total, d.limit);
        }

        // Play boto.wav for each player_time event
        if (d.player_time) {
            playSound(BTN_SOUND_URL);
        }

        // Update player boxes
        if (d.times) {
            updatePlayerBoxes(d.times);
        }

        // Handle round result with color feedback and sound
        if (d.round_result) {
            const rr = d.round_result;
            const result = rr.success ? 'success' : 'failure';
            const repeatResult = lastRoundResult === `${attempt}:${result}`;
            lastRoundResult = `${attempt}:${result}`;
            showGameUI(d.round || 1);
            roundLimits = resolvePhaseLimit(rr.limit);
            refreshPhaseLimitLabel();
            updateErrorCounter(rr.total, rr.limit, result);
            setRoundResultVisual(result);
            // Play corresponding round result sound
            if (func !== 'loadSnapshot' && !repeatResult) {
                playSound(rr.success ? ROUND_OK_SOUND_URL : ROUND_KO_SOUND_URL);
            }
        }

        // Puzzle solved
        if (d.puzzle_solved && !solved) {
            solved = true;
            if (countdownInterval) clearCountdown();
            window.PyramidLevelVictory.complete(5);
        }
    }

    function advanceAfterExhaustion() {
        const nextId = window.NEXT_PUZZLE_ID ?? window.PYRAMID_GAME?.finalId;
        if (leaving || !Number.isInteger(nextId)) return;
        const path = '/presentacio/' + nextId;
        const language = window.PyramidLanguage?.current?.() || window.PYRAMID_GAME?.language || 'es';
        const url = window.PyramidLanguage?.path?.(path, language) || path + '?lang=' + encodeURIComponent(language);
        leaving = true;
        window.location.assign(url);
    }

    function installDebugHelpers() {
        function getDebugObjective() {
            return 30;
        }

        function getDebugLimit(attempt) {
            return 10 + 4 * (attempt - 1);
        }

        function debugState(attempt = 1) {
            return {round: 1, total_rounds: 1, objective: 30,
                attempt, max_attempts: 10, available_points: 100 - 10 * (attempt - 1),
                total_points: 0, puzzle_exhausted: false, auto_advance: false,
                limit: getDebugLimit(attempt)};
        }

        window.puzzle5Debug = {
            push(payload) {
                handleUpdate({ puzzle_id: 5, ...payload }, 'debug');
            },
            countdown(seconds = 5, objective = null, round = 1) {
                handleUpdate({
                    puzzle_id: 5,
                    ...debugState(round),
                    countdown_message: `Ronda ${round} empieza en ${seconds} segundos`,
                    waiting_seconds: seconds,
                    objective: objective ?? getDebugObjective(round),
                    total_rounds: 1
                }, 'debug-countdown');
            },
            round(round = 1, objective = null, limit = null) {
                handleUpdate({
                    puzzle_id: 5,
                    ...debugState(round),
                    round_start: true,
                    objective: objective ?? getDebugObjective(round),
                    limit: limit ?? getDebugLimit(round),
                    total_rounds: 1,
                    times: [], total: 0
                }, 'debug-round');
            },
            partial(times, round = 1, objective = null, limit = null) {
                const total = (times || []).reduce((acc, item) => acc + Math.abs(item.time), 0);
                handleUpdate({
                    puzzle_id: 5,
                    ...debugState(round),
                    objective: objective ?? getDebugObjective(round),
                    limit: limit ?? getDebugLimit(round),
                    total_rounds: 1,
                    times,
                    total
                }, 'debug-partial');
            },
            success(round = 1, total = 7.5, limit = null) {
                handleUpdate({
                    puzzle_id: 5,
                    ...debugState(round),
                    total_points: 100 - 10 * (round - 1),
                    round_result: {
                        success: true,
                        total,
                        limit: limit ?? getDebugLimit(round)
                    }
                }, 'debug-success');
            },
            failure(round = 1, total = 38.1, limit = null) {
                handleUpdate({
                    puzzle_id: 5,
                    ...debugState(round),
                    round_result: {
                        success: false,
                        total,
                        limit: limit ?? getDebugLimit(round)
                    }
                }, 'debug-failure');
            },
            exhausted(autoAdvance = false) {
                this.push({...debugState(10), puzzle_exhausted: true,
                    available_points: 0, total_points: 0, auto_advance: autoAdvance});
            },
            solved() {
                const previousSolved = solved;
                solved = false;
                handleUpdate({
                    puzzle_id: 5,
                    puzzle_solved: true
                }, 'debug-solved');
                solved = previousSolved;
            },
            demoSuccess() {
                const times = [
                    { player: 0, time: -0.7 },
                    { player: 1, time: 1.2 },
                    { player: 2, time: 0.4 },
                    { player: 3, time: -1.1 },
                    { player: 4, time: 0.6 },
                    { player: 5, time: 0.8 },
                    { player: 6, time: -0.5 },
                    { player: 7, time: 1.0 },
                    { player: 8, time: -0.9 },
                    { player: 9, time: 0.3 }
                ];
                this.countdown();
                setTimeout(() => this.round(), 5000);
                setTimeout(() => this.partial(times.slice(0, 5)), 6500);
                setTimeout(() => this.partial(times), 8500);
                setTimeout(() => this.success(), 10500);
            },
            demoFailure() {
                const times = [
                    { player: 0, time: 5.4 },
                    { player: 1, time: -4.2 },
                    { player: 2, time: 3.7 },
                    { player: 3, time: -2.9 },
                    { player: 4, time: 4.6 },
                    { player: 5, time: -3.8 },
                    { player: 6, time: 2.7 },
                    { player: 7, time: -4.9 },
                    { player: 8, time: 3.1 },
                    { player: 9, time: -2.8 }
                ];
                this.countdown();
                setTimeout(() => this.round(), 5000);
                setTimeout(() => this.partial(times), 7000);
                setTimeout(() => this.failure(), 9000);
                setTimeout(() => this.countdown(9, 30, 2), 14000);
            }
        };
    }

    function loadSnapshot() {
        if (snapshotPending) return;
        snapshotPending = true;

        return fetch('/current_state')
            .then(r => r.json())
            .then(d => handleUpdate(d,'loadSnapshot'))
            .catch(e => console.error('[P5] Snapshot load error:', e))
            .finally(() => { snapshotPending = false; });
    }

    function initSSE() {
        const es = new EventSource('/state_stream');
        es.onmessage = evt => { 
            try { 
                handleUpdate(JSON.parse(evt.data),'SSE'); 
            } catch(e) {
                console.error('[P5] SSE parse error:', e);
            } 
        };
        es.onopen = () => {
            // Start is idempotent. Recover state after it, on every reconnection.
            fetch("/start_puzzle/5", { method: "POST" })
                .then(() => loadSnapshot())
                .catch(err => console.warn("Failed to start puzzle 5:", err));
        };
        es.onerror = () => console.error('[P5] SSE error');
        
    }

    document.addEventListener('DOMContentLoaded', () => {
        updateStreak(1);
        setDisplayMode('countdown');
        playersSection.style.display = 'none';
        errorSection.style.display = 'none';
        installDebugHelpers();
        initSSE();
    });

    // Clean up interval on page unload
    window.addEventListener('beforeunload', () => {
        clearCountdown();
    });
})();
