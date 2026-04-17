#!/usr/bin/env python3
import argparse
import copy
import hashlib
import json
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


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def dump_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def load_between_briefs(repo_root: Path, catalog: dict):
    defaults = catalog.get("defaults", {})
    brief_path = defaults.get(
        "between_brief_path",
        "scenes/source/transicion/scene_between_puzzles/config.json",
    )
    path = (repo_root / brief_path).resolve()
    if not path.exists():
        return {}
    data = load_json(path)
    return data.get("brief_by_scene", {}) if isinstance(data, dict) else {}


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


def resolve_intro_titles(entry: dict, defaults: dict, between_briefs: dict, scene_id: str):
    brief = between_briefs.get(scene_id, {}) if isinstance(between_briefs, dict) else {}
    use_between = entry.get("use_between_brief", defaults.get("use_between_brief", False))

    entry_game_title = entry.get("game_title", "")
    entry_headline = entry.get("headline", "")
    brief_title = brief.get("title", "")
    brief_objective = brief.get("objective", "")

    if use_between:
        game_title = brief_title or entry_game_title
        # En la intro, el texto principal debe ser el objetivo (no el nombre de la prueba).
        headline = brief_objective or entry_headline or brief_title
    else:
        game_title = entry_game_title or brief_title
        headline = entry_headline or brief_objective or brief_title

    return game_title, headline


