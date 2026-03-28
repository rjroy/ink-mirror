---
title: "Commission: Plan: Craft Nudge implementation"
date: 2026-03-28
status: completed
type: one-shot
tags: [commission]
worker: Octavia
workerDisplayTitle: "Guild Chronicler"
prompt: "Write an implementation plan for the Craft Nudge spec at `.lore/specs/craft-nudge.md`.\n\n**Read first:**\n- `.lore/specs/craft-nudge.md` — the spec you're planning against\n- `.lore/plans/observer-prompt-quality.md` — for plan format reference and to understand how plans work in this project\n- `.lore/plans/v1-core-loop.md` — the v1 plan, for broader format and delegation guide conventions\n- Key implementation files to understand current patterns:\n  - `packages/daemon/src/observer.ts` — existing prompt construction and observation pipeline\n  - `packages/daemon/src/routes/` — route factory patterns\n  - `packages/shared/src/` — schema patterns\n\n**Plan requirements:**\n- Break the work into sequenced implementation steps\n- Each step: files touched, requirements addressed, what to do, what to test\n- Include a delegation guide (which worker at which step, where review goes)\n- Include codebase context: reference actual files, functions, and line numbers so the implementer doesn't have to rediscover the architecture\n- Flag open questions or decisions that need resolution before implementation\n\n**Write to:** `.lore/plans/craft-nudge.md`"
dependencies: []
linked_artifacts:
  - .lore/plans/craft-nudge.md

activity_timeline:
  - timestamp: 2026-03-28T06:30:16.592Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-03-28T06:30:16.594Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
  - timestamp: 2026-03-28T06:30:16.612Z
    event: status_in_progress
    reason: "Execution started"
    from: "dispatched"
    to: "in_progress"
  - timestamp: 2026-03-28T06:30:24.526Z
    event: progress_report
    reason: "Reading spec, reference plans, and implementation files to build context before drafting the plan."
  - timestamp: 2026-03-28T06:31:10.681Z
    event: progress_report
    reason: "All source material read. Preparing to invoke /lore-development:prep-plan and write the plan artifact."
  - timestamp: 2026-03-28T06:34:52.289Z
    event: progress_report
    reason: "Plan draft complete at .lore/plans/craft-nudge.md. Running fresh-eyes plan review."
  - timestamp: 2026-03-28T06:38:03.858Z
    event: result_submitted
    reason: "Implementation plan written to `.lore/plans/craft-nudge.md`. Five steps covering all 37 requirements from the spec.\n\n**Step 1**: Shared schemas (CraftPrinciple enum, CraftNudge, request/response schemas in `packages/shared/src/nudge.ts`).\n**Step 2**: Nudge prompt and core function (`packages/daemon/src/nudger.ts`). Highest-risk step: craft knowledge compression from 12 principles, per-sentence passive annotations, token budget management.\n**Step 3**: Route factory (`packages/daemon/src/routes/nudge.ts`). POST /nudge with entry resolution, help tree registration.\n**Step 4**: Daemon wiring (~10 lines in `packages/daemon/src/index.ts`).\n**Step 5**: Fresh-context spec validation.\n\nFresh-eyes review completed. Three precision issues identified and fixed: (1) documented the intentional `error` field extension beyond REQ-CN-25, (2) replaced conditional formatter language with the decided approach, (3) explicitly numbered all six system prompt sections to match REQ-CN-31.\n\nFour open questions documented with positions taken: metrics formatter independence, passive annotation capping for long texts, entry ID validation scope, and commission structure (one commission for Steps 1-4, separate for Step 5)."
  - timestamp: 2026-03-28T06:38:10.386Z
    event: status_completed
    reason: "Execution completed"
    from: "in_progress"
    to: "completed"
current_progress: "Plan draft complete at .lore/plans/craft-nudge.md. Running fresh-eyes plan review."
projectName: ink-mirror
---
Implementation plan written to `.lore/plans/craft-nudge.md`. Five steps covering all 37 requirements from the spec.

**Step 1**: Shared schemas (CraftPrinciple enum, CraftNudge, request/response schemas in `packages/shared/src/nudge.ts`).
**Step 2**: Nudge prompt and core function (`packages/daemon/src/nudger.ts`). Highest-risk step: craft knowledge compression from 12 principles, per-sentence passive annotations, token budget management.
**Step 3**: Route factory (`packages/daemon/src/routes/nudge.ts`). POST /nudge with entry resolution, help tree registration.
**Step 4**: Daemon wiring (~10 lines in `packages/daemon/src/index.ts`).
**Step 5**: Fresh-context spec validation.

Fresh-eyes review completed. Three precision issues identified and fixed: (1) documented the intentional `error` field extension beyond REQ-CN-25, (2) replaced conditional formatter language with the decided approach, (3) explicitly numbered all six system prompt sections to match REQ-CN-31.

Four open questions documented with positions taken: metrics formatter independence, passive annotation capping for long texts, entry ID validation scope, and commission structure (one commission for Steps 1-4, separate for Step 5).
