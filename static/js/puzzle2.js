(function () {
    const TOTAL = 5;
    const PLAYER_COUNT = 10;
    const CELL_SIZE = 72;
    const MOVEMENT_STEP_MS = 360; // 200 logical pixels/second on the scaled board.
    const TOKEN_BY_PLAYER = [5, 13, 17, 22, 10, 20, 35, 31, 14, 18];
    const DEFAULT_SEQUENCES = {
        1: [5, 0, 9, 6, 2],
        2: [4, 3, 9, 0, 7],
        3: [8, 1, 7, 2, 4],
        4: [0, 4, 8, 1, 3],
        5: [6, 7, 8, 4, 9],
        6: [3, 5, 1, 9, 0],
        7: [2, 6, 3, 7, 8],
        8: [9, 2, 5, 7, 1],
        9: [0, 8, 2, 5, 6],
        10: [1, 4, 6, 3, 5],
    };
    const ALARM_MAP = {
        0: 2, 1: 3, 2: 0, 3: 1, 4: 5,
        5: 4, 6: 8, 7: 9, 8: 6, 9: 7,
    };

    let redirected = false;
    let alarmMode = false;
    let alarmAudio = null;
    const progressByPlayer = {};
    const snakePositions = new Map();
    const errorMarkers = new Map();
    let movementFrame = null;
    let lastMovementTime = null;
    let lastFrameTime = null;
    let movementProgress = 1;

    const snakeStageEl = document.getElementById('p2-snake-stage');
    const completeOverlayEl = document.getElementById('p2-complete-overlay');
    const completeCopyEl = document.getElementById('p2-complete-copy');

    function getSequence(player) {
        const sequence = DEFAULT_SEQUENCES[player] || [];
        return sequence.map((symbol) => (alarmMode ? (ALARM_MAP[symbol] ?? symbol) : symbol));
    }

    function getCompletedPlayers() {
        return Object.values(progressByPlayer).filter((progress) => progress >= TOTAL).length;
    }

    function playSound(url) {
        const audio = new Audio(url);
        audio.play().catch((err) => console.warn('Audio play failed:', err));
    }

    function stopAlarmAudio() {
        const audio = alarmAudio;
        alarmAudio = null;
        if (audio) audio.pause();
        document.body.classList.remove('p2-alarm-sounding');
    }

    function playAlarmAudio(url) {
        stopAlarmAudio();
        const audio = new Audio(url);
        alarmAudio = audio;
        const finish = () => {
            if (alarmAudio !== audio) return;
            alarmAudio = null;
            document.body.classList.remove('p2-alarm-sounding');
        };
        audio.addEventListener('playing', () => {
            if (alarmAudio === audio) document.body.classList.add('p2-alarm-sounding');
        });
        audio.addEventListener('ended', finish);
        audio.addEventListener('error', finish);
        audio.play().catch(err => {
            finish();
            console.warn('Alarm audio play failed:', err);
        });
    }

    function setAlarmMode(active) {
        alarmMode = !!active;
        document.body.classList.toggle('alarm-mode', alarmMode);
        document.body.classList.toggle('p2-alarm-active', alarmMode);
        renderSnakes();
        updateHudState();
    }

    function updateHudState() {
        const completed = getCompletedPlayers();
        const solved = completed >= PLAYER_COUNT;

        if (completeOverlayEl) {
            completeOverlayEl.setAttribute('aria-hidden', solved ? 'false' : 'true');
            completeOverlayEl.classList.toggle('visible', solved);
        }

        if (completeCopyEl) {
            completeCopyEl.textContent = solved
                ? 'Todos los equipos han completado su secuencia.'
                : `${PLAYER_COUNT - completed} rutas pendientes de sincronizar.`;
        }

        document.body.classList.toggle('p2-solved', solved);
    }

    function renderSnakes() {
        if (!snakeStageEl) return;

        for (let player = 1; player <= PLAYER_COUNT; player++) {
            const progress = progressByPlayer[player] || 0;
            const sequence = getSequence(player);
            let snake = snakeStageEl.querySelector(`.snake-player[data-player="${player}"]`);
            if (!snake) {
                snake = document.createElement('div');
                snake.className = 'snake-player';
                snake.dataset.player = String(player);

                const head = document.createElement('div');
                head.className = 'snake-head';
                head.textContent = String(TOKEN_BY_PLAYER[player - 1]);
                snake.appendChild(head);

                sequence.forEach((symbol) => {
                    const segment = document.createElement('img');
                    segment.className = 'snake-segment';
                    segment.alt = `Símbolo ${symbol}`;
                    snake.appendChild(segment);
                });

                snakeStageEl.appendChild(snake);
                snakePositions.set(player, createSnakeState(player));
            }

            snake.classList.toggle('is-complete', progress >= TOTAL);
            const segments = snake.querySelectorAll('.snake-segment');

            sequence.forEach((symbol, index) => {
                const segment = segments[index];
                segment.src = `/static/images/puzzle2/symbols/symbol_${symbol}.png`;
                segment.alt = `Símbolo ${symbol}`;
                segment.classList.remove('complete', 'active', 'pending');

                if (index < progress) {
                    segment.classList.add('complete');
                } else if (index === progress && progress < TOTAL) {
                    segment.classList.add('active');
                } else {
                    segment.classList.add('pending');
                }

            });
        }
        renderSnakePositions();
    }

    function getGridBounds() {
        return {
            columns: Math.max(3, Math.floor(snakeStageEl.clientWidth / CELL_SIZE)),
            rows: Math.max(3, Math.floor(snakeStageEl.clientHeight / CELL_SIZE)),
        };
    }

    function createSnakeState(player) {
        const { columns, rows } = getGridBounds();
        const directions = [
            { x: 1, y: 0 },
            { x: 0, y: 1 },
            { x: -1, y: 0 },
            { x: 0, y: -1 },
        ];
        const direction = directions[(player - 1) % directions.length];
        const head = {
            x: 1 + ((player * 3) % Math.max(1, columns - 2)),
            y: 1 + ((player * 5) % Math.max(1, rows - 2)),
        };
        const trail = [head];

        for (let index = 1; index <= TOTAL; index++) {
            trail.push({
                x: Math.max(0, Math.min(columns - 1, head.x - direction.x * index)),
                y: Math.max(0, Math.min(rows - 1, head.y - direction.y * index)),
            });
        }

        return { trail, previousTrail: trail.slice(), direction, ticks: 0 };
    }

    function renderSnakePositions() {
        if (!snakeStageEl) return;
        for (let player = 1; player <= PLAYER_COUNT; player++) {
            const snake = snakeStageEl.querySelector(`.snake-player[data-player="${player}"]`);
            const state = snakePositions.get(player);
            if (!snake || !state) continue;

            const positionPart = (part, index) => {
                const point = state.trail[index];
                const previous = state.previousTrail[index] || point;
                if (!part || !point) return;
                const x = previous.x + (point.x - previous.x) * movementProgress;
                const y = previous.y + (point.y - previous.y) * movementProgress;
                part.style.left = `${x * CELL_SIZE + CELL_SIZE / 2}px`;
                part.style.top = `${y * CELL_SIZE + CELL_SIZE / 2}px`;
            };
            const parts = [snake.querySelector('.snake-head'), ...snake.querySelectorAll('.snake-segment')];
            parts.forEach(positionPart);
            snake.querySelectorAll('.snake-error-marker').forEach(marker => {
                positionPart(marker, Number(marker.dataset.segmentIndex) + 1);
            });
        }
    }

    function showErrorMarker(player) {
        if (!Number.isInteger(player) || player < 1 || player > PLAYER_COUNT) return;
        const index = progressByPlayer[player] || 0;
        if (index >= TOTAL || !snakeStageEl) return;
        const snake = snakeStageEl.querySelector(`.snake-player[data-player="${player}"]`);
        if (!snake) return;
        const key = `${player}:${index}`;
        const previous = errorMarkers.get(key);
        if (previous) {
            clearTimeout(previous.timer);
            previous.marker.remove();
        }
        const marker = document.createElement('span');
        marker.className = 'snake-error-marker';
        marker.dataset.segmentIndex = String(index);
        marker.setAttribute('role', 'img');
        marker.setAttribute('aria-label', `Respuesta incorrecta para el token ${TOKEN_BY_PLAYER[player - 1]}, símbolo ${index + 1}`);
        snake.appendChild(marker);
        const timer = setTimeout(() => {
            marker.remove();
            errorMarkers.delete(key);
        }, 4000);
        errorMarkers.set(key, {marker, timer});
        renderSnakePositions();
    }

    function clearErrorMarkers() {
        errorMarkers.forEach(({marker, timer}) => {
            clearTimeout(timer);
            marker.remove();
        });
        errorMarkers.clear();
    }

    function moveSnakes() {
        if (!snakeStageEl) return;
        const { columns, rows } = getGridBounds();
        const directions = [
            { x: 1, y: 0 },
            { x: -1, y: 0 },
            { x: 0, y: 1 },
            { x: 0, y: -1 },
        ];

        for (let player = 1; player <= PLAYER_COUNT; player++) {
            const state = snakePositions.get(player);
            if (!state) continue;

            const head = state.trail[0];
            const canMove = (direction) => {
                const x = head.x + direction.x;
                const y = head.y + direction.y;
                return x >= 0 && x < columns && y >= 0 && y < rows;
            };
            const isReverse = (direction) => (
                direction.x === -state.direction.x && direction.y === -state.direction.y
            );
            const isStraight = (direction) => (
                direction.x === state.direction.x && direction.y === state.direction.y
            );
            let nextDirection = state.direction;
            const needsTurn = !canMove(state.direction) || Math.random() < 0.12;

            if (needsTurn) {
                const turns = directions.filter((direction) => (
                    !isReverse(direction) && !isStraight(direction) && canMove(direction)
                ));
                if (turns.length) {
                    nextDirection = turns[Math.floor(Math.random() * turns.length)];
                }
            }

            if (!canMove(nextDirection)) {
                const alternatives = directions.filter((direction) => (
                    !isReverse(direction) && canMove(direction)
                ));
                if (alternatives.length) {
                    nextDirection = alternatives[Math.floor(Math.random() * alternatives.length)];
                } else {
                    continue;
                }
            }

            const nextHead = {
                x: head.x + nextDirection.x,
                y: head.y + nextDirection.y,
            };
            state.direction = nextDirection;
            state.ticks += 1;
            state.previousTrail = state.trail.slice();
            state.trail.unshift(nextHead);
            state.trail.length = TOTAL + 1;
        }

    }

    function animateSnakes(timestamp) {
        // Resume where drawing stopped, never race through missed steps after
        // a hidden tab or a slow frame. Timing uses the same logical board at
        // every resolution; interpolation does not depend on monitor refresh.
        if (lastFrameTime !== null && timestamp - lastFrameTime > MOVEMENT_STEP_MS) {
            lastMovementTime = timestamp - movementProgress * MOVEMENT_STEP_MS;
        }
        lastFrameTime = timestamp;
        if (lastMovementTime === null) {
            lastMovementTime = timestamp;
            movementProgress = 0;
            moveSnakes();
        } else if (timestamp - lastMovementTime >= MOVEMENT_STEP_MS) {
            lastMovementTime += MOVEMENT_STEP_MS;
            movementProgress = 0;
            moveSnakes();
        }
        movementProgress = Math.min(1, (timestamp - lastMovementTime) / MOVEMENT_STEP_MS);
        renderSnakePositions();
        movementFrame = requestAnimationFrame(animateSnakes);
    }

    function resizeSnakeBoard() {
        if (!snakeStageEl) return;
        const {columns, rows} = getGridBounds();
        snakePositions.forEach(state => {
            for (const trail of [state.trail, state.previousTrail]) {
                trail.forEach(point => {
                    point.x = Math.max(0, Math.min(columns - 1, point.x));
                    point.y = Math.max(0, Math.min(rows - 1, point.y));
                });
            }
        });
        renderSnakePositions();
    }

    function setProgress(player, progress) {
        progressByPlayer[player] = progress;
        renderSnakes();
        updateHudState();
    }

    function applySnapshot(players) {
        players.forEach((entry) => {
            if (entry && typeof entry.player === 'number') {
                setProgress(entry.player, entry.progress || 0);
            }
        });
    }

    function handleUpdate(data) {
        if (data.puzzle_id !== 2) return;

        if (data.sequences) {
            Object.entries(data.sequences).forEach(([player, sequence]) => {
                if (Array.isArray(sequence)) {
                    DEFAULT_SEQUENCES[Number(player)] = sequence.slice();
                }
            });
        }

        if (data.error_increment) {
            showErrorMarker(data.error_increment.player);
            playSound('/static/audios/effects/incorrecte.wav');
            return;
        }

        if (data.player_update) {
            const player = data.player_update.player;
            const progress = data.player_update.progress;
            if (progress > 0 && progress < TOTAL) {
                playSound('/static/audios/effects/correcte.wav');
            }
            if (progress >= TOTAL) {
                playSound('/static/audios/effects/fase_completada.wav');
            }
            setProgress(player, progress);
        }

        if (data.players) {
            applySnapshot(data.players);
        }

        if (data.play_alarm_sound) {
            playAlarmAudio(data.play_alarm_sound.url);
        }

        if (data.play_normal_sound) {
            stopAlarmAudio();
            playSound(data.play_normal_sound.url);
        }

        if (data.alarm_mode !== undefined) {
            setAlarmMode(!!data.alarm_mode);
        }

        if (data.puzzle_solved && !redirected) {
            redirected = true;
            stopAlarmAudio();
            playSound('/static/audios/effects/nivel_completado.wav');
            const banner = document.getElementById('p2-solved-banner');
            if (banner) banner.classList.remove('hidden');
            document.body.classList.add('p2-solved-flash');

            setTimeout(() => {
                if (window.PyramidGameFlow?.complete(2)) return;
                const nextId = (typeof NEXT_PUZZLE_ID !== 'undefined' && NEXT_PUZZLE_ID !== null)
                    ? NEXT_PUZZLE_ID
                    : 1;
                window.location.href = '/videoPuzzles/' + nextId;
            }, window.PyramidGameFlow?.managed ? 1300 : 1800);
        }
    }

    function installDebugHelpers() {
        window.puzzle2Debug = {
            push(payload) {
                handleUpdate({ puzzle_id: 2, ...payload });
            },
            reset() {
                stopAlarmAudio();
                clearErrorMarkers();
                handleUpdate({
                    puzzle_id: 2,
                    players: Array.from({ length: 10 }, (_, index) => ({
                        player: index + 1,
                        progress: 0,
                    })),
                });
            },
            progress(player = 1, progress = 1) {
                handleUpdate({
                    puzzle_id: 2,
                    player_update: { player, progress },
                });
            },
            alarm(on = true) {
                handleUpdate({ puzzle_id: 2, alarm_mode: on });
            },
            error(player = 1) {
                handleUpdate({ puzzle_id: 2, error_increment: {player} });
            },
            solved() {
                handleUpdate({ puzzle_id: 2, puzzle_solved: true });
            },
        };
    }

    function loadCurrentState() {
        fetch('/current_state')
            .then((response) => response.json())
            .then((data) => {
                if (!data || data.puzzle_id !== 2) return;
                if (data.sequences) {
                    Object.entries(data.sequences).forEach(([player, sequence]) => {
                        if (Array.isArray(sequence)) {
                            DEFAULT_SEQUENCES[Number(player)] = sequence.slice();
                        }
                    });
                }
                if (data.players) {
                    applySnapshot(data.players);
                }
                if (data.alarm_mode !== undefined) {
                    setAlarmMode(!!data.alarm_mode);
                }
                renderSnakes();
            })
            .catch((err) => console.warn('Failed to load current state for puzzle 2:', err));
    }

    function initSSE() {
        clearErrorMarkers();
        for (let player = 1; player <= PLAYER_COUNT; player++) {
            progressByPlayer[player] = 0;
        }
        renderSnakes();
        updateHudState();
        loadCurrentState();

        if (movementFrame !== null) cancelAnimationFrame(movementFrame);
        lastMovementTime = null;
        lastFrameTime = null;
        movementProgress = 1;
        movementFrame = requestAnimationFrame(animateSnakes);

        const es = new EventSource('/state_stream');
        es.onopen = () => {
            fetch('/start_puzzle/2', { method: 'POST' }).catch((err) => {
                console.warn('Failed to start puzzle 2:', err);
            });
        };
        es.onmessage = (evt) => {
            try {
                const data = JSON.parse(evt.data);
                handleUpdate(data);
            } catch (error) {
                console.warn('Bad SSE data', error);
            }
        };
        es.onerror = () => {
            es.close();
            setTimeout(initSSE, 5000);
        };
    }

    document.addEventListener('DOMContentLoaded', () => {
        installDebugHelpers();
        window.addEventListener('resize', resizeSnakeBoard);
        initSSE();
    });
})();
