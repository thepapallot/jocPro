# Scene Player

Base reutilizable para las intros de `La Pirámide`.

La arquitectura separa cuatro capas:

- `audio`: locución maestra de la escena
- `character`: clips reutilizables del personaje
- `fullscreen_ui`: UI a pantalla completa hecha con código
- `transition`: bloques visuales intermedios

La regla principal es simple:

- la escena dura exactamente lo mismo que el audio
- el audio marca el tiempo global
- los clips del personaje y la UI se intercalan sobre esa línea temporal

## Ejecución

Desde la raíz del proyecto:

```bash
python3 app.py
```

Abrir:

```text
http://127.0.0.1:5000/player/?scene=scene_intro_sumas
```

El player intenta arrancar automáticamente si el navegador permite autoplay.

## Controles

- `Espacio`: play/pause
- `R`: reiniciar escena
- `Flecha derecha`: saltar al siguiente segmento

## Estructura

- `player/index.html`: shell del reproductor
- `player/main.js`: motor de timeline, audio, acumulación de UI, subtítulos y SFX
- `player/styles.css`: sistema visual fullscreen
- `player/CHARACTER_CLIPS.md`: clasificación narrativa de los clips del personaje
- `scenes/scene_intro_sumas/config.json`: prueba real del puzzle 1
- `scenes/templates/intro/puzzle_intro_template.json`: plantilla maestra para futuros puzzles

## Concepto de escena

Ejemplo mínimo:

```json
{
  "scene_id": "puzzle_intro",
  "ui_titles": {
    "top": "OBJETIVO",
    "left": "ELEMENTOS",
    "right": "ATENCIÓN"
  },
  "audio": {
    "src": "/static/audios/scene/intro_puzzle_01.wav"
  },
  "subtitles": [
    {
      "start": 0,
      "end": 3.5,
      "text": "Locución sincronizada."
    }
  ],
  "segments": [
    {
      "type": "character",
      "src": "/static/videos/characters/cero_neutral_intro_a.mp4",
      "clip_start": 0,
      "clip_end": 6
    },
    {
      "type": "fullscreen_ui",
      "duration": 8,
      "phases": [
        {
          "at": 0,
          "sfx": "objective",
          "top": {
            "text": "COMPLETAR EL RETO ANTES DE QUE SE AGOTE EL TIEMPO."
          }
        },
        {
          "at": 2.8,
          "left": {
            "assets": [
              {
                "src": "/static/images/shared/gameplay/token_card.png",
                "alt": "Token"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

## Tipos de segmento

### `character`

Usa un clip del banco del personaje.

- `src`: ruta del MP4
- `clip_start`: segundo inicial dentro del clip
- `clip_end`: segundo final dentro del clip
- `duration`: opcional si quieres desacoplar duración visible y corte exacto
- `label`: etiqueta interna opcional

### `fullscreen_ui`

Muestra la UI principal de la intro.

- `duration`: duración del bloque
- `top`: contenido del módulo superior
- `left`: contenido del módulo inferior izquierdo
- `right`: contenido del módulo inferior derecho
- `phases`: estados internos que se van acumulando sin reconstruir toda la pantalla
- `subtitle`: barra inferior opcional
- `sfx`: sonido opcional por segmento o por fase

Cada zona puede contener:

- `text`
- `steps`
- `assets`
- `variant`
- `title` opcional

Si no se indica `title`, el player usa automáticamente los títulos fijos definidos en `ui_titles`.

### `transition`

Bloque visual intermedio para futuras variantes o stings.

## Títulos fijos del sistema

La base de producción asume tres títulos recurrentes:

- `OBJETIVO`
- `ELEMENTOS`
- `ATENCIÓN`

Lo importante es el contenido interior. Por eso ahora esos títulos pueden heredarse desde `ui_titles` y no hace falta repetirlos en cada bloque del `config.json`.

## Acumulación de UI

La UI no se recarga entera al añadir contenido.

Comportamiento actual:

- si aparece un nuevo icono en `ELEMENTOS`, se añade sin rehacer el bloque
- si entra una nueva advertencia en `ATENCIÓN`, se suma a las anteriores
- si el contenido no cambia, no se vuelve a animar

Esto evita parpadeos y dobles entradas visuales.

## Subtítulos

Los subtítulos se definen a nivel de escena con tiempo absoluto:

- `start`
- `end`
- `text`

Van sincronizados con el audio maestro, no con cada segmento individual.

## SFX

El sistema ya soporta `sfx` por fase o por segmento.

Valores usados ahora:

- `objective`
- `token`
- `warning`
- `final`

Por ahora están sintetizados en navegador. Más adelante se pueden sustituir por archivos reales.

## Flujo recomendado

1. Preparar la locución final.
2. Ajustar el total de la escena a la duración exacta del audio.
3. Intercalar clips `character` con bloques `fullscreen_ui`.
4. Sincronizar `phases` con frases concretas del audio.
5. Mantener la información importante visible hasta el final cuando tenga sentido.

## Checklist por puzzle

Usa este proceso cada vez que adaptes una intro nueva:

1. Duplicar `scenes/templates/intro/puzzle_intro_template.json` a una escena nueva.
2. Definir el `scene_id` nuevo.
3. Poner el `audio.src` definitivo.
4. Escuchar la locución y dividirla en bloques con tiempos.
5. Escribir `subtitles` por frase o por bloque corto.
6. Redactar el `OBJETIVO` en una frase principal clara.
7. Añadir en `ELEMENTOS` los iconos reales del puzzle.
8. Añadir en `ATENCIÓN` las advertencias o condiciones de fallo.
9. Repartir segmentos `character` y `fullscreen_ui` para que la intro tenga ritmo.
10. Ajustar las `phases` para que cada elemento aparezca cuando el audio lo nombra.
11. Probar lectura, sincronía y balance visual.
12. Cuando la escena quede validada, usarla para sustituir la intro de vídeo antigua.

Reglas fijas de producción:

- el audio manda la duración total
- `OBJETIVO`, `ELEMENTOS` y `ATENCIÓN` son módulos fijos
- la UI acumula contenido, no se reinicia visualmente
- los iconos apoyan la explicación, pero la locución lleva el detalle
- los clips del personaje se usan para dar ritmo, no como vídeo continuo largo

## Clips del personaje

El banco de clips está en:

- `static/videos/characters/`

La guía de uso está en:

- `player/CHARACTER_CLIPS.md`

Úsalo para decidir qué clip sirve mejor como:

- apertura
- explicación
- cambio de bloque
- aviso
- cierre

## Estado actual

- `scene_intro_sumas` ya funciona como prueba real del puzzle 1
- usa audio independiente
- usa iconos reales del juego
- usa subtítulos sincronizados
- usa acumulación progresiva de `OBJETIVO`, `ELEMENTOS` y `ATENCIÓN`
- sirve como base para crear las siguientes intros de puzzle
