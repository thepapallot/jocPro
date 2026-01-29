(function() {
    const countdownEl = document.getElementById('countdown');
    const messageEl = document.getElementById('message');

    let solved = false;
    let active = false;
    let endTime = null;
    let countdownTimer = null;
    let resetTimer = null;

    function format(sec) {
        if (sec < 0) sec = 0;
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }

    function startLocalCountdown(remainingSeconds) {
        clearInterval(countdownTimer);
        clearInterval(resetTimer);
        active = true;
        messageEl.textContent = '';  // Clear any error message
        countdownEl.classList.remove('failure');  // Remove failure class when starting normal countdown
        endTime = Date.now() + remainingSeconds * 1000;
        updateCountdown(); // immediate
        countdownTimer = setInterval(updateCountdown, 1000);
    }

    function updateCountdown() {
        if (!active || solved || endTime == null) return;
        const remaining = Math.round((endTime - Date.now()) / 1000);
        countdownEl.textContent = format(remaining);
        
        // Add expired class when time runs out
        if (remaining <= 0) {
            clearInterval(countdownTimer);
            active = false;
            countdownEl.classList.add('expired');
        }
    }

    function handleReset(waitSeconds, msg) {
        active = false;
        clearInterval(countdownTimer);
        clearInterval(resetTimer);
        
        // Show error message
        messageEl.textContent = msg;
        
        // Add failure class to make countdown red
        countdownEl.classList.add('failure');
        countdownEl.classList.remove('expired');
        
        // Show countdown in the main timer display
        let end = Date.now() + waitSeconds * 1000;
        function tick() {
            const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
            countdownEl.textContent = `${left}s`;
            if (left <= 0) {
                clearInterval(resetTimer);
                // Remove failure class when countdown ends
                countdownEl.classList.remove('failure');
            }
        }
        tick();
        resetTimer = setInterval(tick, 500);
    }

    function applySnapshot(d) {
        if (d.puzzle_solved) {
            solved = true;
            countdownEl.textContent = '00:00';
            countdownEl.classList.add('expired');
            messageEl.textContent = '';
            return;
        }
        if (d.restart_pending) {
            const msg = d.last_reset_message || 'Reiniciando...';
            handleReset(d.waiting_seconds || 5, msg);
            return;
        }
        if (d.active) {
            countdownEl.classList.remove('expired');
            startLocalCountdown(d.remaining);
        }
    }

    function handleUpdate(d) {
        if (d.puzzle_id !== 6) return;

        console.log('[P6] handleUpdate received:', d);

        if (d.countdown_start) {
            const info = d.countdown_start;
            const serverNow = Date.now();
            const elapsed = Math.max(0, Math.floor(serverNow/1000 - info.start_ts));
            const remaining = info.duration - elapsed;
            countdownEl.classList.remove('expired');
            startLocalCountdown(remaining);
        }

        if (d.countdown_tick && active && !solved) {
            countdownEl.textContent = format(d.countdown_tick.remaining);
        }

        if (d.countdown_reset) {
            const r = d.countdown_reset;
            const msg = r.message || `Error: Caja ${r.box} sin energía. Vuelta a empezar en 10 segundos`;
            handleReset(r.waiting_seconds || 10, msg);
        }

        if (d.puzzle_solved && !solved) {
            solved = true;
            active = false;
            clearInterval(countdownTimer);
            clearInterval(resetTimer);
            countdownEl.textContent = '00:00';
            countdownEl.classList.add('expired');
            messageEl.textContent = '';
            setTimeout(() => window.location.href = '/puzzleSuperat/6', 3000);
        }
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
        es.onopen = () => loadSnapshot();
        es.onerror = () => console.error('[P6] SSE connection error');
    }

    document.addEventListener('DOMContentLoaded', () => {
        initSSE();
        setTimeout(loadSnapshot, 400);
    });
})();
