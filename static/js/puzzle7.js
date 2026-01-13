(function() {
    const cards = new Map(
        Array.from(document.querySelectorAll('.p7-card')).map(img => [Number(img.dataset.box), img])
    );

    let solved = false;
    let snapshotLoaded = false;

    function setSolved(box) {
        const img = cards.get(box);
        if (!img) return;
        img.src = `/static/images/puzzle7/c${box}ok.png`;
    }

    function handleUpdate(d) {
        if (!d || d.puzzle_id !== 7) return;

        if (Array.isArray(d.solved_boxes)) {
            d.solved_boxes.forEach(setSolved);
        }

        if (typeof d.solved_box === 'number') {
            setSolved(d.solved_box);
        }

        if (d.puzzle_solved && !solved) {
            solved = true;
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
        es.onopen = () => loadSnapshot();
    }

    document.addEventListener('DOMContentLoaded', () => {
        initSSE();
        loadSnapshot();
    });
})();
