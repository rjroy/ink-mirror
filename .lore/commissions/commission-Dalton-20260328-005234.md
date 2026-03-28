---
title: "Commission: Craft Nudge: Steps 1-4 (schemas, prompt, route, wiring)"
date: 2026-03-28
status: completed
type: one-shot
tags: [commission]
worker: Dalton
workerDisplayTitle: "Guild Artificer"
prompt: "Implement Steps 1-4 of the plan at `.lore/plans/craft-nudge.md`. Read the full plan first, including codebase context and open questions.\n\nAlso read these for context:\n- `.lore/specs/craft-nudge.md` — the spec you're implementing against\n- `.lore/research/good-writing-principles.md` — the twelve craft principles to compress into the prompt\n\n**Step 1: Shared Schemas** (`packages/shared/src/nudge.ts`, tests in `packages/shared/tests/nudge.test.ts`)\n- CraftPrinciple enum (12 identifiers), CraftNudge schema (4 fields), NudgeOutput schema (array, 0-5), NudgeRequest schema (entryId/text/context with refinement), NudgeResponse schema (nudges + metrics + optional error)\n- Barrel export from `shared/src/index.ts`\n\n**Step 2: Nudge Prompt and Core Function** (`packages/daemon/src/nudger.ts`, tests in `packages/daemon/tests/nudger.test.ts`)\n- NudgerDeps interface, `nudge()` orchestration function, `buildNudgeSystemPrompt()` with 6 sections, `buildNudgeUserMessage()` with section ordering, `parseNudgeOutput()` with graceful failure\n- Compress all 12 principles from the research doc (~120-150 tokens each, ~2,500 total system prompt)\n- Per-sentence passive voice annotations (only for passive sentences)\n- Independent metrics formatter (don't share with Observer)\n\n**Step 3: Nudge Route** (`packages/daemon/src/routes/nudge.ts`, tests in `packages/daemon/tests/routes/nudge.test.ts`)\n- Route factory with DI following existing pattern\n- POST /nudge handler: resolve text from entryId or direct text, call nudge(), return response\n- Operations registration for help tree\n- Full test suite per plan (10 test cases listed)\n\n**Step 4: Daemon Wiring** (`packages/daemon/src/index.ts`)\n- Wire nudge route with production deps, add to routeModules array\n- ~10 lines following existing pattern\n\nRun all tests (`bun test`) and typecheck (`bun run typecheck`) before declaring complete."
dependencies: []
linked_artifacts:
  - packages/shared/src/nudge.ts

  - packages/shared/tests/nudge.test.ts
  - packages/shared/src/index.ts
  - packages/daemon/src/nudger.ts
  - packages/daemon/tests/nudger.test.ts
  - packages/daemon/src/routes/nudge.ts
  - packages/daemon/tests/routes/nudge.test.ts
  - packages/daemon/src/index.ts
  - packages/shared/tests/nudge.test.ts
  - packages/shared/src/index.ts
  - packages/daemon/src/nudger.ts
  - packages/daemon/tests/nudger.test.ts
  - packages/daemon/src/routes/nudge.ts
  - packages/daemon/tests/routes/nudge.test.ts
  - packages/daemon/src/index.ts
