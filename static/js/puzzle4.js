(function() {
    const statusEl = document.getElementById('p4-status');
    // Use the audio element from HTML (muted+autoplay)
    let audioEl = document.getElementById('p4-audio');
    if (audioEl) {
        audioEl.autoplay = true;
        audioEl.muted = true;
        audioEl.setAttribute('playsinline', '');
        audioEl.preload = 'auto';
    }

    // Use the hidden unlock video injected by the template (real MP4)
    const unlockVid = document.getElementById('p4-unlock-video');

    let solved = false;
    let pendingUrl = null;
    let showingCompletion = false;
    let sampleUrlPlaying = null;
    let snapshotLoaded = false;
    let mediaReady = false; // NEW: only play audio after unlock video is playing
    let audioStarting = false; // NEW: guard while starting

    // Focus window and start unlock video ASAP
    function startUnlockVideo() {
        try { window.focus(); } catch {}
        if (unlockVid) {
            try { unlockVid.play().catch(()=>{}); } catch {}
        }
    }

    // When the unlock video is actually playing, mark mediaReady
    if (unlockVid) {
        unlockVid.addEventListener('playing', () => {
            mediaReady = true;
            // If we had a pending url, start it now
            if (pendingUrl) {
                const url = pendingUrl; pendingUrl = null;
                play(url, () => {
                    fetch('/puzzle4_sample_finished', { method: 'POST', headers: {'Content-Type': 'application/json'} }).catch(()=>{});
                });
            }
        }, { once: true });
        // Fallback: if it stalls, try to kick it every second
        const kick = setInterval(() => {
            if (mediaReady) { clearInterval(kick); return; }
            try { unlockVid.play().catch(()=>{}); } catch {}
        }, 1000);
    }

    // Simple unmute loop (element-only)
    function unmuteElement() {
        let attempts = 0;
        const maxAttempts = 10;
        const timer = setInterval(() => {
            attempts += 1;
            try {
                audioEl.muted = false;
                audioEl.removeAttribute('muted');
                audioEl.volume = 1.0;
            } catch {}
            // Stop when unmuted or max attempts
            if (!audioEl.muted || attempts >= maxAttempts) {
                clearInterval(timer);
            }
        }, 200);
    }

    // Remove active retry spam; we won’t call play() at all
    function scheduleRetry() {
        // ...no-op now: keep signature to minimize diffs...
    }

    function setListening() {
        if (solved || !statusEl) return;
        statusEl.textContent = 'Listening';
        statusEl.className = 'status listening';
    }

    function play(url, onEnd) {
        if (!url || !audioEl) return;
        console.log('[P4] play request (autoplay via muted element):', url);

        // Ensure unlock video is already playing
        if (!mediaReady) {
            pendingUrl = url;
            try { unlockVid && unlockVid.play().catch(()=>{}); } catch {}
            return;
        }

        if (sampleUrlPlaying === url && (audioStarting || (!audioEl.paused && !audioEl.ended))) {
            return;
        }
        audioStarting = true;

        // Always keep muted before attempting to play (policy-friendly)
        audioEl.setAttribute('muted', '');
        audioEl.muted = true;
        audioEl.autoplay = true;
        audioEl.preload = 'auto';
        audioEl.setAttribute('playsinline', '');
        audioEl.onended = null;
        audioEl.loop = false;

        // Only set src if it differs to avoid repeated 206 fetches
        const absolute = new URL(url, window.location.origin).href;
        if (audioEl.src !== absolute) {
            audioEl.src = url;
            audioEl.load();
        } else {
            try { audioEl.currentTime = 0; } catch {}
        }

        // Hook end
        audioEl.onended = () => {
            audioStarting = false;
            if (sampleUrlPlaying === url) sampleUrlPlaying = null;
            if (typeof onEnd === 'function') onEnd();
        };

        // Try to start playback while muted (allowed by policy)
        let tries = 0;
        const tryStart = () => {
            tries += 1;
            const p = audioEl.play();
            if (p && typeof p.then === 'function') {
                p.then(() => {
                    // started; unmute will be handled by 'playing' below
                }).catch(() => {
                    if (tries < 5) setTimeout(tryStart, 250);
                    else audioStarting = false;
                });
            }
        };
        tryStart();

        // Unmute shortly after it starts playing
        const tryUnmuteSoon = () => setTimeout(unmuteElement, 300);
        audioEl.addEventListener('playing', tryUnmuteSoon, { once: true });
        audioEl.addEventListener('canplay', tryUnmuteSoon, { once: true });
        setTimeout(unmuteElement, 1200); // fallback
    }

    // Extra hooks: finish starting flag and ensure play kicks on data ready
    audioEl.addEventListener('playing', () => {
        audioStarting = false;
        if (audioEl.muted) {
            console.log('[P4] playing event: attempting unmute');
            unmuteElement();
        }
    });
    audioEl.addEventListener('loadeddata', () => {
        if (audioEl.paused) {
            audioEl.play().catch(()=>{});
        }
    });

    // Debug hooks
    audioEl.addEventListener('play', () => console.log('[P4] audio element play event'));
    audioEl.addEventListener('ended', () => console.log('[P4] audio ended'));
    audioEl.addEventListener('error', () => console.warn('[P4] audio error', audioEl.error));

    // Retry if page becomes visible again (route transitions can start hidden)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            console.log('[P4] visibilitychange triggers retry');
            startUnlockVideo();
            // No explicit retries; pendingUrl will be handled when mediaReady flips
        }
    });

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
        console.log('[P4] handleUpdate called with:', d);
        
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
        
        // Handle sample song playback (DEDUPE)
        if (d.sample_song && d.playing_sample) {
            const url = d.sample_song.url;
            // Only start if not already started for this URL
            if (sampleUrlPlaying !== url || audioEl.paused || audioEl.ended) { // NEW
                console.log('[P4] Playing sample song:', url);
                sampleUrlPlaying = url; // mark as started
                play(url, () => {
                    // When sample finishes, send message to backend
                    console.log('[P4] Sample finished, notifying backend');
                    fetch('/puzzle4_sample_finished', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'}
                    }).catch(err => console.error('[P4] Failed to notify sample finish:', err));
                });
            } else {
                console.log('[P4] Sample already playing, skip');
            }
        }

        // If backend indicates sample stopped, clear guard (so next sample can start)
        if (d.playing_sample === false && sampleUrlPlaying) { // NEW
            sampleUrlPlaying = null;
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

        // Start unlock video early
        startUnlockVideo();

        // No WebAudio graph — keep element-only flow
        initSSE();
        setTimeout(loadSnapshot, 600); // kept, but guarded by snapshotLoaded
    });
})();
