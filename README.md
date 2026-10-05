# La Piràmide

Juego cooperativo para 10–20 jugadores, diez terminales y una pantalla compartida.

## Dónde está cada parte

| Carpeta o archivo | Contenido |
| --- | --- |
| `templates/puzzle*.html` | Pantallas reales de los puzzles |
| `templates/presentation.html`, `_presentation_screen.html`, `welcome.html` | Presentaciones y bienvenida |
| `static/js/presentation-flow.js` | Recorrido, textos y datos de presentaciones |
| `static/js/presentation-briefing.js` | Esquemas progresivos de cada puzzle |
| `static/js/presentation-pilot.js` | Reproductor vigente de presentaciones; conserva el nombre técnico histórico |
| `templates/test.html`, `static/js/test.js`, `game-director.js`, `presentation-gm.js` | Sesiones y control del Game Master |
| `static/js/game-shell.js` | Ventana persistente de jugadores |
| `static/css/`, `static/js/puzzle*.js` | Diseño y comportamiento del frontend |
| `static/branding/`, `static/fonts/`, `static/images/`, `static/audios/` | Recursos visuales y sonidos |
| `app.py`, `config.py`, `mqtt/` | Rutas, orden y lógica del juego con hardware |
| `data/puzzle3/` | Preguntas de Trivial |
| `telemetry/`, `data/db/`, `scriptsDb/` | Sesiones, base de datos y telemetría |
| `tests/` | Pruebas y fixture sin hardware |
| `player/` | Visores de revisión y documentación del recorrido |
| `output/` | Propuesta visual y materiales de marca conservados |
| `docs/`, `scripts/` | Guías, registro de limpieza y auditorías de recursos |

## Entradas principales

- `/test`: sesiones y control del juego.
- `/`: ventana de jugadores, empezando por la bienvenida.
- `/presentacio/ID`: presentación de un puzzle.
- `/puzzle/ID`: pantalla del puzzle real.
- `/player/briefings.html`: revisión de los esquemas sin iniciar los terminales.
- `/player/presentation.html?flow=game&lang=es`: ensayo del recorrido.

Recorrido actual: práctica 11 → 2 → 3 → 8 → 1 → 5 → 12 → 4 → final 6.
El orden se configura en `config.py`.

## Antes de editar

Leer [AGENTS.md](AGENTS.md), la [guía de marca](docs/MARCA_DISENO_ESTILO.md)
y las [normas de colaboración](NORMAS_COLABORACION.md).
Para verificaciones aisladas, usar `tests/presentation_fixture.py`;
iniciar `app.py` conecta el juego con MQTT.

Los multimedia y la base de datos local están ignorados en Git. Un checkout
del repositorio puede necesitar esos recursos antes de jugar.

Los informes de `scripts/audit_*_assets.py` ayudan a localizar referencias
literales; no demuestran por sí solos que un recurso dinámico sea prescindible.

Consulta el [registro de limpieza](docs/LIMPIEZA_PROYECTO.md)
y la [documentación del reproductor](player/README.md).
