# Backend Touches

Documento de seguimiento de cambios que afectan backend o logica de juego.

Objetivo:

- dejar trazabilidad clara de todo lo que se toque fuera del puro frontend
- facilitar la revision por la persona responsable de backend
- distinguir cambios visuales de cambios de comportamiento real

Convencion:

- `pendiente de revisar`: cambio hecho que conviene validar con backend
- `utilidad interna`: cambio de soporte, test o tooling
- `detectado`: comportamiento observado pero no modificado

## 2026-10-20 — Conexión Simultánea: puntuación y ayuda desde el quinto reinicio

Tipo: `pendiente de revisar`. Regla propuesta y confirmada explícitamente por
Olalla antes de modificar backend.

- `scoring_config.py`: añade `puzzle12`, máximo 100 puntos y penalización de
  10 por tiempo agotado. Reutiliza `calculate_points`; no hay límite de
  intentos ni finalización automática al llegar a cero.
- `mqtt/puzzles/puzzle12.py`: cuenta una vez cada timeout aceptado y publica
  `timeout_count`, `available_points` y `total_points` en el estado. Solo al
  resolver emite los puntos ganados junto con `puzzle_solved`, para que el
  callback existente cierre y puntúe la fila activa en SQLite. No cambian
  Flask, el cliente MQTT, el esquema ni las partidas históricas.
- `current_target` es la única fuente para mostrar, validar y recuperar el
  objetivo. En los cuatro primeros reinicios se mantiene el sorteo existente;
  desde el quinto se conserva la combinación actual y se resta una bola a
  cada color distinto del que tiene diez, con mínimo de una. Cada reinicio
  posterior repite la reducción: nunca aumenta la cantidad durante la ayuda.
  Se conservan siempre las diez bolas de un color y los 90 segundos activos.
- Reset limpia puntos, ayudas y estados de terminales. Stop/reset cancelan
  temporizadores; una generación invalida callbacks antiguos de confirmación
  o reinicio. Se rechazan terminales fuera de 1–10 y estados distintos de seis
  bits, para no simular la participación de diez terminales con datos inválidos.
  El reinicio conserva la espera de cinco segundos con un timer cancelable.
- `tests/test_puzzle12.py`, `tests/test_puzzle12_points.py` y
  `tests/test_scoring.py`: puntuación 100–0, continuación a cero, quinto reinicio,
  reducción hasta 15 bolas, objetivo visible igual al validado, callbacks
  invalidados y persistencia real con SQLite temporal.
- `tests/test_puzzle12_feedback.py`: completa el mock de audio (`pause` y
  registro al reproducir, no al precargar) y adapta las comprobaciones al tick
  del reloj y al flujo timeout-reinicio. Verifica objetivos de 34, 29 y 15 bolas
  y sus límites a 1920 × 1080 y 1280 × 720 en ca/es/en, con y sin movimiento
  reducido. No se ha cambiado el frontend ni el significado de sus instrucciones.
- Validación: 15 pruebas de puzzle 12 (incluida una con 12 variantes de
  navegador) y 8 de puntuación compartida aprobadas. Solo simulación aislada,
  sin broker/hardware ni base de datos real.

Esta entrada actualiza la selección aleatoria descrita en la entrada anterior:
se deja de sortear desde el quinto reinicio. Pep debe revisar la coordinación
de timers y confirmar el comportamiento con los diez terminales físicos.

## 2026-10-20 — Conexión Simultánea: diez botones de un color

Tipo: `pendiente de revisar`. Cambio solicitado por Olalla y autorizado
explícitamente antes de modificar backend.

- `mqtt/puzzles/puzzle12.py`: cada una de las quince combinaciones tiene
  exactamente un color con diez botones. El color varía entre combinaciones;
  las cantidades de los otros cinco colores se conservan. Esto exige que
  los diez terminales mantengan pulsado el botón de ese color.
- Se conserva la única ronda activa (nivel 3), la selección aleatoria,
  la duración, la confirmación de dos segundos y los contratos MQTT/SSE.
  La pantalla representa los nuevos objetivos desde `target`, sin cambios
  de frontend, colores, instrucciones ni recursos.
- `tests/test_puzzle12.py`: regresiones aisladas de las quince combinaciones,
  objetivos publicados y necesidad de los diez terminales. Sin iniciar Flask
  ni conectar MQTT/hardware; temporizadores simulados.

Pep debe revisar las cantidades y validar la pulsación simultánea con los
diez terminales físicos. No se ha hecho validación visual ni con hardware.

## 2026-10-20 — QUIZ: pausa del reloj durante los resultados

Tipo: `pendiente de revisar`. Cambio solicitado por Olalla: congelar también
el tiempo mientras se revisan respuestas correctas e incorrectas.

- `mqtt/puzzles/puzzle3.py`: conserva los segundos fraccionarios al completar
  los diez terminales, cancela e invalida el tick pendiente y publica
  `clock_paused: true` con el resultado. Los 7 segundos de revisión ya no
  consumen tiempo. Al mostrar otra pregunta reconstruye el plazo y reanuda el
  reloj; si corresponde aviso daurado, mantiene la pausa hasta revelarla.
- Se conserva el ajuste manual de Olalla: `golden_every = 6`. Instrucciones
  del GM y pruebas actualizadas a preguntas 6, 12, 18… y revisión pausada.
- No cambian puntuación, bancos, contratos MQTT ni persistencia. Snapshots y
  SSE conservan el mismo contrato y la pantalla ya admite `clock_paused`.
- Validación con relojes/temporizadores simulados y SQLite temporal, sin
  iniciar Flask real ni conectar MQTT/hardware. Pep debe revisar reanudación,
  transición resultado-aviso y cancelación de callbacks al parar o reiniciar.

Esta entrada sustituye las referencias anteriores a resultados que consumen
tiempo y a preguntas dauradas cada cinco.

## 2026-10-20 — QUIZ: preguntas dauradas cada cinco y pausa del aviso

Tipo: `pendiente de revisar`. Nueva mecánica solicitada por Olalla y cambio de
backend autorizado explícitamente. Sustituye la selección 2 easy / 3 medium /
1 hard y la puntuación uniforme del QUIZ descritas más abajo.

- `mqtt/puzzles/puzzle3.py`: selección aleatoria de easy salvo las preguntas
  5, 10, 15… que son de medium, contando tanto aciertos como fallos. No se
  introducen preguntas hard ni de empresa. Se conserva la mezcla de opciones
  y la validación de los diez terminales (4 verdes / 6 rojos). Los aciertos se
  excluyen de su banco hasta agotarlo; solo se recicla el mismo nivel, sin
  sustituirlo por preguntas de otro banco.
- `scoring_config.py`: añade `golden_multiplier = 2` al QUIZ. La puntuación
  acumula el valor de cada pregunta: con la base actual de 10 puntos, 20 en las
  dauradas. Los errores siguen sin restar y no borran puntos. Los puntos mixtos
  se guardan por el mismo callback al agotarse el tiempo; no cambia SQLite.
- Antes de revelar cada pregunta de medium se muestra un aviso de 4 segundos.
  El servidor conserva el tiempo restante exacto, oculta la pregunta en los
  snapshots y bloquea respuestas MQTT durante el aviso. Al revelar la pregunta
  reconstruye el plazo conservado y reanuda el reloj. La pausa no depende del
  navegador ni de una recarga; incluye cualquier retraso real del callback sin
  consumir tiempo de juego ni redondear segundos para ganar tiempo adicional.
- SSE/snapshots añaden `golden_announcement`, `golden_question`, `clock_paused`
  y `question_points`. Los temporizadores antiguos quedan invalidados en
  reset/stop y no pueden revelar una pregunta de una partida nueva. Se mantienen
  los 300 segundos de juego y los 7 segundos de revisión, que sí consumen tiempo.
