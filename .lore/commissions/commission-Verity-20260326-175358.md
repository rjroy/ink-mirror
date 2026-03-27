---
title: "Commission: Research: Observation granularity"
date: 2026-03-27
status: completed
type: one-shot
tags: [commission]
worker: Verity
workerDisplayTitle: "Guild Pathfinder"
prompt: "Research the question defined in `.lore/issues/research-observation-granularity.md`. Save your findings to `.lore/research/observation-granularity.md`.\n\n## Question\n\nWhat level of abstraction makes an observation useful? \"You use short sentences\" is too broad. \"You used the word 'just' 47 times in March\" is too narrow. The Observer needs specificity that's actionable and generality that forms patterns.\n\n## Research Directions\n\n- Computational stylistics: how do linguists categorize and measure style?\n- Writing pedagogy: what feedback granularity do writing instructors use?\n- Existing style analysis tools and what dimensions they report\n- Whether granularity should be fixed or adaptive (coarse for new users, finer with more data)\n\n## Constraints\n\n- Must satisfy the frictionless principle: the user should not need to configure what dimensions are observed\n- Granularity should be specific enough for curation decisions (\"is this intentional?\") but general enough to accumulate into profile patterns\n\n## Context\n\nRead `.lore/vision.md` and `.lore/intent.md` for full project context. This research directly informs the minimum viable observation set (a separate research issue)."
dependencies: []
linked_artifacts:
  - .lore/research/observation-granularity.md

activity_timeline:
  - timestamp: 2026-03-27T00:53:58.612Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-03-27T00:53:58.613Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
  - timestamp: 2026-03-27T00:53:58.628Z
    event: status_in_progress
    reason: "Execution started"
    from: "dispatched"
    to: "in_progress"
  - timestamp: 2026-03-27T00:54:05.761Z
    event: progress_report
    reason: "Starting research on observation granularity. Reading project context files first."
  - timestamp: 2026-03-27T00:54:22.762Z
    event: progress_report
    reason: "Context loaded. Beginning external research across four directions: computational stylistics, writing pedagogy feedback granularity, existing style analysis tools, and adaptive vs fixed granularity."
  - timestamp: 2026-03-27T00:55:29.154Z
    event: progress_report
    reason: "External research collected. Synthesizing findings across all four research directions into the observation-granularity research artifact."
  - timestamp: 2026-03-27T00:58:03.284Z
    event: result_submitted
    reason: "Research artifact written to `.lore/research/observation-granularity.md`.\n\n**Core finding:** Three fields (computational stylistics, writing pedagogy, existing tools) converge on the same answer. Observations are most useful at the **pattern level**, between raw counts and broad categories. A useful observation names a specific recurring behavior, cites evidence from the text, and is phrased so the writer can answer \"is this intentional?\"\n\n**Key outputs:**\n- Six proposed observation categories: sentence rhythm, sentence structure, word-level habits, vocabulary register, paragraph/structural, tonal markers\n- Five granularity rules (curatable, evidence over counts, patterns over instances, comparison against self, limit per entry)\n- Adaptive granularity model that works without configuration (coarse at 1-5 entries, comparative at 6-20, deviation-aware at 20+)\n- Confidence assessment distinguishing verified claims from inferences\n- Thread connecting to minimum viable observation set research (sentence rhythm + word-level habits as MVP candidates)"
  - timestamp: 2026-03-27T00:58:11.150Z
    event: status_completed
    reason: "Execution completed"
    from: "in_progress"
    to: "completed"
current_progress: "External research collected. Synthesizing findings across all four research directions into the observation-granularity research artifact."
projectName: ink-mirror
---
Research artifact written to `.lore/research/observation-granularity.md`.

**Core finding:** Three fields (computational stylistics, writing pedagogy, existing tools) converge on the same answer. Observations are most useful at the **pattern level**, between raw counts and broad categories. A useful observation names a specific recurring behavior, cites evidence from the text, and is phrased so the writer can answer "is this intentional?"

**Key outputs:**
- Six proposed observation categories: sentence rhythm, sentence structure, word-level habits, vocabulary register, paragraph/structural, tonal markers
- Five granularity rules (curatable, evidence over counts, patterns over instances, comparison against self, limit per entry)
- Adaptive granularity model that works without configuration (coarse at 1-5 entries, comparative at 6-20, deviation-aware at 20+)
- Confidence assessment distinguishing verified claims from inferences
- Thread connecting to minimum viable observation set research (sentence rhythm + word-level habits as MVP candidates)
