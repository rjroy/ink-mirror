---
title: "Commission: Phase 3A: Curation API and CLI"
date: 2026-03-27
status: dispatched
type: one-shot
tags: [commission]
worker: Dalton
workerDisplayTitle: "Guild Artificer"
prompt: "Implement Commission 3A from `.lore/plans/v1-core-loop.md`: Curation API and CLI.\n\nRead the full plan and spec (`.lore/specs/v1-core-loop.md`) before starting.\n\n## What to build\n\n- Daemon routes: `GET /observations/pending` (pending + resurfaced undecided), `PATCH /observations/:id` (classify), `GET /observations` (all with filters)\n- Curation session assembly: new observations first, then up to 3 most-recent undecided items (REQ-V1-18, open question #4: cap at 3 undecided per session, most recent first)\n- Each observation response includes the original entry text for context (REQ-V1-17)\n- Contradiction detection: when assembling a curation session, compare new observations against confirmed (intentional) observations. Same dimension, opposing pattern = contradiction. Surface the tension for user resolution. No auto-reconciliation. (REQ-V1-19)\n- CLI command: `ink-mirror curate` (presents pending observations one at a time, prompts for classification)\n- CLI command: `ink-mirror observations` (lists all observations with status filter)\n- State transitions: pending -> intentional/accidental/undecided. Undecided -> intentional/accidental. Accidental retained but excluded from profile.\n\n## Testing\n\n- Unit tests: curation session assembly selects correct observations (new + resurfaced, respects cap)\n- Unit tests: contradiction detection identifies conflicting patterns\n- Unit tests: state transitions are valid (no invalid transitions like accidental -> pending)\n- Integration test: create entry, observe, curate via CLI, verify observation state persists\n- Integration test: contradictory patterns surface during curation\n- 90%+ coverage on new code"
dependencies:
  - commission-Dalton-20260327-103940
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-03-27T17:39:56.530Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-03-27T17:48:48.112Z
    event: status_blocked
    reason: "Dependencies not satisfied"
    from: "pending"
    to: "blocked"
  - timestamp: 2026-03-27T20:29:11.261Z
    event: status_pending
    reason: "Dependencies satisfied"
    from: "blocked"
    to: "pending"
  - timestamp: 2026-03-27T20:29:11.263Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
current_progress: ""
projectName: ink-mirror
---
