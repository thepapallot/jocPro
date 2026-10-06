# La Piràmide: presentacions i pantalla de joc

El recorregut de producció s’obre a `/`. La pàgina exterior manté la pantalla completa mentre l’iframe navega entre HTMLs independents. El Game Master controla el ritme des de `/test`, pestanya **Control de juego**.

## Ús

Primer, a `/test` → **Sesiones**, completar les dades del grup i escollir **Català**,
**Castellano** o **English**. **Confirmar sesión** guarda els camps visibles i activa
la sessió; el seu idioma acompanya tota la pantalla de jugadors. El selector de
Control de juego és informatiu: l’idioma es canvia des de Sesiones. La traducció
completa dels textos dels puzzles queda pendent. Vegeu
[idioma i preparació de la sessió](../docs/IDIOMAS_SESION.md).

1. Obrir la pantalla de jugadors des de Test. A la pantalla compartida, clicar per entrar en pantalla completa.
2. La benvinguda és una pantalla d’espera fins que el GM prem **Comenzar presentación inicial**. La introducció «Despertar la Piràmide» és un muntatge de suport a la narració: 16 moments i una espera final per repartir tokens (115,5 s de veu en català; 169 s provisionals en castellà i anglès; 2,6 s de tancament musical abans de l’espera). La pausa atura avanç, animacions i música. El GM reparteix els tokens al final i prem **Tokens repartidos · explicar el simulacro** per passar a la presentació manual de la pràctica. Guió a `presentation-story.js`; la locució catalana i els subtítols segueixen el rellotge de l’àudio, amb temps a `presentation-recordings.js`. Les veus castellana i anglesa encara són pendents. A partir de la pràctica, fer servir **Anterior / Siguiente** i els passos del panell per explicar cada presentació. Només la intro inicial catalana avança amb la seva locució; la pràctica i les altres presentacions continuen manuals.
3. A l’últim pas de cada presentació (objectiu o regla), prémer **Comenzar**. El compte enrere es pot cancel·lar; en acabar, s’obre el puzzle real.
4. Quan el puzzle es completa, apareix una transició. El GM decideix quan continuar.

**Presentar seleccionado** obre la presentació del puzzle seleccionat sense iniciar els terminals. Els accessos directes tècnics al puzzle obren el joc directament i conserven el seu inici habitual. Tots aquests accessos comparteixen una sola finestra independent de jugadors. Presentar o iniciar un altre puzzle reutilitza aquesta finestra i manté el focus al panell del GM.

## Estructura

- `templates/welcome.html`: superfície persistent i benvinguda.
- `templates/presentation.html` i `_presentation_screen.html`: HTML de cada presentació.
- `static/js/game-shell.js`: navegació i connexió amb Test.
- `static/js/game-language.js` i `game-copy.js`: idioma compartit, claus de traducció i text actual com a alternativa quan falta una entrada.
- `static/js/puzzle-names.js`: catàleg únic de noms editorials en tres idiomes; compartit amb les cabeceres i el GM. Vegeu la guia `docs/MARCA_DISENO_ESTILO.md`.
- `static/js/presentation-flow.js`: seqüència i textos en català, castellà i anglès.
- `static/js/presentation-visuals.js`: exemples visuals de les proves.
- `static/js/presentation-story.js`: guió aprovat, traduccions i punts de muntatge provisionals.
- `static/js/presentation-opening.js` i `static/css/presentation-opening.css`: suport visual a la narració, subtítols temporitzats i música ambient existent.
- `static/js/presentation-pilot.js`: passos, idioma i compte enrere.
- `static/js/presentation-gm.js`: controls comuns al panell Test.
- `templates/puzzle*.html` i `static/js/puzzle*.js`: jocs existents.
- `static/css/game-theme.css` i `static/js/game-theme.js`: disseny compartit dels puzzles.
- `static/js/presentation-game-bridge.js`: pas del puzzle superat a la següent transició.

Rutes: `/videoIntro`, `/videoTutorial`, `/presentacio/ID`, `/puzzle/ID`, `/videoPuzzles/ID` i `/final`. Les rutes antigues `/player/?scene=…`, `/direct/ID` i `/explicacioPuzzles/index` redirigeixen al nou recorregut. L’ordre es pren de `config.py`.

## Assaig sense terminals

