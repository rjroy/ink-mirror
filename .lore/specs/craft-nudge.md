---
title: "Craft Nudge"
date: 2026-03-27
status: approved
tags: [spec, craft-nudge, review, craft-knowledge]
req-prefix: CN
related:
  - .lore/vision.md
  - .lore/specs/v1-core-loop.md
  - .lore/explorations/review-as-reflection.md
  - .lore/research/good-writing-principles.md
---

# Spec: Craft Nudge

## Overview

The Craft Nudge is an on-demand function that surfaces where a writer's text collides with established craft principles. The writer views an entry and asks for a review, or provides text directly, and receives Socratic questions grounded in specific passages. Each question traces back to a named craft principle from writing authorities (Williams, Zinsser, Pinker, King, Orwell, Strunk & White). The writer reads the question, looks at their text, and decides what to do. The nudge never answers for them.

This is not the Observer. The Observer compares you to yourself. The nudge compares you to collective craft wisdom. They share infrastructure but draw from different baselines and should remain separate operations.

## Scope

**In scope:**
- A daemon endpoint that accepts text and returns craft nudges
- A system prompt that encodes craft principles as question-generating categories
- A response schema that ties each nudge to a named principle, cited evidence, and a question
- Integration with the existing metrics pipeline for quantitative scaffolding

**Out of scope:**
- Style-profile-based review (profile reflection). Different baseline, different spec.
- Full critical review combining multiple lenses. Depends on this spec and profile reflection.
- Changes to the Observer, curation pipeline, or profile system.
- Storage of nudge results. Nudges are ephemeral.
- CLI or web rendering. This spec defines the daemon contract. Clients render it.

## Vision Boundary

The vision says: "Not a writing course. ink-mirror does not teach writing principles, suggest exercises, or grade your work."

The nudge leans on this boundary. It draws from craft knowledge ("passive voice clustering is worth examining"), and that knowledge encodes an opinion about what matters. Let's be precise about where the line is.

**The nudge does not:**
- Tell the writer what's right or wrong
- Suggest exercises or rewrites
- Grade, score, or rate
- Prescribe fixes ("try active voice here")

**The nudge does:**
- Name a craft pattern the text exhibits
- Cite the writer's own words as evidence
- Ask whether the pattern was intentional
- Offer at least one reading where the pattern is a legitimate choice

The distinction: a teacher who says "passive voice is wrong, fix it" teaches a rule. A teacher who says "did you notice you used passive voice four times here?" teaches attention. The nudge teaches attention. It asks questions, it never answers them.

If the vision's "Not a writing course" anti-goal were written with the nudge in mind, it might read: "ink-mirror does not teach writing principles, suggest exercises, grade your work, or tell you what to fix. It may surface patterns that craft wisdom says are worth examining, but the examination is yours."

## Requirements

### Trigger

- REQ-CN-1: The nudge runs only when the writer explicitly requests it. It never runs by default, never triggers automatically, and never attaches to the entry submission flow.
- REQ-CN-2: The nudge does not require a style profile, entry history, or any prior use of ink-mirror. It works on text alone, because its baseline is craft knowledge, not personal history.
- REQ-CN-3: The writer can nudge an existing entry by ID or provide text directly. `entryId` and `text` are both optional, but at least one is required. When `entryId` is provided without `text`, the route reads the entry's text from storage. When `text` is provided, it's used directly regardless of `entryId`. The primary user path is reviewing entries they've already written ("review this entry"), not pasting into a separate field. The nudge function itself operates on text and does not care where it came from.

### Craft Principles

The nudge draws from twelve principles documented in `.lore/research/good-writing-principles.md`. Each principle has source backing from multiple authorities, observable anti-patterns, and explicit guidance on when the pattern is legitimate. The principles sort into three detection tiers based on how much the metrics pipeline can contribute.

#### Tier 1: Metrically Detectable

The existing metrics pipeline at `packages/daemon/src/metrics/` already computes the quantitative signatures for these. The LLM receives the metrics as evidence and formulates the question.

- REQ-CN-4: **Passive voice clustering** (Principle 3). Flag consecutive passive sentences where the actors are invisible. The signal is clustering, not individual instances. A single passive sentence in a paragraph of active sentences almost never warrants a nudge. The metrics pipeline provides aggregate `passiveCount` and `passiveRatio` via `sentenceStructure`. The route may also call the exported `isPassiveVoice()` from `sentence-structure.ts` directly on each sentence to identify which sentences are passive, providing the LLM with per-sentence evidence beyond the aggregates.
- REQ-CN-5: **Sentence rhythm monotony** (Principle 6). Flag passages where sentence length variance is low across a sustained stretch. The signal is uniformity, not any particular length. The metrics pipeline provides `lengthSequence`, `variance`, `maxConsecutiveShort`, `maxConsecutiveLong`, and `paceChanges` via `rhythm.ts`.
- REQ-CN-6: **Hedging accumulation** (Principle 9). Flag sentences or passages with multiple hedging markers. The signal is accumulation, not individual hedges. A single "I think" is a voice choice. Five hedging markers in one sentence is worth asking about. The metrics pipeline provides `hedgingWords` counts via `word-frequency.ts`.
- REQ-CN-7: **Nominalization density** (Principle 2). Flag passages where buried actions (nouns derived from verbs: -tion, -ment, -ness, -ity, -ence) cluster, especially when paired with empty verbs. The metrics pipeline does not currently detect these; the nudge prompt directs the LLM to watch for the suffix patterns and prepositional chain reactions that Williams identifies as the primary source of unclear prose.

