---
title: "Commission: Research: Observer history window strategy"
date: 2026-03-27
status: dispatched
type: one-shot
tags: [commission]
worker: Verity
workerDisplayTitle: "Guild Pathfinder"
prompt: "Research the question defined in `.lore/issues/research-observer-history-window.md`. Save your findings to `.lore/research/observer-history-window.md`.\n\n## Question\n\nHow much historical context does the Observer need when analyzing a new entry? The full corpus is expensive and slow. No history makes observations shallow. What's the right window?\n\n## Research Directions\n\n- Token window strategies for personal writing corpora\n- RAG approaches for selective history retrieval (retrieve relevant entries, not all entries)\n- How existing writing tools (Grammarly, ProWritingAid, Hemingway) handle historical comparison\n- Cost modeling: what does a typical observation cost at 10, 50, 200 entries of context?\n- Whether recency-weighted sampling outperforms fixed windows\n- Academic work on how much context is needed to identify stylistic patterns\n\n## Constraints\n\n- Must satisfy the frictionless principle: the user should never configure or think about the history window\n- Observation quality should improve with corpus size, not degrade from noise\n\n## Context\n\nRead `.lore/vision.md` and `.lore/intent.md` for full project context."
dependencies: []
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-03-27T00:54:01.118Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-03-27T00:54:01.121Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
current_progress: ""
projectName: ink-mirror
---
