(function () {
    const tr = (key, fallback, values = {}) => window.PyramidLanguage?.t?.('game.' + key, fallback, values) ?? fallback;

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
    let redirected = false;
    let exhausted = false;
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
    const hudEl = document.getElementById('p2-hud');
    const timerEl = document.getElementById('p2-timer');
    const pointsValueEl = document.getElementById('p2-points-value');
    let scoring = null;
    let elapsedAnchor = 0;
    let anchoredAt = Date.now();
    let shownClock = '';
    let shownPoints = '';

    function getSequence(player) {
        return DEFAULT_SEQUENCES[player] || [];
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

    function updateScoring(data) {
        if (Array.isArray(data.penalty_thresholds_seconds)) {
            scoring = {
                maxPoints: data.max_points,
                penalty: data.penalty_per_time_band,
                thresholds: data.penalty_thresholds_seconds,
                maxTime: data.max_time_seconds,
            };
        }
        if (Number.isFinite(data.elapsed_seconds)) {
            elapsedAnchor = data.elapsed_seconds;
            anchoredAt = Date.now();
        }
    }

    // The server owns elapsed time and the score rules; this only keeps the
    // display moving between events.
    function renderClock() {
        if (!scoring || !timerEl || !pointsValueEl) return;
        const elapsed = elapsedAnchor + (Date.now() - anchoredAt) / 1000;
        const remaining = Math.max(0, Math.ceil(scoring.maxTime - elapsed));
        const clock = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
        const bands = scoring.thresholds.filter((threshold) => elapsed >= threshold).length;
        const points = String(Math.max(0, scoring.maxPoints - scoring.penalty * bands));
        if (clock !== shownClock) {
            shownClock = clock;
            timerEl.textContent = clock;
            timerEl.classList.toggle('is-low', remaining <= 60);
        }
        if (points !== shownPoints) {
            shownPoints = points;
            pointsValueEl.textContent = points;
        }
    }

    // Cells under the HUD are closed to the snakes so they never cross it.
    function isBlockedCell(x, y) {
        if (!hudEl) return false;
        // offsetLeft/Top ignore the centring transform, so measure the real box.
        const box = hudEl.getBoundingClientRect();
        const stage = snakeStageEl.getBoundingClientRect();
        // The board may be scaled by CSS; cells use unscaled board pixels.
        const scale = snakeStageEl.offsetWidth ? stage.width / snakeStageEl.offsetWidth : 1;
        const left = (box.left - stage.left) / scale;
        const top = (box.top - stage.top) / scale;
        return x * CELL_SIZE < left + box.width / scale
            && (x + 1) * CELL_SIZE > left
            && y * CELL_SIZE < top + box.height / scale
            && (y + 1) * CELL_SIZE > top;
    }

    function isTrailClear(trail, columns, rows) {
        return trail.every((point) => (
            point.x >= 0 && point.x < columns && point.y >= 0 && point.y < rows
            && !isBlockedCell(point.x, point.y)
        ));
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
        const startX = 1 + ((player * 3) % Math.max(1, columns - 2));
        const startY = 1 + ((player * 5) % Math.max(1, rows - 2));
        const buildTrail = (headX, headY) => {
            const trail = [{x: headX, y: headY}];
            for (let index = 1; index <= TOTAL; index++) {
                trail.push({x: headX - direction.x * index, y: headY - direction.y * index});
            }
            return trail;
        };

        // Scan from the intended start for the first spot clear of the HUD.
        let trail = buildTrail(startX, startY);
        for (let offset = 1; offset < columns * rows && !isTrailClear(trail, columns, rows); offset++) {
            const index = (startY * columns + startX + offset) % (columns * rows);
            trail = buildTrail(index % columns, Math.floor(index / columns));
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
        marker.setAttribute('aria-label', tr('snakeWrong', 'Respuesta incorrecta para el token {token}, símbolo {symbol}', {token: TOKEN_BY_PLAYER[player - 1], symbol: index + 1}));
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
            let state = snakePositions.get(player);
            if (!state) continue;
            // Layout can change without a resize (fonts, HUD size): self-heal.
            if (!isTrailClear(state.trail, columns, rows)) {
                state = createSnakeState(player);
                snakePositions.set(player, state);
            }

            const head = state.trail[0];
            const canMove = (direction) => {
                const x = head.x + direction.x;
                const y = head.y + direction.y;
                return x >= 0 && x < columns && y >= 0 && y < rows && !isBlockedCell(x, y);
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
                    // Boxed in: back out by swapping head and tail.
                    state.trail.reverse();
                    state.previousTrail = state.trail.slice();
                    const [first, second] = state.trail;
                    if (second && (first.x !== second.x || first.y !== second.y)) {
                        state.direction = {x: first.x - second.x, y: first.y - second.y};
                    }
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
        renderClock();
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
        snakePositions.forEach((state, player) => {
            if (!isTrailClear(state.trail, columns, rows)) {
                snakePositions.set(player, createSnakeState(player));
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
        if (window.PyramidLevelVictory?.active) return;
        if (data.puzzle_id !== 2) return;
        if (exhausted || redirected) return;
        updateScoring(data);
        renderClock();
        if (data.puzzle_exhausted) {
            exhausted = true;
            stopAlarmAudio();
            clearErrorMarkers();
            setAlarmMode(false);
            if (movementFrame !== null) cancelAnimationFrame(movementFrame);
            const nextId = window.NEXT_PUZZLE_ID ?? window.PYRAMID_GAME?.finalId;
            if (!Number.isInteger(nextId)) {
                console.error('Cannot advance exhausted puzzle 2: missing next puzzle ID');
                return;
            }
            const path = '/presentacio/' + nextId;
            const language = window.PyramidLanguage?.current?.() || window.PYRAMID_GAME?.language || 'es';
            const url = window.PyramidLanguage?.path?.(path, language) || path + '?lang=' + encodeURIComponent(language);
            redirected = true;
            window.location.assign(url);
            return;
        }

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
            window.PyramidLevelVictory.complete(2);
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
        return fetch('/current_state')
            .then((response) => response.json())
            .then((data) => {
                if (!data || data.puzzle_id !== 2) return;
                handleUpdate(data);
            })
            .catch((err) => console.warn('Failed to load current state for puzzle 2:', err));
    }

    function initSSE() {
        if (exhausted || redirected) return;
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
            fetch('/start_puzzle/2', { method: 'POST' })
                .then(loadCurrentState)
                .catch((err) => {
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
