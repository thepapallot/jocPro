(function () {
    const TOTAL = 5;
    let redirected = false;
    const imgEl = document.querySelector("#image-area img");
    const normalImg = imgEl.src;
    const alarmImg = normalImg.replace("Laberint.png", "LaberintVermell.png");
    const CORRECT_SOUND_URL = "/static/audios/effects/correcte.wav";
    const INCORRECT_SOUND_URL = "/static/audios/effects/incorrecte.wav";
    const PHASE_COMPLETE_SOUND_URL = "/static/audios/effects/fase_completada.wav";
    const PUZZLE_COMPLETE_SOUND_URL = "/static/audios/effects/nivel_completado.wav"; // NEW
    const prevProgress = {}; // keep only for snapshot rendering after error flash
    let errorBlockUntil = 0;
    const activeErrorPlayers = new Set();
    let queuedSnapshot = null;

    // NEW: alarm flash toggler during transition
    let alarmFlashInterval = null;
    function startAlarmFlash(durationMs = 5000) {
        stopAlarmFlash();
        let on = true;
        // immediate toggle kick
        setAlarmMode(on);
        alarmFlashInterval = setInterval(() => {
            on = !on;
            setAlarmMode(on);
        }, 1000);
        // stop after duration
        setTimeout(() => stopAlarmFlash(), durationMs);
    }
    function stopAlarmFlash() {
        if (alarmFlashInterval) {
            clearInterval(alarmFlashInterval);
            alarmFlashInterval = null;
        }
    }

    function setProgress(player, progress) {
        const el = document.getElementById(`bar-player-${player}`);
        if (!el) return;
        prevProgress[player] = progress; // update cache for later snapshots
        const pct = (progress / TOTAL) * 100;
        el.style.width = pct + "%";
        const textEl = el.querySelector(".bar-text");
        if (textEl) textEl.textContent = `${progress} / ${TOTAL}`;
        if (progress >= TOTAL) {
            el.classList.add("complete");
        } else {
            el.classList.remove("complete");
        }
    }

    function applySnapshot(players) {
        players.forEach(p => {
            prevProgress[p.player] = p.progress;
            setProgress(p.player, p.progress);
        });
    }

    function setAlarmMode(active) {
        if (active) {
            imgEl.src = alarmImg;
            document.body.classList.add("alarm-mode");
        } else {
            imgEl.src = normalImg;
            document.body.classList.remove("alarm-mode");
        }
    }

    function playSound(url) {
        const audio = new Audio(url);
        audio.play().catch(err => console.warn("Audio play failed:", err));
    }

    function startErrorFlash(player) {
        errorBlockUntil = Date.now() + 4000;
        activeErrorPlayers.add(player);
        const barInner = document.getElementById(`bar-player-${player}`);
        const row = document.querySelector(`.player-row[data-player="${player}"]`);
        const barOuter = row ? row.querySelector('.bar-outer') : null;
        const label = row ? row.querySelector('.player-label') : null;

        if (barInner) barInner.classList.add("error-flash");
        if (barOuter) barOuter.classList.add("error-flash");
        if (label) label.classList.add("error-flash");
        if (row) row.classList.add("error-flash");

        setTimeout(() => {
            const elInner = document.getElementById(`bar-player-${player}`);
            const elRow = document.querySelector(`.player-row[data-player="${player}"]`);
            const elOuter = elRow ? elRow.querySelector('.bar-outer') : null;
            const elLabel = elRow ? elRow.querySelector('.player-label') : null;

            if (elInner) elInner.classList.remove("error-flash");
            if (elOuter) elOuter.classList.remove("error-flash");
            if (elLabel) elLabel.classList.remove("error-flash");
            if (elRow) elRow.classList.remove("error-flash");

            activeErrorPlayers.delete(player);
            if (activeErrorPlayers.size === 0) {
                errorBlockUntil = 0;
                if (queuedSnapshot) {
                    applySnapshot(queuedSnapshot);
                    queuedSnapshot = null;
                }
            }
        }, 4000);
    }

    function handleUpdate(data) {
        if (data.puzzle_id !== 2) return;

        const inErrorBlock = errorBlockUntil && Date.now() < errorBlockUntil;
        if (inErrorBlock) {
            if (data.players) queuedSnapshot = data.players;
            if (data.puzzle_solved && !redirected) {
                redirected = true;
                playSound(PUZZLE_COMPLETE_SOUND_URL); // NEW
                setTimeout(() => { window.location.href = `/puzzleSuperat/2`; }, 1000);
            }
            return;
        }

        // Wrong symbol: queue reset snapshot, flash, and return
        if (data.error_reset) {
            playSound(INCORRECT_SOUND_URL);
            if (data.players) queuedSnapshot = data.players;
            startErrorFlash(data.error_reset.player);
            return;
        }

        // Use player_update directly to trigger sounds and render
        if (data.player_update) {
            const p = data.player_update.player;
            const prog = data.player_update.progress;
            // Play correcte.wav on any valid progress update
            if (prog > 0 && prog < TOTAL) {
                playSound(CORRECT_SOUND_URL);
            }
            // Play fase_completada.wav when the bar reaches TOTAL
            if (prog === TOTAL) {
                playSound(PHASE_COMPLETE_SOUND_URL);
            }
            setProgress(p, prog);
        }

        if (data.players) applySnapshot(data.players);

        // Play alarm sound and start flashing alarm mode every second during the transition
        if (data.play_alarm_sound) {
            playSound(data.play_alarm_sound.url);
            startAlarmFlash(5000); // flash for 5s while sound plays
        }

        // Play normal sound; stop flashing (final state comes via alarm_mode)
        if (data.play_normal_sound) {
            playSound(data.play_normal_sound.url);
            stopAlarmFlash(); // stop any previous flash
        }

        // Honor explicit alarm_mode state (stop any flashing and set final state)
        if (data.alarm_mode !== undefined) {
            stopAlarmFlash();
            setAlarmMode(!!data.alarm_mode);
        }

        if (data.puzzle_solved && !redirected) {
            redirected = true;
            playSound(PUZZLE_COMPLETE_SOUND_URL); // NEW
            console.log("Puzzle 2 solved! Redirecting...");
            setTimeout(() => { window.location.href = `/puzzleSuperat/2`; }, 1000);
        }
    }

    function initSSE() {
        const es = new EventSource("/state_stream");
        es.onopen = () => {
            fetch("/start_puzzle/2", { method: "POST" })
                .catch(err => console.warn("Failed to start puzzle 2:", err));
        };
        es.onmessage = (evt) => {
            try {
                const data = JSON.parse(evt.data);
                handleUpdate(data);
            } catch (e) {
                console.warn("Bad SSE data", e);
            }
        };
    }

    document.addEventListener("DOMContentLoaded", initSSE);
})();
