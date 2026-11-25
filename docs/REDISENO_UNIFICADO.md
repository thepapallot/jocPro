# Rediseño unificado de La Piràmide

Implementado en el frontend el 25 noviembre 2026, tras la aprobación del usuario
para extender el estilo de las letras 3D a los recursos, pantallas y pirámide.
La fuente editorial sigue siendo [la guía de marca](MARCA_DISENO_ESTILO.md).

## Resultado

- Presentaciones: composición de tarjetas aprobada tras la revisión. Objetivo
  superior, una imagen e instrucción por acción y puntuación inferior. Memoria
  conserva un único ejemplo de alfa sobre pedestal. Cada tarjeta aparece completa, de izquierda a derecha y bajo control del GM;
  Atención llega después. Las posiciones se mantienen al avanzar y retroceder.
- Tableros: grafito satinado, biseles contenidos, jerarquía tipográfica común y
  datos legibles. Cada puzzle conserva su distribución funcional y sus estados.
- Rajdhani Bold, Inter e IBM Plex Mono, locales, en presentación, juego y cierre.
- Nuevos token, terminal y botonera refinados; moneda y marco de espera de la
  misma familia. Se mantienen los colores y la distribución de los botones.
- 60 letras PNG en Memoria y diez patrones SVG con bisel interior en Serpientes.
  Presentaciones, tableros y simulador del GM apuntan a los mismos recursos.
- Pirámide con caras satinadas, bisel fino y canto lateral. Sus 42 bloques,
  identificadores, geometría y correspondencia con el progreso no cambian.

La capa común está en `static/css/architecture-system.css`, después del piloto.
Las presentaciones cargan después `static/css/presentation-cards.css`, aislada de
los tableros. `presentation-briefing.js` compone las tarjetas desde las mismas
instrucciones que las notas del GM en castellano y catalán; el inglés mantiene
su texto previo y sus aclaraciones. El flujo usa un paso por tarjeta, con
recuentos propios de cada idioma y notas del GM correspondientes.
El SVG maestro y su representación embebida en `pyramid-logo.js` están alineados.
Los PNG finales están en sus rutas reales, no requieren generación al ejecutar.
[Inventario y procedencia](../static/images/redesign-v2/README.md).

No se han cambiado las reglas, puntuaciones, tiempos, textos de instrucciones,
orden de pistas, hardware ni backend. Los originales se conservan porque las
galerías comparativas todavía los utilizan. Los iconos de la reserva no se han
recuperado. La interfaz del GM mantiene su disposición; solo se sincronizan
las representaciones de recursos del juego.

## Verificación

Revisión posterior del tablero de Memoria: `memory-cards.css`, cargado solo
por su plantilla mediante el bloque `surface_css`, separa cabecera, instrucción
y diez tarjetas. El resultado de los reintentos usa dos tarjetas. No modifica
`puzzle8.js`, traducciones, tiempos ni reglas. La vista local
[`memory-punts.html`](../static/previews/memory-punts.html) abre sin servidor,
con datos ilustrativos y controles fuera del tablero.
Evidencias de esta revisión: `output/memory-tarjetas/`, con 36 combinaciones de
fase/idioma/resolución y 30 estados del visor local. Se comprueban reloj visible,
reconexión, respuestas conservadas, resultados y movimiento reducido.

Todo mediante **simulación aislada**, con las plantillas y JS reales y eventos
SSE simulados. El fixture no importa el arranque de la aplicación ni conecta a
MQTT o hardware. No se ha desplegado. Pendiente comprobar proyección y lectura
en sala real.

Comandos desde la raíz, con `python3 tests/victory_runtime_fixture.py` activo:

| Comprobación | Comando | Resultado |
| --- | --- | --- |
| Nueve presentaciones y tableros; es/ca/eng, 1080p/720p | `node tests/architecture_system_browser.cjs` | 366 comprobaciones, incluidos retornos a herramientas y acciones; sin desbordamientos detectados, imágenes ausentes ni errores JS |
| Memoria: fases y respuestas conservadas en reintentos | `node tests/puzzle8_confirmed_browser.cjs` | 36 combinaciones verificadas |
| Bienvenida y composición de Memoria | `node tests/architecture_pilot_browser.cjs` | 43 comprobaciones |
| Ajuste de textos de QUIZ | `node tests/puzzle3_text_fit_browser.cjs` | 309 preguntas del banco comprobadas; ajuste correcto en resoluciones y DPR probados |
| Reglas de puntuación y resultado real | `node tests/scoring_explanation_browser.cjs` | Explicaciones, puntos ganados y total final verificados en tres idiomas y ambas resoluciones |
| Pruebas unitarias existentes | `node --test tests/*.test.cjs` | 18 de 19 archivos pasan; un fallo previo descrito abajo |

