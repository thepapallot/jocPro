#!/usr/bin/env python3
import argparse
import copy
import hashlib
import json
import os
import re
import unicodedata
import wave
from pathlib import Path


SEGMENT_LABEL_DEFAULT_INTENT = {
    "intro_estable": "intro",
    "bloque_estable": "briefing",
    "cierre_suave": "close",
}

INTENT_ROLE_PREFERENCES = {
    "intro": ["neutral_intro", "intro_short", "intro_long", "briefing_short", "briefing_long"],
    "briefing": ["explanation_short", "briefing_short", "briefing_long", "explanation_long", "bridge"],
    "warning": ["warning", "warning_stable", "warning_long", "warning_notice", "gesture", "emphasis"],
    "close": ["outro_close", "neutral_close", "short_close", "warning_notice", "briefing_short"],
}

SCENE_TO_PUZZLE_TAG = {
    "scene_intro_simulacro": "11",
    "scene_intro_sumas": "1",
    "scene_intro_laberinto": "2",
    "scene_intro_trivial": "3",
    "scene_intro_musica": "4",
    "scene_intro_cronometro": "5",
    "scene_intro_energia": "6",
    "scene_intro_memory": "8",
    "scene_intro_token_a_lloc": "9",
    "scene_intro_segments": "10",
    "scene_intro_apreta_botons": "12",
}

CONCEPT_KEYWORDS = {
    "token": ["token", "tokens"],
    "terminal": ["terminal", "terminales"],
    "panel_botones": ["boton", "botones", "pulsar", "apretar"],
    "numeracion_terminal": ["numero", "numeros", "pregunta", "respuesta"],
    "barra_luz_apagada": ["apag", "espera", "inicio", "arranque"],
    "barra_luz_encendida": ["encend", "luz", "luces", "color", "activa"],
    "error_operacion": ["error", "fallo"],
    "reinicio": ["reinici", "reinicio"],
    "operacion_repetida": ["repetid", "duplic"],
    "tiempo_agotado": ["tiempo", "agot", "cuenta atras", "segundo"],
    "laberinto_base": ["laberinto", "centro", "entrada"],
    "laberinto_alarma": ["alarma", "rojo", "peligro"],
    "simbolo_laberinto": ["simbolo", "símbolo", "contrario"],
    "simbolo_griego": ["griega", "letra", "alfa", "beta", "gamma", "omega"],
    "puzzle_recurso": [],
}

WARNING_CONCEPTS = {
    "error_operacion",
    "reinicio",
    "operacion_repetida",
    "tiempo_agotado",
}

WARNING_TEXT_CUES = [
    "error",
    "fallo",
    "reinici",
    "reinicio",
    "agot",
    "cuenta atras",
    "límite",
    "limite",
    "de nuevo",
]

PATH_HINTS_TO_CONCEPT = {
    "token": "token",
    "terminal": "terminal",
    "button": "panel_botones",
    "boton": "panel_botones",
    "number": "numeracion_terminal",
    "numero": "numeracion_terminal",
    "maze": "laberinto_base",
    "laberintvermell": "laberinto_alarma",
    "laberint": "laberinto_base",
    "symbol": "simbolo_laberinto",
    "simbol": "simbolo_laberinto",
    "alpha": "simbolo_griego",
    "beta": "simbolo_griego",
    "gamma": "simbolo_griego",
    "delta": "simbolo_griego",
    "epsilon": "simbolo_griego",
    "lambda": "simbolo_griego",
    "omega": "simbolo_griego",
    "sigma": "simbolo_griego",
    "pi": "simbolo_griego",
    "mu": "simbolo_griego",
    "question": "numeracion_terminal",
    "song": "panel_botones",
    "music": "panel_botones",
    "time": "tiempo_agotado",
    "clock": "tiempo_agotado",
    "color": "barra_luz_encendida",
    "light": "barra_luz_encendida",
    "scan": "barra_luz_encendida",
}

PUZZLE_CONTEXT_TERMS = [
    "token",
    "terminal",
    "button",
    "boton",
    "color",
    "symbol",
    "simbol",
    "time",
    "timer",
    "countdown",
    "round",
    "sequence",
    "memory",
    "music",
    "sound",
    "laberint",
    "maze",
    "error",
    "restart",
]

MIN_VISUAL_PHASE_GAP = 1.8

CONCEPT_ASSET_PREFERENCES = {
    "token": [
        "/static/images/shared/nuevos iconos/base nfc.png",
        "/static/images/shared/nuevos iconos/base nfc con token.png",
        "/static/images/shared/gameplay/token_card.png",
    ],
    "terminal": [
        "/static/images/shared/nuevos iconos/termial con token.png",
        "/static/images/shared/gameplay/terminal_box.png",
    ],
    "panel_botones": [
        "/static/images/shared/nuevos iconos/botones colores.png",
        "/static/images/shared/terminal_3d/buttons_panel_front.png",
    ],
    "numeracion_terminal": [
        "/static/images/shared/nuevos iconos/panel numeros.png",
        "/static/images/shared/terminal_3d/numbers_strip_1_to_6.png",
    ],
    "barra_luz_apagada": [
        "/static/images/shared/terminal_3d/scanner_bar_off.png",
        "/static/images/shared/nuevos iconos/tira led.png",
    ],
    "barra_luz_encendida": [
        "/static/images/shared/terminal_3d/scanner_bar_on.png",
        "/static/images/shared/nuevos iconos/tira led.png",
    ],
    "tiempo_agotado": [
        "/static/images/shared/nuevos iconos/reloj tiempo.png",
        "/static/images/shared/nuevos iconos/temporizador.png",
    ],
    "error_operacion": [
        "/static/images/shared/nuevos iconos/error atencion.png",
        "/static/images/shared/nuevos iconos/veredicto_error.png",
    ],
    "reinicio": [
        "/static/images/shared/nuevos iconos/reset.png",
        "/static/images/shared/nuevos iconos/repetir.png",
    ],
}

SEGMENTS_PATTERN_CODES = [
    {"box": 0, "code": "042"},
    {"box": 1, "code": "414"},
]

SEGMENTS_OBJECTIVE_MIN_TEXT_SECONDS = 5.4
SEGMENTS_OBJECTIVE_TEXT = "COMPLETAR LOS PATRONES DE CADA TERMINAL"
DEFAULT_DISALLOWED_ASSET_PATH_FRAGMENTS = (
    "/old_pics/",
    "/legacy/",
    "/archive/legacy/",
)


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def dump_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def load_image_semantics(repo_root: Path, catalog: dict):
    defaults = catalog.get("defaults", {})
    semantics_path = defaults.get(
        "image_semantics_path",
        "scenes/catalog/image_semantics.json",
    )
    path = (repo_root / semantics_path).resolve()
    if not path.exists():
        return {}
    data = load_json(path)
    images = data.get("images", []) if isinstance(data, dict) else []
    by_path = {}
    for item in images:
        if not isinstance(item, dict):
            continue
        image_path = item.get("path")
        if isinstance(image_path, str) and image_path.strip():
            by_path[image_path] = item
    return by_path


