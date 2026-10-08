(function() {
    const streakEl = document.getElementById('streak');
    const questionTextEl = document.getElementById('question-text');
    const answerAreaEl = document.getElementById('answer-area'); // was answersEl inside question-area
    const playerStatusEl = document.getElementById('player-status');
    const feedbackEl = document.getElementById('feedback');
    const playerSummaryEl = document.getElementById('player-summary');


    // Measure in the game's logical canvas: CSS transforms scale the complete
    // board afterwards, so resolution and device pixel ratio cannot alter wrapping.
    function fitText(box) {
        const content = box.querySelector('.quiz-fit-content');
        if (!content || !content.textContent) return;
        const style = getComputedStyle(box);
        const height = box.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - 2;
        if (height <= 0 || box.clientWidth <= 0) return;
        const lineRatio = parseFloat(style.lineHeight) / parseFloat(style.fontSize);
        let low = 1;
        const maximum = parseFloat(style.getPropertyValue('--quiz-text-max'));
        let high = Math.min(height / lineRatio, maximum);
        while (high - low > .25) {
            const size = (low + high) / 2;
            content.style.fontSize = `${size}px`;
            if (content.scrollHeight <= height && content.scrollWidth <= content.clientWidth) low = size;
            else high = size;
        }
        content.style.fontSize = `${low}px`;
    }

    function fitQuizText() {
        fitText(questionTextEl);
        answerAreaEl.querySelectorAll('.answer-text').forEach(fitText);
    }

    let fitFrame = null;
    function scheduleTextFit() {
        if (fitFrame !== null) return;
        fitFrame = requestAnimationFrame(() => {
            fitFrame = null;
            fitQuizText();
        });
    }

    // Consistent sound helper (same as puzzles 1 and 2)
    function playSound(url) {
        const audio = new Audio(url);
        audio.play().catch(err => console.warn("Audio play failed:", err));
    }
    const BTN_SOUND_URL = "/static/audios/effects/boto.wav";
    const CORRECT_SOUND_URL = "/static/audios/effects/correcte.wav";
    const INCORRECT_SOUND_URL = "/static/audios/effects/incorrecte.wav";
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
            markAnswerRowByValue(index, v);
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
        questionTextEl.querySelector('.quiz-fit-content').textContent = qObj.q;
        document.getElementById("answer-change-hint").hidden = false;
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
            const content = document.createElement('span');
            content.className = 'quiz-fit-content';
            content.textContent = ans;
            textSpan.appendChild(content);
            row.appendChild(indexSpan);
            row.appendChild(textSpan);
            const choice = document.createElement('div');
            choice.className = 'answer-choice';
            choice.setAttribute('role', 'img');
            choice.dataset.i18nAriaLabel = 'game.quizUnanswered';
            choice.innerHTML = '<span class="answer-mark answer-mark--yes" aria-hidden="true">✓</span><span class="answer-mark answer-mark--no" aria-hidden="true">✕</span>';
            row.appendChild(choice);
            answerAreaEl.appendChild(row); // append to answer-area
        });
        streakEl.textContent = `${activeQuestionNumber}/${normalizedTarget}`;
        if (feedbackEl) { feedbackEl.textContent = ''; feedbackEl.className = ''; }
        resetPlayerChips(answeredPlayers); // Reset all chip styling first
        applyAnsweredMap(answeredMap);
        window.PyramidLanguage.apply(answerAreaEl);
        fitQuizText();
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
        window.PyramidLevelVictory.complete(3);
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

    function markAnswerRowByValue(slot, value, animate = false) {
        const row = answerAreaEl.querySelector(`.answer-row[data-answer-index="${slot}"]`);
        if (!row) return;

        // Cancel the previous impact before fast edits or final result feedback.
        [row, ...row.querySelectorAll('.answer-mark')].forEach(el => {
            el.getAnimations().forEach(animation => animation.cancel());
        });
        row.classList.remove('green', 'red', 'correct', 'wrong');
        const normalized = normalizeAnswerValue(value);
        const choice = row.querySelector('.answer-choice');
        choice.dataset.i18nAriaLabel = normalized === 5 ? 'game.quizYesSelected' : normalized === 1 ? 'game.quizNoSelected' : 'game.quizUnanswered';
        window.PyramidLanguage.apply(choice);
        if (normalized === 5) {
            row.classList.add('green');
        } else if (normalized === 1) {
            row.classList.add('red');
        }
        if (animate && normalized !== null && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            const mark = choice.querySelector(normalized === 5 ? '.answer-mark--yes' : '.answer-mark--no');
            const colour = getComputedStyle(row).getPropertyValue('--answer-colour').trim();
            mark.animate([
                { transform: 'scale(.55)', boxShadow: `0 0 0 0 ${colour}` },
                { transform: 'scale(1.22)', boxShadow: `0 0 0 10px ${colour}, 0 0 48px ${colour}`, offset: .3 },
                { transform: 'scale(1.06)', boxShadow: `0 0 0 24px transparent, 0 0 22px ${colour}` }
            ], { duration: 700, easing: 'cubic-bezier(.16,1,.3,1)' });
            row.animate([
                { boxShadow: `inset 0 0 0 3px ${colour}, 0 0 24px ${colour}` },
                { boxShadow: 'inset 0 0 0 0 transparent, 0 0 0 transparent' }
            ], { duration: 850, easing: 'ease-out' });
        }
    }

    function showResult(result, streak, target) {
        if (!result) return;

        const playerAnswers = result.player_answers || {};
        const expectedValues = Array.isArray(result.correct_answers)
            ? result.correct_answers
            : (Array.isArray(result.correct_answer) ? result.correct_answer : []);
        const expectedAnswer = normalizeAnswerValue(result.correct_answer);

        document.getElementById('answer-change-hint').hidden = true;

        // Preserve the submitted choice separately from the final correctness.
        const rows = answerAreaEl.querySelectorAll('.answer-row');
        rows.forEach(r => {
            const idx = parseInt(r.dataset.answerIndex, 10);
            const expected = expectedValues.length > idx ? normalizeAnswerValue(expectedValues[idx]) : expectedAnswer;
            const submitted = normalizeAnswerValue(playerAnswers[idx]);

            markAnswerRowByValue(idx, playerAnswers[idx]);
            if (submitted !== null && expected !== null && submitted === expected) {
                r.classList.add('correct');
            } else if (submitted !== null && expected !== null && submitted !== expected) {
                r.classList.add('wrong');
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
        if (window.PyramidLevelVictory?.active) return;
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
            markAnswerRowByValue(data.player_answer.player, data.player_answer.answer, true);
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
        const textLayoutObserver = new ResizeObserver(scheduleTextFit);
        textLayoutObserver.observe(questionTextEl);
        textLayoutObserver.observe(answerAreaEl);
        document.fonts.ready.then(scheduleTextFit);
        document.fonts.addEventListener('loadingdone', scheduleTextFit);
        window.addEventListener('resize', scheduleTextFit, { passive: true });
        initSSE();
    });
})();
