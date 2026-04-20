document.addEventListener('DOMContentLoaded', function() {
    const stage = document.getElementById('welcome-stage');
    const redirectFlag = window.REDIRECT_FLAG;
    const idxStr = window.IDX_STR;
    const puzzleIdx = idxStr ? parseInt(idxStr, 10) : null;

    const overlayImg = document.getElementById('overlay');
    const overlayAudio = document.getElementById('overlay-audio');

    function updateStageScale() {
        if (!stage) return;
        const scale = Math.min(
            window.innerWidth / 1920,
            window.innerHeight / 1080
        );
        stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
    }

    function onAdvance() {
        if (redirectFlag === 'indexFinal') {
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = `/videoJocFinal`;
            document.body.appendChild(form);
            form.submit();
        } else if (redirectFlag && redirectFlag.startsWith('puzzle') && puzzleIdx !== null) {
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = `/videoPuzzles/${puzzleIdx}`;
            document.body.appendChild(form);
            form.submit();
        } else {
            if (!onAdvance._done) {
                onAdvance._done = true;
                try {
                    overlayAudio.currentTime = 0;
                    overlayAudio.loop = true;
                    overlayAudio.play();
                } catch {}
                overlayImg.style.display = 'block';
                return;
            }
            try {
                overlayAudio.pause();
                overlayAudio.currentTime = 0;
                overlayAudio.loop = false;
            } catch {}
            window.location.replace(window.PLAY_VIDEO_INTRO_URL);
        }
    }
    onAdvance._done = false;

    document.body.addEventListener('click', onAdvance);
    document.addEventListener('keydown', (e) => { if (e.key === ' ') onAdvance(); });

    window.addEventListener('resize', updateStageScale, { passive: true });
    updateStageScale();
});