def _asset_semantic_rank(src, puzzle_tag, image_semantics):
    meta = image_semantics.get(src, {})
    puzzles = meta.get("puzzles", []) if isinstance(meta, dict) else []
    normalized = {str(v).lower() for v in puzzles if isinstance(v, (str, int))}
    if puzzle_tag and puzzle_tag in normalized:
        return 0
    if "shared" in normalized:
        return 1
    if normalized:
        return 3
    return 2


def rank_assets_for_scene(assets, scene_id, image_semantics):
    puzzle_tag = SCENE_TO_PUZZLE_TAG.get(scene_id, "")
    ranked = sorted(
        assets or [],
        key=lambda a: (
            _asset_semantic_rank(a.get("src"), puzzle_tag, image_semantics),
            a.get("src", ""),
        ),
    )
    return ranked


def derive_headline_from_subtitles(subtitles):
    lines = [((s.get("text") or "").strip()) for s in (subtitles or [])]
    lines = [line for line in lines if line]
    if not lines:
        return ""
    with_keywords = [line for line in lines if _extract_mentioned_concepts(line)]
    seed = with_keywords[0] if with_keywords else lines[0]
    seed = seed.rstrip(".:;!? ").strip()
    if len(seed) > 84:
        seed = seed[:84].rstrip()
    return seed


def resolve_intro_titles(entry: dict, scene_id: str, subtitles: list):
    entry_game_title = (entry.get("game_title") or "").strip()
    entry_headline = (entry.get("headline") or "").strip()
    entry_objective = (entry.get("objective") or "").strip()

    game_title = entry_game_title or scene_id.replace("scene_intro_", "").replace("_", " ").title()
    headline = entry_objective or entry_headline or derive_headline_from_subtitles(subtitles)
    return game_title, headline or game_title


def canonical_scene_id(entry: dict):
    explicit = (entry.get("scene_id") or "").strip()
    if explicit:
        return explicit
    source = (
        entry.get("output_scene_id")
        or entry.get("legacy_scene_id")
        or ""
    ).strip()
    if source.endswith("_v2"):
        return source[:-3]
    return source


def is_sumas_scene(scene_id: str) -> bool:
    return scene_id == "scene_intro_sumas"


def resolve_audio_src(entry: dict, scene_id: str):
    explicit = (entry.get("audio_src") or "").strip()
    if explicit:
        return explicit
    puzzle_tag = SCENE_TO_PUZZLE_TAG.get(scene_id, "")
    if not puzzle_tag:
        return ""
    return f"/static/audios/scene/intro_puzzle_{int(puzzle_tag):02d}.wav"


def parse_srt_timestamp(raw: str):
    # HH:MM:SS,mmm
    try:
        hhmmss, millis = raw.strip().split(",", 1)
        hh, mm, ss = hhmmss.split(":", 2)
        return int(hh) * 3600 + int(mm) * 60 + int(ss) + int(millis) / 1000.0
    except Exception:
        return None


def parse_srt_file(path: Path):
    if not path.exists():
        return []
    lines = path.read_text(encoding="utf-8").splitlines()
    subtitles = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        # optional numeric index
        if line.isdigit() and i + 1 < len(lines):
            i += 1
            line = lines[i].strip()
        if "-->" not in line:
            i += 1
            continue
        left, right = [p.strip() for p in line.split("-->", 1)]
        start = parse_srt_timestamp(left)
        end = parse_srt_timestamp(right)
        i += 1
        text_lines = []
        while i < len(lines) and lines[i].strip():
            text_lines.append(lines[i].strip())
            i += 1
        text = " ".join(text_lines).strip()
        if isinstance(start, (int, float)) and isinstance(end, (int, float)) and text:
            subtitles.append({"start": round(start, 3), "end": round(end, 3), "text": text})
    return subtitles


def format_srt_timestamp(seconds: float):
    total_ms = max(0, int(round(float(seconds) * 1000)))
    hh = total_ms // 3600000
    total_ms %= 3600000
    mm = total_ms // 60000
    total_ms %= 60000
    ss = total_ms // 1000
    ms = total_ms % 1000
    return f"{hh:02d}:{mm:02d}:{ss:02d},{ms:03d}"


def derive_subtitle_alias(scene_id: str):
    alias = (scene_id or "").strip()
    if alias.startswith("scene_intro_"):
        alias = alias[len("scene_intro_"):]
    alias = alias.replace("-", "_").replace(" ", "_")
    alias = re.sub(r"[^a-zA-Z0-9_]+", "", alias)
    alias = alias.strip("_").lower()
    return alias or "scene"


def infer_subtitles_path(repo_root: Path, scene_id: str, lang: str):
    puzzle_tag = SCENE_TO_PUZZLE_TAG.get(scene_id, "")
    if not puzzle_tag:
        return None
    alias = derive_subtitle_alias(scene_id)
    subtitles_file = f"intro_puzzle_{int(puzzle_tag):02d}_{alias}.{lang}.srt"
    absolute = repo_root / "scenes" / "subtitles" / lang / subtitles_file
    relative = absolute.relative_to(repo_root).as_posix()
    return absolute, relative


def transcribe_subtitles_for_entry(
    entry: dict,
    repo_root: Path,
    scene_id: str,
    whisper_model_name: str,
    whisper_language: str,
    whisper_device: str,
    whisper_cache_dir: Path,
    whisper_models: dict,
    lang_code: str,
):
    if isinstance(entry.get("subtitles"), list):
        return None

    explicit_subtitles_path = (entry.get("subtitles_path") or "").strip()
    if explicit_subtitles_path:
        subtitles_abs_path = (repo_root / explicit_subtitles_path).resolve()
        subtitles_rel_path = explicit_subtitles_path
    else:
        inferred = infer_subtitles_path(repo_root, scene_id, lang_code)
        if not inferred:
            return None
        subtitles_abs_path, subtitles_rel_path = inferred

    audio_src = resolve_audio_src(entry, scene_id)
    audio_path = resolve_static_path(repo_root, audio_src)
    if not audio_path or not audio_path.exists():
        raise RuntimeError(f"{scene_id}: audio not found for subtitle transcription -> {audio_src}")

    try:
        import whisper
    except ImportError as exc:
        raise RuntimeError(
            "openai-whisper is required for auto subtitle transcription. "
            "Install it in your environment: pip install openai-whisper"
        ) from exc

    whisper_cache_dir.mkdir(parents=True, exist_ok=True)
    cache_key = f"{whisper_model_name}:{whisper_device}:{str(whisper_cache_dir)}"
    model = whisper_models.get(cache_key)
    if model is None:
        model = whisper.load_model(
            whisper_model_name,
            device=whisper_device,
            download_root=str(whisper_cache_dir),
        )
        whisper_models[cache_key] = model

    result = model.transcribe(
        str(audio_path),
        language=whisper_language,
        task="transcribe",
        fp16=False,
    )
    segments = result.get("segments") or []
    if not segments:
        raise RuntimeError(f"{scene_id}: whisper produced no subtitle segments")

    lines = []
    for idx, segment in enumerate(segments, start=1):
        start = float(segment.get("start", 0) or 0)
        end = float(segment.get("end", 0) or 0)
        text = (segment.get("text") or "").strip()
        if not text or end <= start:
            continue
        lines.append(str(idx))
        lines.append(f"{format_srt_timestamp(start)} --> {format_srt_timestamp(end)}")
        lines.append(text)
        lines.append("")

    if not lines:
        raise RuntimeError(f"{scene_id}: whisper segments were empty after normalization")

    subtitles_abs_path.parent.mkdir(parents=True, exist_ok=True)
    subtitles_abs_path.write_text("\n".join(lines).strip() + "\n", encoding="utf-8")
    return subtitles_rel_path


