---
description: "Use when editing puzzle frontend files, puzzle HTML templates, puzzle JavaScript, or puzzle CSS (templates/puzzle*.html, static/js/puzzle*.js, static/css/puzzle*.css). Covers EventSource SSE state handling, /start_puzzle route usage, media path conventions, DOM id stability, and preserving the existing full-screen puzzle UI patterns."
name: "Frontend Puzzle Guidelines"
applyTo: "templates/puzzle*.html, static/js/puzzle*.js, static/css/puzzle*.css"
---
# Frontend Puzzle Guidelines

- Treat each puzzle as a paired frontend unit: keep template, JavaScript, and CSS changes aligned for the same puzzle number.
- Preserve the existing architecture: puzzle state comes from `/state_stream` via `EventSource`, and snapshot recovery comes from `/current_state` when needed.
- Use the existing Flask start endpoints from the frontend instead of inventing new flows: `/start_puzzle/<id>` for numbered puzzles and `/start_puzzle_final` for the final puzzle.
- Keep puzzle-specific behavior in `static/js/puzzleN.js`; do not move gameplay logic into templates.
- Keep the current start flow where puzzle JS starts itself after SSE connection using the existing Flask endpoints.
- Preserve stable JSON field names consumed by the frontend. If backend payloads change, update the matching puzzle frontend in the same task.
- Keep existing DOM ids and class hooks stable unless the matching JS and CSS are updated together.
- Follow the current JavaScript style in this repo:
  - wrap code in an IIFE
  - initialize from `DOMContentLoaded`
  - keep direct DOM access simple with `getElementById`, `querySelector`, and class toggles
  - prefer small helper functions for audio, rendering, and SSE update handling
- Templates should stay minimal: static asset paths should use `{{ url_for('static', filename='...') }}` and should avoid embedding gameplay logic.
- CSS should preserve the current full-screen puzzle layout approach: top status area, bottom content area, puzzle-specific background image/video assets, and the repo's custom font usage when already present.
- Do not introduce frontend frameworks, bundlers, or module systems for puzzle pages. Match the current plain HTML, CSS, and browser JavaScript approach.
- When adding media references, assume files under `static/audios/`, `static/images/`, and `static/videos/` may be missing locally because those directories are ignored in Git.
- Prefer focused visual changes that fit the established puzzle screen rather than broad shared redesigns across all puzzles.
- For new puzzle frontends, mirror the established file naming pattern exactly: `templates/puzzleN.html`, `static/js/puzzleN.js`, `static/css/puzzleN.css`.