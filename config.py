# Tutorial and final stay outside the counted puzzle order.
PUZZLE_TUTORIAL = 11

# Configurable blocks: each may contain more or fewer puzzles.
# Keep IDs unique and tutorial/final outside these blocks.
PUZZLE_PRE_TRIVIAL = [8, 5, 1]
PUZZLE_TRIVIAL = 3
PUZZLE_POST_TRIVIAL = [2, 12, 4]

# Complete counted order consumed by the backend, MQTT and presentations.
# Edit the blocks above; this list is derived from them on startup.
PUZZLE_ORDER = [
    *PUZZLE_PRE_TRIVIAL,
    PUZZLE_TRIVIAL,
    *PUZZLE_POST_TRIVIAL,
]

PUZZLE_FINAL = 6

# Subtitle language used by the scene player by default.
# Allowed values: "es", "eng" (also accepts "en" as alias).
SUBTITLE_LANG = "es"

# Alias funcional de cada puzzle por puzzle_id.
# Se usa como source of truth de la escena intro asociada a cada puzzle.
PUZZLE_ALIASES = {
    1: "sumas",
    2: "laberinto",
    3: "trivial",
    4: "musica",
    5: "cronometro",
    6: "energia",
    7: "segments dificil",
    8: "memory",
    9: "token a lloc",
    10: "segments",
    11: "simulacro",
    12: "apreta botons"
}
