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
        const el = document.getElementById(`bar-player-${player}`);
        if (el) el.classList.add("error-flash");
        setTimeout(() => {
            const el2 = document.getElementById(`bar-player-${player}`);
            if (el2) el2.classList.remove("error-flash");
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
        if (data.play_alarm_sound) playSound(data.play_alarm_sound.url);
        if (data.play_normal_sound) playSound(data.play_normal_sound.url);
        if (data.alarm_mode !== undefined) setAlarmMode(data.alarm_mode);
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