#### Tier 2: Metrics-Assisted, LLM-Interpreted

Metrics provide partial evidence. The LLM interprets what the evidence means in context.

- REQ-CN-8: **Unnecessary words and clutter** (Principle 4). Flag filler phrases ("it is important to note that," "due to the fact that"), redundant pairs, and qualifiers that add no precision. Filler phrase detection is partially mechanical (the list is finite), but judging whether a specific qualifier is unnecessary requires context.
- REQ-CN-9: **Abstract over concrete** (Principle 5). Flag passages dominated by abstract nouns ("situation," "factor," "aspect," "dynamic") where concrete alternatives exist. Some markers are detectable by word category; full judgment requires the LLM to assess whether the abstraction serves the content or obscures it.

#### Tier 3: LLM-Dependent

These require language model judgment and cannot be reliably detected by metrics alone.

- REQ-CN-10: **Buried leads** (Principle 7). Flag paragraphs where the most consequential information appears late, after setup sentences. Requires the LLM to assess which information is most important.
- REQ-CN-11: **Old-before-new violations** (Principle 8). Flag sentence sequences where each sentence leads with unfamiliar information instead of connecting to the previous sentence's endpoint. Requires tracking information flow.
- REQ-CN-12: **Unclear antecedents** (Principle 10). Flag pronouns and demonstratives ("this," "it," "they") where multiple referents are possible. Requires coreference resolution in context.
- REQ-CN-13: **Curse of knowledge** (Principle 11). Flag passages that assume reader knowledge the text hasn't established: undefined jargon, logical leaps, implicit references. Requires the LLM to simulate a reader who doesn't share the writer's context.
- REQ-CN-14: **Dangling modifiers** (Principle 12). Flag participial phrases where the implied subject doesn't match the grammatical subject. Focus on cases that create genuine ambiguity, not technically-incorrect-but-universally-understood constructions.
- REQ-CN-15: **Characters as subjects, actions as verbs** (Principle 1). Flag sentences where the grammatical subject is an abstraction and the main verb is empty, hiding the real actor and action. This is the structural pattern underneath nominalizations and passive voice; the nudge surfaces it when the other two don't capture the full picture.

### Nudge Output Shape

- REQ-CN-16: Each nudge contains four fields:
  - `craftPrinciple`: A machine-readable identifier for the principle (e.g., `"passive-voice-clustering"`, `"buried-lead"`, `"hedging-accumulation"`). Maps to one of the twelve principles.
  - `evidence`: Cited text from the writer's input. The exact words, not a paraphrase.
  - `observation`: What the pattern looks like in this text. A factual statement, not a judgment.
  - `question`: A Socratic question asking whether the pattern was intentional.
- REQ-CN-17: The question must offer at least one reading where the pattern is a legitimate choice. "The passive voice here reads as deliberate institutional register" is a legitimate acknowledgment. Not every question implies a problem.
- REQ-CN-18: The question must not contain corrections, rewrites, suggestions, or alternatives. "Was this intentional?" is acceptable. "Consider changing to active voice" is not.
- REQ-CN-19: The observation field may include brief context for why the pattern is worth examining, but only enough to make the question meaningful. "Four consecutive passive sentences remove the actors from the action" is context. "Passive voice is generally considered weaker" is a lesson. The first is acceptable; the second is not.

### Volume and Selection

- REQ-CN-20: The nudge function returns 3-5 nudges per request, selected for distinctiveness across principles. Two nudges about the same principle in the same response is noise.
- REQ-CN-21: When the text contains more flaggable patterns than the limit, the LLM selects the most distinctive and consequential ones. Metrically strong signals (high passive clustering, extreme rhythm uniformity, dense hedging) take priority over subtle LLM-interpreted patterns.
- REQ-CN-22: Short texts (under ~100 words) may produce fewer than 3 nudges. The system does not pad the response with weak observations to hit a minimum.

### Daemon Route