`player/presentation.html?flow=game&lang=ca` és un visor de revisió. `/player/briefings.html` permet revisar les presentacions gràfiques.

El recorregut nou no carrega Cero ni les locucions antigues. L’obertura narrativa incorpora subtítols temporitzats propis. Els sons que formen part dels puzzles es mantenen. El sistema antic de `scenes/`, el generador d’intros, els vídeos de Cero i les locucions antigues es van retirar el 5 d’octubre de 2026. Les presentacions actuals es mantenen en HTML i JavaScript; no depenen d’aquells fitxers.

Validació automatitzada: rutes reals renderitzades amb Flask i MQTT simulat, navegació completa en Chrome, nou entrades de puzzle i nou esquemes de presentació amb tres revelacions cadascun. Queda pendent comprovar la partida amb els terminals físics.

## Ritme i assoliments

El recorregut té tres actes: **Descobrir** (pràctica, Laberint, Trivial), **Organitzar-se** (Memory, Sumes, Cronòmetre) i **Actuar junts** (Botons, Música, Energia). El color d’accent i les consignes de cooperació canvien amb cada acte. Cada prova té un únic esquema amb tres capes revelades pel GM: objectiu, eines i interacció. La pràctica segueix la mateixa estructura.

S’han retirat els passos «Exemple en acció» del recorregut. El GM explica el funcionament amb el suport gràfic que es construeix progressivament.

La piràmide s’omple amb els vuit reptes reals. La pràctica celebra l’aprenentatge i no suma un nivell. El tancament d’Energia omple la cima, celebra la figura daurada durant 11 segons i manté la pantalla de foto fins que el GM decideix sortir. El GM pot pausar aquesta seqüència.

En producció, `PyramidRun` conserva els IDs completats a `sessionStorage` de la pestanya de jugadors. El pont de cada joc registra la finalització; navegar a una presentació des de Test no dona punts. Recarregar conserva els assoliments; iniciar de nou l’obertura els reinicia. És progrés visual de la pestanya, no una nova font d’estat per al backend ni un historial de sessions. Tancar-la o obrir-ne una de nova pot perdre aquest progrés. L’assaig estàtic mostra el progrés nominal de cada moment per poder revisar-lo fora d’una partida.

A **Guía para el Game Master**, Control de juego ofereix tres ajudes graduals i consignes de repartiment de papers.

## Comprovacions

- `node tests/presentation_flow.test.cjs`: ordre, ritme, progrés i recàrrega sense regalar assoliments.
- Tests Python de `tests/`: rutes Flask amb MQTT simulat i regressions de les regles existents.
- Chrome: recorregut complet dels HTMLs reals, nou callbacks de finalització, un inici per prova, compte enrere cancel·lable, pausa/reprendre, pistes, notes, final i foto. Comprovació visual dels nou esquemes amb tres revelacions en tres idiomes.

La introducció té locució catalana i subtítols sincronitzats; les veus castellana i anglesa són pendents; la narració del final encara s’ha de produir. Els sons funcionals dels puzzles es mantenen. Falta la sessió de validació amb terminals físics.

## Control de juego unificat

A `/test` només hi ha **Sesiones** i **Control de juego**. **Sesiones** conserva els detalls del grup i la preparació de la sessió; la capçalera comuna mostra un resum compacte amb nom, empresa, jugadors i idioma. Les pestanyes Prepartida, Control i Técnico ja no formen part de la navegació. Els elements interns que utilitzen els controladors compartits es mantenen ocults i inerts.

- Recorregut lateral: espera, obertura, presentació/joc de cada prova, celebració final i foto. El GM pot entrar en una presentació sense iniciar la prova; **Juego** és un accés directe que inicia el puzzle.
- Centre: pantalla actual, passos, anterior/següent, pausa de les seqüències automàtiques i inici amb compte enrere cancel·lable. L’idioma només es canvia durant les presentacions.
- Durant la prova: segueix el puzzle de la pantalla de jugadors, mostra el progrés i activa les ajudes que corresponen al joc. El tauler individual és desplegable i reutilitza el simulador existent, sense duplicar IDs ni listeners.
- Pràctica: resol només els subpassos pendents de la instrucció actual. Trivial: respon cada terminal amb el seu verd/vermell. Memory: completa només les associacions que falten; no actua durant la memorització ni corregeix silenciosament una entrada errònia. Botons: allibera també els terminals sobrants. Sumes: espera la confirmació d’encert abans d’enviar el següent objectiu.
- **Finalizar puzzle y continuar** marca la prova com a superada mitjançant l’endpoint existent i deixa que el joc obri la celebració. Reiniciar/finalitzar són accions separades de les ajudes normals. **Mantener energía hasta el final** activa el mode d’ajuda existent, que espera el temporitzador.

