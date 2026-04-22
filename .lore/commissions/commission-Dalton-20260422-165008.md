---
title: "Commission: Phase 1A: Build nudge persistence shared schema"
date: 2026-04-22
status: completed
tags: [commission]
worker: Dalton
workerDisplayTitle: "Guild Artificer"
prompt: "Implement Phase 1A of `.lore/plans/craft-nudge-persistence.md`.\n\nSpec: `.lore/specs/craft-nudge-persistence.md`\nPlan: `.lore/plans/craft-nudge-persistence.md` (see \"Phase 1: Shared Schema\" → \"Commission 1A — Build: extend nudge schemas\")\n\nScope is strictly the shared package:\n- Extend `NudgeRequestSchema` and `NudgeResponseSchema` in `packages/shared/src/nudge.ts` per the plan.\n- Factor a `NudgeMetricsSchema` and introduce `SavedNudgeSchema`/`SavedNudge` type.\n- Export new types/schemas from `packages/shared/src/index.ts`.\n- Update `packages/shared/tests/nudge.test.ts` with the four test cases listed in the plan.\n\nOut of scope: daemon route changes, storage code, web client, CLI.\n\nVerify:\n```\nbun test packages/shared\nbun run typecheck\n```\n\nBoth must pass before reporting complete."
dependencies: []
linked_artifacts:
  - packages/shared/src/nudge.ts

  - packages/shared/src/index.ts
  - packages/shared/tests/nudge.test.ts
  - packages/shared/src/index.ts
  - packages/shared/tests/nudge.test.ts
activity_timeline:
  - timestamp: 2026-04-22T23:50:08.779Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-04-22T23:50:08.780Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
  - timestamp: 2026-04-22T23:50:08.801Z
    event: status_in_progress
    reason: "Execution started"
    from: "dispatched"
    to: "in_progress"
  - timestamp: 2026-04-22T23:50:31.595Z
    event: progress_report
    reason: "Read plan, spec context, existing nudge schema/tests. Starting schema edits."
  - timestamp: 2026-04-22T23:51:58.693Z
    event: result_submitted
    reason: "Phase 1A complete. Extended `packages/shared/src/nudge.ts`: added optional `refresh` to `NudgeRequestSchema`; factored `NudgeMetricsSchema`; extended `NudgeResponseSchema` with `source` (enum), `stale` (optional), `generatedAt`, `contentHash` (optional); added `SavedNudgeSchema`/`SavedNudge`. Updated `packages/shared/src/index.ts` to export `NudgeMetricsSchema`, `NudgeMetrics`, `SavedNudgeSchema`, `SavedNudge`. Extended `packages/shared/tests/nudge.test.ts` with the four plan test cases (refresh true/false/omitted, cache response shape, fresh response without stale/contentHash, SavedNudge round-trip) plus a source-enum rejection and a saved-record missing-fields rejection. Existing response tests updated to include now-required `source` and `generatedAt`. Verification: `bun test packages/shared` → 78 pass / 0 fail; `bun run typecheck` clean; `bun run lint` clean."
  - timestamp: 2026-04-22T23:52:01.889Z
    event: status_completed
    reason: "Execution completed"
    from: "in_progress"
    to: "completed"
current_progress: "Read plan, spec context, existing nudge schema/tests. Starting schema edits."
projectName: ink-mirror
---
Phase 1A complete. Extended `packages/shared/src/nudge.ts`: added optional `refresh` to `NudgeRequestSchema`; factored `NudgeMetricsSchema`; extended `NudgeResponseSchema` with `source` (enum), `stale` (optional), `generatedAt`, `contentHash` (optional); added `SavedNudgeSchema`/`SavedNudge`. Updated `packages/shared/src/index.ts` to export `NudgeMetricsSchema`, `NudgeMetrics`, `SavedNudgeSchema`, `SavedNudge`. Extended `packages/shared/tests/nudge.test.ts` with the four plan test cases (refresh true/false/omitted, cache response shape, fresh response without stale/contentHash, SavedNudge round-trip) plus a source-enum rejection and a saved-record missing-fields rejection. Existing response tests updated to include now-required `source` and `generatedAt`. Verification: `bun test packages/shared` → 78 pass / 0 fail; `bun run typecheck` clean; `bun run lint` clean.
