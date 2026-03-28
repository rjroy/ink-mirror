---
title: "Commission: Spec: Craft Nudge integration for ink-mirror"
date: 2026-03-28
status: completed
type: one-shot
tags: [commission]
worker: Octavia
workerDisplayTitle: "Guild Chronicler"
prompt: "Write a spec for integrating the \"Craft Nudge\" feature into ink-mirror.\n\n**Read these first:**\n- `.lore/explorations/review-as-reflection.md` — Celeste's exploration of the review-as-reflection concept, including the Craft Nudge idea\n- `.lore/research/good-writing-principles.md` — Verity's research on writing craft principles grounded in authoritative sources\n- `.lore/specs/v1-core-loop.md` — the existing spec, for format reference and to understand what's already built\n- `.lore/vision.md` — to understand ink-mirror's identity and anti-goals\n\n**Scope: Craft Nudge only.** The exploration document describes multiple review concepts. This spec covers only the Craft Nudge: on-demand, Socratic questions that surface where the writer's text collides with established craft principles. Not the style-profile-based review, not the full critical review. Just the nudge.\n\n**Key design constraints from the user:**\n- On-demand only. Never runs by default. The writer explicitly asks for it.\n- Question-based, not prescriptive. \"Have you considered?\" / \"Did you notice?\" — not \"this is wrong.\"\n- Grounded in the craft principles from Verity's research. Each nudge should trace back to a specific principle.\n- Uses the writer's own text as evidence. Cites specific passages.\n- The writer makes the fix themselves (generation effect). No rewrites, no suggestions.\n\n**Use Verity's research** to define what the nudge function can actually ask about. The research provides concrete, observable anti-patterns with source backing. Those become the nudge categories.\n\n**Write to:** `.lore/specs/craft-nudge.md`\n\nFollow the spec format conventions in the existing v1 spec (numbered requirements, clear scope, explicit anti-goals). Include requirements for the daemon route, the nudge prompt design, how nudges relate to the craft principles, and how results are presented."
dependencies: []
linked_artifacts:
  - .lore/specs/craft-nudge.md

activity_timeline:
  - timestamp: 2026-03-28T05:58:44.373Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-03-28T05:58:44.375Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
  - timestamp: 2026-03-28T05:58:44.392Z
    event: status_in_progress
    reason: "Execution started"
    from: "dispatched"
    to: "in_progress"
  - timestamp: 2026-03-28T05:58:50.671Z
    event: progress_report
    reason: "Reading source documents: exploration, research, v1 spec, and vision."
  - timestamp: 2026-03-28T05:59:22.786Z
    event: progress_report
    reason: "All source documents and codebase infrastructure read. Beginning spec draft. Verified: metrics pipeline (passive voice, hedging, rhythm, sentence structure all exist), session runner interface, route factory pattern, shared schemas. Now writing the spec."
  - timestamp: 2026-03-28T06:05:04.939Z
    event: result_submitted
    reason: "Wrote the Craft Nudge spec at `.lore/specs/craft-nudge.md`. 37 numbered requirements (REQ-CN-1 through REQ-CN-37) covering:\n\n- **Trigger**: On-demand only, no profile or history required, works on day one\n- **12 craft principles** organized in three detection tiers (metrically detectable, metrics-assisted, LLM-dependent), grounded in Verity's research\n- **Output shape**: craftPrinciple identifier, cited evidence, factual observation, Socratic question\n- **Daemon route**: POST /nudge, factory pattern with DI, help tree registration\n- **System prompt design**: Separate from Observer, craft knowledge section, metrics as evidence, optional profile calibration\n- **Response parsing**: Zod validation of LLM output, graceful fallback on malformed JSON\n- **Metrics transparency**: Response includes derived metrics summary with explicit derivation from pipeline output\n- **Cost**: Under $0.02/request on Sonnet\n\nThe spec was reviewed by a fresh-context spec reviewer. Five substantive findings were addressed: metrics schema aligned with actual pipeline field names, entryId behavior clarified as metadata-only, LLM output parsing strategy added, response array bounds made consistent, and AI validation question test tightened."
  - timestamp: 2026-03-28T06:05:11.453Z
    event: status_completed
    reason: "Execution completed"
    from: "in_progress"
    to: "completed"
current_progress: "All source documents and codebase infrastructure read. Beginning spec draft. Verified: metrics pipeline (passive voice, hedging, rhythm, sentence structure all exist), session runner interface, route factory pattern, shared schemas. Now writing the spec."
projectName: ink-mirror
---
Wrote the Craft Nudge spec at `.lore/specs/craft-nudge.md`. 37 numbered requirements (REQ-CN-1 through REQ-CN-37) covering:

- **Trigger**: On-demand only, no profile or history required, works on day one
- **12 craft principles** organized in three detection tiers (metrically detectable, metrics-assisted, LLM-dependent), grounded in Verity's research
- **Output shape**: craftPrinciple identifier, cited evidence, factual observation, Socratic question
- **Daemon route**: POST /nudge, factory pattern with DI, help tree registration
- **System prompt design**: Separate from Observer, craft knowledge section, metrics as evidence, optional profile calibration
- **Response parsing**: Zod validation of LLM output, graceful fallback on malformed JSON
- **Metrics transparency**: Response includes derived metrics summary with explicit derivation from pipeline output
- **Cost**: Under $0.02/request on Sonnet

The spec was reviewed by a fresh-context spec reviewer. Five substantive findings were addressed: metrics schema aligned with actual pipeline field names, entryId behavior clarified as metadata-only, LLM output parsing strategy added, response array bounds made consistent, and AI validation question test tightened.
