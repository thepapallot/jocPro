(function() {
    const statusImg = document.getElementById('p9-start');

    let solved = false;
    let snapshotLoaded = false;

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

        if (d.puzzle_solved && !solved) {
            solved = true;
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
        es.onopen = () => loadSnapshot();
    }

    document.addEventListener('DOMContentLoaded', () => {
        initSSE();
        loadSnapshot();
    });
})();
