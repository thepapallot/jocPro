#!/usr/bin/env python3
import argparse
import copy
import hashlib
import json
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

LEGACY_SCENE_TO_PUZZLE_TAG = {
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


def rank_assets_for_scene(assets, legacy_scene_id, image_semantics):
    puzzle_tag = LEGACY_SCENE_TO_PUZZLE_TAG.get(legacy_scene_id, "")
    ranked = sorted(
        assets or [],
        key=lambda a: (
            _asset_semantic_rank(a.get("src"), puzzle_tag, image_semantics),
            a.get("src", ""),
        ),
    )
    return ranked


def resolve_intro_titles(entry: dict, defaults: dict, between_briefs: dict):
    legacy_scene_id = entry.get("legacy_scene_id", "")
    brief = between_briefs.get(legacy_scene_id, {}) if isinstance(between_briefs, dict) else {}
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
    scene_id = entry["output_scene_id"]
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
    scenes_root: Path,
    repo_root: Path,
    role_to_clips,
    used_counts,
    between_briefs,
    image_semantics,
):
    scene = copy.deepcopy(template)

    legacy_scene_id = entry["legacy_scene_id"]
    legacy_path = scenes_root / "source" / "intro" / legacy_scene_id / "config.json"
    if not legacy_path.exists():
        legacy_path = scenes_root / legacy_scene_id / "config.json"
    legacy = load_json(legacy_path)

    resolved_game_title, resolved_headline = resolve_intro_titles(entry, defaults, between_briefs)

    mapping = {
        "__SCENE_ID__": entry["output_scene_id"],
        "__GAME_TITLE__": resolved_game_title,
        "__HEADLINE__": resolved_headline,
        "__AUDIO_SRC__": (entry.get("audio_src") or legacy.get("audio", {}).get("src") or ""),
    }
    scene = replace_tokens(scene, mapping)

    scene["description"] = (
        f"Intro v2 generada desde plantilla para {entry['output_scene_id']} "
        f"(base legacy: {legacy_scene_id})."
    )

    # Reuse real subtitles from legacy scene unless explicitly provided
    scene["subtitles"] = entry.get("subtitles") or legacy.get("subtitles", [])

    # Keep new intros synchronized with the legacy timing profile by default.
    sync_timing_with_legacy = entry.get(
        "sync_timing_with_legacy",
        defaults.get("sync_timing_with_legacy", True),
    )
    if sync_timing_with_legacy:
        sync_segment_timing_from_legacy(scene, legacy)

    # Ensure total scene duration reaches the real audio length.
    fit_scene_duration_to_audio(scene, repo_root)

    # Assets and warning pairs (can be overridden per entry), unless subtitle-driven mode is enabled.
    subtitle_driven = entry.get(
        "auto_fullscreen_from_subtitles",
        defaults.get("auto_fullscreen_from_subtitles", False),
    )
    if not subtitle_driven:
        inferred_intro_assets, inferred_warning_pairs = infer_assets_from_legacy(legacy)

        intro_assets = (
            entry.get("intro_assets")
            or inferred_intro_assets
            or defaults["intro_assets"]
        )
        warning_pairs = (
            entry.get("warning_asset_pairs")
            or inferred_warning_pairs
            or defaults["warning_asset_pairs"]
        )
        intro_assets = rank_assets_for_scene(intro_assets, legacy_scene_id, image_semantics)
        warning_pairs = [
            rank_assets_for_scene(pair, legacy_scene_id, image_semantics)
            for pair in warning_pairs
        ]
        scene["segments"][1]["phases"][1]["top"]["assets"] = intro_assets
        scene["segments"][3]["phases"][0]["top"]["assets"] = warning_pairs[0]
        scene["segments"][3]["phases"][1]["top"]["assets"] = warning_pairs[1]
        scene["segments"][3]["phases"][2]["top"]["assets"] = warning_pairs[2]

    # Build fullscreen phases directly from subtitle timeline when requested.
    apply_subtitle_driven_fullscreen(scene, entry, defaults, resolved_headline)

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

    output_root = repo_root / (args.output_root or catalog.get("default_output_root", "scenes/source/intropuzzles"))
    scenes_root = repo_root / "scenes"
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
      scene_id = entry["output_scene_id"]
      out_file = output_root / scene_id / "config.json"

      if out_file.exists() and not args.force:
          skipped.append(str(out_file))
          continue

      scene = build_scene(
          template,
          entry,
          defaults,
          scenes_root,
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
