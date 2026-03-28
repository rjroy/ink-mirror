---
title: "Commission: Research: What makes writing good? Craft principles for ink-mirror's nudge function"
date: 2026-03-28
status: abandoned
type: one-shot
tags: [commission]
worker: Verity
workerDisplayTitle: "Guild Pathfinder"
prompt: "ink-mirror is a writing self-awareness tool. We're exploring a \"nudge\" feature that asks Socratic questions about a writer's work based on what experienced writers generally consider weak or strong craft. To build that, we need a grounded understanding of what \"good writing\" means in practice.\n\n**Read first:** `.lore/explorations/review-as-reflection.md` for context on what we're building toward.\n\n**Your research question:** What are the widely-agreed-upon principles of good writing, grounded in authoritative sources? Not grammar rules. Not style preferences. The craft-level patterns that experienced writers and writing teachers consistently identify as separating strong prose from weak prose.\n\n**What we need:**\n- A set of concrete, observable patterns that distinguish strong writing from weak writing. Things you can point to in text: passive voice density, buried leads, redundant phrases, vague antecedents, nominalizations, hedging patterns, sentence rhythm monotony, etc.\n- Each pattern should be grounded in specific sources (books, essays, research). Not \"experts say\" but \"Strunk & White say X, Zinsser says Y, Pinker argues Z.\"\n- Distinguish between universal craft principles (nearly everyone agrees) vs. stylistic preferences (reasonable people disagree). We only want the first category for the nudge function.\n- Focus on prose (essays, articles, reflective writing, professional communication). Not fiction-specific advice (character development, plot structure).\n\n**Sources to investigate:**\n- Classic craft books: Strunk & White \"Elements of Style,\" Zinsser \"On Writing Well,\" Pinker \"The Sense of Style,\" Williams \"Style: Lessons in Clarity and Grace,\" Orwell \"Politics and the English Language,\" King \"On Writing\"\n- Academic writing research: readability studies, plain language movement, cognitive load theory as it applies to writing\n- Modern perspectives that challenge or refine the classics (the backlash against rigid rules, context-dependent advice)\n\n**What we DON'T need:**\n- An exhaustive taxonomy of every writing principle ever articulated\n- Grammar rules (we're not building a grammar checker)\n- Fiction-specific craft advice\n- A literature review format. This should be practical and usable.\n\n**Output format:** Write to `.lore/research/good-writing-principles.md`. Organize by principle, not by source. For each principle: what the pattern is, why it matters (cognitive/clarity reasoning), what the observable anti-pattern looks like in text, and which sources support it. Flag where sources disagree.\n\nThis research will feed into designing the nudge rules for ink-mirror. The principles need to be concrete enough that an LLM could look at a piece of writing and ask a pointed question about a specific instance."
dependencies: []
linked_artifacts: []

resource_overrides:
  model: claude-sonnet-4-6

activity_timeline:
  - timestamp: 2026-03-28T05:48:16.073Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-03-28T05:55:10.851Z
    event: status_abandoned
    reason: "Duplicate. Original dispatch failed due to invalid model override. Successfully re-dispatched as commission-Verity-20260327-224822, which completed."
    from: "pending"
    to: "abandoned"
current_progress: ""
projectName: ink-mirror
---
