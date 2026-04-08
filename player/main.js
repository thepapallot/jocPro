const DEFAULT_SCENE_ID = "scene_video1_test";
const EPSILON = 0.12;

const elements = {
    playerRoot: document.getElementById("player-root"),
    video: document.getElementById("scene-video"),
    audio: document.getElementById("scene-audio"),
    broadcastOverlay: document.getElementById("broadcast-overlay"),
    broadcastOverlayLogo: document.getElementById("broadcast-overlay-logo"),
    uiLayer: document.getElementById("ui-layer"),
    transitionLayer: document.getElementById("transition-layer"),
    subtitleOverlay: document.getElementById("subtitle-overlay"),
    bootOverlay: document.getElementById("boot-overlay"),
};

function resolveSceneId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("scene") || DEFAULT_SCENE_ID;
}

function resolveNextUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("next") || "";
}

function resolveOnComplete() {
    const params = new URLSearchParams(window.location.search);
    return params.get("on_complete") || "";
}

function createElement(tag, className, text) {
    const node = document.createElement(tag);
    if (className) {
        node.className = className;
    }
    if (typeof text === "string") {
        node.textContent = text;
    }
    return node;
}

function TitleBlock(segment) {
    const block = createElement("header", "title-block");
    block.appendChild(createElement("h2", "title-block__title", segment.title || ""));

    if (segment.text) {
        block.appendChild(createElement("p", "title-block__text", segment.text));
    }

    return block;
}

function SubtitleBar(text = "Espai reservat per a subtitols o context addicional.") {
    const bar = createElement("footer", "subtitle-bar");
    bar.appendChild(createElement("span", "subtitle-bar__label", "subtitle bar"));
    bar.appendChild(createElement("span", "subtitle-bar__text", text));
    return bar;
}

function StepsList(steps = []) {
    const list = createElement("ol", "steps-list");

    steps.forEach((step, index) => {
        const item = createElement("li", "steps-list__item");
        item.dataset.itemKey = step;
        item.appendChild(createElement("span", "steps-list__index", String(index + 1).padStart(2, "0")));
        item.appendChild(createElement("span", "steps-list__text", step));
        list.appendChild(item);
    });

    return list;
}

function AssetsGrid(assets = []) {
    const grid = createElement("div", "asset-grid");
    const iconOnly = assets.every((asset) => !asset.label && !asset.text);

    if (iconOnly) {
        grid.classList.add("asset-grid--icons");
        grid.classList.add(`asset-grid--icons-${assets.length}`);
    }

    assets.forEach((asset) => {
        const card = createElement("article", "asset-card");
        card.dataset.itemKey = JSON.stringify({
            src: asset.src || "",
            label: asset.label || "",
            text: asset.text || "",
        });
        const hasCopy = Boolean(asset.label || asset.text);
        if (!hasCopy) {
            card.classList.add("asset-card--icon-only");
        }
        const media = createElement("div", "asset-card__media");
        if (asset.swatchClass) {
            const swatch = createElement("span", `asset-card__swatch ${asset.swatchClass}`);
            swatch.setAttribute("aria-hidden", "true");
            media.appendChild(swatch);
        } else {
            const image = document.createElement("img");
            image.className = "asset-card__image";
            image.src = asset.src || "";
            image.alt = asset.alt || asset.label || "";
            media.appendChild(image);
        }

        card.appendChild(media);

        if (hasCopy) {
            const body = createElement("div", "asset-card__body");
            if (asset.label) {
                body.appendChild(createElement("strong", "asset-card__label", asset.label));
            }
            if (asset.text) {
                body.appendChild(createElement("span", "asset-card__text", asset.text));
            }

            card.appendChild(body);
        }
        grid.appendChild(card);
    });

    return grid;
}

function zoneHasContent(zone) {
    return Boolean(
        zone?.title ||
        zone?.text ||
        (Array.isArray(zone?.steps) && zone.steps.length > 0) ||
        (Array.isArray(zone?.assets) && zone.assets.length > 0)
    );
}

function withZoneTitle(zone, fallbackTitle) {
    if (!zone) {
        return null;
    }

    if (zone.title) {
        return zone;
    }

    return {
        ...zone,
        title: fallbackTitle || "",
    };
}

function withUiTitles(segment, uiTitles = {}) {
    return {
        ...segment,
        top: withZoneTitle(segment.top, uiTitles.top),
        left: withZoneTitle(segment.left, uiTitles.left),
        right: withZoneTitle(segment.right, uiTitles.right),
        phases: Array.isArray(segment.phases)
            ? segment.phases.map((phase) => ({
                ...phase,
                top: withZoneTitle(phase.top, uiTitles.top),
                left: withZoneTitle(phase.left, uiTitles.left),
                right: withZoneTitle(phase.right, uiTitles.right),
            }))
            : segment.phases,
    };
}

function mergeZoneState(segment, elapsedSeconds = 0) {
    const state = {
        variant: segment.variant || "mission",
        top: segment.top || null,
        left: segment.left || null,
        right: segment.right || null,
        subtitle: segment.subtitle || null,
    };

    if (!Array.isArray(segment.phases)) {
        return state;
    }

    segment.phases.forEach((phase) => {
        if (elapsedSeconds < Number(phase.at || 0)) {
            return;
        }

        state.variant = phase.variant || state.variant;
        if (phase.top) {
            state.top = phase.top;
        }
        if (phase.left) {
            state.left = phase.left;
        }
        if (phase.right) {
            state.right = phase.right;
        }
        if (phase.subtitle) {
            state.subtitle = phase.subtitle;
        }
    });

    return state;
}

function getActivePhase(segment, elapsedSeconds = 0) {
    if (!Array.isArray(segment.phases)) {
        return null;
    }

    let activePhase = null;

    segment.phases.forEach((phase, index) => {
        if (elapsedSeconds >= Number(phase.at || 0)) {
            activePhase = {
                ...phase,
                _phaseIndex: index,
            };
        }
    });

    return activePhase;
}

function mergeIntoState(target, patch) {
    target.variant = patch.variant || target.variant;

    if (patch.top) {
        target.top = patch.top;
    }

    if (patch.left) {
        target.left = patch.left;
    }

    if (patch.right) {
        target.right = patch.right;
    }

    if (patch.subtitle) {
        target.subtitle = patch.subtitle;
    }

    return target;
}