def resolve_subtitles(entry: dict, repo_root: Path, scene_id: str):
    if isinstance(entry.get("subtitles"), list):
        return entry["subtitles"]
    explicit = (entry.get("subtitles_path") or "").strip()
    if explicit:
        srt_path = (repo_root / explicit).resolve()
        return parse_srt_file(srt_path)
    puzzle_tag = SCENE_TO_PUZZLE_TAG.get(scene_id, "")
    if not puzzle_tag:
        return []
    subtitles_dir = repo_root / "scenes" / "subtitles" / "es"
    # Preferred format: intro_puzzle_XX_<alias>.es.srt
    alias_matches = sorted(subtitles_dir.glob(f"intro_puzzle_{int(puzzle_tag):02d}_*.es.srt"))
    if alias_matches:
        return parse_srt_file(alias_matches[0])
    # Legacy fallback: intro_puzzle_XX.es.srt
    srt_path = subtitles_dir / f"intro_puzzle_{int(puzzle_tag):02d}.es.srt"
    return parse_srt_file(srt_path)


def normalize_subtitles_timeline(subtitles, max_duration=None):
    normalized = []
    for sub in subtitles or []:
        if not isinstance(sub, dict):
            continue
        text = (sub.get("text") or "").strip()
        start = sub.get("start")
        end = sub.get("end")
        if not isinstance(start, (int, float)) or not isinstance(end, (int, float)) or not text:
            continue
        start = max(0.0, float(start))
        end = max(0.0, float(end))
        if isinstance(max_duration, (int, float)) and max_duration > 0:
            if start >= max_duration:
                continue
            end = min(end, float(max_duration))
        if end - start < 0.05:
            continue
        normalized.append({"start": round(start, 3), "end": round(end, 3), "text": text})

    normalized.sort(key=lambda s: (s["start"], s["end"]))
    cleaned = []
    for sub in normalized:
        if cleaned and sub["start"] < cleaned[-1]["start"]:
            sub["start"] = cleaned[-1]["start"]
        if cleaned and sub["start"] < cleaned[-1]["end"] and cleaned[-1]["end"] - sub["start"] <= 0.25:
            sub["start"] = round(cleaned[-1]["end"], 3)
        if sub["end"] <= sub["start"]:
            continue
        cleaned.append(sub)
    return cleaned


def normalize_text(text: str):
    text = unicodedata.normalize("NFD", text or "")
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return text.lower()


def path_to_alt(src: str):
    base = src.rsplit("/", 1)[-1].rsplit(".", 1)[0]
    label = base.replace("_", " ").replace("-", " ").strip()
    return label.capitalize() if label else "Recurso visual"


def build_segments_pattern_codes():
    return [dict(item) for item in SEGMENTS_PATTERN_CODES]


def resolve_disallowed_asset_path_fragments(defaults: dict):
    configured = defaults.get("disallowed_asset_path_fragments", []) if isinstance(defaults, dict) else []
    parts = []
    for item in configured:
        if not isinstance(item, str):
            continue
        value = item.strip().lower()
        if value:
            parts.append(value)
    if not parts:
        parts = list(DEFAULT_DISALLOWED_ASSET_PATH_FRAGMENTS)
    return tuple(dict.fromkeys(parts))


def is_disallowed_asset_path(src: str, disallowed_fragments: tuple[str, ...]):
    if not isinstance(src, str):
        return False
    normalized = src.lower()
    return any(fragment in normalized for fragment in disallowed_fragments)


def static_asset_exists(repo_root: Path, src: str):
    if not isinstance(src, str) or not src.startswith("/static/"):
        return True
    return (repo_root / src.lstrip("/")).exists()


def apply_large_three_asset_layout(scene: dict):
    """If a phase shows exactly 3 assets, mark it for large rendering in the player."""
    for segment in scene.get("segments", []):
        phases = segment.get("phases", [])
        if not isinstance(phases, list):
            continue
        for phase in phases:
            if not isinstance(phase, dict):
                continue
            top = phase.get("top")
            if not isinstance(top, dict):
                continue
            assets = top.get("assets")
            if isinstance(assets, list) and len(assets) == 3:
                top["layout"] = "large-3"


def infer_concept_from_path(rel_path: str):
    normalized = normalize_text(rel_path).replace("/", " ")
    compact = normalized.replace(" ", "")
    for hint, concept in PATH_HINTS_TO_CONCEPT.items():
        if hint in normalized or hint in compact:
            return concept
    return "puzzle_recurso"


def is_warning_candidate(candidate: dict):
    src = (candidate.get("src") or "").lower()
    concept = (candidate.get("concept") or "").lower()
    if concept in WARNING_CONCEPTS:
        return True
    return "/warnings/" in src


def subtitle_has_warning_cue(text: str):
    normalized = normalize_text(text)
    return any(cue in normalized for cue in WARNING_TEXT_CUES)


def _candidate_puzzle_scope(candidate: dict, puzzle_tag: str):
    puzzles = {str(v).lower() for v in candidate.get("puzzles", []) if isinstance(v, (str, int))}
    if puzzle_tag and puzzle_tag in puzzles:
        return "puzzle"
    if "shared" in puzzles:
        return "shared"
    return "other"


def _extract_mentioned_concepts(subtitle_text: str):
    text = normalize_text(subtitle_text)
    concepts = []
    for concept, keywords in CONCEPT_KEYWORDS.items():
        if not keywords:
            continue
        if any(keyword in text for keyword in keywords):
            concepts.append(concept)
    return concepts


def load_puzzle_context(repo_root: Path, scene_id: str):
    puzzle_tag = SCENE_TO_PUZZLE_TAG.get(scene_id, "")
    if not puzzle_tag:
        return {"puzzle_tag": "", "keywords": set(), "static_images": [], "audio_effects": []}

    puzzle_file = repo_root / "mqtt" / "puzzles" / f"puzzle{int(puzzle_tag)}.py"
    if not puzzle_file.exists():
        return {"puzzle_tag": puzzle_tag, "keywords": set(), "static_images": [], "audio_effects": []}

    raw = puzzle_file.read_text(encoding="utf-8")
    normalized = normalize_text(raw)
    static_refs = re.findall(r"['\"](/static/[^'\"]+)['\"]", raw)
    static_images = []
    audio_effects = []
    for ref in static_refs:
        ref_lower = ref.lower()
        if ref_lower.startswith("/static/audios/effects/"):
            audio_effects.append(ref)
        elif ref_lower.endswith((".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif")):
            static_images.append(ref)

    keywords = {term for term in PUZZLE_CONTEXT_TERMS if term in normalized}
    return {
        "puzzle_tag": puzzle_tag,
        "keywords": keywords,
        "static_images": sorted(set(static_images)),
        "audio_effects": sorted(set(audio_effects)),
    }


