# Catalogo Semantico de Imagenes

Archivo: `scenes/catalog/image_semantics.json`

## Para que sirve
- Definir que representa cada imagen.
- Indicar en que puzzles y momentos encaja.
- Evitar que el generador/metaedicion use recursos "bonitos" pero incorrectos.

## Flujo recomendado
1. Cuando entre una imagen nueva, añadir su entrada en `images`.
2. Rellenar al menos: `path`, `concept`, `best_for`, `puzzles`.
3. Si una imagen causa confusiones, completar `avoid_for`.
4. Mantener `notes` corto y operativo (1 linea).

## Regla practica
- Si dudas entre dos imagenes, gana la que tenga `concept` mas especifico para ese puzzle.
- Los recursos `shared/*` se usan como apoyo; los de `puzzleX/*` tienen prioridad en intros de ese puzzle.
