(function() {
    const statusMessage = document.getElementById('status-message');

    let solved = false;
    let stickyStatus = null;

    // Short effect player
    function playSound(url) {
        const audio = new Audio(url);
        audio.play().catch(err => console.warn("Audio play failed:", err));
    }
    const BTN_SOUND_URL = "/static/audios/effects/boto.wav";
    const PUZZLE_COMPLETE_SOUND_URL = "/static/audios/effects/nivel_completado.wav";
    const PUZZLE_CORRECTE_SOUND_URL = "/static/audios/effects/correcte.wav";
    const PUZZLE_INCORRECTE_SOUND_URL = "/static/audios/effects/incorrecte.wav";

    function renderStatus(status, hasBoxUpdate) {
        if (!statusMessage || typeof status !== 'string') return;

        if (status === 'good' || status === 'wrong') {
            stickyStatus = status;
            statusMessage.classList.add('visible');
            statusMessage.classList.toggle('status-good', status === 'good');
            statusMessage.classList.toggle('status-wrong', status === 'wrong');
            statusMessage.textContent = status === 'good'
                ? 'Token correctamente colocados'
                : 'Token mal colocados';
            if (status === 'good') {
                playSound(PUZZLE_CORRECTE_SOUND_URL);
            } else if (status === 'wrong') {
                playSound(PUZZLE_INCORRECTE_SOUND_URL);
            }
            return;
        }

        if (stickyStatus && !hasBoxUpdate) {
            return;
        }

        stickyStatus = null;
        statusMessage.classList.remove('visible');
        statusMessage.classList.remove('status-good', 'status-wrong');
        statusMessage.textContent = '';
    }

    function handleUpdate(d) {
        if (!d || d.puzzle_id !== 9) return;

        if (typeof d.status === 'string') {
            renderStatus(d.status, Boolean(d.box_update));
        }

        if (d.box_update && d.playsound) {
            playSound(BTN_SOUND_URL);
        }

        if (d.puzzle_solved && !solved) {
            solved = true;
            // Play final completion sound
            playSound(PUZZLE_COMPLETE_SOUND_URL);
            setTimeout(() => (window.location.href = '/puzzleSuperat/9'), 500);
        }
    }

    function initSSE() {
        const es = new EventSource('/state_stream');
        es.onmessage = evt => {
            try { handleUpdate(JSON.parse(evt.data)); } catch {}
        };
        es.onopen = () => {
            // Start Puzzle 9 when SSE is connected
            fetch("/start_puzzle/9", { method: "POST" })
                .catch(err => console.warn("Failed to start puzzle 9:", err));
        };
    }

    document.addEventListener('DOMContentLoaded',initSSE);
})();
