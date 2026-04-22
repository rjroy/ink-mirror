---
title: "Commission: Spec: Persist craft nudge output per entry"
date: 2026-04-22
status: completed
tags: [commission]
worker: Octavia
workerDisplayTitle: "Guild Chronicler"
prompt: "Spec a change to the Craft Nudge feature: the nudge output should be persisted per entry and replayed on subsequent calls, rather than regenerated every time.\n\n## Current behavior (what exists)\n\nThe nudge runs on demand (unlike observe, which is part of the base write flow). Each call regenerates the nudge against the LLM. Nothing is saved. This was an intentional early decision to keep the feature transient, but it has proven too ephemeral — users re-open an entry and re-run nudge, burning tokens to regenerate the same guidance.\n\nRead the current implementation in the daemon (POST /nudge endpoint), the CLI command, and the web UI hook. Confirm exactly where the LLM call lives and what the response shape is today. Reference specific files and line numbers.\n\n## Desired behavior\n\nNudge remains on-demand (a user action, not automatic). But the first call for a given entry saves the result to the entry's durable state. Subsequent calls on the same entry return the saved result without re-running the LLM.\n\nOpen questions the spec should resolve (make judgment calls, note rationale):\n\n1. **Storage location.** Nudges should live next to the entry. Look at how observations are stored today and propose a parallel pattern (same file? sidecar? YAML block in the entry's frontmatter?). Keep it human-readable, consistent with the project's file-based-state principle.\n2. **Invalidation.** What happens when the entry text changes after a nudge is saved? Options: (a) stale nudge is returned as-is until user explicitly re-runs, (b) saved nudge is invalidated and a re-run is required, (c) saved nudge is tagged with the entry content hash at time of generation so staleness is visible. Recommend one, justify.\n3. **Re-run override.** The user may want to force a fresh nudge even if a saved one exists. Propose a CLI flag and/or web UI affordance (e.g., `nudge --refresh`, a \"regenerate\" button). Should this overwrite the saved nudge, or keep history?\n4. **Response shape.** The API should tell the caller whether the result was served from cache or freshly generated. Propose the contract change.\n5. **Migration.** Existing entries have no saved nudge. First call for each existing entry generates and saves. No backfill needed. Confirm this is fine.\n\n## Constraints\n\n- Daemon-first: the daemon owns persistence, CLI and web are rendering surfaces.\n- File-based durable state (markdown/YAML), no new databases.\n- Single-user tool, no auth concerns.\n- Do not change observe behavior. This spec is nudge-only.\n\n## Deliverable\n\nWrite the spec to `.lore/specs/craft-nudge-persistence.md`. Include:\n- Problem statement (pull from above, tighten)\n- Current state (with file:line references)\n- Proposed design with decisions on all five open questions\n- API contract changes (request/response shapes)\n- File format changes (show before/after of the entry's durable state)\n- Test plan (what to cover)\n- Out of scope\n\nNo plan yet — just the spec. The plan comes after the user approves the spec."
dependencies: []
linked_artifacts:
  - .lore/specs/craft-nudge-persistence.md