def discover_puzzle_assets(
    repo_root: Path,
    puzzle_tag: str,
    existing_paths: set[str],
    disallowed_fragments: tuple[str, ...],
):
    if not puzzle_tag:
        return []
    scan_roots = [
        repo_root / "static" / "images" / f"puzzle{int(puzzle_tag)}",
    ]
    found = []
    seen = set()
    for root in scan_roots:
        if not root.exists():
            continue
        for path in sorted(root.rglob("*")):
            if not path.is_file():
                continue
            if path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif"}:
                continue
            rel = "/" + str(path.relative_to(repo_root)).replace("\\", "/")
            if is_disallowed_asset_path(rel, disallowed_fragments):
                continue
            if rel in existing_paths or rel in seen:
                continue
            seen.add(rel)
            concept = infer_concept_from_path(rel)
            found.append(
                {
                    "src": rel,
                    "alt": path_to_alt(rel),
                    "concept": concept,
                    "puzzles": [int(puzzle_tag)],
                    "search_blob": normalize_text(str(path)),
                }
            )
    return found[:24]


def discover_assets_from_puzzle_context(
    repo_root: Path,
    puzzle_context: dict,
    existing_paths: set[str],
    disallowed_fragments: tuple[str, ...],
):
    puzzle_tag = puzzle_context.get("puzzle_tag") or ""
    keywords = sorted(puzzle_context.get("keywords") or set())
    found = []
    for ref in puzzle_context.get("static_images", []):
        if is_disallowed_asset_path(ref, disallowed_fragments):
            continue
        if not static_asset_exists(repo_root, ref):
            continue
        if ref in existing_paths:
            continue
        found.append(
            {
                "src": ref,
                "alt": path_to_alt(ref),
                "concept": infer_concept_from_path(ref),
                "puzzles": [int(puzzle_tag)] if puzzle_tag else [],
                "search_blob": normalize_text(" ".join([ref] + keywords)),
            }
        )
        existing_paths.add(ref)
    return found[:16]


def build_asset_candidates(
    scene_id: str,
    image_semantics: dict,
    repo_root: Path,
    puzzle_context: dict,
    disallowed_fragments: tuple[str, ...],
):
    puzzle_tag = SCENE_TO_PUZZLE_TAG.get(scene_id, "")
    candidates = []
    existing_paths = set()
    for src, meta in image_semantics.items():
        if is_disallowed_asset_path(str(src), disallowed_fragments):
            continue
        if not static_asset_exists(repo_root, src):
            continue
        puzzles = meta.get("puzzles", []) if isinstance(meta, dict) else []
        normalized = {str(v).lower() for v in puzzles if isinstance(v, (str, int))}
        if puzzle_tag and puzzle_tag not in normalized and "shared" not in normalized:
            continue
        concept = meta.get("concept", "")
        blob_parts = [
            concept,
            meta.get("notes", ""),
            " ".join(meta.get("best_for", []) if isinstance(meta.get("best_for"), list) else []),
            src,
        ]
        candidates.append(
            {
                "src": src,
                "alt": meta.get("alt") or path_to_alt(src),
                "concept": concept,
                "puzzles": list(puzzles) if isinstance(puzzles, list) else [],
                "search_blob": normalize_text(" ".join(str(p) for p in blob_parts if p)),
            }
        )
        existing_paths.add(src)

    candidates.extend(
        discover_puzzle_assets(repo_root, puzzle_tag, existing_paths, disallowed_fragments)
    )
    candidates.extend(
        discover_assets_from_puzzle_context(repo_root, puzzle_context, existing_paths, disallowed_fragments)
    )
    return candidates


def score_asset_for_subtitle(candidate: dict, subtitle_text: str, puzzle_tag: str, context_keywords: set[str] | None = None):
    text = normalize_text(subtitle_text)
    score = 0
    puzzles = {str(v).lower() for v in candidate.get("puzzles", []) if isinstance(v, (str, int))}
    if puzzle_tag and puzzle_tag in puzzles:
        score += 35
    elif "shared" in puzzles:
        score += 4

    if is_warning_candidate(candidate):
        if subtitle_has_warning_cue(text):
            score += 18
        else:
            score -= 35
    else:
        score += 6

    concept = candidate.get("concept", "")
    for keyword in CONCEPT_KEYWORDS.get(concept, []):
        if keyword in text:
            score += 35

    # Soft semantic overlap with best_for/notes/path tokenization.
    blob = candidate.get("search_blob", "")
    words = [w for w in re.findall(r"[a-z0-9]+", text) if len(w) >= 4]
    overlap = sum(1 for w in words if w in blob)
    score += min(overlap * 4, 20)

    if context_keywords:
        hits = [term for term in context_keywords if term in text]
        if hits:
            context_overlap = sum(1 for term in hits if term in blob)
            score += min(context_overlap * 6, 18)

    # Prefer curated "nuevos iconos" bank for intro readability.
    src = (candidate.get("src") or "").lower()
    if "/static/images/shared/nuevos iconos/" in src:
        score += 12

    preferred = CONCEPT_ASSET_PREFERENCES.get(concept, [])
    if candidate.get("src") in preferred:
        # earlier entries in the preference list are stronger
        score += 24 - (preferred.index(candidate.get("src")) * 6)

    return score