- Pantalla e instrucciones del GM en ca/es/en: aviso de doble puntuación,
  reloj pausado visible y distintivo persistente durante la pregunta daurada.
  No se recolorean las respuestas, botones, aciertos o errores.
- Validación: 33 pruebas Python del QUIZ, 7 de puntuación y 28 JavaScript de
  reloj/presentación/audio aprobadas. Persistencia con SQLite temporal, patrones
  tras fallos, pausa junto al límite, bloqueos, reset/stop y callbacks antiguos.
  Chrome: 30 estados a 1920 × 1080 y 1280 × 720 en tres idiomas; regresiones de
  selección y ajuste de 396 textos aprobadas. Solo simulación aislada; sin
  broker, hardware, cambios de audio/imágenes ni base de datos real.

Pep debe revisar selección, acumulación mixta y pausa del reloj, y validar
la reanudación y las entradas físicas durante el aviso con los terminales.

## 2026-10-20 — Cerrar sesiones antiguas desde Sesiones

Tipo: `pendiente de revisar`. Cambio de backend autorizado explícitamente por
Olalla después de comprobar que el botón solo permitía cerrar la sesión activa.

- `app.py`: nuevo `POST /test/session/<session_id>/close`, que cierra por ID
  la sesión seleccionada, sin reactivarla ni abrir el desenlace. Permite cerrar
  sesiones iniciadas que quedaron abiertas tras una recarga/reinicio, aunque
  exista otra partida activa. Una sesión futura no iniciada y no activa devuelve
  409; una inexistente, 404; la telemetría no disponible, 503.
- Mantiene los puzzles, puntos e inicio registrados. No inventa victorias ni
  completa puzzles inconclusos. El cierre manual registra la hora actual; no
  reconstruye la hora real de finalización de una partida antigua. Repetir el
  cierre es idempotente y conserva un final ya registrado.
- Solo si se cierra la sesión actualmente activa se detiene su puzzle y se
  limpia la vinculación activa. Cerrar una sesión antigua no toca el puzzle,
  el reloj ni la vinculación de otra sesión. No se modifican contratos MQTT,
  el esquema de SQLite ni el endpoint `/final`.
- `templates/test.html`, `static/js/test.js` y `static/js/session-manager.js`:
  habilitan «Cerrar sesión» al seleccionar cualquier sesión en curso. Se pide
  confirmación, se guardan las ediciones del formulario, se verifica el cierre
  y se muestra la sesión en Historial, sin pasar por «Guardar e ir al control».
- Validación aislada: 10 pruebas Python de sesiones y 22 pruebas JavaScript de
  cierre/controles aprobadas. Chrome a 1920 × 1080 y 1280 × 720 con SQLite
  temporal: tres sesiones antiguas cerradas sin reactivación, otra activa
  conservada, puntos del QUIZ preservados, cancelación, fallo y doble clic.
  Sin iniciar el servidor real, sin MQTT/hardware ni alterar sesiones reales.

Pep debe revisar la coordinación del cierre con la sesión activa y los
temporizadores del puzzle. No se han cerrado automáticamente las sesiones de
Olalla; la acción queda disponible en el panel.

## 2026-10-20 — QUIZ: cinco minutos y diez puntos por pregunta correcta

Tipo: `pendiente de revisar`. Cambio solicitado por Olalla y autorizado
explícitamente antes de modificar backend.

- `mqtt/puzzles/puzzle3.py`: sustituye el objetivo de seis aciertos por una
  partida de 300 segundos, con reloj monotónico del servidor que sigue activo
  durante los resultados. Cada pregunta completamente correcta (4 verdes y
  6 rojos) suma puntos; los errores no descuentan ni borran puntos acumulados.
  Ambos resultados cargan otra pregunta después de los 7 segundos de revisión
  existentes. Se conserva el orden de dificultad en tandas renovables, sin
  finalizar al completar seis preguntas ni imponer un máximo de puntos.
- `scoring_config.py` y `scoring.py`: regla aditiva del QUIZ, 10 puntos por
  pregunta correcta y penalización cero. Los otros puzzles conservan su cálculo
  por intentos; no se aplica al QUIZ un máximo de 60 o 100 puntos.
- El servidor termina al vencer el plazo incluso sin respuestas ni navegador
  conectado, envía el mismo `FROM_FLASK: P3End` y publica `puzzle_solved` con
  `total_points` para que el callback existente cierre y puntúe la partida.
  No se modifican `app.py`, el cliente MQTT, las tablas ni partidas históricas.
- Snapshots y SSE exponen `remaining`, `duration`, `total_points`, `correct_count`,
  y permiten recuperar las elecciones y el resultado sin reiniciar el reloj.
  Reset y stop cancelan/inutilizan los temporizadores antiguos. Las respuestas
  duplicadas, fuera de plazo o durante la revisión no vuelven a puntuar.
- Pantalla, instrucciones y notas del GM actualizadas en catalán, castellano
  e inglés. Conservados el contrato `P3,terminal,1|5`, los colores funcionales
  y los recursos multimedia.
- Validación automatizada aislada: 27 pruebas de lógica/persistencia del QUIZ
  y 7 de puntuación compartida aprobadas. SQLite temporal y reloj simulado;
  sin broker, hardware ni base de datos real. Revisión de navegador a
  1920 × 1080 y 1280 × 720 en tres idiomas: reloj, elecciones, resultados,
  recuperación y finalización. También pasan las regresiones de selección
  y ajuste de los 396 textos activos. La suite JavaScript conserva un fallo
  previo ajeno al QUIZ en `game_language.test.cjs` (`openNativePlayer`).

Pep debe revisar el reloj y la puntuación aditiva y validar el flujo de
resultados y fin de tiempo con los diez terminales físicos.

## 2026-10-20 — Sumas: penalizar también las repeticiones sin reinicio

Tipo: `pendiente de revisar`. Cambio de regla solicitado explícitamente por Olalla.
Sustituye el criterio anterior que solo penalizaba errores con reinicio.

- `mqtt/puzzles/puzzle1.py`: separa `scoring_errors` (todos los errores aceptados
  y los tiempos agotados) de `round_errors` (errores que reinician la ronda).
  El resultado final usa `calculate_points("puzzle1", scoring_errors)`.
- Después de diez reinicios, repetir una suma resuelta sigue mostrando el aviso
  sin regenerar el tablero ni reiniciar o pausar el reloj, pero resta 3 puntos.
  Ejemplo: diez reinicios y una repetición sin reinicio dan 67 puntos, no 70.
  Los errores durante una pausa bloqueante y con `alwaysCorrect` siguen ignorados.
- El reset completo limpia ambos contadores. Se mantiene el suelo de cero,
  la persistencia del resultado al completar, los mensajes MQTT/SSE y los tiempos.
  No se recalculan registros históricos ni se aplica un nuevo límite de intentos.
- `tests/test_puzzle1.py`: verifica penalizaciones sucesivas sin reinicio,
  timeout durante el aviso, reset y entradas ignoradas.
- `tests/test_puzzle1_points.py`: verifica que los 67 puntos lleguen a SQLite
  temporal mediante el callback real aislado. Las pruebas de configuración,
  persistencia y suelo cero usan el contador de penalizaciones independiente.
- Validación: 25 pruebas de lógica, puntuación compartida y persistencia
  aprobadas; seis escenarios de navegador ca/es/en a 1920 × 1080 y 1280 × 720.
  Solo simulación, sin broker, hardware ni base de datos real. Sin cambios visuales.

Pep debe revisar la separación de contadores y validarla con terminales físicos.

## 2026-10-14 — Sumas: guardar los puntos al completar

Tipo: `pendiente de revisar`. Corrección solicitada por Olalla tras detectar una
partida de Sumas registrada sin puntos.

