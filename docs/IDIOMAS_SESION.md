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

## Preparación para las traducciones finales

Implementado: selección y propagación del idioma, catálogos existentes de nombres
e intros y una base para incorporar los textos restantes. **Pendiente:** traducir
todos los textos de los puzzles, sus mensajes dinámicos y revisar contenidos del
QUIZ y archivos de voz por idioma. No describir esta preparación como una
traducción completa de la partida.

`static/js/game-copy.js` contiene los diccionarios `ca`, `es`, `eng` del espacio
`game`, aún vacíos. Las primeras claves preparadas son `timeRemaining`,
`firstPhase`, `phaseCleared`, `levelCompleted`, `practiceCompleted` y
`pyramidCompleted`. Su ausencia conserva el texto actual de las plantillas.

Para textos estáticos usar `data-i18n="game.clave"` sobre un nodo de texto
independiente. Para accesibilidad y ayudas existen `data-i18n-aria-label`,
`data-i18n-title` y `data-i18n-placeholder`. No aplicar `data-i18n` a un contenedor
con números, símbolos, botones o nodos que actualizan los scripts: sustituye su
texto y eliminaría esos hijos.

Para mensajes dinámicos llamar a `t()` al generar el mensaje; no traducir
buscando frases dentro de un tablero ni alterar códigos de estados o respuestas.
Al insertar nodos nuevos, llamar a `apply()` sobre ese contenedor si contienen
claves declaradas. Mantener los mismos identificadores en los tres diccionarios.

Los catálogos de `presentation-story.js`, `presentation-flow.js` y
`puzzle-names.js` conservan sus traducciones actuales. Las preguntas del QUIZ se
seleccionan en el backend según la sesión y no se incluyen en el diccionario de UI.

## Comprobación

Tests de normalización, traducciones ausentes, variables, rutas y confirmación
tras persistir los cambios. Revisión con plantillas reales y sesiones simuladas,
sin MQTT ni hardware, a 1920 × 1080 y 1280 × 720. Resultados en
`output/idiomas-sesion/`. Pendiente la partida con terminales y la revisión de
legibilidad de las traducciones completas cuando se incorporen.

La primera intro dispone de locución catalana (`static/audios/intro/intro-ca.mp3`),
subtítulos y escenas sincronizados con el audio. Al elegir Català se utiliza
automáticamente. Las locuciones castellana e inglesa aún están pendientes.
