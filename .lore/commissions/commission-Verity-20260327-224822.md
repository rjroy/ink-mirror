---
title: "Commission: Research: What makes writing good? Craft principles for ink-mirror's nudge function"
date: 2026-03-28
status: completed
type: one-shot
tags: [commission]
worker: Verity
workerDisplayTitle: "Guild Pathfinder"
prompt: "ink-mirror is a writing self-awareness tool. We're exploring a \"nudge\" feature that asks Socratic questions about a writer's work based on what experienced writers generally consider weak or strong craft. To build that, we need a grounded understanding of what \"good writing\" means in practice.\n\n**Read first:** `.lore/explorations/review-as-reflection.md` for context on what we're building toward.\n\n**Your research question:** What are the widely-agreed-upon principles of good writing, grounded in authoritative sources? Not grammar rules. Not style preferences. The craft-level patterns that experienced writers and writing teachers consistently identify as separating strong prose from weak prose.\n\n**What we need:**\n- A set of concrete, observable patterns that distinguish strong writing from weak writing. Things you can point to in text: passive voice density, buried leads, redundant phrases, vague antecedents, nominalizations, hedging patterns, sentence rhythm monotony, etc.\n- Each pattern should be grounded in specific sources (books, essays, research). Not \"experts say\" but \"Strunk & White say X, Zinsser says Y, Pinker argues Z.\"\n- Distinguish between universal craft principles (nearly everyone agrees) vs. stylistic preferences (reasonable people disagree). We only want the first category for the nudge function.\n- Focus on prose (essays, articles, reflective writing, professional communication). Not fiction-specific advice (character development, plot structure).\n\n**Sources to investigate:**\n- Classic craft books: Strunk & White \"Elements of Style,\" Zinsser \"On Writing Well,\" Pinker \"The Sense of Style,\" Williams \"Style: Lessons in Clarity and Grace,\" Orwell \"Politics and the English Language,\" King \"On Writing\"\n- Academic writing research: readability studies, plain language movement, cognitive load theory as it applies to writing\n- Modern perspectives that challenge or refine the classics (the backlash against rigid rules, context-dependent advice)\n\n**What we DON'T need:**\n- An exhaustive taxonomy of every writing principle ever articulated\n- Grammar rules (we're not building a grammar checker)\n- Fiction-specific craft advice\n- A literature review format. This should be practical and usable.\n\n**Output format:** Write to `.lore/research/good-writing-principles.md`. Organize by principle, not by source. For each principle: what the pattern is, why it matters (cognitive/clarity reasoning), what the observable anti-pattern looks like in text, and which sources support it. Flag where sources disagree.\n\nThis research will feed into designing the nudge rules for ink-mirror. The principles need to be concrete enough that an LLM could look at a piece of writing and ask a pointed question about a specific instance."
dependencies: []
linked_artifacts:
  - .lore/research/good-writing-principles.md

