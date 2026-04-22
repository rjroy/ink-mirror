---
title: "Commission: Plan: Craft nudge persistence implementation"
date: 2026-04-22
status: completed
tags: [commission]
worker: Octavia
workerDisplayTitle: "Guild Chronicler"
prompt: "Write the implementation plan for the craft nudge persistence spec.\n\nSpec: `.lore/specs/craft-nudge-persistence.md` (approved).\n\nReference implementation pattern: `packages/daemon/src/observation-store.ts` is the style guide for the new `NudgeStore`. The route under edit is `packages/daemon/src/routes/nudge.ts`. The web client lives at `packages/web/components/entry-nudge.tsx` and `packages/web/lib/api.ts`.\n\nStructure the plan as an ordered sequence of focused commissions (2-3 phases each, right-sized per Guild Master conventions). Each phase should be a coherent chunk with explicit verification steps.\n\nLikely shape (but verify and adjust):\n\n1. **Shared schema updates.** Extend `NudgeResponseSchema` with `source`, `stale`, `generatedAt`, `contentHash`. Add `refresh` to request schema. Any new `SavedNudge` type.\n2. **NudgeStore.** New file `packages/daemon/src/nudge-store.ts` mirroring `observation-store.ts` style. Unit tests. Factory wired through DI.\n3. **Route integration.** Update `packages/daemon/src/routes/nudge.ts` to read cache, write cache, handle refresh, compute hash, handle direct-text bypass. Update `NudgeDeps`. Wire `nudgeStore` in `packages/daemon/src/index.ts`. Route tests covering all cache/refresh/stale/direct-text/error matrices per the spec's Test Plan.\n4. **CLI surface.** Add `refresh` boolean param to the nudge.analyze operation definition. Confirm CLI discovery picks it up. No executor changes.\n5. **Web surface.** Update `requestNudge` signature and `entry-nudge.tsx` to fetch on mount, render Saved/Stale/Regenerate states, and POST with `refresh: true` when regenerating. Component tests.\n\nCall out dependencies explicitly (shared schema must land before route work; store must land before route integration; route work must land before web work).\n\nFor each commission proposal, list:\n- Title\n- Worker (Dalton for build, Thorne for review)\n- Dependencies (by phase name for now; I'll assign commission IDs when dispatching)\n- Scope (what changes, what tests, what verification commands)\n- Out of scope (what the next phase handles)\n\nInclude a review gate after any phase that touches a shared foundation other phases depend on. Per Guild Master convention: implement → review → fix, then fan out.\n\nWrite the plan to `.lore/plans/craft-nudge-persistence.md`. Keep it actionable — this is the dispatch guide for the build, not an essay."
dependencies: []
linked_artifacts:
  - .lore/plans/craft-nudge-persistence.md

activity_timeline:
  - timestamp: 2026-04-22T13:33:44.015Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-04-22T13:33:44.019Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
  - timestamp: 2026-04-22T13:33:44.037Z
    event: status_in_progress
    reason: "Execution started"
    from: "dispatched"
    to: "in_progress"
  - timestamp: 2026-04-22T13:35:04.138Z
    event: progress_report
    reason: "Read spec, observation-store reference, route, daemon wiring, web components. Drafting phased plan."
  - timestamp: 2026-04-22T13:38:04.395Z
    event: result_submitted
    reason: "Wrote implementation plan at .lore/plans/craft-nudge-persistence.md. Five phases with embedded review gates: (1) shared schema — extend NudgeRequest/Response, introduce SavedNudge and a factored NudgeMetricsSchema; (2) NudgeStore — parallel to observation-store, `get`/`save` only, hand-rolled YAML, no `now` in store deps; (3) route integration — cache/refresh/stale matrix, hash via node:crypto, save-failure isolation, daemon wiring at index.ts; (4) CLI — confirm the new `refresh` boolean param surfaces via help-tree discovery, no executor changes; (5) web — api.ts signature, three-state entry-nudge UX with mount fetch and Regenerate. Each phase names files, test matrix, verification commands, and explicit out-of-scope.\n\n**One flagged question for curator before dispatch**: REQ-CNP-22's mount fetch combined with REQ-CNP-6 (no-saved → LLM run) silently violates REQ-CN-1 (on-demand). Plan recommends Option B — add a read-only `GET /nudge/{entryId}` to Phase 3 scope so the web client can check cache without triggering generation. Alternative (Option A — spec-literal) lets first entry view auto-generate. Flagged explicitly in the plan's \"Open Question for Curator Before Dispatch\" section; Phase 3 scope depends on resolution.\n\nCommission breakdown (Worker, deps): 1A Dalton (none), 1B Thorne (1A), 2A Dalton (1B), 2B Thorne (2A), 3A Dalton (2B), 3B Thorne (3A), 3C Dalton conditional (3B), 4A Dalton (3B/3C), 4B Thorne (4A), 5A Dalton (3B/3C), 5B Thorne (5A), 5C Dalton conditional (5B). Phase 4 and Phase 5 can run in parallel after Phase 3 closes."
  - timestamp: 2026-04-22T13:38:13.055Z
    event: status_completed
    reason: "Execution completed"
    from: "in_progress"
    to: "completed"
current_progress: "Read spec, observation-store reference, route, daemon wiring, web components. Drafting phased plan."
projectName: ink-mirror
---
Wrote implementation plan at .lore/plans/craft-nudge-persistence.md. Five phases with embedded review gates: (1) shared schema — extend NudgeRequest/Response, introduce SavedNudge and a factored NudgeMetricsSchema; (2) NudgeStore — parallel to observation-store, `get`/`save` only, hand-rolled YAML, no `now` in store deps; (3) route integration — cache/refresh/stale matrix, hash via node:crypto, save-failure isolation, daemon wiring at index.ts; (4) CLI — confirm the new `refresh` boolean param surfaces via help-tree discovery, no executor changes; (5) web — api.ts signature, three-state entry-nudge UX with mount fetch and Regenerate. Each phase names files, test matrix, verification commands, and explicit out-of-scope.

**One flagged question for curator before dispatch**: REQ-CNP-22's mount fetch combined with REQ-CNP-6 (no-saved → LLM run) silently violates REQ-CN-1 (on-demand). Plan recommends Option B — add a read-only `GET /nudge/{entryId}` to Phase 3 scope so the web client can check cache without triggering generation. Alternative (Option A — spec-literal) lets first entry view auto-generate. Flagged explicitly in the plan's "Open Question for Curator Before Dispatch" section; Phase 3 scope depends on resolution.

Commission breakdown (Worker, deps): 1A Dalton (none), 1B Thorne (1A), 2A Dalton (1B), 2B Thorne (2A), 3A Dalton (2B), 3B Thorne (3A), 3C Dalton conditional (3B), 4A Dalton (3B/3C), 4B Thorne (4A), 5A Dalton (3B/3C), 5B Thorne (5A), 5C Dalton conditional (5B). Phase 4 and Phase 5 can run in parallel after Phase 3 closes.
