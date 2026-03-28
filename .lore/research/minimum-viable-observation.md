---
title: "Research: Minimum Viable Observation Set"
status: complete
date: 2026-03-26
related:
  - .lore/issues/research-minimum-viable-observation.md
  - .lore/research/observation-granularity.md
tags: [observer, research, observation-model, mvp]
---

# Research: Minimum Viable Observation Set

## The Question

The Observer could analyze dozens of dimensions. Which two or three matter most for a first version that proves the concept?

## Selection Criteria

Three constraints shaped this selection, drawn from the commission and the vision:

1. **Prove the core loop.** Each observation type must flow cleanly through write, observe, curate, apply. If it's hard to observe automatically, hard to phrase as a curation question, or hard to express as a profile rule, it fails regardless of how interesting it is.

2. **Concrete enough to curate.** The writer must be able to answer "is this intentional?" without ambiguity. This eliminates anything that requires subjective interpretation by the Observer or corpus-scale comparison before it becomes meaningful.

3. **Cover different categories.** The MVP set should demonstrate that ink-mirror observes multiple dimensions of writing, not just one. A structural observation and a lexical observation prove a different point than two structural observations.

## The Candidates

The granularity research (`.lore/research/observation-granularity.md`) established six categories. Here's how each performs against the three criteria:

| Category | Loop viability | Curation clarity | Notes |
|----------|---------------|------------------|-------|
| **Sentence rhythm** | Strong | Strong | Measurable from entry one. Length patterns are visible, unambiguous, curatable. |
| **Sentence structure** | Strong | Medium | Active/passive and clause complexity are measurable. Opener variety requires enough paragraphs to be meaningful. |
| **Word-level habits** | Strong | Strong | Repeated words and hedging language are concrete and surprising to writers. Easy to cite evidence. |
| **Vocabulary register** | Medium | Medium | Formal/casual mixing is real but requires judgment calls about what counts as "formal." Harder to make non-evaluative. |
| **Paragraph/structural** | Medium | Medium | Needs longer entries to produce meaningful patterns. A 3-sentence journal entry has no paragraph structure to observe. |
| **Tonal markers** | Weak for MVP | Weak | Directness and emotional intensity require interpretation. The boundary between observation and evaluation is thin here. |

## Recommended MVP Set: Three Dimensions

### 1. Sentence Rhythm (structural)

**What it observes:** Sentence length patterns within an entry. Consecutive short or long sentences, variation or uniformity, pace shifts between sections.

**Why it's first:** This is the single strongest candidate across all three criteria. Sentence length is unambiguous to measure (word count per sentence). Patterns are visible in any entry longer than a few sentences. The curation question is clear: "You wrote four consecutive sentences under 8 words in the closing paragraph. Is that rhythmic emphasis or did you run out of steam?" The profile rule writes itself: "Uses staccato rhythm for emphasis at paragraph endings."

**What the observation looks like:**
> Three consecutive sentences under 8 words close the entry. The preceding paragraph averages 19 words per sentence. This creates a sharp deceleration in pace.

**Profile rule it produces (after curation):**
> Closes entries with short, clipped sentences for emphasis. Typical closing sentence length: 4-8 words.

**Evidence this works from entry one:** Sentence length requires no history. The pattern exists within a single entry. Even a 5-sentence entry can show variation or uniformity.

### 2. Word-Level Habits (lexical)

**What it observes:** Repeated words or phrases, hedging language ("just," "actually," "probably," "I think"), intensifiers, and filler patterns.

**Why it's second:** Word habits are the dimension most likely to surprise writers. People don't notice their verbal tics in written form. The curation moment ("wait, I wrote 'actually' six times?") is where ink-mirror's value becomes tangible. The observation is concrete (specific word, specific count, specific locations), the curation question is clear ("is that your voice or a tic?"), and the profile rule is actionable.

**What the observation looks like:**
> The word "just" appears in 5 of 11 sentences, typically qualifying a claim: "I just think," "it's just that," "just a small thing." This softens the directional language in surrounding sentences.

**Profile rule it produces (after curation):**
> Uses "just" as a deliberate qualifier to soften direct statements. Intentional hedging pattern.

*Or, if marked accidental:*
> Tends toward "just" as filler. Not part of intentional voice.

**Why this covers a different category:** Sentence rhythm is structural (how sentences are built). Word habits are lexical (what words recur). Together they show that ink-mirror observes at multiple levels of the writing, not just one.

### 3. Sentence Structure (structural, secondary)

**What it observes:** Active vs. passive voice ratio, paragraph opener patterns (do most paragraphs start with "I"? with a dependent clause? with a conjunction?), and fragment use.

**Why it's third, not second:** Sentence structure is strong but overlaps with sentence rhythm. Both are structural observations. Including it as a third dimension adds depth to the structural category without sacrificing the lexical coverage that word-level habits provide.

**What the observation looks like:**
> 6 of 8 paragraphs open with "I" followed by a simple past tense verb. The two exceptions open with temporal markers ("Yesterday," "Later that night").