- Causa: existía la configuración de Sumas, pero el evento `puzzle_solved` no
  incluía `total_points`; el cierre de telemetría no recibía su puntuación.
- `mqtt/puzzles/puzzle1.py`: al completar calcula los puntos mediante
  `calculate_points("puzzle1", round_errors)` y los añade al evento final.
  Se aplica la configuración compartida: 100 puntos menos 3 por cada error
  que provoca reinicio, incluidos los tiempos agotados, con suelo cero.
  Repetir una suma sin reinicio después de diez errores no añade penalización.
- `total_points` queda disponible en snapshots y se limpia al reiniciar el
  puzzle. No se modifica el callback de Flask, el esquema de datos ni las
  partidas ya guardadas. El límite de 30 intentos sigue solo configurado:
  esta corrección no añade agotamiento ni modifica la duración del juego.
- `tests/test_scoring.py`: reconoce Sumas entre los puzzles acordados y verifica
  su penalización de 3 puntos, distinta de Cronómetro y Memory.
- `tests/test_puzzle1_points.py`: ocho pruebas de integración con el cliente MQTT
  real sin conexión, callback real de Flask aislado y SQLite temporal. Verifican
  100 puntos sin errores, 94 con un error y un timeout, 70 tras diez reinicios
  y repetición sin reinicio, duplicados, reset, configuración alternativa y suelo
  cero. Los fallos no cierran la partida y las victorias no se puntúan dos veces.
- Validación: 35 pruebas aprobadas entre Sumas, puntuación compartida y
  persistencia de Cronómetro/Memory. Sin iniciar Flask conectado al broker,
  sin hardware y sin tocar la base de datos real. Sin cambios visuales.

Pep debe revisar el cómputo de errores penalizables y validar la puntuación con
los terminales físicos. La partida anterior no se recalcula automáticamente.

## 2026-10-14 — Sumas: repetición sin reinicio después de diez errores

Tipo: `pendiente de revisar`. Cambio de lógica solicitado explícitamente por Olalla.

- `mqtt/puzzles/puzzle1.py`: cuenta errores que provocan reinicio durante la
  partida, incluidos los tiempos agotados. Los primeros diez reinician como
  antes. A partir de ahí, una suma ya realizada publica el aviso existente
  con `incorrect.resets_round = false`, conserva el tablero y permite seguir
  jugando. Las sumas inexistentes y el tiempo agotado siguen reiniciando.
- El reinicio completo del puzzle pone el contador a cero; regenerar el tablero
  no lo borra. Los avisos sin reinicio no incrementan el contador. Se conserva
  `alwaysCorrect`. Los trabajadores de error/timeout pendientes se invalidan
  al detener o reiniciar la partida para que no sobrescriban el tablero nuevo.
- `static/js/puzzle1.js`: el aviso sin reinicio mantiene el reloj activo y
  desaparece a los cinco segundos. Un acierto, un reinicio, el tiempo agotado
  o la victoria cancelan su limpieza pendiente para no borrar un estado posterior.
  Los mensajes anteriores sin el campo nuevo mantienen su comportamiento.
- No se aplica todavía la puntuación de `scoring_config.py` ni el límite de
  30 intentos a la lógica de Sumas. No cambian las rutas ni los mensajes MQTT.
- Validación: diez pruebas de backend aprobadas y seis escenarios de navegador
  (ca/es/en a 1920 × 1080 y 1280 × 720), con plantillas reales y SSE/reloj/audio
  simulados. Se comprueban conservación de enciertos, continuidad del reloj,
  timeout durante el aviso, recuperación y finalización. Sin MQTT, hardware ni
  base de datos real. Imágenes referenciadas cargadas; favicon preexistente 404.

Pep debe revisar el cómputo de los diez reinicios y validar el comportamiento
con los terminales físicos.

## 2026-10-14 — Configuración de puntuación de Sumas

Tipo: `pendiente de revisar`. Cambio solicitado explícitamente por Olalla.

- `scoring_config.py`: añade `puzzle1` con máximo 100 puntos, penalización de
  3 puntos por error y límite de 30 intentos.
- Solo se añade la configuración acordada; no se modifica la lógica del puzzle
  ni su integración MQTT/SSE. Pep debe revisar su aplicación en Sumas.

## 2026-10-14 — Puntuación compartida y reintentos del Cronómetro

Tipo: `pendiente de revisar`. Backend y límite de diez intentos autorizados
explícitamente por Olalla; configuración y cálculo compartidos solicitados después.

- `scoring_config.py`: `SCORING_CONFIG` contiene exclusivamente las reglas
  acordadas para `puzzle5` y `puzzle8`: máximo 100, penalización 10 e intento
  máximo 10. No se asignan los valores de ejemplo a otros puzzles.
- `scoring.py`: `calculate_points(puzzle_id, errors)` calcula la puntuación sin
  efectos secundarios, con suelo cero; rechaza errores negativos/no enteros y
  puzzles sin configuración. `get_max_attempts` consulta el límite compartido.
- `mqtt/puzzles/puzzle8.py`: sustituye las constantes y fórmula locales por
  consultas compartidas. Conserva las fases, conservación de aciertos y
  contratos SSE/MQTT existentes.
- `mqtt/puzzles/puzzle5.py`: primer intento 100 puntos y margen 10 s; cada
  reintento iniciado resta 10 puntos y amplía el margen 4 s. Acertar al décimo
  da 10 puntos; fallarlo publica agotamiento y cero puntos, mantiene cinco
  segundos esa pantalla y autoriza avance sin victoria. Los puntos finales
  usan el cierre de telemetría existente, sin modificar su esquema.
- Cronómetro conserva objetivo 30 s, preparación 5 s, resultados 2 + 5 s,
  reintento 9 s y mensajes `P5_Round2` / `P5_End`. Timers cancelables y seriales
  descartan callbacks tras stop/reset; se ignoran entradas duplicadas,
  terminales inválidos y errores no finitos. Snapshots incluyen resultado y
  puntuación para reconexiones. El intento solo aumenta al iniciar el reintento.
- `tests/test_scoring.py`, `tests/test_puzzle5.py` y
  `tests/test_puzzle5_points.py`: cálculo centralizado,
  configuración alternativa, diez intentos, márgenes, límites inclusivos,
  agotamiento, cancelación y persistencia en SQLite temporal.
  `README.md` explica el uso compartido.

Pep debe revisar reglas y la detención del ESP32 mediante el mensaje existente
`P5_End` también al agotar intentos. No se modifica la base de datos real ni
se recalculan partidas anteriores. Validación aislada, sin MQTT ni hardware.

Verificación: 61 pruebas Python aprobadas de puntuación compartida, Cronómetro,
Memory y persistencia; 21 pruebas JavaScript aprobadas de Cronómetro, Memory y
audio de cuenta atrás. Sin cambios visuales adicionales en esta centralización.

Revisión previa a guardar: eliminadas variables, funciones y logs sin uso del
frontend del Cronómetro; los snapshots se vuelven a solicitar tras cada
reconexión SSE y un fallo de consulta no bloquea consultas posteriores.
Corregida la visibilidad del contador de intento/puntos, que el CSS compartido
ocultaba, y los textos ingleses de la preparación y margen. Nuevas pruebas
de reconexión y `tests/puzzle5_browser.cjs` para la revisión aislada.
Resultado final: 61 pruebas Python y 51 JavaScript aprobadas; 42 pantallas Chrome
en ca/es/eng a 1920 × 1080 y 1280 × 720, sin recortes, imágenes ausentes ni
errores JavaScript. Capturas e informe local en `output/chrono-revisio/`.
Solo simulación, sin hardware. La comprobación visual permite explícitamente
la ausencia del paquete de audio USB: faltan seis audios referenciados
(`musica_ambient/musica_piramide.mp3` y cinco efectos: `beep_countdown.wav`,
`victory-celebration.wav`, `boto.wav`, `fase_completada.wav`,
`fase_nocompletada.wav`). El favicon también devuelve 404; se registra como
diagnóstico, no como fallo de juego. No se crean ni sustituyen esos recursos.

