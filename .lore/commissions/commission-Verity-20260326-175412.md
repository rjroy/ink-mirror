---
title: "Commission: Research: Minimum viable observation set"
date: 2026-03-27
status: completed
type: one-shot
tags: [commission]
worker: Verity
workerDisplayTitle: "Guild Pathfinder"
prompt: "Research the question defined in `.lore/issues/research-minimum-viable-observation.md`. Save your findings to `.lore/research/minimum-viable-observation.md`.\n\n## Question\n\nThe Observer could analyze dozens of dimensions. Which two or three matter most for a first version that proves the concept?\n\n## Dependency\n\nThis commission depends on the observation granularity research. Read `.lore/research/observation-granularity.md` first, as it establishes the dimensions and measurement approaches that this research filters down to an MVP set.\n\n## Constraints\n\n- Must prove the core loop: write, observe, curate, apply\n- Observations must be concrete enough to curate (\"is this intentional?\")\n- The MVP set should cover different categories (e.g., one structural, one tonal) so the range of observation types is visible early\n\n## Context\n\nRead `.lore/vision.md` and `.lore/intent.md` for full project context."
dependencies:
  - commission-Verity-20260326-175358
linked_artifacts:
  - .lore/research/minimum-viable-observation.md

activity_timeline:
  - timestamp: 2026-03-27T00:54:12.066Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-03-27T00:56:58.337Z
    event: status_blocked
    reason: "Dependencies not satisfied"
    from: "pending"
    to: "blocked"
  - timestamp: 2026-03-27T00:58:11.171Z
    event: status_pending
    reason: "Dependencies satisfied"
    from: "blocked"
    to: "pending"
  - timestamp: 2026-03-27T00:58:11.173Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
  - timestamp: 2026-03-27T00:58:11.184Z
    event: status_in_progress
    reason: "Execution started"
    from: "dispatched"
    to: "in_progress"
  - timestamp: 2026-03-27T00:58:17.597Z
    event: progress_report
    reason: "Starting research. Reading dependency files: issue definition, observation granularity research, vision, and intent."
  - timestamp: 2026-03-27T00:58:35.524Z
    event: progress_report
    reason: "All context loaded. Synthesizing MVP observation set from granularity research, vision constraints, and core loop requirements."
  - timestamp: 2026-03-27T01:00:00.896Z
    event: result_submitted
    reason: "Research complete. Wrote findings to `.lore/research/minimum-viable-observation.md`.\n\n**Three MVP dimensions selected:**\n\n1. **Sentence rhythm** (structural) — sentence length patterns, pace shifts, consecutive short/long runs. Strongest candidate: unambiguous measurement, works from entry one, produces clear curation questions.\n\n2. **Word-level habits** (lexical) — repeated words, hedging language, filler patterns. Highest surprise factor for writers. Covers a different category than rhythm, proving multi-dimensional observation.\n\n3. **Sentence structure** (structural, secondary) — active/passive, opener patterns, fragment use. Adds depth within the structural category. Could be deferred if implementation cost is high without weakening the proof of concept.\n\n**Sentence rhythm + word habits are the load-bearing pair.** They prove the core loop across two different categories (structural and lexical), both work from a single entry with no history, and both produce observations that are concrete enough to curate.\n\n**Deferred:** vocabulary register (requires evaluative judgment), paragraph structure (needs longer entries), tonal markers (thin boundary between observation and evaluation).\n\nThe research also flags two implementation-relevant questions: LLM-native vs. pre-computed metrics for testability, and the need for a convention to transform curated observations into stable profile rules."
  - timestamp: 2026-03-27T01:00:07.485Z
    event: status_completed
    reason: "Execution completed"
    from: "in_progress"
    to: "completed"
current_progress: "All context loaded. Synthesizing MVP observation set from granularity research, vision constraints, and core loop requirements."
projectName: ink-mirror
---
Research complete. Wrote findings to `.lore/research/minimum-viable-observation.md`.

**Three MVP dimensions selected:**

1. **Sentence rhythm** (structural) — sentence length patterns, pace shifts, consecutive short/long runs. Strongest candidate: unambiguous measurement, works from entry one, produces clear curation questions.

2. **Word-level habits** (lexical) — repeated words, hedging language, filler patterns. Highest surprise factor for writers. Covers a different category than rhythm, proving multi-dimensional observation.

3. **Sentence structure** (structural, secondary) — active/passive, opener patterns, fragment use. Adds depth within the structural category. Could be deferred if implementation cost is high without weakening the proof of concept.

**Sentence rhythm + word habits are the load-bearing pair.** They prove the core loop across two different categories (structural and lexical), both work from a single entry with no history, and both produce observations that are concrete enough to curate.

**Deferred:** vocabulary register (requires evaluative judgment), paragraph structure (needs longer entries), tonal markers (thin boundary between observation and evaluation).

The research also flags two implementation-relevant questions: LLM-native vs. pre-computed metrics for testability, and the need for a convention to transform curated observations into stable profile rules.