function collectZoneBlueprint(segment) {
    const blueprint = {
        top: segment.top ? { ...segment.top } : null,
        left: segment.left ? { ...segment.left } : null,
        right: segment.right ? { ...segment.right } : null,
    };

    if (!Array.isArray(segment.phases)) {
        return blueprint;
    }

    segment.phases.forEach((phase) => {
        if (phase.top) {
            blueprint.top = {
                variant: phase.top.variant || phase.variant || segment.variant || "mission",
                title: phase.top.title || blueprint.top?.title || "",
            };
        }

        if (phase.left) {
            blueprint.left = {
                variant: phase.left.variant || phase.variant || segment.variant || "mission",
                title: phase.left.title || blueprint.left?.title || "",
            };
        }

        if (phase.right) {
            blueprint.right = {
                variant: phase.right.variant || phase.variant || segment.variant || "mission",
                title: phase.right.title || blueprint.right?.title || "",
            };
        }
    });

    return blueprint;
}

function collectAccumulatedBlueprint(segments, currentSegmentIndex) {
    const blueprint = {
        top: null,
        left: null,
        right: null,
    };

    segments.slice(0, currentSegmentIndex + 1).forEach((segment) => {
        if (segment.type !== "fullscreen_ui") {
            return;
        }

        const nextBlueprint = collectZoneBlueprint(segment);
        blueprint.top = nextBlueprint.top || blueprint.top;
        blueprint.left = nextBlueprint.left || blueprint.left;
        blueprint.right = nextBlueprint.right || blueprint.right;
    });

    return blueprint;
}

function mergeAccumulatedUiState(segments, currentSegmentIndex, elapsedSeconds = 0) {
    const state = {
        variant: "mission",
        top: null,
        left: null,
        right: null,
        subtitle: null,
    };

    segments.slice(0, currentSegmentIndex + 1).forEach((segment, index) => {
        if (segment.type !== "fullscreen_ui") {
            return;
        }

        const segmentElapsed = index === currentSegmentIndex
            ? elapsedSeconds
            : segment.durationSeconds;

        mergeIntoState(state, mergeZoneState(segment, segmentElapsed));
    });

    return state;
}

function createZoneSlot(slotName, zone) {
    const card = createElement("section", `zone-card zone-card--${slotName}`);
    card.dataset.variant = zone?.variant || "mission";
    card.dataset.zoneKind = Array.isArray(zone?.assets) && zone.assets.length > 0
        ? "assets"
        : Array.isArray(zone?.steps) && zone.steps.length > 0
            ? "steps"
            : zone?.text
                ? "text"
                : "empty";

    if (!zoneHasContent(zone)) {
        card.classList.add("zone-card--empty");
    }

    return card;
}

function updateZoneSlot(card, zone, { animate = false } = {}) {
    const nextVariant = zone?.variant || "mission";
    const nextKind = Array.isArray(zone?.assets) && zone.assets.length > 0
        ? "assets"
        : Array.isArray(zone?.steps) && zone.steps.length > 0
            ? "steps"
            : zone?.text
                ? "text"
                : "empty";
    const nextKey = zoneHasContent(zone) ? JSON.stringify(zone) : "";
    const previousKey = card.dataset.renderKey || "";

    card.dataset.variant = nextVariant;
    card.dataset.zoneKind = nextKind;

    if (!zoneHasContent(zone)) {
        card.classList.add("zone-card--empty");
        card.dataset.renderKey = "";
        card.replaceChildren();
        return;
    }

    if (previousKey === nextKey) {
        card.classList.remove("zone-card--empty");
        return;
    }

    card.classList.remove("zone-card--empty");
    card.dataset.renderKey = nextKey;
    const titleKey = JSON.stringify({
        title: zone.title || "",
        text: zone.text || "",
    });
    const previousTitleKey = card.dataset.titleKey || "";
    const currentHeader = card.querySelector(".title-block");
    const hasSteps = Array.isArray(zone.steps) && zone.steps.length > 0;
    const hasAssets = Array.isArray(zone.assets) && zone.assets.length > 0;
    let didReplaceWholeZone = false;

    if (!currentHeader || previousTitleKey !== titleKey) {
        const nextHeader = TitleBlock(zone);
        if (currentHeader) {
            currentHeader.replaceWith(nextHeader);
        } else {
            card.prepend(nextHeader);
        }
        card.dataset.titleKey = titleKey;
        didReplaceWholeZone = true;

        if (animate) {
            nextHeader.classList.add("title-block--enter");
        }
    }

    const currentSteps = card.querySelector(".steps-list");
    if (hasSteps) {
        if (!currentSteps) {
            const nextList = StepsList(zone.steps);
            card.appendChild(nextList);
            didReplaceWholeZone = true;
            if (animate) {
                nextList.classList.add("steps-list--enter");
            }
        } else {
            const currentItems = Array.from(currentSteps.querySelectorAll(".steps-list__item"));
            const currentKeys = currentItems.map((item) => item.dataset.itemKey || "");
            const nextKeys = zone.steps.slice();
            const prefixMatches = currentKeys.every((key, index) => key === nextKeys[index]);

            if (!prefixMatches || currentKeys.length > nextKeys.length) {
                const nextList = StepsList(zone.steps);
                currentSteps.replaceWith(nextList);
                didReplaceWholeZone = true;
                if (animate) {
                    nextList.classList.add("steps-list--enter");
                }
            } else {
                zone.steps.slice(currentKeys.length).forEach((step, index) => {
                    const item = createElement("li", "steps-list__item steps-list__item--enter");
                    item.dataset.itemKey = step;
                    item.appendChild(createElement("span", "steps-list__index", String(currentKeys.length + index + 1).padStart(2, "0")));
                    item.appendChild(createElement("span", "steps-list__text", step));
                    currentSteps.appendChild(item);
                });
            }
        }
    } else if (currentSteps) {
        currentSteps.remove();
    }

    const currentAssets = card.querySelector(".asset-grid");
    if (hasAssets) {
        if (!currentAssets) {
            const nextGrid = AssetsGrid(zone.assets);
            card.appendChild(nextGrid);
            didReplaceWholeZone = true;
            if (animate) {
                nextGrid.classList.add("asset-grid--enter");
            }
        } else {
            const currentItems = Array.from(currentAssets.querySelectorAll(".asset-card"));
            const currentKeys = currentItems.map((item) => item.dataset.itemKey || "");
            const nextKeys = zone.assets.map((asset) => JSON.stringify({
                src: asset.src || "",
                label: asset.label || "",
                text: asset.text || "",
            }));
            const prefixMatches = currentKeys.every((key, index) => key === nextKeys[index]);
            const nextIconOnly = zone.assets.every((asset) => !asset.label && !asset.text);

            currentAssets.classList.toggle("asset-grid--icons", nextIconOnly);

            if (!prefixMatches || currentKeys.length > nextKeys.length) {
                const nextGrid = AssetsGrid(zone.assets);
                currentAssets.replaceWith(nextGrid);
                didReplaceWholeZone = true;
                if (animate) {
                    nextGrid.classList.add("asset-grid--enter");
                }
            } else {
                zone.assets.slice(currentKeys.length).forEach((asset) => {
                    const nextGrid = AssetsGrid([asset]);
                    const nextCard = nextGrid.querySelector(".asset-card");
                    if (nextCard) {
                        nextCard.classList.add("asset-card--enter");
                        currentAssets.appendChild(nextCard);
                    }
                });
            }
        }
    } else if (currentAssets) {
        currentAssets.remove();
    }

    if (animate && didReplaceWholeZone) {
        card.classList.remove("zone-card--enter");
        void card.offsetWidth;
        card.classList.add("zone-card--enter");
    }
}

