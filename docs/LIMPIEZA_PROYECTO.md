# Limpieza del proyecto

## 9 octubre 2026 · Recursos históricos reincorporados

El cambio `38392ae` pasó de ignorar toda `static/images/` a ignorar únicamente
`static/images/no_usadas/`. El commit `e2b164a`, integrado por el PR #148,
añadió después 151 archivos históricos que seguían fuera de esa reserva.
Los diez símbolos nuevos de Serpientes pertenecen a otro cambio (`136e5ec`)
y se conservan en sus rutas activas.

Limpieza aplicada a esos 151 archivos (211.214.636 bytes):

- 85 trasladados a `static/images/no_usadas/`, conservando su ruta relativa.
- 66 copias idénticas retiradas del árbol activo, conservando la copia ya
  existente en la reserva. Se liberan 161.597.349 bytes de duplicados locales.
- Sin conflictos de nombre ni sobrescritura de variantes diferentes.
- Los 32 recursos activos conservan sus rutas y sus bytes, incluidos los
  símbolos de Serpientes y Memory, `wait.png`, las capturas del visor, los
  objetos de juego, el panel de botones y el logo actual ADN Games.

Se revisaron referencias por ruta y nombre en código y herramientas vigentes,
las rutas construidas de símbolos y del visor y el patrón dibujado de Botones
(no carga los GIF históricos). Los 151 archivos quedan conservados en la
reserva local con hashes SHA-256 verificados; todos sus destinos están cubiertos
por la regla existente de `.gitignore`. No se modificaron audios ni backend.

La lista `docs/retired_image_assets.json` permite detectar su reaparición.
`scripts/audit_image_assets.py --check` señala esos archivos, cualquier archivo
dentro de `old_pics/` y las referencias literales a imágenes ausentes. La reserva
local no es necesaria para ejecutar el control. El workflow de GitHub Actions
queda preparado para ejecutarlo en los siguientes pushes y pull requests.
La reutilización deliberada de un recurso autorizado requiere actualizar sus
referencias y retirar su ruta de la lista, como explica `scripts/README.md`.

Validación local: el control detectó los 151 recursos antes de moverlos y pasó
después, con 32 imágenes activas, cero referencias literales ausentes y cero
recursos retirados reincorporados. Esta limpieza no cambia ninguna pantalla.
Los archivos siguen disponibles en el historial de Git; no se reescribió el historial.

## 5 octubre 2026 · Primera fase

Retirado el sistema antiguo de presentaciones, tras revisar las referencias en
las rutas Flask, templates, JavaScript, CSS, backend de puzzles y pruebas:

- `scenes/`: catálogos, plantillas, escenas y subtítulos antiguos.
- `scripts/generate_intro_scene.py`.
- `static/videos/characters/`, `ExplicacionsJocs/`, `JocsSuperats/`,
  `old_videos/` y `Video_inicial.mp4`.
- `static/audios/scene/`, `audiosTitols/` e `inicial/`.
- `player/CHARACTER_CLIPS.md` y `docs/media_guide.md`.

157 archivos, 1.454.268.155 bytes retirados del árbol del proyecto.
Antes de eliminarlos se creó y comprobó una copia temporal en
`/tmp/piramide-limpieza-20261005-fase1.tar`. No es un archivo permanente.
Los recursos multimedia están ignorados en Git; la copia incluye también esos
recursos y las modificaciones locales de escenas y generador.

Se actualizaron las instrucciones de mantenimiento y el README del reproductor.
No se modificaron el backend, el orden ni las mecánicas del juego.
Las antiguas URL siguen redirigiendo al recorrido HTML vigente.

Validación: cinco pruebas de rutas Flask con MQTT simulado y cuatro archivos
de pruebas JavaScript (recorrido, ventana de jugadores y controles del GM),
todos correctos. Sin referencias a los multimedia retirados en el código
de ejecución. No se inició el servidor conectado al hardware.

## 5 octubre 2026 · Segunda fase