## 2026-10-14 — Cronómetro: límite de error general

Tipo: `pendiente de revisar`. Cambio de backend autorizado explícitamente por Olalla.

- `mqtt/puzzles/puzzle5.py`: el límite de error total de la ronda baja de 20 a
  10 segundos. Se mantiene la suma de los valores absolutos de los errores de
  los diez jugadores y el criterio de éxito `total <= limit`.
- No cambian el objetivo de 30 segundos, los tiempos de espera ni los contratos
  MQTT/SSE. Pep debe revisar el nuevo umbral antes de validarlo con hardware.

## 2026-10-14 — Memory: puntos y límite de intentos

Tipo: `pendiente de revisar`. Autorización explícita de Olalla para ampliar
backend y telemetría. Regla confirmada: 100 puntos en el primer intento,
90 en el segundo, 80 en el tercero; acertar al décimo todavía da 10 puntos.
Si el décimo intento falla, se termina con cero puntos, sin un undécimo intento
y sin registrar el puzzle como superado.

- `mqtt/puzzles/puzzle8.py`: parámetros por defecto `INITIAL_POINTS = 100`,
  `RETRY_PENALTY = 10`, `MAX_ATTEMPTS = 10`; el contador aumenta al comenzar
  realmente el reintento, nunca por mensajes, snapshots ni aciertos parciales.
  El fallo final conserva primero los cinco segundos de resultados, muestra
  `exhausted` durante cinco segundos y luego publica `auto_advance = True`.
  El éxito asigna `total_points` una sola vez. Reset limpia intentos, puntos y
  esgotamiento; un identificador de ejecución descarta evaluaciones antiguas.
- `app.py`: el fan-out SSE cierra la telemetría tanto al resolver como al agotar
  el puzzle, enviando sus puntos. No cambia el comportamiento de otros puzzles
  que no exponen `total_points`.
- `mqtt/client.py`: `end_active_puzzle` admite puntuación opcional y mantiene la
  protección de puzzle activo y el cierre único por registro.
- `telemetry/writer.py`: `end_puzzle` guarda fin y puntos en una sola actualización
  protegida por su lock. Las llamadas sin puntuación conservan el valor existente.
  No se cambia el esquema ni se suma o almacena un total de sesión.
- Frontend Memory: contador de intento y puntos disponibles; pantalla de
  «INTENTS ESGOTATS» / «INTENTOS AGOTADOS» / «NO ATTEMPTS LEFT» con cero puntos.
  Tras la autorización del backend se abre `/presentacio/<next_puzzle_id>`, con
  el idioma seleccionado y el siguiente destino definido por el recorrido.
  No se llama a la celebración ni a `PyramidRun.complete` por agotamiento.
- `static/js/game-director.js`: informa del agotamiento y bloquea intervenciones
  durante ese estado. `static/js/presentation-flow.js`: notas del GM coherentes
  con conservación de aciertos, puntuación, límite y avance automático.
- `tests/test_puzzle8.py`, `tests/test_puzzle8_points.py` y pruebas JavaScript:
  puntuación, diez intentos reales, cierre con SQLite temporal, ausencia de puntos
  parciales, reconexión, cancelación y navegación sin premios ficticios.

Pep debe validar con ESP32 el uso del mensaje existente `P8End` también para
detener el hardware al agotar intentos. El evento `puzzle_exhausted` distingue
este desenlace del éxito; `puzzle_solved` permanece falso. No se modifican
topics ni los tiempos anteriores de preparación, memoria, resultados o reintento.

Verificación: 37 pruebas Python de Memory/persistencia, 7 de almacenamiento de
puntos y 4 de sesiones aprobadas; 42 pruebas JavaScript de Memory, cuenta atrás,
idiomas, presentación y ayudas del GM aprobadas. Chrome con fixtures aislados:
36 casos de fases/idiomas/resoluciones, incluidas puntuación visible y pantalla
de agotamiento a 1920 × 1080 y 1280 × 720, y navegación real al siguiente destino
del recorrido actual, sin otorgar progreso por agotamiento. Capturas en
`output/memory-confirmados/`. Solo simulación y SQLite temporal, sin MQTT ni
hardware. No se modifica la base de datos real ni se recalculan partidas antiguas.

## 2026-10-14 — Memory: aciertos conservados por jugador

### Ampliación autorizada: pausa entre intentos

- `mqtt/puzzles/puzzle8.py`: los intentos incorrectos entran en la nueva fase
  `retry`, de 10 segundos, antes de repetir preparación y memoria. Corrección
  solicitada: primero se mantiene el tablero de resultados durante cinco segundos,
  con las letras registradas y los marcos de acierto/error; después empieza
  la pausa de diez segundos. El éxito mantiene su flujo anterior.
  Un timer cancelable reinicia únicamente los contenedores
  pendientes. No se aceptan entradas durante la pausa.
- SSE y snapshots exponen `retry_summary.errors` (contenedores pendientes) y
  `retry_summary.accumulated_correct` (contenedores confirmados acumulados),
  junto con los campos existentes de duración y tiempo restante.
- `templates/puzzle8.html`, `static/js/puzzle8.js`, `static/css/puzzle8.css` y
  `static/js/game-copy.js`: pantalla de resultados y cuenta atrás en los tres
  idiomas; una reconexión recupera el tiempo restante, sin reiniciar la pausa.
- Pruebas de lógica y navegador cubren resumen acumulado, pausa, entradas
  ignoradas, cancelación y regreso al tablero. Pendiente validación con ESP32.
- El snapshot de respuesta conserva `input_result` durante la revisión del
  tablero. Al reconectar se recuperan las letras y sus resultados sin repetir
  el sonido. Se limpia el resultado anterior al reiniciar o detener la prueba.

Verificación de la ampliación y su corrección: 23 pruebas Python de Memory y 13 pruebas
JavaScript de Memory, cuenta atrás y copia catalana aprobadas. Chrome con fixture
aislado: 30 casos de fases/idiomas/resoluciones, incluidos el tablero de resultados
y la nueva pausa a
1920 × 1080 y 1280 × 720, sin desbordes. Capturas en
`output/memory-confirmados/`. Solo simulación, sin MQTT ni hardware.
La revisión adicional de idiomas detecta una falla ajena al cambio: el test del
launcher nativo busca `openNativePlayer`, que ya no existe en el archivo
`static/js/presentation-gm.js`, no modificado en esta tarea.

Tipo: `pendiente de revisar`. Autorización explícita de Olalla para modificar
backend y pantalla.

- `mqtt/puzzles/puzzle8.py`: cada evaluación confirma los contenedores con sus
  dos parejas letra/color correctas, en cualquier orden. Los reintentos limpian
  solo los contenedores incorrectos y mantienen las parejas objetivo del intento.
  Las entradas posteriores de jugadores confirmados se ignoran. Reiniciar,
  detener o pasar a una nueva ronda borra las confirmaciones.
- SSE y snapshots añaden `confirmed_boxes` y `confirmed_entries`, sin retirar
  campos ni modificar mensajes o topics MQTT.
- `static/js/puzzle8.js`: conserva las dos respuestas y el marco de acierto
  durante preparación, memoria y respuesta; también al recuperar el estado.
- `tests/test_puzzle8.py`: regresiones de reintentos, acumulación de aciertos,
  entradas ignoradas y reinicio. Validación aislada, sin hardware.

Pep debe revisar la persistencia por token y validar los reintentos con ESP32.
Salvo la nueva pausa entre intentos descrita arriba, no se cambian las duraciones
de preparación y memoria, la puntuación ni el mensaje final `P8End`.

