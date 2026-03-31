(function() {
    const countdownEl = document.getElementById('countdown');
    const messageEl = document.getElementById('message');
    const statusBadgeEl = document.getElementById('status-badge');
    const trackerPanelEl = document.getElementById('tracker-panel');
    const DEFAULT_MESSAGE = 'Alinea cada token con su color antes de que desaparezca.';
    const WAITING_MESSAGE = 'Esperando sincronizacion del sistema.';

    let solved = false;
    let active = false;
    let endTime = null;
    let countdownTimer = null;
    let resetTimer = null;

    // Sound helper and URLs
    function playSound(url) {
        const audio = new Audio(url);
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

    function format(sec) {
        if (sec < 0) sec = 0;
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
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
        endTime = Date.now() + Math.max(0, remainingSeconds) * 1000;
        updateCountdown(); // immediate
        countdownTimer = setInterval(updateCountdown, 1000);
    }

    function updateCountdown() {
        if (!active || solved || endTime == null) return;
        const remaining = Math.round((endTime - Date.now()) / 1000);
        countdownEl.textContent = format(remaining);

        // Play boto.wav on each second tick while main countdown is active
        if (remaining > 0) {
            playSound(BTN_SOUND_URL);
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
        countdownEl.textContent = '00:00';
        countdownEl.classList.add('expired');
        countdownEl.classList.remove('failure');
        setMessage('Secuencia completada.', false);
        setStatusBadge('solved', 'Completado');
        setTrackerState('solved');
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
            setTimeout(() => window.location.href = '/puzzleSuperat/6', 3000);
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
