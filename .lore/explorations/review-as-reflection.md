---
title: "Exploration: Review as Reflection"
date: 2026-03-27
status: draft
author: Celeste
tags: [exploration, review, vision-extension, style-profile]
related:
  - .lore/vision.md
  - .lore/specs/v1-core-loop.md
  - .lore/research/observation-granularity.md
  - .lore/research/minimum-viable-observation.md
---

# Exploration: Review as Reflection

What if ink-mirror could read a piece of your writing and tell you what it notices, not what's wrong?

The current system observes patterns in journal entries and accumulates them into a style profile. That profile describes what you do. This exploration asks: could the same profile become the baseline for on-demand review, where ink-mirror reads a piece of writing and reflects back how it compares to your established voice?

This is not a feature spec. It's an exploration of what "review" could mean inside a system that refuses to correct.

---

## The Shape Already Forming

Three things already exist in the codebase that make this idea feel less like a proposal and more like something the system was reaching toward:

**1. The style profile is already structured for comparison.** Each `ProfileRule` (`packages/shared/src/profile.ts`) carries a dimension, a pattern description, and a source count. The Observer already receives the profile as context and compares the current entry against it (REQ-V1-9, REQ-V1-13). The comparison infrastructure is built. It just runs automatically on journal entries rather than on-demand on arbitrary text.

**2. The Observer already knows how to cite evidence and name patterns without judging.** The system prompt in `observer.ts:106-164` explicitly forbids corrections, rewrites, and external comparisons. It produces observations like "Three consecutive sentences under 8 words close the entry." That posture, observation without judgment, is exactly what makes ink-mirror's review different from every other tool.

**3. The session runner is a generic LLM entry point.** `SessionRunner` (`packages/daemon/src/session-runner.ts`) takes a system prompt and messages, handles retries, returns content. Nothing about it is specific to observation. A review session would use the same runner with a different system prompt.

The machinery for review exists. What's missing is the intent, the second way to use it.

---

## What "Review" Means Here

### What it is

Review in ink-mirror is **reflection against your own baseline**. You bring a piece of writing (not necessarily a journal entry) and ask: "What do you notice?" The system reads the text, compares it against your style profile, and produces observations about how this piece relates to what you usually do.

The key move: every observation is framed as deviation-or-consistency, not as problem-or-success. "Your profile says you use short declarative closers. This piece ends with a 47-word compound sentence. Is that intentional for this context?" That's a mirror held up to a specific piece of work, calibrated by your own history.

### What it is not

**Not Grammarly.** Grammarly flags errors against a universal standard. ink-mirror reflects patterns against your personal standard. Grammarly says "this is wrong." ink-mirror says "this is different from what you usually do."

**Not ProWritingAid.** ProWritingAid produces reports about readability, overused words, and pacing scored against generic benchmarks. ink-mirror doesn't score. It compares you to you.

**Not an editor.** The review never produces rewrites, alternatives, or "try this instead." It names what it sees and asks whether the deviation was a choice. The generation effect matters here: writers retain more when they identify the fix themselves than when they're handed one.

**Not automatic.** The Observer runs on every journal entry because that's the write-observe-curate loop. Review is different. The user brings a specific text and asks for reflection. It's on-demand, explicit, and scoped to that text.

### The philosophical distinction

Conventional writing tools answer: "Is this good writing?"

ink-mirror review answers: "Is this your writing?"

That's not a softer version of the same question. It's a fundamentally different question. A piece can deviate from your profile in every dimension and still be exactly what you intended, because you're writing in a different register for a different audience. The review surfaces the deviation. You decide whether it's a problem.

---

## How It Could Work

### The review request

The user brings text to the daemon and asks for review. This could be:

- A journal entry they want a second look at
- An email draft
- A document section
- Any text they wrote

The request includes the text and optionally a context note ("this is a work email" or "this is for my blog"). The context note lets the reviewer calibrate expectations without changing the comparison baseline.

### Architecture fit

