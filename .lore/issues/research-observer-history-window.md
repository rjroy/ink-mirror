---
title: "Research: Observer history window strategy"
type: research
status: complete
date: 2026-03-26
origin: vision open question
tags: [observer, research, performance, cost]
---

# Research: Observer History Window Strategy

## Question

How much historical context does the Observer need when analyzing a new entry? The full corpus is expensive and slow. No history makes observations shallow. What's the right window?

## Research Directions

- Token window strategies for personal writing corpora
- RAG approaches for selective history retrieval (retrieve relevant entries, not all entries)
- How existing writing tools (Grammarly, ProWritingAid, Hemingway) handle historical comparison
- Cost modeling: what does a typical observation cost at 10, 50, 200 entries of context?
- Whether recency-weighted sampling outperforms fixed windows
- Academic work on how much context is needed to identify stylistic patterns

## Constraints

- Must satisfy the frictionless principle: the user should never configure or think about the history window
- Observation quality should improve with corpus size, not degrade from noise
