# Idioma y preparación de la sesión

## Uso del Game Master

En `/test` → **Sesiones**, preparar nombre del grupo, empresa, fecha y hora,
lugar, número de jugadores, idioma y notas. Idiomas disponibles: **Català**,
**Castellano** y **English**.

**Guardar sesión** conserva un borrador. **Confirmar sesión** guarda los campos
visibles en el servidor y después activa esa sesión. También funciona con una
sesión nueva; ya no exige guardarla primero. Si falla el guardado, no confirma.
Durante la operación se bloquea la edición para evitar cambios concurrentes.

El resumen y la lista de sesiones muestran el idioma. La pantalla de jugadores
usa el idioma confirmado al abrir bienvenida, intro, explicaciones, juegos y
cierre, incluidos los accesos directos. El selector del control muestra el idioma
de la sesión y es informativo; cambiarlo se hace desde **Sesiones**. El visor
independiente de ensayo conserva su selección de idioma.

La interfaz del GM mantiene su idioma propio. Elegir inglés para los jugadores
no traduce el panel administrativo. El cierre sigue finalizando la sesión mediante
el backend existente. Crear una nueva sesión para el siguiente grupo.

## Contrato compartido

`static/js/game-language.js` centraliza:

- Códigos `ca`, `es`, `eng`, compatibles con los campos actuales de la sesión y QUIZ.
- Alias históricos `cat`, `esp`, `en`, sin distinguir mayúsculas o espacios.
- `eng` se expresa como `en` en el atributo HTML `lang`.
- `PyramidLanguage.path(ruta, idioma)` añade o sustituye `lang` en rutas locales.
- `PyramidLanguage.set(idioma)` selecciona el idioma de la pantalla actual.
- `PyramidLanguage.t(clave, textoActual, valores)` obtiene una traducción y
  sustituye variables como `{count}`. Las entradas ausentes conservan `textoActual`.
- `PyramidLanguage.apply(contenedor)` aplica claves declaradas en el HTML.

`presentation-gm.js` toma el idioma de `PyramidTest.session()` al abrir rutas.
`game-shell.js` lo conserva entre cargas de páginas. Presentaciones, títulos de
puzzles y transiciones utilizan sus catálogos existentes. Los IDs, el orden y los
mensajes MQTT no dependen del idioma.

Se reutilizan las APIs de sesiones, el campo `language` de la base de datos y la
selección de preguntas del QUIZ ya existentes. No se ha modificado el backend.

## Estado de las traducciones

Implementado el 7 octubre 2026, después de confirmar el castellano: versión
catalana de las presentaciones, pantallas de juego y mensajes dinámicos de los
doce puzzles, incluidos los tres de reserva. El catalán utiliza el mismo diseño,
reglas y orden de acciones que el castellano aprobado. **Pendiente:** la traducción
completa del inglés, su voz y las locuciones que aún no existen.

`static/js/game-copy.js` contiene los diccionarios `ca`, `es`, `eng` del espacio
`game`. El catálogo catalán cubre los textos estáticos, los mensajes dinámicos,
las ayudas de accesibilidad y las variables de las pantallas. Entre sus claves están `timeRemaining`,
`firstPhase`, `phaseCleared`, `levelCompleted`, `practiceCompleted` y
`pyramidCompleted`. Su ausencia conserva el texto actual de las plantillas.

Para textos estáticos usar `data-i18n="game.clave"` sobre un nodo de texto
independiente. Para accesibilidad y ayudas existen `data-i18n-aria-label`,
`data-i18n-title`, `data-i18n-placeholder` y `data-i18n-alt`. No aplicar `data-i18n` a un contenedor
con números, símbolos, botones o nodos que actualizan los scripts: sustituye su
texto y eliminaría esos hijos.

Para mensajes dinámicos llamar a `t()` al generar el mensaje; no traducir
buscando frases dentro de un tablero ni alterar códigos de estados o respuestas.
Al insertar nodos nuevos, llamar a `apply()` sobre ese contenedor si contienen
claves declaradas. Mantener los mismos identificadores en los tres diccionarios.

Los catálogos de `presentation-story.js`, `presentation-flow.js` y
`puzzle-names.js` mantienen la introducción grabada y completan los contenidos
catalanes de las explicaciones, incluido el nombre «Memòria Extrema». Las preguntas del QUIZ se
seleccionan en el backend según la sesión y no se incluyen en el diccionario de UI.

## Comprobación

Tests de normalización, traducciones ausentes, variables, rutas y confirmación
tras persistir los cambios. Revisión con plantillas reales y sesiones simuladas,
sin MQTT ni hardware, a 1920 × 1080 y 1280 × 720. Resultados en
`output/idiomas-sesion/`. Pendiente la validación de la partida con terminales
reales. La revisión catalana de pantallas y textos
a ambas resoluciones está en `output/revision-catalan/`. Se comprueban también
las diez instrucciones del simulacro y la distribución de las 145 preguntas
existentes de los tres bancos catalanes del QUIZ. Los bancos, las soluciones,
el motor y MQTT no se modifican.

La primera intro dispone de locución catalana (`static/audios/intro/intro-ca.mp3`),
subtítulos y escenas sincronizados con el audio. Al elegir Català se utiliza
automáticamente. Las locuciones castellana e inglesa aún están pendientes.

El cierre también tiene locución catalana (`static/audios/intro/final-ca.mp3`)
y subtítulos con el guion aprobado en `docs/audio/cierre-final-ca.txt`.
Tras diez segundos de carga, la voz guía el montaje hasta su final natural y
la foto «AQUEST MOMENT ÉS VOSTRE». Pausa y repetición incluyen la locución.
El castellano mantiene su montaje provisional y el inglés su cierre anterior.

## Agenda y pruebas del Game Master

En Sesiones, **Crear sesión real** abre un borrador con la fecha actual.
**Crear sesión de prueba** añade nombre y empresa de prueba y diez jugadores
como valor inicial. Se puede elegir idioma y ajustar jugadores (1–20 en pruebas;
10–20 en partidas reales). Estas cifras son datos de la sesión y no reconfiguran
los terminales. Hay una única modalidad de prueba, con o sin hardware montado.

**Guardar cambios** conserva los datos en el servidor. **Usar esta sesión** la
prepara como sesión activa; **Abrir partida** usa el flujo de apertura existente.
El GM muestra **MODO PRUEBA** cuando la activa es una prueba. Una prueba sigue
el mismo recorrido e idioma que una partida real, con los controles de resolución
y repetición habituales, y queda excluida de las estadísticas reales.

La agenda diferencia pendiente, preparada, en curso y finalizada. **Historial**
recupera las finalizadas; los filtros permiten buscar por nombre, empresa, lugar,
tipo y fecha. Seleccionar un registro para editarlo no cambia la sesión activa.
Se pueden guardar GM responsable, notas de preparación y observaciones finales.
Los resultados muestran los tiempos disponibles por reto y el tiempo total;
«Cerrado» indica cierre registrado, sin deducir automáticamente cómo se resolvió.
Duplicar crea una sesión nueva sin resultados ni observaciones finales.
Eliminar exige confirmación y borra los registros asociados; la activa se protege.
