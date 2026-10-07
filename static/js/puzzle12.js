(function () {
    const INTER_ROUND_PAUSE_MS = 6000;
    // Same order as Puzzle12.botons and the hardware button payload.
    const BUTTON_COLORS = [
        { name: 'Negro', className: 'black' },
        { name: 'Verde', className: 'green' },
        { name: 'Rojo', className: 'red' },
        { name: 'Amarillo', className: 'yellow' },
        { name: 'Azul', className: 'blue' },
        { name: 'Blanco', className: 'white' }
    ];
    let timerInterval = null;
    let timeLeft = 0;
    let countdownInterval = null;
    let redirectTimeout = null;
    let interRoundPauseTimer = null;
    let interRoundPauseActive = false;
    let queuedStartRoundUpdate = null;
    let currentRound = null;
    let totalRounds = null;
    let currentLevelId = null;
    let hasStartedRound = false;
    let ballAnimationFrame = null;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const patternEl = document.getElementById('button-pattern');
    const timerEl = document.getElementById('timer-overlay');
    const wrongEl = document.getElementById('wrong-img');
    const goodEl = document.getElementById('good-img');
    const waitScreen = document.getElementById('wait-screen');
    const countdownEl = document.getElementById('countdown-number');
    const roundLevelsEl = document.getElementById('final-levels');
    let roundCards = [];
    const roundIndicatorEl = document.getElementById('final-round-indicator');
    const statusChipEl = document.getElementById('final-status-chip');
    const phaseTitleEl = document.getElementById('final-phase-title');
    const phaseCopyEl = document.getElementById('final-phase-copy');
    const statusTitleEl = document.getElementById('final-status-title');
    const statusCopyEl = document.getElementById('final-status-copy');

    function startInterRoundPause() {
        interRoundPauseActive = true;
        if (interRoundPauseTimer) {
            clearTimeout(interRoundPauseTimer);
        }
        interRoundPauseTimer = setTimeout(() => {
            interRoundPauseTimer = null;
            interRoundPauseActive = false;
            if (queuedStartRoundUpdate) {
                const nextUpdate = queuedStartRoundUpdate;
                queuedStartRoundUpdate = null;
                handleUpdate(nextUpdate);
            }
        }, INTER_ROUND_PAUSE_MS);
    }

    function setText(el, value) {
        if (el) el.textContent = value;
    }

    function setStateClasses(el, state) {
        if (!el) return;
        el.classList.remove('is-idle', 'is-countdown', 'is-active', 'is-success', 'is-failure');
        el.classList.add(`is-${state}`);
    }

    function setStatus(state, title, copy, chipText) {
        setStateClasses(statusChipEl, state);
        setText(statusChipEl, chipText);
        setText(statusTitleEl, title);
        setText(statusCopyEl, copy);
    }

    function setPhase(title, copy) {
        setText(phaseTitleEl, title);
        setText(phaseCopyEl, copy);
    }

    function renderRoundCards(total) {
        if (!roundLevelsEl) {
            roundCards = [];
            return;
        }

        const safeTotal = Math.max(0, Number(total) || 0);
        roundLevelsEl.innerHTML = '';
        roundLevelsEl.style.gridTemplateRows = safeTotal > 0 ? `repeat(${safeTotal}, minmax(0, 1fr))` : '';

        for (let round = 1; round <= safeTotal; round += 1) {
            const card = document.createElement('div');
            card.className = 'final-level';
            card.dataset.roundCard = String(round);

            const value = document.createElement('span');
            value.className = 'final-level-value';
            value.textContent = String(round);

            card.appendChild(value);
            roundLevelsEl.appendChild(card);
        }

        roundCards = Array.from(roundLevelsEl.querySelectorAll('.final-level'));
    }

    function updateRoundIndicator(round = 0, total = roundCards.length, state = 'idle') {
        setStateClasses(roundIndicatorEl, state);
        if (!roundIndicatorEl) return;
        roundIndicatorEl.textContent = round > 0 ? `Ronda ${round}/${total}` : `Ronda 0/${total}`;
    }

    function resetViewport() {
        stopBallMotion();
        document.body.classList.remove('p12-danger-state', 'p12-success-state');
        patternEl.style.display = 'none';
        wrongEl.style.display = 'none';
        goodEl.style.display = 'none';
        waitScreen.style.display = 'none';
        countdownEl.textContent = '';
    }

    function showSuccessFeedback() {
        clearInterval(timerInterval);
        clearInterval(countdownInterval);
        resetViewport();
        timerEl.style.display = 'none';
        goodEl.style.display = 'flex';
        document.body.classList.add('p12-success-state');
    }

    function showTimeoutFeedback() {
        clearInterval(timerInterval);
        clearInterval(countdownInterval);
        resetViewport();
        timerEl.style.display = 'none';
        wrongEl.style.display = 'flex';
        document.body.classList.add('p12-danger-state');
        setStatus('failure', 'Temps esgotat', 'Es tornarà a preparar el mateix nivell.', 'Error');
        setPhase('Reiniciant la ronda', 'Prepareu l’equip per a la següent combinació de colors.');
    }

    function updateRoundHud(round) {
        roundCards.forEach(card => {
            const cardRound = Number(card.dataset.roundCard);
            card.classList.remove('is-active', 'is-complete');
            if (round > cardRound) {
                card.classList.add('is-complete');
            } else if (round === cardRound) {
                card.classList.add('is-active');
            }
        });
    }

    function playEffect(file) {
        try {
            const audio = new Audio(`/static/audios/effects/${file}`);
            audio.play().catch(() => {}); // ignore autoplay restrictions
        } catch (e) {
            console.warn("Failed to play effect:", file, e);
        }
    }

    function stopBallMotion() {
        if (ballAnimationFrame !== null) {
            cancelAnimationFrame(ballAnimationFrame);
            ballAnimationFrame = null;
        }
    }

    function startBallMotion() {
        stopBallMotion();
        const elements = Array.from(patternEl.children);
        const width = patternEl.clientWidth;
        const height = patternEl.clientHeight;
        if (!elements.length || !width || !height) return;

        // Convert screen coordinates back to the scaled game-stage coordinates.
        const bounds = patternEl.getBoundingClientRect();
        const clock = timerEl.getBoundingClientRect();
        const scaleX = bounds.width / width;
        const scaleY = bounds.height / height;
        const obstacle = {
            left: (clock.left - bounds.left) / scaleX,
            right: (clock.right - bounds.left) / scaleX,
            top: (clock.top - bounds.top) / scaleY,
            bottom: (clock.bottom - bounds.top) / scaleY
        };
        const gap = 12;
        const edge = 18 + Math.min(width, height) * 0.08;
        let diameter = Math.max(26, Math.min(width * 0.065, height * 0.12, 104));
        let margin;
        let horizontal;
        let vertical;
        let perimeter;
        // Leave room for the larger balls and maintain separation at corners.
        while (diameter >= 8) {
            const radius = diameter / 2;
            margin = radius + edge;
            horizontal = width - margin * 2;
            vertical = height - margin * 2;
            perimeter = 2 * (horizontal + vertical);
            if (horizontal > diameter + gap && vertical > diameter + gap &&
                perimeter / elements.length >= Math.SQRT2 * (diameter + gap) &&
                margin + radius + gap <= obstacle.left &&
                width - margin - radius - gap >= obstacle.right &&
                margin + radius + gap <= obstacle.top &&
                height - margin - radius - gap >= obstacle.bottom) break;
            diameter -= 2;
        }
        if (diameter < 8) {
            console.warn('Not enough space for the puzzle 12 button pattern');
            return;
        }
        const radius = diameter / 2;
        const spacing = perimeter / elements.length;
        const speed = 74.8;
        let offset = 0;
        elements.forEach(el => { el.style.width = `${diameter}px`; });
        function render() {
            elements.forEach((el, index) => {
                const distance = (offset + index * spacing) % perimeter;
                let x;
                let y;
                if (distance < horizontal) {
                    x = margin + distance;
                    y = margin;
                } else if (distance < horizontal + vertical) {
                    x = width - margin;
                    y = margin + distance - horizontal;
                } else if (distance < horizontal * 2 + vertical) {
                    x = width - margin - (distance - horizontal - vertical);
                    y = height - margin;
                } else {
                    x = margin;
                    y = height - margin - (distance - horizontal * 2 - vertical);
                }
                el.style.transform = `translate(${x - radius}px, ${y - radius}px)`;
            });
        }
        render();
        if (reducedMotion.matches) return;

        let lastTime = null;
        function animate(now) {
            // No large jumps when a background tab becomes visible again.
            const dt = lastTime === null ? 0 : Math.min((now - lastTime) / 1000, 0.033);
            lastTime = now;
            offset = (offset + speed * dt) % perimeter;
            render();
            ballAnimationFrame = requestAnimationFrame(animate);
        }
        ballAnimationFrame = requestAnimationFrame(animate);
    }

    function showButtonPattern(target, duration) {
        resetViewport();
        patternEl.replaceChildren();
        patternEl.setAttribute('aria-label', BUTTON_COLORS.map((color, index) =>
            `${window.PyramidLanguage?.t('game.colour' + color.className, color.name) || color.name}: ${target[index]} botons`).join(', '));
        const colors = [];
        BUTTON_COLORS.forEach((color, index) => {
            for (let count = 0; count < target[index]; count += 1) {
                colors.push(color);
            }
        });
        // Mix the colors without changing the required number of buttons.
        for (let index = colors.length - 1; index > 0; index -= 1) {
            const other = Math.floor(Math.random() * (index + 1));
            [colors[index], colors[other]] = [colors[other], colors[index]];
        }
        colors.forEach(color => {
            const ball = document.createElement('span');
            ball.className = `button-ball button-ball--${color.className}`;
            ball.setAttribute('aria-hidden', 'true');
            patternEl.appendChild(ball);
        });
        patternEl.style.display = 'block';
        timerEl.style.display = 'block';
        startTimer(duration);
        startBallMotion();
    }

    function refreshBallMotion() {
        if (patternEl.style.display === 'block') startBallMotion();
    }
    window.addEventListener('resize', refreshBallMotion, { passive: true });
    reducedMotion.addEventListener('change', refreshBallMotion);

    function startTimer(seconds) {
        clearInterval(timerInterval);
        timeLeft = seconds;
        updateTimerDisplay();
        timerInterval = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();
            if (timeLeft <= 0) {
                showTimeoutFeedback();
                playEffect('fase_nocompletada.wav');
                fetch('/timer_expired', { method: 'POST' })
                    .catch(err => console.warn("Failed to notify timer expired:", err));
            }
        }, 1000);
    }

    
    function updateTimerDisplay() {
        const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
        const s = (timeLeft % 60).toString().padStart(2, '0');
        timerEl.textContent = `${m}:${s}`;
    }

    function showWaitCountdown(onDone) {
        clearInterval(countdownInterval);
        resetViewport();
        timerEl.style.display = 'none';
        waitScreen.style.display = 'block';
        waitScreen.classList.add('is-countdown');
        setStatus(
            'countdown',
            'Compte enrere actiu',
            'La pantalla està preparant la següent projecció. El cronòmetre començarà quan aparegui la seqüència.',
            'Preparant'
        );
        setPhase(
            'Nova seqüència imminent',
            'Cada bola representa un botó del mateix color que cal mantenir premut.'
        );

        let count = 3;
        countdownEl.textContent = count;
        playEffect('beep_countdown.wav');

        countdownInterval = setInterval(() => {
            count--;
            if (count <= 0) {
                clearInterval(countdownInterval);
                countdownInterval = null;
                waitScreen.style.display = 'none';
                waitScreen.classList.remove('is-countdown');
                countdownEl.textContent = '';
                onDone();
            } else {
                playEffect('beep_countdown.wav');
                countdownEl.textContent = count;
            }
        }, 1000);
    }

    function showIdlePyramid() {
        resetViewport();
        timerEl.style.display = 'none';
        waitScreen.style.display = 'block';
        waitScreen.classList.remove('is-countdown');
        countdownEl.textContent = '';
    }

    function handleUpdate(d) {
        if (!d || d.puzzle_id !== 12) return;
        if (interRoundPauseActive && d.startRound) {
            queuedStartRoundUpdate = d;
            return;
        }

        console.log("Received update:", d);

        if (d.streak_solved) {
            clearInterval(countdownInterval);
            playEffect('fase_completada.wav');
            if (currentRound > 0 && totalRounds > 0 && currentRound < totalRounds) {
                startInterRoundPause();
            }
            showSuccessFeedback();
            setStatus(
                'success',
                'Nivell completat',
                'La configuració s’ha mantingut estable. El sistema valida la fase abans de saltar a la següent ronda.',
                'Correcte'
            );
            setPhase(
                'Seqüència consolidada',
                'Nivell superat. Prepareu l’equip per a la següent ronda.'
            );
        }

        if (d.startRound) {
            if (!Array.isArray(d.target) || d.target.length !== BUTTON_COLORS.length ||
                !d.target.every(count => Number.isInteger(count) && count >= 0)) {
                console.warn('Missing or invalid puzzle 12 button target:', d.target);
                return;
            }
            // Save round info for later use in streak_solved event
            currentRound = d.round;
            totalRounds = d.total_rounds;
            currentLevelId = d.level_id || d.round;
            renderRoundCards(d.total_rounds);
            updateRoundHud(d.round);
            updateRoundIndicator(d.round, d.total_rounds, 'countdown');
            if (d.round > d.total_rounds) {
                console.log("Puzzle solved!");
                return;
            }
            const beginRound = () => {
                showButtonPattern(d.target, d.duration);
                updateRoundIndicator(d.round, d.total_rounds, 'active');
                setStatus(
                    'active',
                    `Ronda ${d.round} en curs`,
                    'La projecció està activa. Manteniu la combinació correcta fins que el temporitzador arribi a zero o la fase es validi.',
                    'Activa'
                );
                setPhase(
                    `Sincronitzeu el nivell ${currentLevelId}`,
                    'Premeu un botó per cada bola del mateix color i manteniu la combinació fins que es validi.'
                );
            };
            if (hasStartedRound) {
                showWaitCountdown(beginRound);
            } else {
                // The presentation already counts down before the game starts.
                hasStartedRound = true;
                beginRound();
            }
        }

        if (d.puzzle_solved) {
            playEffect('nivel_completado.wav');
            clearTimeout(interRoundPauseTimer);
            interRoundPauseTimer = null;
            interRoundPauseActive = false;
            queuedStartRoundUpdate = null;
            showSuccessFeedback();
            document.getElementById('p12-solved-banner')?.classList.remove('hidden');
            setTimeout(function () {
                if (window.PyramidGameFlow?.complete(12)) return;
                var nextId = (typeof NEXT_PUZZLE_ID !== 'undefined' && NEXT_PUZZLE_ID !== null)
                    ? NEXT_PUZZLE_ID : 1;
                fetch('/videoPuzzles/' + nextId, { method: 'POST' })
                    .then(function (response) {
                        if (response.redirected) {
                            window.location.href = response.url;
                        } else {
                            window.location.href = '/videoPuzzles/' + nextId;
                        }
                    })
                    .catch(function () {
                        window.location.href = '/videoPuzzles/' + nextId;
                    });
            }, 4000);
            return;
        }
    }

    function initSSE() {
        const es = new EventSource("/state_stream");
        es.onopen = () => {
            fetch("/start_puzzle/12", { method: "POST" })
                .catch(err => console.warn("Failed to start puzzle 12:", err));
        };
        es.onmessage = (evt) => {
            try {handleUpdate(JSON.parse(evt.data));} catch (e) { console.warn("Bad SSE data", e);}
        };
    }

    function installDebugHelpers() {
        window.puzzle12Debug = {
            push(payload) {
                handleUpdate({ puzzle_id: 12, ...payload });
            },
            start(round = 1, gif = 1, duration = 45, target = [2, 2, 5, 2, 2, 2]) {
                this.round(round, gif, duration, target);
            },
            round(round = 1, gif = 1, duration = 45, target = [2, 2, 5, 2, 2, 2]) {
                handleUpdate({
                    puzzle_id: 12,
                    startRound: true,
                    round,
                    total_rounds: Math.max(round, roundCards.length || 1),
                    level_id: 2,
                    num_giff: gif,
                    target,
                    duration
                });
            },
            partial(round = 1, total = roundCards.length || 3) {
                renderRoundCards(total);
                updateRoundHud(round);
                updateRoundIndicator(round, total, 'active');
                setStatus('active', `Ronda ${round} en curs`, 'Vista parcial de la fase activa sense reiniciar temporitzadors.', 'Activa');
            },
            success() {
                handleUpdate({ puzzle_id: 12, streak_solved: true });
            },
            failure() {
                this.error();
            },
            solved() {
                handleUpdate({ puzzle_id: 12, puzzle_solved: true });
            },
            error() {
                showTimeoutFeedback();
            },
            wait() {
                showWaitCountdown(() => {});
            },
            demo() {
                this.start(1, 1, 12);
                setTimeout(() => this.success(), 5000);
                setTimeout(() => this.start(2, 2, 12), 9000);
            }
        };
    }

    document.addEventListener("DOMContentLoaded", () => {
        const messages = {
            es: { success: 'NIVEL SUPERADO', timeout: 'SE ACABÓ EL TIEMPO' },
            ca: { success: 'NIVELL SUPERAT', timeout: 'TEMPS ESGOTAT' },
            eng: { success: 'LEVEL COMPLETED', timeout: 'TIME IS UP' }
        };
        const language = window.PYRAMID_GAME?.language || 'es';
        const feedback = messages[language] || messages.es;
        setText(goodEl.querySelector('.p12-success-text'), feedback.success);
        setText(wrongEl.querySelector('.p12-timeout-text'), feedback.timeout);
        renderRoundCards(0);
        updateRoundIndicator(0, roundCards.length, 'idle');
        showIdlePyramid();
        installDebugHelpers();
        initSSE();
    });
})();
