(function () {
    const statusMessage = document.getElementById('status-message');
    const statusBadge = document.getElementById('p9-status-badge');
    const boxEls = Array.from(document.querySelectorAll('.p9-box'));
    const boardEl = document.getElementById('p9-board');
    const centerStageEl = document.getElementById('p9-center-stage');
    const clueEls = Array.from(document.querySelectorAll('.p9-clue-card'));
    const solution = {
        0: 5,
        1: 6,
        2: 3,
        3: 7,
        4: 0,
        5: 8,
        6: 4,
        7: 2,
        8: 1,
        9: 9
    };
    const tokenLabels = [5, 10, 13, 14, 17, 18, 20, 22, 31, 35];

    let solved = false;
    let stickyStatus = null;
    let clueAnimationFrame = null;
    let clueState = [];
    let clueMotionEnabled = false;

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function intersectsRect(x, y, width, height, rect) {
        return (
            x < rect.right &&
            x + width > rect.left &&
            y < rect.bottom &&
            y + height > rect.top
        );
    }

    function intersectsBox(a, b) {
        return (
            a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y
        );
    }

    function randomBetween(min, max) {
        return min + Math.random() * (max - min);
    }

    function getBoardMetrics() {
        if (!boardEl || !centerStageEl) return null;
        const width = boardEl.clientWidth;
        const height = boardEl.clientHeight;
        const padding = Math.max(24, Math.round(Math.min(width, height) * 0.02));
        return {
            width,
            height,
            padding
        };
    }

    function intersectsLocalRect(x, y, width, height, rect) {
        return (
            x < rect.x + rect.width &&
            x + width > rect.x &&
            y < rect.y + rect.height &&
            y + height > rect.y
        );
    }

    function placeCluesRandomly() {
        const metrics = getBoardMetrics();
        if (!metrics) return;
        const baseArea = 1366 * 768;
        const currentArea = Math.max(1, metrics.width * metrics.height);
        const speedScale = clamp(Math.sqrt(currentArea / baseArea), 1, 1.9);

        const anchors = [
            { x: 0.12, y: 0.16 }, // izquierda 1
            { x: 0.12, y: 0.44 }, // izquierda 2
            { x: 0.12, y: 0.72 }, // izquierda 3
            { x: 0.88, y: 0.16 }, // derecha 1
            { x: 0.88, y: 0.44 }, // derecha 2
            { x: 0.88, y: 0.72 }, // derecha 3
            { x: 0.50, y: 0.12 }, // centro 1
            { x: 0.50, y: 0.50 }, // centro 2
            { x: 0.50, y: 0.86 }  // centro 3
        ];

        const placed = [];
        clueState = clueEls.map((el, index) => {
            const width = el.offsetWidth;
            const height = el.offsetHeight;
            const maxX = Math.max(metrics.padding, metrics.width - width - metrics.padding);
            const maxY = Math.max(metrics.padding, metrics.height - height - metrics.padding);
            const anchor = anchors[index] || { x: 0.5, y: 0.5 };
            let x = clamp((metrics.width * anchor.x) - (width / 2), metrics.padding, maxX);
            let y = clamp((metrics.height * anchor.y) - (height / 2), metrics.padding, maxY);
            let found = false;

            for (let attempt = 0; attempt < 120; attempt += 1) {
                const jitterX = randomBetween(-24, 24);
                const jitterY = randomBetween(-18, 18);
                const testX = clamp(x + jitterX, metrics.padding, maxX);
                const testY = clamp(y + jitterY, metrics.padding, maxY);
                const blockedByCards = placed.some((card) =>
                    intersectsLocalRect(testX, testY, width, height, card)
                );
                if (!blockedByCards) {
                    x = testX;
                    y = testY;
                    found = true;
                    break;
                }
            }

            // Fallback determinista: barrido por rejilla para garantizar arranque sin solapes.
            if (!found) {
                const stepX = Math.max(16, Math.floor(width * 0.2));
                const stepY = Math.max(14, Math.floor(height * 0.2));
                outer:
                for (let yy = metrics.padding; yy <= maxY; yy += stepY) {
                    for (let xx = metrics.padding; xx <= maxX; xx += stepX) {
                        const blockedByCards = placed.some((card) =>
                            intersectsLocalRect(xx, yy, width, height, card)
                        );
                        if (!blockedByCards) {
                            x = xx;
                            y = yy;
                            found = true;
                            break outer;
                        }
                    }
                }
            }

            x = clamp(x, metrics.padding, maxX);
            y = clamp(y, metrics.padding, maxY);
            placed.push({ x, y, width, height });

            const speed = (0.18 + (index * 0.015)) * speedScale;
            const angle = Math.random() * Math.PI * 2;
            const state = {
                el,
                x,
                y,
                width,
                height,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed
            };
            el.style.transform = `translate(${x}px, ${y}px)`;
            return state;
        });
    }

    function stopClueMotion() {
        if (clueAnimationFrame) {
            cancelAnimationFrame(clueAnimationFrame);
            clueAnimationFrame = null;
        }
        clueMotionEnabled = false;
    }

    function animateClues() {
        const metrics = getBoardMetrics();
        if (!metrics || !clueMotionEnabled) return;

        clueState.forEach(item => {
            item.width = item.el.offsetWidth;
            item.height = item.el.offsetHeight;
            item.x += item.vx;
            item.y += item.vy;

            if (item.x <= metrics.padding || item.x + item.width >= metrics.width - metrics.padding) {
                item.vx *= -1;
                item.x = clamp(item.x, metrics.padding, metrics.width - item.width - metrics.padding);
            }

            if (item.y <= metrics.padding || item.y + item.height >= metrics.height - metrics.padding) {
                item.vy *= -1;
                item.y = clamp(item.y, metrics.padding, metrics.height - item.height - metrics.padding);
            }

            item.el.style.transform = `translate(${item.x}px, ${item.y}px)`;
        });

        for (let pass = 0; pass < 2; pass += 1) {
            for (let i = 0; i < clueState.length; i += 1) {
                for (let j = i + 1; j < clueState.length; j += 1) {
                    const a = clueState[i];
                    const b = clueState[j];

                    if (!intersectsBox(a, b)) continue;

                    const aCenterX = a.x + (a.width / 2);
                    const aCenterY = a.y + (a.height / 2);
                    const bCenterX = b.x + (b.width / 2);
                    const bCenterY = b.y + (b.height / 2);
                    const dx = aCenterX - bCenterX;
                    const dy = aCenterY - bCenterY;
                    const overlapX = ((a.width + b.width) / 2) - Math.abs(dx);
                    const overlapY = ((a.height + b.height) / 2) - Math.abs(dy);

                    if (overlapX < overlapY) {
                        const push = Math.max(6, overlapX / 2 + 1);
                        if (dx >= 0) {
                            a.x += push;
                            b.x -= push;
                        } else {
                            a.x -= push;
                            b.x += push;
                        }
                        const tmp = a.vx;
                        a.vx = b.vx;
                        b.vx = tmp;
                    } else {
                        const push = Math.max(6, overlapY / 2 + 1);
                        if (dy >= 0) {
                            a.y += push;
                            b.y -= push;
                        } else {
                            a.y -= push;
                            b.y += push;
                        }
                        const tmp = a.vy;
                        a.vy = b.vy;
                        b.vy = tmp;
                    }

                    a.x = clamp(a.x, metrics.padding, metrics.width - a.width - metrics.padding);
                    a.y = clamp(a.y, metrics.padding, metrics.height - a.height - metrics.padding);
                    b.x = clamp(b.x, metrics.padding, metrics.width - b.width - metrics.padding);
                    b.y = clamp(b.y, metrics.padding, metrics.height - b.height - metrics.padding);

                    a.el.style.transform = `translate(${a.x}px, ${a.y}px)`;
                    b.el.style.transform = `translate(${b.x}px, ${b.y}px)`;
                }
            }
        }

        clueAnimationFrame = requestAnimationFrame(animateClues);
    }

    function setupClueMotion() {
        stopClueMotion();

        if (!boardEl || !centerStageEl || !clueEls.length) return;

        if (window.innerWidth <= 1250) {
            clueEls.forEach(el => {
                el.style.transform = '';
            });
            return;
        }

        clueMotionEnabled = true;
        placeCluesRandomly();
        animateClues();
    }

    function playSound(url, onComplete) {
        const audio = new Audio(url);
        if (typeof onComplete === 'function') {
            audio.onended = onComplete;
        }
        audio.play().catch(err => console.warn('Audio play failed:', err));
        return audio;
    }

    const BTN_SOUND_URL = '/static/audios/effects/boto.wav';
    const PUZZLE_COMPLETE_SOUND_URL = '/static/audios/effects/nivel_completado.wav';
    const PUZZLE_CORRECTE_SOUND_URL = '/static/audios/effects/correcte.wav';
    const PUZZLE_INCORRECTE_SOUND_URL = '/static/audios/effects/incorrecte.wav';

    function tokenToLabel(tokenIndex) {
        return Number.isInteger(tokenIndex) && tokenLabels[tokenIndex] != null
            ? String(tokenLabels[tokenIndex])
            : '';
    }

    function renderBoxes(boxes, status) {
        const current = boxes || {};

        boxEls.forEach(boxEl => {
            const boxIndex = Number(boxEl.dataset.box);
            const tokenIndex = current[boxIndex] ?? null;
            const tokenValueEl = boxEl.querySelector('.p9-token-value');
            const tokenIconEl = boxEl.querySelector('.p9-token-icon');

            boxEl.classList.remove('is-filled', 'is-correct', 'is-wrong');

            if (tokenIndex == null) {
                tokenValueEl.textContent = '';
                if (tokenIconEl) tokenIconEl.setAttribute('aria-hidden', 'true');
                return;
            }

            tokenValueEl.textContent = '';
            if (tokenIconEl) tokenIconEl.setAttribute('aria-hidden', 'false');
            boxEl.classList.add('is-filled');

            if (status === 'good' && solution[boxIndex] === tokenIndex) {
                boxEl.classList.add('is-correct');
            } else if (status === 'wrong' && solution[boxIndex] !== tokenIndex) {
                boxEl.classList.add('is-wrong');
            }
        });

    }

    function updateBadge(status) {
        if (!statusBadge) return;

        statusBadge.className = '';
        statusBadge.id = 'p9-status-badge';

        if (status === 'good') {
            statusBadge.classList.add('status-good');
            statusBadge.textContent = 'Validado';
            return;
        }
        if (status === 'wrong') {
            statusBadge.classList.add('status-wrong');
            statusBadge.textContent = 'Revisar';
            return;
        }
        if (status === 'half') {
            statusBadge.classList.add('status-half');
            statusBadge.textContent = 'En curso';
            return;
        }

        statusBadge.classList.add('status-start');
        statusBadge.textContent = 'Sin validar';
    }

    function renderStatus(status, hasBoxUpdate) {
        updateBadge(status);

        if (!statusMessage || typeof status !== 'string') return;

        if (status === 'good' || status === 'wrong') {
            const isRepeatedStatus = stickyStatus === status && !hasBoxUpdate;
            stickyStatus = status;
            statusMessage.classList.add('visible');
            statusMessage.classList.toggle('status-good', status === 'good');
            statusMessage.classList.toggle('status-wrong', status === 'wrong');
            statusMessage.textContent = status === 'good'
                ? 'Tokens correctamente colocados'
                : 'Tokens mal colocados';
            if (!isRepeatedStatus) {
                if (status === 'good') {
                    playSound(PUZZLE_CORRECTE_SOUND_URL);
                } else {
                    playSound(PUZZLE_INCORRECTE_SOUND_URL);
                }
            }
            return;
        }

        if (stickyStatus && !hasBoxUpdate) {
            return;
        }

        stickyStatus = null;
        statusMessage.classList.remove('visible', 'status-good', 'status-wrong');
        statusMessage.textContent = '';
    }

    function handleUpdate(d) {
        if (!d || d.puzzle_id !== 9) return;

        const boxes = d.boxes || d.box_tokens;
        if (boxes) {
            renderBoxes(boxes, d.status);
        }

        if (typeof d.status === 'string') {
            renderStatus(d.status, Boolean(d.box_update));
        }

        if (d.box_update && d.playsound) {
            playSound(BTN_SOUND_URL);
        }

        if (d.puzzle_solved && !solved) {
            solved = true;
            playSound(PUZZLE_COMPLETE_SOUND_URL, () => {
                window.location.href = '/puzzleSuperat/9';
            });
        }
    }

    function initSSE() {
        const es = new EventSource('/state_stream');
        es.onmessage = evt => {
            try {
                handleUpdate(JSON.parse(evt.data));
            } catch {}
        };
        es.onopen = () => {
            fetch('/start_puzzle/9', { method: 'POST' })
                .catch(err => console.warn('Failed to start puzzle 9:', err));
        };
    }

    function installDebugHelpers() {
        window.puzzle9Debug = {
            start() {
                handleUpdate({
                    puzzle_id: 9,
                    status: 'start',
                    boxes: { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null, 8: null, 9: null }
                });
            },
            partial() {
                handleUpdate({
                    puzzle_id: 9,
                    status: 'half',
                    boxes: { 0: 5, 1: null, 2: 3, 3: null, 4: null, 5: 8, 6: 4, 7: null, 8: null, 9: 9 }
                });
            },
            wrong() {
                handleUpdate({
                    puzzle_id: 9,
                    status: 'wrong',
                    boxes: { 0: 4, 1: 6, 2: 3, 3: 7, 4: 0, 5: 8, 6: 5, 7: 2, 8: 1, 9: 9 }
                });
            },
            good() {
                handleUpdate({
                    puzzle_id: 9,
                    status: 'good',
                    boxes: { 0: 5, 1: 6, 2: 3, 3: 7, 4: 0, 5: 8, 6: 4, 7: 2, 8: 1, 9: 9 }
                });
            },
            solved() {
                handleUpdate({
                    puzzle_id: 9,
                    status: 'good',
                    boxes: { 0: 5, 1: 6, 2: 3, 3: 7, 4: 0, 5: 8, 6: 4, 7: 2, 8: 1, 9: 9 },
                    puzzle_solved: true
                });
            }
        };
    }

    document.addEventListener('DOMContentLoaded', () => {
        installDebugHelpers();
        setupClueMotion();
        requestAnimationFrame(setupClueMotion);
        initSSE();
        window.addEventListener('resize', setupClueMotion);
        window.addEventListener('load', setupClueMotion, { once: true });
    });
})();
