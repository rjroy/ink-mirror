---
title: "Commission: Phase 4A: Profile Format and Transformation"
date: 2026-03-27
status: pending
type: one-shot
tags: [commission]
worker: Dalton
workerDisplayTitle: "Guild Artificer"
prompt: "Implement Commission 4A from `.lore/plans/v1-core-loop.md`: Profile Format and Transformation.\n\nRead the full plan and spec (`.lore/specs/v1-core-loop.md`) before starting. Also read `.lore/research/profile-versioning.md` for context on what's deferred.\n\n## What to build\n\n- Profile rule format (open question #3 resolution):\n  - Pattern description (stable, no temporal references): \"Uses staccato rhythm for emphasis at paragraph endings\"\n  - Dimension tag: sentence-rhythm\n  - Source summary: \"Confirmed across 3 entries\"\n- Observation-to-rule transformation: strips temporal references, generalizes from instance to characteristic, merges repeated confirmations into single rule with updated source count\n- Profile storage: single markdown file with YAML frontmatter and structured sections per dimension (REQ-V1-26)\n- Profile generation: when observation classified \"intentional,\" check for existing rule covering same pattern. If yes, update source count. If no, create new rule.\n- Daemon routes: `GET /profile`, `PATCH /profile/rules/:id`, `DELETE /profile/rules/:id`, `PUT /profile`\n- CLI: `ink-mirror profile` (display), `ink-mirror profile edit` (open in `$EDITOR`)\n- Profile formatted as AI system prompt material (REQ-V1-23)\n- Tier 2 context activation: when corpus >= 5 entries, Observer includes last 5 entries. Prompt layout: recent entries at start, current entry at end (REQ-V1-15).\n\n## Testing\n\n- Unit tests: observation-to-rule transformation produces stable characteristics\n- Unit tests: duplicate pattern detection merges correctly\n- Unit tests: profile markdown output is valid, structured, parseable\n- Unit tests: Tier 2 context assembly includes/omits entries based on corpus size\n- Integration test: write 5 entries, observe, curate as intentional, verify profile\n- 90%+ coverage on new code"
dependencies:
  - commission-Dalton-20260327-104014
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-03-27T17:40:29.185Z
    event: created
    reason: "Commission created"
current_progress: ""
projectName: ink-mirror
---
