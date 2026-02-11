(function() {
    const objectiveEl = document.getElementById('objective-text');
    const errorEl = document.getElementById('error-text');
    const streakEl = document.getElementById('streak');
    const playerBoxes = document.querySelectorAll('.player-box');
    const playersSection = document.getElementById('players-section');
    const errorSection = document.getElementById('error-section');
    
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

    function showCountdownMessage(message, waitingSeconds) {
        console.log('[P5] Showing countdown message:', message, waitingSeconds);
        playersSection.style.display = 'none';
        errorSection.style.display = 'none';

        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }

        const baseMessage = (message || '').replace(/\d+\s*segundos?/, '').trim() || message || '';
        console.log('[P5] Base message for countdown:', baseMessage);


        // Legacy: relative countdown (fallback)
        if (waitingSeconds && waitingSeconds > 0) {
            let remaining = waitingSeconds;
            objectiveEl.textContent = `${baseMessage} ${remaining} segundo${remaining !== 1 ? 's' : ''}`;
            console.log('[P5] Starting countdown from:', remaining);
            countdownInterval = setInterval(() => {
                remaining = Math.max(0, remaining - 1);
                if (remaining > 0) {
                    objectiveEl.textContent = `${baseMessage} ${remaining} segundo${remaining !== 1 ? 's' : ''}`;
                    // Play beep each second during countdown
                    playSound(BEEP_COUNTDOWN_SOUND_URL);
                } else {
                    clearInterval(countdownInterval);
                    countdownInterval = null;
                }
            }, 1000);
        } else {
            objectiveEl.textContent = message;
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

        // Show boxes and error counter
        playersSection.style.display = 'flex';
        errorSection.style.display = 'block';
        // Update objective text
        if (round && roundObjectives) {
            objectiveEl.textContent = `OBJETIVO: ${roundObjectives} sec`;
        }
    }

    function updateStreak(round) {
        if (streakEl && round) {
            streakEl.textContent = `${round}/3`;
        }
    }

    function updateErrorCounter(total, limit, result) {
        if (errorEl) {
            errorEl.textContent = `Total Error Acumulado: ${total.toFixed(1)} sec / ${limit} sec`;
            
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
            box.classList.remove('filled');
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
                    
                    const timeEl = box.querySelector('.box-time');
                    if (timeEl) {
                        // Display objective + error time
                        const totalTime = objective + item.time;
                        timeEl.textContent = `${totalTime.toFixed(1)} sec`;
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
        // show a generic waiting message (avoid being stuck silently).
        if (d.waiting && !d.active_round && !d.countdown_message && (d.round === 0 || d.round === undefined)) {
            return;
        }

        // Handle countdown message - ALWAYS hide boxes during countdown
        if (d.countdown_message) {
            // Clear boxes and colors first if we had a result
            if (lastRoundResult) {
                playerBoxes.forEach(box => {
                    box.classList.remove('filled');
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
            
            // NOW hide boxes and show countdown
            showCountdownMessage(d.countdown_message, d.waiting_seconds);
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
            // Start Puzzle 2 when SSE is connected
            fetch("/start_puzzle/5", { method: "POST" })
                .catch(err => console.warn("Failed to start puzzle 5:", err));
        };
        es.onerror = () => console.error('[P5] SSE error');
        
    }

    document.addEventListener('DOMContentLoaded', initSSE);

    // Clean up interval on page unload
    window.addEventListener('beforeunload', () => {
        console.log('[P5] Cleaning up before unload');
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }
        console.log('[P5] Cleanup complete');
    });
})();
