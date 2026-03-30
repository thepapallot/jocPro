(function() {
    const cards = new Map(
        Array.from(document.querySelectorAll('.led-card')).map(card => [Number(card.dataset.box), card])
    );
    const statusBadge = document.getElementById('p7-status');

    let solved = false;
    let snapshotLoaded = false;

    // Short effect player
    function playSound(url) {
        const audio = new Audio(url);
        audio.play().catch(err => console.warn("Audio play failed:", err));
    }
    const BOX_OK_SOUND_URL = "/static/audios/effects/correcte.wav";
    const PUZZLE_COMPLETE_SOUND_URL = "/static/audios/effects/nivel_completado.wav";

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

    function handleUpdate(d) {
        if (!d || d.puzzle_id !== 7) return;

        if (Array.isArray(d.solved_boxes)) {
            d.solved_boxes.forEach(box => setSolved(box));
        }

        if (typeof d.solved_box === 'number') {
            setSolved(d.solved_box, { animate: true });
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

    function installDebugHelpers() {
        window.puzzle7Debug = {
            push(payload) {
                handleUpdate({ puzzle_id: 7, ...payload });
            },
            solvedBox(box = 0) {
                handleUpdate({
                    puzzle_id: 7,
                    solved_box: box
                });
            },
            solvedMany(boxes = [0, 2, 4, 7]) {
                handleUpdate({
                    puzzle_id: 7,
                    solved_boxes: boxes
                });
            },
            solvedPuzzle() {
                const previousSolved = solved;
                solved = false;
                handleUpdate({
                    puzzle_id: 7,
                    solved_boxes: [0,1,2,3,4,5,6,7,8,9],
                    puzzle_solved: true
                });
                solved = previousSolved;
            },
            reset() {
                solved = false;
                cards.forEach(card => card.classList.remove('is-solved', 'is-newly-solved'));
                updateStatus();
            },
            demoProgress() {
                this.reset();
                [0, 3, 5, 8].forEach((box, index) => {
                    setTimeout(() => this.solvedBox(box), index * 700);
                });
            },
            demoSolved() {
                this.reset();
                setTimeout(() => this.solvedMany([0,1,2,3,4,5,6,7,8,9]), 400);
            }
        };
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
            // Start Puzzle 2 when SSE is connected
            fetch("/start_puzzle/7", { method: "POST" })
                .catch(err => console.warn("Failed to start puzzle 7:", err));
        };
    }

    document.addEventListener('DOMContentLoaded', () => {
        updateStatus();
        loadSnapshot();
        installDebugHelpers();
        initSSE();
    });
})();