Verificación: 17 pruebas Python de Memory y 9 pruebas JavaScript de celebración
y cuenta atrás aprobadas. Chrome con plantillas reales y SSE simulado: las tres
fases en castellano, catalán e inglés, a 1920 × 1080 y 1280 × 720 (18 casos),
incluida recuperación de respuestas y limpieza al reiniciar, sin desbordes de
contenido ni imágenes ausentes. Capturas en `output/memory-confirmados/`.
Solo simulación; sin conexión a MQTT ni hardware.

## 2026-10-13 — Puntos de los puzzles jugados por sesión

Tipo: `pendiente de revisar`. Autorización explícita de Olalla para modificar
telemetría. Decisión final: conservar únicamente la puntuación de cada registro
de puzzle, sin almacenar ni calcular automáticamente el total de la sesión.

- `telemetry/schema.py`: `puzzles.total_points INTEGER NOT NULL DEFAULT 0`.
  Se elimina `sessions.total_points`, los tres triggers de agregación de la
  versión 4 y la reconciliación automática. Migración desde 3/4 sin borrar
  sesiones, puzzles, sus puntuaciones ni eventos; `DROP COLUMN` requiere
  SQLite 3.35 o superior. Las versiones no soportadas se rechazan sin borrar tablas.
- `telemetry/config.py`: esquema 5, para migrar también las BD donde se aplicó
  la versión 4 antes de esta rectificación.
- `telemetry/queries.py`: solo los resultados de puzzles exponen `total_points`.
  Se retiran los puntos de las consultas de sesiones. No se añade una función
  de suma: queda para una tarea posterior.
- `tests/test_telemetry_points.py`: pruebas aisladas de puntuación por registro,
  ausencia de total/triggers y conservación de datos al migrar desde 3/4.

Pendiente: programar el cálculo de puntos de cada puzzle. Hasta entonces los
registros nuevos tienen cero puntos. Pep debe revisar cómo asignar la puntuación
a cada ronda/intento; no se modifican MQTT, reglas ni pantallas.

Verificación final: 7 pruebas de puntos/migración y 4 de sesiones aprobadas en
BD temporales, sin iniciar Flask ni conectar MQTT/hardware. Migración aplicada
a la BD local con copia SQLite consistente previa: se conserva su sesión y
todos los registros restantes (sin puzzles/eventos registrados en ese momento).
Esquema 5, sin columna de puntos en sesiones ni triggers de suma; integridad
correcta y sin errores de claves foráneas. Reiniciar Flask para retirar las
consultas antiguas de la memoria del proceso y recargar el visor de la BD.

## 2026-10-06 — Bloques antes y después del Trivial

Archivo: `config.py`. Tipo: `pendiente de revisar` con terminales físicos.

Autorización: petición explícita de configurar libremente los bloques antes y
después del Trivial, manteniendo `PUZZLE_ORDER` para el backend y los ESP32.

- Se añaden `PUZZLE_PRE_TRIVIAL = [2, 1, 8]`, `PUZZLE_TRIVIAL = 3` y
  `PUZZLE_POST_TRIVIAL = [5, 12, 4]`.
- `PUZZLE_ORDER` sigue siendo una lista de IDs, calculada a partir de esos bloques:
  `[2, 1, 8, 3, 5, 12, 4]`. El Trivial pasa de la segunda a la cuarta posición.
- Se permiten bloques de distinta longitud. Los IDs deben ser únicos y no incluir
  tutorial ni final. Los cambios de configuración se aplican al reiniciar.
- No se modifican handlers MQTT, mensajes, reglas, timers ni puntuación. La posición
  ordinal del Trivial, Memory y Sumas cambia conforme al nuevo recorrido.

Revisión para Pep: validar la nueva secuencia y sus posiciones con los ESP32.
El diagrama de etapas todavía no está implementado.

Verificación: cinco tests de rutas de presentación aprobados con MQTT simulado,
incluidas las transiciones en el nuevo orden y el contexto de los puzzles.
`git diff --check` sin errores. No se conecta hardware ni se inicia el servidor real.

Recomprobación: se restauran los bloques tras encontrar de nuevo una lista única,
conservando el orden guardado por el usuario (`2, 1, 8` antes del Trivial).
Se verifica también la generación de `PUZZLE_ORDER` con bloques de distinta longitud.

## 2026-03-25

### app.py

Archivo:

- [app.py](./app.py)

Estado del cambio:

- `añadido`

Partes tocadas:

- nueva ruta `test_lab()`
- nueva ruta `test_send_message()`
- nueva ruta `test_puzzle3_solution()`

Detalle:

- se añade una pantalla interna `/test`
- se añade un endpoint POST para publicar mensajes al broker MQTT desde web
- se añade un endpoint GET para consultar la respuesta correcta activa de `puzzle3`
- el envio usa el mismo formato de payload que el flujo de terminal
- por defecto publica en el topic `TO_FLASK`

Tipo:

- `utilidad interna`

Cambio:

- añadidas rutas `/test` y `/test/send`

Motivo:

- poder simular puzzles por web enviando mensajes al mismo topic MQTT que se usa desde terminal (`TO_FLASK`)

Impacto:

- no cambia la logica de ningun puzzle
- añade una herramienta interna de test

Revision backend:

- baja

### puzzle3.py

Archivo:

- [puzzle3.py](./mqtt/puzzles/puzzle3.py)

Estado del cambio:

- `añadido`
- `modificado`

Partes añadidas:

- nueva funcion `_checkpoint_for_streak()`

Partes modificadas:

- bloque de fallo dentro de `handle_message()`

Antes:

- al fallar una pregunta, se ejecutaba `_choose_new_set()`
- eso regeneraba el bloque de preguntas
- `self.current_question_idx` volvia a `0`
- `self.streak` volvia a `0`

Ahora:

- al fallar, ya no se genera un nuevo set de preguntas
- se calcula el ultimo checkpoint desbloqueado con `_checkpoint_for_streak()`
- se reasignan:
  - `self.streak`
  - `self.current_question_idx`
  - `self.answered_players`

Regla resultante:

- si falla antes de `3`, vuelve a `0`
- si falla entre `3` y `5`, vuelve a `3`
- si falla entre `6` y `9`, vuelve a `6`

Resumen tecnico:

- antes: al fallar se llamaba a `_choose_new_set()` y se volvia a `0`
- ahora: al fallar se calcula el ultimo checkpoint desbloqueado y se reasignan:
  - `self.streak`
  - `self.current_question_idx`
  - `self.answered_players`

Tipo:

- `pendiente de revisar`

Cambio:

- ajustada la logica de fallo para respetar checkpoints de seguridad
- ahora el reset vuelve al ultimo protocolo desbloqueado:
- antes de `3` correctas: vuelve a `0`
- entre `3` y `5`: vuelve a `3`
- entre `6` y `9`: vuelve a `6`

Motivo:

- alinear comportamiento real con la logica visual de `Seguridad 1 / 2 / 3`
- evitar que un fallo despues del checkpoint devuelva siempre al inicio absoluto

Impacto:

- cambia el comportamiento real del puzzle 3
- mantiene el mismo bloque de preguntas en vez de regenerar uno nuevo al fallar

Revision backend:

- alta

### app.py

Archivo:

- [app.py](./app.py)

Estado del cambio:

- `detectado`

Partes observadas:

- ruta `puzzle()`
- rutas internas `/test`, `/test/send` y `/test/puzzle3_solution`

Tipo:

- `detectado`

Observacion:

- la ruta `/puzzle/<id>` envia `P{id}Start` al hardware al renderizar la pagina
- despues, el frontend de cada puzzle vuelve a llamar a `/start_puzzle/<id>` al abrir SSE
- eso implica un posible doble arranque real del mismo puzzle
- ademas, las rutas internas de test quedan expuestas como endpoints normales de Flask
- `/test/send` permite inyectar payloads hacia `TO_FLASK`
- `/test/puzzle3_solution` expone la respuesta correcta activa de `puzzle3`

