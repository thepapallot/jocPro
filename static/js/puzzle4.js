(function() {
    const statusEl = document.getElementById('status-text');
    let solved = false;
    let showingCompletion = false;
    const BTN_SOUND_URL = "/static/audios/effects/boto.wav";
    const FASE_OK_SOUND_URL = "/static/audios/effects/fase_completada.wav";         
    const FASE_KO_SOUND_URL = "/static/audios/effects/fase_nocompletada.wav";       
    const PUZZLE_COMPLETE_SOUND_URL = "/static/audios/effects/nivel_completado.wav"; 
    
    // Singleton audio for SFX to avoid overlap
    const sfxAudio = (() => {
        const a = new Audio();
        a.autoplay = true;
        a.preload = 'auto';
        a.muted = false;
        a.volume = 1.0;
        a.setAttribute('playsinline', '');
        return a;
    })();

    // Track flashing state
    let flashingActive = false;
    let flashingCorrect = false;

    // NEW: control for frontend-only countdown flow
    let sampleCountdownTimer = null;
    let sampleCountdownRunning = false;

    function playSound(url, onComplete) {
        if (!url) return;
        try {
            // If already playing something, stop it first
            try { sfxAudio.pause(); } catch {}
            try { sfxAudio.currentTime = 0; } catch {}

            // If same URL, just restart; else set new src
            const abs = new URL(url, window.location.origin).href;
            if (sfxAudio.src !== abs) {
                sfxAudio.src = url;
                try { sfxAudio.load(); } catch {}
            }

            // Hook end for callbacks
            sfxAudio.onended = typeof onComplete === 'function' ? onComplete : null;

            const p = sfxAudio.play();
            if (p && typeof p.catch === 'function') {
                p.catch(err => {
                    // Retry once shortly (some devices balk on first try)
                    setTimeout(() => {
                        const p2 = sfxAudio.play();
                        if (p2 && typeof p2.catch === 'function') {
                            p2.catch(e => console.warn("Audio play failed:", e));
                        }
                    }, 100);
                });
            }
        } catch (err) {
            console.warn("Audio play failed:", err);
        }
    }
    
    function setListening() {
        if (solved || !statusEl) return;
        statusEl.textContent = 'Escuchando Muesta';
        statusEl.className = 'status listening';
    }

    function updateStatus(storing, playingSample,blank) {
        const statusEl = document.getElementById('status-text');
        if (!statusEl) return;
        if (playingSample) {
            statusEl.textContent = 'Reproduciendo muestra';
            statusEl.classList.remove('storing');
            statusEl.classList.add('playing-sample');
        } else if (storing) {
            playSound(BTN_SOUND_URL);
            statusEl.textContent = 'Estado: Registrando';
            statusEl.classList.add('storing');
            statusEl.classList.remove('playing-sample');
        } else if (blank){
            statusEl.textContent = '';
        } else {
            playSound(BTN_SOUND_URL);
            statusEl.textContent = 'Estado: No se está registrando';
            statusEl.classList.remove('storing', 'playing-sample');
        }
    }

    function updateProgressBoxes(streak, currentProgress, playedSequence) {
        // streak: 0, 1, or 2 (number of completed songs)
        // currentProgress: 0-8 (progress in current song)
        // playedSequence: array of song codes that have been played
        
        const streak1Container = document.getElementById('streak1-container');
        const streak2Container = document.getElementById('streak2-container');
        const streak1Boxes = document.querySelectorAll('#streak1-container .progress-box');
        const streak2Boxes = document.querySelectorAll('#streak2-container .progress-box');
        
        // Clear all boxes first (but preserve flashing class if active)
        const clearClasses = box => {
            box.classList.remove('filled');
            box.textContent = '';
            if (!flashingActive) {
                box.classList.remove('flash-correct', 'flash-wrong');
            } else {
                // Ensure correct flash class is present while active
                const want = flashingCorrect ? 'flash-correct' : 'flash-wrong';
                const other = flashingCorrect ? 'flash-wrong' : 'flash-correct';
                box.classList.add(want);
                box.classList.remove(other);
            }
        };
        streak1Boxes.forEach(clearClasses);
        streak2Boxes.forEach(clearClasses);
        
        if (streak === -1){
            // No song started yet - show empty first song
            streak1Container.style.display = 'none';
            streak2Container.style.display = 'none';
        } else if (streak === 0) {
            // Working on first song
            streak1Container.style.display = 'flex';
            streak2Container.style.display = 'none';
            
            // Display played codes in boxes
            if (playedSequence && playedSequence.length > 0) {
                for (let i = 0; i < Math.min(playedSequence.length, streak1Boxes.length); i++) {
                    streak1Boxes[i].textContent = playedSequence[i];
                    streak1Boxes[i].classList.add('filled');
                }
            }
        } else if (streak === 1) {
            // Working on second song
            streak1Container.style.display = 'none';
            streak2Container.style.display = 'flex';
            
            // Display played codes in boxes
            if (playedSequence && playedSequence.length > 0) {
                for (let i = 0; i < Math.min(playedSequence.length, streak2Boxes.length); i++) {
                    streak2Boxes[i].textContent = playedSequence[i];
                    streak2Boxes[i].classList.add('filled');
                }
            }
        } else if (streak >= 2) {
            // Both songs complete - show completed second song
            streak1Container.style.display = 'none';
            streak2Container.style.display = 'flex';
            streak2Boxes.forEach(box => box.classList.add('filled'));
        }
    }

    // Start flashing and keep it until reset arrives
    function startFlashing(isCorrect) {
        flashingActive = true;
        flashingCorrect = !!isCorrect;
        const streak1Container = document.getElementById('streak1-container');
        const streak2Container = document.getElementById('streak2-container');
        const activeContainer = streak1Container.style.display !== 'none' ? streak1Container : streak2Container;
        const boxes = activeContainer.querySelectorAll('.progress-box');
        const flashClass = flashingCorrect ? 'flash-correct' : 'flash-wrong';
        const otherClass = flashingCorrect ? 'flash-wrong' : 'flash-correct';
        boxes.forEach(box => {
            box.classList.add(flashClass);
            box.classList.remove(otherClass);
        });
    }

    // Stop flashing explicitly (called when reset update arrives)
    function stopFlashing() {
        flashingActive = false;
        const boxes = document.querySelectorAll('.progress-box');
        boxes.forEach(box => box.classList.remove('flash-correct', 'flash-wrong'));
    }

    function handleUpdate(d) {
        console.log('[P4] handleUpdate called with:', d);
        
        if (!d || d.puzzle_id !== 4) return;
        
        // If we receive the reset state (current_progress: 0 and played_sequence: []), stop flashing
        if (Array.isArray(d.played_sequence) && d.played_sequence.length === 0 && (d.current_progress === 0 || d.current_progress === undefined)) {
            stopFlashing();
        }

        if (d.listening) setListening();
        
        // Hide streak during sample or countdown
        {
            const streakEl = document.getElementById('streak');
            if (streakEl) {
                const hideStreak = d.streak === -1 || d.playing_sample === true || sampleCountdownRunning;
                if (hideStreak) {
                    streakEl.style.display = 'none';
                    streakEl.textContent = '';
                } else if (d.streak !== undefined && d.total_required !== undefined) {
                    const currentSong = d.streak >= d.total_required ? d.total_required : d.streak + 1;
                    streakEl.textContent = `${currentSong}/${d.total_required}`;
                    streakEl.style.display = '';
                }
            }
        }

        // Show countdown messages before sample
        if (typeof d.sample_countdown_seconds !== 'undefined') {
            const secs = d.sample_countdown_seconds;
            if (secs > 0) {
                updateStatus(false, false, true);
                const statusEl = document.getElementById('status-text');
                if (statusEl) {
                    statusEl.textContent = `Reproduciendo muestra en ${secs} segundos`;
                    statusEl.classList.remove('storing');
                    statusEl.classList.remove('playing-sample');
                }
            }
        }

        // Handle sample song playback
        if (d.sample_song && d.playing_sample) {
            const url = d.sample_song.url;
            playSound(url, () => {
                console.log("Sample finished!");
                updateStatus(false, false, true);
            });
        }

        // Optional: play pre-sample SFX
        if (d.play_mostra) {
            playSound(d.url);
        }

        // Update storing/playing status - check playing_sample first, then storing
        if (d.playing_sample !== undefined && !showingCompletion) {
            updateStatus(d.storing || false, d.playing_sample);
        } else if (d.storing !== undefined && !showingCompletion) {
            updateStatus(d.storing, false);
        }

        // Update progress boxes ONLY if not showing completion
        if (d.streak !== undefined && !showingCompletion) {
            const playedSeq = d.played_sequence || [];
            console.log('[P4] Updating boxes - streak:', d.streak, 'played_sequence:', playedSeq);
            if (d.reset_attempt) { 
                playSound(BTN_SOUND_URL);
            }
            updateProgressBoxes(d.streak, d.current_progress || 0, playedSeq);
        }

        //Reprodueix trossos
        if (d.play && !solved) {
            if ((d.played_sequence.length == 4 && d.streak == 0) || (d.played_sequence.length == 8 && d.streak == 1)){
                playSound(d.play.url, () => {
                    console.log("Button sound finished!");
                    fetch('/current_state')
                    .catch(() => {});
                });
            } else {
                playSound(d.play.url);
            }
            
        }

        // Handle sequence validation feedback: start persistent flashing
        if (d.sequence_correct !== undefined) {
            startFlashing(d.sequence_correct);
            /*// NEW: frontend-only pre-sample flow when correct and transitioning to streak 2
            if (d.sequence_correct === true && d.streak === 0 && !sampleCountdownRunning) {
                startPreSampleCountdown();
            }*/
        }

        // To handle start next streaks
        if (d.start_streak  !== undefined){

            startPreSampleCountdown();
        }

        if (d.puzzle_solved && !solved) {
            solved = true;
            showingCompletion = false;  // Reset flag
            if (statusEl) {
                statusEl.textContent = 'Cancion Completada';
                statusEl.className = 'status solved';
            }
            setTimeout(() => window.location.href = '/puzzleSuperat/4', 4000);
        }
    }

    // NEW: frontend-only pre-sample flow
    function startPreSampleCountdown() {
        sampleCountdownRunning = true;
        // Play pre-sample SFX once
        playSound("/static/audios/effects/apareix_contingut.wav");

        // Show countdown 5..1 (no sound effects), then start sample
        const statusEl = document.getElementById('status-text');
        let secs = 5;

        // Immediately hide streak
        const streakEl = document.getElementById('streak');
        if (streakEl) {
            streakEl.style.display = 'none';
            streakEl.textContent = '';
        }

        // Set initial message
        setCountdownStatusText(secs);

        sampleCountdownTimer = setInterval(() => {
            secs -= 1;
            if (secs > 0) {
                setCountdownStatusText(secs);
            } else {
                // Final line and start sample locally
                clearInterval(sampleCountdownTimer);
                sampleCountdownTimer = null;
                sampleCountdownRunning = false;
                if (statusEl) {
                    statusEl.textContent = 'Reproduciendo muestra';
                    statusEl.classList.remove('storing');
                    statusEl.classList.add('playing-sample');
                }
                // Locally start streak 2 sample (backend won't emit SSE)
                const sampleUrl = "/static/audios/P4_F2/song.wav";
                playSound(sampleUrl, () => {
                    // Notify backend when sample finishes
                    fetch('/puzzle4_sample_finished', { method: 'POST' }).catch(() => {});
                    updateStatus(false, false, true);
                });
            }
        }, 1000);
    }

    function setCountdownStatusText(secs) {
        const statusEl = document.getElementById('status-text');
        if (!statusEl) return;
        statusEl.textContent = `Reproduciendo muestra en ${secs} segundos`;
        statusEl.classList.remove('storing');
        statusEl.classList.remove('playing-sample');
    }

    function loadSnapshot() {
        if (snapshotLoaded) return; // NEW: avoid double fetch
        snapshotLoaded = true;      // NEW
        fetch('/current_state')
            .then(r => r.json())
            .then(d => handleUpdate(d))
            .catch(() => {});
    }

    function initSSE() {
        const es = new EventSource('/state_stream');
        
        es.onmessage = evt => { try { handleUpdate(JSON.parse(evt.data)); } catch(e) {} };
        es.onopen = () => {
            // Start Puzzle 2 when SSE is connected
            fetch("/start_puzzle/4", { method: "POST" })
                .catch(err => console.warn("Failed to start puzzle 4:", err));
        };
        es.onerror = () => {};
    }

    document.addEventListener('DOMContentLoaded', () => {
        setListening();

        // Initialize display - start with 1/2
        updateStatus(false, false, true);
        updateProgressBoxes(-1, 0, []);
        
        // Initialize streak display to 1/2
        const streakEl = document.getElementById('streak');
        if (streakEl) {
            streakEl.textContent = '1/2';
            streakEl.style.display = ''; // ensure shown by default
        }

        initSSE();
    });
})();
