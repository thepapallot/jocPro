(function () {
    
    function handleUpdate(d) {
        if (!d || d.puzzle_id !== 11) return;

        
    }

    

    function initSSE() {
        const es = new EventSource('/state_stream');
        es.onmessage = evt => {
            try {
                handleUpdate(JSON.parse(evt.data));
            } catch {}
        };
        es.onopen = () => {
            fetch('/start_puzzle/11', { method: 'POST' })
                .catch(err => console.warn('Failed to start puzzle 11:', err));
        };
    }

    

    document.addEventListener('DOMContentLoaded', () => {
        initSSE();
    });
})();
