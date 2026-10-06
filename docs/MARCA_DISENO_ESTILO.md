# Guía de marca diseño y estilo de La Piràmide

Referencia editorial vigente del proyecto. Última actualización: **6 octubre
2026**. Recoge las decisiones del equipo, la información publicada y la revisión
de recursos gráficos. Leer antes de editar, como establece [AGENTS.md](../AGENTS.md).

Esta guía sirve a diseño, frontend, marketing y Game Master. Mantiene una identidad
común sin congelar las mecánicas, rondas o textos que todavía están evolucionando.

## Cómo interpretar las decisiones

- **Acordado:** dirección expresada por el usuario y decisiones aceptadas.
- **Implementado:** comportamiento comprobado en el proyecto, no necesariamente
  validado todavía con hardware o público real.
- **Piloto:** aplicación parcial que requiere validación antes de extenderse.
- **Criterio editorial:** norma de trabajo de esta guía; no implica que todos los
  recursos existentes ya la cumplan.
- **Pendiente:** trabajo por realizar. No describirlo como una prestación disponible.

El usuario puede cambiar estas decisiones. Registrar aquí el cambio y su alcance.
Los documentos `output/marca/La-Piramide-guia-de-marca-*.docx` y `.pdf` son versiones
históricas de consulta. No recuperar automáticamente sus recursos descartados.

## Producto y posicionamiento

La Piràmide es un juego cooperativo de gran formato: **10 a 20 jugadores, diez
terminales y una pantalla compartida**, con un Game Master que conduce la sesión.
Todo el grupo trabaja hacia una misión común. Puede haber tiempo, puntuación y
retos individuales; el resultado que protagoniza la experiencia es colectivo.

Cada persona o pareja utiliza un token intransferible. La información y las
acciones están repartidas: el grupo necesita comunicarse y coordinarse. La
comunicación comercial debe explicar esa aportación de cada participante.

Se monta en empresas o salas de eventos. La iluminación DMX puede acompañar el
montaje. Mostrar el equipamiento real y el juego compartido. Evitar hologramas,
decorados monumentales o salas futuristas que el servicio no proporciona.

La oferta publicada indica 60–80 minutos, contratación bajo petición y participación
sin experiencia previa. Puede estudiarse personalización con presupuesto aparte.
Estos datos comerciales se revisan antes de publicar; no determinan los tiempos
internos de cada puzzle. Mantener precios y condiciones en propuestas comerciales,
no en constantes de diseño. No prometer mejoras cuantificadas de productividad o
cohesión sin evidencia.

### Nombre e idiomas

- Castellano: **La Pirámide**.
- Catalán: **La Piràmide**.
- Inglés: **The Pyramid**.

Seguir los nombres de la web en piezas comerciales localizadas. Los recursos
actuales del juego usan principalmente la denominación catalana. Preparar variantes
del rótulo sin cambiar el símbolo ni mezclar idiomas dentro de una pantalla.

