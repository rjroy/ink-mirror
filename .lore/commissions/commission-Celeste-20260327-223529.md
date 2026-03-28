---
title: "Commission: Explore: Socratic nudge check for ink-mirror"
date: 2026-03-28
status: completed
type: one-shot
tags: [commission]
worker: Celeste
workerDisplayTitle: "Guild Visionary"
prompt: "You previously wrote `.lore/explorations/review-as-reflection.md` exploring a critical review function. Read that first. This commission refines and sharpens the idea based on the user's latest thinking.\n\nThe user wants to challenge the anti-goal \"Not a writing course\" in the vision. The idea: a button that makes things better, but not by telling you what's wrong. Instead, it asks questions.\n\n**Core concept:**\n- Instead of \"these 3 things are wrong,\" ask \"have you considered?\" or \"did you notice you did this?\"\n- It's like the existing reflection/observation system but pointed at things that collective wisdom says is \"bad\" in writing\n- Socratic, not prescriptive. The writer makes the fix themselves (generation effect matters for retention)\n- On-demand only. Not a default check. The user explicitly asks for it.\n\n**What it is:**\n- A nudge function grounded in established writing craft knowledge (passive voice overuse, buried leads, redundancy, unclear antecedents, etc.)\n- Question-based: surfaces patterns and asks if they were intentional\n- Uses the writer's own text as evidence (\"In paragraph 3, you used passive voice four times. Was that a deliberate choice for this section?\")\n\n**What it is NOT:**\n- Not grammar checking (Grammarly does that)\n- Not rewriting (\"here's a better version\")\n- Not a list of errors (\"these 3 things are wrong\")\n- Not on by default\n\n**Key tension to explore:**\n- The vision says \"Not a writing course.\" This pushes against that boundary. How do you frame a feature that teaches without teaching? The answer might be in the question-based approach: the tool doesn't tell you what's right, it asks you to look more carefully at what you did.\n- How does this relate to the existing style profile? The observer captures what you DO. This nudge function would surface where what you do collides with what experienced writers generally avoid. That's a different lens.\n\n**Write or update** your exploration document with this refined concept. Be concrete about what a nudge interaction would look like (examples of actual nudge questions), how it fits the architecture, and whether it genuinely conflicts with the vision's anti-goals or just appears to."
dependencies: []
linked_artifacts:
  - .lore/explorations/review-as-reflection.md

activity_timeline:
  - timestamp: 2026-03-28T05:35:29.147Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-03-28T05:35:29.149Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
  - timestamp: 2026-03-28T05:35:29.167Z
    event: status_in_progress
    reason: "Execution started"
    from: "dispatched"
    to: "in_progress"
  - timestamp: 2026-03-28T05:35:50.514Z
    event: progress_report
    reason: "Read existing exploration and vision documents. Now reading the observer prompt, style profile schema, and metrics to ground the refined concept in concrete architecture."
  - timestamp: 2026-03-28T05:36:10.502Z
    event: progress_report
    reason: "Read all source files. The architecture is clear. Now writing the refined exploration: the nudge function as Socratic craft reflection, distinct from the profile-comparison review in the original exploration."
  - timestamp: 2026-03-28T05:39:12.717Z
    event: result_submitted
    reason: "Updated `.lore/explorations/review-as-reflection.md` with the refined nudge function concept.\n\nThe exploration now covers two distinct lenses: profile reflection (compare you to yourself) and craft nudge (compare you to collective craft wisdom, via questions). The revision focuses on the nudge, which is the idea with genuine vision tension.\n\nKey additions:\n- **Concrete nudge examples**: Five worked examples showing exactly what nudge output looks like (passive voice clustering, buried leads, hedging accumulation, sentence monotony, and intentional-use acknowledgment)\n- **Honest vision tension analysis**: Names specifically where the nudge pushes against \"Not a writing course\" and proposes the boundary: ink-mirror never evaluates, it asks. The question is the entire feature.\n- **Architecture grounding**: Maps nudge patterns to existing metrics infrastructure (passive voice detection in `sentence-structure.ts`, hedging in `word-frequency.ts`, rhythm in `rhythm.ts`). No new storage or dependencies needed.\n- **Separation from Observer**: Explains why the nudge must remain a separate operation (different baseline: craft knowledge vs. personal profile) rather than being folded into the Observer\n- **Onboarding insight**: The nudge doesn't require a style profile, making it useful from day one, a different entry point than the write-observe-curate loop that needs history to become interesting"
  - timestamp: 2026-03-28T05:39:20.286Z
    event: status_completed
    reason: "Execution completed"
    from: "in_progress"
    to: "completed"
current_progress: "Read all source files. The architecture is clear. Now writing the refined exploration: the nudge function as Socratic craft reflection, distinct from the profile-comparison review in the original exploration."
projectName: ink-mirror
---
Updated `.lore/explorations/review-as-reflection.md` with the refined nudge function concept.

The exploration now covers two distinct lenses: profile reflection (compare you to yourself) and craft nudge (compare you to collective craft wisdom, via questions). The revision focuses on the nudge, which is the idea with genuine vision tension.

Key additions:
- **Concrete nudge examples**: Five worked examples showing exactly what nudge output looks like (passive voice clustering, buried leads, hedging accumulation, sentence monotony, and intentional-use acknowledgment)
- **Honest vision tension analysis**: Names specifically where the nudge pushes against "Not a writing course" and proposes the boundary: ink-mirror never evaluates, it asks. The question is the entire feature.
- **Architecture grounding**: Maps nudge patterns to existing metrics infrastructure (passive voice detection in `sentence-structure.ts`, hedging in `word-frequency.ts`, rhythm in `rhythm.ts`). No new storage or dependencies needed.
- **Separation from Observer**: Explains why the nudge must remain a separate operation (different baseline: craft knowledge vs. personal profile) rather than being folded into the Observer
- **Onboarding insight**: The nudge doesn't require a style profile, making it useful from day one, a different entry point than the write-observe-curate loop that needs history to become interesting
