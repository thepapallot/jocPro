(function() {
    const streakEl = document.getElementById('streak');
    const questionTextEl = document.getElementById('question-text');
    const answerAreaEl = document.getElementById('answer-area'); // was answersEl inside question-area
    const playerStatusEl = document.getElementById('player-status');
    const feedbackEl = document.getElementById('feedback');
    const playerSummaryEl = document.getElementById('player-summary');
    const securityLevels = Array.from(document.querySelectorAll('.security-level'));

    // Consistent sound helper (same as puzzles 1 and 2)
    function playSound(url) {
        const audio = new Audio(url);
        audio.play().catch(err => console.warn("Audio play failed:", err));
    }
    const BTN_SOUND_URL = "/static/audios/effects/boto.wav";
    const CORRECT_SOUND_URL = "/static/audios/effects/correcte.wav";
    const INCORRECT_SOUND_URL = "/static/audios/effects/incorrecte.wav";
    const PUZZLE_COMPLETE_SOUND_URL = "/static/audios/effects/nivel_completado.wav"; // NEW
    const APAREIX_SOUND_URL = "/static/audios/effects/apareix_contingut.wav"; // NEW

    // Sound block window to avoid overlap after correct/incorrect
    let soundBlockUntil = 0;
    function playSoundAndBlock(url, ms) {
        playSound(url);
        soundBlockUntil = Date.now() + ms;
    }

    let totalPlayers = 10;
    let currentQuestionId = null;
    let activeQuestionNumber = 1;

    function getDisplayStreak(streak, target) {
        // Mostra el nombre real de respostes correctes (començant per 0)
        return Math.max(0, Math.min(target, streak));
    }

    function initPlayers(count = totalPlayers) {
        totalPlayers = count;
        playerStatusEl.innerHTML = "";
        for (let i = 0; i < totalPlayers; i++) {
            const chip = document.createElement('div');
            chip.className = 'player-chip';
            chip.id = 'pchip-' + i;
            chip.dataset.box = i;

            const number = document.createElement('div');
            number.className = 'player-chip-number';
            number.textContent = i;

            chip.appendChild(number);

            playerStatusEl.appendChild(chip);
        }
        updatePlayerSummary(0);
    }

    function updatePlayerDone(player) {
        const chip = document.getElementById('pchip-' + player);
        if (chip) chip.classList.add('done');
    }

    function resetPlayerChips(answeredPlayers = []) {
        for (let i = 0; i < totalPlayers; i++) {
            const chip = document.getElementById('pchip-' + i);
            if (!chip) continue;
            // Always remove all state classes
            chip.classList.remove('done','answered','correct','wrong');
        }
        updatePlayerSummary(answeredPlayers.length || 0);
    }

    function updatePlayerAnswered(player) {
        const chip = document.getElementById('pchip-' + player);
        if (chip) {
            chip.classList.remove('correct','wrong');
            chip.classList.add('answered');
        }
        updatePlayerSummary(document.querySelectorAll('.player-chip.answered, .player-chip.correct, .player-chip.wrong').length);
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
        // Play content appears sound on new question
        playSound(APAREIX_SOUND_URL);

        currentQuestionId = qObj.id;
        activeQuestionNumber = getDisplayStreak(streak, target);
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
        streakEl.textContent = `${getDisplayStreak(streak, target)}/${target}`;
        feedbackEl.textContent = '';
        feedbackEl.className = "";
        resetPlayerChips(answeredPlayers); // Reset all chip styling first
        applyAnsweredMap(answeredMap);
    }

    function setStreak(streak, target) {
        streakEl.textContent = `${getDisplayStreak(streak, target)}/${target}`;
        updateSecurityLevels(streak, target);
    }

    function updatePlayerSummary(answeredCount) {
        if (!playerSummaryEl) return;
        playerSummaryEl.textContent = `${answeredCount}/${totalPlayers}`;
    }

    function updateSecurityLevels(streak, target) {
        const ranges = [
            { level: 1, start: 0, end: 3, size: 3 },
            { level: 2, start: 3, end: 6, size: 3 },
            { level: 3, start: 6, end: 10, size: 4 }
        ];

        securityLevels.forEach((el, index) => {
            const range = ranges[index];
            if (!range) return;

            const fill = el.querySelector('.security-fill');
            const localProgress = Math.max(0, Math.min(range.size, streak - range.start));
            const percentage = (localProgress / range.size) * 100;
            const isComplete = streak >= range.end;
            const isActive = streak >= range.start && streak < range.end;

            el.classList.toggle('is-complete', isComplete);
            el.classList.toggle('is-active', isActive);

            if (fill) {
                fill.style.width = `${isComplete ? 100 : percentage}%`;
            }
        });
    }

    function showWrong() {
        feedbackEl.className = 'err';
        feedbackEl.textContent = 'Hay respuestas incorrectas.';
    }

    function showQuestionComplete(streak, target) {
        feedbackEl.className = 'ok';
        feedbackEl.textContent = `Pregunta completada. Avanzando ${streak}/${target}.`;
    }

    function showSolved() {
        // Play puzzle completion sound
        playSound(PUZZLE_COMPLETE_SOUND_URL);
        // Show solved banner and flash
        const banner = document.getElementById('p3-solved-banner');
        if (banner) banner.classList.remove('hidden');
        document.body.classList.add('p3-solved-flash');
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
        }, 5200);
    }

    function showResult(result, streak, target) {
        if (!result) return;
        const { success, correct_answer, player_answers } = result;
        // Color answer rows
        const rows = answerAreaEl.querySelectorAll('.answer-row');
        rows.forEach(r => {
            const idx = parseInt(r.dataset.answerIndex,10);
            if (success && (idx + 1) === correct_answer) {
                r.classList.add('correct');
            } else if (Object.values(player_answers).includes(idx+1)) {
                // some player chose this wrong one
                if ((idx + 1) !== correct_answer) {
                    r.classList.add('wrong');
                }
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
            showQuestionComplete(streak, target);
        } else {
            // Play incorrect sound and block 500ms to hear it well
            playSoundAndBlock(INCORRECT_SOUND_URL, 500);
            showWrong();
        }
    }

    function handleUpdate(data) {
        if (data.puzzle_id !== 3) return;
        if (typeof data.total_players === 'number' && data.total_players > 0 && data.total_players !== totalPlayers) {
            initPlayers(data.total_players);
        }
        if (data.question) {
            renderQuestion(
                data.question,
                data.streak || 0,
                data.target || 10,
                data.answered_players || [],
                data.answered_map || {}
            );
            setStreak(data.streak || 0, data.target || 10);
        }
        if (data.player_answer) {
            updatePlayerAnswered(data.player_answer.player);
        }
        if (data.question_result) {
            showResult(data.question_result, data.streak || 0, data.target || 10);
            setStreak(data.streak || 0, data.target || 10);
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
                    if (typeof d.total_players === 'number' && d.total_players > 0 && d.total_players !== totalPlayers) {
                        initPlayers(d.total_players);
                    }
                    renderQuestion(
                        d.question,
                        d.streak || 0,
                        d.target || 10,
                        d.answered_players || [],
                        d.answered_map || {}
                    );
                    setStreak(d.streak || 0, d.target || 10);
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

    function installDebugHelpers() {
        const sampleQuestion = {
            id: 999,
            q: 'Que planeta es conocido como el planeta rojo?',
            answers: ['Venus', 'Mercurio', 'Marte', 'Jupiter', 'Saturno', 'Neptuno']
        };

        window.puzzle3Debug = {
            question() {
                handleUpdate({
                    puzzle_id: 3,
                    question: sampleQuestion,
                    streak: 2,
                    target: 10,
                    answered_players: [],
                    answered_map: {}
                });
            },
            answers(players = [0, 2, 4, 7]) {
                players.forEach((player, index) => {
                    setTimeout(() => {
                        handleUpdate({
                            puzzle_id: 3,
                            player_answer: { player, answer: 3 }
                        });
                    }, index * 250);
                });
            },
            correctResult() {
                handleUpdate({
                    puzzle_id: 3,
                    question_result: {
                        success: true,
                        correct_answer: 3,
                        player_answers: {
                            0: 3, 1: 3, 2: 3, 3: 3, 4: 3,
                            5: 3, 6: 3, 7: 3, 8: 3, 9: 3
                        }
                    },
                    streak: 3,
                    target: 10
                });
            },
            wrongResult() {
                handleUpdate({
                    puzzle_id: 3,
                    question_result: {
                        success: false,
                        correct_answer: 3,
                        player_answers: {
                            0: 3, 1: 2, 2: 3, 3: 4, 4: 3,
                            5: 1, 6: 3, 7: 6, 8: 3, 9: 2
                        }
                    },
                    streak: 0,
                    target: 10
                });
            },
            solved() {
                showSolved();
            },
            demo() {
                this.question();
                setTimeout(() => this.answers([0,1,2,3,4,5,6,7,8,9]), 600);
                setTimeout(() => this.correctResult(), 3600);
            }
        };
    }

    document.addEventListener('DOMContentLoaded', () => {
        initPlayers();
        updateSecurityLevels(0, 10);
        installDebugHelpers();
        initSSE();
    });
})();