activity_timeline:
  - timestamp: 2026-04-22T04:32:23.842Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-04-22T04:32:23.845Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
  - timestamp: 2026-04-22T04:32:23.864Z
    event: status_in_progress
    reason: "Execution started"
    from: "dispatched"
    to: "in_progress"
  - timestamp: 2026-04-22T04:32:36.728Z
    event: progress_report
    reason: "Reading current nudge implementation across daemon, CLI, and web UI."
  - timestamp: 2026-04-22T04:34:02.683Z
    event: progress_report
    reason: "Research complete. Writing spec covering storage, invalidation, refresh, response shape, and migration."
  - timestamp: 2026-04-22T04:36:40.059Z
    event: result_submitted
    reason: "Spec written to `.lore/specs/craft-nudge-persistence.md`. Decisions resolved:\n\n1. **Storage:** New `nudges/` directory, one YAML file per entry (`nudges/{entryId}.yaml`). Parallel to `observations/`, keeps entry markdown clean, deterministic lookup.\n2. **Invalidation:** Content-hash tagging (SHA-256 of entry body + context string). Saved nudge is returned with `stale: true` when either input has changed — the writer sees the old guidance plus a \"this drifted\" label and decides whether to refresh. Rejected both silent-stale and force-invalidate.\n3. **Refresh:** `refresh: boolean` on the request. Overwrites the saved nudge; no history. Web UI gains a Regenerate button alongside/replacing the Nudge button once a saved nudge exists. CLI gets the boolean in its help tree but richer flag UX is deferred.\n4. **Response shape:** Adds `source: \"cache\" | \"fresh\"`, `generatedAt`, `contentHash?` (entry-scoped only), `stale?` (only when cache-served and drifted). Additive; existing `nudges/metrics/error` preserved.\n5. **Migration:** No backfill. First call per existing entry generates and saves. Confirmed.\n\nOut-of-scope items pinned (history, cross-entry aggregation, profile-aware invalidation, streaming, CLI named flags). Four exit-point stubs filed: `nudge-history`, `cli-named-flags`, `profile-aware-nudge-invalidation`, `combined-review` (inherited).\n\nCurrent-state section references specific files and lines: `routes/nudge.ts:23-71`, `nudger.ts:38-82`, `index.ts:92-100`, `shared/src/nudge.ts:57-68`, plus web and CLI surfaces. Test plan covers store round-trip, route cache/stale/refresh paths, direct-text no-persist path, LLM parse failure not persisted, and web component states.\n\nOne non-obvious decision worth surfacing for review: persistence is gated on entry-resolved text only. Direct-text requests run fresh and never touch the store. No meaningful cache key without an entry ID, and the direct-text path is rare enough that burning tokens on it is acceptable.\n\nOne decision that will need confirmation: auto-fetch on entry view load (REQ-CNP-22). The web view fetches the saved nudge without a user click, so the stored result renders on entry open. This keeps token cost zero (the daemon returns cache without calling the LLM) but it is a behavior change from today's click-to-see model. Flagged in the spec; the plan phase should confirm with the user before building.\n\nNo plan yet, per the commission brief."
  - timestamp: 2026-04-22T04:36:48.779Z
    event: status_completed
    reason: "Execution completed"
    from: "in_progress"
    to: "completed"
current_progress: "Research complete. Writing spec covering storage, invalidation, refresh, response shape, and migration."
projectName: ink-mirror
---
Spec written to `.lore/specs/craft-nudge-persistence.md`. Decisions resolved:

1. **Storage:** New `nudges/` directory, one YAML file per entry (`nudges/{entryId}.yaml`). Parallel to `observations/`, keeps entry markdown clean, deterministic lookup.
2. **Invalidation:** Content-hash tagging (SHA-256 of entry body + context string). Saved nudge is returned with `stale: true` when either input has changed — the writer sees the old guidance plus a "this drifted" label and decides whether to refresh. Rejected both silent-stale and force-invalidate.
3. **Refresh:** `refresh: boolean` on the request. Overwrites the saved nudge; no history. Web UI gains a Regenerate button alongside/replacing the Nudge button once a saved nudge exists. CLI gets the boolean in its help tree but richer flag UX is deferred.
4. **Response shape:** Adds `source: "cache" | "fresh"`, `generatedAt`, `contentHash?` (entry-scoped only), `stale?` (only when cache-served and drifted). Additive; existing `nudges/metrics/error` preserved.
5. **Migration:** No backfill. First call per existing entry generates and saves. Confirmed.

Out-of-scope items pinned (history, cross-entry aggregation, profile-aware invalidation, streaming, CLI named flags). Four exit-point stubs filed: `nudge-history`, `cli-named-flags`, `profile-aware-nudge-invalidation`, `combined-review` (inherited).

Current-state section references specific files and lines: `routes/nudge.ts:23-71`, `nudger.ts:38-82`, `index.ts:92-100`, `shared/src/nudge.ts:57-68`, plus web and CLI surfaces. Test plan covers store round-trip, route cache/stale/refresh paths, direct-text no-persist path, LLM parse failure not persisted, and web component states.

One non-obvious decision worth surfacing for review: persistence is gated on entry-resolved text only. Direct-text requests run fresh and never touch the store. No meaningful cache key without an entry ID, and the direct-text path is rare enough that burning tokens on it is acceptable.

One decision that will need confirmation: auto-fetch on entry view load (REQ-CNP-22). The web view fetches the saved nudge without a user click, so the stored result renders on entry open. This keeps token cost zero (the daemon returns cache without calling the LLM) but it is a behavior change from today's click-to-see model. Flagged in the spec; the plan phase should confirm with the user before building.

No plan yet, per the commission brief.
