(function() {
    const streakEl = document.getElementById('streak');
    const questionTextEl = document.getElementById('question-text');
    const answerAreaEl = document.getElementById('answer-area'); // was answersEl inside question-area
    const playerStatusEl = document.getElementById('player-status');
    const feedbackEl = document.getElementById('feedback');
    const playerSummaryEl = document.getElementById('player-summary');

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
    const SOLVED_GREEN_DELAY_MS = 2500;

    // Sound block window to avoid overlap after correct/incorrect
    let soundBlockUntil = 0;
    function playSoundAndBlock(url, ms) {
        playSound(url);
        soundBlockUntil = Date.now() + ms;
    }

    let totalPlayers = 10;
    let currentQuestionId = null;
    let activeQuestionNumber = 1;
    let solvedSequenceStarted = false;

    function getDisplayStreak(streak, target) {
        // Mostra el nombre real de respostes correctes (començant per 0)
        return Math.max(0, Math.min(target, streak));
    }

    function getDisplayQuestionNumber(data, fallbackQuestionNumber, target) {
        if (Number.isInteger(data && data.question_number)) {
            return Math.max(1, Math.min(target, data.question_number));
        }
        if (Number.isInteger(data && data.current_question_idx)) {
            return Math.max(1, Math.min(target, data.current_question_idx + 1));
        }
        return Math.max(1, Math.min(target, fallbackQuestionNumber || 1));
    }

    function initPlayers(count = totalPlayers) {
        totalPlayers = count;
        if (!playerStatusEl) return;
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
        Object.entries(map).forEach(([p, v]) => {
            const index = parseInt(p, 10);
            updatePlayerAnswered(index);
            colorAnswerRowByValue(index, v);
        });
    }

    function renderQuestion(qObj, streak, target, answeredPlayers = [], answeredMap = {}, questionNumber = null) {
        const normalizedTarget = Number.isInteger(target) && target > 0 ? target : 6;
        // Play content appears sound on new question
        playSound(APAREIX_SOUND_URL);

        currentQuestionId = qObj.id;
        const explicitQuestion = Number.isInteger(questionNumber) ? questionNumber : null;
        activeQuestionNumber = getDisplayQuestionNumber(
            { question_number: explicitQuestion },
            explicitQuestion || 1,
            normalizedTarget
        );
        questionTextEl.textContent = qObj.q;
        answerAreaEl.innerHTML = ""; // clear answer area
        (qObj.answers || []).forEach((ans, idx) => {
            const row = document.createElement('div');
            row.className = 'answer-row';
            row.dataset.answerIndex = idx; // store 0-based for comparison
            const indexSpan = document.createElement('div');
            indexSpan.className = 'answer-index';
            indexSpan.textContent = idx; // display 0-9
            const textSpan = document.createElement('div');
            textSpan.className = 'answer-text';
            textSpan.textContent = ans;
            row.appendChild(indexSpan);
            row.appendChild(textSpan);
            answerAreaEl.appendChild(row); // append to answer-area
        });
        streakEl.textContent = `${activeQuestionNumber}/${normalizedTarget}`;
        if (feedbackEl) { feedbackEl.textContent = ''; feedbackEl.className = ''; }
        resetPlayerChips(answeredPlayers); // Reset all chip styling first
        applyAnsweredMap(answeredMap);
    }

    function setStreak(streak, target, questionNumber = null) {
        const normalizedTarget = Number.isInteger(target) && target > 0 ? target : 6;
        const displayNumber = getDisplayQuestionNumber(
            { question_number: questionNumber },
            questionNumber || activeQuestionNumber || 1,
            normalizedTarget
        );
        streakEl.textContent = `${displayNumber}/${normalizedTarget}`;
    }

    function updatePlayerSummary(answeredCount) {
        if (!playerSummaryEl) return;
        playerSummaryEl.textContent = `${answeredCount}/${totalPlayers}`;
    }

    function showWrong() {
        if (feedbackEl) { feedbackEl.className = ''; feedbackEl.textContent = ''; }
    }

    function showQuestionComplete(streak, target) {
        if (feedbackEl) { feedbackEl.className = ''; feedbackEl.textContent = ''; }
    }

    function showSolved() {
        if (solvedSequenceStarted) return;
        solvedSequenceStarted = true;

        // Play puzzle completion sound
        playSound(PUZZLE_COMPLETE_SOUND_URL);

        // Delay green solved transition so it does not appear immediately.
        setTimeout(function () {
            const banner = document.getElementById('p3-solved-banner');
            if (banner) banner.classList.remove('hidden');
            document.body.classList.add('p3-solved-flash');

            setTimeout(function () {
                if (window.PyramidGameFlow?.complete(3)) return;
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
            }, 4000);
        }, SOLVED_GREEN_DELAY_MS);
    }

    function normalizeAnswerValue(value) {
        if (typeof value === 'string') {
            const v = value.trim().toLowerCase();
            if (['green', 'g', '5', 'yes', 'y'].includes(v)) return 5;
            if (['red', 'r', '1', 'no', 'n'].includes(v)) return 1;
            return null;
        }
        if (typeof value === 'boolean') return value ? 5 : 1;
        if (typeof value === 'number' && Number.isInteger(value) && (value === 1 || value === 5)) return value;
        return null;
    }

    function colorAnswerRowByValue(slot, value) {
        const row = answerAreaEl.querySelector(`.answer-row[data-answer-index="${slot}"]`);
        if (!row) return;

        row.classList.remove('green', 'red', 'correct', 'wrong');
        const normalized = normalizeAnswerValue(value);
        if (normalized === 5) {
            row.classList.add('green');
        } else if (normalized === 1) {
            row.classList.add('red');
        }
    }

    function showResult(result, streak, target) {
        if (!result) return;

        const playerAnswers = result.player_answers || {};
        const expectedValues = Array.isArray(result.correct_answers)
            ? result.correct_answers
            : (Array.isArray(result.correct_answer) ? result.correct_answer : []);
        const expectedAnswer = normalizeAnswerValue(result.correct_answer);

        // Color answer rows
        const rows = answerAreaEl.querySelectorAll('.answer-row');
        rows.forEach(r => {
            const idx = parseInt(r.dataset.answerIndex, 10);
            const expected = expectedValues.length > idx ? normalizeAnswerValue(expectedValues[idx]) : expectedAnswer;
            const submitted = normalizeAnswerValue(playerAnswers[idx]);

            r.classList.remove('green', 'red', 'correct', 'wrong');
            if (submitted !== null && expected !== null && submitted === expected) {
                r.classList.add('correct');
            } else if (submitted !== null && expected !== null && submitted !== expected) {
                r.classList.add('wrong');
            } else if (submitted === 5) {
                r.classList.add('green');
            } else if (submitted === 1) {
                r.classList.add('red');
            }
        });

        // Color player chips
        Object.entries(playerAnswers).forEach(([p, ansIdx]) => {
            const chip = document.getElementById('pchip-' + p);
            if (!chip) return;
            chip.classList.remove('answered');
            const normalizedCandidate = normalizeAnswerValue(ansIdx);
            const normalizedExpected = expectedValues.length > parseInt(p, 10)
                ? normalizeAnswerValue(expectedValues[parseInt(p, 10)])
                : expectedAnswer;
            if (normalizedCandidate !== null && normalizedExpected !== null && normalizedCandidate === normalizedExpected) {
                chip.classList.add('correct');
            } else {
                chip.classList.add('wrong');
            }
        });
        if (result.success) {
            playSoundAndBlock(CORRECT_SOUND_URL, 500);
            showQuestionComplete(streak, target);
        } else {
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
                data.target || 6,
                data.answered_players || [],
                data.answered_map || {},
                data.question_number || null
            );
            setStreak(data.streak || 0, data.target || 6, data.question_number || null);
        }
        if (data.player_answer) {
            updatePlayerAnswered(data.player_answer.player);
            colorAnswerRowByValue(data.player_answer.player, data.player_answer.answer);
        }
        if (data.question_result) {
            showResult(data.question_result, data.streak || 0, data.target || 6);
            setStreak(data.streak || 0, data.target || 6, data.question_number || null);
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
                        d.target || 6,
                        d.answered_players || [],
                        d.answered_map || {},
                        d.question_number || null
                    );
                    setStreak(d.streak || 0, d.target || 6, d.question_number || null);
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
        setStreak(0, 6);
        installDebugHelpers();
        initSSE();
    });
})();