def canonical_scene_id(entry: dict):
    explicit = (entry.get("scene_id") or "").strip()
    if explicit:
        return explicit
    source = (
        entry.get("legacy_scene_id")
        or entry.get("output_scene_id")
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
    srt_path = repo_root / "scenes" / "subtitles" / "es" / f"intro_puzzle_{int(puzzle_tag):02d}.es.srt"
    return parse_srt_file(srt_path)


def infer_duration_from_subtitles(subtitles):
    if not subtitles:
        return None
    end = max((float(s.get("end", 0) or 0) for s in subtitles), default=0.0)
    return end if end > 0 else None


def normalize_text(text: str):
    text = unicodedata.normalize("NFD", text or "")
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return text.lower()


def path_to_alt(src: str):
    base = src.rsplit("/", 1)[-1].rsplit(".", 1)[0]
    label = base.replace("_", " ").replace("-", " ").strip()
    return label.capitalize() if label else "Recurso visual"


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


def discover_puzzle_assets(repo_root: Path, puzzle_tag: str, existing_paths: set[str]):
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


def build_asset_candidates(scene_id: str, image_semantics: dict, repo_root: Path):
    puzzle_tag = SCENE_TO_PUZZLE_TAG.get(scene_id, "")
    candidates = []
    existing_paths = set()
    for src, meta in image_semantics.items():
        if "/old_pics/" in str(src):
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

    candidates.extend(discover_puzzle_assets(repo_root, puzzle_tag, existing_paths))
    return candidates


def score_asset_for_subtitle(candidate: dict, subtitle_text: str, puzzle_tag: str):
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
    return score


def pick_assets_for_subtitle(
    subtitle_text: str,
    candidates: list,
    puzzle_tag: str,
    used_paths: set[str],
    max_assets: int = 2,
    allow_warning: bool | None = None,
    concept_first_use: dict | None = None,
):
    if allow_warning is None:
        allow_warning = subtitle_has_warning_cue(subtitle_text)

    ranked = sorted(
        candidates,
        key=lambda c: (score_asset_for_subtitle(c, subtitle_text, puzzle_tag), c.get("src", "")),
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


def _normalize_assets(raw_assets):
    assets = []
    for item in raw_assets or []:
        if not isinstance(item, dict):
            continue
        src = item.get("src")
        if not isinstance(src, str) or not src.strip():
            continue
        normalized = {"src": src}
        alt = item.get("alt")
        if isinstance(alt, str) and alt.strip():
            normalized["alt"] = alt
        assets.append(normalized)
    return assets


def infer_assets_from_legacy(legacy):
    """
    Infer intro/warning visual assets from the legacy scene fullscreen phases.
    This keeps each v2 intro visually tied to its puzzle without hardcoding.
    """
    fullscreen_lists = []
    for segment in legacy.get("segments", []):
        if segment.get("type") != "fullscreen_ui":
            continue
        segment_lists = []
        for phase in segment.get("phases", []):
            merged_assets = []
            for zone in ("top", "left", "right"):
                zone_assets = _normalize_assets((phase.get(zone) or {}).get("assets"))
                merged_assets.extend(zone_assets)
            if merged_assets:
                segment_lists.append(merged_assets)
        if segment_lists:
            fullscreen_lists.append(segment_lists)

    if not fullscreen_lists:
        return None, None

    # Intro: use the richest list in the first fullscreen segment
    # (usually the phase where all key elements are already visible).
    intro_assets = max(fullscreen_lists[0], key=lambda items: len(items))

    # Warnings: distinct lists from remaining fullscreen segments (or fallback to first).
    warning_source = []
    for segment_lists in fullscreen_lists[1:] or fullscreen_lists:
        warning_source.extend(segment_lists)

    distinct = []
    seen = set()
    for asset_list in warning_source:
        key = tuple(a["src"] for a in asset_list)
        if key in seen:
            continue
        seen.add(key)
        distinct.append(asset_list)

    warning_lists = distinct or [intro_assets]
    while len(warning_lists) < 3:
        warning_lists.append(warning_lists[-1])
    warning_pairs = warning_lists[:3]
    return intro_assets, warning_pairs


def sync_segment_timing_from_legacy(scene, legacy):
    """
    Copy timing profile from legacy scene when possible:
    - segment durations by index
    - phase "at" times by index within fullscreen_ui segments
    """
    target_segments = scene.get("segments", [])
    legacy_segments = legacy.get("segments", [])

    for idx, segment in enumerate(target_segments):
        if idx >= len(legacy_segments):
            continue
        legacy_segment = legacy_segments[idx]
        if segment.get("type") != legacy_segment.get("type"):
            continue

        if isinstance(legacy_segment.get("duration"), (int, float)):
            segment["duration"] = legacy_segment["duration"]

        target_phases = segment.get("phases")
        legacy_phases = legacy_segment.get("phases")
        if not isinstance(target_phases, list) or not isinstance(legacy_phases, list):
            continue

        for pidx, phase in enumerate(target_phases):
            if pidx >= len(legacy_phases):
                continue
            legacy_at = legacy_phases[pidx].get("at")
            if isinstance(legacy_at, (int, float)):
                phase["at"] = legacy_at


def pick_sfx_for_text(text: str):
    t = text.lower()
    if any(k in t for k in ("error", "límite", "limite", "reinici", "agot", "fall")):
        return "warning"
    if "token" in t:
        return "token"
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


def apply_subtitle_driven_fullscreen(scene, entry, defaults, resolved_headline=""):
    enabled = entry.get(
        "auto_fullscreen_from_subtitles",
        defaults.get("auto_fullscreen_from_subtitles", False),
    )
    if not enabled:
        return

    subtitles = scene.get("subtitles", [])
    headline = resolved_headline or entry.get("headline", "")

    fullscreen_indices = [i for i, seg in enumerate(scene.get("segments", [])) if seg.get("type") == "fullscreen_ui"]
    if not fullscreen_indices:
        return

    first_fullscreen = fullscreen_indices[0]
    for idx, start_abs, duration, segment in timeline_with_starts(scene):
        if segment.get("type") != "fullscreen_ui":
            continue

        end_abs = start_abs + duration
        subtitle_points = collect_subtitle_points(subtitles, start_abs, end_abs)
        phases = []

        if idx == first_fullscreen:
            phases.append(
                {
                    "at": 0,
                    "sfx": "objective",
                    "variant": "immersive-strip",
                    "top": {"variant": "immersive-strip", "text": headline or "OBJETIVO"},
                }
            )
            for point in subtitle_points:
                if point["at"] < 1.2:
                    continue
                phases.append(
                    {
                        "at": round(point["at"], 3),
                        "sfx": pick_sfx_for_text(point["text"]),
                        "variant": "immersive-strip",
                        "top": {"variant": "immersive-strip", "text": point["text"]},
                    }
                )
        else:
            if subtitle_points:
                for point in subtitle_points:
                    phases.append(
                        {
                            "at": round(point["at"], 3),
                            "sfx": pick_sfx_for_text(point["text"]),
                            "variant": "immersive-strip",
                            "top": {"variant": "immersive-strip", "text": point["text"]},
                        }
                    )
            else:
                phases.append(
                    {
                        "at": 0,
                        "sfx": "objective",
                        "variant": "immersive-strip",
                        "top": {"variant": "immersive-strip", "text": headline or "OBJETIVO"},
                    }
                )

        if not phases:
            phases = [
                {
                    "at": 0,
                    "sfx": "objective",
                    "variant": "immersive-strip",
                    "top": {"variant": "immersive-strip", "text": headline or "OBJETIVO"},
                }
            ]

        segment["variant"] = "immersive-strip"
        segment["phases"] = phases


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


def fit_scene_duration_to_audio(scene, repo_root: Path):
    audio_src = ((scene.get("audio") or {}).get("src") or "").strip()
    audio_path = resolve_static_path(repo_root, audio_src)
    audio_duration = read_wav_duration_seconds(audio_path) if audio_path else None
    if not isinstance(audio_duration, (int, float)) or audio_duration <= 0:
        return

    segments = scene.get("segments", [])
    scene_duration = sum(float(s.get("duration", 0) or 0) for s in segments)
    delta = float(audio_duration) - float(scene_duration)
    if delta <= 0.05:
        return

    fullscreen_indices = [i for i, s in enumerate(segments) if s.get("type") == "fullscreen_ui"]
    if fullscreen_indices:
        target = segments[fullscreen_indices[-1]]
    else:
        target = next((s for s in reversed(segments) if isinstance(s.get("duration"), (int, float))), None)
    if target is None:
        return

    target["duration"] = round(float(target.get("duration", 0) or 0) + delta, 6)


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
    between_briefs,
    image_semantics,
):
    scene = copy.deepcopy(template)

    scene_id = canonical_scene_id(entry)
    allow_equals_visual = is_sumas_scene(scene_id)
    resolved_game_title, resolved_headline = resolve_intro_titles(entry, defaults, between_briefs, scene_id)
    audio_src = resolve_audio_src(entry, scene_id)
    subtitles = resolve_subtitles(entry, repo_root, scene_id)

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

    # If audio is missing, keep scene duration aligned to subtitle timeline.
    subtitle_duration = infer_duration_from_subtitles(subtitles)
    if subtitle_duration:
        segments = scene.get("segments", [])
        current_duration = sum(float(s.get("duration", 0) or 0) for s in segments)
        delta = float(subtitle_duration) - current_duration
        if delta > 0.05 and len(segments) > 3 and segments[3].get("type") == "fullscreen_ui":
            segments[3]["duration"] = round(float(segments[3].get("duration", 0) or 0) + delta, 6)

    # Ensure total scene duration reaches real audio length when WAV exists.
    fit_scene_duration_to_audio(scene, repo_root)

    puzzle_tag = SCENE_TO_PUZZLE_TAG.get(scene_id, "")
    asset_candidates = build_asset_candidates(scene_id, image_semantics, repo_root)
    used_paths = set()
    concept_first_use = {}

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
    objective_assets = pick_assets_for_subtitle(
        objective_hint,
        asset_candidates,
        puzzle_tag,
        used_paths,
        max_assets=2,
        allow_warning=False,
        concept_first_use=concept_first_use,
    )

    # Objective block: large text + subtitle-matched assets.
    scene["segments"][1]["variant"] = "immersive-strip"
    scene["segments"][1]["phases"] = [
        {
            "at": 0,
            "sfx": "objective",
            "variant": "immersive-strip",
            "top": {"variant": "immersive-strip", "text": resolved_headline or "OBJETIVO"},
        },
        {
            "at": round(
                max(
                    2.4,
                    objective_assets_at,
                ),
                3,
            ),
            "sfx": "objective",
            "variant": "immersive-strip",
            "top": {"variant": "immersive-strip", "assets": objective_assets},
        },
    ]

    # Visual block only (no big middle text): switch icons at subtitle timestamps.
    visual_duration = float(scene["segments"][3].get("duration", 0) or 0)
    default_points = [
        {"at": 0.0, "text": resolved_headline or "objetivo"},
        {"at": round(max(2.8, visual_duration * 0.33), 3), "text": "token terminal"},
        {"at": round(max(5.6, visual_duration * 0.66), 3), "text": "botones luces"},
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

    scene["segments"][3]["variant"] = "immersive-strip"
    visual_phases = []
    for index, point in enumerate(phase_points):
        assets = pick_assets_for_subtitle(
            point["text"],
            asset_candidates,
            puzzle_tag,
            used_paths,
            max_assets=2,
            allow_warning=subtitle_has_warning_cue(point["text"]),
            concept_first_use=concept_first_use,
        )
        min_at = 0.0 if index == 0 else visual_phases[-1]["at"] + 0.6
        visual_phases.append(
            {
                "at": round(max(min_at, float(point["at"])), 3),
                "sfx": pick_sfx_for_text(point["text"]),
                "variant": "immersive-strip",
                "top": {
                    "variant": "immersive-strip",
                    "show_equals": allow_equals_visual and len(assets) == 2,
                    "assets": assets,
                },
            }
        )
    scene["segments"][3]["phases"] = visual_phases

    # Assign character clips by narrative intent (intro/briefing/warning/close).
    apply_character_casting(scene, entry, defaults, role_to_clips, used_counts)

    # Keep overlay title explicit too
    scene["broadcast_title"] = resolved_game_title

    return scene


def main():
    parser = argparse.ArgumentParser(description="Generate intro scenes from template+catalog.")
    parser.add_argument("--catalog", default="scenes/catalog/intro_catalog.json", help="Path to intro catalog JSON")
    parser.add_argument("--template", default=None, help="Optional template path override")
    parser.add_argument("--output-root", default=None, help="Optional output root override")
    parser.add_argument("--force", action="store_true", help="Overwrite existing generated configs")
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
    between_briefs = load_between_briefs(repo_root, catalog)
    image_semantics = load_image_semantics(repo_root, catalog)
    role_to_clips, used_counts = build_character_library(media_catalog)

    created = []
    skipped = []

    for entry in entries:
      scene_id = canonical_scene_id(entry)
      out_file = output_root / scene_id / "config.json"

      if out_file.exists() and not args.force:
          skipped.append(str(out_file))
          continue

      scene = build_scene(
          template,
          entry,
          defaults,
          repo_root,
          role_to_clips,
          used_counts,
          between_briefs,
          image_semantics,
      )
      dump_json(out_file, scene)
      created.append(str(out_file))

    print(f"Generated: {len(created)}")
    for path in created:
        print(f"  + {path}")
    if skipped:
        print(f"Skipped (exists): {len(skipped)}")
        for path in skipped:
            print(f"  - {path}")


if __name__ == "__main__":
    main()
