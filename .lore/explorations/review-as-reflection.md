---
title: "Exploration: Review as Reflection"
date: 2026-03-27
status: draft
author: Celeste
tags: [exploration, review, vision-extension, style-profile, nudge, craft-knowledge]
related:
  - .lore/vision.md
  - .lore/specs/v1-core-loop.md
  - .lore/research/observation-granularity.md
  - .lore/research/minimum-viable-observation.md
---

# Exploration: Review as Reflection

What if ink-mirror could read a piece of your writing and tell you what it notices, not what's wrong?

The current system observes patterns in journal entries and accumulates them into a style profile. That profile describes what you do. This exploration asks two questions, each a different lens on the same text:

1. **Profile reflection:** How does this piece compare to what you usually do? (You against yourself.)
2. **Craft nudge:** Where does this piece collide with what experienced writers generally avoid? (You against collective wisdom, but framed as a question, not a grade.)

The first lens was the starting point of this exploration. The second is the one that pushes against the vision's boundaries in interesting ways, and the one this document spends the most time on.

This is not a feature spec. It's an exploration of what "review" could mean inside a system that refuses to correct.

---

## Two Lenses, One Surface

The Observer watches what you do and names it. Profile reflection holds up what you usually do and asks whether this piece matches. The nudge function does something neither of those does: it holds up what craft wisdom says is worth questioning and asks whether you did it on purpose.

These are not the same operation. They share architecture (session runner, metrics pipeline, daemon endpoint) but they draw from different baselines:

| | Observer | Profile Reflection | Craft Nudge |
|---|---|---|---|
| **Baseline** | The current entry | Your style profile | Established craft knowledge |
| **Question** | "What patterns exist here?" | "Is this consistent with your voice?" | "Did you notice you did this? Was it intentional?" |
| **Posture** | Descriptive statement | Deviation question | Craft question |
| **Triggered by** | Entry submission (automatic) | User request (on-demand) | User request (on-demand) |
| **Teaches?** | No | No | Arguably yes, but through questions, not lessons |

The rest of this exploration focuses on the nudge function, because that's where the tension lives. Profile reflection is architecturally straightforward (the original exploration covers it thoroughly above). The nudge is the idea that needs sharpening.

---

## The Nudge Function

### What it is

A nudge surfaces where your writing collides with patterns that experienced writers generally treat as worth examining. Not errors. Not rules. Patterns that craft wisdom says deserve a second look.

The critical difference from every other writing tool: the nudge asks a question. It does not deliver a verdict.

"In paragraph 3, you used passive voice four times in a row. Was that a deliberate choice for this section, or did it drift there?"

That's it. The writer reads the question. The writer looks at paragraph 3. The writer decides. Maybe the passive was intentional (a report that deliberately distances the narrator from the action). Maybe it drifted in because the writer was tired. The nudge doesn't know which. It doesn't need to. The act of looking is the value.

### What it draws from

The nudge function is grounded in established writing craft knowledge. Not style preferences, not genre conventions, not "rules" that are actually opinions. The kind of patterns that show up across Strunk & White, Zinsser, King, Pinker, and every college writing workshop:

