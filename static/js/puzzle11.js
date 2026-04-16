(function () {
    var BTN_SOUND_URL       = '/static/audios/effects/boto.wav';
    var CORRECT_SOUND_URL   = '/static/audios/effects/correcte.wav';
    var COMPLETE_SOUND_URL  = '/static/audios/effects/nivel_completado.wav';

    function playSound(url) {
        var a = new Audio(url);
        a.play().catch(function (e) { console.warn('Audio play failed:', e); });
    }

    var prevEventCount     = -1;
    var prevCompletedCount = -1;
    var redirectedOnSolve  = false;
    var STEPS = [
        'El token 5 debe pasar por el terminal 6 y apretar el botón verde',
        'El token 10 debe pasar por el terminal 2 y seguidamente por el terminal 5',
        'El token 13 debe pasar 3 veces por el terminal 2',
        'El token 14 debe pasar por el terminal 1 y apretar el botón rojo, luego el botón verde y luego el botón amarillo',
        'El token 17 debe pasar por el terminal 1, luego por el terminal 2 y luego por el terminal 3',
        'El token 18 debe pasar por el terminal 9 y apretar el botón negro dos veces',
        'El token 20 se debe pasar por el terminal que tenga un símbolo con una sola onda y dos puntos',
        'El token 22 debe pasar por el terminal 3, luego por el terminal 4 y allí apretar el botón amarillo',
        'El token 31 debe pasar por el terminal 7 dos veces y luego apretar el botón rojo',
        'El token 35 debe pasar por el terminal que tiene el símbolo "pi"',
    ];

    var timeline     = document.getElementById('p11-timeline');
    var stepText     = document.getElementById('p11-step-text');
    var currentCard  = document.getElementById('p11-current-card');
    var solvedBanner = document.getElementById('p11-solved-banner');

    function buildTimeline() {
        if (!timeline) {
            return;
        }

        timeline.innerHTML = '';

        STEPS.forEach(function (_, idx) {
            var dot = document.createElement('div');
            dot.className = 'p11-timeline-dot';
            dot.setAttribute('data-step', String(idx));
            timeline.appendChild(dot);

            if (idx < STEPS.length - 1) {
                var connector = document.createElement('div');
                connector.className = 'p11-timeline-connector';
                connector.setAttribute('data-connector', String(idx));
                timeline.appendChild(connector);
            }
        });
    }

    function renderTimeline(currentStep, solved) {
        if (!timeline) {
            return;
        }

        var dots = timeline.querySelectorAll('.p11-timeline-dot');
        var connectors = timeline.querySelectorAll('.p11-timeline-connector');

        dots.forEach(function (dot, idx) {
            dot.classList.remove('is-completed', 'is-current');

            if (solved || idx < currentStep) {
                dot.classList.add('is-completed');
            } else if (idx === currentStep) {
                dot.classList.add('is-current');
            }
        });

        connectors.forEach(function (connector, idx) {
            connector.classList.toggle('is-completed', solved || idx < currentStep);
        });
    }

    function render(currentStep, completedSteps, solved) {
        renderTimeline(currentStep, solved);

        if (solved) {
            timeline.classList.add('hidden');
            currentCard.classList.add('hidden');
            solvedBanner.classList.remove('hidden');
        } else {
            timeline.classList.remove('hidden');
            stepText.textContent = STEPS[currentStep] || '';
            currentCard.classList.remove('hidden');
            solvedBanner.classList.add('hidden');
        }
    }

    function handleUpdate(d) {
        if (!d || d.puzzle_id !== 11) return;

        var eventCount     = d.event_count     || 0;
        var completedCount = (d.completed_steps || []).length;

        if (prevEventCount !== -1) {
            if (eventCount > prevEventCount)     { playSound(BTN_SOUND_URL); }
            if (completedCount > prevCompletedCount) { playSound(CORRECT_SOUND_URL); }
        }

        prevEventCount     = eventCount;
        prevCompletedCount = completedCount;

        render(d.current_step, d.completed_steps || [], d.puzzle_solved || false);

        if (d.puzzle_solved && !redirectedOnSolve) {
            redirectedOnSolve = true;
            playSound(COMPLETE_SOUND_URL);
            document.body.classList.add('p11-solved-flash');
            setTimeout(function () {
                var nextId = (typeof NEXT_PUZZLE_ID !== 'undefined' && NEXT_PUZZLE_ID !== null)
                    ? NEXT_PUZZLE_ID : 1;
                window.location.href = '/?redirect_flag=puzzle' + nextId;
            }, 5200);
        }
    }

    function initSSE() {
        var es = new EventSource('/state_stream');
        es.onmessage = function (evt) {
            try { handleUpdate(JSON.parse(evt.data)); } catch (e) {}
        };
        es.onopen = function () {
            fetch('/start_puzzle/11', { method: 'POST' })
                .catch(function (err) { console.warn('Failed to start puzzle 11:', err); });
        };
    }

    document.addEventListener('DOMContentLoaded', function () {
        buildTimeline();
        initSSE();
    });
})();