function createFullscreenPanel(segments, currentSegmentIndex, elapsedSeconds = 0) {
    const content = mergeAccumulatedUiState(segments, currentSegmentIndex, elapsedSeconds);
    const blueprint = collectAccumulatedBlueprint(segments, currentSegmentIndex);
    const screen = createElement("section", "ui-screen ui-screen--enter");
    screen.dataset.variant = content.variant || "mission";

    const panel = createElement("article", "panel");
    panel.dataset.variant = content.variant || "mission";

    const body = createElement("div", "ui-dashboard ui-phase");
    const slots = {
        top: createZoneSlot("top", content.top || blueprint.top),
        left: createZoneSlot("left", content.left || blueprint.left),
        right: createZoneSlot("right", content.right || blueprint.right),
    };

    Object.values(slots).forEach((slot) => body.appendChild(slot));

    let subtitle = null;
    if (content.subtitle || content.enable_subtitle_bar) {
        subtitle = SubtitleBar(content.subtitle);
        body.appendChild(subtitle);
    }

    updateZoneSlot(slots.top, content.top || blueprint.top);
    updateZoneSlot(slots.left, content.left || blueprint.left);
    updateZoneSlot(slots.right, content.right || blueprint.right);

    panel.appendChild(body);
    screen.appendChild(panel);
    return { screen, panel, body, slots, subtitle };
}

function updateFullscreenPanel(panelState, segments, currentSegmentIndex, elapsedSeconds = 0) {
    const content = mergeAccumulatedUiState(segments, currentSegmentIndex, elapsedSeconds);
    const blueprint = collectAccumulatedBlueprint(segments, currentSegmentIndex);

    panelState.screen.dataset.variant = content.variant || "mission";
    panelState.panel.dataset.variant = content.variant || "mission";

    updateZoneSlot(panelState.slots.top, content.top || blueprint.top, { animate: true });
    updateZoneSlot(panelState.slots.left, content.left || blueprint.left, { animate: true });
    updateZoneSlot(panelState.slots.right, content.right || blueprint.right, { animate: true });

    if (content.subtitle || content.enable_subtitle_bar) {
        if (!panelState.subtitle) {
            panelState.subtitle = SubtitleBar(content.subtitle);
            panelState.body.appendChild(panelState.subtitle);
        } else {
            const textNode = panelState.subtitle.querySelector(".subtitle-bar__text");
            if (textNode) {
                textNode.textContent = content.subtitle || "";
            }
        }
    } else if (panelState.subtitle) {
        panelState.subtitle.remove();
        panelState.subtitle = null;
    }
}

function TransitionScreen(segment) {
    const classes = ["transition-screen"];
    if (segment.variant) {
        classes.push(`transition-screen--${segment.variant}`);
    }
    const screen = createElement("section", classes.join(" "));

    if (segment.variant === "puzzle6-token-map") {
        screen.appendChild(Puzzle6TokenMap(segment));
        return screen;
    }

    if (segment.variant === "puzzle8-grid") {
        screen.appendChild(Puzzle8GridTransition(segment));
        return screen;
    }

    if (segment.variant === "puzzle9-board") {
        screen.appendChild(Puzzle9BoardTransition(segment));
        return screen;
    }

    if (segment.variant === "puzzle10-patterns") {
        screen.appendChild(Puzzle10PatternsTransition(segment));
        return screen;
    }

    if (segment.variant === "gm-network") {
        screen.appendChild(GameMasterNetworkTransition(segment));
        return screen;
    }

    if (segment.variant === "gm-pyramid") {
        screen.appendChild(GameMasterPyramidTransition(segment));
        return screen;
    }

    if (segment.variant === "gm-terminal") {
        screen.appendChild(GameMasterTerminalTransition(segment));
        return screen;
    }

    const labelInsideMedia = Boolean(segment.image && segment.label && segment.variant === "maze");

    if (segment.video) {
        const media = createElement("div", "transition-screen__media");
        if (labelInsideMedia) {
            media.appendChild(
                createElement("div", "transition-screen__media-label", segment.label),
            );
        }

        const video = document.createElement("video");
        video.className = "transition-screen__video";
        video.src = segment.video;
        video.muted = true;
        video.autoplay = true;
        video.loop = false;
        video.playsInline = true;
        video.preload = "auto";

        const clipStart = Number(segment.clip_start || 0);
        if (clipStart > 0) {
            const seekToStart = () => {
                try {
                    video.currentTime = clipStart;
                } catch (error) {
                    console.warn("No s'ha pogut posicionar el clip de transicio:", error);
                }
            };
            video.addEventListener("loadedmetadata", seekToStart, { once: true });
        }

        video.addEventListener("canplay", () => {
            video.play().catch((error) => {
                console.warn("No s'ha pogut reproduir el video de transicio:", error);
            });
        }, { once: true });

        media.appendChild(video);
        screen.appendChild(media);
    } else if (segment.image) {
        const media = createElement("div", "transition-screen__media");
        if (labelInsideMedia) {
            media.appendChild(
                createElement("div", "transition-screen__media-label", segment.label),
            );
        }
        const image = document.createElement("img");
        image.className = "transition-screen__image";
        image.src = segment.image;
        image.alt = segment.alt || segment.label || "Transition";
        media.appendChild(image);
        screen.appendChild(media);
    }

    if (segment.label && !labelInsideMedia) {
        screen.appendChild(createElement("div", "transition-screen__label", segment.label));
    }
    return screen;
}

