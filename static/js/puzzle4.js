(function() {
    const tr = (key, fallback, values = {}) => window.PyramidLanguage?.t?.('game.' + key, fallback, values) ?? fallback;

    const ACTION_FEEDBACK_MS = 2000;
    const PHASE_POPUP_DELAY_MS = 500;
    const PHASE_POPUP_VISIBLE_MS = 3000;
    const INTER_ROUND_PAUSE_MS = PHASE_POPUP_DELAY_MS + PHASE_POPUP_VISIBLE_MS;
    const BTN_SOUND_URL = "/static/audios/effects/boto.wav";
    const REMOVE_SOUND_URL = "/static/audios/effects/remove.wav";
    const FASE_OK_SOUND_URL = "/static/audios/effects/fase_completada.wav";
    const FASE_KO_SOUND_URL = "/static/audios/effects/fase_nocompletada.wav";
    // Match Puzzle4's required orders; these are only used for visual feedback.
    const REQUIRED_ORDERS = {
        'streak1-container': ['5', '1', '8', '3'],
        'streak2-container': ['6', '1', '0', '9', '8', '4', '2', '7']
    };

    const trackAudio = (() => {
        const audio = new Audio();
        audio.autoplay = true;
        audio.preload = 'auto';
        audio.muted = false;
        audio.volume = 1.0;
        audio.setAttribute('playsinline', '');
        return audio;
    })();

    const sfxAudio = (() => {
        const audio = new Audio();
        audio.autoplay = true;
        audio.preload = 'auto';
        audio.muted = false;
        audio.volume = 1.0;
        audio.setAttribute('playsinline', '');
        return audio;
    })();

    let statusEl = null;
    let statusSectionEl = null;
    let streakEl = null;
    let progressSectionEl = null;
    let solved = false;
    let showingCompletion = false;
    let flashingActive = false;
    let flashingCorrect = false;
    let currentSampleUrl = null;
    let samplePlaybackToken = 0;
    let feedbackTimer = null;
    let lastKnownStoring = false;
    let displayedStreak = 0;
    let registeredFragments = 0;
    let actionFeedbackTimer = null;
    let actionFeedbackActive = false;
    let lastNormalStatusText = '';
    let lastNormalStatusTone = '';
    let pendingStatusText = null;
    let pendingStatusTone = null;
    let phasePopupTimer = null;
    let delayedPopupTimer = null;
    let interRoundPauseTimer = null;
    let interRoundPauseActive = false;
    let queuedInterRoundUpdate = null;
    let phasePopupEl = null;
    let phasePopupTextEl = null;

    function startInterRoundPause() {
        interRoundPauseActive = true;
        if (delayedPopupTimer) {
            clearTimeout(delayedPopupTimer);
        }
        delayedPopupTimer = setTimeout(() => {
            delayedPopupTimer = null;
            showPhasePopup(tr('phaseSuccess', "Primera fase superada"));
        }, PHASE_POPUP_DELAY_MS);

        if (interRoundPauseTimer) {
            clearTimeout(interRoundPauseTimer);
        }
        interRoundPauseTimer = setTimeout(() => {
            interRoundPauseTimer = null;
            interRoundPauseActive = false;
            if (queuedInterRoundUpdate) {
                const nextUpdate = queuedInterRoundUpdate;
                queuedInterRoundUpdate = null;
                handleUpdate(nextUpdate);
            }
        }, INTER_ROUND_PAUSE_MS);
    }

    function showPhasePopup(message) {
        if (!phasePopupEl) return;
        phasePopupEl.classList.remove('hidden');
        phasePopupEl.classList.add('is-visible');
        if (phasePopupTimer) {
            clearTimeout(phasePopupTimer);
        }
        phasePopupTimer = setTimeout(() => {
            phasePopupEl.classList.remove('is-visible');
            phasePopupEl.classList.add('hidden');
            phasePopupTimer = null;
        }, PHASE_POPUP_VISIBLE_MS);
    }

    function setStatusPanelTone(tone) {
        if (!statusSectionEl) return;
        statusSectionEl.classList.remove('action-blue', 'action-green', 'action-red', 'action-white');
        if (tone) {
            statusSectionEl.classList.add(tone);
        }
    }

    function clearActionFeedbackTimer() {
        if (actionFeedbackTimer) {
            clearTimeout(actionFeedbackTimer);
            actionFeedbackTimer = null;
        }
    }

    function clearActionFeedback() {
        clearActionFeedbackTimer();
        actionFeedbackActive = false;
        pendingStatusText = null;
        pendingStatusTone = null;
        setStatusPanelTone(null);
    }

    function interactionHint(recording = lastKnownStoring) {
        const container = displayedStreak === 0 ? 'streak1-container' : 'streak2-container';
        const capacity = document.querySelectorAll(`#${container} .progress-box`).length;
        if (registeredFragments >= capacity) {
            return tr('musicCheckingSequence', 'Comprobando la secuencia.');
        }
        const position = registeredFragments + 1;
        const ordinals = ['primer', 'segundo', 'tercer', 'cuarto', 'quinto', 'sexto', 'séptimo', 'octavo'];
        const ordinal = tr('musicOrdinal' + position, ordinals[position - 1]);
        return recording
            ? tr('storingSequence', `Pasad el token para registrar el ${ordinal} fragmento.`, {ordinal})
            : tr('waitingSample', `Buscad el ${ordinal} fragmento.`, {ordinal});
    }

    function showInteractionHint() {
        if (solved || showingCompletion || flashingActive) return;
        setStatus(interactionHint(), lastKnownStoring ? 'storing' : 'idle');
    }

    function showActionFeedback(panelTone, text, textTone) {
        actionFeedbackActive = true;
        setStatusPanelTone(panelTone);
        setStatus(text, textTone, true);
        clearActionFeedbackTimer();
        actionFeedbackTimer = setTimeout(() => {
            actionFeedbackTimer = null;
            actionFeedbackActive = false;
            setStatusPanelTone(null);
            if (pendingStatusText !== null) {
                const queuedText = pendingStatusText;
                const queuedTone = pendingStatusTone;
                pendingStatusText = null;
                pendingStatusTone = null;
                setStatus(queuedText, queuedTone);
                return;
            }
            setStatus(lastNormalStatusText, lastNormalStatusTone, true);
        }, ACTION_FEEDBACK_MS);
    }

    function playAudio(audioEl, url, onComplete) {
        if (!url) return;

        try {
            try { audioEl.pause(); } catch {}
            try { audioEl.currentTime = 0; } catch {}

            const absUrl = new URL(url, window.location.origin).href;
            if (audioEl.src !== absUrl) {
                audioEl.src = url;
                try { audioEl.load(); } catch {}
            }

            audioEl.onended = typeof onComplete === 'function' ? onComplete : null;

            const playPromise = audioEl.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(() => {
                    setTimeout(() => {
                        const retryPromise = audioEl.play();
                        if (retryPromise && typeof retryPromise.catch === 'function') {
                            retryPromise.catch(err => console.warn("Audio play failed:", err));
                        }
                    }, 100);
                });
            }
        } catch (err) {
            console.warn("Audio play failed:", err);
        }
    }

    function playTrack(url, onComplete) {
        playAudio(trackAudio, url, onComplete);
    }

    function playSound(url, onComplete) {
        playAudio(sfxAudio, url, onComplete);
    }

    function setStatus(text, tone, force) {
        if (!statusEl) return;
        if (actionFeedbackActive && !force) {
            pendingStatusText = text || '';
            pendingStatusTone = tone || '';
            return;
        }
        statusEl.textContent = text || '';
        statusEl.className = '';
        if (tone) {
            statusEl.classList.add(tone);
        }
        if (!force) {
            lastNormalStatusText = text || '';
            lastNormalStatusTone = tone || '';
        }
    }

    function updateRoundHud(streak, totalRequired) {
        if (!streakEl || totalRequired === undefined) return;
        const normalizedStreak = streak === -1 ? 0 : (streak || 0);
        const currentRound = Math.min(normalizedStreak + 1, totalRequired);
        streakEl.textContent = `${currentRound}/${totalRequired}`;
    }

    function updateStageClasses(streak) {
        const streak1Container = document.getElementById('streak1-container');
        const streak2Container = document.getElementById('streak2-container');

        [streak1Container, streak2Container].forEach(container => {
            if (!container) return;
            container.classList.remove('is-active', 'is-complete', 'outcome-correct', 'outcome-wrong');
        });

        if (streak <= 0 && streak1Container) {
            streak1Container.classList.add('is-active');
        }
        if (streak >= 1 && streak1Container) {
            streak1Container.classList.add('is-complete');
        }
        if (streak === 1 && streak2Container) {
            streak2Container.classList.add('is-active');
        }
        if (streak >= 2 && streak2Container) {
            streak2Container.classList.add('is-complete');
        }
    }

    function setSampleWaveActive(active) {
        if (!progressSectionEl) return;
        progressSectionEl.classList.toggle('sample-active', !!active);
    }

    function updateProgressBoxes(streak, playedSequence) {
        const streak1Container = document.getElementById('streak1-container');
        const streak2Container = document.getElementById('streak2-container');
        const streak1Boxes = document.querySelectorAll('#streak1-container .progress-box');
        const streak2Boxes = document.querySelectorAll('#streak2-container .progress-box');

        const clearBox = box => {
            box.classList.remove('filled');
            box.textContent = '';
            delete box.dataset.label;
            if (!flashingActive) {
                box.classList.remove('flash-correct', 'flash-wrong');
            }
        };

        streak1Boxes.forEach(clearBox);
        streak2Boxes.forEach(clearBox);
        updateStageClasses(streak);

        if (streak === -1) {
            streak1Container.style.display = 'none';
            streak2Container.style.display = 'none';
            return;
        }

        if (streak === 0) {
            streak1Container.style.display = 'flex';
            streak2Container.style.display = 'none';
            playedSequence.forEach((code, index) => {
                if (!streak1Boxes[index]) return;
                streak1Boxes[index].textContent = code;
                streak1Boxes[index].dataset.label = code;
                streak1Boxes[index].classList.add('filled');
            });
            return;
        }

        if (streak === 1) {
            streak1Container.style.display = 'none';
            streak2Container.style.display = 'flex';
            playedSequence.forEach((code, index) => {
                if (!streak2Boxes[index]) return;
                streak2Boxes[index].textContent = code;
                streak2Boxes[index].dataset.label = code;
                streak2Boxes[index].classList.add('filled');
            });
            return;
        }

        streak1Container.style.display = 'none';
        streak2Container.style.display = 'flex';
        streak2Boxes.forEach(box => box.classList.add('filled'));
    }

    function startFlashing(isCorrect) {
        flashingActive = true;
        flashingCorrect = !!isCorrect;

        const streak1Container = document.getElementById('streak1-container');
        const streak2Container = document.getElementById('streak2-container');
        const activeContainer = streak1Container.style.display !== 'none' ? streak1Container : streak2Container;
        const boxes = activeContainer.querySelectorAll('.progress-box');
        const requiredOrder = REQUIRED_ORDERS[activeContainer.id];
        const complete = requiredOrder && boxes.length === requiredOrder.length &&
            Array.from(boxes).every(box => box.classList.contains('filled'));

        activeContainer.classList.toggle('outcome-correct', flashingCorrect);
        activeContainer.classList.remove('outcome-wrong');

        boxes.forEach((box, index) => {
            box.classList.remove('flash-correct', 'flash-wrong');
            if (flashingCorrect) {
                box.classList.add('flash-correct');
            } else if (complete && box.dataset.label !== requiredOrder[index]) {
                box.classList.add('flash-wrong');
            }
        });
    }

    function stopFlashing() {
        flashingActive = false;
        document.querySelectorAll('.streak-container').forEach(container => {
            container.classList.remove('outcome-correct', 'outcome-wrong');
        });
        document.querySelectorAll('.progress-box').forEach(box => {
            box.classList.remove('flash-correct', 'flash-wrong');
        });
    }

    function clearFeedbackTimer() {
        if (feedbackTimer) {
            clearTimeout(feedbackTimer);
            feedbackTimer = null;
        }
    }

    function runValidationFeedback(isCorrect) {
        const soundUrl = isCorrect ? FASE_OK_SOUND_URL : FASE_KO_SOUND_URL;
        const statusText = isCorrect ? tr('sequenceCorrect', "Secuencia correcta") : tr('sequenceWrong', "Secuencia incorrecta");
        const statusTone = isCorrect ? 'completed' : 'failure';

        if (!solved) {
            startFlashing(isCorrect);
            setStatus(statusText, statusTone);
            playSound(soundUrl);
        }
    }

    function scheduleValidationFeedback(isCorrect, trackPayload) {
        clearFeedbackTimer();

        const durationSeconds = Number(trackPayload && trackPayload.duration) || 0;
        const delayMs = Math.max(0, Math.round(durationSeconds * 1000));

        feedbackTimer = setTimeout(() => {
            feedbackTimer = null;
            runValidationFeedback(isCorrect);
        }, delayMs);
    }

    function maybePlaySample(sampleSong, playingSample) {
        if (!sampleSong || !sampleSong.url || !playingSample) return;
        if (currentSampleUrl === sampleSong.url) return;

        currentSampleUrl = sampleSong.url;
        samplePlaybackToken += 1;
        const token = samplePlaybackToken;

        playTrack(sampleSong.url, () => {
            if (token !== samplePlaybackToken || solved) return;
            currentSampleUrl = null;
            if (!showingCompletion) {
                showInteractionHint();
            }
        });
    }

    function maybePlayTrack(trackPayload, onComplete) {
        if (!trackPayload || !trackPayload.url || solved) return;
        playTrack(trackPayload.url, onComplete);
    }

    function handleUpdate(d) {
        if (window.PyramidLevelVictory?.active) return;
        console.log('[P4] handleUpdate called with:', d);
        if (!d || d.puzzle_id !== 4) return;
        if (interRoundPauseActive && !d.show_completion && !d.puzzle_solved) {
            queuedInterRoundUpdate = d;
            return;
        }

        // Position follows the received sequence, never the terminal codes or the solution.
        const effectiveStreak = d.streak_bis !== undefined ? d.streak_bis : d.streak;
        if (effectiveStreak >= 0 && effectiveStreak !== displayedStreak) {
            displayedStreak = effectiveStreak;
            registeredFragments = 0;
        }
        if (Array.isArray(d.played_sequence)) registeredFragments = d.played_sequence.length;

        // New state takes precedence over a transient button message.
        if (typeof d.storing === 'boolean' || d.play_mostra || d.playing_sample ||
            d.sample_countdown_seconds > 0 || d.validation_feedback !== undefined ||
            d.show_completion || d.puzzle_solved) {
            clearActionFeedback();
        }
        if (typeof d.storing === 'boolean') {
            lastKnownStoring = d.storing;
        }

        const shellEl = document.getElementById('puzzle4-shell');
        if (typeof d.storing === 'boolean' && shellEl) {
            shellEl.classList.toggle('is-recording', d.storing);
        }

        if (d.reset_attempt) {
            showActionFeedback('action-white', tr('restarting', "Reiniciando"), 'action-white');
        } else if (d.play_mostra) {
            showActionFeedback('action-blue', tr('playingSong', "Escuchad el orden de los fragmentos."), 'action-blue');
        } else if (d.storing === true) {
            showActionFeedback('action-green', interactionHint(true), 'action-green');
        } else if (d.removed_last) {
            showActionFeedback('action-red', tr('lastRecordDeleted', "Último registro eliminado"), 'action-red');
            playSound(REMOVE_SOUND_URL);
        }

        if (typeof d.playing_sample === 'boolean') {
            setSampleWaveActive(d.playing_sample);
        }

        if (Array.isArray(d.played_sequence) && d.played_sequence.length === 0 && (d.current_progress === 0 || d.current_progress === undefined)) {
            stopFlashing();
        }

        if (d.streak !== undefined && d.total_required !== undefined) {
            const effectiveStreak = d.streak_bis !== undefined ? d.streak_bis : d.streak;
            updateRoundHud(effectiveStreak, d.total_required);
        }

        if (typeof d.sample_countdown_seconds !== 'undefined' && d.sample_countdown_seconds > 0) {
            showingCompletion = false;
            setStatus(tr('sampleCountdown', 'Reproduciendo muestra en {count} segundos', {count: d.sample_countdown_seconds}), 'countdown');
        }

        if (d.show_completion && !solved) {
            showingCompletion = true;
            setStatus('', 'completed');
            playSound(FASE_OK_SOUND_URL);
            if (d.streak !== undefined && d.total_required !== undefined && d.streak < d.total_required) {
                startInterRoundPause();
            }
        }

        if (d.play_mostra) {
            setStatus(tr('playingSong', 'Escuchad el orden de los fragmentos.'), 'playing-sample');
            playTrack(d.url, showInteractionHint);
        }

        if (d.streak !== undefined && !showingCompletion) {
            const effectiveStreak = d.streak_bis !== undefined ? d.streak_bis : d.streak;
            const playedSequence = Array.isArray(d.played_sequence) ? d.played_sequence : [];
            if (d.reset_attempt) {
                playSound(BTN_SOUND_URL);
            }
            // Hide sequence boxes while the sample song is playing; -1 collapses both containers
            const displayStreak = d.playing_sample ? -1 : effectiveStreak;
            updateProgressBoxes(displayStreak, playedSequence);
        }

        if (d.play) {
            maybePlayTrack(d.play);
        }

        if (d.validation_feedback !== undefined) {
            clearFeedbackTimer();
            runValidationFeedback(d.validation_feedback);
        } else if (d.sequence_correct !== undefined && !d.play) {
            scheduleValidationFeedback(d.sequence_correct, d.play);
        }

        if (d.puzzle_solved && !solved) {
            solved = true;
            showingCompletion = false;
            setSampleWaveActive(false);
            samplePlaybackToken += 1;
            currentSampleUrl = null;
            clearFeedbackTimer();
            trackAudio.pause();
            sfxAudio.pause();
            clearTimeout(interRoundPauseTimer);
            clearTimeout(delayedPopupTimer);
            setStatus(tr('songCompleted', "Canción completada"), 'solved');
            window.PyramidLevelVictory.complete(4);
            return;
        }

        maybePlaySample(d.sample_song, d.playing_sample);

        if (!showingCompletion && !solved) {
            if (d.playing_sample) {
                setStatus(tr('playingSample', "Escuchad el orden de los fragmentos."), 'playing-sample');
            } else if (d.sample_countdown_seconds > 0) {
                setStatus(tr('sampleCountdown', 'Reproduciendo muestra en {count} segundos', {count: d.sample_countdown_seconds}), 'countdown');
            } else if (d.listening) {
                setStatus(tr('listeningSample', "Escuchando muestra"), 'listening');
            } else if (d.storing === true) {
                playSound(BTN_SOUND_URL);
                setStatus(interactionHint(true), 'storing');
            } else if (d.sequence_correct !== undefined || d.validation_feedback !== undefined) {
                // The final fragment is being checked; keep its result or listening state.
                if (d.play) setStatus(tr('listeningSample', 'Escuchando muestra'), 'listening');
            } else if (d.storing === false && !d.play_mostra) {
                setStatus(interactionHint(false), 'idle');
            }
        }
    }

    function installDebugHelpers() {
        window.puzzle4Debug = {
            push(payload) {
                handleUpdate({ puzzle_id: 4, ...payload });
            },
            listening() {
                handleUpdate({
                    puzzle_id: 4,
                    streak: -1,
                    total_required: 2,
                    playing_sample: true,
                    sample_song: { url: '/static/audios/P4_F1/song.wav' },
                    played_sequence: []
                });
            },
            idle(streak = 0, totalRequired = 2) {
                handleUpdate({
                    puzzle_id: 4,
                    streak,
                    total_required: totalRequired,
                    storing: false,
                    playing_sample: false,
                    current_progress: 0,
                    played_sequence: []
                });
            },
            storing(streak = 0, playedSequence = []) {
                handleUpdate({
                    puzzle_id: 4,
                    streak,
                    total_required: 2,
                    storing: true,
                    playing_sample: false,
                    current_progress: playedSequence.length,
                    played_sequence: playedSequence
                });
            },
            countdown(seconds = 5) {
                handleUpdate({
                    puzzle_id: 4,
                    streak: -1,
                    total_required: 2,
                    sample_countdown_seconds: seconds
                });
            },
            correct(streak = 0, playedSequence = ['5', '1', '8', '3']) {
                handleUpdate({
                    puzzle_id: 4,
                    streak,
                    total_required: 2,
                    current_progress: playedSequence.length,
                    played_sequence: playedSequence,
                    sequence_correct: true
                });
            },
            wrong(streak = 0, playedSequence = ['5', '2', '8', '3']) {
                handleUpdate({
                    puzzle_id: 4,
                    streak,
                    total_required: 2,
                    current_progress: playedSequence.length,
                    played_sequence: playedSequence,
                    sequence_correct: false
                });
            },
            solved() {
                const previousSolved = solved;
                solved = false;
                handleUpdate({
                    puzzle_id: 4,
                    puzzle_solved: true
                });
                solved = previousSolved;
            },
            demoA() {
                this.listening();
                setTimeout(() => this.idle(0, 2), 1800);
                setTimeout(() => this.storing(0, ['5']), 2800);
                setTimeout(() => this.storing(0, ['5', '1']), 3400);
                setTimeout(() => this.storing(0, ['5', '1', '8']), 4000);
                setTimeout(() => this.correct(0, ['5', '1', '8', '3']), 4600);
            },
            demoB() {
                this.idle(1, 2);
                setTimeout(() => this.storing(1, ['6', '1', '0']), 900);
                setTimeout(() => this.storing(1, ['6', '1', '0', '9', '8']), 1800);
                setTimeout(() => this.wrong(1, ['6', '1', '0', '9', '8', '4']), 2600);
            },
            demoSolved() {
                this.idle(1, 2);
                setTimeout(() => this.storing(1, ['6', '1', '0', '9', '8', '5', '2', '7']), 700);
                setTimeout(() => this.correct(1, ['6', '1', '0', '9', '8', '5', '2', '7']), 1600);
                setTimeout(() => this.solved(), 3000);
            }
        };
    }

    function initSSE() {
        const es = new EventSource('/state_stream');

        es.onmessage = evt => {
            try {
                handleUpdate(JSON.parse(evt.data));
            } catch (err) {}
        };

        es.onopen = () => {
            fetch("/start_puzzle/4", { method: "POST" })
                .catch(err => console.warn("Failed to start puzzle 4:", err));
        };

        es.onerror = () => {};
    }

    document.addEventListener('DOMContentLoaded', () => {
        statusEl = document.getElementById('status-text');
        statusSectionEl = document.getElementById('status-section');
        streakEl = document.getElementById('streak');
        progressSectionEl = document.getElementById('progress-section');
        phasePopupEl = document.getElementById('p4-phase-popup');
        const popupMessages = {
            ca: ['Primera fase', 'superada'],
            es: ['Primera fase', 'superada'],
            en: ['First phase', 'completed']
        };
        const language = window.PYRAMID_GAME?.language;
        const popupCopy = popupMessages[language === 'eng' ? 'en' : language] || popupMessages.ca;
        document.getElementById('p4-phase-popup-line1').textContent = popupCopy[0];
        document.getElementById('p4-phase-popup-line2').textContent = popupCopy[1];

        //installDebugHelpers();
        setStatus(tr('preparingSample', "Preparando muestra"), 'listening');
        setSampleWaveActive(false);
        updateProgressBoxes(-1, []);
        updateRoundHud(0, 2);
        initSSE();
    });
})();