def pick_assets_for_subtitle(
    subtitle_text: str,
    candidates: list,
    puzzle_tag: str,
    used_paths: set[str],
    max_assets: int = 2,
    allow_warning: bool | None = None,
    concept_first_use: dict | None = None,
    context_keywords: set[str] | None = None,
):
    if allow_warning is None:
        allow_warning = subtitle_has_warning_cue(subtitle_text)

    ranked = sorted(
        candidates,
        key=lambda c: (
            score_asset_for_subtitle(c, subtitle_text, puzzle_tag, context_keywords=context_keywords),
            c.get("src", ""),
        ),
        reverse=True,
    )

    def _pick(ignore_used: bool, allow_warning_items: bool):
        picked = []
        for item in ranked:
            src = item.get("src")
            if not src:
                continue
            if not ignore_used and src in used_paths:
                continue
            if not allow_warning_items and is_warning_candidate(item):
                continue
            picked.append({"src": src, "alt": item.get("alt") or path_to_alt(src)})
            if len(picked) >= max_assets:
                break
        return picked

    # First mention of a concept: force puzzle-linked image first; if absent, use shared bank.
    seed_assets = []
    seed_paths = set()
    mentioned_concepts = _extract_mentioned_concepts(subtitle_text)
    if concept_first_use is not None and mentioned_concepts:
        for concept in mentioned_concepts:
            if concept_first_use.get(concept):
                continue

            chosen = None
            for scope in ("puzzle", "shared"):
                for item in ranked:
                    src = item.get("src")
                    if not src or src in seed_paths:
                        continue
                    if item.get("concept") != concept:
                        continue
                    if not allow_warning and is_warning_candidate(item):
                        continue
                    if _candidate_puzzle_scope(item, puzzle_tag) != scope:
                        continue
                    if src in used_paths:
                        continue
                    chosen = item
                    break
                if chosen:
                    break

            if not chosen:
                for scope in ("puzzle", "shared"):
                    for item in ranked:
                        src = item.get("src")
                        if not src or src in seed_paths:
                            continue
                        if item.get("concept") != concept:
                            continue
                        if not allow_warning and is_warning_candidate(item):
                            continue
                        if _candidate_puzzle_scope(item, puzzle_tag) != scope:
                            continue
                        chosen = item
                        break
                    if chosen:
                        break

            if not chosen:
                continue

            seed_assets.append({"src": chosen["src"], "alt": chosen.get("alt") or path_to_alt(chosen["src"])})
            seed_paths.add(chosen["src"])
            concept_first_use[concept] = True
            if len(seed_assets) >= max_assets:
                break

    def _merge_with_seed(items):
        merged = list(seed_assets)
        existing = {item["src"] for item in merged}
        for item in items:
            if item["src"] in existing:
                continue
            merged.append(item)
            existing.add(item["src"])
            if len(merged) >= max_assets:
                break
        return merged[:max_assets]

    # 1) Try best non-used candidates respecting warning policy.
    selected = _merge_with_seed(_pick(ignore_used=False, allow_warning_items=allow_warning))
    # 2) If nothing, allow reuse but keep same warning policy.
    if not selected:
        selected = _merge_with_seed(_pick(ignore_used=True, allow_warning_items=allow_warning))
    # 3) Last resort: allow warnings only when warnings are explicitly allowed.
    if not selected and allow_warning:
        selected = _merge_with_seed(_pick(ignore_used=False, allow_warning_items=True))
        if not selected:
            selected = _merge_with_seed(_pick(ignore_used=True, allow_warning_items=True))

    if selected:
        for item in selected:
            used_paths.add(item["src"])
        return selected

    # Absolute fallback: neutral gameplay assets.
    return [
        {"src": "/static/images/shared/gameplay/token_card.png", "alt": "Token"},
        {"src": "/static/images/shared/gameplay/terminal_box.png", "alt": "Terminal"},
    ][:max_assets]


def pick_asset_for_concept(
    concept: str,
    subtitle_text: str,
    candidates: list,
    puzzle_tag: str,
    used_paths: set[str],
    context_keywords: set[str] | None = None,
):
    if not concept:
        return None

    concept_aliases = {
        "error_operacion": {"error_operacion", "error_atencion", "veredicto_error", "respuesta_incorrecta"},
        "reinicio": {"reinicio", "repeticion"},
        "token": {"token", "token_complementario"},
        "terminal": {"terminal", "terminal_complementario"},
    }
    accepted_concepts = concept_aliases.get(concept, {concept})
    preferred_paths = set(CONCEPT_ASSET_PREFERENCES.get(concept, []))

    ranked = sorted(
        [
            c for c in candidates
            if (c.get("concept") in accepted_concepts or c.get("src") in preferred_paths)
            and not is_warning_candidate(c)
        ],
        key=lambda c: (
            _asset_semantic_rank(c.get("src"), puzzle_tag, {c.get("src"): {"puzzles": c.get("puzzles", [])}}),
            -score_asset_for_subtitle(c, subtitle_text, puzzle_tag, context_keywords=context_keywords),
            c.get("src", ""),
        ),
    )
    for item in ranked:
        src = item.get("src")
        if not src or src in used_paths:
            continue
        used_paths.add(src)
        return {"src": src, "alt": item.get("alt") or path_to_alt(src)}
    return None


def replace_tokens(node, mapping):
    if isinstance(node, dict):
        return {k: replace_tokens(v, mapping) for k, v in node.items()}
    if isinstance(node, list):
        return [replace_tokens(v, mapping) for v in node]
    if isinstance(node, str):
        out = node
        for key, value in mapping.items():
            out = out.replace(key, value)
        return out
    return node


def pick_sfx_for_text(text: str, puzzle_context: dict | None = None):
    t = normalize_text(text)
    if any(k in t for k in ("error", "limite", "reinici", "agot", "fall")):
        return "warning"
    if "token" in t:
        return "token"
    if any(k in t for k in ("tiempo", "segundo", "cronometro", "cuenta", "ronda", "fase")):
        return "pulse"
    context_keywords = (puzzle_context or {}).get("keywords") or set()
    if context_keywords.intersection({"timer", "time", "countdown", "round"}) and any(
        k in t for k in ("inicio", "empieza", "fase", "ronda")
    ):
        return "pulse"
    return "objective"


def timeline_with_starts(scene):
    items = []
    cursor = 0.0
    for idx, segment in enumerate(scene.get("segments", [])):
        duration = float(segment.get("duration", 0) or 0)
        items.append((idx, cursor, duration, segment))
        cursor += duration
    return items


def collect_subtitle_points(subtitles, start_abs, end_abs):
    points = []
    for sub in subtitles or []:
        s = sub.get("start")
        e = sub.get("end")
        text = (sub.get("text") or "").strip()
        if not isinstance(s, (int, float)) or not isinstance(e, (int, float)) or not text:
            continue
        if e <= start_abs or s >= end_abs:
            continue
        rel = max(0.0, float(s) - float(start_abs))
        points.append({"at": rel, "text": text})
    points.sort(key=lambda x: x["at"])

    dedup = []
    seen = set()
    for p in points:
        key = (round(p["at"], 3), p["text"])
        if key in seen:
            continue
        seen.add(key)
        dedup.append(p)
    return dedup


def resolve_static_path(repo_root: Path, static_url: str):
    if not isinstance(static_url, str) or not static_url.startswith("/static/"):
        return None
    return repo_root / static_url.lstrip("/")


def read_wav_duration_seconds(path: Path):
    if not path.exists() or path.suffix.lower() != ".wav":
        return None
    try:
        with wave.open(str(path), "rb") as wav_file:
            return wav_file.getnframes() / wav_file.getframerate()
    except Exception:
        return None


def is_countdown_segment(segment: dict):
    return (
        isinstance(segment, dict)
        and segment.get("type") == "transition"
        and segment.get("variant") == "countdown"
    )


def split_precountdown_and_countdown(segments: list):
    first_countdown_index = None
    for idx, segment in enumerate(segments or []):
        if is_countdown_segment(segment):
            first_countdown_index = idx
            break
    if first_countdown_index is None:
        return list(segments or []), []
    return list(segments[:first_countdown_index]), list(segments[first_countdown_index:])