function Puzzle6TokenMap(segment) {
    const media = createElement("div", "transition-screen__media transition-screen__media--puzzle6-token-map");
    const panel = createElement("div", "p6-map-panel");
    const grid = createElement("div", "p6-map-grid");
    const tokenSrc = segment.token_src || "/static/images/puzzle1/tarjeta.png";
    const tokens = Array.isArray(segment.tokens) ? segment.tokens : [];

    tokens.forEach((token) => {
        const card = createElement("article", "p6-map-card");
        card.style.setProperty("--token-color", token.color || "#45e6ff");

        card.appendChild(createElement("div", "p6-map-card__number", String(token.code || "")));

        const core = createElement("div", "p6-map-card__core");
        const tokenImage = document.createElement("img");
        tokenImage.className = "p6-map-card__token";
        tokenImage.src = tokenSrc;
        tokenImage.alt = token.alt || `Token ${token.code || ""}`;
        core.appendChild(tokenImage);
        card.appendChild(core);

        grid.appendChild(card);
    });

    panel.appendChild(grid);
    media.appendChild(panel);
    return media;
}

function Puzzle8GridTransition(segment) {
    const media = createElement("div", "transition-screen__media transition-screen__media--puzzle8-grid");
    const stage = createElement("div", "p8-map-stage");

    const rounds = createElement("div", "p8-map-rounds");
    const activeRound = Number(segment.active_round || 1);
    [1, 2, 3].forEach((round) => {
        const card = createElement("div", "p8-map-round-card", round === 1 ? "I" : round === 2 ? "II" : "III");
        if (round < activeRound) {
            card.classList.add("is-complete");
        } else if (round === activeRound) {
            card.classList.add("is-active");
        }
        rounds.appendChild(card);
    });
    stage.appendChild(rounds);

    const wrap = createElement("div", "p8-map-grid-wrap");
    const grid = createElement("div", "p8-map-grid");
    const items = Array.isArray(segment.grid_items) ? segment.grid_items : [];

    for (let index = 0; index < 10; index += 1) {
        const frame = createElement("div", "p8-map-frame");
        const slot = createElement("div", "p8-map-slot");
        const item = items[index];

        if (item) {
            if (item.type === "number") {
                slot.appendChild(createElement("div", "p8-map-number", String(item.value || "")));
            }

            if (item.type === "symbol") {
                const symbol = createElement("div", "p8-map-symbol");
                symbol.style.setProperty("--p8-symbol-mask", `url('/static/images/puzzle8/${item.symbol}.svg')`);
                if (item.color) {
                    symbol.style.setProperty("--p8-item-color", item.color);
                }
                slot.appendChild(symbol);
            }
        }

        frame.appendChild(slot);
        grid.appendChild(frame);
    }

    wrap.appendChild(grid);
    stage.appendChild(wrap);
    media.appendChild(stage);
    return media;
}

function Puzzle9BoardTransition(segment) {
    const media = createElement("div", "transition-screen__media transition-screen__media--puzzle9-board");
    const board = createElement("div", "p9-map-board");
    const orbit = createElement("div", "p9-map-orbit");
    const tokenSrc = segment.token_src || "/static/images/puzzle1/tarjeta.png";
    const toneByIndex = ["tone-cyan", "tone-violet"];

    (segment.clues || []).forEach((clue, index) => {
        const card = createElement("article", `p9-map-clue-card ${toneByIndex[index % 2]}`);
        if (clue.position_class) {
            card.classList.add(clue.position_class);
        }

        if (clue.token != null) {
            const tokenWrap = createElement("span", "p9-map-clue-token");
            const tokenImage = document.createElement("img");
            tokenImage.className = "p9-map-clue-token-icon";
            tokenImage.src = tokenSrc;
            tokenImage.alt = "";
            tokenWrap.appendChild(tokenImage);
            tokenWrap.appendChild(createElement("span", "p9-map-clue-token-number", String(clue.token)));
            card.appendChild(tokenWrap);
        }

        card.appendChild(createElement("span", "p9-map-clue-copy", clue.text || ""));
        orbit.appendChild(card);
    });

    const centerStage = createElement("div", "p9-map-center-stage");
    const pyramidStage = createElement("div", "p9-map-pyramid-stage");
    const rows = Array.isArray(segment.rows) ? segment.rows : [];

    rows.forEach((row, rowIndex) => {
        const rowEl = createElement("div", `p9-map-row p9-map-row-${rowIndex + 1}`);
        row.forEach((box) => {
            const boxEl = createElement("div", "p9-map-box");
            boxEl.appendChild(createElement("span", "p9-map-box-id", String(box.id)));

            const tokenImage = document.createElement("img");
            tokenImage.className = "p9-map-token-icon";
            tokenImage.src = tokenSrc;
            tokenImage.alt = "Token";
            boxEl.appendChild(tokenImage);

            if (box.token != null) {
                boxEl.appendChild(createElement("span", "p9-map-token-value", String(box.token)));
                boxEl.classList.add("is-filled");
            } else {
                boxEl.appendChild(createElement("span", "p9-map-token-value", ""));
            }

            rowEl.appendChild(boxEl);
        });
        pyramidStage.appendChild(rowEl);
    });

    centerStage.appendChild(pyramidStage);
    board.appendChild(orbit);
    board.appendChild(centerStage);
    media.appendChild(board);
    return media;
}

function Puzzle10PatternsTransition(segment) {
    const media = createElement("div", "transition-screen__media transition-screen__media--puzzle10-patterns");
    const stage = createElement("div", "p10-map-stage");
    const header = createElement("div", "p10-map-header");
    const title = createElement("div", "p10-map-title", segment.title || "PATRONES OBJETIVO");
    const kicker = createElement("div", "p10-map-kicker", segment.kicker || "PANTALLA CENTRAL");
    const grid = createElement("div", "p10-map-grid");
    const patterns = Array.isArray(segment.patterns) ? segment.patterns : [];

    header.appendChild(kicker);
    header.appendChild(title);
    stage.appendChild(header);

    for (let index = 0; index < 10; index += 1) {
        const item = patterns[index] || {};
        const card = createElement("article", "p10-map-card");
        const boxLabel = createElement("div", "p10-map-card__box", String(item.box != null ? item.box : index));
        const frame = createElement("div", "p10-map-card__frame");
        const windowEl = createElement("div", "p10-map-card__window");
        const code = String(item.code || "000").padEnd(3, "0").slice(0, 3);

        for (const digit of code) {
            const segmentEl = createElement("div", `p10-map-segment color-${digit}`);
            windowEl.appendChild(segmentEl);
        }

        frame.appendChild(windowEl);
        card.appendChild(boxLabel);
        card.appendChild(frame);
        grid.appendChild(card);
    }

    stage.appendChild(grid);
    media.appendChild(stage);
    return media;
}

