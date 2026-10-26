(function() {
    document.addEventListener('DOMContentLoaded', () => {
        const checkbox = document.getElementById('music-second-round');
        const status = document.getElementById('music-round-status');
        if (!checkbox || !status) return;
        const endpoint = '/test/puzzle4/round_options';
        let confirmed = false;
        let busy = false;

        async function sync(save = false) {
            if (busy) return;
            busy = true;
            checkbox.disabled = true;
            const requested = checkbox.checked;
            if (save) status.textContent = 'Guardando…';
            try {
                const response = await fetch(endpoint, save ? {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({second_round_enabled: requested})
                } : {cache: 'no-store'});
                if (!response.ok) throw new Error('round_options_failed');
                const data = await response.json();
                if (typeof data.second_round_enabled !== 'boolean') throw new Error('invalid_options');
                confirmed = data.second_round_enabled;
                checkbox.checked = confirmed;
                status.textContent = confirmed
                    ? 'Segunda ronda activada. Opción visible solo para el GM.'
                    : 'Segunda ronda desactivada. Opción visible solo para el GM.';
                checkbox.disabled = false;
            } catch (error) {
                checkbox.checked = confirmed;
                status.textContent = save
                    ? 'No se pudo confirmar el cambio. Actualiza el estado antes de volver a intentarlo.'
                    : 'No se pudo consultar la opción de música. Pulsa Actualizar estado para reintentar.';
                // A failed write can have reached the server: read again before editing.
            } finally {
                busy = false;
            }
        }

        checkbox.addEventListener('change', () => sync(true));
        document.getElementById('director-refresh')?.addEventListener('click', () => sync());
        window.addEventListener('focus', () => sync());
        sync();
    });
})();