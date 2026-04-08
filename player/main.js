const DEFAULT_SCENE_ID = "scene_video1_test";
const EPSILON = 0.12;

const elements = {
    playerRoot: document.getElementById("player-root"),
    video: document.getElementById("scene-video"),
    audio: document.getElementById("scene-audio"),
    broadcastOverlay: document.getElementById("broadcast-overlay"),
    uiLayer: document.getElementById("ui-layer"),
    transitionLayer: document.getElementById("transition-layer"),
    subtitleOverlay: document.getElementById("subtitle-overlay"),
    bootOverlay: document.getElementById("boot-overlay"),
};

function resolveSceneId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("scene") || DEFAULT_SCENE_ID;
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
    const labelInsideMedia = Boolean(segment.image && segment.label && segment.variant === "maze");

    if (segment.image) {
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
            this.showBootOverlay("Escena completada", "Tots els segments s'han reproduit. Prem R per tornar a començar.");
            return;
        }

        const wasPlaying = this.playing;
        await this.transitionToSegment(this.currentSegmentIndex + 1, {
            autoplay: wasPlaying,
            preserveAudio: wasPlaying && this.hasMasterAudio(),
        });
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
            if (segment.type === "character") {
                await elements.video.play();
            }

            if (this.scene.audio?.src && (!preserveAudio || elements.audio.paused)) {
                await elements.audio.play();
            }
        } catch (error) {
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
});

window.addEventListener("beforeunload", () => {
    playerInstance?.destroy();
});

bootstrap();