function GameMasterNetworkTransition(segment) {
    const media = createElement("div", "transition-screen__media transition-screen__media--gm-network");
    const stage = createElement("div", "gm-stage gm-stage--network");
    const skyline = createElement("div", "gm-network-skyline");
    const nodes = createElement("div", "gm-network-nodes");
    const copy = createElement("div", "gm-copy-block");

    for (let index = 0; index < 18; index += 1) {
        const pillar = createElement("span", "gm-network-pillar");
        pillar.style.setProperty("--gm-pillar-x", `${(index / 17) * 100}%`);
        pillar.style.setProperty("--gm-pillar-h", `${30 + (index % 6) * 9}%`);
        skyline.appendChild(pillar);
    }

    for (let index = 0; index < 12; index += 1) {
        const node = createElement("span", "gm-network-node");
        node.style.setProperty("--gm-node-x", `${10 + ((index * 7) % 80)}%`);
        node.style.setProperty("--gm-node-y", `${14 + ((index * 11) % 64)}%`);
        nodes.appendChild(node);
    }

    if (segment.kicker) {
        copy.appendChild(createElement("div", "gm-copy-block__kicker", segment.kicker));
    }
    if (segment.title) {
        copy.appendChild(createElement("div", "gm-copy-block__title", segment.title));
    }
    if (segment.text) {
        copy.appendChild(createElement("div", "gm-copy-block__text", segment.text));
    }

    stage.appendChild(skyline);
    stage.appendChild(nodes);
    stage.appendChild(copy);
    media.appendChild(stage);
    return media;
}

function GameMasterPyramidTransition(segment) {
    const media = createElement("div", "transition-screen__media transition-screen__media--gm-pyramid");
    const stage = createElement("div", "gm-stage gm-stage--pyramid");
    const pyramid = createElement("div", "gm-pyramid-mark");
    const copy = createElement("div", "gm-copy-block gm-copy-block--center");

    pyramid.appendChild(createElement("div", "gm-pyramid-mark__core"));

    if (segment.kicker) {
        copy.appendChild(createElement("div", "gm-copy-block__kicker", segment.kicker));
    }
    if (segment.title) {
        copy.appendChild(createElement("div", "gm-copy-block__title", segment.title));
    }
    if (segment.text) {
        copy.appendChild(createElement("div", "gm-copy-block__text", segment.text));
    }

    stage.appendChild(pyramid);
    stage.appendChild(copy);
    media.appendChild(stage);
    return media;
}

function GameMasterTerminalTransition(segment) {
    const media = createElement("div", "transition-screen__media transition-screen__media--gm-terminal");
    const stage = createElement("div", "gm-stage gm-stage--terminal");
    const terminalWrap = createElement("div", "gm-terminal-wrap");
    const terminal = document.createElement("img");
    const token = document.createElement("img");
    const badges = createElement("div", "gm-terminal-badges");
    const copy = createElement("div", "gm-copy-block");

    terminal.className = "gm-terminal-wrap__terminal";
    terminal.src = segment.terminal_src || "/static/images/shared/terminal_3d/terminal_box_perspective_hero_white.png";
    terminal.alt = segment.terminal_alt || "Terminal";

    token.className = "gm-terminal-wrap__token";
    token.src = segment.token_src || "/static/images/shared/terminal_3d/token_pyramid_neon.png";
    token.alt = segment.token_alt || "Token";

    terminalWrap.appendChild(terminal);
    terminalWrap.appendChild(token);

    (segment.badges || []).forEach((badgeText) => {
        badges.appendChild(createElement("div", "gm-terminal-badge", badgeText));
    });

    if (segment.kicker) {
        copy.appendChild(createElement("div", "gm-copy-block__kicker", segment.kicker));
    }
    if (segment.title) {
        copy.appendChild(createElement("div", "gm-copy-block__title", segment.title));
    }
    if (segment.text) {
        copy.appendChild(createElement("div", "gm-copy-block__text", segment.text));
    }

    stage.appendChild(terminalWrap);
    stage.appendChild(badges);
    stage.appendChild(copy);
    media.appendChild(stage);
    return media;
}

function normalizeSubtitles(scene) {
    return Array.isArray(scene.subtitles)
        ? scene.subtitles
            .map((subtitle) => ({
                ...subtitle,
                start: Number(subtitle.start || 0),
                end: Number(subtitle.end || 0),
            }))
            .filter((subtitle) => subtitle.end > subtitle.start && subtitle.text)
        : [];
}

function normalizeScene(scene) {
    let accumulated = 0;
    const uiTitles = {
        top: scene.ui_titles?.top || "OBJETIVO",
        left: scene.ui_titles?.left || "ELEMENTOS",
        right: scene.ui_titles?.right || "ATENCIÓN",
    };

    const segments = (scene.segments || []).map((segment) => {
        const segmentWithTitles = segment.type === "fullscreen_ui"
            ? withUiTitles(segment, uiTitles)
            : segment;
        let durationSeconds = Number(segment.duration || 0);

        if (segmentWithTitles.type === "character") {
            durationSeconds = segmentWithTitles.duration != null
                ? Number(segmentWithTitles.duration)
                : Math.max(0, Number(segmentWithTitles.clip_end || 0) - Number(segmentWithTitles.clip_start || 0));
        }

        if (segmentWithTitles.type === "fullscreen_ui" || segmentWithTitles.type === "transition") {
            durationSeconds = Number(segmentWithTitles.duration || 0);
        }

        if (durationSeconds <= 0) {
            throw new Error(`Segment invalid sense durada: ${segmentWithTitles.type}`);
        }

        const normalized = {
            ...segmentWithTitles,
            durationSeconds,
            timelineStart: accumulated,
            timelineEnd: accumulated + durationSeconds,
        };

        accumulated += durationSeconds;
        return normalized;
    });

    return {
        ...scene,
        ui_titles: uiTitles,
        durationSeconds: accumulated,
        segments,
        subtitles: normalizeSubtitles(scene),
    };
}

