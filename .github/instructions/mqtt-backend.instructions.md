---
description: "Use when editing backend puzzle flow, MQTT routing, puzzle lifecycle, or SSE state contracts in app.py, mqtt/client.py, mqtt/puzzle_factory.py, mqtt/puzzles/*.py, config.py, or mqtt_client.py. Covers TO_FLASK/FROM_FLASK topic contracts, payload compatibility, and thread-safe puzzle state handling."
name: "MQTT Backend Puzzle Guidelines"
applyTo: "app.py, config.py, mqtt/client.py, mqtt/puzzle_factory.py, mqtt/puzzles/*.py, mqtt_client.py"
---
# MQTT Backend Puzzle Guidelines

- Keep Flask route logic in app.py focused on routing, rendering, and lightweight orchestration.
- Keep puzzle game-state logic inside puzzle classes under mqtt/puzzles/.
- Preserve MQTT topic contracts unless a task explicitly requires protocol changes:
  - inbound hardware topic: TO_FLASK
  - outbound start topic: FROM_FLASK
  - state mirror topic: puzzles/{puzzle_id}
- Preserve current final puzzle convention where final puzzle id is -1 unless explicitly changing protocol behavior.
- Preserve the payload shape used across the codebase: comma-separated message fields where the first token is P{id}.
- Keep puzzle lifecycle behavior consistent: reset or on_start on activation, handle_message for inbound events, get_state for snapshots, and stop for cleanup.
- Keep SSE payloads stable for existing frontend listeners. If fields are renamed, update the matching frontend in the same task.
- Use thread locking for shared mutable puzzle state and keep lock scopes small.
- Avoid long blocking operations in Flask request handlers.
- Keep puzzle order and feature switches centralized in config.py.
- For new puzzles, follow the existing registration flow through the puzzle factory and MQTT client registration.
