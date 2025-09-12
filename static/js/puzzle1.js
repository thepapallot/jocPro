const puzzleContainer = document.getElementById('puzzle-container');
const solvedContainer = document.createElement('div');
solvedContainer.id = 'solved-container';
document.body.insertBefore(solvedContainer, puzzleContainer);

const timerElement = document.getElementById('timer');
let timer = 120; // 2 minutes in seconds
let timerInterval;

const eventSource = new EventSource('/state_stream');

eventSource.onopen = function() {
    console.log("SSE connection opened."); // Debugging log
};

eventSource.onerror = function(event) {
    console.error("Error with SSE connection:", event); // Debugging log
};

eventSource.onmessage = function(event) {
    try {
        const data = JSON.parse(event.data);
        console.log("Received data from state_queue:", data); // Debugging log

        // Stop the timer and display "Puzzle 1 completed" message
        if (data.puzzle_solved) {
            console.log("Puzzle 1 completed."); // Debugging log
            clearInterval(timerInterval); // Stop the timer
            const completedMessage = document.createElement('div');
            completedMessage.id = 'puzzle-completed-message';
            completedMessage.textContent = "Puzzle 1 completed";
            completedMessage.style.fontSize = '3em';
            completedMessage.style.color = 'green';
            completedMessage.style.textAlign = 'center';
            completedMessage.style.marginTop = '20px';
            document.body.appendChild(completedMessage);

            // Redirect directly to Puzzle 2 after 20 seconds
            setTimeout(() => {
                console.log("Redirecting to Puzzle 2.");
                window.location.href = "/puzzle/2"; // Directly redirect to Puzzle 2
            }, 20000); // 20 seconds
            return;
        }

        // Start the timer when the puzzle starts
        if (data.start_timer) {
            console.log("Starting the timer."); // Debugging log
            startTimer();
        }

        // Display solved operations at the top
        if (data.solved) {
            const solvedElement = document.createElement('div');
            solvedElement.className = 'correct';
            solvedElement.textContent = data.solved.text; // Example: "7 + 7 = 14"
            solvedContainer.appendChild(solvedElement);

            // Update the solved operation in the grid
            const solvedOperation = document.querySelector(`.op[data-position="${data.solved.position}"]`);
            if (solvedOperation) {
                solvedOperation.textContent = '✔'; // Display a green tick
                solvedOperation.classList.add('correct'); // Mark as solved
            }

            // Remove solved operation from the top after 3 seconds
            setTimeout(() => {
                solvedElement.remove();
            }, 3000);
        }

        // Display incorrect operation in red
        if (data.incorrect) {
            const incorrectElement = document.createElement('div');
            incorrectElement.className = 'incorrect';
            incorrectElement.textContent = data.incorrect.text; // Example: "3 + 4 = 7"
            solvedContainer.appendChild(incorrectElement);

            // Highlight the incorrect operation in the grid
            const incorrectOperation = document.querySelector(`.op[data-result="${data.incorrect.result}"]`);
            if (incorrectOperation) {
                incorrectOperation.classList.add('incorrect');
            }

            // Remove the incorrect operation from the top after 5 seconds
            setTimeout(() => {
                incorrectElement.remove();
            }, 5000);
        }

        // Update the grid with operations
        const operations = Array.isArray(data.operations) ? data.operations : [];
        operations.forEach(([result, position, status]) => {
            let puzzleElement = document.querySelector(`.op[data-position="${position}"]`);
            if (!puzzleElement) {
                // Create a new grid element if it doesn't exist
                puzzleElement = document.createElement('div');
                puzzleElement.className = 'op';
                puzzleElement.dataset.position = position;
                puzzleElement.dataset.result = result;
                puzzleContainer.appendChild(puzzleElement);
            }

            // Update the content and style based on the status
            if (status === "N") {
                puzzleElement.textContent = `_ + _ = ${result}`;
                puzzleElement.classList.remove('correct', 'incorrect');
            } else if (status === "Y") {
                puzzleElement.textContent = '✔'; // Display a green tick for solved
                puzzleElement.classList.add('correct');
            }
        });
    } catch (error) {
        console.error("Error processing SSE data:", error);
    }
};

function startTimer() {
    console.log("Timer started."); // Debugging log
    clearInterval(timerInterval); // Clear any existing timer
    timer = 120; // Reset timer to 2 minutes
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        timer--;
        console.log(`Timer updated: ${timer}`); // Debugging log
        updateTimerDisplay();

        if (timer <= 0) {
            clearInterval(timerInterval);
            console.log("Timer expired. Resetting puzzle.");
            // Notify the backend that the timer expired
            fetch('/timer_expired', { method: 'POST' });
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timer / 60);
    const seconds = timer % 60;
    timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