function applyBroadcastOverlay(segment) {
    if (!elements.broadcastOverlay) {
        return;
    }

    const leftBrand = elements.broadcastOverlay.querySelector(".broadcast-overlay__brand--left");
    const rightBrand = elements.broadcastOverlay.querySelector(".broadcast-overlay__brand--right");
    const eyebrow = elements.broadcastOverlay.querySelector(".broadcast-overlay__eyebrow");
    const logo = elements.broadcastOverlayLogo;
    const broadcast = segment.broadcast || {};

    leftBrand?.classList.remove("hidden");
    rightBrand?.classList.remove("hidden");

    if (eyebrow) {
        eyebrow.textContent = broadcast.eyebrow || "Organización ADN";
        eyebrow.classList.toggle("hidden", broadcast.show_eyebrow === false);
    }

    if (logo) {
        if (broadcast.logo_src) {
            logo.src = broadcast.logo_src;
            logo.classList.remove("hidden");
        } else {
            logo.removeAttribute("src");
            logo.classList.add("hidden");
        }
    }

    leftBrand?.classList.toggle("broadcast-overlay__brand--compact", Boolean(broadcast.logo_src) && broadcast.show_eyebrow === false);
    rightBrand?.classList.toggle("hidden", broadcast.show_right_brand === false);
}

class ScenePlayer {
    constructor(scene) {
        this.scene = normalizeScene(scene);
        this.segments = this.scene.segments;
        this.currentSegmentIndex = 0;
        this.segmentElapsed = 0;
        this.segmentStartedAt = 0;
        this.playing = false;
        this.rafId = null;
        this.activePhaseKey = "";
        this.activePhaseIndex = -1;
        this.activeSubtitleKey = "";
        this.fullscreenPanelState = null;
        this.audioContext = null;
        this.nextUrl = resolveNextUrl();
        this.onComplete = resolveOnComplete();
        this.completionHandled = false;

        this.tick = this.tick.bind(this);
        this.onVideoTimeUpdate = this.onVideoTimeUpdate.bind(this);
        this.onVideoEnded = this.onVideoEnded.bind(this);
    }

    updateSubtitleOverlay() {
        if (!elements.subtitleOverlay) {
            return;
        }

        const now = this.getSceneTime();
        const subtitle = this.scene.subtitles.find((item) => now >= item.start && now < item.end);
        const nextKey = subtitle ? `${subtitle.start}-${subtitle.end}-${subtitle.text}` : "";

        if (nextKey === this.activeSubtitleKey) {
            return;
        }

        this.activeSubtitleKey = nextKey;

        if (!subtitle) {
            elements.subtitleOverlay.classList.remove("subtitle-overlay--visible");
            return;
        }

        elements.subtitleOverlay.textContent = subtitle.text;
        elements.subtitleOverlay.classList.remove("hidden");
        elements.subtitleOverlay.classList.remove("subtitle-overlay--visible");
        void elements.subtitleOverlay.offsetWidth;
        elements.subtitleOverlay.classList.add("subtitle-overlay--visible");
    }

    hasMasterAudio() {
        return Boolean(this.scene.audio?.src);
    }

    async init() {
        elements.video.muted = true;
        elements.video.playsInline = true;
        elements.video.addEventListener("timeupdate", this.onVideoTimeUpdate);
        elements.video.addEventListener("ended", this.onVideoEnded);

        if (this.scene.audio?.src) {
            elements.audio.src = this.scene.audio.src;
            elements.audio.load();
        }

        if (this.segments.length === 0) {
            throw new Error("La escena no te segments.");
        }

        this.renderSegment();
        this.updateStatus();
        this.hideBootOverlay();
        await this.play();
    }

    ensureAudioContext() {
        if (this.audioContext || typeof window.AudioContext === "undefined") {
            return this.audioContext;
        }

        this.audioContext = new window.AudioContext();
        return this.audioContext;
    }

    playUiSfx(type = "pulse") {
        const ctx = this.ensureAudioContext();
        if (!ctx) {
            return;
        }

        if (ctx.state === "suspended") {
            ctx.resume().catch(() => {});
        }

        const now = ctx.currentTime;
        const output = ctx.createGain();
        output.connect(ctx.destination);
        output.gain.setValueAtTime(0.0001, now);

        const oscA = ctx.createOscillator();
        const gainA = ctx.createGain();
        oscA.connect(gainA);
        gainA.connect(output);

        const oscB = ctx.createOscillator();
        const gainB = ctx.createGain();
        oscB.connect(gainB);
        gainB.connect(output);

        let config = {
            aFreq: [440, 520],
            bFreq: [660, 740],
            duration: 0.12,
            gain: 0.04,
            waveA: "triangle",
            waveB: "sine",
        };

        if (type === "objective") {
            config = {
                aFreq: [260, 360],
                bFreq: [520, 680],
                duration: 0.22,
                gain: 0.045,
                waveA: "triangle",
                waveB: "sine",
            };
        } else if (type === "token") {
            config = {
                aFreq: [720, 920],
                bFreq: [980, 1200],
                duration: 0.09,
                gain: 0.032,
                waveA: "sine",
                waveB: "triangle",
            };
        } else if (type === "warning") {
            config = {
                aFreq: [170, 140],
                bFreq: [280, 220],
                duration: 0.26,
                gain: 0.055,
                waveA: "sawtooth",
                waveB: "triangle",
            };
        } else if (type === "final") {
            config = {
                aFreq: [330, 440],
                bFreq: [660, 880],
                duration: 0.28,
                gain: 0.042,
                waveA: "triangle",
                waveB: "sine",
            };
        }

        oscA.type = config.waveA;
        oscB.type = config.waveB;
        oscA.frequency.setValueAtTime(config.aFreq[0], now);
        oscA.frequency.exponentialRampToValueAtTime(config.aFreq[1], now + config.duration);
        oscB.frequency.setValueAtTime(config.bFreq[0], now);
        oscB.frequency.exponentialRampToValueAtTime(config.bFreq[1], now + config.duration);

        gainA.gain.setValueAtTime(config.gain, now);
        gainA.gain.exponentialRampToValueAtTime(0.0001, now + config.duration);
        gainB.gain.setValueAtTime(config.gain * 0.42, now);
        gainB.gain.exponentialRampToValueAtTime(0.0001, now + config.duration);
        output.gain.setValueAtTime(0.0001, now);
        output.gain.exponentialRampToValueAtTime(1, now + 0.01);
        output.gain.exponentialRampToValueAtTime(0.0001, now + config.duration + 0.04);

        oscA.start(now);
        oscB.start(now);
        oscA.stop(now + config.duration + 0.05);
        oscB.stop(now + config.duration + 0.05);
    }

