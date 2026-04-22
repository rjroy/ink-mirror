---
title: "Commission: Spec: Persist craft nudge output per entry"
date: 2026-04-22
status: dispatched
tags: [commission]
worker: Octavia
workerDisplayTitle: "Guild Chronicler"
prompt: "Spec a change to the Craft Nudge feature: the nudge output should be persisted per entry and replayed on subsequent calls, rather than regenerated every time.\n\n## Current behavior (what exists)\n\nThe nudge runs on demand (unlike observe, which is part of the base write flow). Each call regenerates the nudge against the LLM. Nothing is saved. This was an intentional early decision to keep the feature transient, but it has proven too ephemeral — users re-open an entry and re-run nudge, burning tokens to regenerate the same guidance.\n\nRead the current implementation in the daemon (POST /nudge endpoint), the CLI command, and the web UI hook. Confirm exactly where the LLM call lives and what the response shape is today. Reference specific files and line numbers.\n\n## Desired behavior\n\nNudge remains on-demand (a user action, not automatic). But the first call for a given entry saves the result to the entry's durable state. Subsequent calls on the same entry return the saved result without re-running the LLM.\n\nOpen questions the spec should resolve (make judgment calls, note rationale):\n\n1. **Storage location.** Nudges should live next to the entry. Look at how observations are stored today and propose a parallel pattern (same file? sidecar? YAML block in the entry's frontmatter?). Keep it human-readable, consistent with the project's file-based-state principle.\n2. **Invalidation.** What happens when the entry text changes after a nudge is saved? Options: (a) stale nudge is returned as-is until user explicitly re-runs, (b) saved nudge is invalidated and a re-run is required, (c) saved nudge is tagged with the entry content hash at time of generation so staleness is visible. Recommend one, justify.\n3. **Re-run override.** The user may want to force a fresh nudge even if a saved one exists. Propose a CLI flag and/or web UI affordance (e.g., `nudge --refresh`, a \"regenerate\" button). Should this overwrite the saved nudge, or keep history?\n4. **Response shape.** The API should tell the caller whether the result was served from cache or freshly generated. Propose the contract change.\n5. **Migration.** Existing entries have no saved nudge. First call for each existing entry generates and saves. No backfill needed. Confirm this is fine.\n\n## Constraints\n\n- Daemon-first: the daemon owns persistence, CLI and web are rendering surfaces.\n- File-based durable state (markdown/YAML), no new databases.\n- Single-user tool, no auth concerns.\n- Do not change observe behavior. This spec is nudge-only.\n\n## Deliverable\n\nWrite the spec to `.lore/specs/craft-nudge-persistence.md`. Include:\n- Problem statement (pull from above, tighten)\n- Current state (with file:line references)\n- Proposed design with decisions on all five open questions\n- API contract changes (request/response shapes)\n- File format changes (show before/after of the entry's durable state)\n- Test plan (what to cover)\n- Out of scope\n\nNo plan yet — just the spec. The plan comes after the user approves the spec."
dependencies: []
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-04-22T04:32:23.842Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-04-22T04:32:23.845Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
current_progress: ""
projectName: ink-mirror
---