activity_timeline:
  - timestamp: 2026-03-28T05:48:22.680Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-03-28T05:48:22.681Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
  - timestamp: 2026-03-28T05:48:22.709Z
    event: status_in_progress
    reason: "Execution started"
    from: "dispatched"
    to: "in_progress"
  - timestamp: 2026-03-28T05:48:29.396Z
    event: progress_report
    reason: "Starting research on good writing principles. Reading context document and checking for existing research."
  - timestamp: 2026-03-28T05:48:41.911Z
    event: progress_report
    reason: "Context loaded. Now researching craft principles across authoritative sources: Strunk & White, Zinsser, Pinker, Williams, Orwell, King, and academic readability/cognitive load research."
  - timestamp: 2026-03-28T05:49:42.534Z
    event: progress_report
    reason: "Research gathered from all major sources. Now synthesizing into the output document organized by principle with source citations, anti-patterns, and disagreement flags."
  - timestamp: 2026-03-28T05:53:21.081Z
    event: result_submitted
    reason: "Research complete. Wrote `.lore/research/good-writing-principles.md` covering 12 concrete, source-grounded writing craft principles organized for the nudge function.\n\n**What's in the document:**\n\n12 principles, each with: the pattern, why it matters (cognitive/clarity reasoning), observable anti-patterns, specific source citations, and disagreement flags. Plus a section on principles considered and excluded (stylistic preferences, not universal craft), a source assessment, and implementation implications for the nudge function.\n\n**The 12 principles:**\n1. Characters as subjects, actions as verbs (Williams, Pinker, Orwell)\n2. Nominalizations bury actions (Williams, Orwell, Zinsser, Pinker — universal agreement)\n3. Passive voice: default active, know when passive serves (all sources, with Pullum's criticism of Strunk & White flagged)\n4. Cut unnecessary words (Zinsser, Strunk & White, Orwell, King)\n5. Concrete over abstract (Orwell, Zinsser, King, Pinker)\n6. Sentence rhythm variation (readability research, King, Zinsser, Pinker)\n7. Lead with the point (Zinsser, Williams, journalism tradition)\n8. Old information before new (Williams, Pinker, psycholinguistics research)\n9. Hedging accumulation (Zinsser, Pinker, Williams, academic writing research)\n10. Unclear antecedents (universal across all sources)\n11. Curse of knowledge (Pinker, cognitive science, plain language movement)\n12. Dangling/misplaced modifiers (universal across all sources)\n\n**Key finding for implementation:** The principles sort into three detection categories: metrically detectable (passive clustering, rhythm, hedging, nominalizations — the existing metrics pipeline handles these), hybrid metrics+LLM (clutter, abstract language), and LLM-dependent (buried leads, antecedents, curse of knowledge, information flow). The first category is ready today.\n\n**Where sources disagree most:** Passive voice. Every source recommends defaulting to active, but the blanket \"avoid passive\" rule is rejected by Pinker, Williams, and Pullum. The consensus: flag clustering and unconscious passive, not individual instances."
  - timestamp: 2026-03-28T05:53:27.473Z
    event: status_completed
    reason: "Execution completed"
    from: "in_progress"
    to: "completed"
current_progress: "Research gathered from all major sources. Now synthesizing into the output document organized by principle with source citations, anti-patterns, and disagreement flags."
projectName: ink-mirror
---
Research complete. Wrote `.lore/research/good-writing-principles.md` covering 12 concrete, source-grounded writing craft principles organized for the nudge function.

**What's in the document:**

12 principles, each with: the pattern, why it matters (cognitive/clarity reasoning), observable anti-patterns, specific source citations, and disagreement flags. Plus a section on principles considered and excluded (stylistic preferences, not universal craft), a source assessment, and implementation implications for the nudge function.

**The 12 principles:**
1. Characters as subjects, actions as verbs (Williams, Pinker, Orwell)
2. Nominalizations bury actions (Williams, Orwell, Zinsser, Pinker — universal agreement)
3. Passive voice: default active, know when passive serves (all sources, with Pullum's criticism of Strunk & White flagged)
4. Cut unnecessary words (Zinsser, Strunk & White, Orwell, King)
5. Concrete over abstract (Orwell, Zinsser, King, Pinker)
6. Sentence rhythm variation (readability research, King, Zinsser, Pinker)
7. Lead with the point (Zinsser, Williams, journalism tradition)
8. Old information before new (Williams, Pinker, psycholinguistics research)
9. Hedging accumulation (Zinsser, Pinker, Williams, academic writing research)
10. Unclear antecedents (universal across all sources)
11. Curse of knowledge (Pinker, cognitive science, plain language movement)
12. Dangling/misplaced modifiers (universal across all sources)

**Key finding for implementation:** The principles sort into three detection categories: metrically detectable (passive clustering, rhythm, hedging, nominalizations — the existing metrics pipeline handles these), hybrid metrics+LLM (clutter, abstract language), and LLM-dependent (buried leads, antecedents, curse of knowledge, information flow). The first category is ready today.

**Where sources disagree most:** Passive voice. Every source recommends defaulting to active, but the blanket "avoid passive" rule is rejected by Pinker, Williams, and Pullum. The consensus: flag clustering and unconscious passive, not individual instances.