El controlador nou és `static/js/game-director.js`. Utilitza les API locals `PyramidGM` (presentacions) i `PyramidTest` (estat/ajudes). No afegeix una segona connexió MQTT ni un segon reproductor. Les accions s’inhibeixen si el puzzle de backend no coincideix amb el de la pantalla.

Comprovació d’ajudes: `node tests/game_director_actions.test.cjs`. Validació de navegador feta amb endpoints/estats simulats, incloent avanç, pausa, compte enrere, ajudes, finalització, canvi entre Sesiones i Control de juego, conservació dels camps del formulari i absència d’errors JS. Cal provar les ajudes amb terminals físics.

### Disposició dels controls i finestra de jugadors

El recorregut lateral té una fila per prova amb **Presentar** i **Iniciar** en columnes fixes. Al bloc central, **Anterior** i **Pausa** queden a l’esquerra i l’acció principal —**Següent** o **Començar joc**— a la dreta. Seleccionar un pas, repetir i canviar l’idioma són dins de **Elegir pantalla, repetir o cambiar idioma**. Les ajudes del joc i les opcions de reinici/finalització continuen en blocs separats.

**Abrir ventana de jugadores** demana al servidor local que executi Firefox o Chrome amb `--new-window`, amb barra d’adreces i controls normals. Requereix executar Test al mateix ordinador i perfil del navegador que el servidor. La comunicació entre Test i la finestra independent es fa amb `BroadcastChannel`, sense dependre de `window.opener`. En recarregar Test es busca la finestra existent abans d’obrir-ne una altra; navegar no reinicia el joc. **Mostrar ventana de jugadores** en demana el focus, subjecte a les restriccions del navegador. Si el llançament falla o no connecta, es mostra un error.

Estils del controlador a `static/css/game-director.css`. Comprovació: `node tests/player_window.test.cjs` i Chrome amb identificadors de finestra diferents, reutilització en navegar i en recarregar Test, captures a 1366 px i comprovació sense desbordament a 390 px.


### Presentacions gràfiques progressives

Cada puzzle té una sola composició que es revela amb **Objectiu → Terminals i tokens → Interacció**. El GM controla cada revelació; no hi ha avanç automàtic, locució ni exemples interactius. **Empezar juego** només apareix amb l’esquema complet. Tornar enrere, repetir i canviar l’idioma continuen disponibles des de Control de juego.

`presentation-briefing.js` i `presentation-briefing.css` dibuixen els esquemes amb els recursos actuals de terminals, tokens, símbols i formes. En avançar es conserven els nodes del diagrama i només canvia la capa visible, sense transició entre diapositives. Les animacions ressalten elements nous i respecten moviment reduït. Les xifres i patrons dels esquemes són il·lustratius; no es publiquen accions ni solucions de la partida.

Visor de revisió: `/player/briefings.html?lang=es`. Permet escollir qualsevol dels nou jocs i recórrer les tres revelacions sense iniciar terminals. El recorregut configurat actualment conté 56 estats de presentació en total, dels quals 27 són revelacions dels nou esquemes i un és el mapa del QUIZ; no són 27 diapositives de puzzles.


### Capçalera compacta comuna a tots els puzzles

`game-surface.css`, activat per `game-theme.js` als dotze HTML de puzzles, substitueix la franja antiga per dues identitats de cantonada: nom/repte a l’esquerra i piràmide/progrés real a la dreta. No hi ha marc ni línia transversal. El fons grafit i la tipografia segueixen les presentacions.

Memory conserva els deu tokens, les dues formes, fases, temporitzador i colors reals. La instrucció se situa al centre superior; les targetes ocupen 964 px d’alçada del canvas de 1080 i agrupen número/token en una sola fila. Laberint conserva els deu recorreguts mòbils i l’alarma, amb 986 px d’alçada de tauler. La identificació roja en alarma es manté. Cap canvi de mecànica, MQTT, temps ni rondes.

