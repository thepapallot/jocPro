(function () {
  const puzzleConfigs = {
    "1": {
      label: "Puzzle 1",
      route: "/puzzle/1",
      startRoute: "/start_puzzle/1",
      restartRoute: "/restart_puzzle/1",
      help: "Formato MQTT: P1,a,b. Simula la suma detectada por la caja.",
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
        { id: "player", label: "Caja", type: "number", min: 0, max: 9, value: 0 },
        { id: "answer", label: "Indice respuesta", type: "number", min: 0, max: 5, value: 1 }
      ],
      build(values) {
        return `P3,${values.player},${values.answer}`;
      },
      examples: [
        { label: "Caja 0 responde 1", payload: "P3,0,1" },
        { label: "Caja 9 responde 4", payload: "P3,9,4" }
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
        "6, 1, 0, 9, 8, 5, 2, 7"
      ].join("\n")
    },
    "5": {
      label: "Puzzle 5",
      route: "/puzzle/5",
      startRoute: "/start_puzzle/5",
      restartRoute: "/restart_puzzle/5",
      help: "Formato MQTT: P5,player,error_time. Negativo = antes, positivo = tarde.",
      fields: [
        { id: "player", label: "Caja", type: "number", min: 0, max: 9, value: 9 },
        { id: "error", label: "Error tiempo", type: "number", step: "0.1", value: "-0.5" }
      ],
      build(values) {
        return `P5,${values.player},${values.error}`;
      },
      examples: [
        { label: "Caja 9 -0.5s", payload: "P5,9,-0.5" },
        { label: "Caja 3 +1.8s", payload: "P5,3,1.8" }
      ],
      reference: [
        "Rondas fijas:",
        "1 -> objetivo 10 s",
        "2 -> objetivo 30 s",
        "3 -> objetivo 60 s",
        "",
        "El mensaje envia el error respecto al objetivo:",
        "P5,9,-0.5 -> caja 9 se adelanta 0.5 s",
        "P5,3,1.8 -> caja 3 llega 1.8 s tarde"
      ].join("\n")
    },
    "6": {
      label: "Puzzle 6",
      route: "/puzzle/6",
      startRoute: "/start_puzzle/6",
      restartRoute: "/restart_puzzle/6",
      help: "Formato MQTT: P6,boxNumber. Simula una caja que deja escapar la ventana de energia.",
      fields: [
        { id: "box", label: "Caja", type: "number", min: 0, max: 9, value: 4 }
      ],
      build(values) {
        return `P6,${values.box}`;
      },
      examples: [
        { label: "Falla caja 4", payload: "P6,4" },
        { label: "Falla caja 8", payload: "P6,8" }
      ],
      reference: [
        "No tiene solucion fija visible desde backend.",
        "El puzzle se resuelve si termina la cuenta atras sin fallos.",
        "El mensaje P6,box simula una caja que ha fallado y reinicia la ventana."
      ].join("\n")
    },
    "7": {
      label: "Puzzle 7",
      route: "/puzzle/7",
      startRoute: "/start_puzzle/7",
      restartRoute: "/restart_puzzle/7",
      help: "Formato MQTT: P7,boxIndex,code. code es la secuencia de colores de la caja.",
      fields: [
        { id: "box", label: "Caja", type: "number", min: 0, max: 9, value: 0 },
        { id: "code", label: "Codigo", type: "text", value: "0424", fullWidth: true }
      ],
      build(values) {
        return `P7,${values.box},${values.code}`;
      },
      examples: [
        { label: "Caja 0 codigo 0424", payload: "P7,0,0424" },
        { label: "Caja 5 codigo 4310", payload: "P7,5,4310" }
      ],
      reference: [
        "Codigos correctos por caja:",
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
        "Tokens por caja -> 18, 14, 17, 5, 20, 10, 13, 31, 35, 22",
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
      help: "Formato MQTT: P9,box,token. Usa -1 para vaciar la caja.",
      fields: [
        { id: "box", label: "Caja", type: "number", min: 0, max: 9, value: 4 },
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
        { label: "Caja 4 <- token 31", payload: "P9,4,8" },
        { label: "Vaciar caja 4", payload: "P9,4,-1" }
      ],
      reference: [
        "Solucion por caja -> token index:",
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
    "-1": {
      label: "Puzzle final",
      route: "/puzzle/final",
      startRoute: "/start_puzzle_final",
      restartRoute: "/start_puzzle_final",
      help: "Formato MQTT: P-1,box_id,buttons_string. buttons_string es la secuencia detectada por la caja.",
      fields: [
        { id: "box", label: "Caja", type: "number", min: 0, max: 9, value: 0 },
        { id: "buttons", label: "Botones", type: "text", value: "2413", fullWidth: true }
      ],
      build(values) {
        return `P-1,${values.box},${values.buttons}`;
      },
      examples: [
        { label: "Caja 0 / 2413", payload: "P-1,0,2413" },
        { label: "Caja 7 / 1234", payload: "P-1,7,1234" }
      ],
      reference: [
        "Puzzle final:",
        "Hay 4 rondas con GIF variable.",
        "Ronda 1 -> 30s",
        "Ronda 2 -> 45s",
        "Ronda 3 -> 90s",
        "Ronda 4 -> 90s",
        "",
        "La solucion depende del GIF actual (`num_giff`).",
        "Los targets estan en mqtt/puzzles/puzzleFinal.py -> self.botons.",
        "Si quieres, te puedo sacar luego una tabla legible round/giff -> objetivo."
      ].join("\n")
    }
  };

  const els = {
    puzzleSelect: document.getElementById("test-puzzle-select"),
    openLink: document.getElementById("test-open-link"),
    formBuilder: document.getElementById("test-form-builder"),
    buildBtn: document.getElementById("test-build-btn"),
    sendBtn: document.getElementById("test-send-btn"),
    generatedPayload: document.getElementById("test-generated-payload"),
    rawPayloads: document.getElementById("test-raw-payloads"),
    intervalMs: document.getElementById("test-interval-ms"),
    topic: document.getElementById("test-topic"),
    sendRawBtn: document.getElementById("test-send-raw-btn"),
    clearRawBtn: document.getElementById("test-clear-raw-btn"),
    startBtn: document.getElementById("test-start-btn"),
    restartBtn: document.getElementById("test-restart-btn"),
    viewBtn: document.getElementById("test-view-btn"),
    exampleButtons: document.getElementById("test-example-buttons"),
    helpText: document.getElementById("test-help-text"),
    currentState: document.getElementById("test-current-state"),
    eventLog: document.getElementById("test-event-log"),
    clearLogBtn: document.getElementById("test-clear-log-btn"),
    statusBadge: document.getElementById("test-status-badge"),
    referenceOutput: document.getElementById("test-reference-output"),
    copyReferenceBtn: document.getElementById("test-copy-reference-btn"),
    simContent: document.getElementById("test-sim-content")
  };

  const simState = {
    puzzle1A: "30",
    puzzle1B: "9",
    puzzle2Symbol: "3",
    puzzle4Button: "3",
    puzzle4Song: "5",
    puzzle3Answer: 1,
    puzzle3Correct: null,
    puzzle5Error: "-0.5",
    puzzle6Box: "4",
    puzzle7Digits: ["0", "4", "2", "4"],
    puzzle8Token: "5",
    puzzle8Symbol: "0",
    puzzle8Color: "1",
    puzzle9Token: "8"
  };

  function initPuzzleSelect() {
    Object.entries(puzzleConfigs).forEach(([id, config]) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = config.label;
      els.puzzleSelect.appendChild(option);
    });
  }

  function getSelectedConfig() {
    return puzzleConfigs[els.puzzleSelect.value];
  }

  function renderForm() {
    const config = getSelectedConfig();
    els.formBuilder.innerHTML = "";
    els.exampleButtons.innerHTML = "";
    els.helpText.textContent = config.help;
    els.referenceOutput.textContent = config.reference || "Sin referencia disponible.";
    els.openLink.href = config.route;

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

      wrapper.appendChild(input);
      els.formBuilder.appendChild(wrapper);
    });

    config.examples.forEach((example, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "example-btn";
      if (index === 0) {
        btn.classList.add("primary-action");
      }
      btn.textContent = example.label;
      btn.addEventListener("click", () => {
        els.generatedPayload.value = example.payload;
        els.rawPayloads.value = example.payload;
      });
      els.exampleButtons.appendChild(btn);
    });

    buildPayload();
    renderSimulator();
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
    if (puzzleId === "-1") {
      renderPuzzleFinalSimulator();
      return;
    }

    els.simContent.innerHTML = `
      <div class="sim-note">
        Este puzzle sigue usando bien el formulario rapido y el payload libre.
        Iremos anadiendo simulaciones visuales especificas donde tenga mas sentido con la mecanica real.
      </div>
    `;
  }

  function renderPuzzle1Simulator() {
    els.simContent.innerHTML = `
      <div class="sim-note">Introduce los dos valores fisicos y envialos como suma detectada.</div>
      <div class="sim-grid answer-grid">
        <label><span class="field-label">Token</span><input id="sim-p1-a" type="number" value="${simState.puzzle1A}"></label>
        <label><span class="field-label">Caja</span><input id="sim-p1-b" type="number" value="${simState.puzzle1B}"></label>
      </div>
      <div class="sim-selected-readout">Resultado: <strong>${Number(simState.puzzle1A || 0) + Number(simState.puzzle1B || 0)}</strong></div>
      <div class="sim-actions">
        <button type="button" class="sim-button" data-sim-p1-send>Enviar suma</button>
      </div>
    `;

    ["a", "b"].forEach((key) => {
      const input = els.simContent.querySelector(`#sim-p1-${key}`);
      input.addEventListener("change", () => {
        simState[`puzzle1${key.toUpperCase()}`] = input.value || "0";
        renderPuzzle1Simulator();
      });
    });

    els.simContent.querySelector("[data-sim-p1-send]").addEventListener("click", async () => {
      const payload = `P1,${simState.puzzle1A},${simState.puzzle1B}`;
      await sendPayloads([payload]);
      appendLog({ local: true, payload, simulated: "puzzle1" });
    });
  }

  function renderPuzzle2Simulator() {
    const players = Array.from({ length: 10 }, (_, index) => {
      const player = index + 1;
      return `<button type="button" class="sim-box" data-sim-p2-player="${player}">Player ${player}</button>`;
    }).join("");
    const symbols = Array.from({ length: 10 }, (_, index) => {
      const selected = simState.puzzle2Symbol === String(index) ? " is-selected" : "";
      return `<button type="button" class="sim-token${selected}" data-sim-p2-symbol="${index}">${index}</button>`;
    }).join("");

    els.simContent.innerHTML = `
      <div class="sim-note">Selecciona simbolo y luego pulsa el player. Reproduce la secuencia del laberinto.</div>
      <div class="sim-selected-readout">Simbolo activo: <strong>${simState.puzzle2Symbol}</strong></div>
      <div class="sim-palette">${symbols}</div>
      <div class="sim-grid box-grid">${players}</div>
    `;

    els.simContent.querySelectorAll("[data-sim-p2-symbol]").forEach((button) => {
      button.addEventListener("click", () => {
        simState.puzzle2Symbol = button.dataset.simP2Symbol;
        renderPuzzle2Simulator();
      });
    });

    els.simContent.querySelectorAll("[data-sim-p2-player]").forEach((button) => {
      button.addEventListener("click", async () => {
        const player = button.dataset.simP2Player;
        const payload = `P2,${player},${simState.puzzle2Symbol}`;
        await sendPayloads([payload]);
        appendLog({ local: true, payload, simulated: "puzzle2" });
      });
    });
  }

  function renderPuzzle4Simulator() {
    const buttons = [
      { value: "4", label: "Escuchar la muestra completa", shortLabel: "Azul", colorClass: "sim-p4-blue" },
      { value: "3", label: "Registrar", shortLabel: "Verde", colorClass: "sim-p4-green" },
      { value: "1", label: "Dejar de registrar", shortLabel: "Rojo", colorClass: "sim-p4-red" },
      { value: "2", label: "Resetear", shortLabel: "Blanco", colorClass: "sim-p4-white" }
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
        <button type="button" class="sim-button" data-sim-p4-send-track>Reproducir pista seleccionada</button>
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
      return `<button type="button" class="sim-box${selected}" data-sim-p6-box="${index}">Caja ${index}</button>`;
    }).join("");

    els.simContent.innerHTML = `
      <div class="sim-note">Pulsa una caja para simular que ha perdido energia y forzar el reinicio del sistema.</div>
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
    const presets = ["-1.5", "-0.5", "0.0", "0.5", "1.5", "3.0"];
    const presetButtons = presets.map((value) => {
      const selected = simState.puzzle5Error === value ? " is-selected" : "";
      return `<button type="button" class="sim-button${selected}" data-sim-p5-error="${value}">${value}s</button>`;
    }).join("");

    const boxes = Array.from({ length: 10 }, (_, index) => {
      return `<button type="button" class="sim-box" data-sim-p5-box="${index}">Caja ${index}</button>`;
    }).join("");

    els.simContent.innerHTML = `
      <div class="sim-note">Selecciona una desviacion y pulsa la caja que quieres enviar. Negativo = antes, positivo = tarde.</div>
      <div class="sim-selected-readout">Error activo: <strong>${simState.puzzle5Error}s</strong></div>
      <div class="sim-grid answer-grid">${presetButtons}</div>
      <label>
        <span class="field-label">Error manual</span>
        <input id="sim-p5-custom-error" type="number" step="0.1" value="${simState.puzzle5Error}">
      </label>
      <div class="sim-grid box-grid">${boxes}</div>
      <div class="sim-actions">
        <button type="button" class="sim-button" data-sim-p5-all>Enviar a todas las cajas</button>
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

    els.simContent.querySelectorAll("[data-sim-p5-box]").forEach((button) => {
      button.addEventListener("click", async () => {
        const box = Number(button.dataset.simP5Box);
        const payload = `P5,${box},${simState.puzzle5Error}`;
        await sendPayloads([payload]);
        appendLog({ local: true, payload, simulated: "puzzle5" });
      });
    });

    const sendAll = els.simContent.querySelector("[data-sim-p5-all]");
    if (sendAll) {
      sendAll.addEventListener("click", async () => {
        const payloads = Array.from({ length: 10 }, (_, index) => `P5,${index},${simState.puzzle5Error}`);
        await sendPayloads(payloads);
        payloads.forEach((payload) => appendLog({ local: true, payload, simulated: "puzzle5" }));
      });
    }
  }

  function renderPuzzle7Simulator() {
    const digitButtons = [0, 1, 2, 3, 4].map((digit) => {
      return `<button type="button" class="sim-token" data-sim-p7-digit="${digit}">${digit}</button>`;
    }).join("");

    const rows = Array.from({ length: 10 }, (_, index) => {
      return `<button type="button" class="sim-box" data-sim-p7-box="${index}">Caja ${index}</button>`;
    }).join("");

    const code = simState.puzzle7Digits.join("");

    els.simContent.innerHTML = `
      <div class="sim-note">Construye el codigo de 4 digitos y luego pulsa la caja. Cada digito representa un color de la tira.</div>
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
    const answerButtons = Array.from({ length: 6 }, (_, index) => {
      const answer = index + 1;
      const selected = simState.puzzle3Answer === answer ? " is-selected" : "";
      return `<button type="button" class="sim-button${selected}" data-sim-answer="${answer}">Respuesta ${answer}</button>`;
    }).join("");

    const boxButtons = Array.from({ length: 10 }, (_, index) => {
      return `<button type="button" class="sim-box" data-sim-p3-box="${index}">Caja ${index}</button>`;
    }).join("");

    const correctBlock = simState.puzzle3Correct
      ? `<div class="sim-selected-readout">Correcta actual: <strong>${simState.puzzle3Correct.correct_answer}</strong> · ${simState.puzzle3Correct.correct_text || ""}</div>`
      : `<div class="sim-selected-readout">Correcta actual: <strong>--</strong></div>`;

    els.simContent.innerHTML = `
      <div class="sim-note">Selecciona una respuesta y luego toca una o varias cajas, como harian los jugadores.</div>
      <div class="sim-selected-readout">Respuesta activa: <strong>${simState.puzzle3Answer}</strong></div>
      ${correctBlock}
      <div class="sim-grid answer-grid">${answerButtons}</div>
      <div class="sim-grid box-grid">${boxButtons}</div>
      <div class="sim-actions">
        <button type="button" class="sim-button" data-sim-p3-solution>Ver correcta</button>
        <button type="button" class="sim-button" data-sim-p3-all>Enviar a todas las cajas</button>
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
        await sendPayloads([payload]);
        appendLog({ local: true, payload, simulated: "puzzle3" });
      });
    });

    const sendAll = els.simContent.querySelector("[data-sim-p3-all]");
    if (sendAll) {
      sendAll.addEventListener("click", async () => {
        const payloads = Array.from({ length: 10 }, (_, index) => `P3,${index},${simState.puzzle3Answer}`);
        await sendPayloads(payloads);
        payloads.forEach((payload) => appendLog({ local: true, payload, simulated: "puzzle3" }));
      });
    }

    const showSolution = els.simContent.querySelector("[data-sim-p3-solution]");
    if (showSolution) {
      showSolution.addEventListener("click", async () => {
        try {
          const response = await fetch("/test/puzzle3_solution");
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || "puzzle3_solution_failed");
          }
          simState.puzzle3Correct = data;
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
      const cells = row.map((box) => `<button type="button" class="sim-box" data-sim-p9-box="${box}">Caja ${box}</button>`).join("");
      return `<div class="sim-p9-row">${cells}</div>`;
    }).join("");

    const solutionList = solutionMap
      .map((item) => `<div class="sim-solution-item"><span>Caja ${item.box}</span><strong>${item.token}</strong></div>`)
      .join("");

    const currentLabel = tokens.find((token) => token.value === simState.puzzle9Token)?.label || simState.puzzle9Token;

    els.simContent.innerHTML = `
      <div class="sim-note">Selecciona un token y despues pulsa una caja de la piramide para colocarlo.</div>
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

  function renderPuzzle8Simulator() {
    const tokenMap = [
      { value: "0", label: "5", box: 3 },
      { value: "1", label: "10", box: 5 },
      { value: "2", label: "13", box: 6 },
      { value: "3", label: "14", box: 1 },
      { value: "4", label: "17", box: 2 },
      { value: "5", label: "18", box: 0 },
      { value: "6", label: "20", box: 4 },
      { value: "7", label: "22", box: 9 },
      { value: "8", label: "31", box: 7 },
      { value: "9", label: "35", box: 8 }
    ];

    const tokens = tokenMap
      .map((token) => {
        const selected = simState.puzzle8Token === token.value ? " is-selected" : "";
        return `<button type="button" class="sim-token${selected}" data-sim-p8-token="${token.value}">${token.label}</button>`;
      }).join("");

    const symbols = [
      "0 alpha", "1 beta", "2 delta", "3 epsilon", "4 gamma",
      "5 lambda", "6 mu", "7 omega", "8 pi", "9 sigma"
    ].map((label, index) => {
      const selected = simState.puzzle8Symbol === String(index) ? " is-selected" : "";
      return `<button type="button" class="sim-token${selected}" data-sim-p8-symbol="${index}">${label}</button>`;
    }).join("");

    const colors = [
      "1 red", "2 yellow", "3 blue", "4 black", "5 green", "6 white"
    ].map((label, index) => {
      const value = String(index + 1);
      const selected = simState.puzzle8Color === value ? " is-selected" : "";
      return `<button type="button" class="sim-token${selected}" data-sim-p8-color="${value}">${label}</button>`;
    }).join("");

    const activeToken = tokenMap.find((token) => token.value === simState.puzzle8Token);
    const activeTokenLabel = activeToken?.label || simState.puzzle8Token;
    const activeBoxLabel = activeToken ? `caja ${activeToken.box}` : "--";

    els.simContent.innerHTML = `
      <div class="sim-note">Selecciona simbolo, token y color. El simulador muestra el numero real del token, pero enviara el indice MQTT que espera backend.</div>
      <div class="sim-selected-readout">Activo: <strong>${simState.puzzle8Symbol}</strong> · <strong>token ${activeTokenLabel}</strong> · <strong>${simState.puzzle8Color}</strong> · <strong>${activeBoxLabel}</strong></div>
      <div class="field-label">Simbolo</div>
      <div class="sim-palette">${symbols}</div>
      <div class="field-label">Token</div>
      <div class="sim-palette">${tokens}</div>
      <div class="field-label">Color</div>
      <div class="sim-palette">${colors}</div>
      <div class="sim-actions">
        <button type="button" class="sim-button" data-sim-p8-send>Enviar combinacion</button>
      </div>
    `;

    [["symbol", "Symbol"], ["token", "Token"], ["color", "Color"]].forEach(([prefix, stateKey]) => {
      els.simContent.querySelectorAll(`[data-sim-p8-${prefix}]`).forEach((button) => {
        button.addEventListener("click", () => {
          simState[`puzzle8${stateKey}`] = button.dataset[`simP8${stateKey}`];
          renderPuzzle8Simulator();
        });
      });
    });

    els.simContent.querySelector("[data-sim-p8-send]").addEventListener("click", async () => {
      const payload = `P8,${simState.puzzle8Symbol},${simState.puzzle8Token},${simState.puzzle8Color}`;
      await sendPayloads([payload]);
      appendLog({ local: true, payload, simulated: "puzzle8" });
    });
  }

  function renderPuzzleFinalSimulator() {
    const boxButtons = Array.from({ length: 10 }, (_, index) => {
      return `<button type="button" class="sim-box" data-sim-pf-box="${index + 1}">Caja ${index + 1}</button>`;
    }).join("");

    els.simContent.innerHTML = `
      <div class="sim-note">Selecciona una caja y escribe el string de 6 botones detectados para la fase final.</div>
      <div class="sim-grid answer-grid">
        <label class="full-width"><span class="field-label">Botones</span><input id="sim-pf-buttons" type="text" value="2413"></label>
      </div>
      <div class="sim-grid box-grid">${boxButtons}</div>
    `;

    els.simContent.querySelectorAll("[data-sim-pf-box]").forEach((button) => {
      button.addEventListener("click", async () => {
        const box = button.dataset.simPfBox;
        const buttons = els.simContent.querySelector("#sim-pf-buttons").value.trim();
        const payload = `P-1,${box},${buttons}`;
        await sendPayloads([payload]);
        appendLog({ local: true, payload, simulated: "puzzleFinal" });
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
    els.generatedPayload.value = config.build(collectValues());
  }

  async function sendPayloads(payloads) {
    const response = await fetch("/test/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: els.topic.value || "TO_FLASK",
        payloads
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "send_failed");
    }
    els.statusBadge.textContent = `${data.topic} · ${data.count} enviado(s)`;
    return data;
  }

  async function sendGeneratedPayload() {
    buildPayload();
    const payload = els.generatedPayload.value.trim();
    if (!payload) {
      return;
    }
    await sendPayloads([payload]);
    appendLog({ local: true, payload });
  }

  async function sendRawPayloads() {
    const lines = els.rawPayloads.value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      return;
    }

    const interval = Math.max(0, Number(els.intervalMs.value) || 0);
    for (let index = 0; index < lines.length; index += 1) {
      await sendPayloads([lines[index]]);
      appendLog({ local: true, payload: lines[index] });
      if (interval && index < lines.length - 1) {
        await new Promise((resolve) => window.setTimeout(resolve, interval));
      }
    }
  }

  async function startPuzzle(restart = false) {
    const config = getSelectedConfig();
    const endpoint = restart ? config.restartRoute : config.startRoute;
    const response = await fetch(endpoint, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "start_failed");
    }
    els.statusBadge.textContent = restart
      ? `${config.label} reiniciado`
      : `${config.label} arrancado`;
  }

  function openPuzzleView() {
    const config = getSelectedConfig();
    window.open(config.route, "_blank", "noopener");
  }

  function appendLog(entry) {
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

  async function refreshCurrentState() {
    try {
      const response = await fetch("/current_state");
      const data = await response.json();
      els.currentState.textContent = JSON.stringify(data, null, 2);
    } catch (error) {
      els.currentState.textContent = JSON.stringify({ error: String(error) }, null, 2);
    }
  }

  function setupSSE() {
    const source = new EventSource("/state_stream");
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        appendLog(data);
      } catch (error) {
        appendLog({ error: "bad_sse_payload", raw: event.data });
      }
      //refreshCurrentState();
    };
  }

  function bindEvents() {
    els.puzzleSelect.addEventListener("change", renderForm);
    els.buildBtn.addEventListener("click", buildPayload);
    els.sendBtn.addEventListener("click", () => {
      sendGeneratedPayload().catch((error) => {
        appendLog({ error: String(error) });
      });
    });
    els.sendRawBtn.addEventListener("click", () => {
      sendRawPayloads().catch((error) => {
        appendLog({ error: String(error) });
      });
    });
    els.clearRawBtn.addEventListener("click", () => {
      els.rawPayloads.value = "";
    });
    els.startBtn.addEventListener("click", () => {
      startPuzzle(false).catch((error) => appendLog({ error: String(error) }));
    });
    els.restartBtn.addEventListener("click", () => {
      startPuzzle(true).catch((error) => appendLog({ error: String(error) }));
    });
    els.viewBtn.addEventListener("click", openPuzzleView);
    els.clearLogBtn.addEventListener("click", () => {
      els.eventLog.innerHTML = "";
    });
    els.copyReferenceBtn.addEventListener("click", async () => {
      const text = els.referenceOutput.textContent.trim();
      if (!text) {
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        els.statusBadge.textContent = "Referencia copiada";
      } catch (error) {
        appendLog({ error: "copy_reference_failed", detail: String(error) });
      }
    });
  }

  initPuzzleSelect();
  renderForm();
  bindEvents();
  setupSSE();
  //refreshCurrentState();
  //window.setInterval(refreshCurrentState, 1500);
})();