Retirados 100 archivos adicionales sin referencias en el código y herramientas
vigentes, incluidos los bancos antiguos de preguntas:

- `static/images/old_pics/`, los dos mapas fijos de Laberinto y
  `static/images/puzzle3/intro/question_board.jpg`.
- La copia idéntica de `piramide-vector.svg` en `shared/branding/`;
  se mantiene el maestro de `static/branding/`.
- Las alternativas musicales `P4_AllStar/`, `P4_BohemianRapsody/` y
  `P4_UptownFunk/`.
- Los efectos sin uso `alarma.mp3`, `backToNormal.mp3` y `lletres.wav`.
- Las fuentes sin uso Abang, Computer, Cristik y Orbitron variable.
- `data/puzzle3Old/` y `.DS_Store`.

12.499.443 bytes retirados, con copia temporal comprobada en
`/tmp/piramide-limpieza-20261005-fase2.tar`.
También se eliminó la caché regenerable `.cache/whisper/` (220.834.890 bytes)
y quince carpetas vacías de `static/images/`.

Se preservan las seis fuentes Orbitron aún referenciadas, el logo PNG aún
utilizado, los ocho iconos autorizados y los recursos funcionales de los puzzles.
Esta fase no cambia pantallas ni mecánicas.

## 5 octubre 2026 · Tercera fase

- Sustituidas las referencias al logo PNG en Test, Sumas, Práctica y el visor
  de Sumas por el SVG maestro.
- Eliminadas las declaraciones de Orbitron y sustituido su uso por Arial en
  el CSS base, los puzzles y el visor de Sumas. Los titulares compartidos
  siguen utilizando PiramideDisplay.
- Retirados el PNG antiguo y las seis fuentes Orbitron de `static/`.
- Conservadas copias en `output/legacy-assets/` y ajustadas las rutas de las
  maquetas históricas para que mantengan su apariencia anterior.

Validación: doce puzzles en Chrome a 1920×1080 y 1280×720, sin errores
de JavaScript ni desbordamientos exteriores; revisión visual de Trivial.
Pruebas de rutas y controles correctas. Verificación con servidor simulado.

Copia previa de recursos y archivos editados:
`/tmp/piramide-limpieza-20261005-fase3.tar`.

## Próximas fases

- Decidir qué vídeos de `static/videos/recursos_varios/` reservar para producción.
- Retirar `openai-whisper` de los requisitos al revisar el entorno Python.

Mantener los audios funcionales de Música, los efectos utilizados, la música
ambiental, los símbolos de Laberinto y Memory y los GIF de Botones.
Los puzzles 7, 9 y 10 requieren revisar su importación en el backend antes
de retirar sus archivos.

## 5 octubre 2026 · Cuarta fase

Retirados `presentation-sumas.js`, `player/presentation-preview-game.html` y
`output/pilot-sumes/`. Datos y recursos de Sumas integrados en `presentation-flow.js`.
El ensayo de Sumas usa ahora el mismo esquema vigente que los demás puzzles.
Copia temporal: `/tmp/piramide-limpieza-20261005-fase4.tar`.

## 5 octubre 2026 · Quinta fase

Retirados 171 archivos (94.037.147 bytes): propuestas descartadas, capturas
regenerables y versiones v1/v1.1 de los documentos de marca. Se conserva la
propuesta v4 con sus dependencias, carteles y documentos v1.2.
Se retiró el plan antiguo de migración de imágenes y se regeneraron ambos
informes de recursos: 98 imágenes y 14 vídeos, sin referencias literales faltantes.
Los informes no cubren por completo las rutas dinámicas ni todos los recursos
referenciados mediante Jinja o CSS relativo.

Añadidos `README.md` raíz y `output/README.md` para localizar implementación,
visores y materiales de diseño. Actualizadas las referencias a capturas retiradas.
Copia temporal comprobada: `/tmp/piramide-limpieza-20261005-fase5.tar`.
