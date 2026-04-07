(function () {
    const cards = new Map(
        Array.from(document.querySelectorAll('.led-card')).map(card => [Number(card.dataset.box), card])
    );
    const statusBadge = document.getElementById('p10-status');
    const timerBadge = document.getElementById('p10-timer');

    let solved = false;
    let snapshotLoaded = false;
    let roundSeconds = 60;
    let secondsLeft = roundSeconds;
    let timerId = null;
    let expireInFlight = false;

    function playSound(url) {
        const audio = new Audio(url);
        audio.play().catch(err => console.warn('Audio play failed:', err));
    }

    const BOX_OK_SOUND_URL = '/static/audios/effects/correcte.wav';
    const PUZZLE_COMPLETE_SOUND_URL = '/static/audios/effects/nivel_completado.wav';

    function formatSeconds(totalSeconds) {
        const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
        const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
        const seconds = String(safeSeconds % 60).padStart(2, '0');
        return `${minutes}:${seconds}`;
    }

    function updateTimer(secondsLeft) {
        if (!timerBadge || typeof secondsLeft !== 'number') return;
        timerBadge.textContent = formatSeconds(secondsLeft);
    }

    function setRoundSeconds(value) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return;

        const normalized = Math.max(1, Math.floor(parsed));
        roundSeconds = normalized;
    }

    function resetRoundTimer() {
        secondsLeft = roundSeconds;
        updateTimer(secondsLeft);
    }

    function notifyTimerExpired() {
        if (expireInFlight || solved) return;
        expireInFlight = true;
        fetch('/timer_expired', { method: 'POST' })
            .catch(err => console.warn('Failed to notify timer expiration:', err))
            .finally(() => {
                expireInFlight = false;
            });
    }

    function startFrontendTimer() {
        if (timerId !== null) return;

        timerId = window.setInterval(() => {
            if (solved) {
                return;
            }

            secondsLeft -= 1;
            if (secondsLeft <= 0) {
                resetRoundTimer();
                notifyTimerExpired();
                return;
            }

            updateTimer(secondsLeft);
        }, 1000);
    }

    function stopFrontendTimer() {
        if (timerId !== null) {
            window.clearInterval(timerId);
            timerId = null;
        }
    }

    function updateStatus() {
        if (!statusBadge) return;
        const solvedCount = Array.from(cards.values()).filter(card => card.classList.contains('is-solved')).length;
        statusBadge.textContent = `${solvedCount} / 10 sincronizadas`;
        statusBadge.classList.toggle('is-complete', solvedCount === cards.size);
    }

    function pulseCard(card) {
        card.classList.remove('is-newly-solved');
        void card.offsetWidth;
        card.classList.add('is-newly-solved');
    }

    function setSolved(box, { animate = false } = {}) {
        const card = cards.get(box);
        if (!card) return;
        const wasSolved = card.classList.contains('is-solved');
        card.classList.add('is-solved');
        if (animate && !wasSolved) {
            pulseCard(card);
        }
        updateStatus();
    }

    function renderCodeForBox(box, code) {
        const card = cards.get(box);
        if (!card || typeof code !== 'string' || code.length !== 3) return;

        card.dataset.code = code;
        const stripWindow = card.querySelector('.led-strip-window');
        if (!stripWindow) return;

        stripWindow.innerHTML = '';
        for (const digit of code) {
            const segment = document.createElement('div');
            segment.className = `led-segment color-${digit}`;
            stripWindow.appendChild(segment);
        }
    }

    function renderTargets(targets) {
        if (!targets || typeof targets !== 'object') return;
        Object.entries(targets).forEach(([box, code]) => {
            renderCodeForBox(Number(box), String(code));
        });
    }

    function handleUpdate(d) {
        if (!d || d.puzzle_id !== 10) return;

        if (typeof d.round_seconds === 'number') {
            const previousRoundSeconds = roundSeconds;
            setRoundSeconds(d.round_seconds);
            if (previousRoundSeconds !== roundSeconds) {
                resetRoundTimer();
            }
        }

        renderTargets(d.box_targets);

        if (d.reshuffled) {
            resetRoundTimer();
        }

        if (Array.isArray(d.solved_boxes)) {
            d.solved_boxes.forEach(box => setSolved(box));
        }

        if (typeof d.solved_box === 'number') {
            setSolved(d.solved_box, { animate: true });
            playSound(BOX_OK_SOUND_URL);
        }

        if (d.puzzle_solved && !solved) {
            solved = true;
            stopFrontendTimer();
            playSound(PUZZLE_COMPLETE_SOUND_URL);
            setTimeout(() => (window.location.href = '/puzzleSuperat/10'), 1500);
        }
    }

    function loadSnapshot() {
        if (snapshotLoaded) return;
        snapshotLoaded = true;
        fetch('/current_state')
            .then(r => r.json())
            .then(d => {
                handleUpdate(d);
                updateStatus();
            })
            .catch(() => {});
    }

    function initSSE() {
        const es = new EventSource('/state_stream');
        es.onmessage = evt => {
            try {
                handleUpdate(JSON.parse(evt.data));
            } catch {}
        };
        es.onopen = () => {
            fetch('/start_puzzle/10', { method: 'POST' })
                .catch(err => console.warn('Failed to start puzzle 10:', err));
        };
    }

    document.addEventListener('DOMContentLoaded', () => {
        updateStatus();
        resetRoundTimer();
        loadSnapshot();
        initSSE();
        startFrontendTimer();
    });
})();
