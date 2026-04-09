(function () {
    const TOTAL = 5;
    const PLAYER_COUNT = 10;
    let redirected = false;
    const imgEl = document.querySelector("#image-area img");
    const progressReadoutEl = document.getElementById("p2-progress-readout");
    const statusCopyEl = document.getElementById("p2-status-copy");
    const completeOverlayEl = document.getElementById("p2-complete-overlay");
    const completeCopyEl = document.getElementById("p2-complete-copy");
    const normalImg = imgEl.src;
    const alarmImg = normalImg.replace("Laberint.png", "LaberintVermell.png");
    const CORRECT_SOUND_URL = "/static/audios/effects/correcte.wav";
    const INCORRECT_SOUND_URL = "/static/audios/effects/incorrecte.wav";
    const PHASE_COMPLETE_SOUND_URL = "/static/audios/effects/fase_completada.wav";
    const PUZZLE_COMPLETE_SOUND_URL = "/static/audios/effects/nivel_completado.wav"; // NEW
    const progressByPlayer = {};
    const prevProgress = {}; // keep only for snapshot rendering after error flash
    let errorBlockUntil = 0;
    const activeErrorPlayers = new Set();
    let queuedSnapshot = null;
    let alarmFlashTimeout = null;

    // NEW: alarm flash toggler during transition
    let alarmFlashInterval = null;
    function startAlarmFlash(durationMs = 5000) {
        stopAlarmFlash();
        let on = true;
        // immediate toggle kick
        setAlarmMode(on);
        alarmFlashInterval = setInterval(() => {
            on = !on;
            setAlarmMode(on);
        }, 1000);
        // stop after duration
        alarmFlashTimeout = setTimeout(() => stopAlarmFlash(), durationMs);
    }
    function stopAlarmFlash() {
        if (alarmFlashInterval) {
            clearInterval(alarmFlashInterval);
            alarmFlashInterval = null;
        }
        if (alarmFlashTimeout) {
            clearTimeout(alarmFlashTimeout);
            alarmFlashTimeout = null;
        }
    }

    function getCompletedPlayers() {
        return Object.values(progressByPlayer).filter(progress => progress >= TOTAL).length;
    }

    function updateSecuredRoutes() {
        document.querySelectorAll("#p2-secured-list .secured-route").forEach((routeEl) => {
            const player = Number(routeEl.dataset.player);
            const secured = (progressByPlayer[player] || 0) >= TOTAL;
            routeEl.classList.toggle("active", secured);
        });
    }

    function updateHudState() {
        const completed = getCompletedPlayers();
        const solved = completed >= PLAYER_COUNT;
        updateSecuredRoutes();

        if (progressReadoutEl) {
            progressReadoutEl.textContent = `${completed}/${PLAYER_COUNT}`;
        }

        if (statusCopyEl) {
            if (solved) {
                statusCopyEl.textContent = "Sincronizacion completa";
            } else if (document.body.classList.contains("alarm-mode")) {
                statusCopyEl.textContent = "Alarma activa";
            } else if (completed > 0) {
                statusCopyEl.textContent = "Rutas aseguradas";
            } else {
                statusCopyEl.textContent = "Laberinto estable";
            }
        }

        document.body.classList.toggle("p2-solved", solved);

        if (completeOverlayEl) {
            completeOverlayEl.setAttribute("aria-hidden", solved ? "false" : "true");
        }

        if (completeCopyEl) {
            completeCopyEl.textContent = solved
                ? "Todos los equipos han completado su secuencia."
                : `${PLAYER_COUNT - completed} rutas pendientes de sincronizar.`;
        }
    }

    function setProgress(player, progress) {
        const el = document.getElementById(`bar-player-${player}`);
        if (!el) return;
        progressByPlayer[player] = progress;
        prevProgress[player] = progress; // update cache for later snapshots
        el.classList.toggle("has-progress", progress > 0);
        el.dataset.progress = String(progress);
        el.querySelectorAll(".progress-cell").forEach((cell, index) => {
            cell.classList.toggle("active", index < progress);
            cell.classList.toggle("complete", progress >= TOTAL);
        });
        if (progress >= TOTAL) {
            el.classList.add("complete");
        } else {
            el.classList.remove("complete");
        }
        updateHudState();
    }

    function applySnapshot(players) {
        players.forEach(p => {
            prevProgress[p.player] = p.progress;
            setProgress(p.player, p.progress);
        });
    }

    function setAlarmMode(active) {
        if (active) {
            imgEl.src = alarmImg;
            document.body.classList.add("alarm-mode");
            document.body.classList.add("p2-alarm-active");
        } else {
            imgEl.src = normalImg;
            document.body.classList.remove("alarm-mode");
            document.body.classList.remove("p2-alarm-active");
        }
        updateHudState();
    }

    function playSound(url) {
        const audio = new Audio(url);
        audio.play().catch(err => console.warn("Audio play failed:", err));
    }

    function startErrorFlash(player) {
        errorBlockUntil = Date.now() + 4000;
        activeErrorPlayers.add(player);
        const barInner = document.getElementById(`bar-player-${player}`);
        const row = document.querySelector(`.player-row[data-player="${player}"]`);
        const barOuter = row ? row.querySelector('.bar-outer') : null;
        const label = row ? row.querySelector('.player-label') : null;

        if (barInner) barInner.classList.add("error-flash");
        if (barOuter) barOuter.classList.add("error-flash");
        if (label) label.classList.add("error-flash");
        if (row) row.classList.add("error-flash");

        setTimeout(() => {
            const elInner = document.getElementById(`bar-player-${player}`);
            const elRow = document.querySelector(`.player-row[data-player="${player}"]`);
            const elOuter = elRow ? elRow.querySelector('.bar-outer') : null;
            const elLabel = elRow ? elRow.querySelector('.player-label') : null;

            if (elInner) elInner.classList.remove("error-flash");
            if (elOuter) elOuter.classList.remove("error-flash");
            if (elLabel) elLabel.classList.remove("error-flash");
            if (elRow) elRow.classList.remove("error-flash");

            activeErrorPlayers.delete(player);
            if (activeErrorPlayers.size === 0) {
                errorBlockUntil = 0;
                if (queuedSnapshot) {
                    applySnapshot(queuedSnapshot);
                    queuedSnapshot = null;
                }
            }
        }, 4000);
    }

    function handleUpdate(data) {
        if (data.puzzle_id !== 2) return;

        const inErrorBlock = errorBlockUntil && Date.now() < errorBlockUntil;
        if (inErrorBlock) {
            if (data.players) queuedSnapshot = data.players;
            if (data.puzzle_solved && !redirected) {
                redirected = true;
                playSound(PUZZLE_COMPLETE_SOUND_URL); // NEW
                setTimeout(() => { window.location.href = `/puzzleSuperat/2`; }, 1000);
            }
            return;
        }

        // Wrong symbol: queue reset snapshot, flash, and return
        if (data.error_reset) {
            playSound(INCORRECT_SOUND_URL);
            if (data.players) queuedSnapshot = data.players;
            startErrorFlash(data.error_reset.player);
            return;
        }

        // Use player_update directly to trigger sounds and render
        if (data.player_update) {
            const p = data.player_update.player;
            const prog = data.player_update.progress;
            // Play correcte.wav on any valid progress update
            if (prog > 0 && prog < TOTAL) {
                playSound(CORRECT_SOUND_URL);
            }
            // Play fase_completada.wav when the bar reaches TOTAL
            if (prog === TOTAL) {
                playSound(PHASE_COMPLETE_SOUND_URL);
            }
            setProgress(p, prog);
        }

        if (data.players) applySnapshot(data.players);

        // Play alarm sound and start flashing alarm mode every second during the transition
        if (data.play_alarm_sound) {
            playSound(data.play_alarm_sound.url);
            startAlarmFlash(5000); // flash for 5s while sound plays
        }

        // Play normal sound; stop flashing (final state comes via alarm_mode)
        if (data.play_normal_sound) {
            playSound(data.play_normal_sound.url);
            stopAlarmFlash(); // stop any previous flash
        }

        // Honor explicit alarm_mode state (stop any flashing and set final state)
        if (data.alarm_mode !== undefined) {
            stopAlarmFlash();
            setAlarmMode(!!data.alarm_mode);
        }

        if (data.puzzle_solved && !redirected) {
            updateHudState();
            redirected = true;
            playSound(PUZZLE_COMPLETE_SOUND_URL); // NEW
            console.log("Puzzle 2 solved! Redirecting...");
            setTimeout(() => { window.location.href = `/puzzleSuperat/2`; }, 1000);
        }
    }

    function installDebugHelpers() {
        window.puzzle2Debug = {
            push(payload) {
                handleUpdate({ puzzle_id: 2, ...payload });
            },
            reset() {
                const players = Array.from({ length: 10 }, (_, index) => ({
                    player: index + 1,
                    progress: 0
                }));
                handleUpdate({ puzzle_id: 2, players });
            },
            progress(player = 1, progress = 1) {
                handleUpdate({
                    puzzle_id: 2,
                    player_update: { player, progress }
                });
            },
            snapshot(progressList = []) {
                handleUpdate({
                    puzzle_id: 2,
                    players: progressList.map((progress, index) => ({
                        player: index + 1,
                        progress
                    }))
                });
            },
            error(player = 1, progressList = null) {
                handleUpdate({
                    puzzle_id: 2,
                    error_reset: { player },
                    players: progressList
                        ? progressList.map((progress, index) => ({
                            player: index + 1,
                            progress
                        }))
                        : undefined
                });
            },
            alarm(on = true) {
                handleUpdate({
                    puzzle_id: 2,
                    alarm_mode: on
                });
            },
            solved() {
                const previousRedirected = redirected;
                redirected = false;
                handleUpdate({
                    puzzle_id: 2,
                    puzzle_solved: true
                });
                redirected = previousRedirected;
            },
            demoProgress() {
                this.reset();
                const steps = [
                    [1, 1], [2, 2], [3, 1], [4, 3], [5, 2],
                    [6, 4], [7, 3], [8, 5], [9, 4], [10, 5]
                ];
                steps.forEach(([player, progress], index) => {
                    setTimeout(() => this.progress(player, progress), index * 450);
                });
            },
            demoError() {
                this.snapshot([2, 3, 1, 4, 2, 0, 3, 1, 2, 4]);
                setTimeout(() => this.error(4, [2, 3, 1, 0, 2, 0, 3, 1, 2, 4]), 300);
            },
            demoSolved() {
                this.snapshot([5, 5, 5, 5, 5, 5, 5, 5, 5, 5]);
                setTimeout(() => this.solved(), 800);
            }
        };
    }

    function loadCurrentState() {
        fetch("/current_state")
            .then(response => response.json())
            .then(data => {
                if (!data || data.puzzle_id !== 2) return;
                if (data.players) applySnapshot(data.players);
                if (data.alarm_mode !== undefined) {
                    stopAlarmFlash();
                    setAlarmMode(!!data.alarm_mode);
                }
            })
            .catch(err => console.warn("Failed to load current state for puzzle 2:", err));
    }

    function initSSE() {
        
        for (let player = 1; player <= PLAYER_COUNT; player++) {
            setProgress(player, 0);
        }
        updateHudState();

        loadCurrentState();

        const es = new EventSource("/state_stream");
        es.onopen = () => {
            fetch("/start_puzzle/2", { method: "POST" })
                .catch(err => console.warn("Failed to start puzzle 2:", err));
        };
        es.onmessage = (evt) => {
            try {
                const data = JSON.parse(evt.data);
                handleUpdate(data);
            } catch (e) {
                console.warn("Bad SSE data", e);
            }
        };
        es.onerror = () => {
            es.close();
            setTimeout(initSSE, 5000);
        };
    }

    function resetSecuredListStyles(securedList, securedRoutes) {
        securedList.style.position = '';
        securedList.style.top = '';
        securedList.style.height = '';
        securedList.style.left = '';
        securedList.style.right = '';
        securedList.style.zIndex = '';
        securedList.style.display = '';
        securedList.style.margin = '';

        securedRoutes.forEach(route => {
            route.style.position = '';
            route.style.top = '';
            route.style.height = '';
            route.style.left = '';
            route.style.right = '';
            route.style.transform = '';
            route.style.display = '';
            route.style.alignItems = '';
            route.style.justifyContent = '';
            route.style.zIndex = '';
        });
    }

    function syncSecuredList() {
        const securedArea = document.getElementById('p2-secured-area');
        const securedList = document.getElementById('p2-secured-list');
        const playersList = document.getElementById('players');
        const playerRows = document.querySelectorAll('#players .player-row');
        const securedRoutes = document.querySelectorAll('#p2-secured-list .secured-route');
        if (!securedArea || !securedList || !playersList || !playerRows.length || !securedRoutes.length) return;

        // Keep mobile using CSS layout to avoid overly tall side panels.
        if (window.matchMedia('(max-width: 640px)').matches) {
            resetSecuredListStyles(securedList, securedRoutes);
            return;
        }

        resetSecuredListStyles(securedList, securedRoutes);

        const areaRect = securedArea.getBoundingClientRect();
        const playersRect = playersList.getBoundingClientRect();

        if (!areaRect.height || !playersRect.height) return;

        securedList.style.position = 'absolute';
        securedList.style.left = '0';
        securedList.style.right = '0';
        securedList.style.top = `${Math.max(0, playersRect.top - areaRect.top)}px`;
        securedList.style.height = `${playersRect.height}px`;
        securedList.style.display = 'block';
        securedList.style.margin = '0';
        securedList.style.zIndex = '1';

        const listRect = securedList.getBoundingClientRect();
        if (!listRect.height) return;

        securedRoutes.forEach((route) => {
            const player = Number(route.dataset.player);
            const row = document.querySelector(`#players .player-row[data-player="${player}"]`);
            if (!row) return;

            const rowRect = row.getBoundingClientRect();
            const centerY = rowRect.top + (rowRect.height / 2);
            const yPercent = ((centerY - listRect.top) / listRect.height) * 100;

            route.style.position = 'absolute';
            route.style.left = '50%';
            route.style.top = `${Math.max(0, Math.min(100, yPercent))}%`;
            route.style.transform = 'translate(-50%, -50%)';
            route.style.display = 'flex';
            route.style.alignItems = 'center';
            route.style.justifyContent = 'center';
            route.style.zIndex = '1';
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        installDebugHelpers();
        initSSE();
        requestAnimationFrame(() => requestAnimationFrame(syncSecuredList));
        window.addEventListener('load', () => requestAnimationFrame(syncSecuredList));
        window.addEventListener('resize', syncSecuredList);
        if (window.ResizeObserver) {
            const ro = new ResizeObserver(() => requestAnimationFrame(syncSecuredList));
            const pa = document.getElementById('progress-area');
            if (pa) ro.observe(pa);
        }
    });
})();
