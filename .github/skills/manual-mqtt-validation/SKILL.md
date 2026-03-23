---
name: manual-mqtt-validation
description: 'Manual verification workflow for MQTT-driven puzzle behavior. Use for broker checks, Flask startup, mosquitto_pub message injection, puzzle regression checks, and validating SSE-facing state transitions.'
argument-hint: 'Puzzle id and scenario to validate'
---

# Manual MQTT Validation

## When To Use
- Validate puzzle behavior when there is no automated test suite.
- Reproduce hardware-originated events by publishing MQTT payloads manually.
- Confirm backend state transitions are reflected to frontend clients through SSE updates.
- Run quick regressions after puzzle backend or frontend changes.

## Preconditions
1. Install dependencies:
   - python3 -m pip install -r requirements.txt
2. Ensure a local MQTT broker is running on localhost:1883.
3. Start the Flask app:
   - flask --app app run

## Procedure
1. Open a puzzle route in the browser and ensure the puzzle starts.
2. Confirm the backend subscribes to TO_FLASK and publishes updates to puzzles/{puzzle_id}.
3. Inject scenario messages using mosquitto_pub with repo payload format P{id},... .
4. Observe expected puzzle progression in UI and backend logs.
5. Validate completion behavior:
   - solved flags and progression routes
   - reset behavior on incorrect or timeout cases

## Quick Commands
- Example command pattern:
  - mosquitto_pub -h localhost -t TO_FLASK -m "P3,0,3"
- Scripted sample for puzzle 3:
  - [scriptsBash/puzzle3Trivial.sh](../../../scriptsBash/puzzle3Trivial.sh)

## Validation Checklist
- Broker reachable at localhost:1883
- Flask app starts without import/runtime errors
- Puzzle receives TO_FLASK messages and processes expected handler path
- State updates are pushed through mqtt_client.push_update(...)
- Frontend screen updates via /state_stream
- Puzzle solved condition triggers expected redirect/progression

## Common Failure Patterns
- Broker offline or on wrong host/port
- Malformed MQTT payload (wrong puzzle prefix or CSV fields)
- Puzzle id not included in configured flow
- Frontend waiting on fields not present in current SSE payload
