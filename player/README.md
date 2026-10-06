# La Piràmide: presentacions i pantalla de joc

El recorregut de producció s’obre a `/`. La pàgina exterior manté la pantalla completa mentre l’iframe navega entre HTMLs independents. El Game Master controla el ritme des de `/test`, pestanya **Control de juego**.

## Ús

1. Obrir la pantalla de jugadors des de Test. A la pantalla compartida, clicar per entrar en pantalla completa.
2. La benvinguda és una pantalla d’espera fins que el GM prem **Comenzar presentación inicial**. La introducció avança sola en cinc moments (6 s, 6,5 s, 8,5 s, 12 s de mapa i 6 s provisionals), amb transicions suaus i controls de pausa/reprendre a Test. S’atura abans de la pràctica; els temps es defineixen a `presentation-flow.js` i s’ajustaran quan hi hagi locució i subtítols. A partir de la pràctica, fer servir **Anterior / Siguiente** i els passos del panell per explicar cada presentació. No hi ha avanç automàtic per àudio.
3. A l’últim pas de cada presentació (objectiu o regla), prémer **Comenzar**. El compte enrere es pot cancel·lar; en acabar, s’obre el puzzle real.
4. Quan el puzzle es completa, apareix una transició. El GM decideix quan continuar.

**Presentar seleccionado** obre la presentació del puzzle seleccionat sense iniciar els terminals. Els accessos directes tècnics al puzzle obren el joc directament i conserven el seu inici habitual. Tots aquests accessos comparteixen una sola finestra independent de jugadors. Presentar o iniciar un altre puzzle reutilitza aquesta finestra i manté el focus al panell del GM.

## Estructura

- `templates/welcome.html`: superfície persistent i benvinguda.
- `templates/presentation.html` i `_presentation_screen.html`: HTML de cada presentació.
- `static/js/game-shell.js`: navegació i connexió amb Test.
- `static/js/puzzle-names.js`: catàleg únic de noms editorials en tres idiomes; compartit amb les cabeceres i el GM. Vegeu la guia `docs/MARCA_DISENO_ESTILO.md`.
- `static/js/presentation-flow.js`: seqüència i textos en català, castellà i anglès.
- `static/js/presentation-visuals.js`: exemples visuals de les proves.
- `static/js/presentation-pilot.js`: passos, idioma i compte enrere.
- `static/js/presentation-gm.js`: controls comuns al panell Test.
- `templates/puzzle*.html` i `static/js/puzzle*.js`: jocs existents.
- `static/css/game-theme.css` i `static/js/game-theme.js`: disseny compartit dels puzzles.
- `static/js/presentation-game-bridge.js`: pas del puzzle superat a la següent transició.

Rutes: `/videoIntro`, `/videoTutorial`, `/presentacio/ID`, `/puzzle/ID`, `/videoPuzzles/ID` i `/final`. Les rutes antigues `/player/?scene=…`, `/direct/ID` i `/explicacioPuzzles/index` redirigeixen al nou recorregut. L’ordre es pren de `config.py`.

## Assaig sense terminals

`player/presentation.html?flow=game&lang=ca` és un visor de revisió. `/player/briefings.html` permet revisar les presentacions gràfiques.

El recorregut nou no carrega Cero, locucions ni subtítols temporitzats. Els sons que formen part dels puzzles es mantenen. El sistema antic de `scenes/`, el generador d’intros, els vídeos de Cero i les locucions antigues es van retirar el 5 d’octubre de 2026. Les presentacions actuals es mantenen en HTML i JavaScript; no depenen d’aquells fitxers.

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

La introducció i el final encara no tenen la futura locució/subtítols. Els sons funcionals dels puzzles es mantenen. Falta la sessió de validació amb terminals físics.

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

Visor de revisió: `/player/briefings.html?lang=es`. Permet escollir qualsevol dels nou jocs i recórrer les tres revelacions sense iniciar terminals. El recorregut conté 42 estats de presentació en total, dels quals 27 són revelacions dels nou esquemes; no són 27 diapositives de puzzles.


### Capçalera compacta comuna a tots els puzzles

`game-surface.css`, activat per `game-theme.js` als dotze HTML de puzzles, substitueix la franja antiga per dues identitats de cantonada: nom/repte a l’esquerra i piràmide/progrés real a la dreta. No hi ha marc ni línia transversal. El fons grafit i la tipografia segueixen les presentacions.

Memory conserva els deu tokens, les dues formes, fases, temporitzador i colors reals. La instrucció se situa al centre superior; les targetes ocupen 964 px d’alçada del canvas de 1080 i agrupen número/token en una sola fila. Laberint conserva els deu recorreguts mòbils i l’alarma, amb 986 px d’alçada de tauler. La identificació roja en alarma es manté. Cap canvi de mecànica, MQTT, temps ni rondes.

Comprovació en Chrome amb servidor/estats simulats: preparació, memorització, resposta, formes negres, entrada parcial, Laberint normal i alarma, a 1920×1080 i 1280×720. Les captures temporals de prova es van retirar durant la neteja. Visor sense activar terminals: `/player/game-surfaces.html`.

La capçalera aprovada s’ha estès a totes les proves. Els comptadors de ronda i temps es mouen al centre conservant els mateixos nodes i IDs. La pràctica no mostra un número de repte; les proves fora de l’ordre no inventen un índex. El progrés reflecteix assoliments de la sessió, no la posició de la pantalla. Les captures temporals de comprovació es van retirar durant la neteja.

Validació de l’extensió: 12 plantilles × 2 resolucions (1920×1080 i 1280×720), una única capçalera per pàgina, marc antic ocult, comptadors preservats i cap desbordament de la capçalera. Estats simulats, sense MQTT ni terminals físics. Trivial tolera l’absència del seu antic panell de feedback.

El pilot antic de Sumes s’ha retirat. Les dades necessàries estan integrades a `presentation-flow.js`; l’assaig utilitza els esquemes vigents per a tots els puzzles.