No modificado:

- no se ha cambiado codigo en este archivo durante esta revision
- solo se deja constancia para validacion funcional y de despliegue

Motivo de anotacion:

- el doble `Start` puede reiniciar dos veces hardware, audio o timers
- los endpoints de test son utiles para simulacion, pero conviene confirmar si deben quedar abiertos en entorno real

Revision backend:

- alta

### puzzle4.py

Archivo:

- [puzzle4.py](./mqtt/puzzles/puzzle4.py)

Estado del cambio:

- `modificado`

Partes tocadas:

- `get_state()`
- nueva funcion `_get_audio_duration()`
- flujo de `_handle_validation()`
- bloque final de validacion en `handle_message()`

Tipo:

- `pendiente de revisar`

Detalle:

- `get_state()` se ha dejado como lectura pura, sin mutar estado ni empujar SSE al consultar `/current_state`
- se calcula la duracion real del ultimo `.wav` de la secuencia para no adelantar la validacion
- el orden backend de cierre de ronda queda fijado a:
- primero termina el ultimo tramo reproducido
- despues se emite `validation_feedback`
- luego se mantiene el efecto durante `3` segundos
- y solo entonces empieza el countdown o la siguiente muestra
- esto evita que la segunda muestra arranque antes de tiempo cuando la secuencia es correcta

Impacto:

- cambia comportamiento real del puzzle 4
- elimina el avance prematuro entre la primera y la segunda muestra
- evita inconsistencias entre audio final, feedback visual y arranque de la siguiente fase

Motivo:

- alinear el orden real del juego con la experiencia esperada por frontend y por la persona jugadora
- evitar que la sincronizacion dependa de tiempos aproximados en frontend

Revision backend:

- alta

### mqtt/client.py

Archivo:

- [mqtt/client.py](./mqtt/client.py)

Estado del cambio:

- `detectado`

Partes observadas:

- funcion interna `_dispatch_message()`

## 2026-04-05

### app.py

Archivo:

- [app.py](./app.py)

Estado del cambio:

- `añadido`
- `anotado`

Partes tocadas:

