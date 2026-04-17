const DEFAULT_SCENE_ID = "scene_intro_sumas";
const EPSILON = 0.12;
const SAFE_NEXT_GRACE_SECONDS = 0.45;
const STALL_THRESHOLD_MS = 2500;
const STALL_RECOVERY_COOLDOWN_MS = 1800;
let briefContentCatalog = {};
const SCENE_OVERLAY_TITLES = {
    scene_intro_simulacro: "Simulacro Inicial",
    scene_intro_sumas: "Cálculo Extremo",
    scene_intro_laberinto: "Núcleo del Laberinto",
    scene_intro_trivial: "Mente Colmena",
    scene_intro_musica: "Código Sonoro",
    scene_intro_cronometro: "Pulso de Tiempo",
    scene_intro_energia: "Carga Crítica",
    scene_intro_memory: "Memoria Fantasma",
    scene_intro_token_a_lloc: "Arquitectos del Orden",
    scene_intro_segments: "Patrón Maestro",
};

const elements = {
    playerRoot: document.getElementById("player-root"),
    video: document.getElementById("scene-video"),
    audio: document.getElementById("scene-audio"),
    broadcastOverlay: document.getElementById("broadcast-overlay"),
    broadcastOverlayLogo: document.getElementById("broadcast-overlay-logo"),
    uiLayer: document.getElementById("ui-layer"),
    transitionLayer: document.getElementById("transition-layer"),
    subtitleOverlay: document.getElementById("subtitle-overlay"),
    persistentElementsStrip: document.getElementById("persistent-elements-strip"),
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

function resolveNextSceneId() {
    const next = resolveNextUrl();
    if (!next) {
        return "";
    }

    try {
        const nextUrl = new URL(next, window.location.origin);
        return nextUrl.searchParams.get("scene") || "";
    } catch (error) {
        return "";
    }
}

function resolveIntroBriefOverrides() {
    const params = new URLSearchParams(window.location.search);
    return {
        progress: params.get("brief_progress"),
        kicker: params.get("brief_kicker"),
        title: params.get("brief_title"),
        objective: params.get("brief_objective"),
        evaluation: params.get("brief_evaluation"),
        cta: params.get("brief_cta"),
        betweenTitle: params.get("between_title"),
    };
}

const introBriefOverrides = resolveIntroBriefOverrides();
const nextSceneId = resolveNextSceneId();

function getBriefContentForNextScene() {
    if (!nextSceneId) {
        return {};
    }
    const entry = briefContentCatalog[nextSceneId];
    return entry && typeof entry === "object" ? entry : {};
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

function getAssetItemKey(asset = {}) {
    return JSON.stringify({
        src: asset.src || "",
        label: asset.label || "",
        text: asset.text || "",
    });
}

function AssetCard(asset = {}) {
    const card = createElement("article", "asset-card");
    card.dataset.itemKey = getAssetItemKey(asset);
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

    return card;
}

function AssetsGrid(assets = [], { showEquals = false } = {}) {
    const grid = createElement("div", "asset-grid");
    const iconOnly = assets.every((asset) => !asset.label && !asset.text);

    if (iconOnly) {
        grid.classList.add("asset-grid--icons");
        grid.classList.add(`asset-grid--icons-${assets.length}`);
        grid.classList.toggle("asset-grid--with-equals", Boolean(showEquals && assets.length === 2));
    }

    assets.forEach((asset) => {
        grid.appendChild(AssetCard(asset));
    });

    return grid;
}

function updateAssetGridClasses(grid, assets = []) {
    const iconOnly = assets.every((asset) => !asset.label && !asset.text);
    grid.classList.toggle("asset-grid--icons", iconOnly);
    Array.from(grid.classList).forEach((className) => {
        if (className.startsWith("asset-grid--icons-")) {
            grid.classList.remove(className);
        }
    });
    if (iconOnly) {
        grid.classList.add(`asset-grid--icons-${assets.length}`);
    }
}

function createPersistentStripAssetItem(asset = {}) {
    const item = createElement("article", "persistent-elements-strip__item");
    const media = createElement("div", "persistent-elements-strip__media");
    const image = document.createElement("img");
    image.className = "persistent-elements-strip__image";
    image.src = asset.src || "";
    image.alt = asset.alt || asset.label || "";
    media.appendChild(image);
    item.appendChild(media);
    return item;
}

function updatePersistentStripAssets(row, assets = []) {
    if (!row) {
        return;
    }

    row.replaceChildren();
    assets.forEach((asset) => {
        row.appendChild(createPersistentStripAssetItem(asset));
    });
}

function createPersistentStripTextBlock({ key = "", label = "", value = "", valueClass = "" } = {}) {
    const block = createElement("section", "persistent-elements-strip__block persistent-elements-strip__block--pending");
    block.dataset.blockKey = key;
    if (label) {
        block.appendChild(createElement("p", "persistent-elements-strip__block-label", label));
    }
    if (value) {
        const className = valueClass
            ? `persistent-elements-strip__block-value ${valueClass}`
            : "persistent-elements-strip__block-value";
        block.appendChild(createElement("p", className, value));
    }
    return block;
}

function updatePersistentStripBlockVisibility(state, sceneTimeSeconds = 0) {
    if (!state?.blocks) {
        return;
    }

    Object.entries(state.blocks).forEach(([key, block]) => {
        if (!block) {
            return;
        }

        const revealAt = Number(state.revealAt?.[key] ?? 0);
        const shouldShow = sceneTimeSeconds >= revealAt;
        block.classList.toggle("persistent-elements-strip__block--visible", shouldShow);
        block.classList.toggle("persistent-elements-strip__block--pending", !shouldShow);
    });
}

function PersistentElementsStrip({
    kicker = "",
    title = "",
    objective = "",
    assetsTitle = "",
    warning = "",
    warningLabel = "ATENCION",
    revealAt = {},
} = {}) {
    const strip = createElement("div", "persistent-elements-strip__inner");
    const summaryBlock = createElement("section", "persistent-elements-strip__block persistent-elements-strip__block--pending");
    summaryBlock.dataset.blockKey = "summary";
    summaryBlock.appendChild(createElement("p", "persistent-elements-strip__block-label", "NIVEL"));
    if (kicker) {
        summaryBlock.appendChild(createElement("p", "persistent-elements-strip__kicker", kicker));
    }
    if (title) {
        summaryBlock.appendChild(createElement("p", "persistent-elements-strip__title", title));
    }
    const objectiveBlock = createPersistentStripTextBlock({
        key: "objective",
        label: "OBJETIVO",
        value: objective,
        valueClass: "persistent-elements-strip__objective",
    });
    const assetsBlock = createElement("section", "persistent-elements-strip__block persistent-elements-strip__block--pending");
    assetsBlock.dataset.blockKey = "assets";
    const warningBlock = createPersistentStripTextBlock({
        key: "warning",
        label: warningLabel,
        value: warning,
        valueClass: "persistent-elements-strip__warning",
    });
    const row = createElement("div", "persistent-elements-strip__row");

    if (assetsTitle) {
        assetsBlock.appendChild(createElement("p", "persistent-elements-strip__assets-title", assetsTitle));
    }
    assetsBlock.appendChild(row);

    strip.appendChild(summaryBlock);
    strip.appendChild(objectiveBlock);
    strip.appendChild(assetsBlock);
    strip.appendChild(warningBlock);

    return {
        strip,
        row,
        revealAt: {
            summary: Number(revealAt.summary ?? revealAt.kicker ?? revealAt.title ?? 0),
            objective: Number(revealAt.objective ?? 0),
            assets: Number(revealAt.assets ?? 0),
            warning: Number(revealAt.warning ?? revealAt.attention ?? 0),
        },
        blocks: {
            summary: summaryBlock,
            objective: objectiveBlock,
            assets: assetsBlock,
            warning: warningBlock,
        },
    };
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
        const shouldShowEquals = Boolean(zone.show_equals && zone.assets.length === 2);
        if (!currentAssets) {
            const nextGrid = AssetsGrid(zone.assets, { showEquals: shouldShowEquals });
            card.appendChild(nextGrid);
            didReplaceWholeZone = true;
            if (animate) {
                nextGrid.classList.add("asset-grid--enter");
            }
        } else {
            const currentItems = Array.from(currentAssets.querySelectorAll(".asset-card"));
            const currentKeys = currentItems.map((item) => item.dataset.itemKey || "");
            const nextKeys = zone.assets.map((asset) => getAssetItemKey(asset));
            const prefixMatches = currentKeys.every((key, index) => key === nextKeys[index]);
            updateAssetGridClasses(currentAssets, zone.assets);
            currentAssets.classList.toggle("asset-grid--with-equals", shouldShowEquals);

            if (currentKeys.length === nextKeys.length) {
                zone.assets.forEach((asset, index) => {
                    if (currentKeys[index] === nextKeys[index]) {
                        return;
                    }
                    const nextCard = AssetCard(asset);
                    if (animate) {
                        nextCard.classList.add("asset-card--enter");
                    }
                    currentItems[index]?.replaceWith(nextCard);
                });
            } else if (!prefixMatches || currentKeys.length > nextKeys.length) {
                const nextGrid = AssetsGrid(zone.assets, { showEquals: shouldShowEquals });
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

    if (segment.variant === "gm-hybrid") {
        screen.appendChild(GameMasterHybridTransition(segment));
        return screen;
    }

    if (segment.variant === "intro-brief") {
        screen.appendChild(IntroBriefTransition(segment));
        return screen;
    }

    const transitionLabel = segment.variant === "between-title"
        ? (introBriefOverrides.betweenTitle ?? segment.label)
        : segment.label;
    const labelInsideMedia = Boolean(segment.image && transitionLabel && segment.variant === "maze");

    if (segment.video) {
        const media = createElement("div", "transition-screen__media");
        if (labelInsideMedia) {
            media.appendChild(
                createElement("div", "transition-screen__media-label", transitionLabel),
            );
        }

        const video = createTransitionVideoElement(segment, "transition-screen__video");

        media.appendChild(video);
        screen.appendChild(media);
    } else if (segment.image) {
        const media = createElement("div", "transition-screen__media");
        if (labelInsideMedia) {
            media.appendChild(
                createElement("div", "transition-screen__media-label", transitionLabel),
            );
        }
        const image = document.createElement("img");
        image.className = "transition-screen__image";
        image.src = segment.image;
        image.alt = segment.alt || segment.label || "Transition";
        media.appendChild(image);
        screen.appendChild(media);
    }

    if (transitionLabel && !labelInsideMedia) {
        screen.appendChild(createElement("div", "transition-screen__label", transitionLabel));
    }
    return screen;
}

function IntroBriefTransition(segment) {
    const briefContent = getBriefContentForNextScene();
    const kickerText = briefContent.kicker ?? introBriefOverrides.kicker ?? segment.kicker ?? "";
    const titleText = briefContent.title ?? introBriefOverrides.title ?? segment.title ?? "";
    const objectiveText = briefContent.objective ?? introBriefOverrides.objective ?? segment.objective ?? "";
    const evaluationText = briefContent.evaluation ?? introBriefOverrides.evaluation ?? segment.evaluation ?? "";
    const ctaText = briefContent.cta ?? introBriefOverrides.cta ?? segment.cta ?? "";

    const media = createElement("div", "transition-screen__media transition-screen__media--intro-brief");
    const card = createElement("section", "intro-brief-card");
    const content = createElement("div", "intro-brief-card__content");
    const header = createElement("div", "intro-brief-card__header");
    const details = createElement("div", "intro-brief-card__grid");

    if (kickerText) {
        header.appendChild(createElement("p", "intro-brief-card__kicker", kickerText));
    }

    if (header.children.length > 0) {
        content.appendChild(header);
    }

    if (titleText) {
        content.appendChild(createElement("h2", "intro-brief-card__title", titleText));
    }

    if (objectiveText) {
        const objectiveBlock = createElement("article", "intro-brief-block intro-brief-block--objective");
        objectiveBlock.appendChild(createElement("h3", "intro-brief-block__title", "OBJETIVO"));
        objectiveBlock.appendChild(createElement("p", "intro-brief-block__text", objectiveText));
        details.appendChild(objectiveBlock);
    }

    if (evaluationText) {
        const evaluationBlock = createElement("article", "intro-brief-block intro-brief-block--evaluation");
        evaluationBlock.appendChild(createElement("h3", "intro-brief-block__title", "EVALUACION"));
        evaluationBlock.appendChild(createElement("p", "intro-brief-block__text", evaluationText));
        details.appendChild(evaluationBlock);
    }

    if (details.children.length > 0) {
        content.appendChild(details);
    }

    if (ctaText) {
        content.appendChild(createElement("p", "intro-brief-card__cta", ctaText));
    }

    card.appendChild(content);
    media.appendChild(card);
    return media;
}

function createTransitionVideoElement(segment, className = "transition-screen__video") {
    const video = document.createElement("video");
    const clipStart = Number(segment.clip_start || 0);
    const clipEnd = segment.clip_end != null ? Number(segment.clip_end) : null;
    const hasClippedWindow = clipEnd != null && clipEnd - clipStart > EPSILON;
    const canUseNativeLoop = Boolean(segment.loopsMedia && clipStart <= EPSILON && !hasClippedWindow);
    video.className = className;
    video.src = segment.video;
    video.muted = true;
    video.autoplay = true;
    video.loop = canUseNativeLoop;
    video.playsInline = true;
    video.preload = "auto";

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

    if (!canUseNativeLoop) {
        attachSegmentVideoLoop(video, segment);
    }
    return video;
}

function Puzzle6TokenMap(segment) {
    const media = createElement("div", "transition-screen__media transition-screen__media--puzzle6-token-map");
    const panel = createElement("div", "p6-map-panel");
    const grid = createElement("div", "p6-map-grid");
    const tokenSrc = segment.token_src || "/static/images/shared/gameplay/token_card.png";
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
    const tokenSrc = segment.token_src || "/static/images/shared/gameplay/token_card.png";
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
    terminal.src = segment.terminal_src || "/static/images/shared/gameplay/terminal_box.png";
    terminal.alt = segment.terminal_alt || "Terminal";

    token.className = "gm-terminal-wrap__token";
    token.src = segment.token_src || "/static/images/shared/gameplay/token_card.png";
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

function GameMasterHybridTransition(segment) {
    const media = createElement("div", "transition-screen__media transition-screen__media--gm-hybrid");
    const layout = createElement("div", "gm-hybrid");
    const visual = createElement("div", "gm-hybrid__visual");
    const side = createElement("div", "gm-hybrid__side");
    const copy = createElement("div", "gm-hybrid__copy");
    const badges = createElement("div", "gm-hybrid__badges");

    if (segment.layout === "image-left") {
        layout.classList.add("gm-hybrid--image-left");
    }

    if (!segment.video && segment.image) {
        layout.classList.add("gm-hybrid--image-only");
    }

    if (segment.video) {
        const videoFrame = createElement("div", "gm-hybrid__video-frame");
        videoFrame.appendChild(createTransitionVideoElement(segment, "gm-hybrid__video"));
        visual.appendChild(videoFrame);
    }

    if (segment.image) {
        const imageFrame = createElement("div", "gm-hybrid__image-frame");
        const image = document.createElement("img");
        image.className = "gm-hybrid__image";
        image.src = segment.image;
        image.alt = segment.alt || segment.title || "Transition";
        imageFrame.appendChild(image);
        side.appendChild(imageFrame);
    }

    (segment.badges || []).forEach((badgeText) => {
        badges.appendChild(createElement("div", "gm-hybrid__badge", badgeText));
    });

    if (badges.childElementCount) {
        copy.appendChild(badges);
    }

    if (segment.kicker) {
        copy.appendChild(createElement("div", "gm-hybrid__kicker", segment.kicker));
    }

    if (segment.title) {
        copy.appendChild(createElement("div", "gm-hybrid__title", segment.title));
    }

    if (segment.text) {
        copy.appendChild(createElement("div", "gm-hybrid__text", segment.text));
    }

    side.appendChild(copy);
    layout.appendChild(visual);
    layout.appendChild(side);
    media.appendChild(layout);
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

        const clipStart = Number(segmentWithTitles.clip_start || 0);
        const clipEnd = segmentWithTitles.clip_end != null
            ? Number(segmentWithTitles.clip_end)
            : null;
        const mediaDurationSeconds = clipEnd != null
            ? Math.max(0, clipEnd - clipStart)
            : null;

        const normalized = {
            ...segmentWithTitles,
            durationSeconds,
            mediaDurationSeconds,
            loopsMedia: Boolean(mediaDurationSeconds && durationSeconds - mediaDurationSeconds > EPSILON),
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

function getSegmentMediaTime(segment, elapsedSeconds) {
    const clipStart = Number(segment.clip_start || 0);
    const mediaDurationSeconds = Number(segment.mediaDurationSeconds || 0);

    if (segment.loopsMedia && mediaDurationSeconds > EPSILON) {
        return clipStart + (elapsedSeconds % mediaDurationSeconds);
    }

    if (mediaDurationSeconds > EPSILON) {
        return clipStart + Math.min(elapsedSeconds, mediaDurationSeconds);
    }

    return clipStart + elapsedSeconds;
}

function attachSegmentVideoLoop(video, segment) {
    if (!segment.loopsMedia) {
        return;
    }

    const clipStart = Number(segment.clip_start || 0);
    const clipEnd = Number(segment.clip_end || 0);

    if (clipEnd - clipStart <= EPSILON) {
        return;
    }

    video.addEventListener("timeupdate", () => {
        if (video.currentTime >= clipEnd - EPSILON) {
            video.currentTime = clipStart;
            if (!video.paused) {
                video.play().catch(() => {});
            }
        }
    });
}

function getOverlayTitle(scene, segment) {
    return (
        segment?.broadcast?.title ||
        scene?.broadcast_title ||
        SCENE_OVERLAY_TITLES[scene?.scene_id] ||
        ""
    );
}

function applyBroadcastOverlay(scene, segment) {
    if (!elements.broadcastOverlay) {
        return;
    }

    const leftBrand = elements.broadcastOverlay.querySelector(".broadcast-overlay__brand--left");
    const rightBrand = elements.broadcastOverlay.querySelector(".broadcast-overlay__brand--right");
    const eyebrow = elements.broadcastOverlay.querySelector(".broadcast-overlay__eyebrow");
    const subtitle = elements.broadcastOverlay.querySelector(".broadcast-overlay__subtitle");
    const logo = elements.broadcastOverlayLogo;
    const broadcast = segment.broadcast || {};

    leftBrand?.classList.remove("hidden");
    rightBrand?.classList.remove("hidden");

    if (eyebrow) {
        const overlayTitle = getOverlayTitle(scene, segment);
        eyebrow.textContent = overlayTitle;
        eyebrow.classList.toggle("hidden", !overlayTitle || broadcast.show_eyebrow === false);
    }

    if (subtitle) {
        subtitle.textContent = "";
        subtitle.classList.add("hidden");
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
        this.persistentStripState = null;
        this.audioContext = null;
        this.masterAudioDisabled = false;
        this.audioEndedSceneTime = null;
        this.audioEndedPerfTime = 0;
        this.lastProgressSceneTime = 0;
        this.lastProgressPerfTime = 0;
        this.lastRecoveryPerfTime = 0;
        this.nextUrl = resolveNextUrl();
        this.onComplete = resolveOnComplete();
        this.completionHandled = false;

        this.tick = this.tick.bind(this);
        this.onVideoTimeUpdate = this.onVideoTimeUpdate.bind(this);
        this.onVideoEnded = this.onVideoEnded.bind(this);
        this.onAudioEnded = this.onAudioEnded.bind(this);
        this.onVideoError = this.onVideoError.bind(this);
        this.onAudioError = this.onAudioError.bind(this);
        this.onVideoStalled = this.onVideoStalled.bind(this);
        this.onAudioStalled = this.onAudioStalled.bind(this);
    }

    logEvent(type, detail = {}) {
        const payload = {
            type,
            scene: this.scene.scene_id,
            segmentIndex: this.currentSegmentIndex,
            segmentLabel: this.currentSegment?.label || this.currentSegment?.type || "",
            detail,
            at: new Date().toISOString(),
        };

        try {
            const key = "scenePlayerLogs";
            const logs = JSON.parse(window.sessionStorage.getItem(key) || "[]");
            logs.push(payload);
            window.sessionStorage.setItem(key, JSON.stringify(logs.slice(-80)));
        } catch (error) {
            // Ignore storage issues in kiosk mode.
        }

        console.info("[scene-player]", payload);
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
        return Boolean(this.scene.audio?.src) && !this.masterAudioDisabled;
    }

    async init() {
        elements.video.muted = true;
        elements.video.playsInline = true;
        elements.video.addEventListener("timeupdate", this.onVideoTimeUpdate);
        elements.video.addEventListener("ended", this.onVideoEnded);
        elements.video.addEventListener("error", this.onVideoError);
        elements.video.addEventListener("stalled", this.onVideoStalled);
        elements.audio.addEventListener("ended", this.onAudioEnded);
        elements.audio.addEventListener("error", this.onAudioError);
        elements.audio.addEventListener("stalled", this.onAudioStalled);

        if (this.scene.audio?.src) {
            elements.audio.src = this.scene.audio.src;
            elements.audio.load();
        }

        if (this.segments.length === 0) {
            throw new Error("La escena no te segments.");
        }

        if (elements.playerRoot) {
            elements.playerRoot.dataset.sceneId = this.scene?.scene_id || "";
        }

        elements.playerRoot?.classList.toggle("player-root--unified-frame", Boolean(this.scene?.use_character_frame));

        this.setupPersistentElementsStrip();

        this.renderSegment();
        this.updateStatus();
        this.hideBootOverlay();
        this.primeProgressWatch();

        if (this.currentSegment?.advance_on_space) {
            return;
        }

        await this.play();
    }

    setupPersistentElementsStrip() {
        if (!elements.persistentElementsStrip) {
            return;
        }

        const stripConfig = this.scene?.persistent_elements_strip;
        if (!stripConfig || typeof stripConfig !== "object") {
            return;
        }

        const title = stripConfig.title || "";
        const kicker = stripConfig.kicker || "";
        const objective = stripConfig.objective || "";
        const assetsTitle = stripConfig.assets_title || "ELEMENTOS";
        const warning = stripConfig.warning || stripConfig.attention || "";
        const warningLabel = stripConfig.warning_label || "ATENCION";
        const revealAt = stripConfig.reveal_at || {};

        elements.playerRoot?.classList.remove("player-root--persistent-strip");
        elements.persistentElementsStrip.classList.add("hidden");
        elements.persistentElementsStrip.innerHTML = "";
        this.persistentStripState = null;

        const strip = PersistentElementsStrip({
            kicker,
            title,
            objective,
            assetsTitle,
            warning,
            warningLabel,
            revealAt,
        });

        this.persistentStripState = strip;
        elements.playerRoot?.classList.add("player-root--persistent-strip");
        elements.playerRoot?.classList.add("player-root--subtitle-up");
        elements.persistentElementsStrip.appendChild(strip.strip);
        elements.persistentElementsStrip.classList.remove("hidden");
        this.updatePersistentElementsStrip(0, 0);
    }

    resolvePersistentStripAssets(elapsedSeconds = 0) {
        if (!this.persistentStripState) {
            return [];
        }

        const content = mergeAccumulatedUiState(this.segments, this.currentSegmentIndex, elapsedSeconds);
        const assets = Array.isArray(content?.left?.assets) ? content.left.assets : [];
        return assets.filter((asset) => asset && asset.src);
    }

    updatePersistentElementsStrip(elapsedSeconds = 0, sceneTimeSeconds = this.getSceneTime()) {
        if (!this.persistentStripState?.row) {
            return;
        }

        updatePersistentStripBlockVisibility(this.persistentStripState, sceneTimeSeconds);
        const assets = this.resolvePersistentStripAssets(elapsedSeconds);
        updatePersistentStripAssets(this.persistentStripState.row, assets);
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
        } else if (type === "countdown") {
            config = {
                aFreq: [980, 980],
                bFreq: [1470, 1470],
                duration: 0.12,
                gain: 0.038,
                waveA: "square",
                waveB: "triangle",
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
        elements.video.removeEventListener("error", this.onVideoError);
        elements.video.removeEventListener("stalled", this.onVideoStalled);
        elements.audio.removeEventListener("ended", this.onAudioEnded);
        elements.audio.removeEventListener("error", this.onAudioError);
        elements.audio.removeEventListener("stalled", this.onAudioStalled);
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

    resetAudioFallback() {
        this.audioEndedSceneTime = null;
        this.audioEndedPerfTime = 0;
    }

    disableMasterAudio(reason = "audio_disabled") {
        if (!this.scene.audio?.src || this.masterAudioDisabled) {
            return;
        }

        const now = performance.now();
        const sceneTime = elements.audio.currentTime || this.getSceneTime(now);
        const nextSegmentElapsed = Math.max(0, Math.min(
            this.currentSegment.durationSeconds,
            sceneTime - this.currentSegment.timelineStart,
        ));

        this.masterAudioDisabled = true;
        this.segmentElapsed = nextSegmentElapsed;
        this.segmentStartedAt = this.playing ? now : 0;
        this.resetAudioFallback();
        elements.audio.pause();
        this.recordProgress(sceneTime, now);
        this.logEvent("audio_disabled", { reason, sceneTime });
    }

    primeProgressWatch(now = performance.now()) {
        this.lastProgressPerfTime = now;
        this.lastProgressSceneTime = this.getSceneTime(now);
    }

    recordProgress(sceneTime, now = performance.now()) {
        this.lastProgressSceneTime = sceneTime;
        this.lastProgressPerfTime = now;
    }

    shouldForceComplete(sceneTime) {
        return this.scene.durationSeconds - sceneTime <= SAFE_NEXT_GRACE_SECONDS;
    }

    async attemptRecovery(reason = "unknown") {
        const now = performance.now();
        if (now - this.lastRecoveryPerfTime < STALL_RECOVERY_COOLDOWN_MS) {
            return;
        }

        this.lastRecoveryPerfTime = now;
        this.logEvent("recovery_attempt", { reason });

        const sceneTime = this.getSceneTime(now);
        if (this.shouldForceComplete(sceneTime)) {
            this.logEvent("recovery_complete", { reason, sceneTime });
            this.pause();
            this.handleSceneCompletion();
            return;
        }

        if (this.hasMasterAudio() && elements.audio.paused && !elements.audio.ended) {
            try {
                await elements.audio.play();
                this.recordProgress(this.getSceneTime(), performance.now());
                return;
            } catch (error) {
                this.logEvent("audio_resume_failed", { reason, message: error?.message || String(error) });
            }
        }

        if (this.currentSegment.type === "character" && elements.video.paused) {
            try {
                await elements.video.play();
                this.recordProgress(this.getSceneTime(), performance.now());
                return;
            } catch (error) {
                this.logEvent("video_resume_failed", { reason, message: error?.message || String(error) });
            }
        }

        if (this.currentSegment.type !== "character" || this.currentSegmentIndex >= this.segments.length - 1) {
            this.logEvent("recovery_skip_to_next", { reason });
            await this.advanceSegment();
        }
    }

    getSceneTime(now = performance.now()) {
        if (this.hasMasterAudio()) {
            if (this.audioEndedSceneTime != null) {
                const tail = this.playing && this.audioEndedPerfTime
                    ? Math.max(0, (now - this.audioEndedPerfTime) / 1000)
                    : 0;
                return Math.min(this.scene.durationSeconds, this.audioEndedSceneTime + tail);
            }

            return elements.audio.currentTime || 0;
        }

        let elapsed = this.segmentElapsed;
        if (this.playing && this.segmentStartedAt) {
            elapsed += Math.max(0, (now - this.segmentStartedAt) / 1000);
        }

        elapsed = Math.min(this.currentSegment.durationSeconds, Math.max(0, elapsed));
        return this.currentSegment.timelineStart + elapsed;
    }

    async play() {
        this.hideBootOverlay();
        this.playing = true;
        this.segmentStartedAt = performance.now();
        this.primeProgressWatch(this.segmentStartedAt);
        await this.syncMedia(true);

        if (this.hasMasterAudio() || this.currentSegment.type !== "character") {
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
        this.primeProgressWatch();
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
        this.logEvent("scene_complete", {
            nextUrl: this.nextUrl || "",
            onComplete: this.onComplete || "",
        });

        if (this.nextUrl) {
            window.setTimeout(() => {
                window.location.replace(this.nextUrl);
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

        const previousSegment = this.currentSegment;

        if (this.playing) {
            this.captureSegmentElapsed();
        }

        cancelAnimationFrame(this.rafId);
        elements.video.pause();

        if (!preserveAudio) {
            elements.audio.pause();
        }

        const nextSegment = this.segments[nextIndex];
        const crossfadeTransition = previousSegment?.type === "transition" && nextSegment?.type === "transition";
        const shouldAutoplay = autoplay && !nextSegment?.advance_on_space;
        this.playing = shouldAutoplay;
        this.currentSegmentIndex = nextIndex;
        this.segmentElapsed = 0;
        this.segmentStartedAt = shouldAutoplay ? performance.now() : 0;
        this.primeProgressWatch(this.segmentStartedAt || performance.now());
        this.renderSegment({ crossfadeTransition });
        this.updateStatus();
        await this.syncMedia(shouldAutoplay, { preserveAudio });

        if (shouldAutoplay && this.currentSegment.type !== "character") {
            this.startTicking();
        }
    }

    renderSegment({ crossfadeTransition = false } = {}) {
        const segment = this.currentSegment;
        const keepCharacterFrame = Boolean(this.scene?.use_character_frame);
        this.activePhaseKey = "";
        this.activePhaseIndex = -1;
        this.activeSubtitleKey = "";
        this.fullscreenPanelState = null;

        elements.uiLayer.innerHTML = "";
        elements.uiLayer.classList.remove("layer-visible");
        elements.video.classList.remove("scene-video--hidden", "scene-video--reveal");

        if (!(crossfadeTransition && segment.type === "transition")) {
            elements.transitionLayer.innerHTML = "";
            elements.transitionLayer.classList.remove("layer-visible");
        }
        elements.playerRoot?.classList.remove("player-root--character-feed");
        if (!keepCharacterFrame) {
            elements.playerRoot?.classList.remove("player-root--broadcast");
        }
        if (!elements.playerRoot?.classList.contains("player-root--persistent-strip")) {
            elements.playerRoot?.classList.remove("player-root--subtitle-up");
        }
        if (!keepCharacterFrame) {
            elements.broadcastOverlay?.classList.add("hidden");
        } else {
            elements.playerRoot?.classList.add("player-root--broadcast");
            elements.broadcastOverlay?.classList.remove("hidden");
        }
        this.updatePersistentElementsStrip(this.segmentElapsed, this.getSceneTime());

        if (segment.type === "character") {
            elements.playerRoot?.classList.add("player-root--broadcast");
            elements.playerRoot?.classList.add("player-root--character-feed");
            elements.broadcastOverlay?.classList.remove("hidden");
            applyBroadcastOverlay(this.scene, segment);
            void elements.video.offsetWidth;
            elements.video.classList.add("scene-video--reveal");
            return;
        }

        elements.video.classList.add("scene-video--hidden");

        if (segment.type === "fullscreen_ui") {
            elements.uiLayer.classList.remove("hidden");
            this.fullscreenPanelState = createFullscreenPanel(this.segments, this.currentSegmentIndex, this.segmentElapsed);
            if (this.fullscreenPanelState?.screen?.dataset?.variant === "immersive-strip") {
                elements.playerRoot?.classList.add("player-root--subtitle-up");
            }
            elements.uiLayer.appendChild(this.fullscreenPanelState.screen);
            this.activePhaseKey = this.getPhaseKey(segment, this.segmentElapsed);
            this.playPhaseSfx(segment, this.segmentElapsed);
            requestAnimationFrame(() => elements.uiLayer.classList.add("layer-visible"));
            return;
        }

        if (segment.type === "transition") {
            elements.transitionLayer.classList.remove("hidden");
            const nextScreen = TransitionScreen(segment);
            if (crossfadeTransition) {
                const previousScreen = elements.transitionLayer.querySelector(".transition-screen");
                if (previousScreen) {
                    previousScreen.classList.add("transition-screen--crossfade-out");
                }
                nextScreen.classList.add("transition-screen--crossfade-in");
                elements.transitionLayer.appendChild(nextScreen);
                window.setTimeout(() => {
                    if (previousScreen?.isConnected) {
                        previousScreen.remove();
                    }
                }, 340);
            } else {
                elements.transitionLayer.appendChild(nextScreen);
            }
            if (segment.variant === "countdown") {
                this.playUiSfx("countdown");
            }
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

        if (this.hasMasterAudio() && !preserveAudio) {
            this.resetAudioFallback();
            elements.audio.currentTime = sceneTime;
        }

        if (segment.type === "character") {
            const elapsedInSegment = this.hasMasterAudio()
                ? Math.max(0, sceneTime - segment.timelineStart)
                : this.segmentElapsed;
            const clipTime = getSegmentMediaTime(segment, elapsedInSegment);

            if (elements.video.dataset.src !== segment.src) {
                elements.video.src = segment.src;
                elements.video.dataset.src = segment.src;
                elements.video.load();
                this.logEvent("video_load", { src: segment.src });
            }

            elements.video.loop = segment.loopsMedia && !segment.clip_end;
            elements.video.currentTime = clipTime;
        } else {
            elements.video.pause();
            elements.video.loop = false;
        }

        if (!autoplay) {
            return;
        }

        if (this.hasMasterAudio() && (!preserveAudio || elements.audio.paused)) {
            try {
                await elements.audio.play();
                this.logEvent("audio_play", { src: this.scene.audio.src, preserveAudio });
            } catch (error) {
                this.logEvent("audio_play_failed", { message: error?.message || String(error) });
                this.disableMasterAudio("audio_play_failed");
            }
        }

        try {
            if (segment.type === "character") {
                await elements.video.play();
                this.logEvent("video_play", { src: segment.src });
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
            ? Math.max(0, this.getSceneTime(now) - this.currentSegment.timelineStart)
            : this.segmentElapsed + ((now - this.segmentStartedAt) / 1000);
        const sceneTime = this.getSceneTime(now);

        if (Math.abs(sceneTime - this.lastProgressSceneTime) > EPSILON / 2) {
            this.recordProgress(sceneTime, now);
        } else if (now - this.lastProgressPerfTime > STALL_THRESHOLD_MS) {
            this.attemptRecovery("tick_stalled");
            this.rafId = requestAnimationFrame(this.tick);
            return;
        }

        this.updateSubtitleOverlay();
        this.updatePersistentElementsStrip(elapsed, sceneTime);

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

        if (this.currentSegment.loopsMedia) {
            const clipStart = Number(this.currentSegment.clip_start || 0);
            const clipEnd = Number(this.currentSegment.clip_end || 0);

            if (clipEnd - clipStart > EPSILON && elements.video.currentTime >= clipEnd - EPSILON) {
                elements.video.currentTime = clipStart;
                return;
            }
        }

        this.updateSubtitleOverlay();

        const elapsed = this.hasMasterAudio()
            ? Math.max(0, this.getSceneTime() - this.currentSegment.timelineStart)
            : elements.video.currentTime - Number(this.currentSegment.clip_start || 0);
        this.recordProgress(this.getSceneTime(), performance.now());

        if (elapsed >= this.currentSegment.durationSeconds - EPSILON) {
            this.advanceSegment();
        }
    }

    onVideoEnded() {
        if (this.playing && this.currentSegment.type === "character" && !this.currentSegment.loopsMedia) {
            this.advanceSegment();
        }
    }

    onAudioEnded() {
        if (!this.hasMasterAudio() || this.audioEndedSceneTime != null) {
            return;
        }

        this.audioEndedSceneTime = elements.audio.duration || elements.audio.currentTime || this.getSceneTime();
        this.audioEndedPerfTime = performance.now();
        this.recordProgress(this.audioEndedSceneTime, this.audioEndedPerfTime);
        this.logEvent("audio_ended", { currentTime: this.audioEndedSceneTime });

        if (this.shouldForceComplete(this.audioEndedSceneTime)) {
            this.pause();
            this.handleSceneCompletion();
            return;
        }

        if (this.playing) {
            this.startTicking();
        }
    }

    onVideoError() {
        this.logEvent("video_error", { src: this.currentSegment?.src || "" });
        this.attemptRecovery("video_error");
    }

    onAudioError() {
        this.logEvent("audio_error", { src: this.scene.audio?.src || "" });
        this.disableMasterAudio("audio_error");
        this.attemptRecovery("audio_error");
    }

    onVideoStalled() {
        this.logEvent("video_stalled", { src: this.currentSegment?.src || "" });
        this.attemptRecovery("video_stalled");
    }

    onAudioStalled() {
        this.logEvent("audio_stalled", { src: this.scene.audio?.src || "" });
        this.attemptRecovery("audio_stalled");
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
        briefContentCatalog = scene?.brief_by_scene && typeof scene.brief_by_scene === "object"
            ? scene.brief_by_scene
            : {};
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

        if (playerInstance.currentSegment?.advance_on_space) {
            await playerInstance.advanceSegment();
            return;
        }

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

document.addEventListener("click", async (event) => {
    if (!playerInstance) {
        return;
    }

    if (event.button !== 0) {
        return;
    }

    if (!playerInstance.currentSegment?.advance_on_space) {
        return;
    }

    event.preventDefault();
    await playerInstance.advanceSegment();
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