Fuentes: [página comercial](https://www.enigmik.com/escaperoom/la-piramide/),
[versión catalana](https://www.enigmik.com/ca/escaperoom/la-piramide/) y
[versión inglesa](https://www.enigmik.com/en/escaperoom/pyramid/).
Información consultada mediante contenido indexado el 5 octubre 2026; el lector
no pudo abrir directamente la página. Separar la oferta publicada del rediseño.

## Nombres editoriales de las pruebas

Acordado e implementado el 6 octubre 2026: recuperar los nombres históricos con
las sustituciones **Tras la Serpiente**, **QUIZ** y **Conexión Simultánea**.
El nombre editorial aparece en la intro, la cabecera del puzzle, las transiciones
y los controles del GM. Las versiones catalanas e inglesas conservan el significado.

| ID | Mecánica / alias técnico | Castellano | Catalán | Inglés |
| --- | --- | --- | --- | --- |
| 11 | Práctica / simulacro | Simulacro Inicial | Simulacre Inicial | Initial Simulation |
| 2 | Serpientes / laberinto | Tras la Serpiente | Rere la Serp | Follow the Snake |
| 1 | Sumas | Cálculo Extremo | Càlcul Extrem | Extreme Calculation |
| 8 | Memory | Memoria Fantasma | Memòria Fantasma | Ghost Memory |
| 3 | Trivial | QUIZ | QUIZ | QUIZ |
| 5 | Cronómetro | Pulso de Tiempo | Pols del Temps | Pulse of Time |
| 12 | Botones | Conexión Simultánea | Connexió Simultània | Simultaneous Connection |
| 4 | Música | Código Sonoro | Codi Sonor | Sound Code |
| 6 | Energía / final | Carga Final | Càrrega Final | Final Charge |
| 9 | Token a lloc, fuera del recorrido | Arquitectos del Orden | Arquitectes de l’Ordre | Architects of Order |
| 10 | Segmentos, fuera del recorrido | Patrón Maestro | Patró Mestre | Master Pattern |
| 7 | Segmentos difícil, fuera del recorrido | Segmentos avanzados | Segments avançats | Advanced Segments |

La prueba 7 conserva su denominación descriptiva: no se ha acordado un nombre
creativo nuevo para ella. Catálogo único de implementación:
`static/js/puzzle-names.js`. Los IDs, `PUZZLE_ALIASES`, rutas, carpetas y mensajes
MQTT mantienen sus identificadores técnicos; no usar los nombres editoriales
para construir rutas ni comandos. Las pruebas 7, 9 y 10 no se añaden al recorrido.

La explicación de Tras la Serpiente muestra una cabeza con el número del token
y cinco formas en orden. El equipo busca cada forma en los terminales y pasa el
token para completar la serpiente. Se mantiene la correspondencia de alarma.
Se sustituye la explicación antigua de entradas y centro de un laberinto.

Validación de los nombres: intros disponibles y cabeceras de los doce puzzles
revisadas en castellano, catalán e inglés, a 1920 × 1080 y 1280 × 720.
Fixtures aislados con plantillas reales; no se ejecutan los scripts que inician
hardware. Catálogo y flujo comprobados con tests; controles del GM y rutas de
presentación verificados. Solo simulación, pendiente lectura desde la sala.
Capturas y resultados: `output/nombres/`.

## Personalidad y lenguaje

Cooperativa, enérgica, clara y apropiada para empresas. Debe parecer un juego
atractivo, no una herramienta administrativa. La tecnología apoya la acción.

- Hablar al equipo con verbos concretos: observad, buscad, coordinad, pulsad.
- Una instrucción principal por momento. El GM explica los detalles.
- Separar estado de acción: «Esperando al equipo» no significa «Pulsad para empezar».
- Evitar culpar al jugador. Explicar el estado y la acción posible.
- No añadir reintentos, penalizaciones o límites que la mecánica no contemple.
- Eliminar a Cero de la narrativa nueva.
- Comprobar castellano, catalán e inglés con el mismo significado y sin desbordes.

Referencias de tono, sujetas a las reglas de cada juego:

| Momento | Ejemplo |
| --- | --- |
| Campaña | El reto es de todos |
| Descriptor | Juego colaborativo para empresas |
| Dato de producto | 10–20 jugadores · 10 terminales · Un único equipo |
| Acción comercial | Solicitar propuesta |
| Memory | Observad las fichas y recordad su información |
| Logro | Reto superado. La pirámide sigue creciendo |
| Cierre | Lo habéis conseguido juntos |

## Identidad visual

Fondo oscuro grafito, texto blanco cálido y acentos cian y magenta. Titulares
contundentes y una pirámide de bloques reconocible. Marketing y pantallas comparten
la misma familia. La espectacularidad se concentra en momentos de apertura y logro;
durante el puzzle manda la lectura del tablero.

### Pirámide

Maestro: [`static/branding/piramide-vector.svg`](../static/branding/piramide-vector.svg).
Componente: [`static/js/pyramid-logo.js`](../static/js/pyramid-logo.js).

- Escalar proporcionalmente; no recortar cúspide ni deformar base.
- Reservar alrededor al menos la altura de un bloque como criterio de partida.
- Reducir brillo y detalle cuando sea pequeña. Validar el mínimo en cada soporte.
- Mantener estructura y bloques. Sus estados pueden representar progreso.
- No asociar cada ladrillo a una persona ni a un terminal sin una regla explícita.
- La pirámide se usa para identidad, progreso y celebración; no encerrar cada
  aviso o elemento de juego en otro triángulo.
- El logo PNG antiguo se retiró de `static/`; las pantallas utilizan el SVG maestro. Las maquetas históricas conservan su copia en `output/legacy-assets/`.
- `static/images/shared/branding/logo_adn.png` se reserva para firma del organizador
  donde corresponda. No sustituye al logo del juego. La relación visual entre
  Enigmik, ADN y el producto requiere definir un cierre gráfico coherente.
- Una variante monocroma definitiva para impresión sigue pendiente.

### Paleta

| Papel | HEX | Uso |
| --- | --- | --- |
| Grafito | `#0A1016` | Fondo principal |
| Blanco cálido | `#F3EEE4` | Texto y cifras |
| Cian | `#39D6E5` | Identidad y foco |
| Magenta | `#DC68A7` | Acento complementario |
| Ámbar | `#EDB970` | Atención temporal y culminación |
| Menta | `#71E7DB` | Confirmación o logro |
| Rojo | `#F15C68` | Error o alarma |
| Panel | `#14232C` | Agrupación funcional |
| Texto secundario | `#A8BBC5` | Apoyo no crítico |

La paleta de marca no sustituye los colores funcionales de fichas, botones y
señales. Acompañar estados con texto, forma o símbolo. Contornear las fichas negras
sobre fondos oscuros. Consolidar variaciones existentes en variables compartidas
al migrar cada pantalla; no recolorear el juego de forma indiscriminada.

### Identidad de la etapa QUIZ

Acordado e implementado el 6 octubre 2026: magenta `#DC68A7` como acento principal
de la presentación y el puzzle del QUIZ, sobre grafito `#0A1016` y paneles
`#14232C`. Preguntas y respuestas neutras en blanco cálido `#F3EEE4`; texto de
apoyo `#A8BBC5`. El magenta identifica la etapa en títulos, números neutros,
bordes y revelados; no expresa una respuesta ni un resultado.

Se conservan los colores funcionales existentes de botones verde/rojo,
respuestas sí/no, acierto/fallo, estados contestados y logros. Las imágenes del
terminal y sus botones no se recolorean. La variante está acotada al puzzle 3
en `static/css/trivial-theme.css`; el mapa general mantiene sus otras etapas.

Jerarquía del QUIZ, acordada e implementada el 6 octubre 2026: reducir 8 px el
tamaño calculado de las respuestas (cuatro ajustes de 2 px), sin cambiar el tamaño
de los números. Destacar la pregunta con mayor peso
tipográfico, una barra lateral magenta y un fondo magenta tenue; conservar el
texto blanco cálido y los colores funcionales de las respuestas.

Verificación con fixtures aislados: intro en castellano, catalán e inglés y
puzzle con estados neutro/verde/rojo/acierto/fallo a 1920 × 1080 y 1280 × 720.
Colores funcionales del puzzle comparados antes/después, sin cambios. Solo
simulación, sin MQTT ni hardware; revisión desde la sala pendiente.
Capturas y resultados: `output/recorrido/trivial-*`.

### Tipografía

- Titulares: `PiramideDisplay`, alias de **Noto Sans ExtraCondensed Black**.
- Archivo: `static/fonts/PiramideDisplay-Black.ttf`.
- Instrucciones, párrafos y controles: Arial o alternativa equivalente validada.
- Conservar `PiramideDisplay-LICENSE.txt` y su aviso SIL Open Font License 1.1.
- Orbitron se retiró de las pantallas y de `static/fonts/`. Los controles y datos usan Arial; los titulares comunes usan PiramideDisplay.
- Reservar mayúsculas y tipografía condensada para textos breves.
- Temporizadores con cifras de anchura estable.

## Pantalla compartida y composición

Referencia **1920 × 1080, 16:9**, comprobada también a **1280 × 720**. Diseñar para
10–20 personas a distancia, no solo para alguien sentado delante del ordenador.

1. Elemento que hay que observar o manipular.
2. Acción vigente.
3. Estado secundario.

Ejemplos actuales a 1080p: título de presentación 96 px; objetivo 35 px;
instrucción de Memory y nombre compacto 33 px; metadatos 17–23 px. Son referencias,
no mínimos de legibilidad garantizados. Ninguna pista crítica debe relegarse a
texto diminuto. Validar desde la última fila con la iluminación real.

Bordes discretos, radios pequeños y agrupación por proximidad. Las diagonales y
bloques tienen más protagonismo en marketing y presentaciones. Evitar marcos
ornamentales, paneles redundantes y animaciones continuas sobre el tablero.

## Recorrido y presentaciones

1. **Bienvenida en espera:** imagen estable hasta orden del GM, con el grupo colocado.
2. **Apertura:** secuencia automática seguida, transiciones suaves, sensación de
   vídeo. El GM no explica durante esta secuencia.
3. **Práctica:** familiarización, sin sumar un reto a la pirámide.
4. **Presentación del puzzle:** composición persistente con tres revelados del GM.
5. **Cuenta atrás e inicio:** orden explícita cuando se ha entendido el reto.
6. **Juego:** máxima superficie útil y estado funcional visible.
7. **Logro:** actualizar la pirámide por un reto realmente conseguido; el GM prepara
   el siguiente. Navegar o previsualizar no otorga progreso.
8. **Final y foto:** celebración y composición estable para el grupo.

Recorrido actual de referencia: Simulacro Inicial 11 → Tras la Serpiente 2 →
Cálculo Extremo 1 → Memoria Fantasma 8 → QUIZ 3 → Pulso de Tiempo 5 →
Conexión Simultánea 12 → Código Sonoro 4 → Carga Final 6 → cierre.
Ocho retos puntuables; Segmentos 10 queda fuera del recorrido activo. Consultar
`config.py` y el flujo antes de cambiar el orden. El progreso actual no debe
suponerse persistente entre ventanas o reinicios sin comprobarlo.

Acordado: el QUIZ constituye una etapa central entre dos bloques de retos,
con tres pruebas por bloque como configuración inicial, sin exigir esa cantidad.
Implementado en `config.py`: `PUZZLE_PRE_TRIVIAL`, `PUZZLE_TRIVIAL` y
`PUZZLE_POST_TRIVIAL` generan la lista completa `PUZZLE_ORDER`, que conserva el
contrato de navegación y MQTT. El Trivial sigue contando como reto puntuable.
Implementado: diagrama común en la apertura automática y como primer paso manual
de la presentación del QUIZ. Muestra práctica → primer bloque → QUIZ →
segundo bloque → final, con cantidades y casillas derivadas de `PUZZLE_ORDER`.
«Estáis aquí» identifica la etapa. Decisión actualizada el 6 octubre 2026: en la
intro del QUIZ el mapa presenta las pruebas del primer bloque como superadas
y las del segundo bloque pendientes, también al abrir directamente la intro.
Es un esquema explicativo de esa etapa; no modifica los logros registrados,
la puntuación ni el progreso real de la pirámide. La apertura muestra todos los
retos pendientes. La nueva apertura revela el mapa en varios momentos del guion
y permite pausar o repetir.

Explicación del GM al llegar al Trivial: «Ahora llega el QUIZ: compartid lo que
sabéis y decidid juntos. Después vendrá el segundo bloque de retos y el final».
Esta nota aparece en el control de presentación. A continuación siguen los tres
revelados habituales: objetivo, terminales y tokens, interacción. La cuenta atrás
solo se habilita después de la interacción, también con el nuevo paso de recorrido.

Verificado el 6 octubre 2026: Chrome con fixtures aislados, tres idiomas a
1920 × 1080 y 1280 × 720; bloques vacíos/desiguales, progreso parcial y retorno
desde las reglas al mapa. Solo simulación; legibilidad desde la sala y ritmo con
público pendientes. Capturas y comprobaciones: `output/recorrido/`.

### Apertura narrativa: Despertar la Pirámide

Decisión actualizada e implementada el 6 octubre 2026: la narración aprobada lleva
la historia y la pantalla sirve de apoyo visual. Se sustituye la apertura de seis
pantallas con párrafos. Se retiran la insistencia en «conectar» y las instrucciones
«caminad sin correr, dejad paso». **Los tokens se reparten al terminar la intro,
antes de explicar el Simulacro Inicial**, uno por persona o pareja.

La energía de la Pirámide está repartida entre diez terminales. Recuperarla exige
poner en común las aportaciones: una pista encontrada por alguien cobra sentido
gracias a otra persona. Escuchar, hacer sitio a otras ideas y repartirse las tareas
forman parte de la historia. No se prometen resultados empresariales medibles.

Implementado: 16 momentos visuales y una pantalla final de espera. La Pirámide
aparece en silencio; se descubre la energía en los terminales. Las escenas sobre
compartir y escuchar utilizan luz sobre la Pirámide maestra: primero un lateral,
después el otro, un recorrido suave y una iluminación estable. Aparecen los
titulares «Cada mirada cuenta» y «Todas las voces cuentan», sincronizados con la voz. Siguen habilidades, búsqueda y herramientas. El mapa
revela práctica y primer bloque, QUIZ magenta, segundo bloque y Carga Final; después
vuelve a señalar el inicio. Aparecen el token y el pulso final de la Pirámide.

- Solo titulares breves donde ayudan. Sin párrafos, consignas repetidas, firma
  permanente ni contador de escena en la pantalla de jugadores.
- Se reservan **y=880–1080 del canvas 1920 × 1080** para subtítulos de un máximo
  de dos líneas. El guion aparece por frases temporizadas en castellano, catalán
  e inglés, a 40 px y con márgenes laterales amplios. Ningún gráfico invade la banda.
  El fondo grafito y su iluminación son continuos hasta el borde inferior, sin
  una franja oscura propia para los subtítulos.
  Los subtítulos se detienen con la pausa, se reinician al navegar y desaparecen
  durante el reparto de tokens. Las instrucciones del GM no se subtitulan.
- Retirados los diagramas de pistas y las ilustraciones de personas, rechazados
  por falta de claridad y de coherencia visual, respectivamente.
  Los objetos reales usan el catálogo autorizado; botones y símbolos se conservan.
- El encendido de un bloque es un anticipo breve y desaparece. No registra logros;
  el mapa de apertura mantiene todos los retos pendientes.
- El mapa deriva de `PUZZLE_ORDER`; admite bloques vacíos/desiguales. Si no hay
  QUIZ en la configuración se omite su momento de la apertura y del mapa.
- Al final, **la apertura se detiene en el reparto de tokens**. El GM avanza con
  «Tokens repartidos · explicar el simulacro». La práctica y su cuenta atrás
  mantienen el control manual.
- Pausa, anterior/siguiente y repetición siguen disponibles. El idioma se elige
  en Sesiones. La pausa
  congela las animaciones y música; movimiento reducido presenta composiciones
  estables. En habilidades muestra las cuatro juntas. La espera final es estable.

**Implementado en catalán:** locución aportada por el equipo, conservada sin cambios
como `static/audios/intro/intro-ca.mp3`. Dura 115,5 segundos y gobierna los cues,
las animaciones y el avance de escenas. Pausa, navegación y repetición actúan
sobre la voz y la pantalla juntas. La música baja durante la locución. En producción, la pista persistente
recupera el volumen bajo al llegar al reparto de tokens; la voz ya ha terminado. Tras el final natural de la voz, la Pirámide
permanece 2,6 segundos mientras la música se desvanece; el MP3 no se modifica ni
se corta la última frase. Pausar también congela este cierre. Si el navegador bloquea el audio, la intro
se pausa y ofrece «Activar so», con aviso al GM. Sin QUIZ se salta también su voz.

**Pendiente:** voces de castellano e inglés y narración del cierre. Esos idiomas
mantienen los 169 segundos provisionales para ensayar. El guion completo sigue
disponible en las notas del GM, momento por momento.

Fuente del guion: `static/js/presentation-story.js`. Tiempos reales y cues catalanes:
`static/js/presentation-recordings.js`; exportación `static/audios/intro/intro-ca.vtt`.
Visuales: `static/js/presentation-opening.js` y `static/css/presentation-opening.css`.
La banda conserva dos líneas como máximo y queda vacía en las pausas y el reparto.
Corrección de dirección visual: el usuario ha rechazado los trazados de pistas y
las ilustraciones de personas. Ambos se retiran de las tres escenas de cooperación.
Dirección aprobada e implementada: luz sobre la Pirámide original en las tres
escenas, sin modificar bloques ni otorgar progreso. La primera luz acompaña la
pista de una persona; la segunda acompaña la aportación de otra. En «Cada mirada
cuenta» la luz recorre el conjunto y se estabiliza al hablar de escuchar. El titular
aparece entonces. En «Todas las voces cuentan» la Pirámide se atenúa al hacer
sitio a otras ideas y el titular se mantiene durante la última frase. Catalán:
«CADA MIRADA COMPTA» y «TOTES LES VEUS COMPTEN»; inglés: «EVERY PERSPECTIVE
COUNTS» y «EVERY VOICE COUNTS». Los tiempos salen de los cues de la narración,
con pausa y navegación sincronizadas. Movimiento reducido mantiene una composición
estable. Verificación a dos resoluciones y tres idiomas en `output/intro-luces/`.
Las ilustraciones descartadas quedan archivadas en `output/intro-personas/descartadas/`,
sin referencias en el juego.
Guion de producción: [APERTURA_NARRATIVA.md](APERTURA_NARRATIVA.md).
La versión catalana está revisada para locución y recogida íntegramente en ese
documento. «Català» en Sesiones selecciona títulos, recorrido, subtítulos y notas
de la apertura; la indicación de reparto pasa a «Tokens repartits · explicar el
simulacre». Se conserva «token» como nombre del objeto usado durante el juego.

Verificado en Chrome con fixtures aislados: 17 estados × tres idiomas × dos
resoluciones (1920 × 1080 y 1280 × 720), todos los cues de subtítulos, bloques
vacíos/desiguales, recorrido sin QUIZ y movimiento reducido. Sin desbordes ni
imágenes ausentes. Pausa/reanudación de animación y música, navegación, idioma,
mapa progresivo y espera final comprobados en tiempo real; secuencia automática
completa comprobada acelerando solo los tiempos del fixture. El GM debe avanzar
para llegar a la práctica; no se inician juegos ni se otorgan logros desde la intro.
Tests de rutas, flujo y controles correctos. **Solo simulación, sin MQTT ni
hardware**. La locución catalana se ha comprobado con su reloj real: controles,
final natural, recorrido sin QUIZ y recuperación de sonido bloqueado. Revisión
de 17 escenas a dos resoluciones en `output/intro-ca-audio/`. Pendiente ensayo
con altavoces en la sala. Resultados y capturas del montaje anterior:
`output/apertura-narrativa/`; `output/apertura/` documenta la versión sustituida.

### Tres revelados dentro de una única composición

1. Objetivo y elementos de la pantalla compartida.
2. Terminales, token y herramientas.
3. Interacción y coordinación entre participantes.

Mantener en su sitio lo que ya apareció. El GM avanza, retrocede y repite. No poner
toda la explicación de golpe ni añadir un tutorial de «ejemplo en acción».
Los números ilustrativos muestran relaciones; no revelan soluciones de la partida.

### Sonido y movimiento

Minimizar narraciones entre puzzles: explica el GM. La apertura tiene locución
catalana y subtítulos temporizados; las voces de los demás idiomas y la narración
del cierre siguen pendientes. El audio de las mecánicas se conserva.

Recuperada la música de fondo histórica: `static/audios/musica_ambient/musica_piramide.mp3`.
Un único reproductor en la ventana exterior de jugadores (`bgm_layer.js`) continúa
al cambiar de HTML, durante bienvenida, explicaciones, juegos y transiciones.
Volumen habitual 0,22; 0,06 durante la voz catalana, 0,14 en el ensayo sin voz y
0,10 durante el reparto. Pausar la intro pausa también la pista; su cierre mantiene
el fundido de 2,6 segundos y después recupera el fondo bajo. No se superpone un
segundo reproductor de música de la intro. Código Sonoro (4) silencia el fondo,
incluida su explicación, y el siguiente momento lo recupera sin reiniciar la pista.
Comprobación con rutas reales en fixture aislado y MQTT simulado: continuidad,
volúmenes, pausa y ausencia de duplicación en `output/musica-fondo/`. Pendiente
validar niveles con altavoces en sala.

El sistema antiguo de escenas JSON, su generador, los vídeos de Cero y las
locuciones antiguas se retiraron del proyecto el 5 de octubre de 2026.
El recorrido vigente utiliza HTML y JavaScript. Las nuevas voces se producirán
para ese recorrido. Registro: [limpieza del proyecto](LIMPIEZA_PROYECTO.md).

El diseño integrado de Sumas está aprobado como base de trabajo. Su piloto
independiente se retiró; los datos de presentación están en `presentation-flow.js`
y el ensayo utiliza el esquema vigente, igual que el resto de los puzzles.

Animar para revelar, señalar cambios y celebrar. Detener el movimiento durante
lectura y resolución. Evitar destellos rápidos y respetar movimiento reducido.
Los tiempos se validan con una sesión, no como una norma eterna de marca.

## Superficie común de los puzzles

Cabecera compacta aprobada y aplicada a los doce HTML de puzzles, incluida la
práctica y las pruebas fuera del recorrido. Memory y Laberinto conservan además
su superficie piloto. La revisión individual de cada tablero sigue pendiente.

- Esquina superior izquierda: solo el nombre editorial del puzzle.
- Esquina superior derecha: solo la pirámide compacta, con los bloques de los
  retos realmente superados pintados; sin contador numérico ni texto de progreso.
- Centro superior: solo información funcional que el puzzle requiera.
- Tablero: ocupar casi toda la pantalla. No recuperar la gran cabecera anterior.
- Mantener disposición y señales particulares de cada mecánica.

Decisión actualizada e implementada el 6 octubre 2026: retirar número/posición de
reto y contadores de rondas/preguntas de las pantallas de juego. Los nodos que
actualizan los scripts se conservan ocultos para no modificar su funcionamiento.
Memory conserva el título de fase, las instrucciones y el tiempo; se oculta su
etiqueta «Paso X de 3». Se mantienen los tiempos, objetivos, errores y pistas que
sirven para resolver las pruebas. El GM conserva sus datos de conducción.

Verificado con las doce plantillas en fixtures aislados a 1920 × 1080 y
1280 × 720: cabeceras sin número de reto ni contador de rondas, pirámide presente
con progreso pintado simulado y sin cifras visibles. Solo simulación; sin hardware.
Capturas y resultados: `output/cabeceras/`.

Memory conserva su cuadrícula de diez fichas y su jerarquía de fase e instrucción.
Laberinto usa el tablero actual de secuencias móviles; no recuperar automáticamente
los antiguos mapas fijos. Los colores de alarma mantienen su función.

Serpientes del puzzle 2, ampliadas por petición del usuario el 6 octubre 2026:
cabezas de 64 px, símbolos de 54 px y números de 34 px en el lienzo base,
con celdas de movimiento de 72 px. Aumento aproximado del 50 %, conservando
símbolos y secuencias.
Velocidad visual fija: 200 px lógicos por segundo (una celda cada 360 ms),
escalada proporcionalmente con el lienzo completo. Interpolación por tiempo,
independiente de la resolución y frecuencia de refresco; sin aceleración para
recuperar pasos perdidos al volver a una pestaña. Redimensionar no reinicia las
posiciones de las serpientes. Este ajuste reduce la velocidad anterior.
Velocidad comprobada con reloj simulado a 30, 60 y 144 Hz, en las dos
resoluciones de referencia, incluyendo pausas, redimensionado y cruces de error.
Cabezas en blanco cálido `#F3EEE4` con números grafito
`#0A1016` en estado normal, por petición del usuario; conservar el rojo de alarma
cuando suena la sirena. Cada casilla completada se marca con fondo y borde verde
`#2DFF9B` (menos azulado, ajustado por petición del usuario); la siguiente casilla pendiente se destaca con borde ámbar
`#EDB970`, brillo estático y un leve aumento de tamaño. Conservar estos estados
durante la alarma, sin recolorear los símbolos ni alterar su correspondencia.
Al completar los cinco símbolos, la cabeza y todas las casillas del cuerpo
pasan a fondo verde `#2DFF9B`, también durante la alarma; el número sigue
en grafito y los símbolos conservan su imagen. Un reinicio retira este estado.
Al recibir un error del backend, mostrar una cruz roja `#F15C68` sobre la
casilla pendiente de esa serpiente, sin cambiar su progreso. La cruz sigue el
movimiento y permanece 4 segundos, con brillo rojo reforzado; parpadea suavemente dos veces al aparecer
(sin parpadeo si se solicita movimiento reducido). Un nuevo error en la misma
casilla reinicia los 4 segundos. Se mantienen el sonido y las reglas de error.
Mientras se reproduce el audio de entrada de alarma, el fondo del tablero tiene
un resplandor rojo radial que pulsa suavemente desde el centro y se degrada
hasta transparente hacia los bordes, sin relleno rectangular. Se sincroniza con los eventos reales
del audio: empieza en `playing` y termina en `ended`, no con un tiempo fijo.
Si el audio falla, se sustituye o se completa el puzzle, retirar el efecto.
Con movimiento reducido, mantener el fondo rojo estático durante el audio.
Esta señal no altera la correspondencia de símbolos ni el estado de alarma.
Comprobadas diez serpientes durante
cien movimientos, alarma y progreso a 1920 × 1080 y 1280 × 720, sin recortes.
Solo simulación aislada; legibilidad desde la sala pendiente.

Confirmación de Memory, acordada e implementada el 6 octubre 2026: conservar la
pantalla verde con «NIVEL COMPLETADO», sin popup adicional ni destello. Mostrarla
al recibir un resultado correcto validado por el backend. En la última ronda,
reproducir ahí el sonido de nivel superado, sin repetirlo al llegar el evento final.
Comprobado con estados simulados a 1920 × 1080 y 1280 × 720; sin hardware.

## Catálogo gráfico autorizado

### Objetos principales

| Recurso | Archivo | Aplicación |
| --- | --- | --- |
| Token | `static/images/shared/gameplay/token_card.png` | Presentaciones, práctica y ayudas |
| Terminal | `static/images/shared/gameplay/terminal_box.png` | Misma familia que el token |

![Token](../static/images/shared/gameplay/token_card.png)
![Terminal](../static/images/shared/gameplay/terminal_box.png)

PNG transparentes: token 1024 × 1024; terminal 2000 × 2000. Mostrar una vista
principal por explicación y no añadir halos. Son ilustraciones de apoyo, no fotos
del montaje que se ofrece al cliente.

### Ocho iconos de apoyo

Carpeta: `static/images/shared/nuevos iconos/`. Usarlos grandes y acompañados de
una etiqueta. En controles pequeños, preferir símbolos simples y texto.

| Acción | Archivo | Criterio |
| --- | --- | --- |
| Pasar token | `base nfc con token.png` | Identificar la interacción, no un token nuevo |
| Pulsar | `apretar boton.png` | Acompañar el botón o color correcto |
| Escuchar | `altavoz.png` | Audio funcional o fragmento musical |
| Coordinarse | `equipo_consenso.png` | Solo cuando aporta una instrucción colectiva |
| Correcto | `respuesta_correcta.png` | Check, texto y estado semántico |
| Incorrecto | `respuesta_incorrecta.png` | Cruz y explicación breve |
| Atención | `alerta.png` | Advertencia distinta del error |
| Repetir | `repetir.png` | Repetir escucha o explicación; nunca borrar progreso |

No añadir iconos redundantes por variedad. Simplificar brillo y contornos en una
futura adaptación vectorial; aún no está hecha. Conectores y flechas se dibujan en
SVG o CSS sencillo. No recuperar las ilustraciones descartadas desde copias antiguas.

### Recursos funcionales que se preservan

- Laberinto: diez patrones `static/images/puzzle2/symbols/symbol_0.png` a
  `symbol_9.png`; mantener orientación, colores y distribución exactas.
- Memory: `alpha`, `beta`, `gamma`, `delta`, `epsilon`, `lambda`, `mu`, `omega`,
  `pi`, `sigma` en `static/images/puzzle8/`. Los `.svg` contienen raster incrustado;
  no asumir escalado vectorial infinito. Conservar siluetas y códigos.
- Botones: `static/images/puzzle12/imatges/fase*.gif` y estados siguen utilizados.
  Su sustitución requiere preservar patrones, cantidades, colores y tiempos.
  Objetivo visual: composición común sin el triángulo decorativo antiguo.
- Sumas, Trivial, Cronómetro, Música y Energía conservan números, preguntas,
  secuencias, tiempos y señales reales. Los iconos no sustituyen esos datos.
- `terminal_3d/` queda como referencia física y apoyo puntual, especialmente
  `buttons_panel_front.png` y `terminal_box_buttons_numbers_front.png`. No mezclar
  estos renders con los objetos principales dentro de una misma explicación.
- Verificar contenido antes de usar `terminal_3d`: hay nombres incorrectos y su
  README enumera archivos ausentes. `symbol_plate_o.png` muestra una caja;
  `scanner_bar_perspective.png` muestra una placa triangular.
- `shared/puzzle10/` es una reserva técnica, no material del flujo actual.
- El archivo histórico `old_pics/` se retiró el 5 de octubre de 2026; no recuperar sus recursos para el juego nuevo.

## Marketing

Compartir pirámide, paleta y tipografía con la partida. El cartel puede intensificar
la escala y las diagonales. Usar fotografías del montaje real cuando estén
disponibles. Confirmar firma del organizador y destino del contacto antes de publicar.

Referencia visual: `output/campanya/poster-01.png` y `identitat.css`. No confundir
capturas con artes finales de impresión. Adaptar proporciones y texto a cada
formato. Mantener legibles descriptor, capacidad y llamada a solicitar propuesta.

## Control del Game Master

### Idioma de la sesión

Acordado e implementado: en `/test` → **Sesiones** se elige catalán, castellano o
inglés junto con empresa, fecha, hora, lugar, jugadores y notas. Confirmar guarda
los cambios antes de activar la sesión. El idioma confirmado se aplica a la
pantalla de jugadores y sus rutas; el control de presentación lo muestra como
dato de la sesión. El panel del GM conserva su propio idioma.

La infraestructura de los tres idiomas está preparada. Las traducciones completas
de textos de puzzles y mensajes dinámicos se realizarán al cerrar los contenidos.
Las claves aún sin traducción conservan el texto actual. No presentar la partida
como íntegramente traducida. Contrato y guía de incorporación:
[IDIOMAS_SESION.md](IDIOMAS_SESION.md).

Dos espacios: **Sesiones** para preparación y datos del grupo; **Control de juego**
para conducción. Resumen discreto de sesión activa, jugadores e idioma.

- Destacar la acción siguiente según la fase.
- «Iniciar» junto a un puzzle siempre pide confirmación dentro del panel; no
  depender de `window.confirm()` para esta acción. Cancelar no abre ni inicia
  nada. Mostrar el progreso de apertura y cualquier error del lanzador.
- Agrupar volver, pausar y repetir como acciones secundarias.
- Mostrar ayudas y resolución de pasos en el contexto del puzzle.
- Separar reinicio y acciones que fuerzan resultados.
- Etiquetas con verbos y alcance concreto: iniciar juego, mostrar terminales,
  resolver paso. No usar nombres internos como explicación al operador.
- Pantalla de jugadores en ventana independiente normal, para moverla a la
  pantalla grande. Los controles del GM nunca aparecen ante los jugadores.

## Estado y revisión antes de entregar

Implementado: base visual, SVG editable, presentaciones progresivas y control en
dos pestañas; cabecera compacta común en todos los puzzles. Piloto: ajustes del
tablero de Memory y Laberinto. Pendiente: validación de sala, revisión individual de
reglas/textos, audio y subtítulos finales, variantes finales de firma y logo.

Antes de entregar un cambio visual:

1. Contrastar la presentación con la mecánica real y los controles del GM.
2. Revisar ambas resoluciones y los idiomas afectados; comprobar texto y contornos.
3. Comprobar que colores, símbolos, números y estados siguen significando lo mismo.
4. Revisar referencias antes de borrar recursos, incluidas escenas, catálogos,
   generadores y rutas dinámicas. Validar los archivos modificados.
5. Indicar qué se comprobó con simulación y qué necesita hardware o una sesión real.
6. Actualizar esta guía si cambia una decisión duradera. No añadir reglas nuevas
   de marca para justificar retrospectivamente una desviación accidental.

Referencias de implementación: `static/css/game-theme.css`, `game-surface.css`,
`presentation-briefing.css`, `presentation-journey.css`; `static/js/presentation-flow.js`,
`presentation-briefing.js`, `pyramid-logo.js`; `player/README.md` y `config.py`.
