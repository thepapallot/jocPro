(function() {
    const streakEl = document.getElementById('streak');
    const questionTextEl = document.getElementById('question-text');
    const answerAreaEl = document.getElementById('answer-area'); // was answersEl inside question-area
    const playerStatusEl = document.getElementById('player-status');
    const feedbackEl = document.getElementById('feedback'); // ADD THIS LINE
    // Preload boto.wav
    const btnSoundEl = document.getElementById('btn-sound');

    // Consistent sound helper (same as puzzles 1 and 2)
    function playSound(url) {
        const audio = new Audio(url);
        audio.play().catch(err => console.warn("Audio play failed:", err));
    }
    const BTN_SOUND_URL = "/static/audios/effects/boto.wav";
    const CORRECT_SOUND_URL = "/static/audios/effects/correcte.wav";
    const INCORRECT_SOUND_URL = "/static/audios/effects/incorrecte.wav";
    const PUZZLE_COMPLETE_SOUND_URL = "/static/audios/effects/nivel_completado.wav"; // NEW

    // Sound block window to avoid overlap after correct/incorrect
    let soundBlockUntil = 0;
    function playSoundAndBlock(url, ms) {
        playSound(url);
        soundBlockUntil = Date.now() + ms;
    }

    const TOTAL_PLAYERS = 10;
    let currentQuestionId = null;

    function initPlayers() {
        playerStatusEl.innerHTML = "";
        for (let i = 0; i < TOTAL_PLAYERS; i++) {
            const chip = document.createElement('div');
            chip.className = 'player-chip';
            chip.id = 'pchip-' + i;
            chip.textContent = `Caja ${i}`; // was just i
            playerStatusEl.appendChild(chip);
        }
    }

    function updatePlayerDone(player) {
        const chip = document.getElementById('pchip-' + player);
        if (chip) chip.classList.add('done');
    }

    function resetPlayerChips(answeredPlayers = []) {
        for (let i = 0; i < TOTAL_PLAYERS; i++) {
            const chip = document.getElementById('pchip-' + i);
            if (!chip) continue;
            // Always remove all state classes
            chip.classList.remove('done','answered','correct','wrong');
        }
    }

    function updatePlayerAnswered(player) {
        const chip = document.getElementById('pchip-' + player);
        if (chip) {
            chip.classList.remove('correct','wrong');
            chip.classList.add('answered');
        }
        // Play boto.wav on each player submission (delay if blocked)
        const now = Date.now();
        const delay = soundBlockUntil > now ? (soundBlockUntil - now) : 0;
        setTimeout(() => playSound(BTN_SOUND_URL), delay);
    }

    function applyAnsweredMap(map) {
        if (!map) return;
        Object.keys(map).forEach(p => updatePlayerAnswered(parseInt(p,10)));
    }

    function renderQuestion(qObj, streak, target, answeredPlayers = [], answeredMap = {}) {
        currentQuestionId = qObj.id;
        questionTextEl.textContent = qObj.q;
        answerAreaEl.innerHTML = ""; // clear answer area
        (qObj.answers || []).forEach((ans, idx) => {
            const row = document.createElement('div');
            row.className = 'answer-row';
            row.dataset.answerIndex = idx; // store 0-based for comparison
            const indexSpan = document.createElement('div');
            indexSpan.className = 'answer-index';
            indexSpan.textContent = idx + 1; // display 1-6
            const textSpan = document.createElement('div');
            textSpan.className = 'answer-text';
            textSpan.textContent = ans;
            row.appendChild(indexSpan);
            row.appendChild(textSpan);
            answerAreaEl.appendChild(row); // append to answer-area
        });
        streakEl.textContent = `${streak + 1}/${target}`; // show current question number
        feedbackEl.textContent = "";
        feedbackEl.className = "";
        resetPlayerChips(answeredPlayers); // Reset all chip styling first
    }

    function setStreak(streak, target) {
        streakEl.textContent = `${streak + 1}/${target}`; // show current question number
    }

    function showWrong(player, answer, expected) {
        feedbackEl.className = 'err';
        feedbackEl.textContent = `Se ha encontrado al menos una respuesta incorrecta. Reseteando preguntas.`;
    }

    function showQuestionComplete(streak, target) {
        feedbackEl.className = 'ok';
        feedbackEl.textContent = `Pregunta completada correctamente!`;
    }

    function showSolved() {
        // Play puzzle completion sound
        playSound(PUZZLE_COMPLETE_SOUND_URL);
        feedbackEl.className = 'ok';
        feedbackEl.textContent = 'Nivel superado!';
        setTimeout(() => {
            window.location.href = '/puzzleSuperat/3';
        }, 1200);
    }

    function showResult(result, streak, target) {
        if (!result) return;
        const { success, correct_answer, player_answers } = result;
        // Color answer rows
        const rows = answerAreaEl.querySelectorAll('.answer-row');
        rows.forEach(r => {
            const idx = parseInt(r.dataset.answerIndex,10);
            console.log('Checking answer row', idx, correct_answer, player_answers);
            if ((idx+1) === correct_answer) {
                //r.classList.add('correct');
            } else if (Object.values(player_answers).includes(idx+1)) {
                // some player chose this wrong one
                r.classList.add('wrong');
            }
        });
        // Color player chips
        Object.entries(player_answers).forEach(([p, ansIdx]) => {
            const chip = document.getElementById('pchip-' + p);
            if (!chip) return;
            chip.classList.remove('answered');
            if (ansIdx === correct_answer) {
                chip.classList.add('correct');
            } else {
                chip.classList.add('wrong');
            }
        });
        if (success) {
            // Play correct sound and block 500ms to hear it well
            playSoundAndBlock(CORRECT_SOUND_URL, 500);
            feedbackEl.className = 'ok';
            feedbackEl.textContent = `Respuestas correctas! ${streak}/${target}`;
        } else {
            // Play incorrect sound and block 500ms to hear it well
            playSoundAndBlock(INCORRECT_SOUND_URL, 500);
            feedbackEl.className = 'err';
            feedbackEl.textContent = `Algunas respuestas incorrectas. Reseteando Preguntas.`;
        }
        setStreak(streak, target);
    }

    function handleUpdate(data) {
        if (data.puzzle_id !== 3) return;
        if (data.question) {
            renderQuestion(
                data.question,
                data.streak || 0,
                data.target || 10,
                data.answered_players || [],
                data.answered_map || {}
            );
        }
        if (data.player_answer) {
            updatePlayerAnswered(data.player_answer.player);
        }
        if (data.question_result) {
            showResult(data.question_result, data.streak || 0, data.target || 10);
        }
        if (data.puzzle_solved) {
            showSolved();
        }
    }

    function loadSnapshot() {
        fetch('/current_state')
            .then(r => r.json())
            .then(d => {
                if (d && d.puzzle_id === 3 && d.question) {
                    renderQuestion(
                        d.question,
                        d.streak || 0,
                        d.target || 10,
                        d.answered_players || [],
                        d.answered_map || {}
                    );
                }
            })
            .catch(() => {});
    }

    function initSSE() {
        const es = new EventSource('/state_stream');
        es.onmessage = evt => {
            try {
                handleUpdate(JSON.parse(evt.data));
            } catch(e) {}
        };
        es.onopen = () => {
            // Start Puzzle 3 when SSE is connected
            fetch('/start_puzzle/3', { method: 'POST' })
                .catch(err => console.warn("Failed to start puzzle 3:", err));
        };
        //es.onopen = () => loadSnapshot();
    }

    document.addEventListener('DOMContentLoaded', () => {
        initPlayers();
        initSSE();
        /*setTimeout(() => {
            if (!questionTextEl.textContent) loadSnapshot();
        }, 700);*/
    });
})();
