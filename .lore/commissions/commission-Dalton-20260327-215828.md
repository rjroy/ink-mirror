---
title: "Commission: Observer prompt quality: Steps 1-3 (stop words, system prompt, tests)"
date: 2026-03-28
status: completed
type: one-shot
tags: [commission]
worker: Dalton
workerDisplayTitle: "Guild Artificer"
prompt: "Implement Steps 1-3 of the plan at `.lore/plans/observer-prompt-quality.md`. Read the full plan first.\n\n**Step 1: Filter stop words from token frequencies**\n- Add `STOP_WORDS` set to `packages/daemon/src/metrics/word-frequency.ts` following the existing `HEDGING_WORDS`/`INTENSIFIERS` pattern\n- 40-60 common English function words, include contracted forms of auxiliaries/pronouns\n- Filter `tokenFrequencies` before returning from `analyzeWordFrequency()`. `totalTokens` stays unfiltered, `uniqueTokens` reflects the filtered map\n- Update existing tests (the \"the cat sat on the mat\" test will change). Add a test verifying stop words excluded from frequencies but included in totalTokens\n- Add a code comment at `WordFrequencyAnalysisSchema` in `packages/shared/src/metrics.ts` documenting that tokenFrequencies is filtered\n\n**Step 2: Rewrite system prompt for Tier 1+2 awareness**\n- All changes in `buildSystemPrompt()` in `packages/daemon/src/observer.ts`\n- Add \"Context You Receive\" section describing the four user message sections (metrics, style profile, recent entries, current entry)\n- Fix output format example: replace pseudo-JSON with three separate example observations, one per dimension\n- Add evidence citation emphasis to observation rule 3 (exact text, character for character)\n- Add dimension diversity nudge after rule 1\n- Target ~550-650 tokens total for system prompt\n\n**Step 3: Update observer tests**\n- Update `buildSystemPrompt()` tests for new sections (string-contains, not exact match)\n- Add `buildUserMessage()` test for Tier 2 assembly (recent entries + style profile present, correct section order)\n- Verify evidence validation still works\n\nRun all tests before declaring complete. Read the plan for full context on each step."
dependencies: []
linked_artifacts:
  - packages/daemon/src/metrics/word-frequency.ts

  - packages/daemon/src/observer.ts
  - packages/shared/src/metrics.ts
  - packages/daemon/tests/metrics/word-frequency.test.ts
  - packages/daemon/tests/observer.test.ts
  - packages/daemon/src/observer.ts
  - packages/shared/src/metrics.ts
  - packages/daemon/tests/metrics/word-frequency.test.ts
  - packages/daemon/tests/observer.test.ts
activity_timeline:
  - timestamp: 2026-03-28T04:58:28.804Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-03-28T04:58:28.805Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
  - timestamp: 2026-03-28T04:58:28.823Z
    event: status_in_progress
    reason: "Execution started"
    from: "dispatched"
    to: "in_progress"
  - timestamp: 2026-03-28T04:58:48.547Z
    event: progress_report
    reason: "Read plan and all source files. Starting Step 1: stop word filtering in word-frequency.ts."
  - timestamp: 2026-03-28T05:01:18.433Z
    event: result_submitted
    reason: "Steps 1-3 of observer-prompt-quality plan implemented. All 463 tests pass, typecheck clean.\n\n**Step 1: Stop word filtering**\n- Added `STOP_WORDS` set (55 entries) to `packages/daemon/src/metrics/word-frequency.ts` covering articles, prepositions, pronouns, auxiliaries, conjunctions, and contracted forms\n- `analyzeWordFrequency()` now filters stop words from `tokenFrequencies`. `totalTokens` stays unfiltered, `uniqueTokens` reflects filtered content words\n- Hedging/intensifier detection uses the unfiltered frequency map so those signals aren't lost\n- Updated existing \"the cat sat on the mat\" test (uniqueTokens 5→3), added stop word exclusion test\n- Added schema comment at `WordFrequencyAnalysisSchema` in `packages/shared/src/metrics.ts`\n\n**Step 2: System prompt rewrite**\n- Added \"Context You Receive\" section describing all four user message sections (metrics, style profile, recent entries, current entry)\n- Replaced pseudo-JSON output example with three worked examples, one per dimension\n- Added evidence citation emphasis to rule 3: \"character for character\" with validation rejection warning\n- Added dimension diversity nudge after rule 1\n\n**Step 3: Observer test updates**\n- Updated `buildSystemPrompt` tests: context description, evidence emphasis, dimension diversity, worked examples per dimension\n- Added Tier 2 `buildUserMessage` test verifying all four sections present in correct order (recent entries → style profile → metrics → current entry)\n- Existing evidence validation tests still pass unchanged"
  - timestamp: 2026-03-28T05:01:26.229Z
    event: status_completed
    reason: "Execution completed"
    from: "in_progress"
    to: "completed"
current_progress: "Read plan and all source files. Starting Step 1: stop word filtering in word-frequency.ts."
projectName: ink-mirror
---
Steps 1-3 of observer-prompt-quality plan implemented. All 463 tests pass, typecheck clean.

**Step 1: Stop word filtering**
- Added `STOP_WORDS` set (55 entries) to `packages/daemon/src/metrics/word-frequency.ts` covering articles, prepositions, pronouns, auxiliaries, conjunctions, and contracted forms
- `analyzeWordFrequency()` now filters stop words from `tokenFrequencies`. `totalTokens` stays unfiltered, `uniqueTokens` reflects filtered content words
- Hedging/intensifier detection uses the unfiltered frequency map so those signals aren't lost
- Updated existing "the cat sat on the mat" test (uniqueTokens 5→3), added stop word exclusion test
- Added schema comment at `WordFrequencyAnalysisSchema` in `packages/shared/src/metrics.ts`

**Step 2: System prompt rewrite**
- Added "Context You Receive" section describing all four user message sections (metrics, style profile, recent entries, current entry)
- Replaced pseudo-JSON output example with three worked examples, one per dimension
- Added evidence citation emphasis to rule 3: "character for character" with validation rejection warning
- Added dimension diversity nudge after rule 1

**Step 3: Observer test updates**
- Updated `buildSystemPrompt` tests: context description, evidence emphasis, dimension diversity, worked examples per dimension
- Added Tier 2 `buildUserMessage` test verifying all four sections present in correct order (recent entries → style profile → metrics → current entry)
- Existing evidence validation tests still pass unchanged
