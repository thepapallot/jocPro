console.log("Puzzle 2 loaded.");

(function () {
    const TOTAL = 5;
    let redirected = false;
    const seqIndexEl = document.getElementById('puzzle2-container');
    const imgEl = document.querySelector("#image-area img");
    const normalImg = imgEl.src; // keep original src
    const alarmImg = normalImg.replace("Laberint.png", "LaberintVermell.png");

    function setProgress(player, progress) {
        const el = document.getElementById(`bar-player-${player}`);
        if (!el) return;
        const pct = (progress / TOTAL) * 100;
        el.style.width = pct + "%";
        const textEl = el.querySelector(".bar-text");
        if (textEl) textEl.textContent = `${progress} / ${TOTAL}`; // Fixed bug
        if (progress >= TOTAL) {
            el.classList.add("complete");
        }
    }

    function applySnapshot(players) {
        players.forEach(p => setProgress(p.player, p.progress));
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

    function handleUpdate(data) {
        if (data.puzzle_id !== 2) return;
        if (data.players) {
            applySnapshot(data.players);
        }
        if (data.player_update) {
            setProgress(data.player_update.player, data.player_update.progress);
        }
        if (data.play_alarm_sound) {
            playSound(data.play_alarm_sound.url);
        }
        if (data.play_normal_sound) {
            playSound(data.play_normal_sound.url);
        }
        if (data.alarm_mode !== undefined) {
            setAlarmMode(data.alarm_mode);
        }
        if (data.puzzle_solved && !redirected) {
            redirected = true;
            console.log("Puzzle 2 solved! Redirecting...");
            setTimeout(() => {
                window.location.href = `/puzzleSuperat/2`;
            }, 1000);
        }
    }

    function initSSE() {
        const es = new EventSource("/state_stream");
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
