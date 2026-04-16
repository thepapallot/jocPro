#!/usr/bin/env python3
import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path


IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}
TEXT_FILE_EXTENSIONS = {
    ".py",
    ".js",
    ".css",
    ".html",
    ".json",
    ".md",
    ".txt",
    ".yml",
    ".yaml",
}
IGNORE_DIRS = {".git", "venv", "__pycache__", ".mypy_cache", ".pytest_cache"}
IMAGE_REF_RE = re.compile(r"/static/images/[A-Za-z0-9_./${}-]+")
SCAN_ROOTS = ["app.py", "config.py", "player", "scenes", "scripts", "static", "templates", "mqtt"]


def is_ignored(path: Path) -> bool:
    return any(part in IGNORE_DIRS for part in path.parts)


def collect_image_files(repo_root: Path):
    images_root = repo_root / "static" / "images"
    files = []
    if not images_root.exists():
        return files
    for path in images_root.rglob("*"):
        if not path.is_file():
            continue
        if is_ignored(path):
            continue
        if path.suffix.lower() in IMAGE_EXTENSIONS:
            files.append(path)
    return sorted(files)


def collect_text_files(repo_root: Path):
    out = []
    for root_name in SCAN_ROOTS:
        root_path = repo_root / root_name
        if root_path.is_file():
            if root_path.suffix.lower() in TEXT_FILE_EXTENSIONS:
                out.append(root_path)
            continue
        if not root_path.exists():
            continue
        for path in root_path.rglob("*"):
            if not path.is_file():
                continue
            if is_ignored(path):
                continue
            if path.suffix.lower() not in TEXT_FILE_EXTENSIONS:
                continue
            if path.name == "image_assets_audit.json":
                continue
            out.append(path)
    return out


def read_text(path: Path):
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="latin-1", errors="ignore")


def classify_top_bucket(rel_path: str) -> str:
    parts = rel_path.split("/")
    if len(parts) < 3:
        return "misc"
    if parts[2] == "shared":
        return "shared"
    if parts[2].startswith("puzzle"):
        return parts[2]
    return parts[2]


def is_concrete_asset_ref(url: str) -> bool:
    if "${" in url:
        return False
    return any(url.lower().endswith(ext) for ext in IMAGE_EXTENSIONS)


def audit(repo_root: Path):
    image_files = collect_image_files(repo_root)
    text_files = collect_text_files(repo_root)

    image_rel_paths = [str(path.relative_to(repo_root)).replace("\\", "/") for path in image_files]
    image_url_set = {"/" + rel for rel in image_rel_paths}
    image_url_set |= set(image_rel_paths)

    refs_by_file = defaultdict(list)
    ref_counts = Counter()
    missing_refs = Counter()

    for text_path in text_files:
        content = read_text(text_path)
        hits = IMAGE_REF_RE.findall(content)
        if not hits:
            continue
        rel = str(text_path.relative_to(repo_root)).replace("\\", "/")
        for hit in hits:
            refs_by_file[rel].append(hit)
            ref_counts[hit] += 1
            if is_concrete_asset_ref(hit) and hit not in image_url_set:
                missing_refs[hit] += 1

    by_bucket = Counter()
    by_subfolder = Counter()
    for rel in image_rel_paths:
        bucket = classify_top_bucket(rel)
        by_bucket[bucket] += 1
        parts = rel.split("/")
        if len(parts) >= 4:
            by_subfolder[f"{parts[2]}/{parts[3]}"] += 1

    return {
        "repo_root": str(repo_root),
        "images_total": len(image_rel_paths),
        "images_by_bucket": dict(by_bucket.most_common()),
        "images_by_subfolder": dict(by_subfolder.most_common()),
        "top_referenced_image_urls": [
            {"url": url, "count": count} for url, count in ref_counts.most_common(40)
        ],
        "dynamic_or_prefix_references": [
            {"url": url, "count": count}
            for url, count in ref_counts.most_common()
            if not is_concrete_asset_ref(url)
        ],
        "missing_image_references": [
            {"url": url, "count": count} for url, count in missing_refs.most_common()
        ],
        "references_by_file": [
            {"file": file, "references": refs}
            for file, refs in sorted(refs_by_file.items())
        ],
        "all_image_files": image_rel_paths,
    }


def main():
    parser = argparse.ArgumentParser(description="Audit image files and usages in project.")
    parser.add_argument(
        "--output",
        default="docs/image_assets_audit.json",
        help="Output JSON path relative to repo root",
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    output_path = repo_root / args.output
    output_path.parent.mkdir(parents=True, exist_ok=True)

    report = audit(repo_root)
    output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"OK: {output_path}")
    print(f"images_total={report['images_total']}")
    print(f"missing_refs={len(report['missing_image_references'])}")


if __name__ == "__main__":
    main()
