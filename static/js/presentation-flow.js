/* Full player journey. Each puzzle owns its copy and visual example.
   Default order mirrors config.py; /test passes its configured order in the URL. */
(() => {
  const params = new URLSearchParams(location.search);
  const page=window.PYRAMID_PAGE;
  const scriptURL = document.currentScript.src;
  const asset = path => new URL('../images/' + path, scriptURL).href;
  const sums = {
    id: 'sumas',
    puzzleId: 1,
    gamePath: '/puzzle/1',
    steps: ['cover', 'objective', 'example', 'coordination', 'ready'],
    example: Object.freeze({token: 13, terminal: 5, result: 18, targets: [18, 23, 31, 40]}),
    assets: Object.freeze({token: asset('shared/gameplay/token_card.png'), terminal: asset('shared/gameplay/terminal_box.png'), buttonsPanel: asset('shared/terminal_3d/buttons_panel_front.png')}),
    copy: {
      ca: {
        name: window.PyramidPuzzleNames.name(1,'ca'), nextChallenge: 'La següent prova', brand: 'La Piràmide',
        coverTitle: 'CÀLCUL<br>EXTREM', slogan: 'El repte és de tots.', coverLead: 'Combineu els vostres valors.<br>Completeu el repte junts.',
        objectiveTitle: 'UN OBJECTIU<br>COMPARTIT.', objectiveLead: 'Completeu tots els resultats<br>que apareixen a la pantalla.', targetLabel: 'Resultats de mostra',
        exampleTitle: 'COM FUNCIONA?', exampleLead: 'El valor del token + el valor del terminal.', exampleLabel: 'Exemple', token: 'El vostre token', terminal: 'Un terminal', result: 'Un resultat objectiu',
        coordinateTitle: 'COORDINEU-VOS.', coordinateLead: 'Cada resultat, una sola vegada.', solved: 'Ja completat', pending: 'Pendent', warning: 'Una suma incorrecta o repetida reinicia els objectius.',
        readyTitle: 'TOTHOM<br>PREPARAT?', readyLead: 'Deu terminals. Un únic equip.', readyFooter: 'El GM dona el senyal de sortida.',
        countdownLabel: 'Comencem tots alhora', go: 'JA!',
        footers: ['Escolteu el Game Master.', 'Busqueu les combinacions que necessiteu.', 'Relacioneu el token amb el terminal.', 'Parleu-vos. Compartiu les combinacions.', 'El GM dona el senyal de sortida.'],
        stepLabels: ['Presentació', 'Objectiu', 'Exemple', 'Coordinació', 'Preparats'],
        notes: [
          'Presenta el nom de la prova i el repte compartit. Aquesta pantalla es manté fins que decideixis avançar.',
          'Explica que cal completar tots els resultats de la pantalla. Els quatre números són només una mostra visual; no són la partida.',
          'Mostra el token 13 i el terminal 5. Prem «Mostrar resultat» per descobrir el 18 i repeteix l’exemple si cal.',
          'Explica la coordinació i les condicions actuals de Sumes: una suma incorrecta o repetida reinicia els objectius.',
          'Comprova que els jugadors estan preparats. Només «Començar» o Enter activa el compte enrere i l’entrada al joc.'
        ]
      },
      es: {
        name: window.PyramidPuzzleNames.name(1,'es'), nextChallenge: 'La siguiente prueba', brand: 'La Pirámide',
        coverTitle: 'CÁLCULO<br>EXTREMO', slogan: 'El reto es de todos.', coverLead: 'Combinad vuestros valores.<br>Completad el reto juntos.',
        objectiveTitle: 'UN OBJETIVO<br>COMPARTIDO.', objectiveLead: 'Completad todos los resultados<br>que aparecen en la pantalla.', targetLabel: 'Resultados de ejemplo',
        exampleTitle: '¿CÓMO FUNCIONA?', exampleLead: 'El valor del token + el valor del terminal.', exampleLabel: 'Ejemplo', token: 'Vuestro token', terminal: 'Un terminal', result: 'Un resultado objetivo',
        coordinateTitle: 'COORDINAOS.', coordinateLead: 'Cada resultado, una sola vez.', solved: 'Ya completado', pending: 'Pendiente', warning: 'Una suma incorrecta o repetida reinicia los objetivos.',
        readyTitle: '¿TODOS<br>PREPARADOS?', readyLead: 'Diez terminales. Un único equipo.', readyFooter: 'El GM da la señal de salida.',
        countdownLabel: 'Empezamos todos a la vez', go: '¡YA!',
        footers: ['Escuchad al Game Master.', 'Buscad las combinaciones que necesitáis.', 'Relacionad el token con el terminal.', 'Hablad. Compartid las combinaciones.', 'El GM da la señal de salida.'],
        stepLabels: ['Presentación', 'Objetivo', 'Ejemplo', 'Coordinación', 'Preparados'],
        notes: [
          'Presenta el nombre de la prueba y el reto compartido. Esta pantalla espera hasta que decidas avanzar.',
          'Explica que hay que completar todos los resultados de la pantalla. Los cuatro números son una muestra visual; no son la partida.',
          'Muestra el token 13 y el terminal 5. Pulsa «Mostrar resultat» para descubrir el 18 y repite el ejemplo si hace falta.',
          'Explica la coordinación y las condiciones actuales de Sumes: una suma incorrecta o repetida reinicia los objetivos.',
          'Comprueba que los jugadores están preparados. El control «Comenzar partida real» del GM activa la cuenta atrás y la entrada al juego.'
        ]
      },
      eng: {
        name: window.PyramidPuzzleNames.name(1,'eng'), nextChallenge: 'The next challenge', brand: 'La Piràmide',
        coverTitle: 'EXTREME<br>CALCULATION', slogan: 'One team. One shared challenge.', coverLead: 'Combine your values.<br>Complete the challenge together.',
        objectiveTitle: 'ONE SHARED<br>OBJECTIVE.', objectiveLead: 'Complete every target number<br>shown on the screen.', targetLabel: 'Example targets',
        exampleTitle: 'HOW DOES IT WORK?', exampleLead: 'The token value + the terminal value.', exampleLabel: 'Example', token: 'Your token', terminal: 'A terminal', result: 'A target number',
        coordinateTitle: 'WORK TOGETHER.', coordinateLead: 'Complete each target only once.', solved: 'Completed', pending: 'Pending', warning: 'An incorrect or repeated sum resets the targets.',
        readyTitle: 'EVERYONE<br>READY?', readyLead: 'Ten terminals. One team.', readyFooter: 'The GM gives the starting signal.',
        countdownLabel: 'We start together', go: 'GO!',
        footers: ['Listen to the Game Master.', 'Find the combinations you need.', 'Match a token with a terminal.', 'Talk. Share your combinations.', 'The GM gives the starting signal.'],
        stepLabels: ['Introduction', 'Objective', 'Example', 'Coordination', 'Ready'],
        notes: [
          'Introduce the challenge and the shared goal. This screen waits until you advance.',
          'Explain that every target on the screen must be completed. These four numbers are an illustration, not the live game.',
          'Show token 13 and terminal 5. Use «Mostrar resultat» to reveal 18 and repeat the example if needed.',
          'Explain the current Sumes rules: an incorrect or repeated sum resets the targets.',
          'Check that everyone is ready. Only «Començar» or Enter starts the countdown and enters the game.'
        ]
      }
    }
  };
  const local = (ca,es,eng) => ({ca,es,eng});
  const common = {
    ca: {nextChallenge:'La següent prova',brand:'La Piràmide',slogan:'El repte és de tots.',readyTitle:'TOTHOM<br>PREPARAT?',readyLead:'Deu terminals. Un únic equip.',countdownLabel:'Comencem tots alhora',go:'JA!',stepLabels:['Presentació','Objectiu','Exemple','Coordinació','Preparats'],footers:['Escolteu el Game Master.','Un objectiu compartit.','Exemple: no és la partida.','Parleu-vos. Organitzeu-vos.','El GM dona el senyal de sortida.'],solved:'Ja completat',pending:'Pendent',exampleLabel:'Exemple'},
    es: {nextChallenge:'La siguiente prueba',brand:'La Pirámide',slogan:'El reto es de todos.',readyTitle:'¿TODOS<br>PREPARADOS?',readyLead:'Diez terminales. Un único equipo.',countdownLabel:'Empezamos todos a la vez',go:'¡YA!',stepLabels:['Presentación','Objetivo','Ejemplo','Coordinación','Preparados'],footers:['Escuchad al Game Master.','Un objetivo compartido.','Ejemplo: no es la partida.','Hablad. Organizaos.','El GM da la señal de salida.'],solved:'Completado',pending:'Pendiente',exampleLabel:'Ejemplo'},
    eng: {nextChallenge:'The next challenge',brand:'La Piràmide',slogan:'One team. One shared challenge.',readyTitle:'EVERYONE<br>READY?',readyLead:'Ten terminals. One team.',countdownLabel:'We start together',go:'GO!',stepLabels:['Introduction','Objective','Example','Coordination','Ready'],footers:['Listen to the Game Master.','One shared goal.','Example: not the live game.','Talk. Organise yourselves.','The GM gives the starting signal.'],solved:'Completed',pending:'Pending',exampleLabel:'Example'}
  };
  // No fixed round counts, time limits or penalties copied from obsolete voiceovers.
  const puzzles = [
    {id:11,key:'practice',title:local('PRIMER<br>CONTACTE','PRIMER<br>CONTACTO','FIRST<br>CONTACT'),goal:local('CONEIXEU<br>EL SISTEMA.','Familiarizarse con el sistema siguiendo las instrucciones de la pantalla.','LEARN<br>THE SYSTEM.'),lead:local('Seguiu les accions de la pantalla, pas a pas.','Familiarizarse con el sistema siguiendo las instrucciones de la pantalla.','Follow the actions on screen, step by step.'),demo:local('Token → terminal → botó indicat','Tokens y terminales.','Token → terminal → indicated button'),team:local('OBSERVEU.<br>APRENEU.','OBSERVAD.<br>APRENDED.','WATCH.<br>LEARN.'),rule:local('Mentre una persona actua, les altres segueixen la seqüència.','Mirad la pantalla → realizad la acción indicada → esperad la siguiente instrucción.','While one person acts, everyone else follows the sequence.')},
    {id:2,key:'maze',title:local('UN CAMÍ<br>COMPARTIT','UN CAMINO<br>COMPARTIDO','A SHARED<br>PATH'),goal:local('COMPLETEU<br>LA SERP.','COMPLETAD<br>LA SERPIENTE.','COMPLETE<br>THE SNAKE.'),lead:local('Busqueu la serp del vostre token i trobeu les seves formes als terminals, en ordre.','Buscad la serpiente de vuestro token y encontrad sus formas en los terminales, en orden.','Find your token’s snake and match its shapes at the terminals, in order.'),demo:local('Normal: mateix símbol. Alarma: símbol contrari.','Normal: mismo símbolo. Alarma: símbolo contrario.','Normal: matching symbol. Alarm: opposite symbol.'),team:local('ADAPTEU<br>EL CAMÍ.','ADAPTAD<br>EL CAMINO.','ADAPT<br>YOUR PATH.'),rule:local('Quan s’activa l’alarma, canvia la correspondència dels símbols.','Cuando se activa la alarma, cambia la correspondencia de los símbolos.','When the alarm starts, the symbol mapping changes.')},
    {id:3,key:'quiz',title:local('DECIDIU<br>JUNTS','DECIDID<br>JUNTOS','DECIDE<br>TOGETHER'),goal:local('CLASSIFIQUEU<br>LES OPCIONS.','CLASIFICAD<br>LAS OPCIONES.','CLASSIFY<br>THE OPTIONS.'),lead:local('Cada número correspon a un terminal. Decidiu si la seva opció compleix la pregunta.','Cada número corresponde a un terminal. Decidid si su opción cumple la pregunta.','Each number corresponds to a terminal. Decide whether its option matches the question.'),demo:local('Terminal 3: verd si l’opció encaixa; vermell si no.','Terminal 3: verde si la opción encaja; rojo si no.','Terminal 3: green if the option matches; red if it does not.'),team:local('COMPARTIU<br>EL QUE SABEU.','COMPARTID<br>LO QUE SABÉIS.','SHARE<br>WHAT YOU KNOW.'),rule:local('Cada terminal respon la seva opció. Ajudeu-vos abans de prémer.','Cada terminal responde su opción. Ayudaos antes de pulsar.','Each terminal answers its own option. Help each other before pressing.')},
    {id:8,key:'memory',title:local('RECORDEU<br>JUNTS','RECORDAD<br>JUNTOS','REMEMBER<br>TOGETHER'),goal:local('MEMORITZEU<br>LES DUES FORMES.','MEMORIZAD<br>LAS DOS FORMAS.','REMEMBER<br>BOTH SHAPES.'),lead:local('Localitzeu el vostre token i recordeu les dues formes amb els seus colors.','Localizad vuestro token y recordad las dos formas con sus colores.','Find your token and remember both shapes and their colours.'),demo:local('Token → dues formes i colors → dos terminals','Token → dos formas y colores → dos terminales','Token → two shapes and colours → two terminals'),team:local('OBSERVEU.<br>RECORDEU.','OBSERVAD.<br>RECORDAD.','WATCH.<br>REMEMBER.'),rule:local('Quan desapareguin, passeu el vostre token pels dos terminals corresponents, en qualsevol ordre.','Cuando desaparezcan, pasad vuestro token por los dos terminales correspondientes, en cualquier orden.','Once they disappear, scan your token at the two matching terminals, in either order.')},
    {id:10,key:'segments',title:local('COLORS<br>EN EQUIP','COLORES<br>EN EQUIPO','COLOURS<br>AS A TEAM'),goal:local('COMPLETEU<br>ELS COLORS.','COMPLETAD<br>LOS COLORES.','COMPLETE<br>THE COLOURS.'),lead:local('Cada terminal té una combinació objectiu.','Cada terminal tiene una combinación objetivo.','Each terminal has a target combination.'),demo:local('Descobriu els vostres colors i aporteu-los on calgui.','Descubrid vuestros colores y aportadlos donde hagan falta.','Discover your colours and use them where they are needed.'),team:local('COMBINEU<br>ELS TOKENS.','COMBINAD<br>LOS TOKENS.','COMBINE<br>YOUR TOKENS.'),rule:local('Un mateix terminal pot necessitar l’aportació de diferents tokens.','Un mismo terminal puede necesitar la aportación de distintos tokens.','One terminal may need contributions from several tokens.')},
    {id:5,key:'time',title:local('EL TEMPS<br>A LES MANS','EL TIEMPO<br>EN LAS MANOS','TIME<br>IN YOUR HANDS'),goal:local('COMPTEU<br>AMB PRECISIÓ.','CONTAD<br>CON PRECISIÓN.','COUNT<br>PRECISELY.'),lead:local('Mesureu mentalment el temps indicat a la pantalla.','Medid mentalmente el tiempo indicado en la pantalla.','Count the time shown on screen in your head.'),demo:local('Llum encesa → compteu → passeu el token','Luz encendida → contad → pasad el token','Light on → count → scan your token'),team:local('CADA TERMINAL.<br>EL SEU SENYAL.','CADA TERMINAL.<br>SU SEÑAL.','EACH TERMINAL.<br>ITS OWN SIGNAL.'),rule:local('Comenceu quan s’encengui la vostra llum. L’error se suma al de l’equip.','Empezad cuando se encienda vuestra luz. El error se suma al del equipo.','Start when your light turns on. Your error adds to the team total.')},
    {id:12,key:'buttons',title:local('PREMEU<br>JUNTS','PULSAD<br>JUNTOS','PRESS<br>TOGETHER'),goal:local('REPRODUÏU<br>EL PATRÓ.','REPRODUCID<br>EL PATRÓN.','MATCH<br>THE PATTERN.'),lead:local('Cada bola representa un botó premut del mateix color.','Cada bola representa un botón pulsado del mismo color.','Each ball represents a pressed button of the same colour.'),demo:local('Dues boles blaves → dos botons blaus premuts','Dos bolas azules → dos botones azules pulsados','Two blue balls → two blue buttons held'),team:local('REPARTIU.<br>MANTENIU.','REPARTID.<br>MANTENED.','DISTRIBUTE.<br>HOLD.'),rule:local('Repartiu els botons i manteniu el patró fins que es validi.','Repartid los botones y mantened el patrón hasta que se valide.','Distribute the buttons and hold the pattern until it is validated.')},
    {id:4,key:'music',title:local('UN SOL<br>RITME','UN SOLO<br>RITMO','ONE SHARED<br>RHYTHM'),goal:local('RECONSTRUÏU<br>LA CANÇÓ.','RECONSTRUID<br>LA CANCIÓN.','REBUILD<br>THE SONG.'),lead:local('Escolteu, localitzeu els fragments i ordeneu-los.','Escuchad, localizad los fragmentos y ordenadlos.','Listen, find the fragments and put them in order.'),demo:local('Per registrar: botó verd → token → següent fragment','Para registrar: botón verde → token → siguiente fragmento','To register: green button → token → next fragment'),team:local('ESCOLTEU.<br>ORDENEU.','ESCUCHAD.<br>ORDENAD.','LISTEN.<br>ORDER.'),rule:local('Diferencieu escoltar un fragment de registrar-lo en la seqüència.','Diferenciad escuchar un fragmento de registrarlo en la secuencia.','Distinguish listening to a fragment from registering it in the sequence.')},
    {id:6,key:'energy',title:local('L’ÚLTIM<br>IMPULS','EL ÚLTIMO<br>IMPULSO','THE FINAL<br>PUSH'),goal:local('MANTENIU<br>L’ENERGIA.','MANTENED<br>LA ENERGÍA.','KEEP<br>THE ENERGY.'),lead:local('Eviteu que s’apaguin les llums dels terminals.','Evitad que se apaguen las luces de los terminales.','Keep the terminal lights from going out.'),demo:local('El vostre color s’encén → aneu al terminal → passeu el token','Se enciende vuestro color → id al terminal → pasad el token','Your colour lights up → reach the terminal → scan your token'),team:local('ATENCIÓ.<br>MOVIMENT.','ATENCIÓN.<br>MOVIMIENTO.','ATTENTION.<br>MOVEMENT.'),rule:local('Cada token té un color assignat. Estigueu pendents dels terminals.','Cada token tiene un color asignado. Estad pendientes de los terminales.','Each token has an assigned colour. Watch the terminals.')}
  ];
  const notes = local('El GM explica aquesta pantalla. L’exemple és il·lustratiu. Confirmeu les regles abans de la sessió si s’ha modificat el joc.','El GM explica esta pantalla. El ejemplo es ilustrativo. Confirmad las reglas antes de la sesión si se ha modificado el juego.','The GM explains this screen. The example is illustrative. Confirm the rules before the session if the game has changed.');
  const readyNotes=local('Comprova que tothom està preparat abans de començar la prova.','Comprueba que todos estén preparados antes de comenzar la prueba.','Check everyone is ready before starting the challenge.');
  function puzzle(data) {
    const copy={};
    for(const lang of ['ca','es','eng']) copy[lang]={...common[lang],name:window.PyramidPuzzleNames.name(data.id,lang),coverTitle:data.title[lang],coverLead:data.lead[lang],objectiveTitle:data.goal[lang],objectiveLead:data.lead[lang],exampleTitle:lang==='ca'?'COM FUNCIONA?':lang==='es'?'¿CÓMO FUNCIONA?':'HOW DOES IT WORK?',exampleLead:data.demo[lang],coordinateTitle:data.team[lang],coordinateLead:data.rule[lang],warning:data.rule[lang],notes:[notes[lang],data.lead[lang],data.demo[lang],data.rule[lang],readyNotes[lang]]};
    return {id:data.key,puzzleId:data.id,kind:'puzzle',gamePath:'/puzzle/'+data.id,steps:['cover','objective','example','coordination','ready'],copy,assets:sums.assets,visual:data.key,example:sums.example};
  }
  const byId=new Map(puzzles.map(p=>[p.id,puzzle(p)])); byId.set(1,{...sums,kind:'puzzle',visual:'sumas'});
  function scene(id,kind,title,lead,steps=['cover']) {
    const copy={};for(const lang of ['ca','es','eng']) copy[lang]={...common[lang],name:common[lang].brand,coverTitle:title[lang],coverLead:lead[lang],stepLabels:steps.map((s,i)=>kind==='opening'?(lang==='ca'?['Un únic equip','Tokens i terminals'][i]:lang==='es'?['Un único equipo','Tokens y terminales'][i]:['One team','Tokens and terminals'][i]):kind==='closing'?(lang==='ca'?['Repte completat','Tancament'][i]:lang==='es'?['Reto completado','Cierre'][i]:['Challenge completed','Closing'][i]):title[lang].replaceAll('<br>',' ')),notes:steps.map(()=>lead[lang]),footers:steps.map(()=>common[lang].slogan)};
    const autoAdvanceMs=null;
    return {id,kind,steps,copy,assets:sums.assets,example:sums.example,autoAdvanceMs};
  }
  const requested=(page?.order?.join(',')??params.get('order')??'2,1,8,3,5,12,4').split(',').map(Number);
  const tutorialId=page?.tutorialId||11,finalId=page?.finalId||6;
  const order=[...new Set(requested.filter(id=>byId.has(id)&&id!==finalId&&id!==tutorialId))];
  // The configured full order is shared with MQTT. Split it for presentation only.
  const trivialIndex=order.indexOf(3);
  const journey={tutorialId,finalId,trivialId:trivialIndex<0?null:3,
    pre:trivialIndex<0?order:order.slice(0,trivialIndex),
    post:trivialIndex<0?[]:order.slice(trivialIndex+1)};
  const flow=[scene('welcome','welcome',local('LA<br>PIRÀMIDE','LA<br>PIRÁMIDE','LA<br>PIRÀMIDE'),local('Deu terminals. Un únic equip.','Diez terminales. Un único equipo.','Ten terminals. One team.')),
    scene('opening','opening',local('EL REPTE<br>ÉS DE TOTS.','EL RETO<br>ES DE TODOS.','ONE TEAM.<br>ONE CHALLENGE.'),local('Compartiu informació. Combineu les vostres habilitats.','Compartid información. Combinad vuestras habilidades.','Share information. Combine your skills.'),window.PyramidOpeningStory.forJourney(journey).map(b=>b.id))];
  flow[1].journey=journey;
  flow[1].story=window.PyramidOpeningStory.forJourney(journey);
  flow[1].autoAdvanceMs=flow[1].story.map(b=>b.seconds*1000);
  const acts=[
    {id:1,colour:'#39d6e5',name:local('Descobrir','Descubrir','Discover'),role:local('Repartiu qui observa, qui comunica i qui actua.','Repartid quién observa, quién comunica y quién actúa.','Share observing, communicating and acting.')},
    {id:2,colour:'#dc68a7',name:local('Organitzar-se','Organizarse','Organise'),role:local('Canvieu els papers perquè tothom tingui una aportació.','Cambiad los papeles para que todos tengan una aportación.','Switch roles so everyone has a part to play.')},
    {id:3,colour:'#edb970',name:local('Actuar junts','Actuar juntos','Act together'),role:local('Confirmeu el pla junts abans d’actuar.','Confirmad el plan juntos antes de actuar.','Agree on the plan before acting.')}
  ];
  const actFor=id=>acts[[tutorialId,2,3].includes(id)?0:[8,1,5].includes(id)?1:2];
  let completed=0;
  const total=order.length+1; // The final challenge earns the summit; practice earns confidence.
  // Approved Spanish briefings and their complete Catalan equivalents.
  const reviewedCopy={
    8:{objective:'Recordar las formas y sus colores.',tools:'Tokens y botones de colores.',action:'Buscad vuestro token → memorizad las formas y sus colores → buscad las formas → introducid los colores.',attention:['Las formas se pueden introducir en cualquier orden.','Un solo error reinicia la ronda.']},
    1:{objective:'Resolver las sumas antes de que la cuenta atrás llegue a 0.',tools:'Tokens y números de los terminales.',action:'Identificad el número de vuestro token → buscad el número que completa la suma → acercad el token al terminal.',attention:['Si resolvéis una suma incorrectamente, la ronda se reiniciará.','Si resolvéis una suma que ya ha sido completada, la ronda se reiniciará.']},
    5:{objective:'Contar el tiempo exacto que aparece en pantalla.',tools:'Token y terminal.',action:'Memorizad el tiempo → esperad a que se encienda vuestro terminal → contad el tiempo → acercad el token al terminal.',attention:['Los segundos de más o de menos se sumarán al error común. Si se supera el margen de error permitido, la ronda se reiniciará.']},
    12:{objective:'Pulsar tantos botones como aparezcan en pantalla antes de que se acabe el tiempo.',tools:'Botones de los terminales.',action:'Contad las bolas → coordinad al equipo → pulsad el número exacto de botones → mantenedlos pulsados durante 3 segundos.',attention:['Si la cuenta atrás llega a 0, los botones indicados en pantalla cambiarán.']},
    4:{objective:'Reconstruir y ordenar los fragmentos de la canción.',tools:'Tokens y terminales.',action:'Escuchad la canción → identificad el fragmento → marcadlo → buscad el siguiente.',attention:['Esta prueba tiene dos rondas.']},
    6:{objective:'Mantener las luces encendidas hasta que la cuenta atrás llegue a 0.',tools:'Tokens y luces de los terminales.',action:'Identificad el color de vuestro token → buscad la luz del mismo color → acercad el token → continuad con el siguiente color.'}
  };
  const reviewedCatalan={
  "11": {
    "objective": "Familiaritzar-se amb el sistema seguint les instruccions de la pantalla.",
    "tools": "Tokens i terminals.",
    "action": "Mireu la pantalla → feu l’acció indicada → espereu la instrucció següent."
  },
  "2": {
    "objective": "Completar la serp corresponent a cada token.",
    "tools": "Tokens i símbols dels terminals.",
    "action": "Identifiqueu la vostra serp → busqueu els símbols en l’ordre indicat → passeu el token per cada terminal.",
    "attention": [
      "Quan soni l’alarma, les serps es tornaran vermelles. Els símbols de la pantalla no canvien: busqueu als terminals el mateix símbol amb els colors invertits."
    ]
  },
  "3": {
    "objective": "Identificar les 4 respostes correctes.",
    "tools": "Botons dels terminals.",
    "action": "Llegiu la pregunta → identifiqueu les respostes correctes → marqueu cada resposta al seu terminal.",
    "attention": [
      "Les respostes de cada terminal es poden canviar fins que s’hagi introduït una resposta a tots els terminals."
    ]
  },
  "8": {
    "objective": "Recordar les formes i els seus colors.",
    "tools": "Tokens i botons de colors.",
    "action": "Busqueu el vostre token → memoritzeu les formes i els seus colors → busqueu les formes → introduïu els colors.",
    "attention": [
      "Les formes es poden introduir en qualsevol ordre.",
      "Un sol error reinicia la ronda."
    ]
  },
  "1": {
    "objective": "Resoldre les sumes abans que el compte enrere arribi a 0.",
    "tools": "Tokens i números dels terminals.",
    "action": "Identifiqueu el número del vostre token → busqueu el número que completa la suma → acosteu el token al terminal.",
    "attention": [
      "Si resoleu una suma incorrectament, la ronda es reiniciarà.",
      "Si resoleu una suma que ja s’ha completat, la ronda es reiniciarà."
    ]
  },
  "5": {
    "objective": "Comptar el temps exacte que apareix a la pantalla.",
    "tools": "Token i terminal.",
    "action": "Memoritzeu el temps → espereu que s’encengui el vostre terminal → compteu el temps → acosteu el token al terminal.",
    "attention": [
      "Els segons de més o de menys se sumaran a l’error comú. Si se supera el marge d’error permès, la ronda es reiniciarà."
    ]
  },
  "12": {
    "objective": "Prémer tants botons com apareguin a la pantalla abans que s’acabi el temps.",
    "tools": "Botons dels terminals.",
    "action": "Compteu les boles → coordineu l’equip → premeu el nombre exacte de botons → manteniu-los premuts durant 3 segons.",
    "attention": [
      "Si el compte enrere arriba a 0, els botons indicats a la pantalla canviaran."
    ]
  },
  "4": {
    "objective": "Reconstruir i ordenar els fragments de la cançó.",
    "tools": "Tokens i terminals.",
    "action": "Escolteu la cançó → identifiqueu el fragment → marqueu-lo → busqueu el següent.",
    "attention": [
      "Aquesta prova té dues rondes."
    ]
  },
  "6": {
    "objective": "Mantenir els llums encesos fins que el compte enrere arribi a 0.",
    "tools": "Tokens i llums dels terminals.",
    "action": "Identifiqueu el color del vostre token → busqueu el llum del mateix color → acosteu-hi el token → continueu amb el color següent."
  }
};
  for(const id of [tutorialId,...order,finalId]) {
    const intro=byId.get(id);intro.completed=completed;intro.total=total;
    intro.act=actFor(id);intro.isFinal=id===finalId;
    intro.steps=id===tutorialId?['elements','objective','tools','interaction']:id===journey.trivialId?['journey','objective','tools','interaction']:['objective','tools','interaction'];
    if(id===tutorialId)intro.elementsCopy={es:{title:'LA MISIÓN ESTÁ EN VUESTRAS MANOS',tokenTitle:'VUESTRO TOKEN ES PERSONAL',tokenLead:'Conservad el vuestro durante toda la partida.',terminalTitle:'LOS TERMINALES',terminalLead:'Botones, luces y símbolos para resolver los retos.',action:'Acercad vuestro token al lector del terminal para interactuar.',team:'Un único equipo: compartid información y coordinaos.',notes:'El token es personal: cada persona o pareja conserva el suyo durante toda la partida. Mostrad el lector de un terminal y cómo acercar el token para interactuar. Los terminales contienen botones, luces y símbolos. El nivel requiere trabajar en equipo: compartid lo que encontréis y coordinaos. Después explicad el Simulacro Inicial; esta pantalla no inicia la práctica.'}};
    if(id===2){
      intro.attentionCopy={es:{text:'Cuando suene la alarma, las serpientes se pondrán rojas. Los símbolos de la pantalla no cambian: buscad en los terminales el mismo símbolo con los colores invertidos.',before:4,after:5}};
      intro.steps.push('attention');
      Object.assign(intro.copy.es,{objectiveTitle:'Completar la serpiente correspondiente a cada token.',objectiveLead:'Completar la serpiente correspondiente a cada token.',exampleLead:'Tokens y símbolos de los terminales.',warning:'Identificad vuestra serpiente → buscad los símbolos en el orden indicado → pasad el token por cada terminal.',coordinateLead:'Identificad vuestra serpiente → buscad los símbolos en el orden indicado → pasad el token por cada terminal.'});
    }
    if(id===3){
      intro.attentionCopy={es:{text:'Las respuestas de cada terminal se pueden cambiar hasta que se haya introducido una respuesta en todos los terminales.'}};
      intro.steps.push('attention');
      Object.assign(intro.copy.es,{objectiveTitle:'Identificar las 4 respuestas correctas.',objectiveLead:'Identificar las 4 respuestas correctas.',exampleLead:'Botones de los terminales.',warning:'Leed la pregunta → identificad las respuestas correctas → marcad cada respuesta en su terminal.',coordinateLead:'Leed la pregunta → identificad las respuestas correctas → marcad cada respuesta en su terminal.'});
    }
    if(reviewedCopy[id]){
      const approved=reviewedCopy[id];
      intro.reviewedBriefing=true;
      Object.assign(intro.copy.es,{objectiveTitle:approved.objective,objectiveLead:approved.objective,exampleLead:approved.tools,warning:approved.action,coordinateLead:approved.action});
      if(approved.attention){
        intro.attentionCopy={es:{text:approved.attention.join(' '),paragraphs:approved.attention}};
        intro.steps.push('attention');
      }
    }
    const catalan = reviewedCatalan[id];
    if(catalan){
      Object.assign(intro.copy.ca,{objectiveTitle:catalan.objective,objectiveLead:catalan.objective,exampleLead:catalan.tools,warning:catalan.action,coordinateLead:catalan.action});
      if(catalan.attention)intro.attentionCopy.ca={text:catalan.attention.join(' '),paragraphs:catalan.attention,...(id===2?{before:4,after:5}:{})};
    }
    if(id===tutorialId)intro.elementsCopy.ca={title:'LA MISSIÓ ÉS A LES VOSTRES MANS',tokenTitle:'EL VOSTRE TOKEN ÉS PERSONAL',tokenLead:'Conserveu el vostre durant tota la partida.',terminalTitle:'ELS TERMINALS',terminalLead:'Botons, llums i símbols per resoldre els reptes.',action:'Acosteu el vostre token al lector del terminal per interactuar.',team:'Un únic equip: compartiu informació i coordineu-vos.',notes:'El token és personal: cada persona o parella conserva el seu durant tota la partida. Mostra el lector, els botons, els llums i els símbols del terminal. Per interactuar, cal acostar el token al lector.'};
    intro.journey=journey;
    if(id===3)intro.accent='#dc68a7';
    intro.incremental=true;
    intro.steps.unshift('title');
    intro.autoAdvanceMs=intro.steps.map(screen=>screen==='title'?4200:0);
    for(const lang of ['ca','es','eng']) {
      const t=intro.copy[lang];

      const rule=t.warning||t.coordinateLead;
      t.stepLabels=[local('Objectiu','Objetivo','Goal')[lang],local('Terminals i tokens','Herramientas','Terminals and tokens')[lang],local('Interacció','Interacción','Interaction')[lang]];
      t.notes=[t.objectiveLead,t.exampleLead,rule];
      t.footers=[local('Observeu el repte.','Observad el reto.','Look at the challenge.')[lang],local('Aquestes són les vostres eines.','Estas son vuestras herramientas.','These are your tools.')[lang],intro.act.role[lang]];
      t.guidance={role:intro.act.role[lang],hints:[t.objectiveLead,t.exampleLead,rule],rhythm:local('Doneu temps per pensar. Si el grup no sap què fer, oferiu una ajuda; si està provant un pla, deixeu-lo jugar.','Dad tiempo para pensar. Si el grupo no sabe qué hacer, ofreced una ayuda; si está probando un plan, dejadlo jugar.','Allow thinking time. Offer a hint if the group does not know what to do; let them play if they are testing a plan.')[lang]};
      if(id===4){
        const registrationNote=local('Per registrar cada fragment, primer premeu el botó verd i després passeu el token pel terminal del fragment escollit. Cal tornar a prémer el botó verd abans de registrar el fragment següent. Passar el token sense activar el registre només reprodueix el fragment.','Para registrar cada fragmento, pulsad primero el botón verde y después pasad el token por el terminal del fragmento elegido. Hay que volver a pulsar el botón verde antes de registrar el siguiente fragmento. Pasar el token sin activar el registro solo reproduce el fragmento.','To register each fragment, first press the green button, then scan the token at the terminal for the chosen fragment. Press the green button again before registering the next fragment. Scanning the token without enabling recording only plays the fragment.')[lang];
        t.notes[2]+=' '+registrationNote;
        t.guidance.hints[2]+=' '+registrationNote;
      }
      if(['es','ca'].includes(lang)&&intro.reviewedBriefing)t.stepLabels=lang==='ca'?['Objectiu','Eines','Acció']:['Objetivo','Herramientas','Acción'];
      if(intro.attentionCopy){
        if(['es','ca'].includes(lang))t.stepLabels=lang==='ca'?['Objectiu','Eines','Acció']:['Objetivo','Herramientas','Acción'];
        t.stepLabels.push(local('Atenció','Atención','Attention')[lang]);
        t.notes.push((intro.attentionCopy[lang]||intro.attentionCopy.es).text);
        t.footers.push('');
      }
      if(id===5) {
        t.notes[t.notes.length-1]+=local(' En iniciar, s’obre la preparació: memoritzeu el temps objectiu durant el compte enrere i comenceu a comptar quan s’encengui el vostre terminal.',' Al iniciar se abre la preparación: memorizad el tiempo objetivo durante la cuenta atrás y empezad a contar cuando se encienda vuestro terminal.',' Starting opens preparation: memorise the target time during the countdown and start counting when your terminal lights up.')[lang];
      }
      if(id===tutorialId){
        if(['es','ca'].includes(lang))t.stepLabels=lang==='ca'?['Objectiu','Eines','Acció']:['Objetivo','Herramientas','Acción'];
        // Spanish editorial draft; translations follow approval of the full content.
        const elements=intro.elementsCopy[lang]||intro.elementsCopy.es;
        t.stepLabels.unshift(local('La missió és a les vostres mans','La misión está en vuestras manos','The mission is in your hands')[lang]);
        t.notes.unshift(elements.notes);
        t.footers.unshift(elements.team);
      }
      if(id===journey.trivialId){
        t.stepLabels.unshift(local('El recorregut','El recorrido','The journey')[lang]);
        t.notes.unshift(local('Ara arriba el QUIZ: compartiu el que sabeu i decidiu junts. Després vindrà el segon bloc de reptes i el final. El mapa presenta el primer bloc com a superat en arribar a aquesta etapa; no modifica la puntuació ni els assoliments de la piràmide.','Ahora llega el QUIZ: compartid lo que sabéis y decidid juntos. Después vendrá el segundo bloque de retos y el final. El mapa presenta el primer bloque como superado al llegar a esta etapa; no modifica la puntuación ni los logros de la pirámide.','Now comes the QUIZ: share what you know and decide together. The second block of challenges and the final come next. The map presents the first block as completed at this stage; it does not change the score or earned pyramid progress.')[lang]);
        t.footers.unshift(local('Compartiu el que sabeu. Decidiu junts.','Compartid lo que sabéis. Decidid juntos.','Share what you know. Decide together.')[lang]);
      }
    }
    for(const lang of ['ca','es','eng']){
      intro.copy[lang].stepLabels.unshift(local('Presentació de la prova','Presentación de la prueba','Challenge introduction')[lang]);
      intro.copy[lang].notes.unshift(local('Entrada automàtica del nom de la prova, de 4,2 segons. Després apareix l’explicació; els passos següents i l’inici del joc continuen al teu control.','Entrada automática del nombre de la prueba, de 4,2 segundos. Después aparece la explicación; los pasos siguientes y el inicio del juego siguen bajo tu control.','Automatic 4.2-second challenge title. The briefing follows; you still control its remaining steps and the game start.')[lang]);
      intro.copy[lang].footers.unshift('');
    }
    flow.push(intro);
    if(id===finalId)break;
    const previous=completed;
    if(id!==tutorialId)completed++;
    const following=[...order,finalId][id===tutorialId?0:order.indexOf(id)+1];
    const beforeFinal=following===finalId;
    const success=scene('success-'+id,'success',id===tutorialId?local('JA SOU<br>UN EQUIP.','YA SOIS<br>UN EQUIPO.','YOU ARE<br>A TEAM.'):beforeFinal?local('EL CIM<br>US ESPERA.','LA CIMA<br>OS ESPERA.','THE SUMMIT<br>IS WAITING.'):local('UN PAS<br>MÉS AMUNT.','UN PASO<br>MÁS ARRIBA.','ONE STEP<br>HIGHER.'),local('Cada aportació compta.','Cada aportación cuenta.','Every contribution counts.'));
    success.completed=completed;success.previous=previous;success.total=total;success.afterPuzzle=id;success.nextPuzzleId=following;success.act=actFor(following);success.beforeFinal=beforeFinal;
    for(const lang of ['ca','es','eng']){
      const t=success.copy[lang];t.name=local('Assoliment','Logro','Achievement')[lang]+' · '+intro.copy[lang].name;
      t.nextName=byId.get(following).copy[lang].name;t.footers=[success.act.role[lang]];
      t.notes=[id===tutorialId?local('Primera victòria. Celebreu l’aprenentatge; la piràmide s’omple amb els reptes següents.','Primera victoria. Celebrad el aprendizaje; la pirámide se llena con los siguientes retos.','First win. Celebrate learning; the following challenges fill the pyramid.')[lang]:local('Celebreu-ho amb el grup. El progrés es manté fins que obriu la presentació següent.','Celebradlo con el grupo. El progreso se mantiene hasta que abráis la siguiente presentación.','Celebrate with the team. Progress remains on screen until you open the next briefing.')[lang]];
    }
    flow.push(success);
  }
  const closing=scene('closing','closing',local('LA PIRÀMIDE<br>ÉS VOSTRA.','LA PIRÁMIDE<br>ES VUESTRA.','THE PYRAMID<br>IS YOURS.'),local('Ho heu aconseguit junts.','Lo habéis conseguido juntos.','You achieved it together.'),['cover','thanks']);
  closing.completed=total;closing.previous=total-1;closing.total=total;closing.act=acts[2];closing.autoAdvanceMs=[11000,0];
  for(const lang of ['ca','es','eng'])closing.copy[lang].notes=[local('Celebreu-ho amb el grup. El tancament passa sol a la pantalla de foto.','Celebradlo con el grupo. El cierre pasa solo a la pantalla de foto.','Celebrate with the group. The finale continues automatically to the photo screen.')[lang],local('Pantalla de foto. Pregunteu: què heu aconseguit perquè heu treballat junts?','Pantalla de foto. Preguntad: ¿qué habéis conseguido porque habéis trabajado juntos?','Photo screen. Ask: what did working together make possible?')[lang]];
  if(window.PyramidClosing){
    closing.copy.ca.name='Tancament · La Piràmide';
    closing.copy.ca.stepLabels=['Aquest moment és vostre','Foto d’equip'];
    closing.copy.ca.notes=[
      'Tancament automàtic: 10 s de càrrega i 50,4 s de locució catalana. La veu governa els subtítols i el pas a la foto. Deixa gaudir el grup; pots pausar, repetir o avançar a la foto. Guió: '+PyramidClosing.recording('ca').cues.map(c=>c.text.replaceAll('\n',' ')).join(' '),
      'Composició estable per a la foto. Recull l’aplaudiment: «Missió complerta, equip! Acosteu-vos, que aquesta foto és vostra». Repetir torna a iniciar el tancament sense sumar progrés.'
    ];
    closing.copy.es.name='Cierre · La Pirámide';
    closing.copy.es.stepLabels=['Este momento es vuestro','Foto de equipo'];
    closing.copy.es.notes=[
      'Cierre automático en castellano · 78 s provisionales: 10 s de carga y 68 s de mensaje, con música y subtítulos. Locución pendiente de ElevenLabs. Deja que el grupo disfrute del final; puedes pausar, repetir o avanzar a la foto. Guion: '+PyramidClosing.narration,
      'Composición estable para la foto. Recoge el aplauso: «¡Misión cumplida, equipo! Acercaos, que esta foto es vuestra». Repetir vuelve a iniciar el cierre sin sumar progreso.'
    ];
  }
  flow.push(closing);
  for(const lang of ['ca','es','eng']) {
    const t=flow[1].copy[lang];
    t.stepLabels=flow[1].story.map(b=>b.label[lang]);
    t.notes=flow[1].story.map(b=>b.id==='hold'?b.voice[lang]:window.PyramidOpeningStory.recording(lang)?'Locució: '+b.voice[lang]:local('Guió de veu (gravació pendent): ','Guion de voz (grabación pendiente): ','Voice script (recording pending): ')[lang]+b.voice[lang]);
    t.footers=t.stepLabels.map(()=>t.slogan);
  }
  window.PyramidActs=acts;
  window.PyramidFlow=flow;
})();
