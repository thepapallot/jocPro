#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ES_DIR="$BASE_DIR/es"
ENG_DIR="$BASE_DIR/eng"

if [[ ! -d "$ES_DIR" ]]; then
  echo "ERROR: Missing directory: $ES_DIR"
  exit 1
fi

if [[ ! -d "$ENG_DIR" ]]; then
  echo "ERROR: Missing directory: $ENG_DIR"
  exit 1
fi

status=0

for es_file in "$ES_DIR"/*.es.srt; do
  [[ -e "$es_file" ]] || continue

  base_name="$(basename "$es_file" .es.srt)"
  eng_file="$ENG_DIR/$base_name.eng.srt"

  if [[ ! -f "$eng_file" ]]; then
    echo "MISSING: $eng_file"
    status=1
    continue
  fi

  es_count="$(grep -Ec '^[0-9]+$' "$es_file")"
  eng_count="$(grep -Ec '^[0-9]+$' "$eng_file")"
  if [[ "$es_count" != "$eng_count" ]]; then
    echo "CUE COUNT MISMATCH: $base_name (es=$es_count, eng=$eng_count)"
    status=1
  fi

  es_times="$(grep -E -- '-->' "$es_file" || true)"
  eng_times="$(grep -E -- '-->' "$eng_file" || true)"
  if [[ "$es_times" != "$eng_times" ]]; then
    echo "TIMESTAMP MISMATCH: $base_name"
    status=1
  fi
done

if [[ "$status" -eq 0 ]]; then
  echo "OK: ENG subtitles are structurally aligned with ES."
else
  echo "FAIL: ENG subtitles need updates."
fi

exit "$status"