Comprovació en Chrome amb servidor/estats simulats: preparació, memorització, resposta, formes negres, entrada parcial, Laberint normal i alarma, a 1920×1080 i 1280×720. Les captures temporals de prova es van retirar durant la neteja. Visor sense activar terminals: `/player/game-surfaces.html`.

La capçalera aprovada s’ha estès a totes les proves. Els comptadors de ronda i temps es mouen al centre conservant els mateixos nodes i IDs. La pràctica no mostra un número de repte; les proves fora de l’ordre no inventen un índex. El progrés reflecteix assoliments de la sessió, no la posició de la pantalla. Les captures temporals de comprovació es van retirar durant la neteja.

Validació de l’extensió: 12 plantilles × 2 resolucions (1920×1080 i 1280×720), una única capçalera per pàgina, marc antic ocult, comptadors preservats i cap desbordament de la capçalera. Estats simulats, sense MQTT ni terminals físics. Trivial tolera l’absència del seu antic panell de feedback.

El pilot antic de Sumes s’ha retirat. Les dades necessàries estan integrades a `presentation-flow.js`; l’assaig utilitza els esquemes vigents per a tots els puzzles.


### Obertura narrativa

La pantalla dona suport a la història amb gràfics i titulars breus. El guió es
mostra per frases a la banda inferior de subtítols i es conserva complet a les
notes del GM i a `presentation-story.js`.
La història relaciona aportacions diferents amb la missió de despertar la Piràmide.
Els tokens es reparteixen **després de la intro**, abans del Simulacre Inicial.
S’han retirat les consignes de caminar i deixar pas i la reiteració de «connectar».

Els 16 moments culminen en una pantalla estable, sense avanç automàtic. El GM
reparteix un token per persona o parella i després avança a l’explicació. Els
controls de pausa/reprendre i anterior/següent continuen disponibles. L’idioma
es tria a Sesiones.
Repetir torna al principi de la veu. En producció, la música de fons és persistent
i continua durant el repartiment i en passar a la pantalla següent.

La zona inferior y=880–1080 (canvas 1920 × 1080) mostra subtítols de dues línies
com a màxim, en castellà, català i anglès. `PyramidOpening.setSubtitle(text)`
actualitza la banda. La pausa congela el cue i el temps restant; navegar, repetir
o canviar d’idioma reinicia el text del moment. Durant el repartiment queda buida.
La locució catalana aportada pel grup dura 115,5 segons i governa el muntatge,
els subtítols i les animacions. Àudio a `static/audios/intro/intro-ca.mp3`, cues a
`presentation-recordings.js` i exportació a `intro-ca.vtt`. La música baixa durant
la veu. Si el navegador bloqueja el so, la pantalla queda pausada amb «Activar so»
i el GM rep l’avís. Castellà i anglès conserven 169 segons provisionals sense veu.

El mapa deriva de la configuració i revela progressivament els dos blocs, QUIZ i
Carga Final. Si QUIZ no hi és, se n’omet el moment. Els blocs del mapa estan pendents;
el pols il·lustratiu de la història no atorga cap assoliment.

Vegeu [guió i muntatge](../docs/APERTURA_NARRATIVA.md). Les captures antigues
`output/apertura/` documenten la versió anterior de sis moments, ara substituïda.

Verificació: 102 composicions en tres idiomes i dues resolucions, tots els cues de
subtítols en dues línies com a màxim, variants del recorregut i moviment reduït. Controls i pausa
comprovats en temps real; recorregut automàtic amb temps accelerats només al fixture.
La intro queda en espera fins que el GM avança a la pràctica. Sense MQTT ni hardware.
Resultats a `output/apertura-narrativa/`. La locució catalana ja està integrada; comprovació específica a
`output/intro-ca-audio/`, amb dues resolucions, controls sincronitzats, recuperació
del so bloquejat i salt de la locució QUIZ quan no forma part del recorregut.
Falta l’assaig amb altaveus a la sala.

