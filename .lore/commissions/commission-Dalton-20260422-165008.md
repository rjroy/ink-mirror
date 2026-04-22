---
title: "Commission: Phase 1A: Build nudge persistence shared schema"
date: 2026-04-22
status: dispatched
tags: [commission]
worker: Dalton
workerDisplayTitle: "Guild Artificer"
prompt: "Implement Phase 1A of `.lore/plans/craft-nudge-persistence.md`.\n\nSpec: `.lore/specs/craft-nudge-persistence.md`\nPlan: `.lore/plans/craft-nudge-persistence.md` (see \"Phase 1: Shared Schema\" → \"Commission 1A — Build: extend nudge schemas\")\n\nScope is strictly the shared package:\n- Extend `NudgeRequestSchema` and `NudgeResponseSchema` in `packages/shared/src/nudge.ts` per the plan.\n- Factor a `NudgeMetricsSchema` and introduce `SavedNudgeSchema`/`SavedNudge` type.\n- Export new types/schemas from `packages/shared/src/index.ts`.\n- Update `packages/shared/tests/nudge.test.ts` with the four test cases listed in the plan.\n\nOut of scope: daemon route changes, storage code, web client, CLI.\n\nVerify:\n```\nbun test packages/shared\nbun run typecheck\n```\n\nBoth must pass before reporting complete."
dependencies: []
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-04-22T23:50:08.779Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-04-22T23:50:08.780Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
current_progress: ""
projectName: ink-mirror
---