El test de QUIZ se ha ajustado para abrir el fixture con sesión explícita. Las
expectativas de recursos en tests de presentación y puntuación usan las nuevas
rutas. El test de Memoria comprueba imágenes decodificadas y su color semántico.

El fallo previo está en `tests/game_language.test.cjs`: busca mediante una
expresión regular la antigua función `openNativePlayer`, ausente del lanzador
actual. Se reprodujo idéntico sobre la copia del frontend anterior a esta tarea;
no corresponde al rediseño. No se ha modificado el lanzador para resolverlo.

Evidencias locales (instantáneas, no fuente de diseño):

- `output/arquitectura-unificada/index.html`: galería de capturas reales.
- `output/arquitectura-unificada/report.json`: cobertura y resultados.
- `output/arquitectura-unificada/geometry-verification.json`: 42 bloques sin
  cambios y geometría de las nueve casillas de cada patrón.
- `output/arquitectura-unificada/puntuacion/`: capturas e informe de puntuación.
- `output/quiz-texto/verification.json`: comprobaciones de texto del QUIZ.
- `output/arquitectura-pilot/`: bienvenida, Memoria y movimiento reducido.

## Revisión de las tarjetas aprobadas

Visor local, sin servidor ni partida:
[`static/previews/presentaciones-tarjetas.html`](../static/previews/presentaciones-tarjetas.html).
Permite escoger las nueve pruebas, idioma y revelado. Usa el mismo renderizador,
CSS e imágenes del juego; solo resuelve las rutas de imágenes para abrir por
`file://`. No carga el reproductor, envía eventos de juego ni inicia sesiones.

Comprobado con 216 estados (nueve pruebas, tres idiomas, cuatro posiciones y dos
resoluciones), todos los recursos cargados. En práctica y Carga Final, Atención
permanece deshabilitada porque no forma parte de su explicación. Se ha revisado
además el encuadre completo de la botonera con el indicador de tres segundos.

Evidencias actuales: `output/presentaciones-tarjetas/`, con galería, informe de
366 comprobaciones del frontend real, puntuación y visor local. La carpeta
`output/arquitectura-unificada/` conserva las capturas de la composición anterior.

Tests actualizados: expectativas de tarjetas y pedestal único en
`presentation_flow.test.cjs`; selectores de objetivo y puntuación en las pruebas
de navegador; comprobación de posiciones fijas, textos del GM, capas visibles y
bloqueo del contenido bajo Atención. Flujo (18) y puntuación (8) pasan.

## Avance de una tarjeta por paso

Aplicado el 25 noviembre 2026 a las nueve explicaciones, a los tres bloques de
funcionamiento general y a las dos tarjetas de puntos. Imagen y texto aparecen
juntos; las tarjetas anteriores permanecen y las futuras no se ven. Atención
se conserva al final. No hay avance automático entre tarjetas.

`presentation-flow.js` reúne textos, etiquetas, notas y pasos por idioma;
`presentation-pilot.js` mantiene los nodos y sincroniza navegación, idioma e
inicio con el GM. `presentation-briefing.js` revela cada tarjeta completa y
retira las ocultas de la navegación accesible. El visor local comparte ese
contenido y añade Anterior/Siguiente y flechas del teclado.

Verificación con las plantillas reales y eventos simulados, sin MQTT ni hardware:
`output/tarjetas-secuenciales/`. Se revisan las tres lenguas a 1080p y 720p,
posiciones estables, imágenes disponibles, retorno, repetición, cambio de idioma,
movimiento reducido, Atención y bloqueo del inicio antes del último paso.
Los informes anteriores corresponden al montaje que existía al generarlos.

Resultado: 466 comprobaciones de presentaciones y tableros, 56 de estados y
mensajes del GM y 304 estados del visor local, sin errores de ejecución ni
imágenes ausentes. Pasan también las 18 pruebas de flujo y las 8 de puntuación.
Pendiente validar la lectura y el ritmo de explicación con el grupo en sala.