Actualització de la intro: retirats el cub, els diagrames de pistes i les
il·lustracions de persones rebutjades. Les tres escenes de cooperació mostren
la Piràmide amb llum sincronitzada: dos laterals, un recorregut suau i un
final estable amb «CADA MIRADA COMPTA». A «TOTES LES VEUS COMPTEN», la Piràmide
s’atenua perquè destaqui el titular. No es marquen blocs com a superats.
Comprovació a dues resolucions i tres idiomes a `output/intro-luces/`. El fons continua fins al marge inferior,
sense franja per als subtítols. La veu acaba de manera natural, la Piràmide es
manté 2,6 segons i la música es fon abans del repartiment. Pausar també atura
aquest tancament; repetir o navegar el cancel·la. Comprovació amb fixtures, tres
idiomes i 1920 × 1080 / 1280 × 720 a `output/intro-ajustes/`.

Música de fons recuperada: `bgm_layer.js` es carrega a la finestra exterior de
jugadors. Una sola pista (`musica_ambient/musica_piramide.mp3`) continua entre
pantalles, a 0,22 habitualment, 0,06 amb veu catalana i 0,10 durant el repartiment.
Codi Sonor silencia el fons, també a la seva explicació; després es recupera.
La intro comparteix aquest reproductor i manté pausa i fundit final. El player
independent d’assaig conserva la seva música local. Verificació amb fixtures
a `output/musica-fondo/`, sense MQTT ni hardware.

La presentación del Simulacro Inicial empieza con «La misión está en vuestras manos»,
una pantalla manual para explicar el token personal, los terminales, el lector
y el trabajo en equipo. Después siguen los tres revelados habituales. Los textos
nuevos se revisan primero en castellano (`elementsCopy.es`); la traducción al
catalán se hará al aprobar el conjunto. La nueva pantalla no inicia hardware ni
otorga progreso. Verificación aislada: `output/simulacro-elementos/`.

Las pantallas de presentación ya no muestran frases de apoyo en el pie ni su
línea de separación. El espacio queda disponible para el contenido; las ayudas
del GM y las instrucciones de cada esquema se conservan.

Textos aprobados del Simulacro en castellano: «Familiarizaos con el sistema
siguiendo las instrucciones de la pantalla», «Tokens y terminales» y
«Mirad la pantalla → realizad la acción indicada → esperad la siguiente
instrucción». Mantiene los tres revelados tras la pantalla de herramientas
de la misión, sin apartado Atención. Traducción del conjunto pendiente.

Las presentaciones en castellano usan «Herramientas» como título del apartado
y en el control del GM. En el Simulacro, token y terminal se muestran sin rótulo
inferior. Las listas de herramientas seleccionan las imágenes para cada revisión;
los botones o el lector NFC se destacarán dentro del terminal cuando corresponda.
Las pistas funcionales de los puzzles pendientes se conservan.

En castellano, el objetivo del Simulacro aparece dentro del recuadro 01,
en lugar de la ilustración «Seguid la instrucción». No se repite como subtítulo
bajo el nombre del puzzle. Las notas del GM conservan el mismo objetivo.

Composición del Simulacro en castellano: cabecera compacta, objetivo en Arial
negrita dentro de un panel sencillo, herramientas ampliadas sin flecha y Acción
en una franja de 210 px, con textos y flechas. Mantiene posiciones entre revelados.
Verificación visual aislada: `output/simulacro-composicion/`, 1080p y 720p.

Ajuste de encuadre del Simulacro: título y logo comparten fila, indicador debajo
del logo, objetivo y herramientas de 350 px de alto. Acción conserva 210 px.
Verificación aislada a ambas resoluciones: `output/simulacro-encuadre/`.

Tras la Serpiente adopta el formato revisado en castellano: objetivo, herramientas
visuales y tres acciones sin memorización. Añade Atención como cuarto paso
obligatorio antes del inicio, con una pareja real de símbolos de colores invertidos.
La pantalla del puzzle conserva los símbolos originales durante la alarma y pone
las serpientes en rojo. El equipo debe buscar en los terminales el mismo símbolo
con los colores invertidos.
GM, notas y navegación incluyen ese paso. Traducciones pendientes; Atención tiene
fallback castellano. Validación sin hardware: `output/serpiente-presentacion/`.

En Herramientas de Tras la Serpiente, token, terminal y símbolo se presentan
como tres elementos independientes y alineados; el símbolo no se superpone al
terminal.