    playPhaseSfx(segment, elapsedSeconds) {
        const phase = getActivePhase(segment, elapsedSeconds);
        const phaseIndex = phase?._phaseIndex ?? -1;

        if (phaseIndex === this.activePhaseIndex) {
            return;
        }

        this.activePhaseIndex = phaseIndex;

        if (!phase) {
            return;
        }

        this.playUiSfx(phase.sfx || segment.sfx || "pulse");
    }

    destroy() {
        cancelAnimationFrame(this.rafId);
        elements.video.pause();
        elements.audio.pause();
        elements.video.removeEventListener("timeupdate", this.onVideoTimeUpdate);
        elements.video.removeEventListener("ended", this.onVideoEnded);
    }

    get currentSegment() {
        return this.segments[this.currentSegmentIndex];
    }

    setBootMessage(title, text) {
        if (elements.bootTitle) {
            elements.bootTitle.textContent = title;
        }

        if (elements.bootText) {
            elements.bootText.textContent = text;
        }
    }

    hideBootOverlay() {
        elements.bootOverlay.classList.add("hidden");
    }

    showBootOverlay(title, text) {
        this.setBootMessage(title, text);
    }

    getSceneTime() {
        if (this.hasMasterAudio()) {
            return elements.audio.currentTime || 0;
        }

        return this.currentSegment.timelineStart + this.segmentElapsed;
    }

    async play() {
        this.hideBootOverlay();
        this.playing = true;
        this.segmentStartedAt = performance.now();
        await this.syncMedia(true);

        if (this.currentSegment.type !== "character") {
            this.startTicking();
        }
    }

    pause() {
        if (!this.playing) {
            return;
        }

        this.captureSegmentElapsed();
        this.playing = false;
        cancelAnimationFrame(this.rafId);
        elements.video.pause();
        elements.audio.pause();
    }

    captureSegmentElapsed() {
        if (!this.segmentStartedAt) {
            return;
        }

        const delta = (performance.now() - this.segmentStartedAt) / 1000;
        this.segmentElapsed = Math.min(this.currentSegment.durationSeconds, this.segmentElapsed + delta);
        this.segmentStartedAt = 0;
    }

    async togglePlayback() {
        if (this.playing) {
            this.pause();
            return;
        }

        await this.play();
    }

    async restart() {
        this.pause();
        this.completionHandled = false;
        this.currentSegmentIndex = 0;
        this.segmentElapsed = 0;
        this.renderSegment();
        this.updateStatus();
        await this.syncMedia(false);
        this.showBootOverlay(this.scene.scene_id, "Escena reiniciada. Prem espai per reproduir la nova base.");
    }

    async skipSegment() {
        if (this.currentSegmentIndex >= this.segments.length - 1) {
            this.showBootOverlay("Escena completada", "Has arribat a l'ultim segment. Prem R per reiniciar.");
            return;
        }

        const wasPlaying = this.playing;
        this.pause();
        await this.transitionToSegment(this.currentSegmentIndex + 1, { autoplay: wasPlaying, preserveAudio: false });
    }

    async advanceSegment() {
        if (this.currentSegmentIndex >= this.segments.length - 1) {
            this.pause();
            this.handleSceneCompletion();
            return;
        }

        const wasPlaying = this.playing;
        await this.transitionToSegment(this.currentSegmentIndex + 1, {
            autoplay: wasPlaying,
            preserveAudio: wasPlaying && this.hasMasterAudio(),
        });
    }

    handleSceneCompletion() {
        if (this.completionHandled) {
            return;
        }

        this.completionHandled = true;

        if (this.nextUrl) {
            window.setTimeout(() => {
                window.location.href = this.nextUrl;
            }, 180);
            return;
        }

        if (this.onComplete === "blackout") {
            elements.video.classList.add("hidden");
            elements.uiLayer.classList.add("hidden");
            elements.transitionLayer.classList.add("hidden");
            elements.subtitleOverlay.classList.add("hidden");
            elements.broadcastOverlay?.classList.add("hidden");
            if (elements.playerRoot) {
                elements.playerRoot.style.background = "#000";
            }
            return;
        }

        this.showBootOverlay("Escena completada", "Tots els segments s'han reproduit. Prem R per tornar a començar.");
    }

    async transitionToSegment(nextIndex, { autoplay = false, preserveAudio = false } = {}) {
        if (nextIndex < 0 || nextIndex >= this.segments.length) {
            return;
        }

        if (this.playing) {
            this.captureSegmentElapsed();
        }

        cancelAnimationFrame(this.rafId);
        elements.video.pause();

        if (!preserveAudio) {
            elements.audio.pause();
        }

        this.playing = autoplay;
        this.currentSegmentIndex = nextIndex;
        this.segmentElapsed = 0;
        this.segmentStartedAt = autoplay ? performance.now() : 0;
        this.renderSegment();
        this.updateStatus();
        await this.syncMedia(autoplay, { preserveAudio });

        if (autoplay && this.currentSegment.type !== "character") {
            this.startTicking();
        }
    }