The daemon already handles the pattern: receive text via REST, assemble context, call the session runner, return structured output. A review endpoint would follow the same shape as entry creation (`POST /entries` in `packages/daemon/src/routes/entries.ts`), but with a different system prompt and no automatic storage.

```
POST /review
  body: { text: string, context?: string }
  response: { reflections: Reflection[] }
```

The review route factory would receive the same deps pattern: `createReviewRoutes({ sessionRunner, profileStore, computeMetrics })`. The profile store provides the baseline. The metrics pipeline provides the quantitative scaffolding. The session runner calls the LLM.

The review prompt would share the Observer's stance (no corrections, no rewrites, no external comparisons) but shift the framing from "what patterns exist in this entry" to "how does this text relate to the writer's established patterns."

### What a reflection looks like

A reflection is structurally similar to an observation, but the shape has two sides: what the profile says and what this text does.

```
{
  "dimension": "sentence-rhythm",
  "profilePattern": "Uses short declarative closers for emphasis",
  "thisText": "Ends with a 47-word compound sentence spanning three clauses",
  "evidence": "The final sentence of the document...",
  "question": "Your closers are usually clipped. This one runs long. Intentional for this context?"
}
```

The `question` field is the key differentiator. Observations in the current system are statements ("You did X"). Reflections are comparisons that end with a question ("You usually do X. Here you did Y. Was that the plan?"). The question invites the writer to think, not to accept or reject.

### What happens with the answer

This is an open question with real tension. Two paths:

**Path A: Reflections are ephemeral.** The review produces observations, the writer reads them, and nothing is stored. The review is a conversation, not a data pipeline. This is simpler and avoids polluting the style profile with one-off analysis of non-journal text.

**Path B: Reflections can optionally feed back.** If the writer marks a deviation as intentional ("yes, I write differently in work emails"), that's a signal that the profile should acknowledge contextual variation. The profile could grow from "I write like this" to "I write like this, except when I'm doing X."

Path A preserves simplicity. Path B adds real value (contextual profiles) but significantly increases complexity. The right first step is probably A, with the review architecture designed so B is possible later without rework.

---

## Review Dimensions

Not every kind of review fits ink-mirror's identity. The filter: does this dimension produce observations the writer can act on through their own awareness, without needing the tool to fix anything?

### Strong fit

**Voice consistency.** "Your profile describes direct, declarative prose. This draft hedges in the opening three paragraphs before becoming direct in the body." This is ink-mirror's core territory, comparing the writer to themselves.

**Rhythm and pacing.** "Your journal entries average 14 words per sentence with rhythmic variation. This piece holds steady at 22 words per sentence throughout." The existing metrics pipeline (`packages/daemon/src/metrics/`) already computes everything needed. Rhythm analysis is the dimension where ink-mirror has the most infrastructure ready.

**Word-level habits.** "Your profile notes deliberate use of 'just' as a softener. This piece uses 'just' 11 times in 400 words, which is 3x your journal baseline." The word frequency metrics are already computed (`packages/daemon/src/metrics/word-frequency.ts`). The review would reuse the same pipeline with a comparison overlay.

**Structural patterns.** "Your journal entries follow a claim-evidence pattern. This piece is all evidence with no framing claims." Paragraph-level structure is already flagged as a deferred dimension in the v1 spec (REQ-V1-12). Review might be where it first becomes useful, because review text is likely to be longer and more structured than journal entries.

### Weaker fit, but worth exploring

**Redundancy.** "The same point appears in paragraphs 2, 5, and 8 with different phrasing." This isn't a voice consistency question, it's a clarity question. But it's still observation-shaped ("here's what I notice") rather than correction-shaped ("remove this"). The writer decides whether repetition is emphasis or accident.

**Argument flow.** "The third paragraph introduces a claim that the fourth paragraph doesn't support or develop." This is further from ink-mirror's core, closer to structural editing. But phrased as an observation ("here's the shape of the argument as I see it"), it fits the posture. The tension: does this require the kind of evaluative judgment the vision explicitly forbids?

