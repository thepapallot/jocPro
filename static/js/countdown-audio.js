/* The visible timer owns the clock: never queue or schedule beeps separately. */
(() => {
    const audio = new Audio('/static/audios/effects/beep_countdown.wav');
    audio.preload = 'auto';
    const previous = new Map();
    let owner = null;

    function reset(key) {
        previous.delete(key);
        if (owner === key) {
            audio.pause();
            owner = null;
        }
    }

    window.PyramidCountdownAudio = {
        reset,
        tick(key, value, options = {}) {
            const seconds = Number(value);
            if (!Number.isFinite(seconds) || seconds <= 0) {
                reset(key);
                return;
            }
            if (previous.get(key) === seconds) return;
            previous.set(key, seconds);
            // Reuse the preloaded clip; its reverb must not overlap the next tick.
            audio.pause();
            audio.currentTime = 0;
            audio.volume = options.volume ?? 0.5;
            audio.playbackRate = options.playbackRate ?? 1;
            owner = key;
            audio.play().catch(() => {
                // A blocked tick is discarded, never replayed after its number.
            });
        }
    };
    window.addEventListener('pagehide', () => {
        audio.pause();
        previous.clear();
        owner = null;
    });
})();
