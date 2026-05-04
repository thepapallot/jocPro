(function () {
  const activePuzzleOrder = Array.isArray(window.TEST_ACTIVE_PUZZLE_ORDER)
    ? window.TEST_ACTIVE_PUZZLE_ORDER.map((id) => String(id))
    : [];
  const puzzleAliases = window.TEST_PUZZLE_ALIASES || {};
  const tutorialPuzzleId = String(window.TEST_PUZZLE_TUTORIAL ?? "").trim();
  const finalPuzzleId = String(window.TEST_PUZZLE_FINAL ?? "").trim();
  const defaultSubtitleLangRaw = String(window.TEST_DEFAULT_SUBTITLE_LANG || "es").trim().toLowerCase();
  const defaultSubtitleLang = defaultSubtitleLangRaw === "en" ? "eng" : (defaultSubtitleLangRaw === "eng" ? "eng" : "es");
  const finalPuzzleMqttId = finalPuzzleId || "6";
  function getStoredGameLanguageForPlayer() {
    try {
      const session = JSON.parse(window.localStorage.getItem("gmPanelActiveSession") || "null");
      const lang = session?.gameLanguage || defaultSubtitleLang;
      // The session keeps ca/es/eng. Player subtitles currently expose es/eng,
      // so Catalan falls back to es until Catalan scene assets exist.
      return lang === "eng" || lang === "en" ? "eng" : "es";
    } catch (error) {
      return defaultSubtitleLang;
    }
  }
  function buildPlayerHref(sceneId, nextUrl) {
    const params = new URLSearchParams();
    params.set("scene", sceneId);
    params.set("lang", getStoredGameLanguageForPlayer());
    if (nextUrl) {
      params.set("next", nextUrl);
    }
    return `/player/?${params.toString()}`;
  }
  const aliasToScene = {
    simulacro: "scene_intro_simulacro",
    sumas: "scene_intro_sumas",
    laberinto: "scene_intro_laberinto",
    trivial: "scene_intro_trivial",
    musica: "scene_intro_musica",
    cronometro: "scene_intro_cronometro",
    energia: "scene_intro_energia",
    segments: "scene_intro_segments",
    "segments dificil": "scene_intro_segments",
    memory: "scene_intro_memory",
    "token a lloc": "scene_intro_token_a_lloc",
    "apreta botons": "scene_intro_apreta_botons"
  };
  const sceneHealthConfigs = [
    { id: "scene_intro_game", label: "Intro General", href: buildPlayerHref("scene_intro_game") },
    { id: "scene_intro_sumas", label: "Puzzle 1 Intro", href: buildPlayerHref("scene_intro_sumas") },
    { id: "scene_intro_laberinto", label: "Puzzle 2 Intro", href: buildPlayerHref("scene_intro_laberinto") },
    { id: "scene_intro_trivial", label: "Puzzle 3 Intro", href: buildPlayerHref("scene_intro_trivial") },
    { id: "scene_intro_musica", label: "Puzzle 4 Intro", href: buildPlayerHref("scene_intro_musica") },
    { id: "scene_intro_cronometro", label: "Puzzle 5 Intro", href: buildPlayerHref("scene_intro_cronometro") },
    { id: "scene_intro_energia", label: "Puzzle 6 Intro", href: buildPlayerHref("scene_intro_energia") },
    { id: "scene_intro_memory", label: "Puzzle 8 Intro", href: buildPlayerHref("scene_intro_memory") },
    { id: "scene_intro_token_a_lloc", label: "Puzzle 9 Intro", href: buildPlayerHref("scene_intro_token_a_lloc") },
    { id: "scene_intro_segments", label: "Puzzle 10 Intro", href: buildPlayerHref("scene_intro_segments") },
    { id: "scene_intro_simulacro", label: "Puzzle 11 Intro", href: buildPlayerHref("scene_intro_simulacro") },
    { id: "scene_intro_apreta_botons", label: "Puzzle 12 Intro", href: buildPlayerHref("scene_intro_apreta_botons") },
    { id: "scene_final", label: "Outro Final", href: buildPlayerHref("scene_final") }
  ];
  const puzzle11Steps = [
    "El token 5 debe pasar por el terminal 6 y apretar el botón verde",
    "El token 10 debe pasar por el terminal 2 y seguidamente por el terminal 5",
    "El token 13 debe pasar 3 veces por el terminal 2",
    "El token 14 debe pasar por el terminal 1 y apretar el botón rojo, luego el botón verde y luego el botón amarillo",
    "El token 17 debe pasar por el terminal 1, luego por el terminal 2 y luego por el terminal 3",
    "El token 18 debe pasar por el terminal 9 y apretar el botón negro dos veces",
    "El token 20 se debe pasar por el terminal que tenga un símbolo con una sola onda y dos puntos",
    "El token 22 debe pasar por el terminal 3, luego por el terminal 4 y allí apretar el botón amarillo",
    "El token 31 debe pasar por el terminal 7 dos veces y luego apretar el botón rojo",
    "El token 35 debe pasar por el terminal que tiene el símbolo \"pi\""
  ];
  // Mirrored from STEP_SEQUENCES in puzzle11.py — format: [box, token, color]
  const puzzle11Sequences = [
    [[6,0,-1],[6,-1,5]],
    [[2,1,-1],[5,1,-1]],
    [[2,2,-1],[2,2,-1],[2,2,-1]],
    [[1,3,-1],[1,-1,1],[1,-1,5],[1,-1,2]],
    [[1,4,-1],[2,4,-1],[3,4,-1]],
    [[9,5,-1],[9,-1,4],[9,-1,4]],
    [[0,6,-1]],
    [[3,7,-1],[4,7,-1],[4,-1,2]],
    [[7,8,-1],[7,8,-1],[7,-1,1]],
    [[8,9,-1]]
  ];
  function p11StepPayloads(stepIndex) {
    return (puzzle11Sequences[stepIndex] || []).map(([box, token, color]) => `P11,${box},${token},${color}`);
  }
  // Final puzzle button targets: botons[round_index][giff_index] = [b1, b2, b3, b4, b5, b6]
  const finalPuzzleBotons = [
    // Round 1
    [[2,2,1,2,2,1], [2,1,2,1,2,2], [1,1,1,3,3,1], [2,1,3,2,1,1], [1,2,1,2,1,3]],
    // Round 2
    [[2,2,5,2,2,2], [2,3,4,2,3,1], [3,3,2,3,1,3], [1,1,3,4,4,2], [4,1,1,5,1,3]],
    // Round 3
    [[4,4,4,4,5,4], [4,3,5,2,6,5], [1,4,6,4,8,2], [6,2,2,8,4,3], [4,5,5,3,4,4]],
    // Round 4
    [[0,8,5,8,6,1], [0,4,10,7,6,1], [0,6,8,9,4,1], [0,4,8,8,7,1], [0,5,3,9,10,1]]
  ];
  const puzzle12ButtonLabels = [
    "Botones negros",
    "Botones verdes",
    "Botones rojos",
    "Botones amarillos",
    "Botones azules",
    "Botones blancos"
  ];
  const puzzleConfigs = {
    "11": {
      label: "Puzzle 11",
      route: "/puzzle/11",
      startRoute: "/start_puzzle/11",
      restartRoute: "/restart_puzzle/11",
      help: "Formato MQTT: P11,box,token,color. Envia todos los substeps del paso en orden.",
      fields: [
        { id: "box", label: "Box", type: "number", min: 0, max: 9, value: 6 },
        { id: "token", label: "Token", type: "number", min: -1, max: 35, value: 0 },
        { id: "color", label: "Color", type: "number", min: -1, max: 9, value: -1 }
      ],
      build(values) {
        return `P11,${values.box},${values.token},${values.color}`;
      },
      examples: [
        { label: "Paso 1 substep 1", payload: "P11,6,0,-1" },
        { label: "Paso 1 substep 2", payload: "P11,6,-1,5" }
      ],
      reference: [
        "Secuencia tutorial fija de 10 pasos (P11,box,token,color):",
        ...puzzle11Steps.map((step, index) => {
          const payloads = p11StepPayloads(index).join(" -> ");
          return `${index + 1}. ${step}\n   ${payloads}`;
        }),
        "",
        "Solo avanza si el substep enviado coincide con el substep actual del paso."
      ].join("\n")
    },
    "1": {
      label: "Puzzle 1",
      route: "/puzzle/1",
      startRoute: "/start_puzzle/1",
      restartRoute: "/restart_puzzle/1",
      help: "Formato MQTT: P1,a,b. Simula la suma detectada por el terminal.",
      fields: [
        { id: "a", label: "Valor A", type: "number", value: 4 },
        { id: "b", label: "Valor B", type: "number", value: 4 }
      ],
      build(values) {
        return `P1,${values.a},${values.b}`;
      },
      examples: [
        { label: "4 + 4", payload: "P1,4,4" },
        { label: "2 + 5", payload: "P1,2,5" }
      ],
      reference: [
        "No tiene una solucion fija unica.",
        "Cada mensaje P1,a,b genera una suma concreta.",
        "Ejemplos utiles:",
        "P1,30,9 -> 39",
        "P1,18,22 -> 40"
      ].join("\n")
    },
    "2": {
      label: "Puzzle 2",
      route: "/puzzle/2",
      startRoute: "/start_puzzle/2",
      restartRoute: "/restart_puzzle/2",
      help: "Formato MQTT: P2,player,symbol. El player va de 0 a 9.",
      fields: [
        { id: "player", label: "Player", type: "number", min: 0, max: 9, value: 0 },
        { id: "symbol", label: "Simbolo", type: "number", min: 0, max: 9, value: 3 }
      ],
      build(values) {
        return `P2,${values.player},${values.symbol}`;
      },
      examples: [
        { label: "Player 0 / simbolo 3", payload: "P2,0,3" },
        { label: "Player 7 / simbolo 8", payload: "P2,7,8" }
      ],
      reference: [
        "Secuencias correctas por player:",
        "1 -> 5,0,9,6,2",
        "2 -> 4,3,9,0,7",
        "3 -> 8,1,7,2,4",
        "4 -> 0,4,8,1,3",
        "5 -> 6,7,8,4,9",
        "6 -> 3,5,1,9,0",
        "7 -> 2,6,3,7,8",
        "8 -> 9,2,5,7,1",
        "9 -> 0,8,2,5,6",
        "10 -> 1,4,6,3,5",
        "",
        "Modo alarma remapea:",
        "0->2, 1->3, 2->0, 3->1, 4->5, 5->4, 6->8, 7->9, 8->6, 9->7"
      ].join("\n")
    },
    "3": {
      label: "Puzzle 3",
      route: "/puzzle/3",
      startRoute: "/start_puzzle/3",
      restartRoute: "/restart_puzzle/3",
      help: "Formato MQTT: P3,player,answerIndex. El indice de respuesta es entero.",
      fields: [
        { id: "player", label: "Terminal", type: "number", min: 0, max: 9, value: 0 },
        { id: "answer", label: "Indice respuesta", type: "number", min: 0, max: 5, value: 1 }
      ],
      build(values) {
        return `P3,${values.player},${values.answer}`;
      },
      examples: [
        { label: "Terminal 0 responde 1", payload: "P3,0,1" },
        { label: "Terminal 9 responde 4", payload: "P3,9,4" }
      ],
      reference: [
        "No hay solucion fija unica.",
        "La respuesta correcta cambia con cada pregunta.",
        "En el SSE del puzzle aparece como `correct_answer` cuando se valida una ronda.",
        "La base de preguntas esta en data/puzzle3_questions.py."
      ].join("\n")
    },
    "4": {
      label: "Puzzle 4",
      route: "/puzzle/4",
      startRoute: "/start_puzzle/4",
      restartRoute: "/restart_puzzle/4",
      help: "Formato MQTT: P4,button,song. button 3 guarda, 4 reproduce muestra.",
      fields: [
        { id: "button", label: "Boton", type: "number", min: 0, max: 4, value: 3 },
        { id: "song", label: "Song", type: "number", min: 0, max: 9, value: 5 }
      ],
      build(values) {
        return `P4,${values.button},${values.song}`;
      },
      examples: [
        { label: "Guardar pista 5", payload: "P4,3,5" },
        { label: "Reproducir muestra", payload: "P4,4,0" }
      ],
      reference: [
        "Orden correcto fase 1:",
        "5, 1, 8, 3",
        "",
        "Orden correcto fase 2:",
        "6, 1, 0, 9, 8, 4, 2, 7"
      ].join("\n")
    },
    "5": {
      label: "Puzzle 5",
      route: "/puzzle/5",
      startRoute: "/start_puzzle/5",
      restartRoute: "/restart_puzzle/5",
      help: "Formato MQTT: P5,player,error_time. Negativo = antes, positivo = tarde.",
      fields: [
        { id: "player", label: "Terminal", type: "number", min: 0, max: 9, value: 9 },
        { id: "error", label: "Error tiempo", type: "number", step: "0.1", value: "-0.5" }
      ],
      build(values) {
        return `P5,${values.player},${values.error}`;
      },
      examples: [
        { label: "Terminal 9 -0.5s", payload: "P5,9,-0.5" },
        { label: "Terminal 3 +1.8s", payload: "P5,3,1.8" }
      ],
      reference: [
        "Rondas fijas:",
        "1 -> objetivo 10 s",
        "2 -> objetivo 30 s",
        "",
        "El mensaje envia el error respecto al objetivo:",
        "P5,9,-0.5 -> terminal 9 se adelanta 0.5 s",
        "P5,3,1.8 -> terminal 3 llega 1.8 s tarde"
      ].join("\n")
    },
    "6": {
      label: "Puzzle 6",
      route: "/puzzle/6",
      startRoute: "/start_puzzle/6",
      restartRoute: "/restart_puzzle/6",
      help: "Formato MQTT: P6,boxNumber. Simula un terminal que deja escapar la ventana de energia.",
      fields: [
        { id: "box", label: "Terminal", type: "number", min: 0, max: 9, value: 4 }
      ],
      build(values) {
        return `P6,${values.box}`;
      },
      examples: [
        { label: "Falla terminal 4", payload: "P6,4" },
        { label: "Falla terminal 8", payload: "P6,8" }
      ],
      reference: [
        "No tiene solucion fija visible desde backend.",
        "El puzzle se resuelve si termina la cuenta atras sin fallos.",
        "El mensaje P6,box simula un terminal que ha fallado y reinicia la ventana."
      ].join("\n")
    },
    "7": {
      label: "Puzzle 7",
      route: "/puzzle/7",
      startRoute: "/start_puzzle/7",
      restartRoute: "/restart_puzzle/7",
      help: "Formato MQTT: P7,boxIndex,code. code es la secuencia de colores del terminal.",
      fields: [
        { id: "box", label: "Terminal", type: "number", min: 0, max: 9, value: 0 },
        { id: "code", label: "Codigo", type: "text", value: "0424", fullWidth: true }
      ],
      build(values) {
        return `P7,${values.box},${values.code}`;
      },
      examples: [
        { label: "Terminal 0 codigo 0424", payload: "P7,0,0424" },
        { label: "Terminal 5 codigo 4310", payload: "P7,5,4310" }
      ],
      reference: [
        "Codigos correctos por terminal:",
        "0 -> 0424",
        "1 -> 4143",
        "2 -> 1234",
        "3 -> 1134",
        "4 -> 3333",
        "5 -> 4310",
        "6 -> 1143",
        "7 -> 2220",
        "8 -> 1111",
        "9 -> 2234"
      ].join("\n")
    },
    "8": {
      label: "Puzzle 8",
      route: "/puzzle/8",
      startRoute: "/start_puzzle/8",
      restartRoute: "/restart_puzzle/8",
      help: "Formato MQTT: P8,symbolCode,tokenIndex,colorCode. El payload usa el indice MQTT 0..9, aunque aqui se muestra el numero real del token.",
      fields: [
        { id: "symbol", label: "Symbol code", type: "number", min: 0, max: 9, value: 0 },
        {
          id: "token",
          label: "Token",
          type: "select",
          value: "5",
          options: [
            { value: "0", label: "0 · token 5" },
            { value: "1", label: "1 · token 10" },
            { value: "2", label: "2 · token 13" },
            { value: "3", label: "3 · token 14" },
            { value: "4", label: "4 · token 17" },
            { value: "5", label: "5 · token 18" },
            { value: "6", label: "6 · token 20" },
            { value: "7", label: "7 · token 22" },
            { value: "8", label: "8 · token 31" },
            { value: "9", label: "9 · token 35" }
          ]
        },
        {
          id: "color",
          label: "Color code",
          type: "select",
          value: "1",
          options: [
            { value: "1", label: "1 · red" },
            { value: "2", label: "2 · yellow" },
            { value: "3", label: "3 · blue" },
            { value: "4", label: "4 · black" },
            { value: "5", label: "5 · green" },
            { value: "6", label: "6 · white" }
          ]
        }
      ],
      build(values) {
        return `P8,${values.symbol},${values.token},${values.color}`;
      },
      examples: [
        { label: "alpha / token 18 / red", payload: "P8,0,5,1" },
        { label: "pi / token 31 / blue", payload: "P8,8,8,3" }
      ],
      reference: [
        "Parte fija del puzzle:",
        "Tokens por terminal -> 18, 14, 17, 5, 20, 10, 13, 31, 35, 22",
        "",
        "Symbol codes:",
        "0 alpha, 1 beta, 2 delta, 3 epsilon, 4 gamma, 5 lambda, 6 mu, 7 omega, 8 pi, 9 sigma",
        "",
        "Color codes:",
        "1 red, 2 yellow, 3 blue, 4 black, 5 green, 6 white",
        "",
        "Token index -> token real:",
        "0->5, 1->10, 2->13, 3->14, 4->17, 5->18, 6->20, 7->22, 8->31, 9->35",
        "",
        "La combinacion correcta cambia aleatoriamente en cada ronda."
      ].join("\n")
    },
    "9": {
      label: "Puzzle 9",
      route: "/puzzle/9",
      startRoute: "/start_puzzle/9",
      restartRoute: "/restart_puzzle/9",
      help: "Formato MQTT: P9,box,token. Usa -1 para vaciar el terminal.",
      fields: [
        { id: "box", label: "Terminal", type: "number", min: 0, max: 9, value: 4 },
        {
          id: "token",
          label: "Token",
          type: "select",
          value: "8",
          options: [
            { value: "-1", label: "-1 · vaciar" },
            { value: "0", label: "0 · token 5" },
            { value: "1", label: "1 · token 10" },
            { value: "2", label: "2 · token 13" },
            { value: "3", label: "3 · token 14" },
            { value: "4", label: "4 · token 17" },
            { value: "5", label: "5 · token 18" },
            { value: "6", label: "6 · token 20" },
            { value: "7", label: "7 · token 22" },
            { value: "8", label: "8 · token 31" },
            { value: "9", label: "9 · token 35" }
          ]
        }
      ],
      build(values) {
        return `P9,${values.box},${values.token}`;
      },
      examples: [
        { label: "Terminal 4 <- token 31", payload: "P9,4,8" },
        { label: "Vaciar terminal 4", payload: "P9,4,-1" }
      ],
      reference: [
        "Solucion por terminal -> token index:",
        "0 -> 5",
        "1 -> 6",
        "2 -> 3",
        "3 -> 7",
        "4 -> 0",
        "5 -> 8",
        "6 -> 4",
        "7 -> 2",
        "8 -> 1",
        "9 -> 9",
        "",
        "Token index -> token real:",
        "0->5, 1->10, 2->13, 3->14, 4->17, 5->18, 6->20, 7->22, 8->31, 9->35"
      ].join("\n")
    },
    "10": {
      label: "Puzzle 10",
      route: "/puzzle/10",
      startRoute: "/start_puzzle/10",
      restartRoute: "/restart_puzzle/10",
      help: "Formato MQTT: P10,box,code. code es un codigo de 3 digitos (0..4) para cada caja.",
      fields: [
        { id: "box", label: "Caja", type: "number", min: 0, max: 9, value: 0 },
        { id: "code", label: "Codigo", type: "text", value: "042", fullWidth: true }
      ],
      build(values) {
        return `P10,${values.box},${values.code}`;
      },
      examples: [
        { label: "Caja 0 / 042", payload: "P10,0,042" },
        { label: "Caja 5 / 431", payload: "P10,5,431" }
      ],
      reference: [
        "Codigos objetivo por caja:",
        "0 -> 042",
        "1 -> 414",
        "2 -> 323",
        "3 -> 104",
        "4 -> 033",
        "5 -> 431",
        "6 -> 104",
        "7 -> 222",
        "8 -> 110",
        "9 -> 423",
        "",
        "Cada mensaje correcto resuelve una caja: P10,box,code",
        "Al completar las 10 cajas, el puzzle se marca como superado."
      ].join("\n")
    },
    "12": {
      label: "Puzzle 12",
      route: "/puzzle/12",
      startRoute: "/start_puzzle/12",
      restartRoute: "/restart_puzzle/12",
      help: "Formato MQTT: P12,box,buttons. buttons es una cadena de 6 digitos (0/1).",
      fields: [
        { id: "box", label: "Caja", type: "number", min: 1, max: 10, value: 1 },
        { id: "buttons", label: "Botones (6 bits)", type: "text", value: "110010", fullWidth: true }
      ],
      build(values) {
        return `P12,${values.box},${values.buttons}`;
      },
      examples: [
        { label: "Caja 1 · 110010", payload: "P12,1,110010" },
        { label: "Caja 7 · 001101", payload: "P12,7,001101" }
      ],
      reference: [
        "El backend suma los 6 botones activos de todas las cajas enviadas.",
        "Cada caja reporta su estado con: P12,box,buttons",
        "buttons debe tener 6 digitos binarios (ej: 110010).",
        "",
        "Si el total coincide con el objetivo de ronda/GIF,",
        "debe mantenerse estable 5 segundos para validar la ronda."
      ].join("\n")
    },
    "-1": {
      label: "Puzzle final",
      route: "/puzzle/final",
      startRoute: "/start_puzzle_final",
      restartRoute: "/start_puzzle_final",
      help: `Formato MQTT: P${finalPuzzleMqttId},boxNumber. Usa las rutas de compatibilidad del final, pero el payload real es el de puzzle ${finalPuzzleMqttId}.`,
      fields: [
        { id: "box", label: "Terminal", type: "number", min: 0, max: 9, value: 4 }
      ],
      build(values) {
        return `P${finalPuzzleMqttId},${values.box}`;
      },
      examples: [
        { label: "Falla terminal 4", payload: `P${finalPuzzleMqttId},4` },
        { label: "Falla terminal 8", payload: `P${finalPuzzleMqttId},8` }
      ],
      reference: [
        "Puzzle final por compatibilidad:",
        "La pantalla final usa /puzzle/final y /start_puzzle_final.",
        `El backend real arranca el puzzle ${finalPuzzleMqttId}.`,
        `El mensaje P${finalPuzzleMqttId},box simula un terminal que ha fallado y reinicia la ventana.`
      ].join("\n")
    }
  };

	  const els = {
	    tabAyudas: document.getElementById("test-tab-ayudas"),
	    tabSystem: document.getElementById("test-tab-system"),
    panelPuzzles: document.getElementById("test-panel-puzzles"),
	    panelSystem: document.getElementById("test-panel-system"),
	    gmNavTabs: Array.from(document.querySelectorAll("[data-gm-section]")),
	    gmSections: Array.from(document.querySelectorAll("[data-gm-panel]")),
	    gmCurrentPuzzle: document.getElementById("test-gm-current-puzzle"),
	    gmPuzzleStatus: document.getElementById("test-gm-puzzle-status"),
	    gmProgress: document.getElementById("test-gm-progress"),
	    gmDashboardSummary: document.getElementById("test-gm-dashboard-summary"),
	    gmNextAction: document.getElementById("test-gm-next-action"),
	    gmQuickNext: document.getElementById("test-gm-quick-next"),
	    gmSideSummary: document.getElementById("test-gm-side-summary"),
	    gmLastAction: document.getElementById("test-gm-last-action"),
	    gmAlerts: document.getElementById("test-gm-alerts"),
	    gmDeviceSummary: document.getElementById("test-gm-device-summary"),
	    gmTerminalGrid: document.getElementById("test-gm-terminal-grid"),
	    puzzleSelect: document.getElementById("test-puzzle-select"),
    formBuilder: document.getElementById("test-form-builder"),
    sendBtn: document.getElementById("test-send-btn"),
    topicSelect: document.getElementById("test-topic-select"),
    topicHelp: document.getElementById("test-topic-help"),
    messageField: document.getElementById("test-message-field"),
    messageSelect: document.getElementById("test-message-select"),
    messageEditor: document.getElementById("test-message-editor"),
    startBtn: document.getElementById("test-start-btn"),
    restartBtn: document.getElementById("test-restart-btn"),
    viewBtn: document.getElementById("test-view-btn"),
    solveBtn: document.getElementById("test-solve-btn"),
    unsolveBtn: document.getElementById("test-unsolve-btn"),
    currentState: document.getElementById("test-current-state"),
    refreshStateBtn: document.getElementById("test-refresh-state-btn"),
    refreshScenesBtn: document.getElementById("test-refresh-scenes-btn"),
    sceneHealth: document.getElementById("test-scene-health"),
    refreshSystemBtn: document.getElementById("test-refresh-system-btn"),
    systemSummary: document.getElementById("test-system-summary"),
    refreshLogsBtn: document.getElementById("test-refresh-logs-btn"),
    clearLogsBtn: document.getElementById("test-clear-logs-btn"),
    systemLogs: document.getElementById("test-system-logs"),
    fullscreenBtn: document.getElementById("test-fullscreen-btn"),
    audioBtn: document.getElementById("test-audio-btn"),
    eventLog: document.getElementById("test-event-log"),
    clearLogBtn: document.getElementById("test-clear-log-btn"),
    referenceOutput: document.getElementById("test-reference-output"),
	    copyReferenceBtn: document.getElementById("test-copy-reference-btn"),
    resolverHub: document.getElementById("test-resolver-hub"),
    simContent: document.getElementById("test-sim-content"),
    puzzleShortcuts: document.getElementById("test-puzzle-shortcuts"),
    introShortcuts: document.getElementById("test-intro-shortcuts"),
    activeSessionLine: document.getElementById("gm-active-session-line"),
    headerSessionStatus: document.getElementById("gm-header-session-status"),
    sessionSummary: document.getElementById("gm-session-summary"),
    sessionList: document.getElementById("gm-session-list"),
    loadSessionBtn: document.getElementById("gm-load-session-btn"),
    saveSessionBtn: document.getElementById("gm-save-session-btn"),
    newSessionBtn: document.getElementById("gm-new-session-btn"),
    duplicateSessionBtn: document.getElementById("gm-duplicate-session-btn"),
    confirmSessionBtn: document.getElementById("gm-confirm-session-btn"),
    exportSessionBtn: document.getElementById("gm-export-session-btn"),
    preflightChecklist: document.getElementById("gm-preflight-checklist"),
    checkAllBtn: document.getElementById("gm-check-all-btn"),
    startSystemBtn: document.getElementById("gm-start-system-btn"),
    testScreenBtn: document.getElementById("gm-test-screen-btn"),
    testMqttBtn: document.getElementById("gm-test-mqtt-btn"),
    testEsp32Btn: document.getElementById("gm-test-esp32-btn"),
    openPlayerBtn: document.getElementById("gm-open-player-btn"),
    gameTime: document.getElementById("gm-game-time"),
    gameStatus: document.getElementById("gm-game-status"),
    controlCurrentPuzzle: document.getElementById("gm-control-current-puzzle"),
    controlProgress: document.getElementById("gm-control-progress"),
    pauseGameBtn: document.getElementById("gm-pause-game-btn"),
    resumeGameBtn: document.getElementById("gm-resume-game-btn"),
    completePuzzleBtn: document.getElementById("gm-complete-puzzle-btn"),
    skipPuzzleBtn: document.getElementById("gm-skip-puzzle-btn"),
    finishGameBtn: document.getElementById("gm-finish-game-btn"),
    puzzleProgressList: document.getElementById("gm-puzzle-progress-list"),
    simpleEvents: document.getElementById("gm-simple-events"),
    incidents: document.getElementById("gm-incidents"),
    puzzleHelp: document.getElementById("gm-puzzle-help")
  };

  const sessionStorageKey = "gmPanelSessions";
  const activeSessionKey = "gmPanelActiveSession";
  const gameStateKey = "gmPanelGameState";
  let selectedSessionId = null;
  let activeSession = null;
  const puzzleRuntime = {
    statuses: {},
    gameStatus: "Preparado",
    startedAt: null,
    elapsedBeforePause: 0,
    timerId: null
  };
  const preflightItems = [
    { id: "flask", label: "Servidor Flask activo" },
    { id: "mqtt", label: "MQTT conectado" },
    { id: "player", label: "Pantalla principal abierta" },
    { id: "audio", label: "Audio navegador OK" },
    { id: "fullscreen", label: "Fullscreen OK" },
    { id: "esp32", label: "ESP32 conectados" },
    { id: "terminals", label: "Terminales / cajas detectadas" },
    { id: "buttons", label: "Botones responden" },
    { id: "nfc", label: "NFC / tokens responden" },
    { id: "general", label: "Estado general del sistema" }
  ];
  const preflightState = Object.fromEntries(preflightItems.map((item) => [item.id, "unchecked"]));

  function getAliasForPuzzle(puzzleId) {
    const alias = puzzleAliases[puzzleId] ?? puzzleAliases[String(puzzleId)] ?? "";
    return String(alias || "").trim();
  }

  function formatAliasLabel(alias) {
    const normalized = String(alias || "")
      .trim()
      .replace(/\s+/g, " ");
    if (!normalized) {
      return "";
    }
    return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function getPuzzleDisplayName(puzzleId) {
    const aliasLabel = formatAliasLabel(getAliasForPuzzle(puzzleId));
    if (aliasLabel) {
      return aliasLabel;
    }
    const config = puzzleConfigs[String(puzzleId)];
    return config?.label || `Puzzle ${puzzleId}`;
  }

  function normalizeAlias(alias) {
    return String(alias || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function resolveIntroSceneForPuzzle(puzzleId) {
    const alias = normalizeAlias(getAliasForPuzzle(puzzleId));
    if (!alias) {
      return "";
    }
    const mapped = aliasToScene[alias] || alias;
    if (mapped.startsWith("scene_")) {
      return mapped;
    }
    return `scene_intro_${mapped}`;
  }

  function getVisiblePuzzleIds() {
    const allConfigIds = Object.keys(puzzleConfigs)
      .filter((id) => id !== "-1")
      .sort((a, b) => Number(a) - Number(b));

    const configuredIds = [];

    if (tutorialPuzzleId && allConfigIds.includes(tutorialPuzzleId)) {
      configuredIds.push(tutorialPuzzleId);
    }

    activePuzzleOrder
      .map((id) => String(id))
      .forEach((id) => {
        if (id !== "-1" && allConfigIds.includes(id)) {
          configuredIds.push(id);
        }
      });

    if (finalPuzzleId && allConfigIds.includes(finalPuzzleId)) {
      configuredIds.push(finalPuzzleId);
    }

    const orderedIds = configuredIds.filter((id, index, list) => list.indexOf(id) === index);
    return orderedIds;
  }

  function shouldIncludeLegacyFinalShortcut(visibleIds) {
    if (!puzzleConfigs["-1"]) {
      return false;
    }
    // If final puzzle is already present as a real puzzle id (e.g. energia = 6),
    // avoid duplicating the same target with the legacy "/puzzle/final" shortcut.
    if (finalPuzzleId && visibleIds.includes(String(finalPuzzleId))) {
      return false;
    }
    return true;
  }

	  function switchTab(tabId) {
	    const panelId = tabId === "system" || tabId === "tecnico"
        ? "tecnico"
        : (tabId === "ayudas" || tabId === "puzzles" ? "control" : tabId);

	    els.gmNavTabs.forEach((tab) => {
	      const isActive = tab.dataset.gmSection === panelId;
	      tab.classList.toggle("is-active", isActive);
	      tab.setAttribute("aria-selected", String(isActive));
	    });

	    document.querySelectorAll("[data-gm-panel]").forEach((section) => {
	      const isActive = section.dataset.gmPanel === panelId;
	      section.classList.toggle("is-active", isActive);
	      section.hidden = !isActive;
	    });
	  }

  function languageLabel(value) {
    return ({ es: "Castellano", ca: "Català", eng: "English", en: "English" })[value] || value || "--";
  }

  function getSessionField(name) {
    return document.querySelector(`#gm-session-form [name="${name}"]`);
  }

  function readSessions() {
    try {
      return JSON.parse(window.localStorage.getItem(sessionStorageKey) || "[]");
    } catch (error) {
      return [];
    }
  }

  function writeSessions(sessions) {
    window.localStorage.setItem(sessionStorageKey, JSON.stringify(sessions));
  }

  function collectSessionForm() {
    const fields = ["sessionName", "company", "event", "date", "time", "place", "group", "players", "teamName", "gameMaster", "gameLanguage", "gameMode", "difficulty", "internalNotes"];
    const data = {};
    fields.forEach((field) => {
      const input = getSessionField(field);
      data[field] = input ? String(input.value || "").trim() : "";
    });
    data.id = selectedSessionId || `session_${Date.now()}`;
    data.updatedAt = new Date().toISOString();
    return data;
  }

  function fillSessionForm(session = {}) {
    selectedSessionId = session.id || selectedSessionId;
    Object.entries(session).forEach(([key, value]) => {
      const field = getSessionField(key);
      if (field) field.value = value ?? "";
    });
  }

  function clearSessionForm() {
    selectedSessionId = null;
    document.getElementById("gm-session-form")?.reset();
    const lang = getSessionField("gameLanguage");
    if (lang) lang.value = "es";
    const difficulty = getSessionField("difficulty");
    if (difficulty) difficulty.value = "normal";
  }

  function renderSessionList() {
    if (!els.sessionList) return;
    const sessions = readSessions();
    if (!sessions.length) {
      els.sessionList.innerHTML = `<div class="gm-empty">No hay sesiones guardadas.</div>`;
      return;
    }
    els.sessionList.innerHTML = sessions.map((session) => `
      <button type="button" class="gm-session-item${session.id === selectedSessionId ? " is-selected" : ""}" data-session-id="${escapeHtml(session.id)}">
        <strong>${escapeHtml(session.sessionName || "Sesión sin nombre")}</strong>
        <span>${escapeHtml([session.company, session.event, session.group].filter(Boolean).join(" · ") || "Sin datos")}</span>
      </button>
    `).join("");
    els.sessionList.querySelectorAll("[data-session-id]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedSessionId = button.dataset.sessionId;
        renderSessionList();
      });
    });
  }

  function saveSession() {
    const session = collectSessionForm();
    const sessions = readSessions();
    const index = sessions.findIndex((item) => item.id === session.id);
    if (index >= 0) sessions[index] = session;
    else sessions.unshift(session);
    selectedSessionId = session.id;
    writeSessions(sessions);
    renderSessionList();
    addSimpleEvent("Sesión guardada");
    setStatus("Sesión guardada");
    return session;
  }

  function loadSelectedSession() {
    const session = readSessions().find((item) => item.id === selectedSessionId);
    if (!session) {
      setStatus("Selecciona una sesión guardada");
      return;
    }
    fillSessionForm(session);
    addSimpleEvent("Sesión cargada");
    setStatus("Sesión cargada");
  }

  function duplicateSession() {
    const source = selectedSessionId
      ? readSessions().find((item) => item.id === selectedSessionId)
      : collectSessionForm();
    const duplicate = {
      ...(source || {}),
      id: `session_${Date.now()}`,
      sessionName: `${source?.sessionName || "Sesión"} copia`,
      updatedAt: new Date().toISOString()
    };
    selectedSessionId = duplicate.id;
    fillSessionForm(duplicate);
    saveSession();
  }

  function confirmSession() {
    const session = saveSession();
    activeSession = { ...session, confirmedAt: new Date().toISOString(), status: "confirmed" };
    window.localStorage.setItem(activeSessionKey, JSON.stringify(activeSession));
    renderActiveSession();
    addSimpleEvent("Sesión confirmada");
    setStatus("Sesión confirmada");
  }

  function loadActiveSession() {
    try {
      activeSession = JSON.parse(window.localStorage.getItem(activeSessionKey) || "null");
    } catch (error) {
      activeSession = null;
    }
    if (activeSession) {
      selectedSessionId = activeSession.id;
      fillSessionForm(activeSession);
    }
    renderActiveSession();
  }

  function renderActiveSession() {
    const s = activeSession;
    const line = s
      ? `${s.company || "Sin empresa"} · ${s.event || "Sin evento"} · ${s.group || "Sin grupo"} | Idioma: ${languageLabel(s.gameLanguage)} | Jugadores: ${s.players || "--"} | GM: ${s.gameMaster || "--"} | Sesión confirmada`
      : "Sin sesión confirmada";
    if (els.activeSessionLine) els.activeSessionLine.textContent = line;
    if (els.headerSessionStatus) {
      els.headerSessionStatus.textContent = s ? "Sesión confirmada" : "No confirmada";
      els.headerSessionStatus.className = s ? "gm-status-ok" : "gm-status-muted";
    }
    const pairs = {
      "gm-summary-company": s?.company || "--",
      "gm-summary-event": s?.event || "--",
      "gm-summary-group": s?.group || "--",
      "gm-summary-language": languageLabel(s?.gameLanguage),
      "gm-summary-players": s?.players || "--",
      "gm-summary-master": s?.gameMaster || "--"
    };
    Object.entries(pairs).forEach(([id, value]) => {
      const node = document.getElementById(id);
      if (node) node.textContent = value;
    });
  }

  function addSimpleEvent(message, detail = "") {
    if (!els.simpleEvents) return;
    if (els.simpleEvents.textContent.trim() === "Sin eventos.") {
      els.simpleEvents.innerHTML = "";
    }
    const row = document.createElement("div");
    row.className = "gm-simple-event";
    row.innerHTML = `<span>${escapeHtml(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))}</span><strong>${escapeHtml(message)}</strong>${detail ? `<em>${escapeHtml(detail)}</em>` : ""}`;
    els.simpleEvents.prepend(row);
    Array.from(els.simpleEvents.children).slice(8).forEach((child) => child.remove());
  }

  function exportSessionResult() {
    const payload = {
      activeSession,
      game: { ...puzzleRuntime },
      puzzleStatuses: puzzleRuntime.statuses,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `gm-session-${activeSession?.sessionName || "resultado"}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    addSimpleEvent("Resultado exportado");
  }

  const simState = {
    puzzle1A: "4",
    puzzle1B: "4",
    puzzle2Token: "1",
    puzzle2Alarm: false,
    puzzle2Progress: {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
      7: 0,
      8: 0,
      9: 0,
      10: 0
    },
    puzzle4Button: "3",
    puzzle4Song: "5",
    puzzle3Answer: 1,
    puzzle3Correct: null,
    puzzle5Error: "-0.5",
    puzzle6Box: "4",
    puzzle7Digits: ["0", "4", "2", "4"],
    puzzle8Token: "5",
    puzzle8Entries: [
      { symbol: "0", color: "1" },
      { symbol: "0", color: "1" },
      { symbol: "0", color: "1" }
    ],
    puzzle9Token: "8",
    puzzle10Box: "0",
    puzzle11: {
      active: false,
      currentStep: 0,
      completedSteps: [],
      solved: false
    },
    skipFollowingPhases: false,
    autoSkipMarker: null,
    autoSkipPuzzleId: null,
    autoSkipInFlight: false
  };

  const p2Sequences = {
    1: [5, 0, 9, 6, 2],
    2: [4, 3, 9, 0, 7],
    3: [8, 1, 7, 2, 4],
    4: [0, 4, 8, 1, 3],
    5: [6, 7, 8, 4, 9],
    6: [3, 5, 1, 9, 0],
    7: [2, 6, 3, 7, 8],
    8: [9, 2, 5, 7, 1],
    9: [0, 8, 2, 5, 6],
    10: [1, 4, 6, 3, 5]
  };
  const p2AlarmChanges = {
    0: 2, 1: 3, 2: 0, 3: 1, 4: 5,
    5: 4, 6: 8, 7: 9, 8: 6, 9: 7
  };
  const p4StreakOrders = {
    0: [5, 1, 8, 3],
    1: [6, 1, 0, 9, 8, 4, 2, 7]
  };
  const p7TargetsByBox = {
    0: "0424",
    1: "4143",
    2: "1234",
    3: "1134",
    4: "3333",
    5: "4310",
    6: "1143",
    7: "2220",
    8: "1111",
    9: "2234"
  };
  const p9SolutionPayloads = [
    "P9,0,5",
    "P9,1,6",
    "P9,2,3",
    "P9,3,7",
    "P9,4,0",
    "P9,5,8",
    "P9,6,4",
    "P9,7,2",
    "P9,8,1",
    "P9,9,9"
  ];
  const p10TargetsByBox = {
    0: "042",
    1: "414",
    2: "323",
    3: "104",
    4: "033",
    5: "431",
    6: "104",
    7: "222",
    8: "110",
    9: "423"
  };

  function initPuzzleSelect() {
    const visibleIds = getVisiblePuzzleIds();

    visibleIds.forEach((id) => {
      const config = puzzleConfigs[id];
      if (!config) return;

      const optionLabel = getPuzzleDisplayName(id);

      const option = document.createElement("option");
      option.value = id;
      option.textContent = optionLabel;
      els.puzzleSelect.appendChild(option);
    });

    // Add legacy final option only when it does not duplicate the configured final puzzle.
    if (shouldIncludeLegacyFinalShortcut(visibleIds)) {
      const option = document.createElement("option");
      option.value = "-1";
      option.textContent = "Final";
      els.puzzleSelect.appendChild(option);
    }
  }

	  function renderShortcutButtons() {
	    if (!els.puzzleShortcuts || !els.introShortcuts) {
	      return;
	    }

    const visibleIds = getVisiblePuzzleIds();
    const shortcutPuzzleIds = [...visibleIds];
    if (shouldIncludeLegacyFinalShortcut(visibleIds)) {
      shortcutPuzzleIds.push("-1");
    }

	    els.puzzleShortcuts.innerHTML = shortcutPuzzleIds.map((id, index) => {
	      const label = id === "-1" ? "Final" : getPuzzleDisplayName(id);
	      const subtitle = id === "-1" ? "Compatibilidad final" : `Puzzle ${id}`;
	      return `
	        <article class="gm-puzzle-card" data-shortcut-puzzle="${escapeHtml(id)}">
	          <div>
	            <strong>${escapeHtml(`${index + 1}. ${label}`)}</strong>
	            <span>${escapeHtml(subtitle)}</span>
	          </div>
	          <div class="gm-card-actions">
	            <button type="button" class="test-shortcut-btn" data-gm-puzzle-action="open" data-gm-puzzle-id="${escapeHtml(id)}">Abrir</button>
	            <button type="button" class="test-shortcut-btn primary-action" data-gm-puzzle-action="start" data-gm-puzzle-id="${escapeHtml(id)}">Arrancar</button>
	            <button type="button" class="test-shortcut-btn danger-action" data-gm-puzzle-action="restart" data-gm-puzzle-id="${escapeHtml(id)}">Reiniciar</button>
	          </div>
	        </article>
	      `;
	    }).join("");

	    els.puzzleShortcuts.querySelectorAll("[data-gm-puzzle-action]").forEach((button) => {
	      button.addEventListener("click", () => {
	        const puzzleId = String(button.dataset.gmPuzzleId || "");
	        const action = String(button.dataset.gmPuzzleAction || "open");
	        selectPuzzle(puzzleId);
	        if (puzzleId === "-1") {
	          if (action === "open") {
	            window.open("/puzzle/final", "_blank", "noopener");
	          } else {
	            startPuzzle(action === "restart").catch((error) => appendLog({ error: String(error) }));
	          }
	          return;
	        }
	        const config = puzzleConfigs[puzzleId];
	        if (!config) {
	          return;
	        }
	        if (action === "open") {
	          window.open(config.route, "_blank", "noopener");
	          return;
	        }
	        startPuzzle(action === "restart").catch((error) => appendLog({ error: String(error) }));
	      });
	    });

	    const introRows = visibleIds.map((id, index) => {
	      const alias = getPuzzleDisplayName(id);
	      const introSceneId = resolveIntroSceneForPuzzle(id);
	      const href = introSceneId
	        ? buildPlayerHref(introSceneId, `/puzzle/${id}`)
	        : `/videoPuzzles/${index + 1}`;
	      return `
	        <a class="test-shortcut-btn test-shortcut-btn--intro" href="${href}" target="_blank" rel="noopener">
	          <strong>${escapeHtml(alias)}</strong>
	          <span>${escapeHtml(`Intro · Puzzle ${id}`)}</span>
	        </a>
	      `;
	    }).join("");

	    const extraIntros = `
	      <a class="test-shortcut-btn test-shortcut-btn--intro" href="${buildPlayerHref("scene_intro_game")}" target="_blank" rel="noopener">
	        <strong>Intro general</strong>
	        <span>Inicio de partida</span>
	      </a>
	      <a class="test-shortcut-btn test-shortcut-btn--intro" href="/final" target="_blank" rel="noopener">
	        <strong>Final</strong>
	        <span>Vídeo final</span>
	      </a>
	    `;

	    els.introShortcuts.innerHTML = `${extraIntros}${introRows}`;
	  }

	  function getSelectedConfig() {
	    return puzzleConfigs[els.puzzleSelect.value];
	  }

	  function selectPuzzle(puzzleId) {
	    if (!els.puzzleSelect) {
	      return;
	    }
	    const id = String(puzzleId || "");
	    const option = Array.from(els.puzzleSelect.options).find((item) => item.value === id);
	    if (!option) {
	      return;
	    }
	    els.puzzleSelect.value = id;
	    renderForm();
	  }

	  function setStatus(message) {
	    document.title = message ? `Panel Game Master · ${message}` : "Panel Game Master";
	    if (message && els.gmLastAction) {
	      els.gmLastAction.textContent = message;
	    }
	  }

  function updateTopicHelp() {
    if (!els.topicHelp) {
      return;
    }

    els.topicHelp.textContent = els.topicSelect.value === "FROM_FLASK"
      ? "Raspi -> ESP32"
      : "ESP32 -> Raspi";
  }

  function updateSendModeUI() {
    const isToFlask = els.topicSelect.value === "TO_FLASK";

    if (els.messageField) {
      els.messageField.hidden = isToFlask;
      els.messageField.style.display = isToFlask ? "none" : "";
    }

    if (els.messageSelect) {
      els.messageSelect.disabled = isToFlask;
    }

    if (els.messageEditor) {
      els.messageEditor.readOnly = isToFlask;
    }

    els.formBuilder.querySelectorAll("input, select, textarea, button").forEach((element) => {
      element.disabled = !isToFlask;
    });
  }

  function syncEditorForTopic() {
    const isToFlask = els.topicSelect.value === "TO_FLASK";
    updateSendModeUI();

    if (isToFlask) {
      els.messageEditor.value = buildPayload();
      return;
    }

    renderMessageOptions();
  }

  function renderForm() {
    const config = getSelectedConfig();
    simState.skipFollowingPhases = false;
    simState.autoSkipMarker = null;
    simState.autoSkipPuzzleId = null;
    simState.autoSkipInFlight = false;
    renderSelectedPuzzleSummary();
	    els.formBuilder.innerHTML = "";
	    els.referenceOutput.textContent = config.reference || "Sin referencia disponible.";
    updateTopicHelp();
    updateSolveButtonState();

    config.fields.forEach((field) => {
      const wrapper = document.createElement("label");
      if (field.fullWidth) {
        wrapper.classList.add("full-width");
      }

      const title = document.createElement("span");
      title.className = "field-label";
      title.textContent = field.label;
      wrapper.appendChild(title);

      let input;
      if (field.type === "select") {
        input = document.createElement("select");
        (field.options || []).forEach((optionValue) => {
          const option = document.createElement("option");
          if (typeof optionValue === "object") {
            option.value = optionValue.value;
            option.textContent = optionValue.label;
          } else {
            option.value = optionValue;
            option.textContent = optionValue;
          }
          input.appendChild(option);
        });
      } else if (field.type === "text") {
        input = document.createElement("input");
        input.type = "text";
      } else {
        input = document.createElement("input");
        input.type = field.type || "number";
      }

      input.id = `field-${field.id}`;
      input.name = field.id;

      ["min", "max", "step", "value"].forEach((key) => {
        if (field[key] !== undefined) {
          input[key] = field[key];
        }
      });

      const syncHandler = () => {
        if (els.topicSelect.value === "TO_FLASK") {
          els.messageEditor.value = buildPayload();
        }
      };

      input.addEventListener("input", syncHandler);
      input.addEventListener("change", syncHandler);

      wrapper.appendChild(input);
      els.formBuilder.appendChild(wrapper);
    });

    syncEditorForTopic();
    renderResolverHub();
    renderSimulator();
  }

  function actionButtonMarkup(action, scope) {
    const tone = action.tone === "danger" ? " danger-action" : (action.tone === "primary" ? " primary-action" : "");
    return `
      <button type="button" class="gm-resolver-action${tone}" data-resolver-scope="${scope}" data-resolver-action="${escapeHtml(action.id)}">
        <strong>${escapeHtml(action.label)}</strong>
        ${action.detail ? `<span>${escapeHtml(action.detail)}</span>` : ""}
      </button>
    `;
  }

  function renderResolverHub() {
    if (!els.resolverHub) {
      return;
    }

    const actionsByScope = getResolverActions(els.puzzleSelect.value);
    const phaseAction = (actionsByScope.phase || [])[0] || null;
    const puzzleId = String(els.puzzleSelect.value || "");
    const canSkipFollowing = puzzleId !== "6" && puzzleId !== "-1";
    const puzzleLabel = getSelectedPuzzleLabel();

	    els.resolverHub.innerHTML = `
      <section class="gm-resolver-strip" aria-label="Control de fase">
        <article class="gm-resolver-card">
          <strong class="gm-resolver-mode">${escapeHtml(puzzleLabel)}</strong>
        </article>
        <article class="gm-resolver-card gm-resolver-card--action">
	          ${phaseAction
	            ? `<button type="button" class="gm-resolver-action primary-action" data-resolver-phase>
	                 <strong>Dar por buena la fase</strong>
	               </button>`
	            : '<div class="gm-resolver-empty">No hay acción de fase definida para este puzzle</div>'}
	        </article>
	        <article class="gm-resolver-card">
	          <label class="gm-resolver-toggle${canSkipFollowing ? "" : " is-disabled"}">
	            <input type="checkbox" id="test-skip-following" ${simState.skipFollowingPhases ? "checked" : ""} ${canSkipFollowing ? "" : "disabled"}>
	            <span>Saltar resto del puzzle</span>
	          </label>
	        </article>
      </section>
    `;

    const skipInput = document.getElementById("test-skip-following");
    if (skipInput) {
      skipInput.addEventListener("change", () => {
        simState.skipFollowingPhases = !!skipInput.checked;
        renderResolverHub();
      });
    }

    const phaseButton = els.resolverHub.querySelector("[data-resolver-phase]");
    if (phaseButton && phaseAction) {
      phaseButton.addEventListener("click", async () => {
        try {
          phaseButton.disabled = true;
          await runResolverAction(phaseAction);
          if (canSkipFollowing && simState.skipFollowingPhases) {
            await forceEndCurrentPuzzle();
          }
          renderResolverHub();
        } catch (error) {
          setStatus(`${phaseAction.label} · ${error.message || "error"}`);
          appendLog({ error: String(error), resolver_action: phaseAction.id });
        } finally {
          phaseButton.disabled = false;
        }
      });
    }
  }

  function getSelectedPuzzleEndPayload() {
    const puzzleId = String(els.puzzleSelect.value || "");
    if (puzzleId === "5") {
      return "P5_End";
    }
    if (puzzleId === "-1") {
      return `P${finalPuzzleMqttId}End`;
    }
    return `P${puzzleId}End`;
  }

  async function forceEndCurrentPuzzle() {
    const selectedPuzzle = String(els.puzzleSelect.value || "");
    const puzzleIdForBackend = selectedPuzzle === "-1"
      ? Number(finalPuzzleMqttId || 6)
      : Number(selectedPuzzle);
    if (!Number.isFinite(puzzleIdForBackend)) {
      return;
    }
    const response = await fetch("/test/force_end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ puzzle_id: puzzleIdForBackend })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "force_end_failed");
    }
    appendLog({
      local: true,
      resolver_action: "force_puzzle_end",
      puzzle_id: data.puzzle_id,
      payload: data.end_payload
    });
    setStatus(`Fase resuelta · salto activado (${data.end_payload || getSelectedPuzzleEndPayload()})`);
  }

  function getPhaseMarkerFromState(data) {
    const puzzleId = String(data?.puzzle_id ?? "");
    if (!puzzleId) {
      return null;
    }
    if (puzzleId === "4") {
      return Number(data.streak || 0);
    }
    if (puzzleId === "5") {
      return Number(data.round || 0);
    }
    if (puzzleId === "8") {
      return Number(data.round || 0);
    }
    if (puzzleId === "11") {
      return Number(data.current_step || 0);
    }
    if (puzzleId === "12") {
      return Number(data.round || 0);
    }
    return null;
  }

  async function maybeAutoSkipAfterPhaseAdvance(data) {
    if (!simState.skipFollowingPhases) {
      return;
    }
    if (!data || typeof data !== "object") {
      return;
    }
    const currentPuzzleId = String(els.puzzleSelect.value || "");
    const statePuzzleId = String(data.puzzle_id || "");
    if (!statePuzzleId || statePuzzleId !== currentPuzzleId) {
      return;
    }
    if (data.puzzle_solved) {
      return;
    }

    // Puzzle 8 fallback: as soon as round 2 starts with skip enabled,
    // force end to avoid playing the following phase.
    if (statePuzzleId === "8" && Number(data.round || 0) >= 2) {
      if (simState.autoSkipInFlight) {
        return;
      }
      simState.autoSkipInFlight = true;
      try {
        await forceEndCurrentPuzzle();
        simState.skipFollowingPhases = false;
        renderResolverHub();
      } finally {
        simState.autoSkipInFlight = false;
      }
      return;
    }

    const marker = getPhaseMarkerFromState(data);
    if (marker === null || Number.isNaN(marker)) {
      return;
    }

    if (simState.autoSkipPuzzleId !== statePuzzleId) {
      simState.autoSkipPuzzleId = statePuzzleId;
      simState.autoSkipMarker = marker;
      return;
    }

    const previousMarker = Number(simState.autoSkipMarker);
    simState.autoSkipMarker = marker;

    if (!Number.isFinite(previousMarker)) {
      return;
    }
    if (marker <= previousMarker) {
      return;
    }
    if (simState.autoSkipInFlight) {
      return;
    }

    simState.autoSkipInFlight = true;
    try {
      await forceEndCurrentPuzzle();
      simState.skipFollowingPhases = false;
      renderResolverHub();
    } finally {
      simState.autoSkipInFlight = false;
    }
  }

  async function autoSkipMonitorTick() {
    if (!simState.skipFollowingPhases || simState.autoSkipInFlight) {
      return;
    }
    try {
      const response = await fetch("/current_state", { cache: "no-store" });
      const data = await response.json();
      await maybeAutoSkipAfterPhaseAdvance(data);
    } catch (error) {
      // Silent by design: monitor should not spam UI on transient fetch issues.
    }
  }

  function getResolverActions(puzzleId) {
    const id = String(puzzleId);
    const manualPayloadAction = {
      id: "send-current",
      label: "Enviar elemento actual",
      detail: "Usa el formulario técnico",
      getPayloads: () => [buildPayload()]
    };
    const common = {
      element: [manualPayloadAction],
      phase: [],
      all: []
    };

    if (id === "1") {
      return {
        element: [manualPayloadAction],
        phase: [{
          id: "p1-solve-round",
          label: "Resolver ronda actual",
          detail: "Completa operaciones pendientes",
          tone: "primary",
          getPayloads: getPuzzle1RoundPayloads
        }],
        all: [{
          id: "p1-solve-visible",
          label: "Resolver ronda completa",
          detail: "Todas las operaciones pendientes",
          tone: "danger",
          confirm: true,
          getPayloads: getPuzzle1RoundPayloads
        }]
      };
    }

    if (id === "2") {
      return {
        element: [{
          id: "p2-solve-token",
          label: "Resolver token activo",
          detail: `Token ${simState.puzzle2Token || 1}`,
          tone: "primary",
          getPayloads: () => getPuzzle2Payloads("token")
        }],
        phase: [{
          id: "p2-solve-all",
          label: "Resolver ronda",
          detail: "Todos los tokens restantes",
          tone: "primary",
          getPayloads: () => getPuzzle2Payloads("all")
        }],
        all: [{
          id: "p2-solve-all-confirm",
          label: "Resolver todo",
          detail: "Todos los tokens restantes",
          tone: "danger",
          confirm: true,
          getPayloads: () => getPuzzle2Payloads("all")
        }]
      };
    }

    if (id === "3") {
      return {
        element: [manualPayloadAction],
        phase: [{
          id: "p3-solve-question",
          label: "Resolver pregunta",
          detail: "Envía la respuesta correcta actual",
          tone: "primary",
          getPayloads: getPuzzle3QuestionPayloads
        }],
        all: [{
          id: "p3-solve-question-confirm",
          label: "Resolver pregunta actual",
          detail: "No fuerza preguntas futuras",
          tone: "danger",
          confirm: true,
          getPayloads: getPuzzle3QuestionPayloads
        }]
      };
    }

    if (id === "4") {
      return {
        element: [manualPayloadAction],
        phase: [{
          id: "p4-solve-sequence",
          label: "Resolver secuencia actual",
          detail: "Usa la fase musical activa",
          tone: "primary",
          getPayloads: getPuzzle4RoundPayloads
        }],
        all: [{
          id: "p4-solve-all",
          label: "Resolver música completa",
          detail: "Secuencias 1 y 2",
          tone: "danger",
          confirm: true,
          getPayloads: getPuzzle4AllPayloads
        }]
      };
    }

    if (id === "5") {
      return {
        element: [manualPayloadAction],
        phase: [{
          id: "p5-solve-round",
          label: "Resolver ronda",
          detail: "Envía 0.0 a terminales pendientes",
          tone: "primary",
          getPayloads: getPuzzle5RoundPayloads
        }],
        all: [{
          id: "p5-solve-current",
          label: "Resolver fase actual",
          detail: "La ronda en curso",
          tone: "danger",
          confirm: true,
          getPayloads: getPuzzle5RoundPayloads
        }]
      };
    }

    if (id === "6" || id === "-1") {
      return {
        element: [manualPayloadAction],
        phase: [{
          id: "p6-enable-solve",
          label: "Activar modo resolver",
          detail: "solvePuzzle = true",
          tone: "primary",
          run: () => solvePuzzle6({ skipConfirm: true })
        }],
        all: [{
          id: "p6-enable-solve-confirm",
          label: "Resolver todo",
          detail: "Finaliza por modo solve",
          tone: "danger",
          confirm: true,
          run: () => solvePuzzle6({ skipConfirm: true })
        }]
      };
    }

    if (id === "7") {
      return {
        element: [manualPayloadAction],
        phase: [{
          id: "p7-solve-selected",
          label: "Resolver terminal actual",
          detail: "Usa el código objetivo",
          tone: "primary",
          getPayloads: getPuzzle7SelectedPayloads
        }],
        all: [{
          id: "p7-solve-all",
          label: "Resolver todo",
          detail: "Los 10 terminales",
          tone: "danger",
          confirm: true,
          getPayloads: () => Object.entries(p7TargetsByBox).map(([box, code]) => `P7,${box},${code}`)
        }]
      };
    }

    if (id === "8") {
      return {
        element: [{
          id: "p8-solve-token",
          label: "Resolver token seleccionado",
          detail: "Solo la fila del token activo",
          tone: "primary",
          getPayloads: () => getPuzzle8Payloads("token")
        }],
        phase: [{
          id: "p8-solve-input",
          label: "Resolver fase input",
          detail: "Todas las filas disponibles",
          tone: "primary",
          getPayloads: () => getPuzzle8Payloads("all")
        }],
        all: [{
          id: "p8-solve-all-confirm",
          label: "Resolver ronda actual",
          detail: "Fase input activa",
          tone: "danger",
          confirm: true,
          getPayloads: () => getPuzzle8Payloads("all")
        }]
      };
    }

    if (id === "9") {
      return {
        element: [manualPayloadAction],
        phase: [{
          id: "p9-solve-all",
          label: "Colocar solución completa",
          detail: "Rellena los 10 terminales",
          tone: "primary",
          getPayloads: () => p9SolutionPayloads
        }],
        all: [{
          id: "p9-solve-all-confirm",
          label: "Resolver todo",
          detail: "Los 10 tokens",
          tone: "danger",
          confirm: true,
          getPayloads: () => p9SolutionPayloads
        }]
      };
    }

    if (id === "10") {
      return {
        element: [{
          id: "p10-solve-box",
          label: "Resolver caja seleccionada",
          detail: `Caja ${simState.puzzle10Box || 0}`,
          tone: "primary",
          getPayloads: getPuzzle10SelectedPayloads
        }],
        phase: [{
          id: "p10-solve-all",
          label: "Resolver ronda de cajas",
          detail: "Los 10 códigos",
          tone: "primary",
          getPayloads: () => Object.entries(p10TargetsByBox).map(([box, code]) => `P10,${box},${code}`)
        }],
        all: [{
          id: "p10-solve-all-confirm",
          label: "Resolver todo",
          detail: "Los 10 códigos",
          tone: "danger",
          confirm: true,
          getPayloads: () => Object.entries(p10TargetsByBox).map(([box, code]) => `P10,${box},${code}`)
        }]
      };
    }

    if (id === "11") {
      return {
        element: [],
        phase: [{
          id: "p11-current-step-phase",
          label: "Resolver paso actual",
          detail: "Paso activo",
          tone: "primary",
          getPayloads: () => getPuzzle11Payloads("current")
        }],
        all: [{
          id: "p11-remaining",
          label: "Resolver restantes",
          detail: "Desde el paso actual",
          tone: "danger",
          confirm: true,
          getPayloads: () => getPuzzle11Payloads("remaining")
        }]
      };
    }

    if (id === "12") {
      return {
        element: [manualPayloadAction],
        phase: [{
          id: "p12-solve-round",
          label: "Resolver ronda",
          detail: "Iguala el objetivo actual",
          tone: "primary",
          getPayloads: getPuzzle12RoundPayloads
        }],
        all: [{
          id: "p12-solve-round-confirm",
          label: "Resolver ronda actual",
          detail: "No fuerza rondas futuras",
          tone: "danger",
          confirm: true,
          getPayloads: getPuzzle12RoundPayloads
        }]
      };
    }

    return common;
  }

  async function runResolverAction(action) {
    if (action.confirm && !window.confirm(`${action.label}?`)) {
      return;
    }

    if (typeof action.run === "function") {
      await action.run();
      appendLog({ local: true, resolver_action: action.id });
      return;
    }

    const payloads = typeof action.getPayloads === "function"
      ? await action.getPayloads()
      : action.payloads;

    const cleanPayloads = (Array.isArray(payloads) ? payloads : [payloads])
      .filter((payload) => payload !== null && payload !== undefined && String(payload).trim())
      .map((payload) => String(payload).trim());

    if (!cleanPayloads.length) {
      setStatus(`${action.label} · sin payloads`);
      return;
    }

    await runToFlask(() => sendPayloads(cleanPayloads));
    appendLog({ local: true, resolver_action: action.id, payloads: cleanPayloads });
  }

  async function fetchCurrentStateForPuzzle(puzzleId) {
    const response = await fetch("/current_state", { cache: "no-store" });
    const data = await response.json();
    if (puzzleId && String(data.puzzle_id) !== String(puzzleId)) {
      throw new Error(`puzzle_${puzzleId}_no_activo`);
    }
    return data;
  }

  async function getPuzzle1RoundPayloads() {
    const data = await fetchCurrentStateForPuzzle(1);
    return (Array.isArray(data.operations) ? data.operations : [])
      .filter((item) => Array.isArray(item) && item[2] === "N")
      .map((item) => `P1,0,${item[0]}`);
  }

  async function getPuzzle2Payloads(mode) {
    const data = await fetchCurrentStateForPuzzle(2);
    const alarmMode = !!data.alarm_mode;
    const progressByPlayer = {};
    (Array.isArray(data.players) ? data.players : []).forEach((player) => {
      progressByPlayer[Number(player.player || player.id || player.index)] = Number(player.progress || 0);
    });
    const players = mode === "token" ? [Number(simState.puzzle2Token || 1)] : Array.from({ length: 10 }, (_, index) => index + 1);
    return players.flatMap((player) => {
      const progress = progressByPlayer[player] ?? Number(simState.puzzle2Progress[player] || 0);
      return (p2Sequences[player] || [])
        .slice(progress)
        .map((symbol) => `P2,${player},${alarmMode ? p2AlarmChanges[symbol] : symbol}`);
    });
  }

  async function getPuzzle3QuestionPayloads() {
    const response = await fetch("/test/puzzle3_solution", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "puzzle3_solution_failed");
    }
    const correct = Number(data.correct_answer);
    if (!correct) {
      throw new Error("sin_respuesta_correcta");
    }
    simState.puzzle3Correct = data;
    simState.puzzle3Answer = correct;
    return Array.from({ length: 10 }, (_, index) => `P3,${index},${correct}`);
  }

  async function getPuzzle4RoundPayloads() {
    const data = await fetchCurrentStateForPuzzle(4);
    const streak = Number(data.streak || 0);
    const order = p4StreakOrders[streak];
    if (!Array.isArray(order) || !order.length) {
      return [];
    }
    return ["P4,2,0", "P4,3,0", ...order.map((song) => `P4,0,${song}`)];
  }

  function getPuzzle4AllPayloads() {
    return [
      "P4,2,0",
      "P4,3,0",
      ...p4StreakOrders[0].map((song) => `P4,0,${song}`),
      "P4,2,0",
      "P4,3,0",
      ...p4StreakOrders[1].map((song) => `P4,0,${song}`)
    ];
  }

  async function getPuzzle5RoundPayloads() {
    const data = await fetchCurrentStateForPuzzle(5);
    const sent = new Set(Array.isArray(data.times) ? data.times.map((item) => Number(item.player)) : []);
    return Array.from({ length: 10 }, (_, index) => index)
      .filter((index) => !sent.has(index))
      .map((index) => `P5,${index},0.0`);
  }

  function getPuzzle7SelectedPayloads() {
    const boxInput = document.getElementById("field-box");
    const box = boxInput ? Number(boxInput.value || 0) : 0;
    const code = p7TargetsByBox[box];
    return code ? [`P7,${box},${code}`] : [];
  }

  async function getPuzzle8Payloads(mode) {
    const data = await fetchCurrentStateForPuzzle(8);
    if (data.phase !== "input") {
      throw new Error("espera_fase_input");
    }
    const symbolNames = ["alpha", "beta", "delta", "epsilon", "gamma", "lambda", "mu", "omega", "pi", "sigma"];
    const symbolCodeByName = Object.fromEntries(symbolNames.map((name, index) => [name, String(index)]));
    const colorCodeByName = { red: "1", yellow: "2", blue: "3", black: "4", green: "5", white: "6" };
    const rows = Array.isArray(data.solution_rows) ? data.solution_rows : [];
    const selectedRows = mode === "token"
      ? rows.filter((row) => String(row.token_code) === String(simState.puzzle8Token))
      : rows;
    return selectedRows.flatMap((row) => {
      const tokenCode = row.token_code;
      return (Array.isArray(row.entries) ? row.entries : []).map((entry) => {
        const symbolCode = entry.symbol_code ?? symbolCodeByName[entry.symbol];
        const colorCode = entry.color_code ?? colorCodeByName[entry.color];
        return tokenCode != null && symbolCode != null && colorCode != null
          ? `P8,${symbolCode},${tokenCode},${colorCode}`
          : "";
      });
    }).filter(Boolean);
  }

  function getPuzzle10SelectedPayloads() {
    const box = Number(simState.puzzle10Box || 0);
    const code = p10TargetsByBox[box];
    return code ? [`P10,${box},${code}`] : [];
  }

  async function getPuzzle11Payloads(mode) {
    const data = await fetchCurrentStateForPuzzle(11);
    const step = Number(data.current_step || 0);
    if (step >= puzzle11Steps.length) {
      return [];
    }
    if (mode === "remaining") {
      return Array.from({ length: puzzle11Steps.length - step }, (_, index) => p11StepPayloads(step + index)).flat();
    }
    return p11StepPayloads(step);
  }

  async function getPuzzle12RoundPayloads() {
    const data = await fetchCurrentStateForPuzzle(12);
    const target = data.target;
    if (!Array.isArray(target) || target.length !== 6) {
      throw new Error("sin_target");
    }
    const maxVal = Math.max(...target);
    return Array.from({ length: maxVal }, (_, index) => {
      const buttons = target.map((value) => (Number(value) > index ? "1" : "0")).join("");
      return `P12,${index + 1},${buttons}`;
    });
  }

  function renderSimulator() {
    const puzzleId = els.puzzleSelect.value;
    if (puzzleId === "1") {
      renderPuzzle1Simulator();
      return;
    }
    if (puzzleId === "2") {
      renderPuzzle2Simulator();
      return;
    }
    if (puzzleId === "3") {
      renderPuzzle3Simulator();
      return;
    }
    if (puzzleId === "4") {
      renderPuzzle4Simulator();
      return;
    }
    if (puzzleId === "5") {
      renderPuzzle5Simulator();
      return;
    }
    if (puzzleId === "6") {
      renderPuzzle6Simulator();
      return;
    }
    if (puzzleId === "7") {
      renderPuzzle7Simulator();
      return;
    }
    if (puzzleId === "8") {
      renderPuzzle8Simulator();
      return;
    }
    if (puzzleId === "9") {
      renderPuzzle9Simulator();
      return;
    }
    if (puzzleId === "10") {
      try {
        renderPuzzle10Simulator();
      } catch (error) {
        console.error("Puzzle 10 simulator render failed", error);
        els.simContent.innerHTML = `
          <div class="sim-note">Error cargando la simulacion del puzzle 10.</div>
          <div class="sim-actions">
            <button type="button" class="sim-button" data-sim-p10-retry>Reintentar</button>
          </div>
        `;
        const retryButton = els.simContent.querySelector("[data-sim-p10-retry]");
        if (retryButton) {
          retryButton.addEventListener("click", () => renderForm());
        }
      }
      return;
    }
    if (puzzleId === "11") {
      renderPuzzle11Simulator();
      return;
    }
    if (puzzleId === "-1") {
      renderFinalCompatSimulator();





      return;
    }

    if (puzzleId === "12") {
      renderPuzzle12Simulator();
      return;
    }

    els.simContent.innerHTML = `
      <div class="sim-note">
        Este puzzle sigue usando bien el formulario rápido y el mensaje manual.
        Iremos anadiendo simulaciones visuales especificas donde tenga mas sentido con la mecanica real.
      </div>
    `;
  }

  function setFormValue(fieldId, value) {
    const input = document.getElementById(`field-${fieldId}`);
    if (!input) {
      return;
    }
    input.value = value;
  }

  function syncPuzzle1FormAndEditor() {
    setFormValue("a", simState.puzzle1A);
    setFormValue("b", simState.puzzle1B);
    if (els.topicSelect.value === "TO_FLASK") {
      els.messageEditor.value = buildPayload();
    }
  }

  function updatePuzzle1Preview() {
    const inputA = els.simContent.querySelector("#sim-p1-a");
    const inputB = els.simContent.querySelector("#sim-p1-b");
    const resultNode = els.simContent.querySelector(".sim-p1-card-result strong");
    if (!inputA || !inputB || !resultNode) {
      return;
    }

    simState.puzzle1A = inputA.value || "0";
    simState.puzzle1B = inputB.value || "0";
    resultNode.textContent = String(Number(simState.puzzle1A || 0) + Number(simState.puzzle1B || 0));
    syncPuzzle1FormAndEditor();
  }

  function renderPuzzle1Simulator() {
    const fieldA = document.getElementById("field-a");
    const fieldB = document.getElementById("field-b");
    if (fieldA && fieldB) {
      simState.puzzle1A = fieldA.value || simState.puzzle1A;
      simState.puzzle1B = fieldB.value || simState.puzzle1B;
    }

    const result = Number(simState.puzzle1A || 0) + Number(simState.puzzle1B || 0);

    els.simContent.innerHTML = `
      <div class="sim-p1-layout">
        <div class="sim-p1-piece">
          <div class="field-label">Tarjeta</div>
          <div class="sim-p1-card">
            <img src="/static/images/shared/gameplay/token_card.png" alt="" aria-hidden="true">
            <input id="sim-p1-a" class="sim-p1-input sim-p1-card-input" type="number" value="${simState.puzzle1A}" aria-label="Valor tarjeta">
          </div>
        </div>

        <div class="sim-p1-operator">+</div>

        <div class="sim-p1-piece">
          <div class="field-label">Terminal</div>
          <div class="sim-p1-card">
            <img src="/static/images/shared/gameplay/terminal_box.png" alt="" aria-hidden="true">
            <input id="sim-p1-b" class="sim-p1-input sim-p1-card-input" type="number" value="${simState.puzzle1B}" aria-label="Valor terminal">
          </div>
        </div>

        <div class="sim-p1-operator">=</div>

        <div class="sim-p1-result">
          <div class="field-label">Resultado</div>
          <div class="sim-p1-card sim-p1-card-result">
            <strong>${result}</strong>
          </div>
        </div>
      </div>
      <div class="sim-actions">
	        <button type="button" class="sim-button primary-action" data-sim-p1-send>Enviar acción</button>
      </div>
    `;

    ["a", "b"].forEach((key) => {
      const input = els.simContent.querySelector(`#sim-p1-${key}`);
      input.addEventListener("input", updatePuzzle1Preview);
      input.addEventListener("change", updatePuzzle1Preview);
    });

    els.simContent.querySelector("[data-sim-p1-send]").addEventListener("click", async () => {
      const payload = `P1,${simState.puzzle1A},${simState.puzzle1B}`;
      try {
        const previousTopic = els.topicSelect.value;
        els.topicSelect.value = "TO_FLASK";
        updateTopicHelp();
        updateSendModeUI();
        syncPuzzle1FormAndEditor();

        await sendPayloads([payload]);
        appendLog({ local: true, payload, simulated: "puzzle1" });

        if (previousTopic !== "TO_FLASK") {
          els.topicSelect.value = previousTopic;
          syncEditorForTopic();
        }
      } catch (error) {
        setStatus(`Puzzle 1 · ${error.message || "error"}`);
      }
    });

  }

  function renderPuzzle2Simulator() {
    const tokenMap = [5, 13, 17, 22, 10, 20, 35, 31, 14, 18];
    const symbolToTerminal = {
      5: 3,
      2: 0,
      8: 7,
      1: 2,
      9: 1,
      0: 9,
      6: 8,
      4: 5,
      7: 6,
      3: 4
    };
    const terminalToSymbol = Object.fromEntries(
      Object.entries(symbolToTerminal).map(([symbol, terminal]) => [terminal, Number(symbol)])
    );
    const sequences = {
      1: [5, 0, 9, 6, 2],
      2: [4, 3, 9, 0, 7],
      3: [8, 1, 7, 2, 4],
      4: [0, 4, 8, 1, 3],
      5: [6, 7, 8, 4, 9],
      6: [3, 5, 1, 9, 0],
      7: [2, 6, 3, 7, 8],
      8: [9, 2, 5, 7, 1],
      9: [0, 8, 2, 5, 6],
      10: [1, 4, 6, 3, 5]
    };
    const alarmChanges = {
      0: 2, 1: 3, 2: 0, 3: 1, 4: 5,
      5: 4, 6: 8, 7: 9, 8: 6, 9: 7
    };

    const selectedPlayer = Number(simState.puzzle2Token || 1);
    const selectedProgress = Number(simState.puzzle2Progress[selectedPlayer] || 0);
    const rawExpected = sequences[selectedPlayer]?.[selectedProgress];
    const actualExpected = rawExpected === undefined
      ? null
      : (simState.puzzle2Alarm ? alarmChanges[rawExpected] : rawExpected);
    const expectedTerminal = actualExpected === null ? null : symbolToTerminal[actualExpected];
    const renderP2Symbol = (index) => {
      return `
        <div class="sim-p2-shape-chip">
          <img src="/static/images/puzzle2/symbols/symbol_${index}.png" alt="Simbolo ${index}">
        </div>
      `;
    };

    const tokens = tokenMap.map((token, index) => {
      const player = index + 1;
      const selected = String(player) === String(simState.puzzle2Token) ? " is-selected" : "";
      const progress = Number(simState.puzzle2Progress[player] || 0);
      return `
        <button type="button" class="sim-box sim-p2-token${selected}" data-sim-p2-token="${player}">
          <strong>${token}</strong>
          <span>T${player} · ${progress}/5</span>
        </button>
      `;
    }).join("");

    const terminals = Array.from({ length: 10 }, (_, index) => {
      const symbol = terminalToSymbol[index];
      const targetClass = expectedTerminal === index ? " is-target" : "";
      return `
        <button type="button" class="sim-p2-terminal${targetClass}" data-sim-p2-terminal="${index}" data-sim-p2-symbol="${symbol}">
          <strong>Terminal ${index}</strong>
          ${renderP2Symbol(symbol)}
        </button>
      `;
    }).join("");

    els.simContent.innerHTML = `
      <div class="sim-selected-readout sim-p2-status${simState.puzzle2Alarm ? " is-alarm" : ""}">
        <strong>${simState.puzzle2Alarm ? "ALARMA" : "NORMAL"}</strong>
        <span>${simState.puzzle2Alarm ? "Usa el simbolo opuesto" : "Usa el simbolo real"}</span>
      </div>
      <div class="sim-p2-head">
        <div class="sim-grid box-grid">${tokens}</div>
        <div class="sim-p2-next">
          <div class="state-metric"><span>Progreso</span><strong>${selectedProgress}/5</strong></div>
          <div class="state-metric"><span>Simbolo real</span><strong>${rawExpected ?? "--"}</strong></div>
          <div class="state-metric"><span>Simbolo a pulsar</span><strong>${actualExpected ?? "--"}</strong></div>
          <div class="state-metric"><span>Terminal a pulsar</span><strong>${expectedTerminal ?? "--"}</strong></div>
          <div class="sim-actions">
            <button type="button" class="sim-button" data-sim-p2-refresh>Actualizar</button>
          </div>
        </div>
      </div>
      <div class="sim-p2-board">
        ${terminals}
      </div>
    `;

    els.simContent.querySelectorAll("[data-sim-p2-token]").forEach((button) => {
      button.addEventListener("click", async () => {
        simState.puzzle2Token = button.dataset.simP2Token;
        await syncPuzzle2State(true);
        renderPuzzle2Simulator();
      });
    });

    els.simContent.querySelector("[data-sim-p2-refresh]").addEventListener("click", async () => {
      try {
        await syncPuzzle2State();
        renderPuzzle2Simulator();
      } catch (error) {
        setStatus(`Puzzle 2 · ${error.message || "error"}`);
      }
    });

    els.simContent.querySelectorAll("[data-sim-p2-terminal]").forEach((button) => {
      button.addEventListener("click", async () => {
        const symbol = button.dataset.simP2Symbol;
        const payload = `P2,${selectedPlayer},${symbol}`;
        const progressBeforeSend = Number(simState.puzzle2Progress[selectedPlayer] || 0);
        try {
          const previousTopic = els.topicSelect.value;
          els.topicSelect.value = "TO_FLASK";
          updateTopicHelp();
          updateSendModeUI();
          await sendPayloads([payload]);
          appendLog({
            local: true,
            payload,
            simulated: "puzzle2",
            token: tokenMap[selectedPlayer - 1],
            alarm_mode: simState.puzzle2Alarm
          });
          await syncPuzzle2State(false, {
            player: selectedPlayer,
            previousProgress: progressBeforeSend
          });
          renderPuzzle2Simulator();
          if (previousTopic !== "TO_FLASK") {
            els.topicSelect.value = previousTopic;
            syncEditorForTopic();
          }
        } catch (error) {
          setStatus(`Puzzle 2 · ${error.message || "error"}`);
        }
      });
    });
  }

	  function renderPuzzle4Simulator() {
    const buttons = [
      { value: "4", label: "Escuchar la muestra completa", shortLabel: "Azul", colorClass: "sim-p4-blue" },
      { value: "3", label: "Registrar pulsación", shortLabel: "Verde", colorClass: "sim-p4-green" },
      { value: "1", label: "Cancelar registro", shortLabel: "Rojo", colorClass: "sim-p4-red" }
    ].map((item) => {
      const selected = simState.puzzle4Button === item.value ? " is-selected" : "";
      return `
        <button
          type="button"
          class="sim-p4-control${selected}"
          data-sim-p4-button="${item.value}"
          title="${item.shortLabel}: ${item.label}"
          aria-label="${item.shortLabel}: ${item.label}"
        >
          <span class="sim-p4-disc ${item.colorClass}" aria-hidden="true"></span>
          <span class="sim-p4-copy">
            <strong>${item.shortLabel}</strong>
            <span>${item.label}</span>
          </span>
        </button>
      `;
    }).join("");

    const tracks = Array.from({ length: 10 }, (_, index) => {
      const selected = simState.puzzle4Song === String(index) ? " is-selected" : "";
      return `<button type="button" class="sim-token${selected}" data-sim-p4-song="${index}">${index}</button>`;
    }).join("");

    els.simContent.innerHTML = `
      <div class="sim-note">Los cuatro botones de color replican los del juego real. Las pistas quedan aparte para simular la accion interna de reproducir track.</div>
      <div class="sim-selected-readout">Ultimo boton: <strong>${simState.puzzle4Button}</strong> · Pista activa: <strong>${simState.puzzle4Song}</strong></div>
      <div class="sim-p4-controls">${buttons}</div>
      <div class="field-label">Pistas</div>
      <div class="sim-palette">${tracks}</div>
      <div class="sim-actions">
        <button type="button" class="sim-button" data-sim-p4-send-track>Reproducir pista</button>
      </div>
    `;

    els.simContent.querySelectorAll("[data-sim-p4-button]").forEach((button) => {
      button.addEventListener("click", async () => {
        simState.puzzle4Button = button.dataset.simP4Button;
        const payload = `P4,${simState.puzzle4Button},${simState.puzzle4Song}`;
        await sendPayloads([payload]);
        appendLog({ local: true, payload, simulated: "puzzle4" });
        renderPuzzle4Simulator();
      });
    });

    els.simContent.querySelectorAll("[data-sim-p4-song]").forEach((button) => {
      button.addEventListener("click", () => {
        simState.puzzle4Song = button.dataset.simP4Song;
        renderPuzzle4Simulator();
      });
    });

    els.simContent.querySelector("[data-sim-p4-send-track]").addEventListener("click", async () => {
      simState.puzzle4Button = "0";
      const payload = `P4,0,${simState.puzzle4Song}`;
      await sendPayloads([payload]);
      appendLog({ local: true, payload, simulated: "puzzle4" });
      renderPuzzle4Simulator();
    });

  }

  function renderPuzzle6Simulator() {
    const boxes = Array.from({ length: 10 }, (_, index) => {
      const selected = simState.puzzle6Box === String(index) ? " is-selected" : "";
      return `<button type="button" class="sim-box${selected}" data-sim-p6-box="${index}">Terminal ${index}</button>`;
    }).join("");

    els.simContent.innerHTML = `
      <div class="sim-note">Pulsa un terminal para simular que ha perdido energia y forzar el reinicio del sistema.</div>
      <div class="sim-grid box-grid">${boxes}</div>
    `;

    els.simContent.querySelectorAll("[data-sim-p6-box]").forEach((button) => {
      button.addEventListener("click", async () => {
        const box = button.dataset.simP6Box;
        simState.puzzle6Box = box;
        const payload = `P6,${box}`;
        await sendPayloads([payload]);
        appendLog({ local: true, payload, simulated: "puzzle6" });
        renderPuzzle6Simulator();
      });
    });
  }

  function renderPuzzle5Simulator() {
    const syncPuzzle5State = async (silent = true) => {
      const response = await fetch("/current_state");
      const data = await response.json();
      if (String(data.puzzle_id) !== "5") {
        throw new Error("no activo");
      }
      simState.puzzle5Round = Number(data.round || 0);
      simState.puzzle5Objective = data.objective ?? null;
      simState.puzzle5Limit = data.limit ?? null;
      simState.puzzle5Total = data.total ?? 0;
      simState.puzzle5Waiting = !!data.waiting;
      simState.puzzle5ActiveRound = !!data.active_round;
      simState.puzzle5Submitted = Array.isArray(data.times) ? data.times.map((item) => Number(item.player)) : [];
      if (!silent) {
        setStatus("Puzzle 5 sincronizado");
      }
      return data;
    };

    const presets = ["-1.5", "-0.5", "0.0", "0.5", "1.5", "3.0"];
    const presetButtons = presets.map((value) => {
      const selected = simState.puzzle5Error === value ? " is-selected" : "";
      return `<button type="button" class="sim-button${selected}" data-sim-p5-error="${value}">${value}s</button>`;
    }).join("");

    const boxes = Array.from({ length: 10 }, (_, index) => {
      const sent = (simState.puzzle5Submitted || []).includes(index);
      const sentClass = sent ? " is-selected" : "";
      return `<button type="button" class="sim-box${sentClass}" data-sim-p5-box="${index}">Terminal ${index}</button>`;
    }).join("");

    const roundLabel = simState.puzzle5Round || 1;
    const objectiveLabel = simState.puzzle5Objective ?? (roundLabel === 1 ? 10 : 30);
    const statusLabel = simState.puzzle5Waiting
      ? "Esperando"
      : simState.puzzle5ActiveRound
        ? "Activa"
        : "Parada";

    els.simContent.innerHTML = `
      <div class="sim-p5-hero">
        <div class="sim-p5-target">${objectiveLabel}<span>s</span></div>
        <div class="sim-p5-meta">
          <div class="state-metric"><span>Ronda</span><strong>${roundLabel}</strong></div>
          <div class="state-metric"><span>Estado</span><strong>${statusLabel}</strong></div>
          <div class="state-metric"><span>Limite</span><strong>${simState.puzzle5Limit ?? "--"}</strong></div>
          <div class="state-metric"><span>Total</span><strong>${simState.puzzle5Total ?? 0}</strong></div>
        </div>
      </div>
      <div class="sim-selected-readout">Error activo: <strong>${simState.puzzle5Error}s</strong></div>
      <div class="sim-grid answer-grid">${presetButtons}</div>
      <label>
        <span class="field-label">Error manual</span>
        <input id="sim-p5-custom-error" type="number" step="0.1" value="${simState.puzzle5Error}">
      </label>
      <div class="sim-grid box-grid">${boxes}</div>
      <div class="sim-actions">
        <button type="button" class="sim-button" data-sim-p5-refresh>Actualizar</button>
        <button type="button" class="sim-button" data-sim-p5-all>Enviar a todos los terminales</button>
      </div>
    `;

    els.simContent.querySelectorAll("[data-sim-p5-error]").forEach((button) => {
      button.addEventListener("click", () => {
        simState.puzzle5Error = button.dataset.simP5Error;
        renderPuzzle5Simulator();
      });
    });

    const customInput = els.simContent.querySelector("#sim-p5-custom-error");
    if (customInput) {
      customInput.addEventListener("change", () => {
        simState.puzzle5Error = customInput.value || "0.0";
        renderPuzzle5Simulator();
      });
    }

    const refreshBtn = els.simContent.querySelector("[data-sim-p5-refresh]");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", async () => {
        try {
          await syncPuzzle5State(false);
          renderPuzzle5Simulator();
        } catch (error) {
          setStatus(`Puzzle 5 · ${error.message || "error"}`);
        }
      });
    }

    els.simContent.querySelectorAll("[data-sim-p5-box]").forEach((button) => {
      button.addEventListener("click", async () => {
        const box = Number(button.dataset.simP5Box);
        const payload = `P5,${box},${simState.puzzle5Error}`;
        try {
          await sendPayloads([payload]);
          appendLog({ local: true, payload, simulated: "puzzle5" });
          await syncPuzzle5State();
          renderPuzzle5Simulator();
        } catch (error) {
          setStatus(`Puzzle 5 · ${error.message || "error"}`);
        }
      });
    });

    const sendAll = els.simContent.querySelector("[data-sim-p5-all]");
    if (sendAll) {
      sendAll.addEventListener("click", async () => {
        try {
          const payloads = Array.from({ length: 10 }, (_, index) => `P5,${index},${simState.puzzle5Error}`);
          await sendPayloads(payloads);
          payloads.forEach((payload) => appendLog({ local: true, payload, simulated: "puzzle5" }));
          await syncPuzzle5State();
          renderPuzzle5Simulator();
        } catch (error) {
          setStatus(`Puzzle 5 · ${error.message || "error"}`);
        }
      });
    }
  }

  function renderPuzzle7Simulator() {
    const digitButtons = [0, 1, 2, 3, 4].map((digit) => {
      return `<button type="button" class="sim-token" data-sim-p7-digit="${digit}">${digit}</button>`;
    }).join("");

    const rows = Array.from({ length: 10 }, (_, index) => {
      return `<button type="button" class="sim-box" data-sim-p7-box="${index}">Terminal ${index}</button>`;
    }).join("");

    const code = simState.puzzle7Digits.join("");

    els.simContent.innerHTML = `
      <div class="sim-note">Construye el codigo de 4 digitos y luego pulsa el terminal. Cada digito representa un color de la tira.</div>
      <div class="sim-selected-readout">Codigo activo: <strong>${code}</strong></div>
      <div class="sim-grid answer-grid">
        <label><span class="field-label">D1</span><input data-sim-p7-slot="0" type="number" min="0" max="4" value="${simState.puzzle7Digits[0]}"></label>
        <label><span class="field-label">D2</span><input data-sim-p7-slot="1" type="number" min="0" max="4" value="${simState.puzzle7Digits[1]}"></label>
        <label><span class="field-label">D3</span><input data-sim-p7-slot="2" type="number" min="0" max="4" value="${simState.puzzle7Digits[2]}"></label>
        <label><span class="field-label">D4</span><input data-sim-p7-slot="3" type="number" min="0" max="4" value="${simState.puzzle7Digits[3]}"></label>
      </div>
      <div class="sim-palette">${digitButtons}</div>
      <div class="sim-grid box-grid">${rows}</div>
      <div class="sim-actions">
        <button type="button" class="sim-button" data-sim-p7-fill="0424">0424</button>
        <button type="button" class="sim-button" data-sim-p7-fill="4310">4310</button>
        <button type="button" class="sim-button" data-sim-p7-fill="1234">1234</button>
      </div>
    `;

    els.simContent.querySelectorAll("[data-sim-p7-slot]").forEach((input) => {
      input.addEventListener("change", () => {
        const slot = Number(input.dataset.simP7Slot);
        let value = String(input.value || "0");
        if (!/^[0-4]$/.test(value)) value = "0";
        simState.puzzle7Digits[slot] = value;
        renderPuzzle7Simulator();
      });
    });

    els.simContent.querySelectorAll("[data-sim-p7-fill]").forEach((button) => {
      button.addEventListener("click", () => {
        simState.puzzle7Digits = button.dataset.simP7Fill.split("");
        renderPuzzle7Simulator();
      });
    });

    els.simContent.querySelectorAll("[data-sim-p7-box]").forEach((button) => {
      button.addEventListener("click", async () => {
        const box = Number(button.dataset.simP7Box);
        const payload = `P7,${box},${simState.puzzle7Digits.join("")}`;
        await sendPayloads([payload]);
        appendLog({ local: true, payload, simulated: "puzzle7" });
      });
    });
  }

  function renderPuzzle3Simulator() {
    const refreshPuzzle3Solution = async () => {
      const response = await fetch("/test/puzzle3_solution");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "puzzle3_solution_failed");
      }
      simState.puzzle3Correct = data;
    };

    const answerButtons = Array.from({ length: 6 }, (_, index) => {
      const answer = index + 1;
      const selected = simState.puzzle3Answer === answer ? " is-selected" : "";
      return `<button type="button" class="sim-button${selected}" data-sim-answer="${answer}">${answer}</button>`;
    }).join("");

    const boxButtons = Array.from({ length: 10 }, (_, index) => {
      return `
        <button type="button" class="sim-box sim-p3-terminal" data-sim-p3-box="${index}">
          <img src="/static/images/shared/gameplay/terminal_box.png" alt="" aria-hidden="true">
          <span>${index}</span>
        </button>
      `;
    }).join("");

    const correctBlock = simState.puzzle3Correct
      ? `<div class="sim-selected-readout">Correcta actual: <strong>${simState.puzzle3Correct.correct_answer}</strong> · ${simState.puzzle3Correct.correct_text || ""}</div>`
      : `<div class="sim-selected-readout">Correcta actual: <strong>--</strong></div>`;

    els.simContent.innerHTML = `
      <div class="sim-note">Selecciona una respuesta y luego toca uno o varios terminales, como harian los jugadores.</div>
      <div class="sim-selected-readout">Activa: <strong>${simState.puzzle3Answer}</strong></div>
      ${correctBlock}
      <div class="field-label">Respuesta</div>
      <div class="sim-grid answer-grid">${answerButtons}</div>
      <div class="field-label">Terminal</div>
      <div class="sim-grid box-grid">${boxButtons}</div>
      <div class="sim-actions">
        <button type="button" class="sim-button" data-sim-p3-solution>Ver correcta</button>
        <button type="button" class="sim-button" data-sim-p3-all>Enviar a todos los terminales</button>
      </div>
    `;

    els.simContent.querySelectorAll("[data-sim-answer]").forEach((button) => {
      button.addEventListener("click", () => {
        simState.puzzle3Answer = Number(button.dataset.simAnswer);
        renderPuzzle3Simulator();
      });
    });

    els.simContent.querySelectorAll("[data-sim-p3-box]").forEach((button) => {
      button.addEventListener("click", async () => {
        const box = Number(button.dataset.simP3Box);
        const payload = `P3,${box},${simState.puzzle3Answer}`;
        try {
          await sendPayloads([payload]);
          appendLog({ local: true, payload, simulated: "puzzle3" });
          await refreshPuzzle3Solution();
          renderPuzzle3Simulator();
        } catch (error) {
          appendLog({ error: String(error), simulated: "puzzle3" });
        }
      });
    });

    const sendAll = els.simContent.querySelector("[data-sim-p3-all]");
    if (sendAll) {
      sendAll.addEventListener("click", async () => {
        try {
          const payloads = Array.from({ length: 10 }, (_, index) => `P3,${index},${simState.puzzle3Answer}`);
          await sendPayloads(payloads);
          payloads.forEach((payload) => appendLog({ local: true, payload, simulated: "puzzle3" }));
          await refreshPuzzle3Solution();
          renderPuzzle3Simulator();
        } catch (error) {
          appendLog({ error: String(error), simulated: "puzzle3" });
        }
      });
    }

    const showSolution = els.simContent.querySelector("[data-sim-p3-solution]");
    if (showSolution) {
      showSolution.addEventListener("click", async () => {
        try {
          await refreshPuzzle3Solution();
          renderPuzzle3Simulator();
        } catch (error) {
          appendLog({ error: String(error), simulated: "puzzle3_solution" });
        }
      });
    }

  }

  function renderPuzzle9Simulator() {
    const tokens = [
      { value: "-1", label: "Vaciar" },
      { value: "0", label: "5" },
      { value: "1", label: "10" },
      { value: "2", label: "13" },
      { value: "3", label: "14" },
      { value: "4", label: "17" },
      { value: "5", label: "18" },
      { value: "6", label: "20" },
      { value: "7", label: "22" },
      { value: "8", label: "31" },
      { value: "9", label: "35" }
    ];

    const tokenButtons = tokens.map((token) => {
      const selected = simState.puzzle9Token === token.value ? " is-selected" : "";
      return `<button type="button" class="sim-token${selected}" data-sim-p9-token="${token.value}">${token.label}</button>`;
    }).join("");

    const rows = [
      [0],
      [1, 2],
      [3, 4, 5],
      [6, 7, 8, 9]
    ];

    const solutionMap = [
      { box: 0, token: "18" },
      { box: 1, token: "20" },
      { box: 2, token: "14" },
      { box: 3, token: "22" },
      { box: 4, token: "5" },
      { box: 5, token: "31" },
      { box: 6, token: "17" },
      { box: 7, token: "13" },
      { box: 8, token: "10" },
      { box: 9, token: "35" }
    ];

    const board = rows.map((row) => {
      const cells = row.map((box) => `<button type="button" class="sim-box" data-sim-p9-box="${box}">Terminal ${box}</button>`).join("");
      return `<div class="sim-p9-row">${cells}</div>`;
    }).join("");

    const solutionList = solutionMap
      .map((item) => `<div class="sim-solution-item"><span>Terminal ${item.box}</span><strong>${item.token}</strong></div>`)
      .join("");

    const currentLabel = tokens.find((token) => token.value === simState.puzzle9Token)?.label || simState.puzzle9Token;

    els.simContent.innerHTML = `
      <div class="sim-note">Selecciona un token y despues pulsa un terminal de la piramide para colocarlo.</div>
      <div class="sim-selected-readout">Token activo: <strong>${currentLabel}</strong></div>
      <div class="sim-palette">${tokenButtons}</div>
      <div class="sim-p9-layout">
        <div class="sim-p9-board">${board}</div>
        <div class="sim-solution-card">
          <div class="field-label">Solucion</div>
          <div class="sim-solution-list">${solutionList}</div>
        </div>
      </div>
    `;

    els.simContent.querySelectorAll("[data-sim-p9-token]").forEach((button) => {
      button.addEventListener("click", () => {
        simState.puzzle9Token = button.dataset.simP9Token;
        renderPuzzle9Simulator();
      });
    });

    els.simContent.querySelectorAll("[data-sim-p9-box]").forEach((button) => {
      button.addEventListener("click", async () => {
        const box = Number(button.dataset.simP9Box);
        const payload = `P9,${box},${simState.puzzle9Token}`;
        await sendPayloads([payload]);
        appendLog({ local: true, payload, simulated: "puzzle9" });
      });
    });
  }

  function syncPuzzle10FormAndEditor() {
    const codeInput = document.getElementById("field-code");
    const code = codeInput ? codeInput.value : "000";
    setFormValue("box", simState.puzzle10Box);
    setFormValue("code", code);
    if (els.topicSelect.value === "TO_FLASK") {
      els.messageEditor.value = buildPayload();
    }
  }

  function renderPuzzle10Simulator() {
    // Selection is controlled by simulator buttons, not form input
    const targetCode = p10TargetsByBox[Number(simState.puzzle10Box)] || "---";

    const boxButtons = Array.from({ length: 10 }, (_, index) => {
      const selected = simState.puzzle10Box === String(index) ? " is-selected" : "";
      return `<button type="button" class="sim-box${selected}" data-sim-p10-box="${index}">Caja ${index}</button>`;
    }).join("");

    els.simContent.innerHTML = `
	      <div class="sim-note">Selecciona una caja y pulsa el botón para marcarla como resuelta.</div>
      <div class="sim-selected-readout">Caja seleccionada: <strong>${simState.puzzle10Box}</strong> · Codigo objetivo: <strong>${targetCode}</strong></div>
      <div class="field-label">Caja</div>
      <div class="sim-grid box-grid">${boxButtons}</div>
      <div class="sim-actions">
      </div>
    `;

    els.simContent.querySelectorAll("[data-sim-p10-box]").forEach((button) => {
      button.addEventListener("click", () => {
        simState.puzzle10Box = button.dataset.simP10Box;
        renderPuzzle10Simulator();
      });
    });

    setFormValue("box", simState.puzzle10Box);
    setFormValue("code", targetCode);
    syncPuzzle10FormAndEditor();
  }

  function renderPuzzle11Simulator() {
    const syncPuzzle11State = async (silent = true) => {
      const response = await fetch("/current_state", { cache: "no-store" });
      const data = await response.json();

      if (String(data.puzzle_id) !== "11") {
        simState.puzzle11.active = false;
        simState.puzzle11.currentStep = 0;
        simState.puzzle11.completedSteps = [];
        simState.puzzle11.solved = false;
        if (!silent) {
          setStatus("Puzzle 11 · no activo");
        }
        return null;
      }

      simState.puzzle11.active = true;
      simState.puzzle11.currentStep = Number(data.current_step || 0);
      simState.puzzle11.completedSteps = Array.isArray(data.completed_steps)
        ? data.completed_steps.map((step) => Number(step))
        : [];
      simState.puzzle11.solved = !!data.puzzle_solved;

      if (!silent) {
        setStatus("Puzzle 11 sincronizado");
      }
      return data;
    };

    const renderUI = () => {
      const currentStep = Number(simState.puzzle11.currentStep || 0);
      const completed = new Set(simState.puzzle11.completedSteps || []);
      const solved = !!simState.puzzle11.solved;
      const nextStep = Math.min(currentStep, puzzle11Steps.length - 1);
      const nextCopy = solved
        ? "Tutorial completado."
        : puzzle11Steps[nextStep] || "Sin paso activo.";

      const phaseRows = puzzle11Steps.map((text, index) => {
        const stateClass = completed.has(index)
          ? " is-selected"
          : (index === currentStep && !solved ? "" : "");
        const badge = completed.has(index)
          ? "Completado"
          : (index === currentStep && !solved ? "Actual" : "Pendiente");

        return `
          <div class="sim-solution-item${stateClass}">
            <span>${index + 1}. ${escapeHtml(text)} <em>(${badge})</em></span>
            <button type="button" class="sim-button" data-sim-p11-send-step="${index}" ${solved || index !== currentStep ? "disabled" : ""}>Enviar</button>
          </div>
        `;
      }).join("");

      els.simContent.innerHTML = `
        <div class="sim-selected-readout">
          Estat: <strong>${simState.puzzle11.active ? "actiu" : "inactiu"}</strong>
          · Pas: <strong>${solved ? "10/10" : `${Math.min(currentStep + 1, 10)}/10`}</strong>
          · Resolt: <strong>${solved ? "si" : "no"}</strong>
        </div>
        ${solved ? '<div class="sim-note sim-note-success">✓ ¡Pirámide activada y simulación completada!</div>' : ""}
        <div class="sim-note">Fase actual: ${escapeHtml(nextCopy)}</div>
        <div class="sim-solution-card">
          <div class="field-label">Fases del Puzzle 11</div>
          <div class="sim-solution-list">${phaseRows}</div>
        </div>
      `;

      const runToFlask = async (payloads) => {
        const previousTopic = els.topicSelect.value;
        try {
          els.topicSelect.value = "TO_FLASK";
          updateTopicHelp();
          updateSendModeUI();
          await sendPayloads(payloads);
        } finally {
          if (previousTopic !== "TO_FLASK") {
            els.topicSelect.value = previousTopic;
            syncEditorForTopic();
          }
        }
      };

      els.simContent.querySelectorAll("[data-sim-p11-send-step]").forEach((button) => {
        button.addEventListener("click", async () => {
          try {
            const step = Number(button.dataset.simP11SendStep);
            const payloads = p11StepPayloads(step);
            await runToFlask(payloads);
            appendLog({ local: true, payloads, simulated: "puzzle11_manual_step" });
            await syncPuzzle11State(true);
            renderUI();
          } catch (error) {
            setStatus(`Puzzle 11 · ${error.message || "error"}`);
          }
        });
      });
    };

    syncPuzzle11State(true)
      .then(() => {
        renderUI();
      })
      .catch((error) => {
        setStatus(`Puzzle 11 · ${error.message || "error"}`);
        renderUI();
      });
  }

  function renderPuzzle8Simulator() {
    const syncPuzzle8State = async (silent = true) => {
      const response = await fetch("/current_state");
      const data = await response.json();
      if (String(data.puzzle_id) !== "8") {
        throw new Error("no activo");
      }
      simState.puzzle8Phase = data.phase || "idle";
      simState.puzzle8Round = data.round || 0;
      simState.puzzle8RoundTotal = data.round_total || simState.puzzle8RoundTotal || 3;
      simState.puzzle8State = data;
      if (!silent) {
        setStatus("Puzzle 8 sincronizado");
      }
      return data;
    };

    const ensurePuzzle8Entries = () => {
      if (!Array.isArray(simState.puzzle8Entries)) {
        simState.puzzle8Entries = [];
      }
      while (simState.puzzle8Entries.length < 3) {
        simState.puzzle8Entries.push({ symbol: "0", color: "1" });
      }
      return simState.puzzle8Entries;
    };

    const tokenMap = [
      { value: "0", label: "5", terminal: 3 },
      { value: "1", label: "10", terminal: 5 },
      { value: "2", label: "13", terminal: 6 },
      { value: "3", label: "14", terminal: 1 },
      { value: "4", label: "17", terminal: 2 },
      { value: "5", label: "18", terminal: 0 },
      { value: "6", label: "20", terminal: 4 },
      { value: "7", label: "22", terminal: 9 },
      { value: "8", label: "31", terminal: 7 },
      { value: "9", label: "35", terminal: 8 }
    ];
    const symbolNames = ["alpha", "beta", "delta", "epsilon", "gamma", "lambda", "mu", "omega", "pi", "sigma"];
    const colorNames = { "1": "red", "2": "yellow", "3": "blue", "4": "black", "5": "green", "6": "white" };
    const phase = simState.puzzle8Phase || "idle";
    const state = simState.puzzle8State || {};
    const roundTotal = Number(state.round_total || simState.puzzle8RoundTotal || 3);
    const tokenByTerminal = Object.fromEntries(tokenMap.map((token) => [token.terminal, token]));
    const tokenByCode = Object.fromEntries(tokenMap.map((token) => [token.value, token]));
    const symbolCodeByName = Object.fromEntries(symbolNames.map((name, index) => [name, String(index)]));
    const colorCodeByName = Object.fromEntries(Object.entries(colorNames).map(([code, name]) => [name, code]));
    const requiredEntries = Number(state.input_required || simState.puzzle8Round || 1);
    const activeToken = tokenMap.find((token) => token.value === simState.puzzle8Token);
    const inputEntries = ensurePuzzle8Entries().slice(0, requiredEntries);
    const inputCounts = state.input_counts && typeof state.input_counts === "object" ? state.input_counts : {};
    const inputStatus = state.input_status && typeof state.input_status === "object" ? state.input_status : {};

    const renderSymbolIcon = (symbol, color, compact = false) => {
      const safeSymbol = symbol || "alpha";
      const safeColor = color || "white";
      return `
        <span class="sim-p8-icon-wrap${compact ? " is-compact" : ""}">
          <span class="sim-p8-icon" style="-webkit-mask-image:url('/static/images/puzzle8/${safeSymbol}.svg');mask-image:url('/static/images/puzzle8/${safeSymbol}.svg');background:${safeColor};"></span>
        </span>
      `;
    };

    const solutionRows = Array.isArray(state.solution_rows) ? state.solution_rows : tokenMap
      .slice()
      .sort((left, right) => left.terminal - right.terminal)
      .map((token) => ({ box: token.terminal, token: Number(token.label), token_code: Number(token.value), entries: [] }));

    const solutionRowsMarkup = solutionRows.map((row) => {
      const entries = Array.isArray(row.entries) ? row.entries : [];
      const tokenLabel = row.token ?? "--";
      const rowTokenCode = row.token_code != null ? String(row.token_code) : null;
      const isSelected = rowTokenCode === simState.puzzle8Token;
      const count = Number(inputCounts[row.box] || 0);
      const status = inputStatus[row.box] || "pending";
      const progressClass = status === "wrong"
        ? " is-wrong"
        : status === "complete"
          ? " is-complete"
          : status === "partial"
            ? " is-partial"
            : "";
      const progressLabel = status === "wrong"
        ? "Error"
        : status === "complete"
          ? "Enviado"
          : count > 0
            ? `${count}/${requiredEntries}`
            : "";
      const iconCell = entries.length
        ? entries.map((entry) => renderSymbolIcon(entry.symbol, entry.color, true)).join("")
        : '<span class="sim-p8-empty">--</span>';
      return `
        <div class="sim-p8-solution-row${isSelected ? " is-selected" : ""}${progressClass}" data-sim-p8-select-token="${rowTokenCode || ""}">
          <div class="sim-p8-solution-grid">
            <div class="sim-p8-solution-cell token">
              <span>${tokenLabel}</span>
              ${progressLabel ? `<span class="sim-p8-progress-pill">${progressLabel}</span>` : ""}
            </div>
            <div class="sim-p8-solution-cell icons">${iconCell}</div>
            <div class="sim-p8-solution-cell action">
            </div>
          </div>
        </div>
      `;
    }).join("");

    const entryControlsMarkup = inputEntries.map((entry, index) => {
      const symbolName = symbolNames[Number(entry.symbol)] || "alpha";
      const colorName = colorNames[entry.color] || "red";
      return `
        <div class="sim-p8-manual-row">
          <div class="sim-p8-manual-index">${index + 1}</div>
          <div class="sim-p8-manual-preview">${renderSymbolIcon(symbolName, colorName)}</div>
          <label>
            <span class="field-label">Forma</span>
            <select data-sim-p8-entry-symbol="${index}">
              ${symbolNames.map((label, symbolIndex) => `<option value="${symbolIndex}"${entry.symbol === String(symbolIndex) ? " selected" : ""}>${label}</option>`).join("")}
            </select>
          </label>
          <label>
            <span class="field-label">Color</span>
            <select data-sim-p8-entry-color="${index}">
              ${Object.entries(colorNames).map(([value, label]) => `<option value="${value}"${entry.color === value ? " selected" : ""}>${label}</option>`).join("")}
            </select>
          </label>
        </div>
      `;
    }).join("");

    els.simContent.innerHTML = `
      <div class="sim-selected-readout">
        Fase: <strong>${phase}</strong> · Ronda: <strong>${simState.puzzle8Round || 0}/${roundTotal}</strong>
      </div>
      <div class="sim-p8-display">
        <div class="field-label">Solucion</div>
        <div class="sim-p8-solution-panel">
          <div class="sim-p8-solution-head">
            <span>Token</span>
            <span>Icono</span>
            <span></span>
          </div>
          <div class="sim-p8-solution-body">
            ${solutionRowsMarkup}
          </div>
        </div>
      </div>
      <div class="sim-p8-entry">
        <div class="sim-p8-entry-meta">
          Token <strong>${activeToken?.label || "--"}</strong> · ${requiredEntries} forma${requiredEntries > 1 ? "s" : ""} para este token
        </div>
      </div>
      <div class="sim-p8-manual">
        ${entryControlsMarkup}
      </div>
      <div class="sim-actions">
        <button type="button" class="sim-button" data-sim-p8-refresh>Actualizar</button>
        <button type="button" class="sim-button" data-sim-p8-send>Enviar token</button>
      </div>
    `;

    els.simContent.querySelectorAll("[data-sim-p8-select-token]").forEach((row) => {
      row.addEventListener("click", (event) => {
        const tokenCode = row.dataset.simP8SelectToken;
        if (!tokenCode) {
          return;
        }
        simState.puzzle8Token = tokenCode;
        renderPuzzle8Simulator();
      });
    });

    els.simContent.querySelectorAll("[data-sim-p8-entry-symbol]").forEach((select) => {
      select.addEventListener("change", () => {
        const index = Number(select.dataset.simP8EntrySymbol);
        ensurePuzzle8Entries()[index].symbol = select.value;
        renderPuzzle8Simulator();
      });
    });

    els.simContent.querySelectorAll("[data-sim-p8-entry-color]").forEach((select) => {
      select.addEventListener("change", () => {
        const index = Number(select.dataset.simP8EntryColor);
        ensurePuzzle8Entries()[index].color = select.value;
        renderPuzzle8Simulator();
      });
    });

    els.simContent.querySelector("[data-sim-p8-refresh]").addEventListener("click", async () => {
      try {
        await syncPuzzle8State(false);
        renderPuzzle8Simulator();
      } catch (error) {
        setStatus(`Puzzle 8 · ${error.message || "error"}`);
      }
    });

    els.simContent.querySelector("[data-sim-p8-send]").addEventListener("click", async () => {
      try {
        const payloads = ensurePuzzle8Entries()
          .slice(0, requiredEntries)
          .map((entry) => `P8,${entry.symbol},${simState.puzzle8Token},${entry.color}`);
        await sendPayloads(payloads);
        appendLog({ local: true, payloads, simulated: "puzzle8", token: tokenByCode[simState.puzzle8Token]?.label });
        await syncPuzzle8State(true);
        renderPuzzle8Simulator();
      } catch (error) {
        setStatus(`Puzzle 8 · ${error.message || "error"}`);
      }
    });

  }

  function renderPuzzle12Simulator() {
    els.simContent.innerHTML = `
      <div class="sim-note">Resolver ronda envia els missatges necessaris per igualar el target de la ronda i GIF actuals.</div>
      <div class="sim-actions">
	        <button type="button" class="sim-button" data-sim-p12-refresh-state>Actualizar estado</button>
      </div>
      <div data-sim-p12-state>
        <div class="sim-note">Cargando current state...</div>
      </div>
    `;

    els.simContent.querySelector("[data-sim-p12-refresh-state]").addEventListener("click", async () => {
      try {
        await refreshPuzzle12SimulatorState();
        setStatus("Puzzle 12 · estado actualizado");
      } catch (error) {
        setStatus(`Puzzle 12 · ${error.message || "error"}`);
      }
    });

    refreshPuzzle12SimulatorState().catch(() => {
      const container = els.simContent.querySelector("[data-sim-p12-state]");
      if (container) {
        container.innerHTML = '<div class="sim-note">No se ha podido cargar el current state.</div>';
      }
    });
  }

  function getPuzzle12Totals(boxStates) {
    const totals = [0, 0, 0, 0, 0, 0];
    if (!boxStates || typeof boxStates !== "object") {
      return totals;
    }

    Object.values(boxStates).forEach((buttons) => {
      if (!Array.isArray(buttons)) {
        return;
      }
      for (let index = 0; index < 6; index += 1) {
        totals[index] += Number(buttons[index] || 0);
      }
    });

    return totals;
  }

  function renderPuzzle12StateBlock(data) {
    if (String(data?.puzzle_id) !== "12") {
      return '<div class="sim-note">El current state activo no corresponde al puzzle 12.</div>';
    }

    const target = Array.isArray(data.target) ? data.target : [0, 0, 0, 0, 0, 0];
    const totals = getPuzzle12Totals(data.box_states);
    const activeBoxes = data.box_states && typeof data.box_states === "object"
      ? Object.keys(data.box_states).length
      : 0;
    const rows = puzzle12ButtonLabels.map((label, index) => `
      <div class="state-metric">
        <span>${label}</span>
        <strong>${totals[index]} / ${Number(target[index] || 0)}</strong>
      </div>
    `).join("");

    return `
      <div class="state-summary">
        <div class="state-grid">
          <section class="state-card">
            <h3>Current state</h3>
            <div class="state-metrics">
              ${stateMetric("Ronda", data.round)}
              ${stateMetric("GIF", data.num_giff)}
              ${stateMetric("Duracion", data.duration)}
              ${stateMetric("Cajas activas", activeBoxes)}
            </div>
          </section>
          <section class="state-card">
            <h3>Botones actuales / objetivo</h3>
            <div class="state-metrics">
              ${rows}
            </div>
          </section>
        </div>
      </div>
    `;
  }

  function updatePuzzle12SimulatorState(data) {
    const container = els.simContent.querySelector("[data-sim-p12-state]");
    if (!container) {
      return;
    }
    container.innerHTML = renderPuzzle12StateBlock(data);
  }

  async function refreshPuzzle12SimulatorState() {
    const response = await fetch("/current_state", { cache: "no-store" });
    const data = await response.json();
    updatePuzzle12SimulatorState(data);
    return data;
  }

  function renderFinalCompatSimulator() {
    const boxes = Array.from({ length: 10 }, (_, index) => {
      return `<button type="button" class="sim-box" data-sim-pf-box="${index}">Terminal ${index}</button>`;
    }).join("");

    els.simContent.innerHTML = `
      <div class="sim-note">La ruta final sigue existiendo por compatibilidad, pero ahora arranca el puzzle 6. Pulsa un terminal para simular un fallo de energia.</div>
      <div class="sim-actions" style="margin-bottom: 1rem;">
	        <button type="button" class="sim-button" data-sim-open-final>Abrir pantalla final</button>
      </div>
      <div class="sim-grid box-grid">${boxes}</div>
    `;

    const openButton = els.simContent.querySelector("[data-sim-open-final]");
    if (openButton) {
      openButton.addEventListener("click", () => {
        window.open("/puzzle/final", "_blank", "noopener");
      });
    }

    els.simContent.querySelectorAll("[data-sim-pf-box]").forEach((button) => {
      button.addEventListener("click", async () => {
        const box = button.dataset.simPfBox;
        const payload = `P6,${box}`;
        await sendPayloads([payload]);
        appendLog({ local: true, payload, simulated: "finalCompat" });
      });
    });
  }

  function collectValues() {
    const values = {};
    getSelectedConfig().fields.forEach((field) => {
      values[field.id] = document.getElementById(`field-${field.id}`).value;
    });
    return values;
  }

  function buildPayload() {
    const config = getSelectedConfig();
    return config.build(collectValues());
  }

  function getMessagePresets() {
    const puzzleId = els.puzzleSelect.value;
    const startPayload = puzzleId === "-1" ? "P6Start" : `P${puzzleId}Start`;

    const presetsByPuzzle = {
      "1": [
        { label: "Start", payload: startPayload },
        { label: "End", payload: "P1End" }
      ],
      "11": [
        { label: "Start", payload: startPayload },
        { label: "End", payload: "P11End" }
      ],
      "2": [
        { label: "Start", payload: startPayload },
        { label: "End", payload: "P2End" }
      ],
      "3": [
        { label: "Start", payload: startPayload },
        { label: "End", payload: "P3End" }
      ],
      "4": [
        { label: "Start", payload: startPayload },
        { label: "End", payload: "P4End" }
      ],
      "5": [
        { label: "Start", payload: startPayload },
        { label: "Round 1", payload: "P5_Round1" },
        { label: "Round 2", payload: "P5_Round2" },
        { label: "End", payload: "P5_End" }
      ],
      "6": [
        { label: "Start", payload: "P6Start" },
        { label: "End", payload: "P6End" }
      ],
      "7": [
        { label: "Start", payload: startPayload },
        { label: "End", payload: "P7End" }
      ],
      "8": [
        { label: "Start", payload: startPayload },
        { label: "End", payload: "P8End" }
      ],
      "9": [
        { label: "Start", payload: startPayload },
        { label: "End", payload: "P9End" }
      ],
      "-1": [
        { label: "Start", payload: "P6Start" },
        { label: "End", payload: "P6End" }
      ]
    };

    return presetsByPuzzle[puzzleId] || [{ label: "Start", payload: startPayload }];
  }

  function renderMessageOptions() {
    if (els.topicSelect.value !== "FROM_FLASK") {
      return;
    }

    const presets = getMessagePresets();
    els.messageSelect.innerHTML = "";

    presets.forEach((preset, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = preset.label;
      els.messageSelect.appendChild(option);
    });

    if (presets.length) {
      els.messageSelect.value = "0";
      els.messageEditor.value = presets[0].payload;
    } else {
      els.messageEditor.value = "";
    }
  }

  function loadSelectedMessage() {
    const presets = getMessagePresets();
    const selected = presets[Number(els.messageSelect.value)] || presets[0];
    els.messageEditor.value = selected ? selected.payload : "";
  }

  async function sendPayloads(payloads, topicOverride = "") {
    const selectedTopic = (topicOverride || els.topicSelect.value || "TO_FLASK").trim();
    const response = await fetch("/test/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: selectedTopic,
        payloads
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "send_failed");
    }
	    setStatus(`Acción enviada · ${data.count} mensaje(s)`);
    return data;
  }

  async function runToFlask(callback) {
    const previousTopic = els.topicSelect.value;
    try {
      els.topicSelect.value = "TO_FLASK";
      updateTopicHelp();
      updateSendModeUI();
      return await callback();
    } finally {
      if (previousTopic !== "TO_FLASK") {
        els.topicSelect.value = previousTopic;
        syncEditorForTopic();
      }
    }
  }

	  async function sendGeneratedPayload() {
	    const payload = els.messageEditor.value.trim();
	    if (!payload) {
	      return;
	    }
	    if (!window.confirm("Enviar payload manual desde Técnico?")) {
	      return;
	    }
	    await sendPayloads([payload]);
	    appendLog({ local: true, payload });
	    if (els.puzzleSelect.value === "12") {
	      await refreshCurrentState();
	    }
	  }

	  async function startPuzzle(restart = false) {
	    const config = getSelectedConfig();
	    if (!config) {
	      throw new Error("puzzle_not_selected");
	    }
	    if (restart && !window.confirm(`Reiniciar ${config.label}?`)) {
	      return;
	    }
	    const endpoint = restart ? config.restartRoute : config.startRoute;
	    const response = await fetch(endpoint, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "start_failed");
    }
	    setStatus(restart
	      ? `${config.label} reiniciado`
	      : `${config.label} arrancado`);
    puzzleRuntime.gameStatus = "En juego";
    if (!puzzleRuntime.startedAt) {
      startGameTimer();
    }
    setPuzzleStatus(els.puzzleSelect.value, "playing");
    addSimpleEvent(restart ? "Puzzle reiniciado" : "Partida/puzzle arrancado", config.label);
    saveGameState();
	    refreshCurrentState();
	  }

  async function completeCurrentPuzzle() {
    const config = getSelectedConfig();
    if (!config || !window.confirm(`Marcar ${config.label} como completado?`)) return;
    await forceEndCurrentPuzzle();
    setPuzzleStatus(els.puzzleSelect.value, "completed");
    addSimpleEvent("Puzzle marcado como completado", config.label);
    refreshCurrentState();
  }

  async function skipCurrentPuzzle() {
    const config = getSelectedConfig();
    if (!config || !window.confirm(`Saltar ${config.label}?`)) return;
    await forceEndCurrentPuzzle();
    setPuzzleStatus(els.puzzleSelect.value, "skipped");
    addSimpleEvent("Puzzle saltado", config.label);
    refreshCurrentState();
  }

  function updateSolveButtonState() {
    if (!els.solveBtn || !els.unsolveBtn) {
      return;
    }
    const isPuzzle6 = els.puzzleSelect.value === "6";
    els.solveBtn.hidden = !isPuzzle6;
    els.solveBtn.disabled = !isPuzzle6;
    els.unsolveBtn.hidden = !isPuzzle6;
    els.unsolveBtn.disabled = !isPuzzle6;
  }

	  async function solvePuzzle6(options = {}) {
	    if (els.puzzleSelect.value !== "6" && els.puzzleSelect.value !== "-1") {
	      setStatus("Activar solvePuzzle solo aplica a Puzzle 6");
	      return;
	    }
	    if (!options.skipConfirm && !window.confirm("Activar solvePuzzle P6?")) {
	      return;
	    }

    const response = await fetch("/test/puzzle6/solve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ solvePuzzle: true })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "solve_failed");
    }

    setStatus("Puzzle 6 · solvePuzzle activado");
    appendLog({ local: true, action: "puzzle6_solve_enabled", data });
  }

	  async function unsolvePuzzle6() {
	    if (els.puzzleSelect.value !== "6") {
	      setStatus("Desactivar solvePuzzle solo aplica a Puzzle 6");
	      return;
	    }
	    if (!window.confirm("Desactivar solvePuzzle P6?")) {
	      return;
	    }

    const response = await fetch("/test/puzzle6/solve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ solvePuzzle: false })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "unsolve_failed");
    }

    setStatus("Puzzle 6 · solvePuzzle desactivado");
    appendLog({ local: true, action: "puzzle6_solve_disabled", data });
  }

  function openPuzzleView() {
    const config = getSelectedConfig();
    window.open(config.route, "_blank", "noopener");
  }

	  function appendLog(entry) {
    const eventLabel = entry?.error
      ? "Aviso técnico"
      : (entry?.payload ? `Enviado ${entry.payload}` : (entry?.resolver_action ? "Acción de puzzle ejecutada" : "Evento técnico"));
    addSimpleEvent(eventLabel);
	    if (!els.eventLog) {
	      return;
	    }
	    if (els.eventLog.textContent.trim() === "Sin eventos locales.") {
	      els.eventLog.innerHTML = "";
	    }

	    const row = document.createElement("div");
    row.className = "log-entry";

    const stamp = document.createElement("span");
    stamp.className = "log-time";
    stamp.textContent = new Date().toLocaleTimeString();
    row.appendChild(stamp);

    const payload = document.createElement("div");
    payload.className = "log-payload";
    payload.textContent = JSON.stringify(entry, null, 2);
    row.appendChild(payload);

    els.eventLog.prepend(row);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#39;");
  }

  function formatStateValue(value) {
    if (value === true) return "Si";
    if (value === false) return "No";
    if (value === null || value === undefined || value === "") return "--";
    if (Array.isArray(value)) return value.length ? value.join(", ") : "--";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  function stateMetric(label, value) {
    return `
      <div class="state-metric">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(formatStateValue(value))}</strong>
      </div>
    `;
  }

  function stateList(title, items) {
    const content = items.length
      ? items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
      : "<li>--</li>";

    return `
      <section class="state-card">
        <h3>${escapeHtml(title)}</h3>
        <ul class="state-list">${content}</ul>
      </section>
    `;
  }

	  function renderFallbackState(data) {
	    const entries = Object.entries(data || {}).filter(([key]) => key !== "puzzle_id");
	    return `
	      <div class="state-summary">
        <div class="state-grid">
          <section class="state-card">
            <h3>Estado</h3>
            <div class="state-metrics">
              ${entries.map(([key, value]) => stateMetric(key, value)).join("")}
            </div>
          </section>
        </div>
	      </div>
	    `;
	  }

	  function getProgressInfo(data) {
	    if (!data || typeof data !== "object") {
	      return { status: "Sin datos", progress: "--", action: "Actualizar estado" };
	    }
	    const puzzleId = String(data.puzzle_id ?? els.puzzleSelect.value);
	    if (!data.puzzle_id) {
	      return { status: "Sin puzzle activo", progress: "--", action: "Seleccionar y arrancar puzzle" };
	    }
	    if (data.puzzle_solved) {
	      return { status: "Resuelto", progress: "Completado", action: "Abrir intro o siguiente puzzle" };
	    }
	    if (puzzleId === "1") {
	      const operations = Array.isArray(data.operations) ? data.operations : [];
	      const solved = operations.filter((item) => Array.isArray(item) && item[2] === "Y").length;
	      return { status: "En juego", progress: `${solved}/${operations.length || data.round_size || "?"}`, action: "Resolver pendientes si el grupo se atasca" };
	    }
	    if (puzzleId === "2") {
	      const players = Array.isArray(data.players) ? data.players : [];
	      const complete = players.filter((player) => Number(player.progress) >= Number(player.total || 5)).length;
	      return { status: data.alarm_mode ? "Alarma activa" : "En juego", progress: `${complete}/${players.length || 10} terminales`, action: "Revisar terminal objetivo en Ayudas" };
	    }
	    if (puzzleId === "3") {
	      const answered = Array.isArray(data.answered_players) ? data.answered_players.length : 0;
	      return { status: "Pregunta activa", progress: `${data.streak || 0}/${data.target || 10} aciertos · ${answered}/${data.total_players || 10} respuestas`, action: "Ver correcta o resolver pregunta" };
	    }
	    if (puzzleId === "4") {
	      const label = data.playing_sample ? "Reproduciendo muestra" : (data.storing ? "Grabando" : "En juego");
	      return { status: label, progress: `${data.streak || 0}/${data.total_required || 2} secuencias`, action: "Resolver ronda musical si hace falta" };
	    }
	    if (puzzleId === "5") {
	      return { status: data.waiting ? "Esperando" : (data.active_round ? "Ronda activa" : "Parado"), progress: `Ronda ${data.round || 1} · ${data.total ?? 0}/${data.limit ?? "--"}`, action: "Actualizar o resolver ronda" };
	    }
	    if (puzzleId === "6") {
	      return { status: data.restart_pending ? "Reinicio pendiente" : (data.active ? "Final activo" : "Preparado"), progress: `${data.remaining ?? data.duration ?? "--"} s`, action: "Vigilar terminales o finalizar" };
	    }
	    if (puzzleId === "7") {
	      const solved = Array.isArray(data.solved_boxes) ? data.solved_boxes.length : 0;
	      return { status: "En juego", progress: `${solved}/10 terminales`, action: "Marcar terminales desde Ayudas" };
	    }
	    if (puzzleId === "8") {
	      return { status: data.phase || "En juego", progress: `Ronda ${data.round || 0}/${data.round_total || 3}`, action: "Resolver token o todo si se atascan" };
	    }
	    if (puzzleId === "9") {
	      const boxes = data.boxes && typeof data.boxes === "object" ? Object.keys(data.boxes).length : 0;
	      return { status: "En juego", progress: `${boxes}/10 posiciones`, action: "Revisar colocación de tokens" };
	    }
	    if (puzzleId === "10") {
	      const solved = Array.isArray(data.solved_boxes) ? data.solved_boxes.length : 0;
	      return { status: "En juego", progress: `${solved}/10 cajas`, action: "Marcar caja como resuelta" };
	    }
	    if (puzzleId === "11") {
	      const step = Number(data.current_step || 0);
	      return { status: data.puzzle_solved ? "Tutorial completado" : "Tutorial activo", progress: `${Math.min(step, 10)}/10 pasos`, action: "Resolver paso actual" };
	    }
	    if (puzzleId === "12") {
	      return { status: "Ronda de botones", progress: `Ronda ${data.round || 1}/${data.total_rounds || 3}`, action: "Resolver ronda si el grupo se bloquea" };
	    }
	    return { status: "En juego", progress: "--", action: "Revisar Ayudas / Resolver" };
	  }

	  function getSelectedPuzzleLabel() {
	    const id = els.puzzleSelect?.value || "";
	    if (id === "-1") return "Final";
	    const label = getPuzzleDisplayName(id);
	    return id ? `${label} · Puzzle ${id}` : "Sin seleccionar";
	  }

	  function renderSelectedPuzzleSummary() {
	    const label = getSelectedPuzzleLabel();
	    if (els.gmCurrentPuzzle) {
	      els.gmCurrentPuzzle.textContent = label;
	    }
    if (els.controlCurrentPuzzle) {
      els.controlCurrentPuzzle.textContent = label;
    }
    renderPuzzleHelp();
	    if (els.gmSideSummary) {
	      els.gmSideSummary.innerHTML = `
	        <div class="gm-side-kpi">
	          <span>Puzzle seleccionado</span>
	          <strong>${escapeHtml(label)}</strong>
	        </div>
	      `;
	    }
	    if (els.gmQuickNext) {
	      els.gmQuickNext.textContent = label;
	    }
	  }

	  function renderGMState(data) {
	    const label = data?.puzzle_id ? `${getPuzzleDisplayName(String(data.puzzle_id))} · Puzzle ${data.puzzle_id}` : getSelectedPuzzleLabel();
	    const info = getProgressInfo(data);
	    if (els.gmCurrentPuzzle) els.gmCurrentPuzzle.textContent = label;
	    if (els.gmPuzzleStatus) els.gmPuzzleStatus.textContent = info.status;
	    if (els.gmProgress) els.gmProgress.textContent = info.progress;
    if (els.controlCurrentPuzzle) els.controlCurrentPuzzle.textContent = label;
    if (els.controlProgress) els.controlProgress.textContent = info.progress;
	    if (els.gmNextAction) els.gmNextAction.textContent = info.action;
	    if (els.gmQuickNext) els.gmQuickNext.textContent = label;
	    if (els.gmDashboardSummary) {
	      els.gmDashboardSummary.innerHTML = `
	        <div class="gm-summary-card">
	          <span>Puzzle actual</span>
	          <strong>${escapeHtml(label)}</strong>
	        </div>
	        <div class="gm-summary-card">
	          <span>Estado actual</span>
	          <strong>${escapeHtml(info.status)}</strong>
	        </div>
	        <div class="gm-summary-card">
	          <span>Progreso</span>
	          <strong>${escapeHtml(info.progress)}</strong>
	        </div>
	        <div class="gm-summary-card">
	          <span>Siguiente acción recomendada</span>
	          <strong>${escapeHtml(info.action)}</strong>
	        </div>
	      `;
	    }
	    if (els.gmSideSummary) {
	      els.gmSideSummary.innerHTML = `
	        <div class="gm-side-kpi">
	          <span>Puzzle actual</span>
	          <strong>${escapeHtml(label)}</strong>
	        </div>
	        <div class="gm-side-kpi">
	          <span>Progreso</span>
	          <strong>${escapeHtml(info.progress)}</strong>
	        </div>
	      `;
	    }
	    if (els.gmAlerts) {
	      els.gmAlerts.textContent = data?.restart_pending ? "Hay un reinicio pendiente." : "Sin avisos.";
	    }
	    renderDeviceState(data);
	  }

  function renderPuzzleHelp() {
    if (!els.puzzleHelp) return;
    const id = String(els.puzzleSelect?.value || "");
    const name = id === "-1" ? "Final" : getPuzzleDisplayName(id);
    const reference = getSelectedConfig()?.reference || "Sin solución manual documentada.";
    els.puzzleHelp.innerHTML = `
      <div class="gm-help-grid">
        <section><h3>Objetivo</h3><p>${escapeHtml(name)}: completar la mecánica activa sin que el grupo vea herramientas técnicas.</p></section>
        <section><h3>Qué hacen los jugadores</h3><p>Interactúan con terminales, botones, tokens o pantalla según el puzzle seleccionado.</p></section>
        <section><h3>Pista suave</h3><p>Invita al grupo a revisar orden, colores, números o terminales ya usados antes de intervenir.</p></section>
        <section><h3>Pista fuerte</h3><p>Dirige la atención al siguiente paso correcto sin revelar toda la solución.</p></section>
        <section><h3>Solución manual</h3><p>${escapeHtml(reference.split("\n").slice(0, 4).join(" · "))}</p></section>
        <section><h3>Si falla</h3><p>Actualiza estado, prueba MQTT/ESP32 y usa “Dar por buena la fase” o “Saltar resto del puzzle” si la partida debe continuar.</p></section>
      </div>
    `;
  }

	  function renderDeviceState(data = {}) {
	    if (!els.gmTerminalGrid) {
	      return;
	    }
	    let activeTerminals = new Set();
	    let lastTerminal = data.last_reset_box ?? data.last_box ?? data.box ?? null;
	    if (Array.isArray(data.solved_boxes)) {
	      activeTerminals = new Set(data.solved_boxes.map((item) => Number(item)));
	    } else if (data.boxes && typeof data.boxes === "object") {
	      activeTerminals = new Set(Object.keys(data.boxes).map((item) => Number(item)));
	    } else if (data.box_states && typeof data.box_states === "object") {
	      activeTerminals = new Set(Object.keys(data.box_states).map((item) => Number(item)));
	    } else if (Array.isArray(data.times)) {
	      activeTerminals = new Set(data.times.map((item) => Number(item.player)));
	    }
	    els.gmTerminalGrid.innerHTML = Array.from({ length: 10 }, (_, index) => `
	      <div class="gm-terminal${activeTerminals.has(index) ? " is-active" : ""}${Number(lastTerminal) === index ? " is-last" : ""}">
	        <strong>${index}</strong>
	        <span>${Number(lastTerminal) === index ? "Último" : (activeTerminals.has(index) ? "Con datos" : "Sin datos")}</span>
	      </div>
	    `).join("");
	    if (els.gmDeviceSummary) {
	      els.gmDeviceSummary.innerHTML = `
	        <div class="gm-action-note">
	          ${lastTerminal !== null && lastTerminal !== undefined ? `Último terminal detectado: ${escapeHtml(lastTerminal)}` : "No hay último terminal disponible."}
	          Los datos reales de hardware completos aún no están expuestos en este panel.
	        </div>
	      `;
	    }
	  }

  async function resourceExists(url) {
    try {
      let response = await fetch(url, { method: "HEAD", cache: "no-store" });
      if (response.ok) {
        return true;
      }
      response = await fetch(url, { cache: "no-store" });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  function collectSceneAssets(config) {
    const urls = new Set();

    if (config?.audio?.src) {
      urls.add(config.audio.src);
    }

    const segments = Array.isArray(config?.segments) ? config.segments : [];
    segments.forEach((segment) => {
      if (segment?.src) {
        urls.add(segment.src);
      }
      if (segment?.video) {
        urls.add(segment.video);
      }

      const phases = Array.isArray(segment?.phases) ? segment.phases : [];
      [segment, ...phases].forEach((entry) => {
        ["top", "left", "right"].forEach((zoneKey) => {
          const assets = Array.isArray(entry?.[zoneKey]?.assets) ? entry[zoneKey].assets : [];
          assets.forEach((asset) => {
            if (asset?.src) {
              urls.add(asset.src);
            }
          });
        });
      });
    });

    return Array.from(urls);
  }

  function renderSceneHealth(results) {
    if (!els.sceneHealth) {
      return;
    }

    const okCount = results.filter((item) => item.status === "ok").length;
    const warnCount = results.filter((item) => item.status === "warn").length;
    const failCount = results.filter((item) => item.status === "fail").length;

    els.sceneHealth.innerHTML = `
      <div class="state-summary">
        <div class="state-grid">
          <section class="state-card">
            <h3>Resumen</h3>
            <div class="state-metrics">
              ${stateMetric("OK", okCount)}
              ${stateMetric("Warning", warnCount)}
              ${stateMetric("Fail", failCount)}
            </div>
          </section>
          ${results.map((item) => `
            <section class="state-card">
              <h3>${escapeHtml(item.label)}</h3>
              <div class="state-metrics">
                ${stateMetric("Estado", item.status.toUpperCase())}
                ${stateMetric("Segmentos", item.segments)}
                ${stateMetric("Recursos", `${item.okAssets}/${item.totalAssets}`)}
                ${stateMetric("Audio", item.audioState)}
                ${stateMetric("Duracion", item.durationState)}
              </div>
              <ul class="state-list">
                ${(item.notes.length ? item.notes : ["Sin incidencias"]).map((note) => `<li>${escapeHtml(note)}</li>`).join("")}
              </ul>
            </section>
          `).join("")}
        </div>
      </div>
    `;
  }

  function hasSessionStorage() {
    try {
      const key = "__test_storage_probe__";
      window.sessionStorage.setItem(key, "1");
      window.sessionStorage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  function renderSystemSummary() {
    if (!els.systemSummary) {
      return;
    }

    const audioEl = document.createElement("audio");
    const canPlayWav = typeof audioEl.canPlayType === "function"
      ? audioEl.canPlayType("audio/wav")
      : "";
    const autoplayState = navigator.userActivation?.hasBeenActive ? "Interaccion detectada" : "Pendiente";
    const fullscreenState = document.fullscreenEnabled ? "Disponible" : "No";
    const storageState = hasSessionStorage() ? "OK" : "Fail";
    const onlineState = navigator.onLine ? "Online" : "Offline";
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "Reduce" : "Normal";

    els.systemSummary.innerHTML = `
      <div class="state-summary">
        <div class="state-grid">
          <section class="state-card">
            <h3>Navegador</h3>
            <div class="state-metrics">
              ${stateMetric("Online", onlineState)}
              ${stateMetric("Autoplay", autoplayState)}
	              ${stateMetric("Pantalla completa", fullscreenState)}
              ${stateMetric("WAV", canPlayWav || "No")}
              ${stateMetric("Session", storageState)}
              ${stateMetric("Pantalla", `${window.innerWidth}x${window.innerHeight}`)}
              ${stateMetric("Motion", reducedMotion)}
            </div>
          </section>
          <section class="state-card">
            <h3>Entorno</h3>
            <ul class="state-list">
              <li>${escapeHtml(navigator.userAgent)}</li>
            </ul>
          </section>
        </div>
      </div>
    `;
  }

  function readPlayerLogs() {
    try {
      return JSON.parse(window.sessionStorage.getItem("scenePlayerLogs") || "[]");
    } catch (error) {
      return [];
    }
  }

  function renderPlayerLogs() {
    if (!els.systemLogs) {
      return;
    }

    const logs = readPlayerLogs().slice(-20).reverse();
    if (!logs.length) {
      els.systemLogs.innerHTML = `<div class="state-empty">Sin logs de player en esta sesion.</div>`;
      return;
    }

    els.systemLogs.innerHTML = logs.map((entry) => `
      <div class="system-log-entry">
        <strong>${escapeHtml(entry.type || "event")}</strong>
        <span>${escapeHtml(entry.scene || "--")} · seg ${escapeHtml(String((entry.segmentIndex ?? 0) + 1))}</span>
        <span>${escapeHtml(entry.at || "--")}</span>
        <span>${escapeHtml(JSON.stringify(entry.detail || {}))}</span>
      </div>
    `).join("");
  }

  function statusText(status) {
    return ({ ok: "OK", warn: "Aviso", error: "Error", unchecked: "No comprobado" })[status] || status;
  }

  function setPreflightStatus(id, status) {
    preflightState[id] = status;
    renderPreflightChecklist();
  }

  function renderPreflightChecklist() {
    if (!els.preflightChecklist) return;
    els.preflightChecklist.innerHTML = preflightItems.map((item) => `
      <div class="gm-check-item gm-check-${escapeHtml(preflightState[item.id] || "unchecked")}">
        <span>${escapeHtml(item.label)}</span>
        <strong>${escapeHtml(statusText(preflightState[item.id] || "unchecked"))}</strong>
      </div>
    `).join("");
  }

  async function fetchSystemStatus() {
    const response = await fetch("/test/system_status", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "system_status_failed");
    }
    return data;
  }

  async function refreshPreflightStatus() {
    try {
      const data = await fetchSystemStatus();
      setPreflightStatus("flask", data.flask === "ok" ? "ok" : "error");
      setPreflightStatus("mqtt", data.mqtt_connected ? "ok" : "warn");
      setPreflightStatus("fullscreen", document.fullscreenEnabled ? "ok" : "warn");
      setPreflightStatus("terminals", data.current_state_available ? "ok" : "unchecked");
      setPreflightStatus("esp32", data.mqtt_connected ? "warn" : "unchecked");
      setPreflightStatus("buttons", "unchecked");
      setPreflightStatus("nfc", "unchecked");
      setPreflightStatus("general", data.flask === "ok" ? "ok" : "warn");
      renderSystemSummary();
      addSimpleEvent("Sistema comprobado");
      setStatus("Sistema comprobado");
      return data;
    } catch (error) {
      setPreflightStatus("flask", "error");
      setPreflightStatus("general", "error");
      addSimpleEvent("Error comprobando sistema", String(error));
      throw error;
    }
  }

  async function initializeGameSystem() {
    const response = await fetch("/test/initialize_system", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "initialize_failed");
    }
    await refreshPreflightStatus();
    addSimpleEvent("Sistema inicializado");
    setStatus("Sistema inicializado");
  }

  function openPlayerScreen() {
    const rawLang = activeSession?.gameLanguage || defaultSubtitleLang;
    const lang = rawLang === "eng" || rawLang === "en" ? "eng" : "es";
    const params = new URLSearchParams({ scene: "scene_intro_game", lang });
    window.open(`/player/?${params.toString()}`, "_blank", "noopener");
    setPreflightStatus("player", "ok");
    addSimpleEvent("Pantalla jugador abierta");
  }

  function testScreen() {
    openPlayerScreen();
    setStatus("Pantalla abierta para comprobar");
  }

  async function testMqtt() {
    await sendPayloads(["GM_MQTT_TEST"], "FROM_FLASK");
    setPreflightStatus("mqtt", "ok");
    addSimpleEvent("MQTT probado");
  }

  async function testEsp32() {
    await sendPayloads(["GM_ESP32_TEST"], "FROM_FLASK");
    setPreflightStatus("esp32", "warn");
    addSimpleEvent("Comprobación ESP32 enviada", "Esperando respuesta real de hardware");
  }

  function getAllPuzzleIdsForProgress() {
    const ids = getVisiblePuzzleIds();
    if (shouldIncludeLegacyFinalShortcut(ids)) ids.push("-1");
    return ids;
  }

  function saveGameState() {
    window.localStorage.setItem(gameStateKey, JSON.stringify({
      statuses: puzzleRuntime.statuses,
      gameStatus: puzzleRuntime.gameStatus,
      startedAt: puzzleRuntime.startedAt,
      elapsedBeforePause: puzzleRuntime.elapsedBeforePause
    }));
  }

  function loadGameState() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(gameStateKey) || "{}");
      Object.assign(puzzleRuntime.statuses, saved.statuses || {});
      puzzleRuntime.gameStatus = saved.gameStatus || "Preparado";
      puzzleRuntime.startedAt = saved.startedAt || null;
      puzzleRuntime.elapsedBeforePause = Number(saved.elapsedBeforePause || 0);
    } catch (error) {
      // Keep defaults.
    }
  }

  function statusLabelForPuzzle(status) {
    return ({ pending: "Pendiente", playing: "En juego", completed: "Completado", skipped: "Saltado", error: "Error" })[status] || "Pendiente";
  }

  function setPuzzleStatus(puzzleId, status) {
    if (!puzzleId) return;
    puzzleRuntime.statuses[String(puzzleId)] = status;
    saveGameState();
    renderPuzzleProgress();
  }

  function renderPuzzleProgress() {
    if (!els.puzzleProgressList) return;
    els.puzzleProgressList.innerHTML = getAllPuzzleIdsForProgress().map((id, index) => {
      const status = puzzleRuntime.statuses[String(id)] || "pending";
      const label = id === "-1" ? "Final" : getPuzzleDisplayName(id);
      return `
        <div class="gm-puzzle-progress-item gm-puzzle-${escapeHtml(status)}">
          <span>${index + 1}. ${escapeHtml(label)}</span>
          <strong>${escapeHtml(statusLabelForPuzzle(status))}</strong>
        </div>
      `;
    }).join("");
  }

  function currentElapsedMs() {
    if (!puzzleRuntime.startedAt) return puzzleRuntime.elapsedBeforePause;
    return puzzleRuntime.elapsedBeforePause + (Date.now() - Number(puzzleRuntime.startedAt));
  }

  function formatDuration(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = String(Math.floor(total / 3600)).padStart(2, "0");
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }

  function renderGameTimer() {
    if (els.gameTime) els.gameTime.textContent = formatDuration(currentElapsedMs());
    if (els.gameStatus) els.gameStatus.textContent = puzzleRuntime.gameStatus;
  }

  function startGameTimer() {
    if (!puzzleRuntime.startedAt) {
      puzzleRuntime.startedAt = Date.now();
    }
    window.clearInterval(puzzleRuntime.timerId);
    puzzleRuntime.timerId = window.setInterval(renderGameTimer, 1000);
    renderGameTimer();
  }

  function pauseGame() {
    if (!puzzleRuntime.startedAt) return;
    puzzleRuntime.elapsedBeforePause = currentElapsedMs();
    puzzleRuntime.startedAt = null;
    puzzleRuntime.gameStatus = "Pausado";
    window.clearInterval(puzzleRuntime.timerId);
    saveGameState();
    renderGameTimer();
    addSimpleEvent("Partida pausada");
  }

  function resumeGame() {
    puzzleRuntime.startedAt = Date.now();
    puzzleRuntime.gameStatus = "En juego";
    saveGameState();
    startGameTimer();
    addSimpleEvent("Partida reanudada");
  }

  function finishGame() {
    if (!window.confirm("Finalizar partida?")) return;
    puzzleRuntime.elapsedBeforePause = currentElapsedMs();
    puzzleRuntime.startedAt = null;
    puzzleRuntime.gameStatus = "Finalizada";
    window.clearInterval(puzzleRuntime.timerId);
    saveGameState();
    renderGameTimer();
    addSimpleEvent("Partida finalizada");
  }

  function renderIncidents() {
    if (!els.incidents) return;
    const incidents = [
      { title: "No se oye el audio", actions: ["Probar audio", "Abrir pantalla jugador", "Ver detalles técnicos"] },
      { title: "La pantalla no actualiza", actions: ["Refrescar pantalla", "Reenviar estado", "Abrir pantalla jugador"] },
      { title: "Un botón no responde", actions: ["Probar ESP32", "Reenviar estado", "Ver terminales"] },
      { title: "Un ESP32 no conecta", actions: ["Reintentar conexión", "Probar MQTT", "Ver detalles técnicos"] },
      { title: "Un jugador/token no detecta", actions: ["Actualizar estado", "Revisar NFC / tokens", "Ver terminales"] },
      { title: "El puzzle se ha quedado bloqueado", actions: ["Reiniciar puzzle", "Dar por completado", "Saltar puzzle"] }
    ];
    els.incidents.innerHTML = incidents.map((incident) => `
      <details class="gm-incident">
        <summary>${escapeHtml(incident.title)}</summary>
        <div>${incident.actions.map((action) => `<button type="button" data-incident-action="${escapeHtml(action)}">${escapeHtml(action)}</button>`).join("")}</div>
      </details>
    `).join("");
    els.incidents.querySelectorAll("[data-incident-action]").forEach((button) => {
      button.addEventListener("click", () => handleIncidentAction(button.dataset.incidentAction));
    });
  }

  function handleIncidentAction(action) {
    if (action === "Probar audio") runAudioTest().catch((error) => appendLog({ error: String(error) }));
    else if (action === "Abrir pantalla jugador" || action === "Refrescar pantalla") openPlayerScreen();
    else if (action === "Probar MQTT" || action === "Reintentar conexión") testMqtt().catch((error) => appendLog({ error: String(error) }));
    else if (action === "Probar ESP32") testEsp32().catch((error) => appendLog({ error: String(error) }));
    else if (action === "Actualizar estado" || action === "Reenviar estado") refreshCurrentState();
    else if (action === "Reiniciar puzzle") startPuzzle(true).catch((error) => appendLog({ error: String(error) }));
    else if (action === "Dar por completado") completeCurrentPuzzle().catch((error) => appendLog({ error: String(error) }));
    else if (action === "Saltar puzzle") skipCurrentPuzzle().catch((error) => appendLog({ error: String(error) }));
    else switchTab("tecnico");
    addSimpleEvent(`Incidencia: ${action}`);
  }

  function clearPlayerLogs() {
    try {
      window.sessionStorage.removeItem("scenePlayerLogs");
    } catch (error) {
      // Ignore storage issues.
    }
    renderPlayerLogs();
  }

  async function runAudioTest() {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
	      setStatus("Prueba de audio no disponible");
      return;
    }

    const ctx = new AudioContextCtor();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.28);
	    setStatus("Prueba de audio OK");
  }

  async function toggleFullscreen() {
    if (!document.fullscreenEnabled) {
	      setStatus("Pantalla completa no disponible");
      return;
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen();
	      setStatus("Pantalla completa cerrada");
      return;
    }

    await document.documentElement.requestFullscreen();
	    setStatus("Pantalla completa abierta");
  }

  async function checkSceneHealth() {
    if (!els.sceneHealth) {
      return;
    }

    els.sceneHealth.innerHTML = `<div class="state-empty">Comprobando escenas...</div>`;
    const results = [];

    for (const scene of sceneHealthConfigs) {
      const result = {
        id: scene.id,
        label: scene.label,
        status: "ok",
        segments: 0,
        totalAssets: 0,
        okAssets: 0,
        audioState: "OK",
        durationState: "OK",
        notes: []
      };

      try {
        const response = await fetch(`/scenes/${scene.id}/config.json`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("config_missing");
        }

        const config = await response.json();
        const segments = Array.isArray(config?.segments) ? config.segments : [];
        const assets = collectSceneAssets(config);
        result.segments = segments.length;
        result.totalAssets = assets.length;

        const assetChecks = await Promise.all(assets.map((url) => resourceExists(url)));
        result.okAssets = assetChecks.filter(Boolean).length;

        if (result.okAssets !== result.totalAssets) {
          result.status = "fail";
          result.notes.push("Faltan recursos o alguna ruta no responde.");
        }

        const audioDuration = Number(config?.audio?.duration || 0);
        const subtitleEnd = Array.isArray(config?.subtitles) && config.subtitles.length
          ? Math.max(...config.subtitles.map((item) => Number(item.end || 0)))
          : 0;
        const sceneDuration = segments.reduce((total, segment) => {
          if (segment?.duration != null) {
            return total + Number(segment.duration || 0);
          }
          if (segment?.type === "character") {
            return total + Math.max(0, Number(segment?.clip_end || 0) - Number(segment?.clip_start || 0));
          }
          return total;
        }, 0);

        if (!config?.audio?.src) {
          result.audioState = "NO";
          result.status = result.status === "fail" ? "fail" : "warn";
          result.notes.push("La escena no define audio maestro.");
        }

        if (sceneDuration <= 0 || segments.length === 0) {
          result.status = "fail";
          result.durationState = "FAIL";
          result.notes.push("No hay segmentos válidos.");
        } else if (subtitleEnd > 0 && sceneDuration + 0.2 < subtitleEnd) {
          result.status = result.status === "fail" ? "fail" : "warn";
          result.durationState = "WARN";
          result.notes.push("Los subtítulos acaban después de la escena.");
        } else if (audioDuration > 0 && Math.abs(sceneDuration - audioDuration) > 0.35) {
          result.status = result.status === "fail" ? "fail" : "warn";
          result.durationState = "WARN";
          result.notes.push("Duración de escena y audio no parecen alineadas.");
        }
      } catch (error) {
        result.status = "fail";
        result.audioState = "FAIL";
        result.durationState = "FAIL";
        result.notes.push(`Error cargando config: ${String(error.message || error)}`);
      }

      results.push(result);
    }

    renderSceneHealth(results);
    setStatus(`Escenas: ${results.filter((item) => item.status === "fail").length} fail`);
  }

  function applyPuzzle2State(data) {
    simState.puzzle2Alarm = !!data.alarm_mode;
    (data.players || []).forEach((player) => {
      simState.puzzle2Progress[player.player] = player.progress;
    });
  }

  function wait(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  async function syncPuzzle2State(silent = false, options = {}) {
    const { player = null, previousProgress = null, retries = 4, delayMs = 140 } = options;
    let data = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const response = await fetch("/current_state");
      data = await response.json();
      if (String(data.puzzle_id) !== "2") {
        throw new Error("no activo");
      }

      if (player === null || previousProgress === null) {
        break;
      }

      const snapshot = Array.isArray(data.players) ? data.players : [];
      const currentPlayer = snapshot.find((item) => Number(item.player) === Number(player));
      const currentProgress = Number(currentPlayer?.progress ?? previousProgress);
      if (currentProgress !== Number(previousProgress) || attempt === retries) {
        break;
      }

      await wait(delayMs);
    }

    applyPuzzle2State(data);
    if (!silent) {
      setStatus("Puzzle 2 sincronizado");
    }
    return data;
  }

  function renderStateSummary(data) {
    if (!data || typeof data !== "object") {
      return `<div class="state-empty">Sin datos</div>`;
    }

    const puzzleId = String(data.puzzle_id ?? els.puzzleSelect.value);

    if (puzzleId === "1") {
      const operations = Array.isArray(data.operations) ? data.operations : [];
      const pending = operations.filter((item) => Array.isArray(item) && item[2] === "N").map((item) => String(item[0]));
      const solved = operations.filter((item) => Array.isArray(item) && item[2] === "Y").map((item) => String(item[0]));
      return `
        <div class="state-summary">
          <div class="state-grid">
            <section class="state-card">
              <h3>Ronda</h3>
              <div class="state-metrics">
                ${stateMetric("Fase", data.round)}
                ${stateMetric("Objetivos", data.round_size)}
                ${stateMetric("Resueltos", solved.length)}
              </div>
            </section>
            ${stateList("Pendientes", pending)}
            ${stateList("Resueltos", solved)}
          </div>
        </div>
      `;
    }

    if (puzzleId === "2") {
      const players = Array.isArray(data.players) ? data.players : [];
      const completed = players.filter((player) => Number(player.progress) >= Number(player.total || 5)).length;
      return `
        <div class="state-summary">
          <div class="state-grid">
            <section class="state-card">
              <h3>Laberinto</h3>
              <div class="state-metrics">
                ${stateMetric("Modo alarma", data.alarm_mode)}
                ${stateMetric("Terminales completos", `${completed}/${players.length || 10}`)}
              </div>
            </section>
            ${stateList("Progreso", players.map((player) => `T${player.player}: ${player.progress}/${player.total}`))}
          </div>
        </div>
      `;
    }

    if (puzzleId === "3") {
      const question = data.question?.q || "Sin pregunta activa";
      const answers = Array.isArray(data.question?.answers) ? data.question.answers : [];
      const answered = Array.isArray(data.answered_players) ? data.answered_players.length : 0;
      return `
        <div class="state-summary">
          <div class="state-grid">
            <section class="state-card">
              <h3>Pregunta actual</h3>
              <p class="state-copy">${escapeHtml(question)}</p>
              <div class="state-metrics">
                ${stateMetric("Aciertos", `${data.streak || 0}/${data.target || 10}`)}
                ${stateMetric("Respondidos", `${answered}/${data.total_players || 10}`)}
              </div>
            </section>
            ${stateList("Opciones", answers.map((answer, index) => `${index}. ${answer}`))}
          </div>
        </div>
      `;
    }

    if (puzzleId === "4") {
      return `
        <div class="state-summary">
          <div class="state-grid">
            <section class="state-card">
              <h3>Secuencia</h3>
              <div class="state-metrics">
                ${stateMetric("Aciertos", `${data.streak || 0}/${data.total_required || 0}`)}
                ${stateMetric("Grabando", data.storing)}
                ${stateMetric("Reproduciendo muestra", data.playing_sample)}
              </div>
            </section>
            ${stateList("Entradas actuales", Array.isArray(data.current_progress) ? data.current_progress.map(String) : [])}
            ${stateList("Historial reciente", Array.isArray(data.history) ? data.history.map((item) => Array.isArray(item) ? item.join(" · ") : String(item)) : [])}
          </div>
        </div>
      `;
    }

    if (puzzleId === "5") {
      const times = Array.isArray(data.times) ? data.times : [];
      return `
        <div class="state-summary">
          <div class="state-grid">
            <section class="state-card">
              <h3>Temporizacion</h3>
              <div class="state-metrics">
                ${stateMetric("Ronda", data.round)}
                ${stateMetric("Objetivo", data.objective)}
                ${stateMetric("Limite", data.limit)}
                ${stateMetric("Total actual", data.total)}
                ${stateMetric("Activa", data.active_round)}
                ${stateMetric("Esperando", data.waiting)}
              </div>
            </section>
            ${stateList("Tiempos", times.map((item) => `T${item.player}: ${item.time}`))}
          </div>
        </div>
      `;
    }

    if (puzzleId === "6") {
      return `
        <div class="state-summary">
          <div class="state-grid">
            <section class="state-card">
              <h3>Energia</h3>
              <div class="state-metrics">
                ${stateMetric("Activo", data.active)}
                ${stateMetric("Tiempo restante", data.remaining)}
                ${stateMetric("Duracion", data.duration)}
                ${stateMetric("Reinicio pendiente", data.restart_pending)}
                ${stateMetric("Espera", data.waiting_seconds)}
                ${stateMetric("Ultimo terminal", data.last_reset_box)}
              </div>
            </section>
            ${stateList("Ultimo evento", [data.last_reset_message || "--"])}
          </div>
        </div>
      `;
    }

    if (puzzleId === "7") {
      const solvedBoxes = Array.isArray(data.solved_boxes) ? data.solved_boxes : [];
      return `
        <div class="state-summary">
          <div class="state-grid">
            <section class="state-card">
              <h3>Codigos</h3>
              <div class="state-metrics">
                ${stateMetric("Resueltos", `${solvedBoxes.length}/10`)}
                ${stateMetric("Puzzle resuelto", data.puzzle_solved)}
              </div>
            </section>
            ${stateList("Terminales resueltos", solvedBoxes.map((item) => `Terminal ${item}`))}
          </div>
        </div>
      `;
    }

    if (puzzleId === "8") {
      const symbols = Array.isArray(data.symbols) ? data.symbols : [];
      const colors = data.colors && typeof data.colors === "object"
        ? Object.entries(data.colors).map(([symbol, color]) => `${symbol}: ${color}`)
        : [];
      const inputSymbols = data.input_symbols && typeof data.input_symbols === "object"
        ? Object.entries(data.input_symbols).map(([terminal, symbol]) => `T${terminal}: ${symbol}`)
        : [];
      const inputColors = data.input_colors && typeof data.input_colors === "object"
        ? Object.entries(data.input_colors).map(([terminal, color]) => `T${terminal}: ${color}`)
        : [];
      const solutionRows = Array.isArray(data.solution_rows)
        ? data.solution_rows.map((row) => {
            const entries = Array.isArray(row.entries)
              ? row.entries.map((entry) => `${entry.symbol}/${entry.color}`).join(" · ")
              : "--";
            return `T${row.box}: ${row.token} -> ${entries}`;
          })
        : [];
      return `
        <div class="state-summary">
          <div class="state-grid">
            <section class="state-card">
              <h3>Tokens</h3>
              <div class="state-metrics">
                ${stateMetric("Ronda", data.round)}
                ${stateMetric("Fase", data.phase)}
                ${stateMetric("Entradas por terminal", data.input_required || data.round || 1)}
                ${stateMetric("Puzzle resuelto", data.puzzle_solved)}
              </div>
            </section>
            ${stateList("Simbolos en pantalla", symbols.map(String))}
            ${stateList("Colores objetivo", colors)}
            ${stateList("Correctas", solutionRows)}
            ${stateList("Entradas simbolo", inputSymbols)}
            ${stateList("Entradas color", inputColors)}
          </div>
        </div>
      `;
    }

    if (puzzleId === "9") {
      const boxes = data.boxes && typeof data.boxes === "object"
        ? Object.entries(data.boxes).map(([terminal, token]) => `T${terminal}: ${token}`)
        : [];
      const status = data.status && typeof data.status === "object"
        ? Object.entries(data.status).map(([key, value]) => `${key}: ${formatStateValue(value)}`)
        : [];
      return `
        <div class="state-summary">
          <div class="state-grid">
            <section class="state-card">
              <h3>Piramide</h3>
              <div class="state-metrics">
                ${stateMetric("Puzzle resuelto", data.puzzle_solved)}
              </div>
            </section>
            ${stateList("Terminales", boxes)}
            ${stateList("Estado interno", status)}
          </div>
        </div>
      `;
    }

    if (puzzleId === "10") {
      const solvedBoxes = Array.isArray(data.solved_boxes) ? data.solved_boxes : [];
      const targets = data.box_targets && typeof data.box_targets === "object"
        ? Object.entries(data.box_targets).map(([box, code]) => `Caja ${box}: ${code}`)
        : [];
      return `
        <div class="state-summary">
          <div class="state-grid">
            <section class="state-card">
              <h3>Codigos</h3>
              <div class="state-metrics">
                ${stateMetric("Resueltas", `${solvedBoxes.length}/10`)}
                ${stateMetric("Puzzle resuelto", data.puzzle_solved)}
                ${stateMetric("Tiempo ronda", data.round_seconds)}
              </div>
            </section>
            ${stateList("Cajas resueltas", solvedBoxes.map((box) => `Caja ${box}`))}
            ${stateList("Objetivos", targets)}
          </div>
        </div>
      `;
    }

    if (puzzleId === "-1") {
      const target = Array.isArray(data.target) ? data.target.join("") : "--";
      const activeBoxes = data.box_states && typeof data.box_states === "object"
        ? Object.entries(data.box_states).map(([box, buttons]) => `T${box}: ${Array.isArray(buttons) ? buttons.join("") : buttons}`)
        : [];
      return `
        <div class="state-summary">
          <div class="state-grid">
            <section class="state-card">
              <h3>Final</h3>
              <div class="state-metrics">
                ${stateMetric("Ronda", data.round)}
                ${stateMetric("GIF", data.num_giff)}
                ${stateMetric("Duracion", data.duration)}
                ${stateMetric("Objetivo", target)}
                ${stateMetric("Puzzle resuelto", data.puzzle_solved)}
              </div>
            </section>
            ${stateList("Terminales activos", activeBoxes)}
          </div>
        </div>
      `;
    }

    return renderFallbackState(data);
  }

  async function refreshCurrentState() {
    try {
      const response = await fetch("/current_state");
      const data = await response.json();
      if (String(data.puzzle_id) === "2" && els.puzzleSelect.value === "2") {
        applyPuzzle2State(data);
        renderPuzzle2Simulator();
      }
	      if (els.puzzleSelect.value === "12") {
	        updatePuzzle12SimulatorState(data);
	      }
	      els.currentState.innerHTML = renderStateSummary(data);
	      renderGMState(data);
	      await maybeAutoSkipAfterPhaseAdvance(data);
	    } catch (error) {
	      els.currentState.innerHTML = `<div class="state-empty">Error: ${escapeHtml(String(error))}</div>`;
	      if (els.gmAlerts) {
	        els.gmAlerts.textContent = `Error actualizando estado: ${String(error)}`;
	      }
	    }
	  }

	  function bindEvents() {
	    els.gmNavTabs.forEach((tab) => {
	      tab.addEventListener("click", () => switchTab(tab.dataset.gmSection || "partida"));
	    });
	    els.puzzleSelect.addEventListener("change", renderForm);
    els.topicSelect.addEventListener("change", () => {
      updateTopicHelp();
      syncEditorForTopic();
    });
    els.messageSelect.addEventListener("change", loadSelectedMessage);
    els.sendBtn.addEventListener("click", () => {
      sendGeneratedPayload().catch((error) => {
        appendLog({ error: String(error) });
      });
    });
    els.startBtn.addEventListener("click", () => {
      startPuzzle(false).catch((error) => appendLog({ error: String(error) }));
    });
    els.restartBtn.addEventListener("click", () => {
      startPuzzle(true).catch((error) => appendLog({ error: String(error) }));
    });
    els.viewBtn.addEventListener("click", openPuzzleView);
    if (els.solveBtn) {
      els.solveBtn.addEventListener("click", () => {
        solvePuzzle6().catch((error) => appendLog({ error: String(error) }));
      });
    }
    if (els.unsolveBtn) {
      els.unsolveBtn.addEventListener("click", () => {
        unsolvePuzzle6().catch((error) => appendLog({ error: String(error) }));
      });
    }
    if (els.refreshStateBtn) {
      els.refreshStateBtn.addEventListener("click", () => {
        refreshCurrentState();
      });
    }
    if (els.refreshScenesBtn) {
      els.refreshScenesBtn.addEventListener("click", () => {
        checkSceneHealth().catch((error) => {
          if (els.sceneHealth) {
            els.sceneHealth.innerHTML = `<div class="state-empty">Error: ${escapeHtml(String(error))}</div>`;
          }
        });
      });
    }
    if (els.refreshSystemBtn) {
      els.refreshSystemBtn.addEventListener("click", () => {
        renderSystemSummary();
        renderPlayerLogs();
        refreshPreflightStatus().catch((error) => appendLog({ error: String(error) }));
      });
    }
    if (els.refreshLogsBtn) {
      els.refreshLogsBtn.addEventListener("click", () => {
        renderPlayerLogs();
      });
    }
	    if (els.clearLogsBtn) {
	      els.clearLogsBtn.addEventListener("click", () => {
	        if (!window.confirm("Borrar logs del player?")) {
	          return;
	        }
	        clearPlayerLogs();
	      });
	    }
    if (els.fullscreenBtn) {
      els.fullscreenBtn.addEventListener("click", () => {
        toggleFullscreen().catch((error) => appendLog({ error: String(error) }));
      });
    }
    if (els.audioBtn) {
      els.audioBtn.addEventListener("click", () => {
        runAudioTest()
          .then(() => setPreflightStatus("audio", "ok"))
          .catch((error) => appendLog({ error: String(error) }));
      });
    }
    if (els.clearLogBtn) {
      els.clearLogBtn.addEventListener("click", () => {
        if (els.eventLog) {
          els.eventLog.innerHTML = "";
        }
      });
    }
    els.copyReferenceBtn.addEventListener("click", async () => {
      const text = els.referenceOutput.textContent.trim();
      if (!text) {
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        setStatus("Referencia copiada");
      } catch (error) {
        appendLog({ error: "copy_reference_failed", detail: String(error) });
      }
    });
    if (els.saveSessionBtn) els.saveSessionBtn.addEventListener("click", saveSession);
    if (els.newSessionBtn) els.newSessionBtn.addEventListener("click", () => {
      clearSessionForm();
      renderSessionList();
      setStatus("Nueva sesión preparada");
    });
    if (els.duplicateSessionBtn) els.duplicateSessionBtn.addEventListener("click", duplicateSession);
    if (els.loadSessionBtn) els.loadSessionBtn.addEventListener("click", loadSelectedSession);
    if (els.confirmSessionBtn) els.confirmSessionBtn.addEventListener("click", confirmSession);
    if (els.exportSessionBtn) els.exportSessionBtn.addEventListener("click", exportSessionResult);
    if (els.checkAllBtn) els.checkAllBtn.addEventListener("click", () => refreshPreflightStatus().catch((error) => appendLog({ error: String(error) })));
    if (els.startSystemBtn) els.startSystemBtn.addEventListener("click", () => initializeGameSystem().catch((error) => appendLog({ error: String(error) })));
    if (els.testScreenBtn) els.testScreenBtn.addEventListener("click", testScreen);
    if (els.testMqttBtn) els.testMqttBtn.addEventListener("click", () => testMqtt().catch((error) => appendLog({ error: String(error) })));
    if (els.testEsp32Btn) els.testEsp32Btn.addEventListener("click", () => testEsp32().catch((error) => appendLog({ error: String(error) })));
    if (els.openPlayerBtn) els.openPlayerBtn.addEventListener("click", openPlayerScreen);
    if (els.pauseGameBtn) els.pauseGameBtn.addEventListener("click", pauseGame);
    if (els.resumeGameBtn) els.resumeGameBtn.addEventListener("click", resumeGame);
    if (els.completePuzzleBtn) els.completePuzzleBtn.addEventListener("click", () => completeCurrentPuzzle().catch((error) => appendLog({ error: String(error) })));
    if (els.skipPuzzleBtn) els.skipPuzzleBtn.addEventListener("click", () => skipCurrentPuzzle().catch((error) => appendLog({ error: String(error) })));
    if (els.finishGameBtn) els.finishGameBtn.addEventListener("click", finishGame);
  }

  loadGameState();
  loadActiveSession();
  renderSessionList();
  renderPreflightChecklist();
  renderPuzzleProgress();
  renderIncidents();
  initPuzzleSelect();
  renderShortcutButtons();
  switchTab("sesiones");
  renderSystemSummary();
  renderPlayerLogs();
  renderForm();
  renderDeviceState();
  if (puzzleRuntime.startedAt) {
    startGameTimer();
  } else {
    renderGameTimer();
  }
  bindEvents();
  window.setInterval(() => {
    autoSkipMonitorTick();
  }, 1800);
})();