def fit_scene_duration_to_audio(scene, repo_root: Path):
    audio_src = ((scene.get("audio") or {}).get("src") or "").strip()
    audio_path = resolve_static_path(repo_root, audio_src)
    audio_duration = read_wav_duration_seconds(audio_path) if audio_path else None
    if not isinstance(audio_duration, (int, float)) or audio_duration <= 0:
        return None

    segments = scene.get("segments", [])
    pre_segments, countdown_segments = split_precountdown_and_countdown(segments)
    pre_duration = sum(float(s.get("duration", 0) or 0) for s in pre_segments)
    delta = float(audio_duration) - float(pre_duration)
    if abs(delta) <= 0.01:
        return float(audio_duration)

    fullscreen_indices = [i for i, s in enumerate(pre_segments) if s.get("type") == "fullscreen_ui"]
    adjustable_indices = fullscreen_indices or [
        i for i, s in enumerate(pre_segments) if isinstance(s.get("duration"), (int, float))
    ]
    if not adjustable_indices:
        return float(audio_duration)

    remaining = float(delta)

    for idx in reversed(adjustable_indices):
        if abs(remaining) <= 0.005:
            break
        segment = pre_segments[idx]
        current = float(segment.get("duration", 0) or 0)
        min_duration = 3.5 if segment.get("type") == "fullscreen_ui" else 1.0
        if remaining > 0:
            segment["duration"] = round(current + remaining, 6)
            remaining = 0.0
            break

        max_reduction = max(0.0, current - min_duration)
        reduction = min(max_reduction, -remaining)
        segment["duration"] = round(current - reduction, 6)
        remaining += reduction

    if abs(remaining) > 0.005:
        idx = adjustable_indices[-1]
        segment = pre_segments[idx]
        current = float(segment.get("duration", 0) or 0)
        segment["duration"] = round(max(0.2, current + remaining), 6)

    if countdown_segments:
        scene["segments"] = pre_segments + countdown_segments

    return float(audio_duration)


def infer_asset_count(text: str, allow_equals_visual: bool):
    if allow_equals_visual:
        return 2
    return 1


