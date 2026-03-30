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

### mqtt/client.py

Archivo:

- [mqtt/client.py](./mqtt/client.py)

Estado del cambio:

- `detectado`

Partes observadas:

- funcion interna `_dispatch_message()`

Tipo:

- `detectado`

Observacion:

- el enrutado actual procesa cualquier payload `P*` que llegue por `TO_FLASK` aunque ese puzzle no sea el activo
- eso permite que mensajes de simulacion o hardware modifiquen estado de puzzles inactivos
- el efecto es especialmente delicado si `/test/send` se usa en paralelo con una partida real o con otra pantalla abierta

No modificado:

- no se ha cambiado codigo en este archivo durante esta revision
- solo se deja constancia para revision de contrato entre broker, simulador y puzzle activo

Motivo de anotacion:

- evitar que un puzzle acumule progreso o eventos fuera de su turno
- confirmar si backend quiere filtrar por `current_puzzle_id` antes de delegar `handle_message()`

Revision backend:

- alta

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
