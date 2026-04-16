#!/usr/bin/env python3
import argparse
import copy
import json
from pathlib import Path


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def dump_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


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


def build_scene(template, entry, defaults, scenes_root: Path):
    scene = copy.deepcopy(template)

    legacy_scene_id = entry["legacy_scene_id"]
    legacy_path = scenes_root / "source" / "intro" / legacy_scene_id / "config.json"
    if not legacy_path.exists():
        legacy_path = scenes_root / legacy_scene_id / "config.json"
    legacy = load_json(legacy_path)

    mapping = {
        "__SCENE_ID__": entry["output_scene_id"],
        "__GAME_TITLE__": entry.get("game_title", ""),
        "__HEADLINE__": entry.get("headline", ""),
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

    # Assets and warning pairs (can be overridden per entry)
    intro_assets = entry.get("intro_assets") or defaults["intro_assets"]
    warning_pairs = entry.get("warning_asset_pairs") or defaults["warning_asset_pairs"]

    scene["segments"][1]["phases"][1]["top"]["assets"] = intro_assets
    scene["segments"][3]["phases"][0]["top"]["assets"] = warning_pairs[0]
    scene["segments"][3]["phases"][1]["top"]["assets"] = warning_pairs[1]
    scene["segments"][3]["phases"][2]["top"]["assets"] = warning_pairs[2]

    # Keep overlay title explicit too
    scene["broadcast_title"] = entry.get("game_title", "")

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

    output_root = repo_root / (args.output_root or catalog.get("default_output_root", "scenes/generated/intro"))
    scenes_root = repo_root / "scenes"

    defaults = catalog.get("defaults", {})
    entries = catalog.get("entries", [])

    created = []
    skipped = []

    for entry in entries:
      scene_id = entry["output_scene_id"]
      out_file = output_root / scene_id / "config.json"

      if out_file.exists() and not args.force:
          skipped.append(str(out_file))
          continue

      scene = build_scene(template, entry, defaults, scenes_root)
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
