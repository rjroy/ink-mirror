---
title: "Commission: Craft Nudge: Steps 1-4 (schemas, prompt, route, wiring)"
date: 2026-03-28
status: dispatched
type: one-shot
tags: [commission]
worker: Dalton
workerDisplayTitle: "Guild Artificer"
prompt: "Implement Steps 1-4 of the plan at `.lore/plans/craft-nudge.md`. Read the full plan first, including codebase context and open questions.\n\nAlso read these for context:\n- `.lore/specs/craft-nudge.md` — the spec you're implementing against\n- `.lore/research/good-writing-principles.md` — the twelve craft principles to compress into the prompt\n\n**Step 1: Shared Schemas** (`packages/shared/src/nudge.ts`, tests in `packages/shared/tests/nudge.test.ts`)\n- CraftPrinciple enum (12 identifiers), CraftNudge schema (4 fields), NudgeOutput schema (array, 0-5), NudgeRequest schema (entryId/text/context with refinement), NudgeResponse schema (nudges + metrics + optional error)\n- Barrel export from `shared/src/index.ts`\n\n**Step 2: Nudge Prompt and Core Function** (`packages/daemon/src/nudger.ts`, tests in `packages/daemon/tests/nudger.test.ts`)\n- NudgerDeps interface, `nudge()` orchestration function, `buildNudgeSystemPrompt()` with 6 sections, `buildNudgeUserMessage()` with section ordering, `parseNudgeOutput()` with graceful failure\n- Compress all 12 principles from the research doc (~120-150 tokens each, ~2,500 total system prompt)\n- Per-sentence passive voice annotations (only for passive sentences)\n- Independent metrics formatter (don't share with Observer)\n\n**Step 3: Nudge Route** (`packages/daemon/src/routes/nudge.ts`, tests in `packages/daemon/tests/routes/nudge.test.ts`)\n- Route factory with DI following existing pattern\n- POST /nudge handler: resolve text from entryId or direct text, call nudge(), return response\n- Operations registration for help tree\n- Full test suite per plan (10 test cases listed)\n\n**Step 4: Daemon Wiring** (`packages/daemon/src/index.ts`)\n- Wire nudge route with production deps, add to routeModules array\n- ~10 lines following existing pattern\n\nRun all tests (`bun test`) and typecheck (`bun run typecheck`) before declaring complete."
dependencies: []
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-03-28T07:52:34.731Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-03-28T07:52:34.732Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
current_progress: ""
projectName: ink-mirror
---
