---
title: "Commission: Phase 2B: Observer Integration"
date: 2026-03-27
status: blocked
type: one-shot
tags: [commission]
worker: Dalton
workerDisplayTitle: "Guild Artificer"
prompt: "Implement Commission 2B from `.lore/plans/v1-core-loop.md`: Observer Integration.\n\nRead the full plan, spec (`.lore/specs/v1-core-loop.md`), and research files:\n- `.lore/research/observation-granularity.md`\n- `.lore/research/minimum-viable-observation.md`\n- `.lore/research/observer-history-window.md`\n\n## What to build\n\nThe LLM half. Connects the metrics pipeline to the Claude API through a session runner.\n\n- Session runner: single entry point for all LLM calls (REQ-V1-27). Handles prompt assembly, streaming, error recovery. Callers pass a session description; the runner manages the SDK interaction.\n- Observer prompt: system instructions, observation format requirements, the \"curation test\" constraint (REQ-V1-6), the \"2-3 observations\" limit (REQ-V1-8), the \"no external comparison\" rule (REQ-V1-9)\n- Tier 1 context assembly: system prompt + style profile (empty at first) + pre-computed metrics + current entry text (REQ-V1-13)\n- Prompt layout: current entry at the end for highest attention (REQ-V1-15)\n- Observation storage: one YAML file per observation in an `observations/` directory. Each file contains: pattern name, cited evidence, dimension, entry reference, curation status (pending), timestamps.\n- Auto-trigger: observation runs when an entry is submitted via POST (REQ-V1-4)\n- Two dimensions active: sentence rhythm and word-level habits (REQ-V1-10 partial)\n- Observation output validation: each observation must have cited text from the entry (REQ-V1-7) and a named pattern (REQ-V1-5)\n\n## Testing\n\n- Unit tests: session runner with mocked queryFn verifies prompt assembly structure\n- Unit tests: observation output validation rejects observations missing cited evidence or pattern name\n- Integration test: submit entry via API, receive observations (mocked LLM returns known observations)\n- 90%+ coverage on new code\n\n## Critical constraint\n\nThe Observer must NEVER generate text for the user. Observations describe patterns. No alternatives, corrections, or rewrites. No comparisons to external norms or other writers (REQ-V1-9)."
dependencies:
  - commission-Dalton-20260327-103902
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-03-27T17:39:21.437Z
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
