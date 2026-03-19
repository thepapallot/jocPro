(function() {
    const cards = new Map(
        Array.from(document.querySelectorAll('.p7-card')).map(img => [Number(img.dataset.box), img])
    );

    let solved = false;
    let snapshotLoaded = false;

    // Short effect player
    function playSound(url) {
        const audio = new Audio(url);
        audio.play().catch(err => console.warn("Audio play failed:", err));
    }
    const BOX_OK_SOUND_URL = "/static/audios/effects/correcte.wav";
    const PUZZLE_COMPLETE_SOUND_URL = "/static/audios/effects/nivel_completado.wav";

    function setSolved(box) {
        const img = cards.get(box);
        if (!img) return;
        //img.src = `/static/images/puzzle7/c${box}ok.png`;
        img.src = `/static/images/puzzle7/ok.png`;
    }

    function handleUpdate(d) {
        if (!d || d.puzzle_id !== 7) return;

        if (Array.isArray(d.solved_boxes)) {
            d.solved_boxes.forEach(setSolved);
        }

        if (typeof d.solved_box === 'number') {
            setSolved(d.solved_box);
            // Play per-box completion sound
            playSound(BOX_OK_SOUND_URL);
        }

        if (d.puzzle_solved && !solved) {
            solved = true;
            // Play puzzle completion sound
            playSound(PUZZLE_COMPLETE_SOUND_URL);
            setTimeout(() => (window.location.href = '/puzzleSuperat/7'), 1500);
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
            try {
                handleUpdate(JSON.parse(evt.data));
            } catch {}
        };
        es.onopen = () => {
            // Start Puzzle 2 when SSE is connected
            fetch("/start_puzzle/7", { method: "POST" })
                .catch(err => console.warn("Failed to start puzzle 7:", err));
        };
    }

    document.addEventListener('DOMContentLoaded', initSSE);
})();
