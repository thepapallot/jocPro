---
description: "Use when creating or scaffolding a new puzzle end-to-end with backend class, factory registration, and matching template/js/css files."
name: "Add New Puzzle"
argument-hint: "Puzzle id, mechanic summary, and any special state fields"
agent: "agent"
---
Implement a new puzzle in this repository using existing project conventions.

Inputs to infer from the user request:
- Puzzle id and route target
- Core mechanic and success condition
- Required frontend visuals, sounds, and interactions

Requirements:
1. Add a new puzzle class in mqtt/puzzles/ that follows BasePuzzle behavior and existing locking patterns.
2. Register the new puzzle through the existing puzzle factory and wiring used by create_puzzles(...).
3. Add or update routing/config only as needed to include the puzzle in the configured flow.
4. Create matching frontend files:
   - templates/puzzleN.html
   - static/js/puzzleN.js
   - static/css/puzzleN.css
5. Use existing frontend architecture:
   - EventSource on /state_stream
   - optional snapshot fetch from /current_state
   - start route POST to /start_puzzle/N (or /start_puzzle_final for final)
6. Keep MQTT and SSE payload fields backward compatible unless the task explicitly requests a protocol change.
7. Validate changes by checking for editor errors and summarizing any manual run or MQTT verification steps.

Project references:
- [Workspace Guidelines](../copilot-instructions.md)
- [Frontend Puzzle Guidelines](../instructions/frontend-puzzles.instructions.md)

Output format:
- Changed files with short rationale
- Any contract changes (topics/payload fields)
- Manual verification steps and expected results
