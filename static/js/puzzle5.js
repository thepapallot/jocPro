(function() {
    const objectiveCardEl = document.getElementById('objective-card');
    const briefObjectiveEl = document.getElementById('brief-objective');
    const briefObjectiveValueEl = document.getElementById('brief-objective-value');
    const briefObjectiveUnitEl = document.getElementById('brief-objective-unit');
    const objectiveEl = document.getElementById('objective-text');
    const objectiveSubtextEl = document.getElementById('objective-subtext');
    const errorEl = document.getElementById('error-text');
    const streakEl = document.getElementById('streak');
    const playerBoxes = document.querySelectorAll('.player-box');
    const playersSection = document.getElementById('players-section');
    const errorSection = document.getElementById('error-section');
    const roundSteps = document.querySelectorAll('.round-step');
    
    let solved = false;
    let currentRound = 0;
    let countdownInterval = null;
    let roundObjectives = 0;
    let roundLimits = 0;
    let lastRoundResult = null;  // Track if we just showed a result
    let snapshotRequested = false; // NEW: prevent double fetch on initial load

    // Sound helpers and URLs
    function playSound(url) {
        const audio = new Audio(url);
        audio.play().catch(err => console.warn("Audio play failed:", err));
    }
    const BTN_SOUND_URL = "/static/audios/effects/boto.wav";
    const ROUND_OK_SOUND_URL = "/static/audios/effects/fase_completada.wav";
    const ROUND_KO_SOUND_URL = "/static/audios/effects/fase_nocompletada.wav";
    const PUZZLE_COMPLETE_SOUND_URL = "/static/audios/effects/nivel_completado.wav";
    const BEEP_COUNTDOWN_SOUND_URL = "/static/audios/effects/beep_countdown.wav"; // NEW
    let objectivePulseTimeout = null;

    function setDisplayMode(mode = 'play') {
        if (!objectiveCardEl) return;
        objectiveCardEl.classList.toggle('is-countdown', mode === 'countdown');
        if (briefObjectiveEl) {
            briefObjectiveEl.classList.toggle('is-hidden', mode === 'countdown');
        }
    }

    function setObjectiveValue(value, unit = 'sec') {
        if (objectiveEl) {
            objectiveEl.textContent = String(value);
        }
        if (objectiveSubtextEl) {
            objectiveSubtextEl.textContent = unit;
        }
        if (briefObjectiveValueEl && value !== '') {
            briefObjectiveValueEl.textContent = `${value}`;
        }
        if (briefObjectiveUnitEl) {
            briefObjectiveUnitEl.textContent = unit ? unit.toUpperCase() : '';
        }
    }

    function pulseObjective() {
        if (!briefObjectiveEl) return;
        briefObjectiveEl.classList.remove('is-updating');
        void briefObjectiveEl.offsetWidth;
        briefObjectiveEl.classList.add('is-updating');

        if (objectivePulseTimeout) {
            clearTimeout(objectivePulseTimeout);
        }

        objectivePulseTimeout = setTimeout(() => {
            briefObjectiveEl.classList.remove('is-updating');
            objectivePulseTimeout = null;
        }, 560);
    }

    function showCountdownMessage(message, waitingSeconds) {
        console.log('[P5] Showing countdown message:', message, waitingSeconds);
        playersSection.style.display = 'none';
        errorSection.style.display = 'none';
        setDisplayMode('countdown');

        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }

        const baseMessage = (message || '').replace(/\d+\s*segundos?/, '').trim() || message || '';
        console.log('[P5] Base message for countdown:', baseMessage);


        // Legacy: relative countdown (fallback)
        if (waitingSeconds && waitingSeconds > 0) {
            let remaining = waitingSeconds;
            setObjectiveValue(remaining, '');
            console.log('[P5] Starting countdown from:', remaining);
            countdownInterval = setInterval(() => {
                remaining = Math.max(0, remaining - 1);
                if (remaining > 0) {
                    setObjectiveValue(remaining, '');
                    // Play beep each second during countdown
                    playSound(BEEP_COUNTDOWN_SOUND_URL);
                } else {
                    clearInterval(countdownInterval);
                    countdownInterval = null;
                }
            }, 1000);
        } else {
            setObjectiveValue('', '');
        }
        console.log('[P5] Countdown message set:', objectiveEl.textContent);
    }

    function showGameUI(round) {

        // Clear any countdown interval
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        console.log('[P5] Showing game UI for round:', round);
        console.log('[P5] Round objectives:', roundObjectives);
        console .log('[P5] Round limits:', roundLimits);
        setDisplayMode('play');

        // Show boxes and error counter
        playersSection.style.display = 'grid';
        errorSection.style.display = 'block';
        // Update objective text
        if (round && roundObjectives) {
            setObjectiveValue(roundObjectives, 'sec');
        }
    }

    function showObjectiveText(objective) {
        if (objective !== undefined && objective !== null) {
            const hasChanged = roundObjectives !== objective;
            roundObjectives = objective; // update local state
            if (hasChanged) {
                pulseObjective();
            }
        }
        setObjectiveValue(roundObjectives, 'sec');
    }

    function showWaitingState({
        objective = roundObjectives || 10,
        message = null,
        subtext = 'sec'
    } = {}) {
        setDisplayMode('play');
        showObjectiveText(objective);
        if (message !== null) {
            setObjectiveValue(message, subtext);
        }
        playersSection.style.display = 'none';
        errorSection.style.display = 'none';
    }

    function updateStreak(round) {
        if (streakEl && round) {
            streakEl.textContent = `${round}/3`;
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
    }

    function updatePlayerBoxes(times) {
        const objective = roundObjectives || 10;
        
        // Reset all boxes
        playerBoxes.forEach(box => {
            box.classList.remove('filled', 'error-positive', 'error-negative');
            const timeEl = box.querySelector('.box-time');
            if (timeEl) {
                timeEl.textContent = '';
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
                }
            });
        }
    }

    function handleUpdate(d,func) {
        console.log('Pre handleUpdate called from:', func);
        if (!d || d.puzzle_id !== 5) return;

        console.log('[P5] handleUpdate received:', d);

        // If backend snapshot says we're waiting but didn't include countdown_message,
        // rebuild the best possible UI instead of staying blank.
        if (d.waiting && !d.active_round && !d.countdown_message && (d.round === 0 || d.round === undefined)) {
            currentRound = 0;
            roundObjectives = d.objective || roundObjectives || 10;
            roundLimits = d.limit || roundLimits;
            updateStreak(1);
            showWaitingState({
                objective: roundObjectives
            });
            return;
        }

        if (d.waiting && !d.active_round && !d.countdown_message && d.round) {
            currentRound = d.round;
            roundLimits = d.limit || roundLimits;
            roundObjectives = d.objective || roundObjectives;
            updateStreak(d.round);

            if (Array.isArray(d.times) && d.times.length) {
                showGameUI(d.round);
                updatePlayerBoxes(d.times);
                if (d.total !== undefined && d.limit !== undefined) {
                    updateErrorCounter(d.total, d.limit);
                }
            } else {
                showWaitingState({
                    objective: roundObjectives
                });
            }
            return;
        }

        // Handle countdown message - ALWAYS hide boxes during countdown
        if (d.countdown_message) {
            // Clear boxes and colors first if we had a result
            if (lastRoundResult) {
                playerBoxes.forEach(box => {
                    box.classList.remove('filled', 'error-positive', 'error-negative');
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
            
            showObjectiveText(d.objective);  // show objective before countdown

            setDisplayMode('countdown');
            playersSection.style.display = 'none';
            errorSection.style.display = 'none';
            if (countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }

            if (d.waiting_seconds && d.waiting_seconds > 0) {
                let remaining = d.waiting_seconds;
                setObjectiveValue(remaining, '');
                countdownInterval = setInterval(() => {
                    remaining = Math.max(0, remaining - 1);
                    if (remaining > 0) {
                        setObjectiveValue(remaining, '');
                        playSound(BEEP_COUNTDOWN_SOUND_URL);
                    } else {
                        clearInterval(countdownInterval);
                        countdownInterval = null;
                    }
                }, 1000);
            } else {
                setObjectiveValue('', '');
            }

            return;
        }

        // Update round and show game UI
        if (d.round_start || d.round) {
            currentRound = d.round;
            roundLimits = d.limit || roundLimits;
            roundObjectives = d.objective || roundObjectives;
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
            lastRoundResult = result;  // Remember we showed a result
            updateErrorCounter(rr.total, rr.limit, result);
            // Play corresponding round result sound
            if (rr.success) {
                playSound(ROUND_OK_SOUND_URL);
            } else {
                playSound(ROUND_KO_SOUND_URL);
            }
        }

        // Puzzle solved
        if (d.puzzle_solved && !solved) {
            solved = true;
            // Play final puzzle completion sound
            playSound(PUZZLE_COMPLETE_SOUND_URL);
            if (countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }
            setTimeout(() => window.location.href = '/puzzleSuperat/5', 3000);
        }
    }

    function installDebugHelpers() {
        window.puzzle5Debug = {
            push(payload) {
                handleUpdate({ puzzle_id: 5, ...payload }, 'debug');
            },
            countdown(seconds = 5, objective = 10, round = 1) {
                handleUpdate({
                    puzzle_id: 5,
                    countdown_message: `Ronda ${round} empieza en ${seconds} segundos`,
                    waiting_seconds: seconds,
                    objective
                }, 'debug-countdown');
            },
            round(round = 1, objective = 10, limit = 20) {
                handleUpdate({
                    puzzle_id: 5,
                    round,
                    round_start: true,
                    objective,
                    limit
                }, 'debug-round');
            },
            partial(times, round = 1, objective = 10, limit = 20) {
                const total = (times || []).reduce((acc, item) => acc + Math.abs(item.time), 0);
                handleUpdate({
                    puzzle_id: 5,
                    round,
                    objective,
                    limit,
                    times,
                    total
                }, 'debug-partial');
            },
            success(round = 1, total = 7.5, limit = 20) {
                handleUpdate({
                    puzzle_id: 5,
                    round_result: {
                        success: true,
                        total,
                        limit
                    }
                }, 'debug-success');
            },
            failure(round = 1, total = 38.1, limit = 30) {
                handleUpdate({
                    puzzle_id: 5,
                    round_result: {
                        success: false,
                        total,
                        limit
                    }
                }, 'debug-failure');
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
                this.countdown(3, 10, 1);
                setTimeout(() => this.round(1, 10, 20), 3200);
                setTimeout(() => this.partial(times.slice(0, 5), 1, 10, 20), 4800);
                setTimeout(() => this.partial(times, 1, 10, 20), 6800);
                setTimeout(() => this.success(1, 7.5, 20), 8600);
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
                this.countdown(3, 30, 2);
                setTimeout(() => this.round(2, 30, 30), 3200);
                setTimeout(() => this.partial(times, 2, 30, 30), 5400);
                setTimeout(() => this.failure(2, 38.1, 30), 7600);
            }
        };
    }

    function loadSnapshot(func) {
        console.log('[P5] Loading snapshot from server:', func);

        if (snapshotRequested) return;
        snapshotRequested = true;

        console.log('[P5] Fetching current state snapshot');

        fetch('/current_state')
            .then(r => r.json())
            .then(d => handleUpdate(d,'loadSnapshot'))
            .catch((e) => console.error('[P5] Snapshot load error:', e));
            
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
            loadSnapshot('SSE-open');
            // Start puzzle 5 when SSE is connected
            fetch("/start_puzzle/5", { method: "POST" })
                .then(() => loadSnapshot('start_puzzle/5'))
                .catch(err => console.warn("Failed to start puzzle 5:", err));
        };
        es.onerror = () => console.error('[P5] SSE error');
        
    }

    document.addEventListener('DOMContentLoaded', () => {
        setDisplayMode('play');
        installDebugHelpers();
        loadSnapshot('DOMContentLoaded');
        initSSE();
    });

    // Clean up interval on page unload
    window.addEventListener('beforeunload', () => {
        console.log('[P5] Cleaning up before unload');
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }
        if (objectivePulseTimeout) {
            clearTimeout(objectivePulseTimeout);
        }
        console.log('[P5] Cleanup complete');
    });
})();
