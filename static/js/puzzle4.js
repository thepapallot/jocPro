(function() {
    const BTN_SOUND_URL = "/static/audios/effects/boto.wav";
    const FASE_OK_SOUND_URL = "/static/audios/effects/fase_completada.wav";
    const FASE_KO_SOUND_URL = "/static/audios/effects/fase_nocompletada.wav";
    const PUZZLE_COMPLETE_SOUND_URL = "/static/audios/effects/nivel_completado.wav";

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
    let streakEl = null;
    let solved = false;
    let showingCompletion = false;
    let flashingActive = false;
    let flashingCorrect = false;
    let currentSampleUrl = null;
    let samplePlaybackToken = 0;
    let feedbackTimer = null;

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

    function setStatus(text, tone) {
        if (!statusEl) return;
        statusEl.textContent = text || '';
        statusEl.className = '';
        if (tone) {
            statusEl.classList.add(tone);
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
        const flashClass = flashingCorrect ? 'flash-correct' : 'flash-wrong';
        const otherClass = flashingCorrect ? 'flash-wrong' : 'flash-correct';
        const outcomeClass = flashingCorrect ? 'outcome-correct' : 'outcome-wrong';
        const otherOutcomeClass = flashingCorrect ? 'outcome-wrong' : 'outcome-correct';

        activeContainer.classList.add(outcomeClass);
        activeContainer.classList.remove(otherOutcomeClass);

        boxes.forEach(box => {
            box.classList.add(flashClass);
            box.classList.remove(otherClass);
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
        const statusText = isCorrect ? 'Secuencia correcta' : 'Secuencia incorrecta';
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
                setStatus('Esperando registro', 'idle');
            }
        });
    }

    function maybePlayTrack(trackPayload, streak, playedSequence) {
        if (!trackPayload || !trackPayload.url || solved) return;
        playTrack(trackPayload.url);
    }

    function handleUpdate(d) {
        console.log('[P4] handleUpdate called with:', d);
        if (!d || d.puzzle_id !== 4) return;

        if (Array.isArray(d.played_sequence) && d.played_sequence.length === 0 && (d.current_progress === 0 || d.current_progress === undefined)) {
            stopFlashing();
        }

        if (d.streak !== undefined && d.total_required !== undefined) {
            const effectiveStreak = d.streak_bis !== undefined ? d.streak_bis : d.streak;
            updateRoundHud(effectiveStreak, d.total_required);
        }

        if (typeof d.sample_countdown_seconds !== 'undefined' && d.sample_countdown_seconds > 0) {
            showingCompletion = false;
            setStatus(`Reproduciendo muestra en ${d.sample_countdown_seconds} segundos`, 'countdown');
        }

        if (d.show_completion && !solved) {
            showingCompletion = true;
            setStatus('Fase completada', 'completed');
            playSound(FASE_OK_SOUND_URL);
        }

        if (d.play_mostra) {
            playTrack(d.url);
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
            maybePlayTrack(d.play, d.streak, d.played_sequence);
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
            samplePlaybackToken += 1;
            currentSampleUrl = null;
            clearFeedbackTimer();
            setStatus('Cancion completada', 'solved');
            //playSound((d.play_final && d.play_final.url) || PUZZLE_COMPLETE_SOUND_URL);
            playSound(PUZZLE_COMPLETE_SOUND_URL);
            // Show solved banner and flash
            const banner = document.getElementById('p4-solved-banner');
            if (banner) banner.classList.remove('hidden');
            document.body.classList.add('p4-solved-flash');
            setTimeout(function () {
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
            }, 1800);
            return;
        }

        maybePlaySample(d.sample_song, d.playing_sample);

        if (!showingCompletion && !solved) {
            if (d.playing_sample) {
                setStatus('Reproduciendo muestra', 'playing-sample');
            } else if (d.sample_countdown_seconds > 0) {
                setStatus(`Reproduciendo muestra en ${d.sample_countdown_seconds} segundos`, 'countdown');
            } else if (d.listening) {
                setStatus('Escuchando muestra', 'listening');
            } else if (d.storing === true) {
                playSound(BTN_SOUND_URL);
                setStatus('Registrando secuencia', 'storing');
            } else if (d.storing === false) {
                setStatus('Esperando muestras', 'idle');
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
        streakEl = document.getElementById('streak');

        //installDebugHelpers();
        setStatus('Preparando muestra', 'listening');
        updateProgressBoxes(-1, []);
        updateRoundHud(0, 2);
        initSSE();
    });
})();