- REQ-CN-23: Endpoint: `POST /nudge`. Accepts a JSON body with the text to analyze and optional context.
- REQ-CN-24: Request schema:
  ```typescript
  {
    entryId?: string;   // Entry to nudge. Route reads the entry's text from storage.
    text?: string;      // Text to analyze directly. Used as-is when provided.
    context?: string;   // Optional context about the text's purpose or audience
    // At least one of entryId or text is required.
    // When both are provided, text is used (entryId becomes metadata only).
  }
  ```
- REQ-CN-25: Response schema:
  ```typescript
  {
    nudges: CraftNudge[];  // 3-5 nudges; fewer for short texts under ~100 words
    metrics: {             // Summary derived from computeEntryMetrics (transparency)
      passiveRatio: number;          // sentenceStructure.passiveRatio
      totalSentences: number;        // sentenceStructure.totalSentences
      hedgingWordCount: number;      // sum of all values in wordFrequency.hedgingWords
      rhythmVariance: number;        // rhythm.variance
    };
  }
  ```
  The `metrics` field exposes the quantitative scaffolding so the writer can see what the system measured, not just what the LLM interpreted. Each field is derived from `computeEntryMetrics` output; the derivation is noted in the comments above.
- REQ-CN-26: The route follows the existing factory pattern: `createNudgeRoutes(deps: NudgeDeps): RouteModule`. Dependencies are the session runner, the metrics pipeline (`computeEntryMetrics`), an entry reader (`readEntry: (id: string) => Promise<string>`) for resolving `entryId` to text, and optionally a profile reader (`readStyleProfile?: () => Promise<string>`, consistent with the Observer's dependency pattern) for calibration (see REQ-CN-28).
- REQ-CN-27: The route registers an operation in the help tree under `{ root: "nudge", feature: "analyze" }` for CLI discovery.

### Profile Calibration (Optional)

- REQ-CN-28: When the writer has a style profile, it may be included as calibration context in the nudge prompt. The profile doesn't change what the nudge looks for. It changes how the nudge frames the question. If the profile says "uses passive voice deliberately for distance in reflective sections," the nudge should acknowledge that context when it encounters passive voice in a reflective section.
- REQ-CN-29: The profile is never required. A writer with no profile receives the same nudges, just without the calibration. This is the nudge's most important property for onboarding: it works on day one, on any text, with no history.

### System Prompt Design

- REQ-CN-30: The nudge system prompt is a separate prompt from the Observer's `buildSystemPrompt()`. It shares the same output constraints (no corrections, no rewrites, no alternatives) but draws from different source material.
- REQ-CN-31: The system prompt includes:
  1. A preamble defining the nudge's posture: questions, not judgments. Attention, not instruction.
  2. The craft knowledge section: twelve principles, each with its name, what to look for, and how to distinguish intentional use from unconscious habit.
  3. Output format constraints matching the `CraftNudge` schema.
  4. The instruction to formulate every finding as a question that offers at least one reading where the pattern is deliberate.
  5. Pre-computed metrics from the pipeline, presented as quantitative evidence the LLM can reference.
  6. Optionally, the style profile for calibration context.
- REQ-CN-32: The craft knowledge section encodes the twelve principles from Verity's research but does not reproduce the full research document. Each principle is summarized to: what the pattern is, what the observable markers are, and when the pattern is a legitimate choice. The research document (`.lore/research/good-writing-principles.md`) is the authoritative source; the prompt is a compressed working version.
- REQ-CN-33: The user's text appears at the end of the message sequence (highest-attention position per the U-shaped attention curve for long-context LLMs, see REQ-V1-15).
- REQ-CN-34: The route parses LLM output as JSON against the `CraftNudge[]` schema via Zod. Malformed output returns HTTP 200 with an empty `nudges` array and an `error` field describing the parse failure, consistent with the Observer's error handling pattern. Zero valid nudges (including from short texts) returns HTTP 200 with `nudges: []`.

### Cost

- REQ-CN-35: Each nudge request should stay under $0.02 on Sonnet. The prompt is larger than the Observer's (craft knowledge adds ~1,500-2,000 tokens to the system prompt), but there's no entry history or tier-2 context. Estimate: ~3,000 tokens system prompt (including ~1,500-2,000 for craft knowledge) + text length + ~500 tokens output.

## Shared Schemas

- REQ-CN-36: The `CraftNudge` schema and `CraftPrinciple` identifier type belong in `packages/shared/src/`. They are API contract types shared between daemon and clients.
- REQ-CN-37: The craft principle identifiers are:
  - `"characters-as-subjects"` (Principle 1)
  - `"nominalization-density"` (Principle 2)
  - `"passive-voice-clustering"` (Principle 3)
  - `"unnecessary-words"` (Principle 4)
  - `"concrete-over-abstract"` (Principle 5)
  - `"sentence-monotony"` (Principle 6)
  - `"buried-lead"` (Principle 7)
  - `"old-before-new"` (Principle 8)
  - `"hedging-accumulation"` (Principle 9)
  - `"unclear-antecedent"` (Principle 10)
  - `"curse-of-knowledge"` (Principle 11)
  - `"dangling-modifier"` (Principle 12)

## Anti-Goals

**Not a grammar checker.** The nudge does not flag spelling, punctuation, subject-verb agreement, or comma placement. That's Grammarly's territory.

**Not a style enforcer.** The nudge does not apply genre conventions ("academic writing requires..."), register preferences, or taste judgments ("this metaphor is cliched").

**Not a rewriter.** The nudge never produces alternative text. No "try this instead," no "consider rephrasing to," no example rewrites. The generation effect is the feature: the writer does the work.

**Not the Observer.** The nudge does not compare against the writer's own patterns. It does not feed the curation pipeline. It produces no observations that accumulate into the style profile. The Observer and the nudge are parallel lenses, not stages in the same pipeline.

**Not a score.** No readability score, no quality rating, no "your writing improved." The nudge asks questions. It does not evaluate.

## Exit Points

| Exit | Triggers When | Target |
|------|---------------|--------|
| Combined review | Both nudge and profile reflection exist | A combined endpoint that runs both lenses, grouped by type |
| Nudge history | Writers want to track which patterns they've been nudged about over time | [STUB: nudge-tracking] |
| Custom principles | Writers want to add their own craft principles to the nudge | [STUB: custom-nudge-principles] |

## Success Criteria

- [ ] A writer can send text to `POST /nudge` and receive 3-5 craft nudges
- [ ] Each nudge names a specific craft principle, cites evidence from the text, and asks a Socratic question
- [ ] The question offers at least one reading where the pattern is legitimate
- [ ] No nudge contains a correction, rewrite, suggestion, or alternative text
- [ ] Nudges are distinct: no two nudges in the same response reference the same principle
- [ ] The nudge works with no style profile and no entry history
- [ ] When a style profile is provided, the nudge acknowledges relevant profile context
- [ ] The metrics summary is included in the response for transparency
- [ ] The route appears in the daemon's help tree for CLI discovery
- [ ] Cost per request stays under $0.02 on Sonnet

## AI Validation

**Defaults apply:**
- Unit tests with mocked LLM/filesystem dependencies
- 90%+ coverage on new code
- Code review by fresh-context sub-agent

**Custom:**
- Nudge output passes the question test: each nudge must have a non-empty `question` field. Spot-check manually that the question is Socratic (open-ended, not rhetorical with an implied answer).
- Nudge output passes the non-prescription test: no nudge contains imperative verbs directed at the writer ("change," "rewrite," "consider using," "try"). Mechanically verifiable.
- Each `craftPrinciple` in the output maps to one of the twelve defined identifiers. Mechanically verifiable via Zod schema validation.
- The response includes metrically-grounded nudges when the metrics warrant them (high passive ratio, low rhythm variance, dense hedging). Spot-check against known test inputs.

## Open Questions

### 1. Should the nudge explain why a craft pattern matters?

The observation field can carry brief context: "Four consecutive passive sentences remove the actors from the action." That's the reason the question exists. Without it, the writer might not understand why four passive sentences is worth asking about. With it, they have enough context to evaluate their own choice.

This is the narrowest channel through "not a writing course." Not a principle. Not a rule. Just enough context to make the question meaningful. The spec allows it in REQ-CN-19 but the prompt design will need to enforce the boundary between context and lesson.

### 2. How should the context field be used?

REQ-CN-24 includes an optional `context` field ("this is a formal report," "blog post for a technical audience"). This shapes which nudges are relevant: passive voice in a lab report is different from passive voice in a blog post. The prompt should use context to calibrate which patterns are worth questioning, but the field is optional and the nudge must work without it.

### 3. What's the minimum text length for useful nudges?

A single sentence can't exhibit rhythm monotony, sustained hedging, or lead burial. The function should return fewer nudges for short texts (REQ-CN-22) but shouldn't refuse to analyze them. Even a single paragraph can have a dangling modifier or unclear antecedent.

## Context

This spec draws from two artifacts:

- **Celeste's exploration** (`.lore/explorations/review-as-reflection.md`): Introduced the nudge concept, worked through the vision tension, and sketched the architecture fit. This spec crystallizes the requirements from that exploration.
- **Verity's research** (`.lore/research/good-writing-principles.md`): Provided the twelve craft principles with source backing, observable markers, detection tiers, and guidance on when patterns are legitimate. This spec uses those principles as the nudge's knowledge base.

The existing v1 infrastructure supports the nudge without modification. The metrics pipeline computes the quantitative evidence. The session runner handles the LLM call. The route factory pattern provides the integration point. The shared package holds the contract types. No new storage, no new dependencies on the existing Observer or curation pipeline.
