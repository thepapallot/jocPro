(function() {

    const puzzleContainer = document.getElementById('puzzle-container');

    //Create solved container
    const solvedContainer = document.createElement('div');
    solvedContainer.id = 'solved-container';
    const bottomArea = document.getElementById('bottom-area');
    bottomArea.appendChild(solvedContainer);

    // NEW: round indicator
    const roundIndicator = document.createElement('div');
    roundIndicator.id = 'round-indicator';
    bottomArea.appendChild(roundIndicator);

    const timerElement = document.getElementById('timer');
    let timer = 120; // 2 minutes in seconds
    let timerInterval;
    let timerRunning = false;
    let currentRound = null; // NEW: track current round

    // NEW: simple sound effect helper
    function playEffect(file) {
        try {
            const audio = new Audio(`/static/audios/effects/${file}`);
            audio.play().catch(() => {}); // ignore autoplay restrictions
        } catch (e) {
            console.warn("Failed to play effect:", file, e);
        }
    }

    // NEW: helper to clear solved container before adding new content
    function clearSolvedContainer() {
        solvedContainer.innerHTML = '';
    }

    function cellMappingForRound(round) {
        if (round === 1) return {1:3,2:6,3:10,4:13};
        if (round === 2) return {1:3,2:6,3:7,4:8,5:9,6:10,7:13};
        // round 3 (15 ops) fill sequentially
        const map = {};
        for (let i=1;i<=15;i++) map[i]=i;
        return map;
    }

    function inferRoundByCount(count) {
        if (count === 4) return 1;
        if (count === 7) return 2;
        return 3;
    }

    // NEW: helper to set round text
    function setRoundIndicator(round) {
        if (!round) return;
        roundIndicator.textContent = `${round}/3`;
    }

    function renderOperations(operations) {
        const list = Array.isArray(operations) ? operations : [];
        // Determine round: prefer currentRound, else infer by operations count
        const round = currentRound || inferRoundByCount(list.length);
        setRoundIndicator(round);
        const mapping = cellMappingForRound(round); // position -> cellIndex(1..15)
        // Build quick lookup by position
        const byPos = {};
        list.forEach(op => { byPos[op[1]] = op; });

        // Rebuild full 5x3 grid
        puzzleContainer.innerHTML = '';
        for (let cell = 1; cell <= 15; cell++) {
            const wrapper = document.createElement('div');
            wrapper.className = 'grid-cell';
            // Find if any position maps to this cell
            let matchedPos = null;
            for (const pos in mapping) {
                if (mapping[pos] === cell) {
                    matchedPos = parseInt(pos,10);
                    break;
                }
            }
            if (matchedPos && byPos[matchedPos]) {
                const [result, position, status] = byPos[matchedPos];
                const opDiv = document.createElement('div');
                opDiv.className = 'op';
                opDiv.dataset.position = position;
                opDiv.dataset.result = result;
                if (status === "Y") {
                    // Show completed state persistently
                    opDiv.textContent = 'Completada';
                    opDiv.classList.add('correct');
                } else {
                    opDiv.innerHTML = `
                        <img src="/static/images/puzzle1/tarjeta.png" class="operand">
                        <span>+</span>
                        <img src="/static/images/puzzle1/caixa.png" class="operand">
                        <span>= ${result}</span>
                    `;
                }
                wrapper.appendChild(opDiv);
            } else {
                wrapper.classList.add('empty-cell');
            }
            puzzleContainer.appendChild(wrapper);
        }
    }

    function loadCurrentState() {
        fetch('/current_state')
            .then(r => r.json())
            .then(data => {
                if (!data) return;
                if (data.puzzle_id && data.puzzle_id !== 1) return; // guard if another puzzle active
                // Ensure round is known before first render
                if (data.round !== undefined) {
                    currentRound = data.round;
                    setRoundIndicator(currentRound); // NEW
                }
                if (data.operations) {
                    renderOperations(data.operations);
                }
                if (!timerRunning) {
                    startTimer(); // best effort start if missed initial start_timer event
                }
            })
            .catch(err => console.warn("Failed to load current state", err));
    }

    function handleUpdate(data) {
        try {
            const data = JSON.parse(event.data);
            console.log("Received data from state_queue:", data); // Debugging log

            // Ensure only puzzle 1 data processed
            if (data.puzzle_id && data.puzzle_id !== 1) return;

            // Stop the timer and display "Puzzle 1 completed" message
            if (data.puzzle_solved) {
                // NEW: play final level completed effect
                playEffect('nivel_completado.wav');

                console.log("Puzzle 1 completed."); // Debugging log
                clearInterval(timerInterval); // Stop the timer
                /*const completedMessage = document.createElement('div');
                completedMessage.id = 'puzzle-completed-message';
                completedMessage.textContent = "Puzzle 1 completed";
                completedMessage.style.fontSize = '3em';
                completedMessage.style.color = 'green';
                completedMessage.style.textAlign = 'center';
                completedMessage.style.marginTop = '20px';
                document.body.appendChild(completedMessage);*/

                // Redirect directly to Puzzle 2 after 20 seconds
                setTimeout(() => {
                    console.log("Redirecting to Puzzle 2.");
                    window.location.href = "/puzzleSuperat/1";
                    //window.location.href = "/puzzle/2"; // Directly redirect to Puzzle 2
                }, 5000); // 20 seconds
                return;
            }

            // Start the timer when the puzzle starts
            if (data.start_timer) {
                console.log("Starting the timer."); // Debugging log
                // Clear expired (red) visual state
                timerElement.classList.remove('expired');
                startTimer();
            }

            // NEW: streak completed (round finished) – we will wait and then countdown handled by ticks
            if (data.streak_completed) {
                // Ensure we show only this info
                clearSolvedContainer();
                const msg = document.createElement('div');
                msg.className = 'message';
                msg.textContent = 'Ronda completada';
                solvedContainer.appendChild(msg);
            }

            // NEW: display 5-second countdown to next round
            if (data.countdown_next_round && typeof data.countdown_next_round.seconds === 'number') {
                clearSolvedContainer();
                const seconds = data.countdown_next_round.seconds;
                const cd = document.createElement('div');
                cd.className = 'message';
                cd.textContent = `Seguiente ronda en ${seconds}...`;
                solvedContainer.appendChild(cd);
            }

            // NEW: play streak completed sound when the next round starts
            if (data.round_start) {
                playEffect('fase_completada.wav');
            }

            // NEW: round change handling
            if (data.round !== undefined) {
                if (currentRound === null) currentRound = data.round;
                if (data.round !== currentRound) {
                    currentRound = data.round;
                    setRoundIndicator(currentRound); // NEW
                    // Clear previous round UI
                    puzzleContainer.innerHTML = '';
                    solvedContainer.innerHTML = '';
                }
            }

            // Display solved operations at the top
            if (data.solved) {
                // NEW: clear before showing solved item
                clearSolvedContainer();

                const solvedElement = document.createElement('div');
                solvedElement.className = 'correct';
                solvedElement.textContent = data.solved.text; // Example: "7 + 7 = 14"
                solvedContainer.appendChild(solvedElement);

                // Update the solved operation in the grid (by result)
                const solvedOperation = document.querySelector(`.op[data-result="${data.solved.result}"]`);
                if (solvedOperation) {
                    solvedOperation.textContent = 'Completada';
                    solvedOperation.classList.add('correct');
                }

                // NEW: play correct effect on completion
                playEffect('correcte.wav');

                // Remove solved operation from the top after 3 seconds
                setTimeout(() => {
                    solvedElement.remove();
                }, 3000);
            }

            // Display incorrect operation in red
            if (data.incorrect) {
                // NEW: clear before showing incorrect message
                clearSolvedContainer();

                // NEW: play incorrect effect
                playEffect('incorrecte.wav');

                // Stop timer until reset arrives
                clearInterval(timerInterval);
                timerRunning = false;

                // 1) Show: "ERROR: operacion  '5 + 5 = 10'  incorrecta"
                const errText = `ERROR: operacion  '${data.incorrect.text}'  incorrecta`;
                const errEl = document.createElement('div');
                errEl.className = 'message error';
                errEl.textContent = errText;
                solvedContainer.appendChild(errEl);

                // Highlight the incorrect operation in the grid
                const incorrectOperation = document.querySelector(`.op[data-result="${data.incorrect.result}"]`);
                if (incorrectOperation) {
                    incorrectOperation.classList.add('incorrect');
                }

                // 2) After 2s: clear error message and show "Reseteando operaciones"
                setTimeout(() => {
                    if (errEl.parentNode) errEl.remove();

                    // NEW: clear before showing reset message
                    clearSolvedContainer();

                    const resetEl = document.createElement('div');
                    resetEl.className = 'message error';
                    resetEl.textContent = 'Reseteando operaciones';
                    solvedContainer.appendChild(resetEl);

                    // 3) After 1s more (3s total): clear "Reseteando operaciones"
                    setTimeout(() => {
                        if (resetEl.parentNode) resetEl.remove();
                    }, 3000);
                }, 3000);
            }

            // Update the grid with operations
            if (data.operations) {
                renderOperations(data.operations);

                // Fallback: if we timed out (00:00 red) and timer isn't running, restart on fresh ops
                if (!timerRunning && timer === 0 && timerElement.classList.contains('expired')) {
                    timerElement.classList.remove('expired');
                    startTimer();
                }
            }
        } catch (error) {
            console.error("Error processing SSE data:", error);
        }

    }

    function startTimer() {
        console.log("Timer started."); // Debugging log
        clearInterval(timerInterval); // Clear any existing timer
        timer = 120; // Reset timer to 2 minutes
        // Clear expired (red) visual state
        timerElement.classList.remove('expired');
        updateTimerDisplay();

        timerInterval = setInterval(() => {
            timer--;
            console.log(`Timer updated: ${timer}`); // Debugging log
            updateTimerDisplay();

            if (timer <= 0) {
                clearInterval(timerInterval);
                timerRunning = false;
                // Keep 00:00 and show red
                timer = 0;
                updateTimerDisplay();
                timerElement.classList.add('expired');

                // NEW: play phase not completed effect
                playEffect('fase_nocompletada.wav');

                // NEW: clear before showing timeout message
                clearSolvedContainer();

                // Show timeout message in red for 5s
                const timeoutMsg = document.createElement('div');
                timeoutMsg.className = 'message error';
                timeoutMsg.textContent = 'Tiempo agotado, reseteando operaciones';
                solvedContainer.appendChild(timeoutMsg);
                setTimeout(() => timeoutMsg.remove(), 5000);

                console.log("Timer expired. Resetting puzzle.");
                // Notify the backend that the timer expired
                fetch('/timer_expired', { method: 'POST' });
            }
        }, 1000);
        timerRunning = true;
    }

    function updateTimerDisplay() {
        const minutes = Math.floor(timer / 60);
        const seconds = timer % 60;
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    function initSSE() {
        // SSE already initialized above
        const es = new EventSource("/state_stream");
        es.onopen = () => {
            // Start Puzzle 2 when SSE is connected
            fetch("/start_puzzle/1", { method: "POST" })
                .catch(err => console.warn("Failed to start puzzle 1:", err));
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

    
    document.addEventListener('DOMContentLoaded', initSSE);
    

    /*eventSource.onopen = function() {
        console.log("SSE connection opened."); // Debugging log
        loadCurrentState(); // fetch snapshot after connection
    };*/



    
    /*=> {
        // Fallback if SSE opens slowly
        setTimeout(() => {
            if (!document.querySelector('.op')) {
                loadCurrentState();
            }
        }, 500);
    });*/


})();