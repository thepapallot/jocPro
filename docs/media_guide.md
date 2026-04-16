# Media Guide

Guía rápida para reutilizar el material actual sin volver a depender de nombres numéricos.

## Estructura

- Audio activo de la intro general: `static/audios/scene/intro_game_master_v2.wav`
- Audio antiguo archivado: `static/audios/scene/archive/intro_game_master_legacy.wav`
- Librería activa de Cero: `static/videos/characters/`
- Librería legacy archivada: `static/videos/characters/archive/legacy/`
- Recursos varios: `static/videos/recursos_varios/`

## Cero

### Recomendados

| Clip | Uso recomendado | Notas |
|---|---|---|
| `cero_briefing_long_a.mp4` | apertura, briefing | el más estable para bloques largos |
| `cero_intro_long_b.mp4` | apertura sobria | aguanta bien explicación larga |
| `cero_intro_neutral_b.mp4` | apertura corta | limpio y neutro |
| `cero_neutral_intro_a.mp4` | instrucción corta | funciona bien de arranque |
| `cero_explanation_long_a.mp4` | explicación larga | estable si no se fuerza loop |
| `cero_explanation_short_a.mp4` | explicación breve | buena pieza puente |
| `cero_warning_stable_a.mp4` | aviso | más firme sin ser brusco |
| `cero_warning_notice_a.mp4` | advertencia | algo más expresivo |
| `cero_neutral_close_a.mp4` | cierre | neutro y limpio |
| `cero_outro_close_a.mp4` | outro, despedida | útil para finales |

### Usar con cuidado

| Clip | Riesgo |
|---|---|
| `cero_briefing_short_tilt.mp4` | ligera inclinación de cabeza |
| `cero_briefing_short_alt.mp4` | cambia gesto si se alarga |
| `cero_emphasis_forward.mp4` | postura adelantada, más marcada |
| `cero_warning_gesture.mp4` | gesto de mano claro |
| `cero_gesture_medium_a.mp4` | movimiento visible de manos |
| `cero_warning_long_a.mp4` | remate expresivo, evitar loop |
| `cero_emphasis_long_a.mp4` | gesto central pronunciado |

### Reglas rápidas

- Aperturas: `cero_briefing_long_a.mp4`, `cero_intro_long_b.mp4`, `cero_intro_neutral_b.mp4`
- Explicación: `cero_explanation_long_a.mp4`, `cero_explanation_short_a.mp4`, `cero_intro_long_a.mp4`
- Aviso: `cero_warning_stable_a.mp4`, `cero_warning_notice_a.mp4`, `cero_warning_gesture.mp4`
- Cierre: `cero_outro_close_a.mp4`, `cero_neutral_close_a.mp4`, `cero_close_short_a.mp4`

## Game Master

### No mostrar antes de nombrar la pirámide

- `gm_pyramid_establishing_a.mp4`
- `gm_pyramid_legacy_a.mp4`
- `gm_pyramid_precision_a.mp4`
- `gm_pyramid_construction_a.mp4`
- `gm_pyramid_construction_b.mp4`
- `gm_pyramid_wide_a.mp4`
- `pyramid_bricks.mp4`
- `pyramid_outline.mp4`

### Seguros para la parte previa

| Clip | Uso recomendado |
|---|---|
| `city_wireframe.mp4` | obras colosales, escala, humanidad |
| `network_core.mp4` | ADN, datos, análisis |
| `gm_network_patterns.mp4` | patrones humanos, red |
| `gm_abstract_transition_a.mp4` | continuidad neutra |
| `gm_network_grid_a.mp4` | organización, análisis |
| `gm_selection_group_scan.mp4` | grupos excepcionales |

## Uso actual

### Escenas con Cero

| Escena | Clips |
|---|---|
| `scene_intro_game` | `cero_briefing_long_a.mp4`, `cero_briefing_short_alt.mp4` |
| `scene_intro_sumas` | `cero_neutral_close_a.mp4`, `cero_briefing_short_a.mp4`, `cero_intro_long_b.mp4` |
| `scene_intro_laberinto` | `cero_intro_neutral_b.mp4`, `cero_briefing_long_a.mp4` |
| `scene_intro_trivial` | `cero_briefing_short_a.mp4`, `cero_neutral_close_a.mp4` |
| `scene_intro_musica` | `cero_warning_stable_a.mp4`, `cero_explanation_long_a.mp4`, `cero_bridge_neutral_a.mp4` |
| `scene_intro_cronometro` | `cero_neutral_intro_a.mp4`, `cero_explanation_short_a.mp4`, `cero_warning_notice_a.mp4`, `cero_outro_close_a.mp4` |
| `scene_intro_energia` | `cero_intro_long_b.mp4`, `cero_emphasis_long_a.mp4`, `cero_close_short_a.mp4` |
| `scene_intro_segments` | `cero_intro_long_a.mp4`, `cero_warning_stable_a.mp4` |
| `scene_intro_memory` | `cero_intro_neutral_b.mp4`, `cero_warning_long_a.mp4` |
| `scene_intro_token_a_lloc` | `cero_neutral_intro_a.mp4`, `cero_warning_notice_a.mp4` |
| `scene_video_final` | `cero_explanation_short_a.mp4` |
| `scene_outro_game` | `cero_outro_close_a.mp4` |

### Escenas con Game Master

| Escena | Recursos |
|---|---|
| `scene_intro_game` | `city_wireframe.mp4`, `gm_abstract_transition_a.mp4`, `gm_network_grid_a.mp4`, `gm_pyramid_wide_a.mp4`, `gm_selection_group_scan.mp4` |
| `scene_outro_game` | `pyramid_bricks.mp4`, `pyramid_outline.mp4` |

## Mantenimiento

- Si entra un clip nuevo, actualizar también `scenes/media_catalog.json`.
- Si un clip da freeze o loop visible, marcarlo como no seguro para loop.
- Si se retira un clip antiguo, moverlo a `archive/` antes de borrarlo.
