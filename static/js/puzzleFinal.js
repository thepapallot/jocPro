(function () {
    let timerInterval = null;
    let timeLeft = 0;
    let countdownInterval = null;
    let redirectTimeout = null;

    const gifEl = document.getElementById('fase-gif');
    const timerEl = document.getElementById('timer-overlay');
    const wrongEl = document.getElementById('wrong-img');
    const goodEl = document.getElementById('good-img');
    const waitScreen = document.getElementById('wait-screen');
    const countdownEl = document.getElementById('countdown-number');
    const roundCards = Array.from(document.querySelectorAll('.final-level'));
    const roundIndicatorEl = document.getElementById('final-round-indicator');
    const statusChipEl = document.getElementById('final-status-chip');
    const phaseTitleEl = document.getElementById('final-phase-title');
    const phaseCopyEl = document.getElementById('final-phase-copy');
    const statusTitleEl = document.getElementById('final-status-title');
    const statusCopyEl = document.getElementById('final-status-copy');

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

    function updateRoundIndicator(round = 0, total = roundCards.length, state = 'idle') {
        setStateClasses(roundIndicatorEl, state);
        if (!roundIndicatorEl) return;
        roundIndicatorEl.textContent = round > 0 ? `Ronda ${round}/${total}` : `Ronda 0/${total}`;
    }

    function resetViewport() {
        gifEl.style.display = 'none';
        wrongEl.style.display = 'none';
        goodEl.style.display = 'none';
        waitScreen.style.display = 'none';
        countdownEl.textContent = '';
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

    function getGifUrl(streakId, giffIndex) {
        if (streakId !== 4) {
            return `/static/images/puzzleFinal/imatges/fase${streakId}_${giffIndex}.gif`;
        }

        if (streakId === 4) {
            return `/static/images/puzzleFinal/imatges/fase4_1.gif`;
        }
    }

    function showGif(streakId, giffIndex, duration) {
        const url = getGifUrl(streakId, giffIndex);
        resetViewport();
        gifEl.src = url + '?t=' + Date.now();
        gifEl.style.display = 'block';
        timerEl.style.display = 'block';
        startTimer(duration);
    }

    function startTimer(seconds) {
        clearInterval(timerInterval);
        timeLeft = seconds;
        updateTimerDisplay();
        timerInterval = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                timerEl.style.display = 'none';
                gifEl.style.display = 'none';
                wrongEl.style.display = 'block';
                setStatus(
                    'failure',
                    'Temps esgotat',
                    'La finestra s’ha tancat. El sistema recarrega la mateixa ronda abans de tornar a projectar la seqüencia.',
                    'Error'
                );
                setPhase(
                    'Reiniciant la ronda',
                    'Mantén la configuració a punt. En uns segons es tornarà a projectar un nou patró per a aquest mateix nivell.'
                );
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
            'La pantalla està preparant la següent projecció. El cronòmetre començarà quan aparegui la seqüencia.',
            'Preparant'
        );
        setPhase(
            'Nova seqüencia imminent',
            'Observa l’entrada del GIF i prepara l’equip per reproduir la configuració correcta dins del temps marcat.'
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
        if (!d || d.puzzle_id !== -1) return;

        console.log("Received update:", d);

        if (d.streak_solved) {
            clearInterval(countdownInterval);
            playEffect('fase_completada.wav');
            clearInterval(timerInterval);
            gifEl.style.display = 'none';
            timerEl.style.display = 'none';
            wrongEl.style.display = 'none';
            goodEl.style.display = 'block';
            setStatus(
                'success',
                'Nivell completat',
                'La configuració s’ha mantingut estable. El sistema valida la fase abans de saltar a la següent ronda.',
                'Correcte'
            );
            setPhase(
                'Seqüencia consolidada',
                'Manteniu la calma: la piràmide està absorbint l’energia correcta i tancarà la ronda en breus instants.'
            );
        }

        if (d.startRound) {
            updateRoundHud(d.round);
            updateRoundIndicator(d.round, d.total_rounds, 'countdown');
            if (d.round > d.total_rounds) {
                console.log("Puzzle solved!");
                return;
            }
            showWaitCountdown(() => {
                showGif(d.round, d.num_giff, d.duration);
                updateRoundIndicator(d.round, d.total_rounds, 'active');
                setStatus(
                    'active',
                    `Ronda ${d.round} en curs`,
                    'La projecció està activa. Mantén la combinació correcta fins que el temporitzador arribi a zero o la fase es validi.',
                    'Activa'
                );
                setPhase(
                    `Sincronitza el nivell ${d.round}`,
                    'Reprodueix el patró mostrat pel GIF i sostén-lo el temps suficient perquè el sistema confirmi la lectura.'
                );
            });
        }

        if (d.puzzle_solved) {
            console.log("Puzzle solved!");
            clearInterval(countdownInterval);
            playEffect('nivel_completado.wav');
            clearTimeout(redirectTimeout);
            setStatus(
                'success',
                'Protocol complet',
                'Les quatre rondes s’han validat. La seqüencia final s’està tancant abans de passar a la pantalla de culminació.',
                'Completat'
            );
            setPhase(
                'Piramide sincronitzada',
                'El sistema ha acabat la fase final. Es mostrarà l’escena de tancament en uns instants.'
            );
            updateRoundIndicator(roundCards.length, roundCards.length, 'success');

            redirectTimeout = setTimeout(() => {
                console.log("Redirecting to Final");
                const target = window.PUZZLE_FINAL_OUTRO_URL || "/final";
                window.location.replace(target);
            }, 3000);
            return;
        }
    }

    function initSSE() {
        const es = new EventSource("/state_stream");
        es.onopen = () => {
            fetch("/start_puzzle_final", { method: "POST" })
                //.then(() => startStreak(0))
                .catch(err => console.warn("Failed to start puzzle final:", err));
        };
        es.onmessage = (evt) => {
            try {handleUpdate(JSON.parse(evt.data));} catch (e) { console.warn("Bad SSE data", e);}
        };
    }

    function installDebugHelpers() {
        window.puzzleFinalDebug = {
            push(payload) {
                handleUpdate({ puzzle_id: -1, ...payload });
            },
            start(round = 1, gif = 1, duration = 30) {
                this.round(round, gif, duration);
            },
            round(round = 1, gif = 1, duration = 30) {
                handleUpdate({
                    puzzle_id: -1,
                    startRound: true,
                    round,
                    total_rounds: 4,
                    num_giff: gif,
                    duration
                });
            },
            partial(round = 1, total = 4) {
                updateRoundHud(round);
                updateRoundIndicator(round, total, 'active');
                setStatus('active', `Ronda ${round} en curs`, 'Vista parcial de la fase activa sense reiniciar temporitzadors.', 'Activa');
            },
            success() {
                handleUpdate({ puzzle_id: -1, streak_solved: true });
            },
            failure() {
                this.error();
            },
            solved() {
                handleUpdate({ puzzle_id: -1, puzzle_solved: true });
            },
            error() {
                clearInterval(timerInterval);
                gifEl.style.display = 'none';
                timerEl.style.display = 'none';
                goodEl.style.display = 'none';
                wrongEl.style.display = 'block';
                setStatus('failure', 'Temps esgotat', 'Preview local de l’estat d’error abans de reiniciar la ronda.', 'Error');
                setPhase('Reiniciant la ronda', 'La seqüencia ha fallat i es tornarà a preparar el mateix nivell.');
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
        updateRoundIndicator(0, roundCards.length, 'idle');
        showIdlePyramid();
        installDebugHelpers();
        initSSE();
    });
})();
