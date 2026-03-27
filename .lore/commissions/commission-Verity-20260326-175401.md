---
title: "Commission: Research: Observer history window strategy"
date: 2026-03-27
status: completed
type: one-shot
tags: [commission]
worker: Verity
workerDisplayTitle: "Guild Pathfinder"
prompt: "Research the question defined in `.lore/issues/research-observer-history-window.md`. Save your findings to `.lore/research/observer-history-window.md`.\n\n## Question\n\nHow much historical context does the Observer need when analyzing a new entry? The full corpus is expensive and slow. No history makes observations shallow. What's the right window?\n\n## Research Directions\n\n- Token window strategies for personal writing corpora\n- RAG approaches for selective history retrieval (retrieve relevant entries, not all entries)\n- How existing writing tools (Grammarly, ProWritingAid, Hemingway) handle historical comparison\n- Cost modeling: what does a typical observation cost at 10, 50, 200 entries of context?\n- Whether recency-weighted sampling outperforms fixed windows\n- Academic work on how much context is needed to identify stylistic patterns\n\n## Constraints\n\n- Must satisfy the frictionless principle: the user should never configure or think about the history window\n- Observation quality should improve with corpus size, not degrade from noise\n\n## Context\n\nRead `.lore/vision.md` and `.lore/intent.md` for full project context."
dependencies: []
linked_artifacts:
  - .lore/research/observer-history-window.md

activity_timeline:
  - timestamp: 2026-03-27T00:54:01.118Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-03-27T00:54:01.121Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
  - timestamp: 2026-03-27T00:54:01.133Z
    event: status_in_progress
    reason: "Execution started"
    from: "dispatched"
    to: "in_progress"
  - timestamp: 2026-03-27T00:54:13.142Z
    event: progress_report
    reason: "Read issue file, vision, and intent. Understanding the domain: ink-mirror's Observer needs historical context to compare writing patterns across entries. Now beginning external research across the six research directions."
  - timestamp: 2026-03-27T00:55:25.522Z
    event: progress_report
    reason: "Completed web research across all six directions. Key findings gathered on: stylometry minimum samples (2,000-5,000 words), RAG vs long context (RAG 8-82x cheaper, maintains 95% accuracy at 25% tokens), lost-in-the-middle effects, Grammarly's passive voice profiling approach, and Claude API pricing. Now synthesizing into the research document."
  - timestamp: 2026-03-27T00:57:50.263Z
    event: result_submitted
    reason: "Research complete. Findings saved to `.lore/research/observer-history-window.md`.\n\n**Core finding:** A three-tier hybrid strategy outperforms both fixed windows and full-corpus approaches:\n1. **Always included:** Current entry + style profile (the profile IS compressed history) + system prompt (~3,500 tokens)\n2. **Recency window (5+ entries):** Last 5 entries for drift detection (~6,000 tokens total)\n3. **Semantic retrieval (20+ entries):** 3 most similar past entries via embedding search (~8,000 tokens total)\n\n**Key evidence:**\n- Stylometry research (Eder): 2,000-5,000 words minimum for pattern identification (~10-25 journal entries)\n- Lost-in-the-middle (Stanford): 20-30% accuracy drop when relevant info is in the middle of long contexts\n- Pinecone benchmarks: RAG maintains 95% accuracy at 25% of tokens, 8-82x cheaper than long context\n- Cost modeling: Hybrid strategy costs ~$0.36/month on Haiku vs ~$9.54/month for 200-entry brute force (daily journaling)\n\n**Three options presented** (profile-only, full hybrid, deferred retrieval) with tradeoffs. The document flags what could not be verified: LLM stylistic detection vs sample size, whether the style profile alone is sufficient context, and optimal recency window size."
  - timestamp: 2026-03-27T00:57:56.907Z
    event: status_completed
    reason: "Execution completed"
    from: "in_progress"
    to: "completed"
current_progress: "Completed web research across all six directions. Key findings gathered on: stylometry minimum samples (2,000-5,000 words), RAG vs long context (RAG 8-82x cheaper, maintains 95% accuracy at 25% tokens), lost-in-the-middle effects, Grammarly's passive voice profiling approach, and Claude API pricing. Now synthesizing into the research document."
projectName: ink-mirror
---
Research complete. Findings saved to `.lore/research/observer-history-window.md`.

**Core finding:** A three-tier hybrid strategy outperforms both fixed windows and full-corpus approaches:
1. **Always included:** Current entry + style profile (the profile IS compressed history) + system prompt (~3,500 tokens)
2. **Recency window (5+ entries):** Last 5 entries for drift detection (~6,000 tokens total)
3. **Semantic retrieval (20+ entries):** 3 most similar past entries via embedding search (~8,000 tokens total)

**Key evidence:**
- Stylometry research (Eder): 2,000-5,000 words minimum for pattern identification (~10-25 journal entries)
- Lost-in-the-middle (Stanford): 20-30% accuracy drop when relevant info is in the middle of long contexts
- Pinecone benchmarks: RAG maintains 95% accuracy at 25% of tokens, 8-82x cheaper than long context
- Cost modeling: Hybrid strategy costs ~$0.36/month on Haiku vs ~$9.54/month for 200-entry brute force (daily journaling)

**Three options presented** (profile-only, full hybrid, deferred retrieval) with tradeoffs. The document flags what could not be verified: LLM stylistic detection vs sample size, whether the style profile alone is sufficient context, and optimal recency window size.
