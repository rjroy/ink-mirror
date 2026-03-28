---
title: "Commission: Spec: Craft Nudge integration for ink-mirror"
date: 2026-03-28
status: dispatched
type: one-shot
tags: [commission]
worker: Octavia
workerDisplayTitle: "Guild Chronicler"
prompt: "Write a spec for integrating the \"Craft Nudge\" feature into ink-mirror.\n\n**Read these first:**\n- `.lore/explorations/review-as-reflection.md` — Celeste's exploration of the review-as-reflection concept, including the Craft Nudge idea\n- `.lore/research/good-writing-principles.md` — Verity's research on writing craft principles grounded in authoritative sources\n- `.lore/specs/v1-core-loop.md` — the existing spec, for format reference and to understand what's already built\n- `.lore/vision.md` — to understand ink-mirror's identity and anti-goals\n\n**Scope: Craft Nudge only.** The exploration document describes multiple review concepts. This spec covers only the Craft Nudge: on-demand, Socratic questions that surface where the writer's text collides with established craft principles. Not the style-profile-based review, not the full critical review. Just the nudge.\n\n**Key design constraints from the user:**\n- On-demand only. Never runs by default. The writer explicitly asks for it.\n- Question-based, not prescriptive. \"Have you considered?\" / \"Did you notice?\" — not \"this is wrong.\"\n- Grounded in the craft principles from Verity's research. Each nudge should trace back to a specific principle.\n- Uses the writer's own text as evidence. Cites specific passages.\n- The writer makes the fix themselves (generation effect). No rewrites, no suggestions.\n\n**Use Verity's research** to define what the nudge function can actually ask about. The research provides concrete, observable anti-patterns with source backing. Those become the nudge categories.\n\n**Write to:** `.lore/specs/craft-nudge.md`\n\nFollow the spec format conventions in the existing v1 spec (numbered requirements, clear scope, explicit anti-goals). Include requirements for the daemon route, the nudge prompt design, how nudges relate to the craft principles, and how results are presented."
dependencies: []
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-03-28T05:58:44.373Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-03-28T05:58:44.375Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
current_progress: ""
projectName: ink-mirror
---
