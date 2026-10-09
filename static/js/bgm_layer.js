(function () {
    const MODE_VOLUMES = {
        mute: 0,
        low: 0.1,
        medium: 0.12,
    };

    function getRequestedMode() {
        const requested = (window.BGM_CONTEXT && window.BGM_CONTEXT.mode) || "medium";
        return MODE_VOLUMES.hasOwnProperty(requested) ? requested : "medium";
    }

    if (window.self !== window.top) {
        try {
            window.top.postMessage({
                type: "piramide_bgm_mode",
                mode: getRequestedMode(),
            }, location.origin);
        } catch (error) {
            // Ignore cross-frame communication errors.
        }
        // A gesture inside an iframe does not bubble to the persistent player.
        ['click','touchstart','keydown'].forEach(name=>document.addEventListener(name,()=>{
            window.top.postMessage({type:'piramide_bgm_unlock'},location.origin);
        },{once:true,passive:true}));
        return;
    }

    const TRACK_SRC = "/static/audios/musica_ambient/musica_piramide.mp3";
    const STORAGE_KEY = "piramide_bgm_state_v1";
    const POSITION_SAVE_INTERVAL_MS = 1200;

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function readState() {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object") return null;
            return parsed;
        } catch (error) {
            return null;
        }
    }

    function writeState(audio) {
        if (!audio || !Number.isFinite(audio.currentTime)) return;

        const payload = {
            ts: Date.now(),
            pos: audio.currentTime,
            src: TRACK_SRC,
            wasPlaying: !audio.paused,
        };

        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch (error) {
            // Ignore storage failures (kiosk/private mode).
        }
    }

    function computeResumePosition(audio, state) {
        if (!state || state.src !== TRACK_SRC) {
            return 0;
        }

        const basePos = Number(state.pos) || 0;
        const baseTs = Number(state.ts) || 0;
        const wasPlaying = Boolean(state.wasPlaying);

        if (!wasPlaying || !Number.isFinite(basePos) || !Number.isFinite(baseTs)) {
            return Math.max(0, basePos);
        }

        const elapsedSec = Math.max(0, (Date.now() - baseTs) / 1000);
        const duration = Number(audio.duration);
        if (Number.isFinite(duration) && duration > 0) {
            return (basePos + elapsedSec) % duration;
        }

        return Math.max(0, basePos + elapsedSec);
    }

    let volumeFrame=null;
    // The finale owns a different score. Shell loads and unlock gestures must
    // not restart the normal soundtrack while that score is in use.
    let suspended=false;
    const play=audio=>suspended?Promise.resolve():audio.play();
    function applyVolume(audio, mode, fadeMs) {
        const target = MODE_VOLUMES[mode];
        if (target === undefined) return;
        applyLevel(audio,target,fadeMs);
    }
    function applyLevel(audio,target,fadeMs){
        if(volumeFrame!==null)cancelAnimationFrame(volumeFrame);
        volumeFrame=null;
        target=clamp(target,0,1);

        const now = audio.volume;
        if (!Number.isFinite(now) || fadeMs <= 0) {
            audio.volume = target;
            return;
        }

        const start = performance.now();
        const from = clamp(now, 0, 1);
        const delta = target - from;

        function step(nowTs) {
            const progress = clamp((nowTs - start) / fadeMs, 0, 1);
            audio.volume = from + (delta * progress);
            if (progress < 1) {
                volumeFrame=requestAnimationFrame(step);
            }
        }

        volumeFrame=requestAnimationFrame(step);
    }

    function installUnlockHandlers(audio) {
        const unlock = () => {
            play(audio).catch(() => {});
        };

        ["click", "touchstart", "keydown"].forEach((eventName) => {
            document.addEventListener(eventName, unlock, { once: true, passive: true });
        });
    }

    function boot() {
        const audio = new Audio();
        audio.src = TRACK_SRC;
        audio.loop = true;
        audio.preload = "auto";
        audio.autoplay = true;
        audio.setAttribute("playsinline", "");

        const mode = getRequestedMode();
        let desiredVolume=MODE_VOLUMES[mode];
        applyVolume(audio, mode, 0);

        const state = readState();
        audio.addEventListener("loadedmetadata", () => {
            const resumePos = computeResumePosition(audio, state);
            if (resumePos > 0) {
                audio.currentTime = resumePos;
            }
            applyLevel(audio, desiredVolume, 420);
        }, { once: true });

        play(audio).catch(() => {
            installUnlockHandlers(audio);
        });

        const saveTimer = window.setInterval(() => writeState(audio), POSITION_SAVE_INTERVAL_MS);

        window.addEventListener("beforeunload", () => {
            writeState(audio);
            window.clearInterval(saveTimer);
        });

        window.addEventListener("message", (event) => {
            const frame=document.getElementById('game-shell-frame');
            if(event.origin!==location.origin||(frame&&event.source!==frame.contentWindow))return;
            const data = event && event.data;
            if(data?.type==='piramide_bgm_unlock'){play(audio).catch(()=>{});return;}
            if (!data || data.type !== "piramide_bgm_mode") {
                return;
            }

            const nextMode = MODE_VOLUMES.hasOwnProperty(data.mode) ? data.mode : "medium";
            desiredVolume=MODE_VOLUMES[nextMode];
            applyVolume(audio, nextMode, 360);
        });

        window.BGM = {
            play(){return play(audio);},
            pause(){audio.pause();},
            suspend(){suspended=true;audio.pause();},
            resume(){suspended=false;return play(audio);},
            setVolume(level,fadeMs=0){if(Number.isFinite(level)){desiredVolume=clamp(level,0,1);applyLevel(audio,desiredVolume,Math.max(0,fadeMs));}},
            setMode(nextMode, fadeMs) {
                const safeMode = MODE_VOLUMES.hasOwnProperty(nextMode) ? nextMode : "medium";
                desiredVolume=MODE_VOLUMES[safeMode];
                applyVolume(audio, safeMode, Number(fadeMs) > 0 ? Number(fadeMs) : 360);
            },
            persist() {
                writeState(audio);
            },
        };
    }

    boot();
})();