def condense_phase_points(phase_points: list, visual_duration: float):
    if not phase_points:
        return []
    safe_end = max(0.0, visual_duration - 0.2)
    max_points = max(1, min(4, int(max(1.0, visual_duration) // 4)))

    filtered = []
    last_at = None
    for point in phase_points:
        at = float(point.get("at", 0) or 0)
        if at > safe_end:
            break
        if last_at is not None and at - last_at < MIN_VISUAL_PHASE_GAP:
            continue
        filtered.append({"at": at, "text": point.get("text", "")})
        last_at = at
        if len(filtered) >= max_points:
            break
    return filtered or [{"at": 0.0, "text": (phase_points[0].get("text") or "objetivo")}]


def _stable_hash(value: str) -> str:
    return hashlib.sha1(value.encode("utf-8")).hexdigest()


def build_character_library(media_catalog):
    role_to_clips = {}
    used_counts = {}

    characters = media_catalog.get("characters", {})
    for key, meta in characters.items():
        path = meta.get("path")
        role = meta.get("role")
        if not path or not role:
            continue
        item = {
            "key": key,
            "path": path,
            "role": role,
            "duration": meta.get("duration"),
        }
        role_to_clips.setdefault(role, []).append(item)
        used_counts[path] = len(meta.get("used_in", []))

    for role in role_to_clips:
        role_to_clips[role].sort(key=lambda c: c["key"])

    return role_to_clips, used_counts


def merge_character_intents(entry, defaults):
    merged = {}
    for source in (defaults.get("character_intents", {}), entry.get("character_intents", {})):
        if isinstance(source, dict):
            merged.update(source)
    return merged


def pick_character_clip(intent, role_to_clips, used_counts, scene_id, segment_key, scene_used_paths):
    preferred_roles = INTENT_ROLE_PREFERENCES.get(intent, [intent, "neutral_intro", "briefing_short"])
    candidates = []
    for role in preferred_roles:
        candidates.extend(role_to_clips.get(role, []))

    if scene_used_paths:
        filtered = [c for c in candidates if c["path"] not in scene_used_paths]
        if filtered:
            candidates = filtered

    if not candidates:
        for clips in role_to_clips.values():
            candidates.extend(clips)
    if scene_used_paths:
        filtered = [c for c in candidates if c["path"] not in scene_used_paths]
        if filtered:
            candidates = filtered
    if not candidates:
        return None

    def rank_key(clip):
        used = used_counts.get(clip["path"], 0)
        tie = _stable_hash(f"{scene_id}:{segment_key}:{clip['path']}")
        return (used, tie)

    selected = sorted(candidates, key=rank_key)[0]
    used_counts[selected["path"]] = used_counts.get(selected["path"], 0) + 1
    return selected


def apply_character_casting(scene, entry, defaults, role_to_clips, used_counts):
    intents_by_label = merge_character_intents(entry, defaults)
    scene_id = canonical_scene_id(entry)
    scene_used_paths = set()
    lock_opening_character = entry.get(
        "lock_opening_character",
        defaults.get("lock_opening_character", True),
    )
    lock_closing_character = entry.get(
        "lock_closing_character",
        defaults.get("lock_closing_character", False),
    )

    for idx, segment in enumerate(scene.get("segments", [])):
        if segment.get("type") != "character":
            continue

        # Keep the very first Cero appearance stable across all intros by default.
        if idx == 0 and lock_opening_character:
            if isinstance(segment.get("src"), str):
                scene_used_paths.add(segment["src"])
            continue

        label = segment.get("label") or f"character_{idx}"

        # Keep the final pre-countdown Cero clip stable across intros by default.
        if lock_closing_character and label == "cierre_suave":
            if isinstance(segment.get("src"), str):
                scene_used_paths.add(segment["src"])
            continue

        intent = intents_by_label.get(label, SEGMENT_LABEL_DEFAULT_INTENT.get(label, "briefing"))
        selected = pick_character_clip(intent, role_to_clips, used_counts, scene_id, label, scene_used_paths)
        if not selected:
            continue

        segment["src"] = selected["path"]
        scene_used_paths.add(selected["path"])
        segment["clip_start"] = 0

        clip_duration = selected.get("duration")
        seg_duration = segment.get("duration")
        if isinstance(clip_duration, (int, float)) and clip_duration > 0:
            if isinstance(seg_duration, (int, float)) and seg_duration > 0:
                segment["clip_end"] = round(min(float(clip_duration), float(seg_duration)), 6)
            else:
                segment["clip_end"] = round(float(clip_duration), 6)


def build_scene(
    template,
    entry,
    defaults,
    repo_root: Path,
    role_to_clips,
    used_counts,
    image_semantics,
):
    scene = copy.deepcopy(template)

    scene_id = canonical_scene_id(entry)
    allow_equals_visual = is_sumas_scene(scene_id)
    subtitles = resolve_subtitles(entry, repo_root, scene_id)
    resolved_game_title, resolved_headline = resolve_intro_titles(entry, scene_id, subtitles)
    audio_src = resolve_audio_src(entry, scene_id)
    puzzle_context = load_puzzle_context(repo_root, scene_id)

    mapping = {
        "__SCENE_ID__": scene_id,
        "__GAME_TITLE__": resolved_game_title,
        "__HEADLINE__": resolved_headline,
        "__AUDIO_SRC__": audio_src,
    }
    scene = replace_tokens(scene, mapping)

    scene["description"] = (
        f"Intro generada para {scene_id} con flujo Cero + objetivo + bloques visuales."
    )

    # Subtitle overlay should always come from subtitles folder (or explicit override).
    scene["subtitles"] = subtitles

    # Audio defines the final intro length.
    audio_duration = fit_scene_duration_to_audio(scene, repo_root)
    require_audio_duration = entry.get(
        "require_audio_duration",
        defaults.get("require_audio_duration", True),
    )
    if require_audio_duration and not isinstance(audio_duration, (int, float)):
        raise RuntimeError(f"{scene_id}: missing/invalid WAV audio for duration sync -> {audio_src}")
    scene["subtitles"] = normalize_subtitles_timeline(scene["subtitles"], max_duration=audio_duration)
    subtitles = scene["subtitles"]

    puzzle_tag = SCENE_TO_PUZZLE_TAG.get(scene_id, "")
    disallowed_fragments = resolve_disallowed_asset_path_fragments(defaults)
    asset_candidates = build_asset_candidates(
        scene_id,
        image_semantics,
        repo_root,
        puzzle_context,
        disallowed_fragments,
    )
    used_paths = set()
    concept_first_use = {}
    context_keywords = puzzle_context.get("keywords") or set()

    timeline = timeline_with_starts(scene)
    segment2 = next((item for item in timeline if item[0] == 1), None)
    segment4 = next((item for item in timeline if item[0] == 3), None)

    points2 = []
    points4 = []
    if segment2:
        _, start2, dur2, _ = segment2
        points2 = collect_subtitle_points(subtitles, start2, start2 + dur2)
    if segment4:
        _, start4, dur4, _ = segment4
        points4 = collect_subtitle_points(subtitles, start4, start4 + dur4)

    objective_points_with_objects = [p for p in points2 if _extract_mentioned_concepts(p.get("text", ""))]
    objective_hint = (
        objective_points_with_objects[0]["text"]
        if objective_points_with_objects
        else (points2[0]["text"] if points2 else (resolved_headline or "objetivo"))
    )
    objective_assets_at = (
        objective_points_with_objects[0]["at"]
        if objective_points_with_objects
        else (
            points2[0]["at"]
            if points2
            else float(scene["segments"][1].get("duration", 0) or 0) * 0.45
        )
    )
    objective_concepts = _extract_mentioned_concepts(objective_hint)
    temp_used_paths = set(used_paths)
    objective_assets = pick_assets_for_subtitle(
        objective_hint,
        asset_candidates,
        puzzle_tag,
        temp_used_paths,
        max_assets=infer_asset_count(objective_hint, allow_equals_visual=False),
        allow_warning=False,
        concept_first_use=concept_first_use,
        context_keywords=context_keywords,
    )

    # Objective block: large text + subtitle-matched assets.
    scene["segments"][1]["variant"] = "immersive-strip"
    objective_text = (
        SEGMENTS_OBJECTIVE_TEXT if scene_id == "scene_intro_segments" else (resolved_headline or "OBJETIVO")
    )
    objective_phases = [
        {
            "at": 0,
            "sfx": "objective",
            "variant": "immersive-strip",
            "top": {"variant": "immersive-strip", "text": objective_text},
        }
    ]
    objective_phase_at = round(max(2.4, objective_assets_at), 3)
    force_segments_patterns = scene_id == "scene_intro_segments"
    if force_segments_patterns:
        objective_phase_at = round(max(SEGMENTS_OBJECTIVE_MIN_TEXT_SECONDS, objective_phase_at), 3)
    elif len(objective_concepts) >= 2:
        first_asset = pick_asset_for_concept(
            objective_concepts[0],
            objective_hint,
            asset_candidates,
            puzzle_tag,
            used_paths,
            context_keywords=context_keywords,
        )
        second_asset = pick_asset_for_concept(
            objective_concepts[1],
            objective_hint,
            asset_candidates,
            puzzle_tag,
            used_paths,
            context_keywords=context_keywords,
        )
        if first_asset and second_asset:
            objective_phases.append(
                {
                    "at": objective_phase_at,
                    "sfx": pick_sfx_for_text(objective_hint, puzzle_context),
                    "variant": "immersive-strip",
                    "top": {"variant": "immersive-strip", "assets": [first_asset]},
                }
            )
            objective_phases.append(
                {
                    "at": round(objective_phase_at + 1.0, 3),
                    "sfx": "objective",
                    "variant": "immersive-strip",
                    "top": {"variant": "immersive-strip", "assets": [first_asset, second_asset]},
                }
            )
        else:
            for asset in objective_assets:
                if asset.get("src"):
                    used_paths.add(asset["src"])
            objective_phases.append(
                {
                    "at": objective_phase_at,
                    "sfx": pick_sfx_for_text(objective_hint, puzzle_context),
                    "variant": "immersive-strip",
                    "top": {"variant": "immersive-strip", "assets": objective_assets},
                }
            )
    else:
        for asset in objective_assets:
            if asset.get("src"):
                used_paths.add(asset["src"])
        objective_phases.append(
            {
                "at": objective_phase_at,
                "sfx": pick_sfx_for_text(objective_hint, puzzle_context),
                "variant": "immersive-strip",
                "top": {"variant": "immersive-strip", "assets": objective_assets},
            }
        )
    scene["segments"][1]["phases"] = objective_phases

    if scene_id == "scene_intro_segments" and len(scene.get("segments", [])) > 2:
        segment_two_duration = float(scene["segments"][2].get("duration", 0) or 0)
        if segment_two_duration < 0.5:
            segment_two_duration = 3.7
        scene["segments"][2] = {
            "type": "transition",
            "duration": round(segment_two_duration, 3),
            "variant": "puzzle10-patterns",
            "patterns": build_segments_pattern_codes(),
            "sfx": "objective",
        }

    # Visual block only (no big middle text): switch icons at subtitle timestamps.
    visual_duration = float(scene["segments"][3].get("duration", 0) or 0)
    visual_safe_end = max(0.0, visual_duration - 0.2)
    default_points = [
        {"at": 0.0, "text": resolved_headline or "objetivo"},
        {"at": round(min(visual_safe_end, max(1.0, visual_duration * 0.33)), 3), "text": "token terminal"},
        {"at": round(min(visual_safe_end, max(1.8, visual_duration * 0.66)), 3), "text": "botones luces"},
    ]
    phase_points = []
    if points4:
        for point in points4:
            concepts = _extract_mentioned_concepts(point.get("text", ""))
            if not concepts:
                continue
            if phase_points and abs(float(point["at"]) - float(phase_points[-1]["at"])) < 0.6:
                continue
            phase_points.append(point)
    if not phase_points:
        phase_points = default_points
    phase_points = condense_phase_points(phase_points, visual_duration)

    scene["segments"][3]["variant"] = "immersive-strip"
    visual_phases = []
    for index, point in enumerate(phase_points):
        assets = pick_assets_for_subtitle(
            point["text"],
            asset_candidates,
            puzzle_tag,
            used_paths,
            max_assets=infer_asset_count(point["text"], allow_equals_visual=allow_equals_visual),
            allow_warning=subtitle_has_warning_cue(point["text"]),
            concept_first_use=concept_first_use,
            context_keywords=context_keywords,
        )

        min_at = 0.0 if index == 0 else visual_phases[-1]["at"] + MIN_VISUAL_PHASE_GAP
        at_value = round(max(min_at, float(point["at"])), 3)
        if at_value > visual_safe_end:
            if not visual_phases:
                at_value = 0.0
            elif visual_safe_end - visual_phases[-1]["at"] < 0.45:
                break
            else:
                at_value = round(visual_safe_end, 3)
        visual_phases.append(
            {
                "at": at_value,
                "sfx": pick_sfx_for_text(point["text"], puzzle_context),
                "variant": "immersive-strip",
                "top": {
                    "variant": "immersive-strip",
                    "show_equals": allow_equals_visual and len(assets) == 2,
                    "assets": assets,
                },
            }
        )

    if scene_id == "scene_intro_segments":
        phase_asset_plan = [
            ("token", ["/static/images/shared/gameplay/token_card.png"]),
            ("token", ["/static/images/shared/terminal_3d/buttons_panel_front.png"]),
            ("objective", ["/static/images/shared/terminal_3d/scanner_bar_on.png"]),
            ("token", ["/static/images/shared/gameplay/terminal_box.png"]),
            ("objective", ["/static/images/shared/nuevos iconos/tira led.png"]),
            ("token", ["/static/images/shared/nuevos iconos/base nfc con token.png"]),
            ("warning", ["/static/images/shared/nuevos iconos/temporizador.png"]),
            ("objective", ["/static/images/shared/terminal_3d/terminal_box_buttons_numbers_front.png"]),
        ]
        at_points = (
            [
                float(point.get("at", 0) or 0)
                for point in points4
                if float(point.get("at", 0) or 0) > 0.4
            ]
            if points4
            else []
        )
        if len(at_points) < len(phase_asset_plan):
            fallback = [0.78, 7.26, 10.94, 14.62, 19.26, 24.30, 28.30, 32.54]
            at_points = fallback[:]

        forced_phases = []
        for idx, (sfx, src_list) in enumerate(phase_asset_plan):
            if idx >= len(at_points):
                break
            at_value = round(max(0.0, at_points[idx]), 3)
            if at_value > visual_safe_end:
                continue

            assets = []
            for src in src_list:
                if not static_asset_exists(repo_root, src):
                    continue
                assets.append({"src": src, "alt": path_to_alt(src)})
                used_paths.add(src)
            if not assets:
                continue

            forced_phases.append(
                {
                    "at": at_value,
                    "sfx": sfx,
                    "variant": "immersive-strip",
                    "top": {
                        "variant": "immersive-strip",
                        "show_equals": False,
                        "assets": assets,
                    },
                }
            )

        if forced_phases:
            visual_phases = forced_phases
    scene["segments"][3]["phases"] = visual_phases

    # Countdown has to start only after audio ends. We keep 3 transitions (3-2-1),
    # 1 second each, and trigger a countdown pip on each number.
    _, countdown_segments = split_precountdown_and_countdown(scene.get("segments", []))
    for segment in countdown_segments:
        if is_countdown_segment(segment):
            segment["sfx"] = "countdown"

    # Assign character clips by narrative intent (intro/briefing/warning/close).
    apply_character_casting(scene, entry, defaults, role_to_clips, used_counts)

    # Keep overlay title explicit too
    scene["broadcast_title"] = resolved_game_title
    apply_large_three_asset_layout(scene)

    return scene


def main():
    parser = argparse.ArgumentParser(description="Generate intro scenes from template+catalog.")
    parser.add_argument("--catalog", default="scenes/catalog/intro_catalog.json", help="Path to intro catalog JSON")
    parser.add_argument("--template", default=None, help="Optional template path override")
    parser.add_argument("--output-root", default=None, help="Optional output root override")
    parser.add_argument("--force", action="store_true", help="Overwrite existing generated configs")
    parser.add_argument(
        "--transcribe-subtitles",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Auto-generate subtitles from audio with openai-whisper for generated scenes (default: enabled)",
    )
    parser.add_argument("--whisper-model", default="tiny", help="Whisper model name (default: tiny)")
    parser.add_argument("--whisper-language", default="es", help="Whisper language code (default: es)")
    parser.add_argument("--whisper-device", default="cpu", help="Whisper device (default: cpu)")
    parser.add_argument(
        "--whisper-cache-dir",
        default=None,
        help="Whisper cache/model directory (default: .cache/whisper or WHISPER_CACHE_DIR env)",
    )
    parser.add_argument("--subtitles-lang", default="es", help="Subtitle language folder/extension (default: es)")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    catalog_path = (repo_root / args.catalog).resolve()
    catalog = load_json(catalog_path)

    template_path = (repo_root / (args.template or catalog["template"]))
    template = load_json(template_path)

    output_root = repo_root / (args.output_root or catalog.get("default_output_root", "scenes/source/intros/intropuzzles"))
    media_catalog_path = repo_root / catalog.get("media_catalog", "scenes/catalog/media_catalog.json")
    media_catalog = load_json(media_catalog_path) if media_catalog_path.exists() else {}

    defaults = catalog.get("defaults", {})
    entries = catalog.get("entries", [])
    image_semantics = load_image_semantics(repo_root, catalog)
    role_to_clips, used_counts = build_character_library(media_catalog)

    created = []
    skipped = []
    transcribed = []
    whisper_models = {}
    default_cache_dir = os.environ.get("WHISPER_CACHE_DIR", ".cache/whisper")
    whisper_cache_dir = (repo_root / (args.whisper_cache_dir or default_cache_dir)).resolve()

    for entry in entries:
        scene_id = canonical_scene_id(entry)
        out_file = output_root / scene_id / "config.json"

        if out_file.exists() and not args.force:
            skipped.append(str(out_file))
            continue

        entry_for_build = copy.deepcopy(entry)
        if args.transcribe_subtitles:
            subtitles_path = transcribe_subtitles_for_entry(
                entry=entry_for_build,
                repo_root=repo_root,
                scene_id=scene_id,
                whisper_model_name=args.whisper_model,
                whisper_language=args.whisper_language,
                whisper_device=args.whisper_device,
                whisper_cache_dir=whisper_cache_dir,
                whisper_models=whisper_models,
                lang_code=args.subtitles_lang,
            )
            if subtitles_path:
                entry_for_build["subtitles_path"] = subtitles_path
                transcribed.append(str(repo_root / subtitles_path))

        scene = build_scene(
            template,
            entry_for_build,
            defaults,
            repo_root,
            role_to_clips,
            used_counts,
            image_semantics,
        )
        dump_json(out_file, scene)
        created.append(str(out_file))

    print(f"Generated: {len(created)}")
    for path in created:
        print(f"  + {path}")
    if transcribed:
        print(f"Transcribed subtitles: {len(transcribed)}")
        for path in transcribed:
            print(f"  * {path}")
    if skipped:
        print(f"Skipped (exists): {len(skipped)}")
        for path in skipped:
            print(f"  - {path}")


if __name__ == "__main__":
    main()
