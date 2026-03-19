(function () {
    const MAX_GIFS = 5;

    let currentStreakIndex = 0;  // 0-based index into STREAKS
    let timerInterval = null;
    let timeLeft = 0;

    const gifEl = document.getElementById('fase-gif');
    const timerEl = document.getElementById('timer-overlay');
    const wrongEl = document.getElementById('wrong-img');
    const goodEl = document.getElementById('good-img');
    const waitScreen = document.getElementById('wait-screen');
    const countdownEl = document.getElementById('countdown-number');

    function playEffect(file) {
        try {
            const audio = new Audio(`/static/audios/effects/${file}`);
            audio.play().catch(() => {}); // ignore autoplay restrictions
        } catch (e) {
            console.warn("Failed to play effect:", file, e);
        }
    }

    function getGifUrl(streakId, giffIndex) {
        // failIndex is 1-based (1..5)
        if(streakId != 4){
            return `/static/images/puzzleFinal/imatges/fase${streakId}_${giffIndex}.gif`;
        }

        if(streakId == 4){
            return `/static/images/puzzleFinal/imatges/fase4_1.gif`;
        }
    }

    function showGif(streakId, giffIndex) {
        const url = getGifUrl(streakId, giffIndex);
        // Force gif reload by busting cache
        gifEl.src = url + '?t=' + Date.now();
        gifEl.style.display = 'block';
        timerEl.style.display = 'block';
        wrongEl.style.display = 'none';  // hide wrong image when new round starts
        goodEl.style.display = 'none';  // hide good image when new round starts
    }

    function startStreak(duration) {
        
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
                wrongEl.style.display = 'block';  // show wrong image
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
        gifEl.style.display = 'none';
        timerEl.style.display = 'none';
        wrongEl.style.display = 'none';
        goodEl.style.display = 'none';
        waitScreen.style.display = 'block';

        let count = 3;
        countdownEl.textContent = count;
        playEffect('beep_countdown.wav');

        const interval = setInterval(() => {
            count--;
            if (count <= 0) {
                clearInterval(interval);
                waitScreen.style.display = 'none';
                countdownEl.textContent = '';
                onDone();
            } else {
                playEffect('beep_countdown.wav');
                countdownEl.textContent = count;
            }
        }, 1000);
    }

    function handleUpdate(d) {
        if (!d || d.puzzle_id !== -1) return;

        console.log("Received update:", d);

        if (d.streak_solved) {
            playEffect('fase_completada.wav');
            clearInterval(timerInterval);
            gifEl.style.display = 'none';
            timerEl.style.display = 'none';
            wrongEl.style.display = 'none';
            goodEl.style.display = 'block';  // show good image
        }

        if(d.startRound) {
            if (d.round > d.total_rounds) {
                // All streaks done — puzzle solved
                //onPuzzleSolved();
                console.log("Puzzle solved!");
                return;
            }
            showWaitCountdown(() => {
                showGif(d.round, d.num_giff);
                startStreak(d.duration);
            });
        }

        if (d.puzzle_solved) {
            console.log("Puzzle solved!");
            playEffect('nivel_completado.wav');

            setTimeout(() => {
                console.log("Redirecting to Final");
                window.location.href = "/final";
            }, 3000); // 20 seconds
            return;
        }
        // if (data.streak_solved) onStreakSolved();
        // if (data.streak_failed) onStreakFail();
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

    document.addEventListener("DOMContentLoaded", initSSE);
})();