**Profile rule it produces (after curation):**
> Journal entries follow an "I + past tense" opener pattern. Variations use temporal anchors.

**Why include a third at all:** Two dimensions prove the concept. Three dimensions prove that within a category (structural), the Observer can distinguish different patterns (rhythm vs. syntax). This matters for demonstrating that the observation space is genuinely multi-dimensional, not just "we check two things."

---

## What's Excluded from MVP (and Why)

**Vocabulary register** (formal/casual mixing): Requires the Observer to make judgment calls about what constitutes "formal" vs. "casual." That judgment is exactly the kind of evaluative framing the vision says to avoid. This dimension becomes viable later when the writer's curation history establishes their own register baseline. Not suitable for cold start.

**Paragraph/structural** (length distribution, topic patterns): Needs longer entries to produce meaningful patterns. Many journal entries are a few paragraphs. This dimension becomes more useful as history accumulates, particularly when comparing paragraph structure across entries. A better fit for the "Entry 6-20" adaptive stage described in the granularity research.

**Tonal markers** (directness, hedging intensity, emotional range): The boundary between observation and evaluation is thinnest here. "You qualified every assertion" is an observation. "Your writing sounds uncertain" is a judgment. The Observer would need to stay on the right side of that line consistently, which is a prompt engineering challenge that shouldn't be the first thing validated. Better to prove the loop works with unambiguous dimensions first, then extend to tonal analysis once the observation pipeline is solid.

---

## How the Three Work Together

The MVP set covers the observation space along two axes:

```
                    Structural ←————————————→ Lexical
                         |                       |
Single-entry         Sentence Rhythm         Word Habits
patterns             Sentence Structure
                         |                       |
```

Sentence rhythm and word habits are the load-bearing pair. They prove the loop across two different categories. Sentence structure adds depth within the structural category without adding implementation complexity (it uses the same sentence-level parsing as rhythm).

All three produce observations from a single entry with no history. All three generate clear curation questions. All three produce profile rules that a writer would recognize as describing their voice.

---

## Implementation Implications

These are observations about what the MVP set implies for the Observer's design, not recommendations for how to build it.

**Parsing requirements:** All three dimensions need sentence boundary detection and word tokenization. Sentence structure additionally needs POS tagging (for active/passive detection) or at minimum pattern matching for common constructions. These are well-solved problems in NLP; the question is whether to use a library or let the LLM handle it during observation.

**Two viable approaches:**
- *LLM-native:* The Observer prompt includes the entry text and asks for observations across the three dimensions. The LLM does all parsing internally. Simpler to build. Quality depends on prompt engineering. Harder to test deterministically.
- *Pre-computed metrics + LLM interpretation:* A preprocessing step computes sentence lengths, word frequencies, and structural markers. These metrics are included in the Observer prompt alongside the raw text. The LLM interprets the metrics as patterns. More testable (metrics are deterministic), but adds a pipeline stage.

**The curation question format matters.** Each observation needs to be phrased so the writer can answer "intentional / accidental / undecided" without needing to reread the entire entry. Including the cited evidence in the observation (as shown in the examples above) is what makes this work.

**The profile rule format needs a convention.** When a curated observation becomes a profile entry, it needs to be phrased as a stable characteristic, not as a one-time finding. "Uses staccato rhythm for emphasis" (stable) vs. "Used four short sentences in the March 26 entry" (one-time). The Apply phase needs a consistent transformation from observation to rule.

---

## Confidence Assessment

| Claim | Confidence | Basis |
|-------|-----------|-------|
| Sentence rhythm is the strongest MVP candidate | High | Unambiguous measurement, works from entry one, produces clear curation questions. Directly supported by granularity research. |
| Word-level habits is the strongest lexical candidate | High | Surprise factor drives engagement with the loop. Concrete evidence, clear curation. Supported by granularity research and existing tool analysis. |
| Sentence structure adds value as a third dimension | Medium | Overlaps with rhythm. Justified by showing depth within a category, but could be deferred without weakening the MVP. |
| Tonal markers should be deferred | Medium | The observation/evaluation boundary is real but may be solvable with careful prompting. Deferred based on risk, not impossibility. |
| Two dimensions are sufficient to prove the concept | High | The core loop (write, observe, curate, apply) is testable with even one dimension. Two proves multi-dimensionality. |
| Three is better than two for MVP | Medium | The marginal value of the third dimension is demonstrating depth, not proving a new capability. Depends on how much implementation cost it adds. |

## Open Threads

- The two-vs-three question is a scope decision, not a research question. If sentence structure shares enough parsing infrastructure with sentence rhythm, the marginal cost is low and it's worth including. If it requires a separate analysis pass (POS tagging), it may not be worth the MVP investment.
- The LLM-native vs. pre-computed metrics question affects testability. Pre-computed metrics make it possible to write deterministic tests for the observation pipeline ("given these sentence lengths, the Observer should notice the rhythm shift"). LLM-native observation is simpler but harder to verify without running the LLM.
- The profile rule format ("how does a curated observation become a voice characteristic?") is downstream of this research but will need its own convention before the Apply phase works.
