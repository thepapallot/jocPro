(function() {
    const statusImg = document.getElementById('p9-start');

    let solved = false;
    let snapshotLoaded = false;

    // Short effect player
    function playSound(url) {
        const audio = new Audio(url);
        audio.play().catch(err => console.warn("Audio play failed:", err));
    }
    const BTN_SOUND_URL = "/static/audios/effects/boto.wav";
    const PUZZLE_COMPLETE_SOUND_URL = "/static/audios/effects/nivel_completado.wav";

    function applyStatus(status) {
        if (!statusImg || !status) return;
        // status is one of: start | half | wrong | good
        statusImg.src = `/static/images/puzzle9/${status}.png`;
    }

    function handleUpdate(d) {
        if (!d || d.puzzle_id !== 9) return;

        if (typeof d.status === 'string') {
            applyStatus(d.status);
        }

        // Play boto.wav for each box update
        if (d.box_update) {
            playSound(BTN_SOUND_URL);
        }

        if (d.puzzle_solved && !solved) {
            solved = true;
            // Play final completion sound
            playSound(PUZZLE_COMPLETE_SOUND_URL);
            setTimeout(() => (window.location.href = '/puzzleSuperat/9'), 500);
        }
    }

    function loadSnapshot() {
        if (snapshotLoaded) return;
        snapshotLoaded = true;
        fetch('/current_state')
            .then(r => r.json())
            .then(handleUpdate)
            .catch(() => {});
    }

    function initSSE() {
        const es = new EventSource('/state_stream');
        es.onmessage = evt => {
            try { handleUpdate(JSON.parse(evt.data)); } catch {}
        };
        es.onopen = () => {
            // Start Puzzle 2 when SSE is connected
            fetch("/start_puzzle/9", { method: "POST" })
                .catch(err => console.warn("Failed to start puzzle 9:", err));
        };
    }

    document.addEventListener('DOMContentLoaded',initSSE);
})();
