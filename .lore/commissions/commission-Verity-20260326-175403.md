---
title: "Commission: Research: Style profile versioning over time"
date: 2026-03-27
status: completed
type: one-shot
tags: [commission]
worker: Verity
workerDisplayTitle: "Guild Pathfinder"
prompt: "Research the question defined in `.lore/issues/research-profile-versioning.md`. Save your findings to `.lore/research/profile-versioning.md`.\n\n## Question\n\nHow should the style profile capture voice evolution? If your voice changes (and it will), should old versions be preserved? What does a useful \"voice diff\" look like?\n\n## Research Directions\n\n- Linguistics research on how writing voice evolves (developmental, contextual, temporal patterns)\n- Composition studies on style development in writers\n- Version models: git-style snapshots, continuous deltas, periodic summaries\n- Whether voice change is gradual (profile drifts) or punctuated (deliberate shifts)\n- How much history is useful for self-reflection vs. noise\n\n## Constraints\n\n- Versioning should be automatic (frictionless principle), not require the user to \"save a snapshot\"\n- The storage model should support meaningful comparison without overwhelming the user with diffs\n\n## Context\n\nRead `.lore/vision.md` and `.lore/intent.md` for full project context."
dependencies: []
linked_artifacts:
  - .lore/research/profile-versioning.md

activity_timeline:
  - timestamp: 2026-03-27T00:54:03.120Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-03-27T00:54:03.122Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
  - timestamp: 2026-03-27T00:54:03.136Z
    event: status_in_progress
    reason: "Execution started"
    from: "dispatched"
    to: "in_progress"
  - timestamp: 2026-03-27T00:54:09.859Z
    event: progress_report
    reason: "Starting research. Reading issue definition and project context files."
  - timestamp: 2026-03-27T00:54:32.277Z
    event: progress_report
    reason: "Initial web research complete. Gathering deeper evidence on specific topics: composition studies on voice development, rolling stylometry methods, and punctuated equilibrium in writing style."
  - timestamp: 2026-03-27T00:55:16.234Z
    event: progress_report
    reason: "Evidence gathering complete. Synthesizing findings into the research artifact."
  - timestamp: 2026-03-27T00:56:54.654Z
    event: result_submitted
    reason: "Research complete. Findings saved to `.lore/research/profile-versioning.md`.\n\nKey findings:\n\n**Voice change is predominantly gradual.** Computational stylistics studies (PLOS ONE 2022, Klaussner & Vogel 2018) consistently show that writing style evolves through slow frequency shifts in syntactic structures and vocabulary, not sudden breaks. All eleven authors studied showed significant change; none showed sudden switches. Deliberate reinventions (genre shifts, conscious style changes) do happen but are punctuated events against a gradual baseline.\n\n**Syntactic features change the most.** Sentence structure and grammatical patterns are more discriminative of temporal change than vocabulary or word-level features. This maps well to ink-mirror's existing observation categories.\n\n**Three versioning models analyzed with tradeoffs:**\n- Rolling window (always-current, no snapshots) — frictionless but loses stable reference points\n- Periodic automatic snapshots — stable anchors but arbitrary timing\n- Change-triggered snapshots — aligned to actual shifts but requires threshold tuning\n\nThe evidence points toward a hybrid: rolling window as the live profile, low-frequency periodic snapshots as comparison anchors, and change-triggered annotations for significant shifts.\n\n**Voice diffs should emphasize structure over vocabulary**, store raw feature distributions (compact), and generate human-readable descriptions on demand via the Observer.\n\nFour open questions remain: change detection threshold calibration, cold start minimum entry count, distinguishing contextual variation from temporal evolution, and whether users should be able to manually mark deliberate voice shifts."
  - timestamp: 2026-03-27T00:56:58.312Z
    event: status_completed
    reason: "Execution completed"
    from: "in_progress"
    to: "completed"
current_progress: "Evidence gathering complete. Synthesizing findings into the research artifact."
projectName: ink-mirror
---
Research complete. Findings saved to `.lore/research/profile-versioning.md`.

Key findings:

**Voice change is predominantly gradual.** Computational stylistics studies (PLOS ONE 2022, Klaussner & Vogel 2018) consistently show that writing style evolves through slow frequency shifts in syntactic structures and vocabulary, not sudden breaks. All eleven authors studied showed significant change; none showed sudden switches. Deliberate reinventions (genre shifts, conscious style changes) do happen but are punctuated events against a gradual baseline.

**Syntactic features change the most.** Sentence structure and grammatical patterns are more discriminative of temporal change than vocabulary or word-level features. This maps well to ink-mirror's existing observation categories.

**Three versioning models analyzed with tradeoffs:**
- Rolling window (always-current, no snapshots) — frictionless but loses stable reference points
- Periodic automatic snapshots — stable anchors but arbitrary timing
- Change-triggered snapshots — aligned to actual shifts but requires threshold tuning

The evidence points toward a hybrid: rolling window as the live profile, low-frequency periodic snapshots as comparison anchors, and change-triggered annotations for significant shifts.

**Voice diffs should emphasize structure over vocabulary**, store raw feature distributions (compact), and generate human-readable descriptions on demand via the Observer.

Four open questions remain: change detection threshold calibration, cold start minimum entry count, distinguishing contextual variation from temporal evolution, and whether users should be able to manually mark deliberate voice shifts.
