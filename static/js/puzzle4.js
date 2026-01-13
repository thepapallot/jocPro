(function() {
    const statusEl = document.getElementById('p4-status');
    let audioEl = document.getElementById('p4-audio');
    if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.id = 'p4-audio';
        audioEl.style.display = 'none';
        document.body.appendChild(audioEl);
    }
    let solved = false;
    let pendingUrl = null;
    let showingCompletion = false;  // NEW: flag to prevent box updates during completion

    // Remove awaitingUnmute logic; auto-unmute after muted start
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const audioCtx = AudioCtx ? new AudioCtx() : null;

    function setListening() {
        if (solved || !statusEl) return;
        statusEl.textContent = 'Listening';
        statusEl.className = 'status listening';
    }

    function play(url, onEnd) {
        if (!url || !audioEl) return;
        console.log('[P4] play request:', url);
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(()=>{});
        }

        // Prepare element
        audioEl.autoplay = true;
        audioEl.preload = 'auto';
        audioEl.setAttribute('playsinline', '');
        audioEl.onended = null;
        audioEl.pause();

        // Set source and try unmuted first
        audioEl.src = url;
        audioEl.currentTime = 0;
        audioEl.volume = 1.0;
        audioEl.muted = false;
        if (onEnd) audioEl.onended = onEnd;

        const p = audioEl.play();
        if (p && typeof p.then === 'function') {
            p.then(() => {
                console.log('[P4] unmuted playback started');
            }).catch(err => {
                console.warn('[P4] unmuted play blocked, trying muted...', err);
                tryMutedAutoplay(url, onEnd);
            });
        }
    }

    function tryMutedAutoplay(url, onEnd) {
        audioEl.onended = onEnd || null;
        // Ensure attribute + property both set (helps some browsers)
        audioEl.setAttribute('muted', '');
        audioEl.muted = true;

        const p2 = audioEl.play();
        if (p2 && typeof p2.then === 'function') {
            p2.then(() => {
                console.log('[P4] muted playback started; auto-unmuting shortly...');
                // Auto-unmute shortly after start (works on most desktop browsers)
                setTimeout(() => {
                    audioEl.muted = false;
                    audioEl.removeAttribute('muted');
                    console.log('[P4] auto-unmuted');
                }, 150);
            }).catch(err => {
                console.warn('[P4] muted play also blocked; will retry on first user interaction', err);
                pendingUrl = url;
            });
        }
    }

    // Debug hooks
    audioEl.addEventListener('play', () => console.log('[P4] audio element play event'));
    audioEl.addEventListener('ended', () => console.log('[P4] audio ended'));
    audioEl.addEventListener('error', () => console.warn('[P4] audio error', audioEl.error));

    function updateStatus(storing, playingSample) {
        const statusEl = document.getElementById('status-text');
        if (!statusEl) return;
        
        if (playingSample) {
            statusEl.textContent = 'Reproduciendo muestra';
            statusEl.classList.remove('storing');
            statusEl.classList.add('playing-sample');
        } else if (storing) {
            statusEl.textContent = 'Estado: Registrando';
            statusEl.classList.add('storing');
            statusEl.classList.remove('playing-sample');
        } else {
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
        
        // Clear all boxes first
        streak1Boxes.forEach(box => {
            box.classList.remove('filled');
            box.textContent = '';
        });
        streak2Boxes.forEach(box => {
            box.classList.remove('filled');
            box.textContent = '';
        });
        
        if (streak === 0) {
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

    function flashBoxes(isCorrect) {
        const streak1Container = document.getElementById('streak1-container');
        const streak2Container = document.getElementById('streak2-container');
        const activeContainer = streak1Container.style.display !== 'none' ? streak1Container : streak2Container;
        const boxes = activeContainer.querySelectorAll('.progress-box');
        
        const flashClass = isCorrect ? 'flash-correct' : 'flash-wrong';
        boxes.forEach(box => box.classList.add(flashClass));
        setTimeout(() => {
            boxes.forEach(box => box.classList.remove(flashClass));
        }, 10000); // 10 seconds
    }

    function handleUpdate(d) {
        if (!d || d.puzzle_id !== 4) return;
        
        console.log('[P4] handleUpdate received:', d);
        
        if (d.listening) setListening();
        
        // Update streak display - show current song (1-based) / total
        if (d.streak !== undefined && d.total_required !== undefined) {
            const streakEl = document.getElementById('streak');
            if (streakEl) {
                // Display current song being worked on (streak + 1) unless puzzle is solved
                const currentSong = d.streak >= d.total_required ? d.total_required : d.streak + 1;
                streakEl.textContent = `${currentSong}/${d.total_required}`;
            }
        }
        
        // Handle sample song playback
        if (d.sample_song && d.playing_sample) {
            console.log('[P4] Playing sample song:', d.sample_song.url);
            play(d.sample_song.url, () => {
                // When sample finishes, send message to backend
                console.log('[P4] Sample finished, notifying backend');
                fetch('/puzzle4_sample_finished', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'}
                }).catch(err => console.error('[P4] Failed to notify sample finish:', err));
            });
        }
        
        // Handle completion message
        if (d.show_completion) {
            showingCompletion = true;  // Set flag to prevent box updates
            const statusEl = document.getElementById('status-text');
            if (statusEl) {
                statusEl.textContent = 'Nivel Completado';
                statusEl.classList.remove('storing', 'playing-sample');
                statusEl.classList.add('completed');
            }
        }
        
        // Update storing/playing status - check playing_sample first, then storing
        if (d.playing_sample !== undefined && !showingCompletion) {
            updateStatus(d.storing || false, d.playing_sample);
        } else if (d.storing !== undefined && !showingCompletion) {
            updateStatus(d.storing, false);
        }
        
        // Handle sequence validation feedback
        if (d.sequence_correct !== undefined) {
            flashBoxes(d.sequence_correct);
        }
        
        // Update progress boxes ONLY if not showing completion
        if (d.streak !== undefined && !showingCompletion) {
            const playedSeq = d.played_sequence || [];
            console.log('[P4] Updating boxes - streak:', d.streak, 'played_sequence:', playedSeq);
            updateProgressBoxes(d.streak, d.current_progress || 0, playedSeq);
        }
        
        if (d.play && !solved) {
            play(d.play.url);
        }
        if (d.puzzle_solved && !solved) {
            solved = true;
            showingCompletion = false;  // Reset flag
            if (statusEl) {
                statusEl.textContent = 'Song Completed';
                statusEl.className = 'status solved';
            }
            setTimeout(() => window.location.href = '/puzzleSuperat/4', 4000);
        }
    }

    function loadSnapshot() {
        fetch('/current_state')
            .then(r => r.json())
            .then(d => handleUpdate(d))
            .catch(() => {});
    }

    function initSSE() {
        const es = new EventSource('/state_stream');
        es.onmessage = evt => { try { handleUpdate(JSON.parse(evt.data)); } catch(e) {} };
        es.onopen = () => loadSnapshot();
        es.onerror = () => {};
    }

    document.addEventListener('DOMContentLoaded', () => {
        setListening();

        // Initialize display - start with 1/2
        updateStatus(false, false);
        updateProgressBoxes(0, 0, []);
        
        // Initialize streak display to 1/2
        const streakEl = document.getElementById('streak');
        if (streakEl) {
            streakEl.textContent = '1/2';
        }

        // Silent unlock: on first user interaction, retry any pending playback
        const tryPending = () => {
            if (audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume().catch(()=>{});
            }
            if (pendingUrl) {
                const url = pendingUrl;
                pendingUrl = null;
                play(url);
            }
            document.removeEventListener('click', tryPending);
            document.removeEventListener('touchstart', tryPending);
            document.removeEventListener('keydown', tryPending);
        };
        document.addEventListener('click', tryPending, { once: true });
        document.addEventListener('touchstart', tryPending, { once: true });
        document.addEventListener('keydown', tryPending, { once: true });

        initSSE();
        setTimeout(loadSnapshot, 600);
    });
})();