- **Passive voice overuse.** Not "never use passive" (that's a myth). But four consecutive passive sentences in a paragraph that isn't deliberately using distance? Worth asking about.
- **Buried leads.** The key information appears in sentence 7 of a paragraph. The first six sentences are setup. Did you mean to build to it, or did the point get lost?
- **Redundancy.** The same idea appears three times in different words across a page. Emphasis or accident?
- **Unclear antecedents.** "They said it was important, but they disagreed." Who are "they" in each case? The writer knows. Will the reader?
- **Hedging accumulation.** "I think it might possibly be somewhat relevant." One hedging word is a voice choice. Four in a sentence is usually unconscious.
- **Nominalizations.** "The implementation of the process" instead of "implementing the process." Once is fine. A pattern of them buries the action.
- **Sentence monotony.** Twelve sentences in a row at 18-22 words each. The rhythm flatlines. Was that the intent?
- **Dangling modifiers.** "Walking down the street, the trees were beautiful." The trees aren't walking. These are invisible to the writer and obvious to readers.

These aren't obscure craft concerns. They're the patterns that writing workshop instructors have circled in margins for decades. The nudge function takes that circling and turns it into a question.

### What it does not draw from

- **Genre conventions.** "Academic writing requires..." or "business emails should..." That's external standard enforcement, not craft awareness.
- **Grammar rules.** Comma placement, subject-verb agreement, spelling. Grammarly's territory.
- **Taste preferences.** "This metaphor is cliched" or "this word is overused in contemporary prose." That's editorial judgment.
- **The writer's own profile.** That's what profile reflection does. The nudge has a different baseline.

### The generation effect

This design choice is load-bearing, not decorative. Cognitive science research on the generation effect shows that people retain information better when they produce the answer themselves rather than reading it. A nudge that says "you have four passive sentences in paragraph 3, consider changing them" teaches less than a nudge that says "you have four passive sentences in paragraph 3, was that intentional?" because the second version makes the writer do the work of evaluating their own choice.

The writer who looks at paragraph 3 and thinks "no, that drifted, let me fix it" has practiced the skill of noticing passive voice. The writer who gets a correction has practiced the skill of accepting corrections. Those are different muscles. ink-mirror cares about the first one.

---

## What a Nudge Interaction Looks Like

Concrete examples matter more than abstractions here. Imagine a writer submits a blog post draft to the nudge function.

### Example 1: Passive voice clustering

The text contains:

> The project was started in January. The requirements were gathered over two weeks. The design was approved by the committee. Implementation was begun immediately.

Nudge output:

```json
{
  "craft_pattern": "passive-voice-clustering",
  "evidence": "The project was started in January. The requirements were gathered over two weeks. The design was approved by the committee. Implementation was begun immediately.",
  "observation": "Four consecutive sentences use passive voice, removing the actors from the action.",
  "question": "Who started the project? Who gathered requirements? Who approved the design? If those actors matter to the reader, they're currently invisible. Was the distancing intentional here?"
}
```

Notice what this doesn't say: "Change to active voice." It asks who the actors are and whether their absence was a choice. If the writer is deliberately writing in a distanced, institutional register (a project status report, say), the answer is "yes, that's the register." If they're writing a blog post where they want credit for the work, the answer is "oh, I should name people." The nudge doesn't know which. It just asks.

### Example 2: Buried lead

The text contains:

> I spent the morning reviewing the quarterly reports. The numbers were mostly in line with projections. Marketing had a slight overspend but nothing dramatic. The customer acquisition data looked normal. Then I noticed that churn had doubled since last quarter.

Nudge output:

```json
{
  "craft_pattern": "buried-lead",
  "evidence": "Then I noticed that churn had doubled since last quarter.",
  "observation": "The most consequential information in this paragraph appears in the final sentence, after four sentences of routine context.",
  "question": "Churn doubling is the sharpest detail here. It arrives last, after the reader has been told everything is normal. Was the delayed reveal deliberate (building to a surprise) or did the paragraph follow the order you experienced it rather than the order the reader needs it?"
}
```

This nudge names a specific craft pattern (lead burial), cites the evidence, and then offers two possible readings: deliberate suspense vs. accidental chronological ordering. The writer decides which one happened.

### Example 3: Hedging accumulation

The text contains:

> I think the new approach might possibly work better than what we currently have, though I'm not entirely sure it would be appropriate for every situation.

Nudge output:

```json
{
  "craft_pattern": "hedging-accumulation",
  "evidence": "I think the new approach might possibly work better than what we currently have, though I'm not entirely sure it would be appropriate for every situation.",
  "observation": "This sentence contains five hedging markers: 'I think', 'might', 'possibly', 'not entirely sure', 'every situation'. Each one reduces the sentence's commitment.",
  "question": "One or two hedges can signal appropriate uncertainty. Five in a single sentence can read as the writer not trusting their own point. Was the tentativeness calibrated, or did it accumulate?"
}
```

### Example 4: Sentence monotony

The metrics pipeline computes: `lengthSequence: [19, 21, 18, 20, 22, 19, 21, 20, 18, 22]`.

Nudge output:

```json
{
  "craft_pattern": "sentence-monotony",
  "evidence": "Ten consecutive sentences range from 18-22 words with no variation.",
  "observation": "The rhythm holds steady for the entire section. No short punches, no long flowing sentences. The pace is even throughout.",
  "question": "Consistent sentence length creates a metronomic rhythm that can lull the reader. The content may have sharp turns, but the sentences don't reflect them. Was the evenness a conscious choice for this section's tone?"
}
```

### Example 5: Intentional use (no correction needed)

The text is a formal report with deliberate passive voice throughout. The nudge still asks:

```json
{
  "craft_pattern": "passive-voice-clustering",
  "evidence": "Results were analyzed using standard deviation...",
  "observation": "Passive voice is consistent throughout this section.",
  "question": "The passive voice here reads as deliberate institutional register, standard for formal reports. If that's the intent, this is doing exactly what it should."
}
```

A good nudge acknowledges when a pattern appears intentional. Not every question implies a problem. Some questions confirm a choice.

---

## The Vision Tension: "Not a Writing Course"

The vision says:

> "Not a writing course. ink-mirror does not teach writing principles, suggest exercises, or grade your work. It shows you what you do. Whether that's good or bad is your call, and ink-mirror will never make it for you."

The nudge function pushes against this. Let's be honest about that instead of finding a clever way to claim it doesn't.

### Where it pushes

The nudge function draws from craft knowledge. "Passive voice clustering is worth examining" is a writing principle. "Buried leads reduce impact" is a writing principle. The function's knowledge base is, unavoidably, a curated set of things that writing craft says matter. That's teaching, encoded in which patterns the system decides to surface.

A pure mirror reflects only what's there. The moment you choose what to reflect based on external knowledge of what matters, you've introduced a lens. The lens has an opinion, even if it expresses that opinion as a question.

### Where it doesn't

The nudge function does not:

- **Tell the writer what's right.** It asks whether a pattern was intentional. The writer evaluates.
- **Suggest exercises.** There's no "try rewriting this paragraph in active voice." There's just the question.
- **Grade.** No scores, no ratings, no "your writing improved 15% this week."
- **Prescribe.** "Four passive sentences in a row" is a measurement. "Was that deliberate?" is a question. Neither is a rule.

### The actual boundary

The anti-goal "Not a writing course" protects against ink-mirror becoming a system that tells writers what good writing is. The nudge function doesn't tell the writer what good writing is. It tells them what experienced writers generally examine, and then asks whether they meant to do what they did.

The distinction is between a teacher who says "passive voice is wrong, fix it" and a teacher who says "did you notice you used passive voice four times here? Was that what you wanted?" The first teaches a rule. The second teaches attention. ink-mirror's vision is about building awareness through practice. The nudge builds awareness through directed questions.

There's a more precise way to draw this boundary: **ink-mirror never evaluates.** It can observe ("you did this"), compare ("you usually do this, here you did that"), and ask ("did you notice you did this?"). What it cannot do is score ("this is bad"), prescribe ("do this instead"), or correct ("here's a better version"). The nudge function asks. It never answers.

If the vision's anti-goals were written with the nudge function in mind, "Not a writing course" might read: "ink-mirror does not teach writing principles, suggest exercises, grade your work, or tell you what to fix. It may surface patterns that craft wisdom says are worth examining, but the examination is yours."

Whether that's a refinement of the existing boundary or a revision of it is a judgment call for the vision's author.

---

## Architecture Fit

### How the nudge relates to what's built

The nudge function would use the same infrastructure as the Observer and profile reflection, with one key difference in its knowledge source.

**Same:**
- `SessionRunner` (`packages/daemon/src/session-runner.ts`) handles the LLM call
- `computeMetrics` (`packages/daemon/src/metrics/index.ts`) provides quantitative scaffolding. The sentence-structure analysis at `packages/daemon/src/metrics/sentence-structure.ts` already detects passive voice (`isPassiveVoice`), fragments (`isFragment`), and paragraph openers (`classifyOpener`). The rhythm metrics already compute `lengthSequence`, `maxConsecutiveShort/Long`, and `paceChanges`. Hedging words and intensifiers are already extracted by word-frequency analysis. The metrics pipeline is already doing half the nudge's job. It just doesn't ask questions about what it finds.
- Route factory pattern: `createNudgeRoutes({ sessionRunner, computeMetrics })`
- Daemon endpoint, clients render results

**Different:**
- The nudge prompt draws from a craft knowledge base, not the writer's style profile. The profile is optional context ("the writer already uses passive voice frequently, so this clustering may be their normal register") but not the primary baseline.
- The output is question-shaped, not observation-shaped. Each nudge has an evidence citation, a named craft pattern, and a question that asks whether the pattern was intentional.
- The nudge may reference the profile for calibration but doesn't require it. A writer with no profile at all can still receive nudges. This means the nudge function can be useful immediately, before the write-observe-curate loop has built any history.

### Endpoint shape

```
POST /nudge
  body: { text: string, context?: string }
  response: { nudges: CraftNudge[] }
```

```typescript
interface CraftNudge {
  craftPattern: string;       // e.g. "passive-voice-clustering"
  evidence: string;           // cited text from the input
  observation: string;        // what the pattern looks like in this text
  question: string;           // the Socratic question
}
```

### Prompt structure

The nudge system prompt would be a sibling of the Observer's `buildSystemPrompt()` at `observer.ts:105`, sharing the same constraints (no corrections, no rewrites, no alternatives) but adding:

- A craft knowledge section defining the patterns the nudge can surface
- An instruction to formulate every finding as a question
- A constraint that the question must offer at least one reading where the pattern is intentional
- Access to pre-computed metrics as evidence (same as the Observer receives)
- Optionally, the style profile for calibration ("the writer's baseline passive voice usage is 12%, this section is 80%")

### What the nudge doesn't need

- No new storage. Nudges are ephemeral. The writer reads them and acts (or doesn't). Nothing enters the curation pipeline.
- No new metrics. The existing metrics pipeline already detects passive voice, hedging words, sentence rhythm, and structural patterns. The nudge reuses that computation.
- No profile dependency. The nudge works with or without a style profile. This is important: it means the feature is useful from day one, not just after the write-observe-curate loop has matured.

---

## The Nudge and the Observer: Two Different Lenses

A natural question: why not fold the nudge into the Observer?

The Observer's system prompt at `observer.ts:106-164` explicitly forbids comparison to external norms: "All comparisons must be within the entry itself or against the writer's own style profile. NEVER compare to external standards." (Line 123.) This is a core constraint, not an incidental one. The Observer compares you to you. The nudge compares you to collective craft wisdom. They use different baselines and they should remain separate operations.

Folding them together would muddy both. The Observer would start surfacing craft-based observations ("you used passive voice four times" with an implied "and that's usually worth questioning"), which violates its posture. The nudge would start comparing against the profile ("you use passive voice more than you usually do"), which dilutes its craft focus.

Two lenses. One surface. The user chooses which lens to apply.

That said, the profile can serve as calibration for the nudge. If the writer's profile says "uses passive voice deliberately for distance in reflective sections," the nudge should acknowledge that when it encounters passive voice. "Your profile notes deliberate passive voice in reflective sections. This section uses passive voice throughout. If this is that same deliberate distance, carry on." The profile doesn't change what the nudge looks for. It changes how the nudge frames the question.

---

## Open Questions

### 1. How many craft patterns should the nudge know about?

Too few and the nudge is trivial (just a passive voice detector). Too many and the output becomes a wall of questions that overwhelm rather than focus attention. The Observer surfaces 2-3 observations per entry. The nudge should probably surface 3-5 nudges per text, selected for distinctiveness and relevance. A 500-word blog post doesn't need 12 craft questions.

The initial set should be the patterns where the existing metrics pipeline already provides evidence: passive voice (sentence-structure.ts), hedging accumulation (word-frequency.ts hedging detection), sentence monotony (rhythm.ts lengthSequence), and structural patterns (sentence-structure.ts paragraph openers). These four are ready today. Patterns like buried leads, redundancy, and unclear antecedents require LLM interpretation of the text, not just metrics, so the LLM does that work in the prompt rather than the metrics pipeline.

### 2. Should the nudge explain why a craft pattern matters?

"You used passive voice four times in a row" is an observation. "Passive voice removes the actor from the sentence, which can weaken clarity when the reader needs to know who did what" is an explanation. The explanation teaches. Does the nudge include it?

The answer might be: include it, but briefly and in service of the question. "Four consecutive passive sentences remove the actors from the action. Who started the project? Who gathered requirements?" The explanation isn't a lesson. It's the reason the question exists. Without it, the writer might not understand why four passive sentences is worth a question. With it, they have enough context to evaluate their own choice.

This is the narrowest channel through "not a writing course." Not a principle. Not a rule. Just enough context to make the question meaningful.

### 3. Does the nudge need the style profile to be useful?

No. And this might be its most interesting property. Profile reflection requires a built-up profile to have anything to compare against. The nudge function works on text alone, because its baseline is craft knowledge, not personal history. A writer who has never used ink-mirror before can paste a draft and get useful nudges immediately.

This changes the onboarding story. The current v1 loop requires several journal entries before the Observer and profile have enough data to be interesting. The nudge function could be the first thing a new user tries: "Paste something you wrote. Here are the things we noticed worth asking about." That's a meaningful first experience with no ramp-up.

### 4. What if the writer always ignores the nudges?

Then the nudges served their purpose anyway. The act of seeing the question and deciding "no, I meant to do that" is awareness. The nudge doesn't need to change the text to have value. It needs to make the writer look. Even a dismissed nudge is a moment of attention.

### 5. How does this interact with the review-as-profile-reflection lens?

They could be offered separately (the user asks for one or the other) or combined (the user asks for review and gets both lenses). The combined approach is richer but risks overwhelming the writer with too many observations. The separate approach is cleaner but requires the user to understand the distinction between "compare me to myself" and "ask me about craft patterns."

A reasonable default: one endpoint that produces both, with the output clearly grouped by lens. The user sees "Voice Consistency" reflections (profile-based) and "Craft Questions" (nudge-based) in separate sections. They can ignore either.

---

## Summary

The original exploration proposed review-as-reflection: comparing the writer's text to their own style profile. That idea is architecturally sound and philosophically aligned with the vision. This revision adds a second lens: the craft nudge, which compares the writer's text to established craft wisdom and asks questions about what it finds.

The nudge pushes against the "Not a writing course" anti-goal. It doesn't break it, but it leans on the boundary. The resolution: the nudge asks questions, it never answers them. It surfaces patterns worth examining, it never prescribes fixes. The writer does the evaluation. That's the same muscle the curation step exercises, just pointed at a different set of patterns.

The architecture supports it today. The metrics pipeline at `packages/daemon/src/metrics/` already detects the quantitative signatures of most craft patterns the nudge would surface. The session runner handles the LLM call. A new endpoint, a new system prompt, and a new output schema are all that's needed. No new storage, no new dependencies, no changes to the existing Observer or curation pipeline.

The nudge function's most interesting property is that it doesn't require a style profile. It works on day one, on any text, with no history. For a tool that currently requires several journal entries before it becomes interesting, that's a different kind of entry point. You don't start with "write in your journal and wait." You start with "paste something you wrote and see what we ask about."

The risk remains gravity. The nudge that asks "was this intentional?" is one prompt engineering slip from becoming the nudge that says "try this instead." The discipline of the question is the entire feature. Lose the question, and you've built Grammarly with a philosophy degree.
