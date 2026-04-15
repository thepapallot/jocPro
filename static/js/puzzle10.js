(function () {
    const cards = new Map(
        Array.from(document.querySelectorAll('.led-card')).map(card => [Number(card.dataset.box), card])
    );
    const statusBadge = document.getElementById('p10-status');
    const timerBadge = document.getElementById('timer');

    let solved = false;
    let snapshotLoaded = false;
    let roundSeconds = 60;
    let secondsLeft = roundSeconds;
    let timerId = null;
    let expireInFlight = false;
    let lastTimerExpiredSoundAt = 0;
    let timeoutPauseInProgress = false;
    let hydratingSnapshot = false;
    let audioUnlocked = false;
    const pendingSoundUrls = [];
    const soundCache = new Map();
    const TIMEOUT_PAUSE_MS = 3000;

    const BOX_OK_SOUND_URL = '/static/audios/effects/correcte.wav';
    const TIMER_EXPIRED_SOUND_URL = '/static/audios/effects/fase_nocompletada.wav';
    const PUZZLE_COMPLETE_SOUND_URL = '/static/audios/effects/nivel_completado.wav';
    const ROUND_RESET_SOUND_URL = '/static/audios/effects/apareix_contingut.wav';
    const SOUND_URLS = [
        BOX_OK_SOUND_URL,
        TIMER_EXPIRED_SOUND_URL,
        PUZZLE_COMPLETE_SOUND_URL,
        ROUND_RESET_SOUND_URL
    ];

    function getCachedAudio(url) {
        if (!soundCache.has(url)) {
            const audio = new Audio(url);
            audio.preload = 'auto';
            soundCache.set(url, audio);
        }
        return soundCache.get(url);
    }

    function queueSound(url) {
        if (pendingSoundUrls.length >= 20) {
            pendingSoundUrls.shift();
        }
        pendingSoundUrls.push(url);
    }

    function flushPendingSounds() {
        if (!pendingSoundUrls.length) return;
        const queue = pendingSoundUrls.splice(0, pendingSoundUrls.length);
        queue.forEach((url) => playSound(url));
    }

    function unlockAudio() {
        if (audioUnlocked) return;

        SOUND_URLS.forEach((url) => {
            getCachedAudio(url).load();
        });

        const warm = getCachedAudio(BOX_OK_SOUND_URL);
        const previousVolume = warm.volume;
        warm.volume = 0;
        warm.currentTime = 0;
        warm.play()
            .then(() => {
                warm.pause();
                warm.currentTime = 0;
                warm.volume = previousVolume;
                audioUnlocked = true;
                flushPendingSounds();
            })
            .catch(() => {
                warm.volume = previousVolume;
            });
    }

    function playSound(url) {
        const audio = getCachedAudio(url);
        audio.currentTime = 0;
        audio.play().catch(err => {
            if (!audioUnlocked || document.hidden) {
                queueSound(url);
            }
            console.warn('Audio play failed:', err);
        });
    }

    function playTimerExpiredSound() {
        const now = Date.now();
        if (now - lastTimerExpiredSoundAt < 800) return;
        lastTimerExpiredSoundAt = now;
        playSound(TIMER_EXPIRED_SOUND_URL);
    }

    function formatSeconds(totalSeconds) {
        const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
        const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
        const seconds = String(safeSeconds % 60).padStart(2, '0');
        return `${minutes}:${seconds}`;
    }

    function updateTimer(secondsLeft) {
        if (!timerBadge || typeof secondsLeft !== 'number') return;
        timerBadge.textContent = formatSeconds(secondsLeft);
        timerBadge.classList.remove('warning', 'expired');

        if (secondsLeft <= 0) {
            timerBadge.classList.add('expired');
            return;
        }

        if (secondsLeft <= 15) {
            timerBadge.classList.add('warning');
        }


    }


    function setRoundSeconds(value) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return;

        const normalized = Math.max(1, Math.floor(parsed));
        roundSeconds = normalized;
    }

    function resetRoundTimer({ silent = false } = {}) {
        secondsLeft = roundSeconds;
        timeoutPauseInProgress = false;
        updateTimer(secondsLeft);
        if (!silent) {
            playSound(ROUND_RESET_SOUND_URL);
        }
    }

    function notifyTimerExpired() {
        if (expireInFlight || solved) return;
        expireInFlight = true;
        fetch('/timer_expired', { method: 'POST' })
            .catch(err => console.warn('Failed to notify timer expiration:', err))
            .finally(() => {
                expireInFlight = false;
            });
    }

    function startFrontendTimer() {
        if (timerId !== null) return;

        timerId = window.setInterval(() => {
            if (solved) {
                return;
            }

            if (timeoutPauseInProgress) {
                return;
            }

            secondsLeft -= 1;
            if (secondsLeft <= 0) {
                secondsLeft = 0;
                updateTimer(secondsLeft);
                playTimerExpiredSound();
                timeoutPauseInProgress = true;
                window.setTimeout(() => {
                    if (solved) {
                        timeoutPauseInProgress = false;
                        return;
                    }

                    resetRoundTimer();
                    notifyTimerExpired({ silent: false });
                }, TIMEOUT_PAUSE_MS);
                return;
            }

            updateTimer(secondsLeft);
        }, 1000);
    }

    function stopFrontendTimer() {
        if (timerId !== null) {
            window.clearInterval(timerId);
            timerId = null;
        }
    }

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
        if (!card) return false;
        const wasSolved = card.classList.contains('is-solved');
        card.classList.add('is-solved');
        if (animate && !wasSolved) {
            pulseCard(card);
        }
        updateStatus();
        return !wasSolved;
    }

    function renderCodeForBox(box, code) {
        const card = cards.get(box);
        if (!card || typeof code !== 'string' || code.length !== 3) return;

        card.dataset.code = code;
        const stripWindow = card.querySelector('.led-strip-window');
        if (!stripWindow) return;

        stripWindow.innerHTML = '';
        for (let i = code.length - 1; i >= 0; i -= 1) {
            const digit = code[i];
            const segment = document.createElement('div');
            segment.className = `led-segment color-${digit}`;
            stripWindow.appendChild(segment);
        }
    }

    function renderTargets(targets) {
        if (!targets || typeof targets !== 'object') return;
        Object.entries(targets).forEach(([box, code]) => {
            renderCodeForBox(Number(box), String(code));
        });
    }

    function handleUpdate(d) {
        if (!d || d.puzzle_id !== 10) return;

        let solvedThisUpdateCount = 0;

        if (typeof d.round_seconds === 'number') {
            const previousRoundSeconds = roundSeconds;
            setRoundSeconds(d.round_seconds);
            if (previousRoundSeconds !== roundSeconds) {
                resetRoundTimer({ silent: true });
            }
        }

        renderTargets(d.box_targets);

        if (d.reshuffled) {
            resetRoundTimer();
        }

        if (Array.isArray(d.solved_boxes)) {
            d.solved_boxes.forEach(box => {
                if (setSolved(box)) {
                    solvedThisUpdateCount += 1;
                }
            });
        }

        if (typeof d.solved_box === 'number') {
            if (setSolved(d.solved_box, { animate: true })) {
                solvedThisUpdateCount += 1;
            }
        }

        if (solvedThisUpdateCount > 0 && !hydratingSnapshot) {
            for (let i = 0; i < solvedThisUpdateCount; i += 1) {
                playSound(BOX_OK_SOUND_URL);
            }
        }

        if (d.puzzle_solved && !solved) {
            solved = true;
            stopFrontendTimer();
            playSound(PUZZLE_COMPLETE_SOUND_URL);
            setTimeout(() => (window.location.href = '/puzzleSuperat/10'), 1500);
        }
    }

    function loadSnapshot() {
        if (snapshotLoaded) return;
        snapshotLoaded = true;
        fetch('/current_state')
            .then(r => r.json())
            .then(d => {
                hydratingSnapshot = true;
                handleUpdate(d);
                hydratingSnapshot = false;
                updateStatus();
            })
            .catch(() => {
                hydratingSnapshot = false;
            });
    }

    function initSSE() {
        const es = new EventSource('/state_stream');
        es.onmessage = evt => {
            try {
                handleUpdate(JSON.parse(evt.data));
            } catch {}
        };
        es.onopen = () => {
            fetch('/start_puzzle/10', { method: 'POST' })
                .catch(err => console.warn('Failed to start puzzle 10:', err));
        };
    }

    function initAudioPolicyHandling() {
        const unlockHandler = () => unlockAudio();

        document.addEventListener('pointerdown', unlockHandler, { passive: true });
        document.addEventListener('keydown', unlockHandler);
        document.addEventListener('touchstart', unlockHandler, { passive: true });

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                flushPendingSounds();
            }
        });

        window.addEventListener('focus', () => {
            flushPendingSounds();
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        initAudioPolicyHandling();
        updateStatus();
        resetRoundTimer();
        loadSnapshot();
        initSSE();
        startFrontendTimer();
    });
})();
