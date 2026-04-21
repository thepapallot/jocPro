(function() {
    const countdownEl = document.getElementById('countdown');
    const messageEl = document.getElementById('message');
    const statusBadgeEl = document.getElementById('status-badge');
    const trackerPanelEl = document.getElementById('tracker-panel');
    const shellEl = document.getElementById('puzzle6-shell');
    const DEFAULT_MESSAGE = 'Alinea cada token con su color antes de que desaparezca.';
    const WAITING_MESSAGE = 'Esperando sincronizacion del sistema.';

    let solved = false;
    let active = false;
    let endTime = null;
    let countdownTimer = null;
    let resetTimer = null;

    // Sound helper and URLs
    function playSound(url, options = {}) {
        const audio = new Audio(url);
        if (typeof options.playbackRate === 'number') {
            audio.playbackRate = options.playbackRate;
        }
        if (typeof options.volume === 'number') {
            audio.volume = options.volume;
        }
        audio.play().catch(err => console.warn("Audio play failed:", err));
    }
    const PHASE_KO_SOUND_URL = "/static/audios/effects/fase_nocompletada.wav";
    const PUZZLE_COMPLETE_SOUND_URL = "/static/audios/effects/nivel_completado.wav";
    const BTN_SOUND_URL = "/static/audios/effects/beep_countdown.wav"; // NEW

    function clearTimers() {
        clearInterval(countdownTimer);
        clearInterval(resetTimer);
        countdownTimer = null;
        resetTimer = null;
    }

    function setMessage(text = DEFAULT_MESSAGE, isFailure = false) {
        if (!messageEl) return;
        messageEl.textContent = text;
        messageEl.classList.toggle('failure', Boolean(isFailure));
    }

    function setStatusBadge(state = 'active', text = null) {
        if (!statusBadgeEl) return;
        statusBadgeEl.classList.remove('failure', 'solved');
        if (state === 'failure') {
            statusBadgeEl.classList.add('failure');
        } else if (state === 'solved') {
            statusBadgeEl.classList.add('solved');
        }
        statusBadgeEl.textContent = text || (state === 'failure' ? 'Recargando' : state === 'solved' ? 'Completado' : 'Activa');
    }

    function setTrackerState(state = 'active') {
        if (!trackerPanelEl) return;
        trackerPanelEl.classList.remove('is-active', 'is-failure', 'is-solved', 'is-waiting');
        trackerPanelEl.classList.add(`is-${state}`);
    }

    function setUrgency(remainingSeconds = null) {
        if (!shellEl) return;
        shellEl.classList.remove('time-warning', 'time-low', 'time-critical');
        if (remainingSeconds == null || remainingSeconds > 30) return;
        if (remainingSeconds <= 10) {
            shellEl.classList.add('time-critical');
            return;
        }
        if (remainingSeconds <= 18) {
            shellEl.classList.add('time-low');
            return;
        }
        shellEl.classList.add('time-warning');
    }

    function triggerBurst(type) {
        if (!shellEl) return;
        const className = type === 'error' ? 'is-error-burst' : 'is-solved-burst';
        shellEl.classList.remove(className);
        void shellEl.offsetWidth;
        shellEl.classList.add(className);
        setTimeout(() => {
            shellEl.classList.remove(className);
        }, type === 'error' ? 1100 : 1700);
    }

    function triggerTickPulse(remainingSeconds) {
        if (!shellEl) return;
        shellEl.classList.remove('tick-pulse', 'tick-pulse-warning', 'tick-pulse-low', 'tick-pulse-critical');
        void shellEl.offsetWidth;
        shellEl.classList.add('tick-pulse');
        if (remainingSeconds <= 10) {
            shellEl.classList.add('tick-pulse-critical');
        } else if (remainingSeconds <= 18) {
            shellEl.classList.add('tick-pulse-low');
        } else if (remainingSeconds <= 30) {
            shellEl.classList.add('tick-pulse-warning');
        }
    }

    function playCountdownBeep(remainingSeconds) {
        let playbackRate = 1;
        let volume = 0.28;

        if (remainingSeconds <= 30) {
            playbackRate = 1.04;
            volume = 0.32;
        }
        if (remainingSeconds <= 18) {
            playbackRate = 1.1;
            volume = 0.36;
        }
        if (remainingSeconds <= 10) {
            playbackRate = 1.16;
            volume = 0.42;
        }
        if (remainingSeconds <= 5) {
            playbackRate = 1.24;
            volume = 0.5;
        }

        playSound(BTN_SOUND_URL, { playbackRate, volume });
    }

    function format(sec) {
        if (sec < 0) sec = 0;
        return String(sec);
    }

    function startLocalCountdown(remainingSeconds) {
        clearTimers();
        active = true;
        solved = false;
        setMessage(DEFAULT_MESSAGE, false);
        countdownEl.classList.remove('failure');  // Remove failure class when starting normal countdown
        countdownEl.classList.remove('expired');
        setStatusBadge('active', 'Activa');
        setTrackerState('active');
        setUrgency(remainingSeconds);
        endTime = Date.now() + Math.max(0, remainingSeconds) * 1000;
        updateCountdown(); // immediate
        countdownTimer = setInterval(updateCountdown, 1000);
    }

    function updateCountdown() {
        if (!active || solved || endTime == null) return;
        const remaining = Math.round((endTime - Date.now()) / 1000);
        countdownEl.textContent = format(remaining);
        setUrgency(remaining);
        triggerTickPulse(remaining);

        // Play boto.wav on each second tick while main countdown is active
        if (remaining > 0) {
            playCountdownBeep(remaining);
        }
        
        // Add expired class when time runs out
        if (remaining <= 0) {
            clearInterval(countdownTimer);
            active = false;
            countdownEl.classList.add('expired');
        }
    }

    function handleReset(waitSeconds, msg) {
        active = false;
        clearTimers();
        // Play KO sound on reset
        playSound(PHASE_KO_SOUND_URL);

        // Show error message
        setMessage(msg, true);

        // Add failure class to make countdown red
        countdownEl.classList.add('failure');
        countdownEl.classList.remove('expired');
        setStatusBadge('failure', 'Recargando');
        setTrackerState('failure');
        setUrgency(null);
        triggerBurst('error');
        
        // Show countdown in the main timer display
        let end = Date.now() + waitSeconds * 1000;
        function tick() {
            const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
            countdownEl.textContent = format(left);
            if (left <= 0) {
                clearInterval(resetTimer);
                resetTimer = null;
                // Remove failure class when countdown ends
                countdownEl.classList.remove('failure');
                setMessage(WAITING_MESSAGE, false);
                setTrackerState('waiting');
                setUrgency(null);
                shellEl?.classList.remove('tick-pulse', 'tick-pulse-warning', 'tick-pulse-low', 'tick-pulse-critical');
            }
        }
        tick();
        resetTimer = setInterval(tick, 500);
    }

    function applySolvedState() {
        solved = true;
        active = false;
        endTime = null;
        clearTimers();
        countdownEl.textContent = '0';
        countdownEl.classList.add('expired');
        countdownEl.classList.remove('failure');
        setMessage('Secuencia completada.', false);
        setStatusBadge('solved', 'Completado');
        setTrackerState('solved');
        setUrgency(null);
        triggerBurst('solved');
        shellEl?.classList.remove('tick-pulse', 'tick-pulse-warning', 'tick-pulse-low', 'tick-pulse-critical');
    }

    function applySnapshot(d) {
        if (d.puzzle_solved) {
            applySolvedState();
            return;
        }
        if (d.restart_pending) {
            const msg = d.last_reset_message || 'Reiniciando...';
            handleReset(d.waiting_seconds || 5, msg);
            return;
        }
        if (d.active) {
            countdownEl.classList.remove('expired');
            setStatusBadge('active', 'Activa');
            startLocalCountdown(d.remaining);
            return;
        }

        active = false;
        endTime = null;
        clearTimers();
        countdownEl.classList.remove('failure', 'expired');
        countdownEl.textContent = format(d.remaining ?? 60);
        setMessage(WAITING_MESSAGE, false);
        setStatusBadge('active', 'En espera');
        setTrackerState('waiting');
        setUrgency(null);
        shellEl?.classList.remove('tick-pulse', 'tick-pulse-warning', 'tick-pulse-low', 'tick-pulse-critical');
    }

    function handleUpdate(d) {
        if (d.puzzle_id !== 6) return;

        console.log('[P6] handleUpdate received:', d);

        if (d.countdown_start) {
            const info = d.countdown_start;
            const serverNow = Date.now();
            const elapsed = Math.max(0, Math.floor(serverNow/1000 - info.start_ts));
            const remaining = info.duration - elapsed;
            startLocalCountdown(remaining);
        }

        if (d.countdown_tick && active && !solved) {
            endTime = Date.now() + Math.max(0, d.countdown_tick.remaining) * 1000;
            countdownEl.textContent = format(d.countdown_tick.remaining);
            setUrgency(d.countdown_tick.remaining);
            // Optional: also play on server ticks (every 10s). Comment out to keep per-second only.
            // playSound(BTN_SOUND_URL);
        }

        if (d.countdown_reset) {
            const r = d.countdown_reset;
            const msg = r.message || `Error: Caja ${r.box} sin energía. Vuelta a empezar en 10 segundos`;
            handleReset(r.waiting_seconds || 10, msg);
        }

        if (d.puzzle_solved && !solved) {
            applySolvedState();
            // Play final puzzle completion sound
            playSound(PUZZLE_COMPLETE_SOUND_URL);
            setTimeout(() => window.location.href = '/final', 3000);
        }
    }

    function installDebugHelpers() {
        window.puzzle6Debug = {
            push(payload) {
                handleUpdate({ puzzle_id: 6, ...payload });
            },
            start(remaining = 60) {
                handleUpdate({
                    puzzle_id: 6,
                    countdown_start: {
                        duration: remaining,
                        start_ts: Math.floor(Date.now() / 1000)
                    }
                });
            },
            tick(remaining = 40) {
                handleUpdate({
                    puzzle_id: 6,
                    countdown_tick: { remaining }
                });
            },
            reset(box = 4, waitingSeconds = 10) {
                handleUpdate({
                    puzzle_id: 6,
                    countdown_reset: {
                        box,
                        message: `Caja Numero ${box} sin energia, cargando sistema...`,
                        waiting_seconds: waitingSeconds
                    }
                });
            },
            solved() {
                const previousSolved = solved;
                solved = false;
                handleUpdate({
                    puzzle_id: 6,
                    puzzle_solved: true
                });
                solved = previousSolved;
            },
            demoActive() {
                this.start(60);
                setTimeout(() => this.tick(45), 1200);
                setTimeout(() => this.tick(30), 2200);
            },
            demoReset() {
                this.start(60);
                setTimeout(() => this.reset(7, 10), 1400);
            },
            demoSolved() {
                this.start(8);
                setTimeout(() => this.tick(4), 1200);
                setTimeout(() => this.solved(), 2400);
            }
        };
    }

    function loadSnapshot() {
        fetch('/current_state')
            .then(r => r.json())
            .then(d => {
                if (d.puzzle_id === 6) applySnapshot(d);
            })
            .catch(() => {});
    }

    function initSSE() {
        const es = new EventSource('/state_stream');
        es.onmessage = evt => {
            try { handleUpdate(JSON.parse(evt.data)); } catch(e) {
                console.error('[P6] SSE error:', e);
            }
        };
        es.onopen = () => {
            // Start Puzzle 6 when SSE is connected
            fetch("/start_puzzle/6", { method: "POST" })
                .catch(err => console.warn("Failed to start puzzle 6:", err));
        };
        es.onerror = () => console.error('[P6] SSE connection error');
    }

    document.addEventListener('DOMContentLoaded', () => {
        setStatusBadge('active', 'Activa');
        setTrackerState('waiting');
        loadSnapshot();
        installDebugHelpers();
        initSSE();
    });
})();
