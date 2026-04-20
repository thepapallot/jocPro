## Subtitles

This folder stores subtitle source files by language for intro and finale scenes.

Structure:

- `es/`: Spanish source subtitles
- `eng/`: English translations

Naming convention:

- `intro_inicial.<lang>.srt`: general presentation intro of the game
- `intro_puzzle_XX_<alias>.<lang>.srt`: puzzle intro scene, with zero-padded number (including final puzzle)
- `outro_final.<lang>.srt`: final ending/outro scene

Current Spanish files imported from `/home/agusti/Descargas/srt_corregidos/`:

- `intro_inicial.es.srt` from `intro.srt`
- `intro_puzzle_01_sumas.es.srt` from `p1e.srt`
- `intro_puzzle_02_laberinto.es.srt` from `p2e.srt`
- `intro_puzzle_03_trivial.es.srt` from `p3e.srt`
- `intro_puzzle_04_musica.es.srt` from `p4e.srt`
- `intro_puzzle_05_cronometro.es.srt` from `p5e.srt`
- `intro_puzzle_06_energia.es.srt` from `p6e.srt`
- `intro_puzzle_08_memory.es.srt` from `p8e.srt`
- `intro_puzzle_09_token_a_lloc.es.srt` from `p9e.srt`
- `intro_puzzle_10_segments.es.srt` from `p10e.srt`
- `intro_puzzle_12_apreta_botons.es.srt` from `pfinale.srt`
- `outro_final.es.srt` from `final.srt`

Notes:

- Puzzle 7 subtitle file was not present in the provided batch.
- These SRTs are stored as source assets for translation and possible subtitle import automation.

## ES -> ENG maintenance workflow

Spanish (`es/`) is the source of truth.

When any file in `es/` changes:

1. Update the corresponding file in `eng/`.
2. Keep cue numbering and timestamps aligned with `es/`.
3. Run:

```bash
bash scenes/subtitles/check_eng_sync.sh
```

The script checks:

- Missing English files
- Mismatch in cue count
- Mismatch in timestamps (`-->` lines)