- [app.py:1](./app.py#L1)
  - import de `Path`
- [app.py:3](./app.py#L3)
  - import de `send_from_directory`
  - import de `abort`
- [app.py:11](./app.py#L11)
  - nueva constante `BASE_DIR`
- [app.py:94](./app.py#L94)
  - comentario de inicio del bloque `Scene Player`
- [app.py:95](./app.py#L95)
  - nueva ruta `scene_player()`
- [app.py:99](./app.py#L99)
  - nueva ruta `scene_player_assets()`
- [app.py:103](./app.py#L103)
  - nueva ruta `scene_config()`
- [app.py:116](./app.py#L116)
  - comentario de cierre del bloque `Scene Player`

Tipo:

- `utilidad interna`

Detalle:

- se añade una ruta aislada `/player/` para servir el frontend del scene player desde la carpeta `player/`
- se añade una ruta `/player/<path:filename>` para servir `index.html`, `main.js`, `styles.css` y futuros assets del reproductor
- se añade una ruta `/scenes/<scene_id>/config.json` para cargar la configuración JSON de cada escena
- se introduce `BASE_DIR` para resolver de forma estable las carpetas `player/` y `scenes/`
- la ruta de escenas valida que `scene_id` no pueda escapar del directorio `scenes/`
- si la escena no existe, o si la resolución de ruta sale fuera del directorio permitido, devuelve `404`
- el bloque queda acotado visualmente en `app.py` para que backend pueda localizarlo y revisarlo rápido

Cambio:

- añadido soporte backend mínimo para el reproductor híbrido de intros

Motivo:

- permitir que el nuevo frontend de escenas híbridas cargue sus assets y sus configs sin tocar la lógica de puzzles
- preparar la sustitución progresiva de los vídeos intro tradicionales por escenas nuevas construidas con:
  - clips del personaje
  - audio independiente
  - UI programada
  - subtítulos y sincronía por fases

Impacto:

- no cambia la lógica MQTT
- no cambia timers
- no cambia rutas de puzzle existentes
- no modifica el flujo principal del juego
- añade únicamente endpoints nuevos y acotados para el sscene player
- no sustituye todavía los vídeos intro actuales por sí mismo
- deja lista la infraestructura para que, más adelante, esas nuevas escenas puedan reemplazar las intros de cada puzzle

Riesgo:

- bajo
- solo habría conflicto si ya existiera otro uso de `/player/*` o `/scenes/*`

Revision backend:

- baja

## 2026-03-26

### puzzle4.py

Archivo:

- [puzzle4.py](./mqtt/puzzles/puzzle4.py)

Estado del cambio:

- `modificado`

Partes tocadas:

- `get_state()`
- nueva funcion `_handle_validation()`

Detalle:

- `get_state()` hacia mas que devolver snapshot
- al consultar `/current_state`, el metodo podia modificar estado interno y emitir nuevos `_push()`
- eso provocaba ruido en terminal con multiples lineas `Sending SSE data` y varias peticiones repetidas a `/current_state`
- se ha dejado `get_state()` como lectura pura del estado actual
- se ha movido la logica de avance tras validar secuencia a `_handle_validation()`, que es el flujo que `handle_message()` ya intentaba lanzar en un hilo
- ademas, la validacion correcta/incorrecta ahora espera la duracion real del ultimo audio antes de avanzar de fase o resetear intento
- esto evita que la primera fase se de por buena antes de que termine de sonar la ultima pista
- el feedback de acierto o fallo se mantiene 3 segundos antes de continuar con el siguiente paso del flujo

Tipo:

- `pendiente de revisar`

Cambio:

- separado el snapshot de lectura del flujo real de validacion en puzzle 4

Motivo:

- evitar efectos secundarios al consultar estado actual
- cortar el bucle de emisiones SSE repetidas observado durante el test de frontend
- dejar la validacion del puzzle en un punto explicito y coherente

Impacto:

- cambia comportamiento real de backend en puzzle 4
- elimina spam de eventos al pedir `/current_state`
- reduce riesgo de transiciones duplicadas o estados incoherentes al cerrar una secuencia
- corrige el corte prematuro del ultimo audio al cerrar una secuencia valida
- hace mas legible el feedback real de victoria o fallo para la persona jugadora

Revision backend:

- alta

### mqtt/client.py

Archivo:

- [mqtt/client.py](./mqtt/client.py)

Estado del cambio:

- `modificado`

Partes tocadas:

- conexion inicial al broker MQTT
- nueva funcion interna `_dispatch_message()`
- ajuste de `send_message()`

Detalle:

- si el broker MQTT no esta disponible al arrancar, la app ya no cae por excepcion en la conexion
- se guarda el estado de conexion para distinguir modo broker real y modo fallback local
- cuando se envia a `TO_FLASK` sin broker, el payload se redirige localmente al mismo handler de puzzles
- los mensajes hacia otros topics siguen dependiendo del broker real

Tipo:

- `utilidad interna`

Cambio:

- endurecido el cliente MQTT para que `/test` siga siendo util aunque no haya broker levantado

Motivo:

- mantener operativo el simulador web como herramienta interna incluso en sesiones sin hardware o sin infraestructura MQTT activa

Impacto:

- no cambia la logica de los puzzles
- mejora la resiliencia del arranque
- permite que el flujo de simulacion por `/test/send` siga actualizando estado local si el topic es `TO_FLASK`
- en el estado actual de `Test Lab`, la pantalla `/test` ya no abre SSE ni hace polling automatico
- `/test` se usa como simulador/manual sender de MQTT y consulta `current_state` solo cuando el usuario pulsa `Actualizar estado`

Revision backend:

- media

Revision backend:

- alta

### puzzle6.py

Archivo:

- [puzzle6.py](./mqtt/puzzles/puzzle6.py)

Estado del cambio:

- `detectado`

Partes observadas:

- logica de finalizacion en `_monitor_loop()`
- manejo de reinicio en `handle_message()`

Tipo:

- `detectado`

Observacion:

- el puzzle se da por superado al terminar el tiempo si no hay fallo
- actualmente no exige una confirmacion positiva de lectura NFC para completarse

No modificado:

- no se ha cambiado codigo en este archivo
- solo se deja constancia para revision funcional

Motivo de anotacion:

- es un comportamiento importante detectado durante el trabajo de frontend
- no se ha modificado, pero conviene que backend lo valide

Revision backend:

- alta


## 2026-10-05 — Integració del nou recorregut de presentacions

### app.py

Estat: `pendiente de revisar` amb terminals físics.

Autorització: petició explícita d’aplicar les noves pantalles al joc real, mantenir HTMLs separats i facilitar el control des de Test.

- Les rutes de benvinguda, introducció, pràctica, presentació de puzzle, transició i final renderitzen el nou suport visual manual. S’han mantingut els punts d’inici i tancament de telemetria.
- `presentation_page_data()` comparteix l’ordre de `config.py`, les rutes, l’idioma de la sessió i el següent destí. Les presentacions no inicien MQTT.
- Les rutes de puzzle conserven les plantilles i aporten les metadades del tema compartit. L’inici segueix fent-lo el JS existent en obrir el joc; el compte enrere no envia un segon inici.
- Les entrades antigues del reproductor i de les explicacions redirigeixen a les presentacions noves. Es retiren els endpoints exclusius del reproductor de timeline, les seves plantilles, scripts i CSS sense ús.
- `welcome()` és la superfície persistent que permet navegar per HTMLs independents sense perdre la pantalla completa.

### Frontend amb efecte sobre el recorregut

- Els JS dels puzzles configurats (11, 2, 3, 10, 1, 5, 12, 4, 6) avisen el pont compartit quan es completen. En la superfície nova, aquest pont obre la transició i espera el GM. La detecció de completat continua sent la de cada joc.
- Test obre una sola finestra de jugadors; **Presentar seleccionado** presenta abans d’iniciar. Els accessos tècnics al puzzle mantenen l’obertura directa.
- No s’han modificat els mòduls MQTT, les rondes, els temporitzadors ni la validació de respostes en aquesta integració. Els canvis previs de l’usuari en aquests fitxers es conserven.

Verificació: 18 tests passats dins `venv`, incloses les rutes i la separació entre presentar i iniciar; Chrome amb les rutes reals i MQTT simulat, nou puzzles iniciats una sola vegada, esperes manuals, cancel·lació del compte enrere, final, idioma i redireccions antigues. No s’ha iniciat una partida amb hardware real.

Retirada: 13 fitxers antics sense ús en el nou recorregut, verificats contra Git i copiats a `/tmp/pyramid-retirement-backup/` abans d’eliminar-los. Prova de retirada a `output/real-game/retirement-proof.json`. Els recursos binaris i els catàlegs amb dependències en eines es conserven.


### 2026-10-05 — Memory substitueix Segments en el recorregut

Autorització explícita: «no pongas el 10 segementos y pon el 8 memory».

- `config.py`: `PUZZLE_ORDER` passa de `[2,3,10,1,5,12,4]` a `[2,3,8,1,5,12,4]`. Memory ocupa el nivell 3, entre Trivial i Sumes.
- Presentació de Memory en tres idiomes, exemple amb dues formes/colours i connexió de la finalització de `puzzle8.js` al pont compartit. Regles i MQTT de Memory sense canvis.
- Segments es conserva al projecte, fora del recorregut configurat.

Verificació del canvi de recorregut: 18 tests passats; 58 diapositives en tres idiomes comprovades en Chrome. Presentació i joc real de Memory provats amb MQTT simulat; validació amb terminals físics pendent.


### 2026-10-05 — Ritme, exemples i piràmide d’assoliments

Autorització explícita: implementar les millores del recorregut, analitzar els jocs i preparar exemples reals, amb una piràmide que es construeix com a assoliment.

- `app.py`, context compartit: afegeix `game_puzzle_order` per calcular el progrés amb l’ordre configurat. `base.html` publica l’ordre i l’ID final al tema compartit.
- Frontend: les presentacions es redueixen a 21 passos de proves (36 pantalles totals); obertura automàtica en quatre moments amb pausa; final de 11 segons seguit de foto fixa.
- `game-shell.js` registra els IDs completats des del pont del joc en curs, en `sessionStorage`. El progrés és visual, sobreviu a recàrregues i no canvia per un salt del GM. L’obertura reinicia aquesta memòria. No és persistència backend ni telemetria.
- `puzzle1/2/3/4/5/6/8/11/12.js`: en el recorregut gestionat, el rètol local de prova superada dura 1,3 s abans de la celebració compartida (abans 5,2 s o 1,8 s segons el joc). Fora del recorregut conserva el temps anterior. El so funcional de victòria dura 1 s. No canvien els temps de joc, les rondes ni les validacions MQTT.
- Test incorpora ajudes graduals i observacions manuals descarregables, sense enviar-les a serveis externs ni alterar la partida.

Verificació: 18 tests Python, tres contractes de flux/progrés en Node, recorregut complet en Chrome sobre Flask amb MQTT simulat i comprovació visual de 36 pantalles en tres idiomes. Validació de hardware pendent.


### 2026-10-05 — Control de juego unificat a Test

Autorització: crear una nova pestanya al costat de Técnico per controlar pantalles i resoldre passos dels puzzles; conservar les anteriors fins que s’afini la nova.

No es modifiquen rutes Flask ni mòduls MQTT. La pestanya nova reutilitza `/current_state`, `/test/send`, `/test/force_end`, el reinici existent i `/test/puzzle6/solve`.

Canvis de comportament de les ajudes frontend (`static/js/test.js`):

- Trivial interpreta les deu respostes de `correct_answer` com a verd/vermell segons el contracte actual (5/1). Corregeix primer els terminals ja contestats i comprova que la pregunta no hagi canviat.
- Memory envia només els parells forma/color que falten, ignorant l’ordre d’arribada. Si una entrada ja és incorrecta, informa el GM; no inventa una correcció que el backend no permet.
- Botons configura els deu terminals, incloent els que s’han d’alliberar, perquè les pulsacions anteriors no alterin la suma.
- Pràctica respecta `current_substep` per no repetir subpassos fets.
- Sumes retorna l’error de falta de confirmació al controlador nou, en lloc de mostrar l’ajuda com a enviada amb èxit.

La finalització forçada continua sent una intervenció del GM que compta com a prova superada, igual que l’endpoint existent. Navegar només de pantalla no completa cap prova.

Verificació: cinc tests Node de resolutors, tres tests de recorregut, 18 tests Python i navegador amb estats/MQTT simulats. Validació amb terminals físics pendent.


### 2026-10-05 — Finestra normal de jugadors

Autorització: obrir una finestra nova normal, no una pestanya ni un popup restringit.

`player_window.py`, registrat a `app.py`, afegeix `POST /test/player-window`: executa el navegador del GM amb `--new-window` i una URL local del joc. Només accepta peticions de loopback amb Origin propi i destinacions relatives locals. El procés s’executa amb arguments separats, sense shell. No toca MQTT, sessions ni telemetria.

Test i el shell es comuniquen per `BroadcastChannel` del mateix origen/perfil. Es descobreix una pantalla ja oberta abans de llançar-ne una altra. Cal recarregar/reiniciar el servidor per registrar la nova ruta.

Validació: tests del llançador amb procés simulat i navegador amb llançament de finestra independent simulat; no s’ha iniciat l’app de producció ni connectat hardware.


### 2026-10-05 — Esquemes de presentació progressius

Autorització: una composició gràfica vistosa per joc, revelada progressivament pel GM. No es canvien rutes Flask, lògica de puzzles, MQTT, rondes ni àudio.

Els nou puzzles tenen tres revelacions amb els mateixos nodes: objectiu, eines i interacció. El compte enrere només s’habilita al tercer pas. Les gràfiques utilitzen les mecàniques actuals, amb patrons il·lustratius i sense iniciar terminals. Visor de revisió a `/player/briefings.html`.

Validació: 81 estats visuals (9 esquemes × 3 revelacions × 3 idiomes) en Chrome amb Flask/MQTT simulat; nodes del diagrama conservats, cap desbordament ni error JS, inici només disponible al tercer pas. Visor de revisió verificat sense iniciar cap puzzle. Prova: `output/briefings/verification.json`.


### 2026-10-05 — Pilot visual de Memory i Laberint

Autorització: provar una identitat comuna compacta als puzzles 8 i 2 abans d’estendre-la a la resta. Canvis a `game-theme.js`, `game-surface.css` i càrrega d’estils a `base.html`. No s’ha modificat lògica de puzzles, backend, MQTT ni sons funcionals.

La informació de fase de Memory es mou dins del seu contenidor mantenint IDs i controladors. El HUD de cantonades utilitza el progrés guanyat de `PyramidRun`. Validat amb estats simulats en dues resolucions, sense terminal físic.

### 2026-10-07 — Agenda, historial i sessions de prova al panel Test

Autorització: després de proposar agenda/historial, resum de resultats i persistència de sessions de prova al servidor, l’usuari demana «ok, haz los cambios». Una sola modalitat de prova, independentment de si el hardware està muntat.

- `app.py`: afegeix GET `/test/sessions` (agenda i historial amb ID actiu) i GET `/test/session/<id>` (metadades i temps de puzzles). Guardar/editar valida nom, empresa, data, hora, idioma i jugadors. Partides reals: 10–20; proves: 1–20 com a metadada, sense canviar la configuració dels terminals. Impedeix eliminar la sessió activa, canviar el tipus després d’iniciar-la o substituir una partida en curs per una altra.
- `telemetry/schema.py`: afegeix `session_type`, `game_master` i `observations` amb migració additiva de l’esquema vigent, versió 3. Les sessions existents es consideren reals. No incrementa la versió perquè el mecanisme existent de canvi de versió reconstrueix les taules. No s’ha executat la migració sobre la base real.
- `telemetry/writer.py`: persisteix els tres camps nous a sessions; conserva els arguments posicionals anteriors.
- `telemetry/queries.py`: retorna metadades i agenda completa; les estadístiques agregades de sessions, puzzles i esdeveniments exclouen proves. La consulta individual i l’agenda les mantenen visibles.
- Frontend: seleccionat i actiu són independents; crear prova emplena dades inicials, mostra MODO PRUEBA al GM i reutilitza els controls existents. Duplicar no copia observacions finals. Eliminar requereix confirmació i elimina també registres associats, com ja feia el backend.

Impacte/revisió per Pep: revisar la migració additiva, el filtratge de les estadístiques i les proteccions d’estat. Reiniciar el servidor és necessari per carregar rutes/camps nous. No es modifica MQTT, regles, timers ni validació de puzzles. Els resultats mostren temps registrats i tancament; no atribueixen automàticament errors, ajudes o èxit als registres sense aquesta informació.

Validació: quatre tests Python amb SQLite temporal (persistència, agregats, validació, proteccions i migració idempotent); revisió en Chrome sobre Flask aïllat amb dades temporals a 1920 × 1080 i 1280 × 720. Crear, activar, guardar una altra sessió sense sobreescriure l’activa, duplicar, cancel·lar/confirmar eliminació, validar i consultar historial/resultats. Fixtures reproduïbles a `tests/sessions_browser_fixture.py` i `tests/sessions_browser.cjs`. Captures a `output/revision-sesiones/`. Regressió completa: 33 tests Python i 11 fitxers de tests Node passats. Només simulació, sense terminals físics ni servidor real.


### 2026-10-08 — Organización de audios revertida; distribución por USB

Por petición del usuario se ha deshecho la separación en usados/no usados.
`mqtt/puzzles/puzzle2.py` y `mqtt/puzzles/puzzle4.py` recuperan exactamente sus
rutas originales (`/static/audios/effects/` y `AUDIO_SUBDIR = "audios/"`).
El cambio temporal de prefijos queda revertido; no permanece modificación de
backend frente a la versión anterior. Los archivos se conservan en sus subcarpetas
habituales bajo `static/audios/`, ignorada íntegramente y compartida por USB.

Validación: hashes conservados, rutas originales restauradas y pruebas aisladas
de intro, música de fondo y feedback. Sin servidor de producción, MQTT ni hardware.


### 2026-10-08 — El modo alarma de Tras la Serpiente no altera los símbolos visibles

Autorización: petición explícita del usuario para mantener los dibujos de las
serpientes y cambiar únicamente el símbolo MQTT esperado durante la alarma.

- `mqtt/puzzles/puzzle2.py`: los snapshots y el campo `sequences` de SSE devuelven
  siempre la secuencia original visible; `handle_message()` conserva el remapeo
  `alarmChanges` al validar el símbolo recibido por MQTT.
- `tests/test_puzzle2.py`: cubre que el símbolo visible no cambie, que se acepte
  el símbolo remapeado durante la alarma y que el símbolo original se rechace si
  su correspondencia MQTT difiere.

Impacto: corrige el contrato de estado enviado al frontend sin cambiar temas MQTT,
formato de mensajes ni la mecánica de validación de la alarma.

Validación: seis tests de `test_puzzle2` y `test_puzzle2_motion` pasados, incluidos
los checks de navegador para que los símbolos no cambien durante la alarma. Sin
broker MQTT ni terminales físicos.

Revisión backend: pendiente de validar con terminales físicos.

### 2026-10-09 — QUIZ: cerrar respuestas mientras se muestra el resultado

Autorización: el usuario confirma «ok de pep. hazlo» para corregir el punto 2
de la auditoría inicial.

- `mqtt/puzzles/puzzle3.py`: una respuesta conjunta completa conserva sus diez
  elecciones durante el resultado, también si falla. `handle_message()` ignora
  nuevas entradas mientras estén completas. La transición existente las vacía
  bajo el mismo lock antes de publicar la siguiente pregunta.
- Se mantienen los siete segundos de resultado, el contrato MQTT 1/5, la
  puntuación y la posibilidad de cambiar una elección antes de que contesten
  todos los terminales. Un fallo sigue pasando a otra pregunta del mismo nivel
  sin sumar progreso.
- `tests/test_puzzle3.py`: tres pruebas nuevas comprueban bloqueo tras fallo y
  acierto, ausencia de cambios de estado/eventos/avances duplicados durante el
  resultado, reapertura al publicar la siguiente pregunta y cambios de elección
  antes de la última respuesta.

Validación: la regresión de fallo reprodujo el acierto indebido antes del arreglo;
las ocho pruebas del QUIZ pasan después. Espera y creación de hilos simuladas,
ejecutando la transición real; sin servidor de producción, broker ni hardware.
No cambia la composición, colores, símbolos ni textos de las pantallas.

Impacto/revisión para Pep: comprobar con botones físicos que las pulsaciones
durante el resultado no alteran la puntuación y que la nueva pregunta acepta
respuestas. El servidor deberá cargar este código para aplicar la corrección.
La cancelación de tareas al detener y la recuperación de estados siguen siendo
los puntos 3 y 5 pendientes de la auditoría; no se dan por resueltos aquí.