### Poor fit

**Grammar and mechanics.** This is Grammarly's job. ink-mirror reviewing grammar would be ink-mirror becoming a different tool.

**Tone polishing.** "This sounds too casual for a professional email." That's a judgment against an external standard (professional norms). ink-mirror only compares you to you. If the writer's profile says they write casually, that's their voice, not a problem.

**Rewriting suggestions.** "Try phrasing this as..." violates the core constraint. The review names what it sees. The writer decides what to change.

---

## Tensions and Open Questions

### 1. Does review violate "Practice Should Be Frictionless" (Principle 3)?

The vision says: "Writing is the only action the user must take. Everything else happens without being asked."

Review is explicitly an action the user takes. They bring text and request reflection. This is a different interaction model than the observe-curate loop, which is automatic.

**Resolution:** Principle 3 applies to the core loop (write, observe, curate, apply). Review is a separate workflow triggered by a separate intent. The user already takes explicit action in curation (classifying observations). Review is another explicit action, not a violation of frictionlessness but an expansion of the tool's surface area.

The important constraint: review must never trigger automatically. No "I noticed your email draft could use review." The user asks. ink-mirror answers.

### 2. Does the profile have enough signal to be useful as a review baseline?

A style profile built from journal entries may not describe how the writer writes in other contexts. Journal prose tends toward introspection, first-person, informal register. Work emails, technical docs, and blog posts are structurally different.

**Resolution (partial):** The profile already captures dimension-specific patterns (sentence rhythm, word habits, sentence structure). Some of these transfer across contexts (word-level habits, hedging patterns). Others may not (paragraph structure, register). The review should be transparent about what it can and can't compare: "I can compare your rhythm and word patterns to your profile. I don't have enough data about your technical writing to compare structure."

This tension points toward a longer-term question: should the profile eventually support multiple contexts? "My journal voice," "my work email voice," "my blog voice." That's a significant extension, but the current `ProfileRule` schema (`packages/shared/src/profile.ts`) doesn't preclude it. A `context` field on rules would do it.

### 3. What text formats should review accept?

Journal entries are plain text. Review targets might be markdown, rich text, emails with quoted reply chains, documents with headers and structure. Does the review pipeline need to handle formatting, or does it operate on raw text?