    renderSegment() {
        const segment = this.currentSegment;
        this.activePhaseKey = "";
        this.activePhaseIndex = -1;
        this.activeSubtitleKey = "";
        this.fullscreenPanelState = null;

        elements.uiLayer.innerHTML = "";
        elements.transitionLayer.innerHTML = "";
        elements.uiLayer.classList.remove("layer-visible");
        elements.transitionLayer.classList.remove("layer-visible");
        elements.video.classList.remove("scene-video--hidden", "scene-video--reveal");
        elements.playerRoot?.classList.remove("player-root--broadcast", "player-root--character-feed");
        elements.broadcastOverlay?.classList.add("hidden");

        if (segment.type === "character") {
            elements.playerRoot?.classList.add("player-root--broadcast");
            elements.playerRoot?.classList.add("player-root--character-feed");
            elements.broadcastOverlay?.classList.remove("hidden");
            applyBroadcastOverlay(segment);
            void elements.video.offsetWidth;
            elements.video.classList.add("scene-video--reveal");
            return;
        }

        elements.video.classList.add("scene-video--hidden");

        if (segment.type === "fullscreen_ui") {
            elements.uiLayer.classList.remove("hidden");
            this.fullscreenPanelState = createFullscreenPanel(this.segments, this.currentSegmentIndex, this.segmentElapsed);
            elements.uiLayer.appendChild(this.fullscreenPanelState.screen);
            this.activePhaseKey = this.getPhaseKey(segment, this.segmentElapsed);
            this.playPhaseSfx(segment, this.segmentElapsed);
            requestAnimationFrame(() => elements.uiLayer.classList.add("layer-visible"));
            return;
        }

        if (segment.type === "transition") {
            elements.transitionLayer.classList.remove("hidden");
            elements.transitionLayer.appendChild(TransitionScreen(segment));
            requestAnimationFrame(() => elements.transitionLayer.classList.add("layer-visible"));
        }
    }

    updateStatus() {
        if (elements.segmentStatus) {
            elements.segmentStatus.textContent = `${this.currentSegmentIndex + 1} / ${this.segments.length}`;
        }
    }

    getPhaseKey(segment, elapsedSeconds) {
        const content = mergeAccumulatedUiState(this.segments, this.currentSegmentIndex, elapsedSeconds);
        return [
            content.variant || "",
            JSON.stringify(content.top || {}),
            JSON.stringify(content.left || {}),
            JSON.stringify(content.right || {}),
            content.subtitle || "",
        ].join("|");
    }

    async syncMedia(autoplay, { preserveAudio = false } = {}) {
        const segment = this.currentSegment;
        const sceneTime = preserveAudio && this.hasMasterAudio()
            ? this.getSceneTime()
            : segment.timelineStart + this.segmentElapsed;

        if (this.scene.audio?.src && !preserveAudio) {
            elements.audio.currentTime = sceneTime;
        }

        if (segment.type === "character") {
            const elapsedInSegment = this.hasMasterAudio()
                ? Math.max(0, sceneTime - segment.timelineStart)
                : this.segmentElapsed;
            const clipTime = Number(segment.clip_start || 0) + elapsedInSegment;

            if (elements.video.dataset.src !== segment.src) {
                elements.video.src = segment.src;
                elements.video.dataset.src = segment.src;
                elements.video.load();
            }

            elements.video.currentTime = clipTime;
        } else {
            elements.video.pause();
        }

        if (!autoplay) {
            return;
        }

        try {
            if (this.scene.audio?.src && (!preserveAudio || elements.audio.paused)) {
                await elements.audio.play();
            }

            if (segment.type === "character") {
                await elements.video.play();
            }
        } catch (error) {
            elements.video.pause();
            elements.audio.pause();
            this.playing = false;
            this.showBootOverlay("Reproduccio bloquejada", "El navegador necessita una interaccio de l'usuari. Prem espai o fes clic per continuar.");
        }
    }

    startTicking() {
        cancelAnimationFrame(this.rafId);
        this.rafId = requestAnimationFrame(this.tick);
    }

    tick(now) {
        if (!this.playing) {
            return;
        }

        if (!this.segmentStartedAt) {
            this.segmentStartedAt = now;
        }

        const elapsed = this.hasMasterAudio()
            ? Math.max(0, this.getSceneTime() - this.currentSegment.timelineStart)
            : this.segmentElapsed + ((now - this.segmentStartedAt) / 1000);

        this.updateSubtitleOverlay();

        if (this.currentSegment.type === "fullscreen_ui") {
            const phaseKey = this.getPhaseKey(this.currentSegment, elapsed);
            if (phaseKey !== this.activePhaseKey) {
                if (this.fullscreenPanelState) {
                    updateFullscreenPanel(this.fullscreenPanelState, this.segments, this.currentSegmentIndex, elapsed);
                }
                this.activePhaseKey = phaseKey;
                this.playPhaseSfx(this.currentSegment, elapsed);
            }
        }

        if (elapsed >= this.currentSegment.durationSeconds) {
            this.advanceSegment();
            return;
        }

        this.rafId = requestAnimationFrame(this.tick);
    }

    onVideoTimeUpdate() {
        if (!this.playing || this.currentSegment.type !== "character") {
            return;
        }

        this.updateSubtitleOverlay();

        const elapsed = this.hasMasterAudio()
            ? Math.max(0, this.getSceneTime() - this.currentSegment.timelineStart)
            : elements.video.currentTime - Number(this.currentSegment.clip_start || 0);

        if (elapsed >= this.currentSegment.durationSeconds - EPSILON) {
            this.advanceSegment();
        }
    }

    onVideoEnded() {
        if (this.playing && this.currentSegment.type === "character") {
            this.advanceSegment();
        }
    }
}

async function loadScene(sceneId) {
    const response = await fetch(`/scenes/${sceneId}/config.json`, { cache: "no-store" });
    if (!response.ok) {
        throw new Error(`No s'ha pogut carregar la configuracio de l'escena: ${sceneId}`);
    }
    return response.json();
}

let playerInstance;

async function bootstrap() {
    const sceneId = resolveSceneId();
    if (elements.sceneId) {
        elements.sceneId.textContent = sceneId;
    }

    try {
        const scene = await loadScene(sceneId);
        playerInstance = new ScenePlayer(scene);
        await playerInstance.init();
    } catch (error) {
        console.error(error);
        if (elements.bootOverlay) {
            elements.bootOverlay.classList.remove("hidden");
            elements.bootOverlay.innerHTML = `
                <div class="boot-card">
                    <p class="boot-kicker">Player Error</p>
                    <h2>Error cargando escena</h2>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }
}

document.addEventListener("keydown", async (event) => {
    if (!playerInstance) {
        return;
    }

    if (event.code === "Space") {
        event.preventDefault();
        await playerInstance.togglePlayback();
        return;
    }

    if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        await playerInstance.restart();
        return;
    }

    if (event.key === "ArrowRight") {
        event.preventDefault();
        await playerInstance.skipSegment();
    }
});

elements.bootOverlay.addEventListener("click", async () => {
    if (!playerInstance) {
        return;
    }

    elements.bootOverlay.classList.add("hidden");
    await playerInstance.play();
});

window.addEventListener("beforeunload", () => {
    playerInstance?.destroy();
});

bootstrap();
