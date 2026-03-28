---
title: "Commission: Observer prompt quality: Steps 1-3 (stop words, system prompt, tests)"
date: 2026-03-28
status: dispatched
type: one-shot
tags: [commission]
worker: Dalton
workerDisplayTitle: "Guild Artificer"
prompt: "Implement Steps 1-3 of the plan at `.lore/plans/observer-prompt-quality.md`. Read the full plan first.\n\n**Step 1: Filter stop words from token frequencies**\n- Add `STOP_WORDS` set to `packages/daemon/src/metrics/word-frequency.ts` following the existing `HEDGING_WORDS`/`INTENSIFIERS` pattern\n- 40-60 common English function words, include contracted forms of auxiliaries/pronouns\n- Filter `tokenFrequencies` before returning from `analyzeWordFrequency()`. `totalTokens` stays unfiltered, `uniqueTokens` reflects the filtered map\n- Update existing tests (the \"the cat sat on the mat\" test will change). Add a test verifying stop words excluded from frequencies but included in totalTokens\n- Add a code comment at `WordFrequencyAnalysisSchema` in `packages/shared/src/metrics.ts` documenting that tokenFrequencies is filtered\n\n**Step 2: Rewrite system prompt for Tier 1+2 awareness**\n- All changes in `buildSystemPrompt()` in `packages/daemon/src/observer.ts`\n- Add \"Context You Receive\" section describing the four user message sections (metrics, style profile, recent entries, current entry)\n- Fix output format example: replace pseudo-JSON with three separate example observations, one per dimension\n- Add evidence citation emphasis to observation rule 3 (exact text, character for character)\n- Add dimension diversity nudge after rule 1\n- Target ~550-650 tokens total for system prompt\n\n**Step 3: Update observer tests**\n- Update `buildSystemPrompt()` tests for new sections (string-contains, not exact match)\n- Add `buildUserMessage()` test for Tier 2 assembly (recent entries + style profile present, correct section order)\n- Verify evidence validation still works\n\nRun all tests before declaring complete. Read the plan for full context on each step."
dependencies: []
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-03-28T04:58:28.804Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-03-28T04:58:28.805Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
current_progress: ""
projectName: ink-mirror
---