**Resolution (pragmatic):** Start with plain text and markdown only. The metrics pipeline (`packages/daemon/src/metrics/`) already handles these. If the user pastes formatted text, strip the formatting. The review is about writing patterns, not document structure. Email quoted-reply chains should probably be stripped too (the user didn't write the quoted parts).

### 4. Should review create observations that enter the curation pipeline?

If I review a work email and the reviewer notices I'm hedging more than my profile predicts, should that become a pending observation?

**Argument for:** The insight is real and could refine the profile. "I hedge in work emails" is a pattern worth naming.

**Argument against:** The curation pipeline is designed for journal entries. Injecting observations from arbitrary text muddies the data. The profile is "how I write in my journal," not "how I write everywhere." Mixing sources makes the profile less coherent.

**Resolution:** Keep review observations out of the curation pipeline by default. The writer can manually add a profile rule if the review surfaces something worth capturing. This preserves the profile's coherence while giving the writer full control.

### 5. How does this affect the "What It Is Not" section of the vision?

The vision explicitly says: "Not an editor. ink-mirror does not suggest rewrites, reorganizations, or structural improvements. The Observer names patterns. It does not propose alternatives."

Review-as-reflection stays within this boundary if it strictly observes. But the gravitational pull toward "helpful suggestions" is strong. Every LLM wants to be helpful. The review prompt would need the same strict constraints as the Observer prompt, possibly stricter, because the user is explicitly asking for feedback on a piece they might want to improve.

**Resolution:** The review system prompt must be as disciplined as the Observer's. Observations, evidence, questions. Never alternatives. The `question` field in reflections is the release valve: by asking "was this intentional?", the system invites the writer to think without telling them what to think.

### 6. Cost implications

The Observer runs on Sonnet with a Tier 1+2 context window designed to stay under $1.50/month at daily journaling frequency (spec constraint). Review adds on-demand LLM calls. If a writer reviews three drafts per week, that roughly doubles the LLM cost.

The session runner already handles model selection and token budgets. The review route could use the same model and context strategy. The question is whether the cost envelope in the spec needs revision, or whether review is priced separately from the core loop.

---

## Vision Alignment

Running the four-step analysis against the approved vision (`.lore/vision.md`).

### Anti-goal check

The vision lists five anti-goals. Review-as-reflection:

- **"Not a grammar checker"**: Review does not flag errors. It compares patterns. Clear.
- **"Not a ghostwriter"**: Review does not generate text. It reflects. Clear.
- **"Not a writing course"**: Review does not teach or grade. It observes. Clear.
- **"Not a social platform"**: Review is single-user. Clear.
- **"Not an editor"**: This is the closest tension. Review names patterns and asks questions. It does not suggest alternatives or reorganizations. It stays within bounds as long as the prompt discipline holds. **Flagged but passable.**

### Principle alignment

- **P1 "Writing Takes Practice"**: Review does not generate text. The user writes, then asks for reflection. The writing is theirs. **Aligned.**
- **P2 "Feedback Accelerates Skill"**: Review extends the feedback surface from journal entries to any text. The feedback remains descriptive, not prescriptive. The question format ("was this intentional?") preserves the curation dynamic where the writer's judgment builds awareness. **Strongly aligned.** This is arguably the principle that most supports the extension.
- **P3 "Practice Should Be Frictionless"**: Review is on-demand, not automatic. It adds an interaction the user initiates. This is new friction, but chosen friction: the user asks for it. **Aligned with caveat** that review must never be unsolicited.
- **P4 "Clients are Views"**: Review would be accessible from both CLI and web via the daemon API. Same data, same endpoint, different glass. **Aligned.**

### Tension resolution

The primary tension is between the "Not an editor" anti-goal and the review function's proximity to editorial feedback. The resolution: review produces observations and questions, never suggestions or alternatives. The LLM prompt must enforce this boundary with the same rigor as the Observer prompt.

A secondary tension: the profile is built from journal entries but review applies it to arbitrary text. The resolution: the review is transparent about what it can compare ("I can compare rhythm and word patterns") and what it can't ("I don't have data about your technical writing register").

### Constraint check

- **Single-user**: Review is single-user. No constraint violated.
- **File-based state**: If review reflections are ephemeral (Path A), no new state storage needed. If they persist (Path B), they'd be markdown files. Either way, the constraint holds.
- **Agent SDK only**: Review uses the same session runner, same SDK path. No new LLM integration.
- **Daemon-first**: Review is a daemon endpoint. Clients render results. Architecture unchanged.

---

## What This Is Not (Yet)

This exploration does not propose:

- A review spec with requirements and acceptance criteria
- A timeline or implementation plan
- Changes to the existing Observer or curation pipeline
- New observation dimensions (though review may motivate adding some)
- Multi-context profiles (though the tension around profile applicability points there)

It proposes that the shape exists, that the architecture supports it, that the philosophy permits it, and that the interesting questions are worth investigating.

---

## Summary

ink-mirror already observes patterns and reflects them back. Review extends that reflection from "what do you do?" to "what are you doing here, and is it what you usually do?" The machinery is built (session runner, metrics pipeline, profile store). The posture is established (observation, not correction). The architecture fits (new route, same deps pattern).

The core insight: a style profile that only describes is half a mirror. A mirror you can hold up to specific work, on your terms, when you want it, completes the reflection. The profile stops being a static document and becomes a living baseline against which any piece of writing can be understood.

The risk is gravity. Every review system wants to become an editor. The discipline required to observe without suggesting, to question without correcting, to compare without scoring, is the same discipline the Observer already practices. Review just applies it to a wider surface.