activity_timeline:
  - timestamp: 2026-03-28T07:52:34.731Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-03-28T07:52:34.732Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
  - timestamp: 2026-03-28T07:52:34.749Z
    event: status_in_progress
    reason: "Execution started"
    from: "dispatched"
    to: "in_progress"
  - timestamp: 2026-03-28T07:53:16.087Z
    event: progress_report
    reason: "Read all reference files: plan, spec, research doc, existing Observer/route/schema patterns. Starting Step 1 (shared schemas)."
  - timestamp: 2026-03-28T07:58:42.653Z
    event: progress_report
    reason: "Steps 1-4 complete. All 1,008 tests pass (55 new across 3 test files). Typecheck clean. New files: shared/src/nudge.ts, daemon/src/nudger.ts, daemon/src/routes/nudge.ts, plus 3 test files. Modified: shared/src/index.ts (barrel exports), daemon/src/index.ts (wiring)."
  - timestamp: 2026-03-28T07:59:00.266Z
    event: result_submitted
    reason: "Steps 1-4 of the craft-nudge plan implemented and verified.\n\n**Step 1 (Shared Schemas):** `packages/shared/src/nudge.ts` with CraftPrincipleSchema (12 identifiers via z.enum), CraftNudgeSchema (4 fields), NudgeOutputSchema (0-5 nudges), NudgeRequestSchema (entryId/text with refinement), NudgeResponseSchema (nudges + metrics + optional error). Barrel exports added to `shared/src/index.ts`. 19 tests.\n\n**Step 2 (Nudge Prompt and Core Function):** `packages/daemon/src/nudger.ts` with NudgerDeps interface, `nudge()` orchestration, `buildNudgeSystemPrompt()` with all 6 sections (preamble, craft knowledge by tier, output format, question constraints, context description, selection rules), `buildNudgeUserMessage()` with section ordering (metrics, profile, context, text last), per-sentence passive voice annotations (capped at 10), and `parseNudgeOutput()` with graceful failure. All 12 principles compressed from the research doc (~2,200 tokens system prompt, under the 2,500 budget). Independent metrics formatter per Open Question 1. 25 tests.\n\n**Step 3 (Nudge Route):** `packages/daemon/src/routes/nudge.ts` with route factory following existing pattern, POST /nudge handler (text resolution from entryId or direct text, entry ID validation), operations registration for help tree. 11 tests covering all 10 planned cases plus operation registration.\n\n**Step 4 (Daemon Wiring):** 8 lines added to `packages/daemon/src/index.ts` (import, deps creation with readEntry wrapping entryStore.get, added to routeModules array).\n\n**Verification:** 1,008 tests pass (55 new), typecheck clean, zero regressions."
  - timestamp: 2026-03-28T07:59:03.948Z
    event: status_completed
    reason: "Execution completed"
    from: "in_progress"
    to: "completed"
current_progress: "Steps 1-4 complete. All 1,008 tests pass (55 new across 3 test files). Typecheck clean. New files: shared/src/nudge.ts, daemon/src/nudger.ts, daemon/src/routes/nudge.ts, plus 3 test files. Modified: shared/src/index.ts (barrel exports), daemon/src/index.ts (wiring)."
projectName: ink-mirror
---
Steps 1-4 of the craft-nudge plan implemented and verified.

**Step 1 (Shared Schemas):** `packages/shared/src/nudge.ts` with CraftPrincipleSchema (12 identifiers via z.enum), CraftNudgeSchema (4 fields), NudgeOutputSchema (0-5 nudges), NudgeRequestSchema (entryId/text with refinement), NudgeResponseSchema (nudges + metrics + optional error). Barrel exports added to `shared/src/index.ts`. 19 tests.

**Step 2 (Nudge Prompt and Core Function):** `packages/daemon/src/nudger.ts` with NudgerDeps interface, `nudge()` orchestration, `buildNudgeSystemPrompt()` with all 6 sections (preamble, craft knowledge by tier, output format, question constraints, context description, selection rules), `buildNudgeUserMessage()` with section ordering (metrics, profile, context, text last), per-sentence passive voice annotations (capped at 10), and `parseNudgeOutput()` with graceful failure. All 12 principles compressed from the research doc (~2,200 tokens system prompt, under the 2,500 budget). Independent metrics formatter per Open Question 1. 25 tests.

**Step 3 (Nudge Route):** `packages/daemon/src/routes/nudge.ts` with route factory following existing pattern, POST /nudge handler (text resolution from entryId or direct text, entry ID validation), operations registration for help tree. 11 tests covering all 10 planned cases plus operation registration.

**Step 4 (Daemon Wiring):** 8 lines added to `packages/daemon/src/index.ts` (import, deps creation with readEntry wrapping entryStore.get, added to routeModules array).

**Verification:** 1,008 tests pass (55 new), typecheck clean, zero regressions.
