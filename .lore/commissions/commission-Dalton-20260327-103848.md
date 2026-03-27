---
title: "Commission: Phase 2A: Metrics Preprocessing"
date: 2026-03-27
status: blocked
type: one-shot
tags: [commission]
worker: Dalton
workerDisplayTitle: "Guild Artificer"
prompt: "Implement Commission 2A from `.lore/plans/v1-core-loop.md`: Metrics Preprocessing.\n\nRead the full plan, spec (`.lore/specs/v1-core-loop.md`), and the observation granularity research (`.lore/research/observation-granularity.md`).\n\n## What to build\n\nThe deterministic half of the observation pipeline. No LLM calls. All outputs testable with unit tests.\n\n- Sentence splitter (handles abbreviations, dialogue, markdown formatting)\n- Per-sentence metrics: word count, character count\n- Entry-level rhythm analysis: length sequence, variance, consecutive-short/long runs, pace changes between sections\n- Word frequency analysis: token frequencies, hedging word detection (\"just\", \"actually\", \"probably\", \"I think\"), intensifier detection, repeated phrase detection\n- Metrics output as a structured object (typed, serializable) that the Observer prompt will consume\n- All analysis functions are pure: text in, metrics out. No side effects.\n\n## Testing\n\n- Unit tests: metrics pipeline produces correct output for known inputs (sentence lengths, word frequencies, rhythm patterns)\n- Test with varied markdown: headings, lists, code blocks, dialogue, abbreviations\n- 90%+ coverage on new code\n\n## Constraints\n\n- Pure functions only. No side effects beyond returning the metrics object.\n- The output type must be serializable (it gets embedded in Observer prompts in Phase 2B)."
dependencies:
  - commission-Dalton-20260327-103833
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-03-27T17:38:48.110Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-03-27T17:48:48.112Z
    event: status_blocked
    reason: "Dependencies not satisfied"
    from: "pending"
    to: "blocked"
current_progress: ""
projectName: ink-mirror
---
