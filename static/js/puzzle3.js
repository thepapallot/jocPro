(function() {
    const pointsEl = document.getElementById('streak'); // Stable shared HUD hook.
    const timerEl = document.getElementById('timer');
    const questionTextEl = document.getElementById('question-text');
    const answerAreaEl = document.getElementById('answer-area'); // was answersEl inside question-area
    const playerStatusEl = document.getElementById('player-status');
    const feedbackEl = document.getElementById('feedback');
    const playerSummaryEl = document.getElementById('player-summary');
    const shellEl = document.getElementById('puzzle3-shell');
    const stageEl = document.getElementById('quiz-stage');
    const announcementEl = document.getElementById('golden-announcement');
    const goldenBadgeEl = document.getElementById('golden-question-badge');


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
    let lastResult = null;
    let updateRevision = 0;
    let connectionGeneration = 0;
    let startRequest = null;
    let goldenAnnouncement = false;
    let goldenQuestion = false;
    let clockPaused = false;

    function updateGoldenState(data) {
        // Missing fields on partial events do not dismiss a warning or resume
        // the clock. Only a server question (or completion) reveals the board.
        if (typeof data.golden_question === 'boolean') goldenQuestion = data.golden_question;
        if (typeof data.clock_paused === 'boolean') clockPaused = data.clock_paused;
        if (data.golden_announcement === true) goldenAnnouncement = true;
        else if (data.question && data.golden_announcement !== true && data.clock_paused !== true) goldenAnnouncement = false;
        if (data.puzzle_solved) {
            goldenAnnouncement = false;
            goldenQuestion = false;
            clockPaused = false;
        }
        announcementEl.hidden = !goldenAnnouncement;
        goldenBadgeEl.hidden = !goldenQuestion || goldenAnnouncement;
        shellEl.classList.toggle('is-golden-announcement', goldenAnnouncement);
        shellEl.classList.toggle('is-golden-question', goldenQuestion);
        stageEl.inert = goldenAnnouncement;
        stageEl.setAttribute('aria-hidden', String(goldenAnnouncement));
        timerEl.classList.toggle('is-clock-paused', clockPaused || goldenAnnouncement);
        if (Number.isInteger(data.question_points)) {
            document.getElementById('golden-question-points').textContent = String(data.question_points);
        }
    }

    function updateHud(data, silent = false) {
        // Only the server owns the five-minute clock and awards points. A tick
        // is a partial update: never clear the question, choices or result.
        if (Number.isInteger(data.total_points)) {
            pointsEl.textContent = String(Math.max(0, data.total_points));
        }
        if (Number.isInteger(data.remaining)) {
            const seconds = Math.max(0, data.remaining);
            timerEl.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
            if (!silent && !data.puzzle_solved && !clockPaused && !goldenAnnouncement) window.PyramidCountdownAudio?.tick('p3-clock', seconds);
        }
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

    function updatePlayerAnswered(player, silent = false) {
        const chip = document.getElementById('pchip-' + player);
        if (chip) {
            chip.classList.remove('correct','wrong');
            chip.classList.add('answered');
        }
        updatePlayerSummary(document.querySelectorAll('.player-chip.answered, .player-chip.correct, .player-chip.wrong').length);
        if (silent) return;
        // Play boto.wav on each player submission (delay if blocked)
        const now = Date.now();
        const delay = soundBlockUntil > now ? (soundBlockUntil - now) : 0;
        setTimeout(() => playSound(BTN_SOUND_URL), delay);
    }

    function applyAnsweredMap(map) {
        if (!map) return;
        Object.entries(map).forEach(([p, v]) => {
            const index = parseInt(p, 10);
            updatePlayerAnswered(index, true);
            markAnswerRowByValue(index, v);
        });
    }

    function renderQuestion(qObj, answeredPlayers = [], answeredMap = {}, questionNumber = null, silent = false) {
        // Play content appears sound on new question
        if (!silent) playSound(APAREIX_SOUND_URL);

        currentQuestionId = qObj.id;
        activeQuestionNumber = Number.isInteger(questionNumber) ? questionNumber : activeQuestionNumber;
        lastResult = null;
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
        if (feedbackEl) { feedbackEl.textContent = ''; feedbackEl.className = ''; }
        resetPlayerChips(answeredPlayers); // Reset all chip styling first
        applyAnsweredMap(answeredMap);
        window.PyramidLanguage.apply(answerAreaEl);
        fitQuizText();
    }

    function updatePlayerSummary(answeredCount) {
        if (!playerSummaryEl) return;
        playerSummaryEl.textContent = `${answeredCount}/${totalPlayers}`;
    }

    function showWrong() {
        if (feedbackEl) { feedbackEl.className = ''; feedbackEl.textContent = ''; }
    }

    function showQuestionComplete() {
        if (feedbackEl) { feedbackEl.className = ''; feedbackEl.textContent = ''; }
    }

    function showSolved() {
        if (solvedSequenceStarted) return;
        updateGoldenState({ puzzle_solved: true });
        solvedSequenceStarted = true;
        window.PyramidCountdownAudio?.reset('p3-clock');
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

    function showResult(result, silent = false) {
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
        const signature = JSON.stringify(result);
        const playFeedback = !silent && signature !== lastResult;
        lastResult = signature;
        if (result.success) {
            if (playFeedback) playSoundAndBlock(CORRECT_SOUND_URL, 500);
            showQuestionComplete();
        } else {
            if (playFeedback) playSoundAndBlock(INCORRECT_SOUND_URL, 500);
            showWrong();
        }
    }

    function handleUpdate(data, silent = false) {
        if (solvedSequenceStarted || window.PyramidLevelVictory?.active) return;
        if (!data || data.puzzle_id !== 3) return;
        updateGoldenState(data);
        updateHud(data, silent);
        if (data.puzzle_solved) {
            showSolved();
            return;
        }
        if (goldenAnnouncement) return;
        if (typeof data.total_players === 'number' && data.total_players > 0 && data.total_players !== totalPlayers) {
            initPlayers(data.total_players);
        }
        if (data.question) {
            // During a result window question_number may already refer to the
            // next question. Keep the displayed question and feedback intact.
            const newQuestion = currentQuestionId !== data.question.id ||
                (!data.question_result && ((data.question_result === null && lastResult !== null) ||
                    (Number.isInteger(data.question_number) && activeQuestionNumber !== data.question_number)));
            if (newQuestion) {
                renderQuestion(data.question, data.answered_players || [], data.answered_map || {}, data.question_number, silent);
            } else if (!lastResult) {
                applyAnsweredMap(data.answered_map);
            }
        }
        if (data.player_answer) {
            updatePlayerAnswered(data.player_answer.player, silent);
            markAnswerRowByValue(data.player_answer.player, data.player_answer.answer, !silent);
        }
        if (data.question_result) {
            showResult(data.question_result, silent);
        }
        if (data.puzzle_solved) {
            showSolved();
        }
    }

    function loadSnapshot(generation, retries = 2) {
        const revision = updateRevision;
        return fetch('/current_state', { cache: 'no-store' })
            .then(r => r.json())
            .then(d => {
                if (generation !== connectionGeneration) return;
                // Never overwrite a newer live choice/tick with an older HTTP
                // response. Fetch a fresh snapshot if an event raced recovery.
                if (revision !== updateRevision) {
                    if (retries > 0) return loadSnapshot(generation, retries - 1);
                    return;
                }
                handleUpdate(d, true);
            })
            .catch(err => console.warn('Failed to recover puzzle 3:', err));
    }

    function initSSE() {
        const es = new EventSource('/state_stream');
        es.onmessage = evt => {
            try {
                const data = JSON.parse(evt.data);
                if (data.puzzle_id === 3) updateRevision++;
                handleUpdate(data);
            } catch(e) {}
        };
        es.onopen = () => {
            const generation = ++connectionGeneration;
            // The endpoint is idempotent for an already-current puzzle. Call
            // once on page entry, never again on EventSource reconnection.
            if (!startRequest) {
                startRequest = fetch('/start_puzzle/3', { method: 'POST' })
                    .catch(err => console.warn('Failed to start puzzle 3:', err));
            }
            startRequest.then(() => {
                if (generation === connectionGeneration) loadSnapshot(generation);
            });
        };
    }

    function installDebugHelpers() {
        const sampleQuestion = {
            id: 999,
            q: '¿Qué países forman parte de Europa?',
            answers: ['España', 'Japón', 'Francia', 'Brasil', 'Italia', 'Egipto', 'Alemania', 'Canadá', 'Australia', 'India']
        };
        const correctAnswers = [5, 1, 5, 1, 5, 1, 5, 1, 1, 1];

        window.puzzle3Debug = {
            push(data) {
                handleUpdate({ puzzle_id: 3, ...data });
            },
            question() {
                handleUpdate({
                    puzzle_id: 3,
                    question: sampleQuestion,
                    question_number: 1,
                    remaining: 300,
                    duration: 300,
                    total_points: 0,
                    answered_players: [],
                    answered_map: {}
                });
            },
            answers(players = [0, 2, 4, 7]) {
                players.forEach((player, index) => {
                    setTimeout(() => {
                        handleUpdate({
                            puzzle_id: 3,
                            player_answer: { player, answer: correctAnswers[player] }
                        });
                    }, index * 250);
                });
            },
            correctResult() {
                handleUpdate({
                    puzzle_id: 3,
                    question_result: {
                        success: true,
                        correct_answers: correctAnswers,
                        player_answers: Object.fromEntries(correctAnswers.map((answer, player) => [player, answer]))
                    },
                    total_points: 10,
                    correct_count: 1
                });
            },
            wrongResult() {
                handleUpdate({
                    puzzle_id: 3,
                    question_result: {
                        success: false,
                        correct_answers: correctAnswers,
                        player_answers: Object.fromEntries(correctAnswers.map((answer, player) => [player, player === 0 ? 1 : answer]))
                    }
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
        updateHud({ remaining: 300, total_points: 0 }, true);
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
