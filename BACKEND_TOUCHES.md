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
