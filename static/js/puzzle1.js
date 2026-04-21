(function() {
    const totalRounds = 2;
    const puzzleContainer = document.getElementById('puzzle-container');
    const bottomArea = document.getElementById('bottom-area');

    let solvedContainer = document.getElementById('solved-container');
    if (!solvedContainer) {
        solvedContainer = document.createElement('div');
        solvedContainer.id = 'solved-container';
        bottomArea.appendChild(solvedContainer);
    }

    let roundIndicator = document.getElementById('round-indicator');
    if (!roundIndicator) {
        roundIndicator = document.createElement('div');
        roundIndicator.id = 'round-indicator';
        roundIndicator.setAttribute('aria-label', 'Fase actual');
        roundIndicator.innerHTML = `
            <span class="phase-step is-active"></span>
            <span class="phase-link"></span>
            <span class="phase-step"></span>
        `;

        const objectivePanel = document.getElementById('objective-panel');
        if (objectivePanel) {
            objectivePanel.prepend(roundIndicator);
        } else {
            bottomArea.appendChild(roundIndicator);
        }
    }

    const timerElement = document.getElementById('timer');
    const objectivePanel = document.getElementById('objective-panel');
    const objectiveFormula = document.getElementById('objective-formula');
    const formulaLeftImage = document.getElementById('formula-left-image');
    const formulaRightImage = document.getElementById('formula-right-image');
    const formulaLeftValue = document.getElementById('formula-left-value');
    const formulaRightValue = document.getElementById('formula-right-value');
    const formulaResultValue = document.getElementById('formula-result-value');
    const objectiveMessage = document.getElementById('objective-message');
    let formulaResetTimeout = null;

    let timer = 120;
    let timerInterval;
    let timerRunning = false;
    let currentRound = null;
    let currentRoundSize = null;
    let pendingSolvedResult = null;
    let awaitingRecoveryOperations = false;
    let operationsDelayTimeout = null;

    function playEffect(file) {
        try {
            const audio = new Audio(`/static/audios/effects/${file}`);
            audio.play().catch(() => {});
        } catch (e) {
            console.warn("Failed to play effect:", file, e);
        }
    }

    function clearSolvedContainer() {
        solvedContainer.innerHTML = '';
    }

    function setDangerScreenActive(isActive) {
        document.body.classList.toggle('p1-danger-state', Boolean(isActive));
    }

    function renderStatus(kind, value = null) {
        if (!solvedContainer) return;

        const badge = document.createElement('div');
        badge.className = 'status-badge';

        if (kind === 'success') {
            badge.classList.add('is-success');
        } else if (kind === 'error') {
            badge.classList.add('is-error');
        } else if (kind === 'reset') {
            badge.classList.add('is-reset');
        } else if (kind === 'timeout') {
            badge.classList.add('is-timeout');
        } else if (kind === 'countdown') {
            badge.classList.add('is-countdown');
        }

        if (value !== null && value !== undefined) {
            const valueNode = document.createElement('span');
            valueNode.className = 'status-badge-value';
            valueNode.textContent = String(value);
            badge.appendChild(valueNode);
        }

        clearSolvedContainer();
        solvedContainer.appendChild(badge);
    }

    function parseExpression(expression) {
        const normalized = String(expression || '').trim();
        const match = /(\d+)\s*\+\s*(\d+)\s*=\s*(\d+)\s*$/.exec(normalized);
        if (!match) return null;
        return {
            left: match[1],
            right: match[2],
            result: match[3]
        };
    }

    function resetObjectiveFormula() {
        if (!objectiveFormula) return;

        if (formulaResetTimeout) {
            clearTimeout(formulaResetTimeout);
            formulaResetTimeout = null;
        }

        objectiveFormula.classList.remove('show-values', 'success', 'error', 'result-only');
        if (objectivePanel) {
            objectivePanel.classList.remove('p1-formula-error');
        }
        if (formulaLeftValue) formulaLeftValue.textContent = '--';
        if (formulaRightValue) formulaRightValue.textContent = '--';
        if (formulaResultValue) formulaResultValue.textContent = '--';
        if (formulaLeftImage) formulaLeftImage.hidden = false;
        if (formulaRightImage) formulaRightImage.hidden = false;
        if (objectiveMessage) {
            objectiveMessage.textContent = '';
            objectiveMessage.classList.remove('is-visible', 'is-error');
        }
    }

    function setObjectiveMessage(text, state = 'idle') {
        if (!objectiveMessage) return;

        const value = String(text || '').trim();
        objectiveMessage.textContent = value;
        objectiveMessage.classList.remove('is-error');
        objectiveMessage.classList.toggle('is-visible', value.length > 0);
        if (state === 'error' && value.length > 0) {
            objectiveMessage.classList.add('is-error');
        }
    }

    function isFormulaPreviewActive() {
        return formulaResetTimeout !== null;
    }

    function setObjectiveFormula(expression, state = 'idle', resultOnly = false, displayMs = null) {
        const parsed = parseExpression(expression);
        if (!parsed || !objectiveFormula) {
            resetObjectiveFormula();
            return;
        }

        if (formulaResetTimeout) {
            clearTimeout(formulaResetTimeout);
            formulaResetTimeout = null;
        }

        objectiveFormula.classList.remove('success', 'error', 'result-only');
        objectiveFormula.classList.add('show-values');
        if (objectivePanel) {
            objectivePanel.classList.remove('p1-formula-error');
        }
        if (state === 'success' || state === 'error') {
            objectiveFormula.classList.add(state);
        }
        if (state === 'error' && objectivePanel) {
            objectivePanel.classList.add('p1-formula-error');
        }
        if (resultOnly) {
            objectiveFormula.classList.add('result-only');
        }

        if (formulaLeftImage) formulaLeftImage.hidden = true;
        if (formulaRightImage) formulaRightImage.hidden = true;
        if (formulaLeftValue) formulaLeftValue.textContent = parsed.left;
        if (formulaRightValue) formulaRightValue.textContent = parsed.right;
        if (formulaResultValue) formulaResultValue.textContent = parsed.result;

        const timeoutMs = Number(displayMs) > 0 ? Number(displayMs) : (resultOnly ? 2000 : 3000);
        formulaResetTimeout = setTimeout(() => {
            resetObjectiveFormula();
        }, timeoutMs);
    }

    function setRoundIndicator(round, count = null) {
        if (!round) return;

        const phaseSteps = Array.from(roundIndicator.querySelectorAll('.phase-step'));
        const phaseLinks = Array.from(roundIndicator.querySelectorAll('.phase-link'));

        phaseSteps.forEach((step, index) => {
            const phaseNumber = index + 1;
            step.classList.toggle('is-complete', phaseNumber < round);
            step.classList.toggle('is-active', phaseNumber === round);
        });

        phaseLinks.forEach((link, index) => {
            link.classList.toggle('is-complete', index < round - 1);
        });

        document.body.classList.remove(
            'round-1-active',
            'round-2-active'
        );
        if (round <= totalRounds) {
            document.body.classList.add(`round-${round}-active`);
        }
    }

    function setPuzzleGridClass(round) {
        puzzleContainer.classList.remove('round-1', 'round-2');
        if (round <= totalRounds) {
            puzzleContainer.classList.add(`round-${round}`);
        }
    }

    function animateGridIn() {
        puzzleContainer.style.transition = 'none';
        puzzleContainer.style.opacity = '0.3';
        puzzleContainer.style.transform = 'translateY(10px)';

        requestAnimationFrame(() => {
            puzzleContainer.style.transition = 'all 0.35s ease';
            puzzleContainer.style.opacity = '1';
            puzzleContainer.style.transform = 'translateY(0)';
        });
    }

    function animateCorrect(opElement) {
        if (!opElement || !opElement.animate) return;
        opElement.animate(
            [
                { transform: 'scale(1)' },
                { transform: 'scale(1.2)' },
                { transform: 'scale(1)' }
            ],
            { duration: 250, easing: 'ease-out' }
        );
    }

    function animateIncorrect(opElement) {
        if (!opElement || !opElement.animate) return;
        opElement.animate(
            [
                { transform: 'translateX(0)' },
                { transform: 'translateX(-8px)' },
                { transform: 'translateX(8px)' },
                { transform: 'translateX(0)' }
            ],
            { duration: 220, easing: 'ease-out' }
        );
    }

    function renderOperations(operations) {
        const list = Array.isArray(operations) ? operations : [];
        const round = currentRound;
        const recentSolvedResult = pendingSolvedResult;

        setRoundIndicator(round, list.length);
        setPuzzleGridClass(round);

        puzzleContainer.innerHTML = '';

        list.forEach(([result, position, status]) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'grid-cell';

            const opDiv = document.createElement('div');
            opDiv.className = 'op';
            opDiv.dataset.position = String(position);
            opDiv.dataset.result = String(result);

            if (status === 'Y') {
                const tickClass = String(result) === recentSolvedResult ? 'tick is-new' : 'tick';
                opDiv.innerHTML = `<span class="${tickClass}">✓</span>`;
                opDiv.classList.add('correct');
            } else {
                opDiv.innerHTML = `<span>${result}</span>`;
            }

            wrapper.appendChild(opDiv);
            puzzleContainer.appendChild(wrapper);
        });

        animateGridIn();
        pendingSolvedResult = null;
    }

    function loadCurrentState() {
        fetch('/current_state')
            .then(r => r.json())
            .then(data => {
                if (!data) return;
                if (data.puzzle_id && data.puzzle_id !== 1) return;

                if (data.round !== undefined) {
                    currentRound = data.round;
                    setRoundIndicator(currentRound);
                    setPuzzleGridClass(currentRound);
                }

                if (data.round_size !== undefined) {
                    currentRoundSize = data.round_size;
                }

                if (data.operations) {
                    renderOperations(data.operations);
                    resetObjectiveFormula();
                }

                if (!timerRunning) {
                    startTimer();
                }
            })
            .catch(err => console.warn("Failed to load current state", err));
    }

    function handleUpdate(data) {
        try {
            if (!data || typeof data !== 'object') return;
            if (data.keep_alive) return;
            if (data.puzzle_id && data.puzzle_id !== 1) return;

            console.log('Received data from state_queue:', data);

            if (data.puzzle_solved) {
                playEffect('nivel_completado.wav');
                clearInterval(timerInterval);
                timerRunning = false;

                // Show solved banner and flash
                const banner = document.getElementById('p1-solved-banner');
                if (banner) banner.classList.remove('hidden');
                document.body.classList.add('p1-solved-flash');
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
                return;
            }

            if (data.start_timer) {
                playEffect('apareix_contingut.wav');
                timerElement.classList.remove('expired');
                setDangerScreenActive(false);
                clearSolvedContainer();
                resetObjectiveFormula();
                startTimer();
            }

            if (data.streak_completed) {
                renderStatus('success');

                playEffect('fase_completada.wav');

                clearInterval(timerInterval);
                timerRunning = false;
            }

            if (data.countdown_next_round && typeof data.countdown_next_round.seconds === 'number') {
                const seconds = data.countdown_next_round.seconds;
                renderStatus('countdown', seconds);

                playEffect('beep_countdown.wav');
            }

            if (data.round_size !== undefined) {
                currentRoundSize = data.round_size;
            }

            if (data.round !== undefined) {
                if (currentRound === null) {
                    currentRound = data.round;
                    setRoundIndicator(currentRound);
                    setPuzzleGridClass(currentRound);
                } else if (data.round !== currentRound) {
                    currentRound = data.round;
                    setRoundIndicator(currentRound);
                    setPuzzleGridClass(currentRound);

                    solvedContainer.innerHTML = '';
                    resetObjectiveFormula();

                    puzzleContainer.style.transition = 'none';
                    puzzleContainer.style.opacity = '0.3';
                    puzzleContainer.style.transform = 'translateY(10px)';

                    requestAnimationFrame(() => {
                        puzzleContainer.style.transition = 'all 0.35s ease';
                        puzzleContainer.style.opacity = '1';
                        puzzleContainer.style.transform = 'translateY(0)';
                    });
                }
            }

            if (data.solved) {
                clearSolvedContainer();
                setObjectiveMessage('');
                setObjectiveFormula(data.solved.text, 'success', false);
                pendingSolvedResult = String(data.solved.result);

                const solvedOperation = document.querySelector(`.op[data-result="${data.solved.result}"]`);
                if (solvedOperation) {
                    solvedOperation.innerHTML = '<span class="tick is-new">✓</span>';
                    solvedOperation.classList.remove('incorrect');
                    solvedOperation.classList.add('correct');
                    animateCorrect(solvedOperation);
                }

                const roundTarget = currentRoundSize;
                const completedCount = document.querySelectorAll('.op.correct').length;
                console.log('Round target:', roundTarget);
                console.log('Completed count:', completedCount);
                const isLastOpOfRound = completedCount >= roundTarget;

                if (!isLastOpOfRound) {
                    playEffect('correcte.wav');
                }
            }

            if (data.incorrect) {
                if (operationsDelayTimeout) {
                    clearTimeout(operationsDelayTimeout);
                    operationsDelayTimeout = null;
                }
                awaitingRecoveryOperations = false;
                const incorrectDisplayMs = Number(data.incorrect.display_ms) || 5000;

                playEffect('incorrecte.wav');
                setDangerScreenActive(true);
                renderStatus('error');
                setObjectiveMessage(data.incorrect.text, 'error');
                setObjectiveFormula(data.incorrect.text, 'error', false, incorrectDisplayMs);

                clearInterval(timerInterval);
                timerRunning = false;

                const incorrectOperation = document.querySelector(`.op[data-result="${data.incorrect.result}"]`);
                if (incorrectOperation) {
                    incorrectOperation.classList.add('incorrect');
                    animateIncorrect(incorrectOperation);
                }

                setTimeout(() => {
                    resetObjectiveFormula();
                    //renderStatus('reset');
                    awaitingRecoveryOperations = true;
                }, incorrectDisplayMs);
            }

            if (data.operations) {
                const applyOperationsUpdate = () => {
                    renderOperations(data.operations);
                    if (!isFormulaPreviewActive()) {
                        resetObjectiveFormula();
                    }

                    if (!timerRunning && timer === 0 && timerElement.classList.contains('expired')) {
                        timerElement.classList.remove('expired');
                        startTimer();
                    }
                };

                if (awaitingRecoveryOperations) {
                    awaitingRecoveryOperations = false;
                    //renderStatus('reset');

                    operationsDelayTimeout = setTimeout(() => {
                        clearSolvedContainer();
                        applyOperationsUpdate();
                        operationsDelayTimeout = null;
                    }, 850);
                } else {
                    applyOperationsUpdate();
                }
            }

        } catch (error) {
            console.error('Error processing SSE data:', error);
        }
    }

    function installDebugHelpers() {
        window.puzzle1Debug = {
            push(payload) {
                handleUpdate({ puzzle_id: 1, ...payload });
            },
            round(round = 1, operations = null) {
                const defaultOperations = {
                    1: [[5, 1, 'N'], [8, 2, 'N'], [12, 3, 'N'], [17, 4, 'N']],
                    2: [[6, 1, 'N'], [9, 2, 'N'], [14, 3, 'N'], [18, 4, 'N'], [21, 5, 'N'], [24, 6, 'N'], [29, 7, 'N']],
                    3: [[5, 1, 'N'], [6, 2, 'N'], [7, 3, 'N'], [8, 4, 'N'], [9, 5, 'N'], [10, 6, 'N'], [11, 7, 'N'], [12, 8, 'N'], [13, 9, 'N'], [14, 10, 'N'], [15, 11, 'N'], [16, 12, 'N'], [17, 13, 'N'], [18, 14, 'N'], [20, 15, 'N']]
                };
                handleUpdate({
                    puzzle_id: 1,
                    round,
                    operations: operations || defaultOperations[round] || defaultOperations[1],
                    start_timer: true
                });
            },
            solved(expression = '2 + 3 = 5', result = 5) {
                handleUpdate({
                    puzzle_id: 1,
                    solved: {
                        text: expression,
                        result
                    }
                });
            },
            incorrect(expression = '2 + 8 = 10', result = 10) {
                handleUpdate({
                    puzzle_id: 1,
                    incorrect: {
                        text: expression,
                        result
                    }
                });
            },
            streak(round = 1, nextRound = round + 1) {
                handleUpdate({
                    puzzle_id: 1,
                    streak_completed: true,
                    round,
                    next_round: nextRound
                });
            },
            countdown(seconds = 5, round = 1, nextRound = round + 1) {
                handleUpdate({
                    puzzle_id: 1,
                    round,
                    next_round: nextRound,
                    countdown_next_round: { seconds }
                });
            },
            solvedPuzzle() {
                handleUpdate({
                    puzzle_id: 1,
                    puzzle_solved: true
                });
            },
            demoRound1() {
                this.round(1, [
                    [5, 1, 'N'],
                    [8, 2, 'N'],
                    [12, 3, 'N'],
                    [17, 4, 'N']
                ]);
            },
            demoSuccess() {
                this.round(1, [
                    [5, 1, 'N'],
                    [8, 2, 'N'],
                    [12, 3, 'N'],
                    [17, 4, 'N']
                ]);
                setTimeout(() => this.solved('2 + 3 = 5', 5), 900);
                setTimeout(() => this.push({
                    round: 1,
                    operations: [
                        [5, 1, 'Y'],
                        [8, 2, 'N'],
                        [12, 3, 'N'],
                        [17, 4, 'N']
                    ]
                }), 1300);
                setTimeout(() => this.solved('4 + 4 = 8', 8), 2100);
                setTimeout(() => this.push({
                    round: 1,
                    operations: [
                        [5, 1, 'Y'],
                        [8, 2, 'Y'],
                        [12, 3, 'N'],
                        [17, 4, 'N']
                    ]
                }), 2500);
            },
            demoError() {
                this.round(1, [
                    [5, 1, 'N'],
                    [8, 2, 'N'],
                    [12, 3, 'N'],
                    [17, 4, 'N']
                ]);
                setTimeout(() => this.incorrect('6 + 4 = 10', 10), 900);
            },
            demoNextRound() {
                this.round(1, [
                    [5, 1, 'Y'],
                    [8, 2, 'Y'],
                    [12, 3, 'Y'],
                    [17, 4, 'Y']
                ]);
                setTimeout(() => this.streak(1, 2), 700);
                setTimeout(() => this.countdown(5, 1, 2), 1700);
                setTimeout(() => this.round(2), 7200);
            }
        };
    }

    function startTimer() {
        clearInterval(timerInterval);
        timer = 90;
        timerElement.classList.remove('expired', 'warning');
        setDangerScreenActive(false);
        updateTimerDisplay();

        timerInterval = setInterval(() => {
            timer--;

            if (timer <= 15 && timer > 0) {
                timerElement.classList.add('warning');
            }

            updateTimerDisplay();

            if (timer <= 0) {
                clearInterval(timerInterval);
                timerRunning = false;
                timer = 0;
                updateTimerDisplay();
                timerElement.classList.remove('warning');
                timerElement.classList.add('expired');

                playEffect('fase_nocompletada.wav');
                setDangerScreenActive(true);

                // renderStatus('timeout');  // Keep for future use
                resetObjectiveFormula();
                if (objectivePanel) {
                    objectivePanel.classList.add('p1-formula-error');
                }
                setObjectiveMessage('Tiempo agotado', 'error');

                setTimeout(() => {
                    clearSolvedContainer();
                }, 5000);

                fetch('/timer_expired', { method: 'POST' })
                    .catch(err => console.warn('timer_expired failed:', err));
            }
        }, 1000);

        timerRunning = true;
    }

    function updateTimerDisplay() {
        const minutes = Math.floor(timer / 60);
        const seconds = timer % 60;
        timerElement.textContent =
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    function initSSE() {
        const es = new EventSource("/state_stream");

        es.onopen = () => {
            console.log("SSE connection opened.");
            fetch("/start_puzzle/1", { method: "POST" })
                .catch(err => console.warn("Failed to start puzzle 1:", err));
        };

        es.onmessage = (evt) => {
            try {
                console.log("Received SSE message:", evt.data);
                const data = JSON.parse(evt.data);
                handleUpdate(data);
            } catch (e) {
                console.warn("Bad SSE data", e);
            }
        };

        es.onerror = () => {
            console.error("SSE connection lost. Attempting to reconnect...");
            es.close();
            setTimeout(initSSE, 5000);
        };
    }

    document.addEventListener('DOMContentLoaded', () => {
        //installDebugHelpers();
        //loadCurrentState();
        initSSE();
    });

})();
