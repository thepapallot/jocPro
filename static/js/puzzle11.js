(function () {
    var CORRECT_SOUND_URL         = '/static/audios/effects/correcte.wav';
    var PHASE_COMPLETE_SOUND_URL  = '/static/audios/effects/fase_completada.wav';

    function playSound(url) {
        var a = new Audio(url);
        a.play().catch(function (e) { console.warn('Audio play failed:', e); });
    }

    var prevSubstepSuccessCount = -1;
    var prevCompletedCount      = -1;
    var redirectedOnSolve       = false;
    var STEPS = [
        'El token 5 debe pasar por el terminal 6 y apretar el botón verde',
        'El token 10 debe pasar por el terminal 2 y seguidamente por el terminal 5',
        'El token 13 debe pasar 3 veces por el terminal 2',
        'El token 14 debe pasar por el terminal 1 y apretar el botón rojo, luego el botón verde y luego el botón amarillo',
        'El token 17 debe pasar por el terminal 1, luego por el terminal 2 y luego por el terminal 3',
        'El token 18 debe pasar por el terminal 9 y apretar el botón negro dos veces',
        'El token 20 se debe pasar por el terminal que tenga el símbolo "alpha"',
        'El token 22 debe pasar por el terminal 3, luego por el terminal 4 y allí apretar el botón amarillo',
        'El token 31 debe pasar por el terminal 7 dos veces y luego apretar el botón rojo',
        'El token 35 debe pasar por el terminal que tiene el símbolo "pi"',
    ];
    var STEPS_EN = [
        'Token 5 must pass through terminal 6 and press the green button',
        'Token 10 must pass through terminal 2 and then through terminal 5',
        'Token 13 must pass through terminal 2 three times',
        'Token 14 must pass through terminal 1 and press the red button, then the green button, then the yellow button',
        'Token 17 must pass through terminal 1, then terminal 2, and then terminal 3',
        'Token 18 must pass through terminal 9 and press the black button twice',
        'Token 20 must pass through the terminal that has the "alpha" symbol',
        'Token 22 must pass through terminal 3, then terminal 4, and press the yellow button there',
        'Token 31 must pass through terminal 7 twice and then press the red button',
        'Token 35 must pass through the terminal with the "pi" symbol',
    ];
    var STEPS_CA = [
        'El token 5 ha de passar pel terminal 6 i prémer el botó verd',
        'El token 10 ha de passar pel terminal 2 i seguidament pel terminal 5',
        'El token 13 ha de passar 3 vegades pel terminal 2',
        'El token 14 ha de passar pel terminal 1 i prémer el botó vermell, després el botó verd i després el botó groc',
        'El token 17 ha de passar pel terminal 1, després pel terminal 2 i després pel terminal 3',
        'El token 18 ha de passar pel terminal 9 i prémer el botó negre dues vegades',
        'El token 20 ha de passar pel terminal que tingui el símbol "alpha"',
        'El token 22 ha de passar pel terminal 3, després pel terminal 4 i allà prémer el botó groc',
        'El token 31 ha de passar pel terminal 7 dues vegades i després prémer el botó vermell',
        'El token 35 ha de passar pel terminal que té el símbol "pi"',
    ];
    function language() {
        return window.PyramidLanguage?.current() || 'es';
    }

    var timeline     = document.getElementById('p11-timeline');
    var stepText     = document.getElementById('p11-step-text');
    var stepMain     = document.getElementById('p11-step-main');
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
            dot.textContent = String(idx + 1);
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
        var lang = language();
        var labels = lang === 'ca' ? ['Pas', 'Completat', 'Actual', 'Pendent']
            : lang === 'eng' ? ['Step', 'Completed', 'Current', 'Pending']
            : ['Paso', 'Completado', 'Actual', 'Pendiente'];
        timeline.setAttribute('aria-label', lang === 'ca' ? 'Progrés del simulacre'
            : lang === 'eng' ? 'Simulation progress' : 'Progreso del simulacro');

        dots.forEach(function (dot, idx) {
            dot.classList.remove('is-completed', 'is-current');

            if (solved || idx < currentStep) {
                dot.classList.add('is-completed');
            } else if (idx === currentStep) {
                dot.classList.add('is-current');
            }
            var completed = solved || idx < currentStep;
            dot.textContent = completed ? '✓' : String(idx + 1);
            dot.setAttribute('aria-label', labels[0] + ' ' + (idx + 1) + ': ' + labels[completed ? 1 : idx === currentStep ? 2 : 3]);
            if (!solved && idx === currentStep) dot.setAttribute('aria-current', 'step');
            else dot.removeAttribute('aria-current');
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
        } else {
            timeline.classList.remove('hidden');
            var instructions = language() === 'ca' ? STEPS_CA : language() === 'eng' ? STEPS_EN : STEPS;
            if (stepMain) {
                stepMain.textContent = instructions[currentStep] || '';
            } else if (stepText) {
                stepText.textContent = instructions[currentStep] || '';
            }
            currentCard.classList.remove('hidden');
            solvedBanner.classList.add('hidden');
        }
    }

    function handleUpdate(d) {
        if (window.PyramidLevelVictory?.active) return;
        if (!d || d.puzzle_id !== 11) return;

        var substepSuccessCount = d.substep_success_count || 0;
        var completedCount = (d.completed_steps || []).length;

        if (prevSubstepSuccessCount !== -1) {
            if (substepSuccessCount > prevSubstepSuccessCount) {
                playSound(CORRECT_SOUND_URL);
            }
            if (completedCount > prevCompletedCount) {
                playSound(PHASE_COMPLETE_SOUND_URL);
            }
        }

        prevSubstepSuccessCount = substepSuccessCount;
        prevCompletedCount = completedCount;

        render(d.current_step, d.completed_steps || [], d.puzzle_solved || false);

        if (d.puzzle_solved && !redirectedOnSolve) {
            redirectedOnSolve = true;
            window.PyramidLevelVictory.complete(11);
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
