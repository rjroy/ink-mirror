---
title: "Plan: Observer Prompt Quality Fixes"
date: 2026-03-27
status: draft
tags: [plan, observer, prompt, metrics, quality]
modules: [daemon, shared]
related:
  - .lore/specs/v1-core-loop.md
  - .lore/plans/v1-core-loop.md
  - .lore/reviews/phase-2a-metrics.md
---

# Plan: Observer Prompt Quality Fixes

## Spec Reference

**Spec**: `.lore/specs/v1-core-loop.md`

Requirements addressed:
- REQ-V1-5: Each observation names a specific pattern, cites evidence, categorizes by dimension. -> Steps 2, 3
- REQ-V1-7: Evidence comes as cited text, not just statistics. -> Steps 2, 3
- REQ-V1-9: Comparisons against the writer's own baseline, never external norms. -> Step 2
- REQ-V1-13: Observer assembles context in tiers, activated as data accumulates. -> Step 2
- REQ-V1-15: Prompt layout follows U-shaped attention curve. -> Step 2

## Codebase Context

The Observer prompt lives in two functions in `packages/daemon/src/observer.ts`:
- `buildSystemPrompt()` (lines 105-146): role definition, constraints, observation rules, dimensions, output format.
- `buildUserMessage()` (lines 148-176): assembles style profile, metrics, recent entries, and current entry in attention-aware order.

Token frequency computation is in `packages/daemon/src/metrics/word-frequency.ts`. The `analyzeWordFrequency()` function (line 141) returns unfiltered `tokenFrequencies`. The `filterBySet()` helper (lines 59-70) already exists for hedging words and intensifiers. Adding stop word filtering follows the established pattern.

Evidence validation is `validateObservations()` at `observer.ts:286-317`. Case-insensitive substring match.

Tests: `packages/daemon/tests/metrics/word-frequency.test.ts` for metrics, `packages/daemon/tests/observer.test.ts` for prompt construction and validation.

Prior review finding: Phase 2A review F5 flagged stop words in `tokenFrequencies`, deferred to Phase 2B. Never addressed. Phase 2B was never independently reviewed.

## Implementation Steps

### Step 1: Filter stop words from token frequencies

**Files**: `packages/daemon/src/metrics/word-frequency.ts`, `packages/daemon/tests/metrics/word-frequency.test.ts`
**Addresses**: REQ-V1-7 (evidence over statistics; noisy statistics undermine the metrics the LLM interprets)

Add a `STOP_WORDS` set to `word-frequency.ts` following the existing pattern for `HEDGING_WORDS` and `INTENSIFIERS`. Common English function words: articles, prepositions, pronouns, auxiliaries, conjunctions. 40-60 words is sufficient; this isn't NLP research, it's noise reduction.

Filter `tokenFrequencies` before returning from `analyzeWordFrequency()`. The `totalTokens` count should remain unfiltered since it describes the entry's overall volume. `uniqueTokens` should reflect the filtered map (content tokens only), since it appears in the prompt alongside the filtered frequencies and should match what the LLM sees. Capture `totalTokens` from the unfiltered token list, then filter, then compute `uniqueTokens` from the filtered map.

Update existing tests. The test at line 5-9 (`"the cat sat on the mat"`) will change behavior: "the" and "on" would be filtered from `tokenFrequencies`, and `uniqueTokens` will drop from 5 to 3 (cat, sat, mat). Add a test that verifies stop words are excluded from `tokenFrequencies` but included in `totalTokens`.

**Note on schema**: `WordFrequencyAnalysisSchema` in `packages/shared/src/metrics.ts` defines `tokenFrequencies` as `z.record(z.string(), z.number().int().positive())`. No schema change needed. The field still holds token frequencies; it just holds fewer of them. Document the filtering in a code comment at the definition site so consumers know the field is filtered.

### Step 2: Rewrite system prompt for Tier 1+2 awareness

**Files**: `packages/daemon/src/observer.ts` (function `buildSystemPrompt`)
**Addresses**: REQ-V1-9, REQ-V1-13, REQ-V1-15

The current system prompt was written for Tier 1 (entry only). It doesn't mention the style profile, pre-computed metrics, or recent entries. The LLM receives these in the user message with no guidance on what they are or how to use them. Four changes, all within `buildSystemPrompt()`:

**a) Add a "Context You Receive" section** after the observation rules and before the output format. Describe the four possible sections of the user message:
- Pre-computed metrics: sentence rhythm stats, word frequencies, structural analysis. Use as supporting data. Do not recompute counts that contradict these.
- Style profile (when present): the writer's confirmed patterns from prior entries. Compare the current entry against this baseline. Note drift or consistency.
- Recent entries (when present, Tier 2): the writer's last 5 entries for local baseline. Look for patterns emerging or fading across entries. All comparisons stay within the writer's own work.
- Current entry: the text to observe. Always present, always last.

**b) Fix the output format example.** Replace the pseudo-JSON `"dimension": "sentence-rhythm" or "word-level-habits" or "sentence-structure"` with three separate example observations, one per dimension. This also serves as a worked example of what good observations look like, which improves output quality more than abstract rules.

**c) Add evidence citation emphasis.** In observation rule 3, add: "Copy the text exactly as it appears in the entry, character for character. Even minor changes (adding words, trimming punctuation, paraphrasing) will cause the observation to be rejected by validation."

**d) Add dimension diversity nudge.** After rule 1 ("Surface 2-3 observations"), add: "When possible, select observations from different dimensions. Three observations about sentence rhythm is less useful than one each from rhythm, word habits, and structure."

**Token budget check**: The current system prompt is roughly 350 tokens. These additions should land around 550-650 tokens. Well within the Tier 1 budget of 2,300-3,700 total.

### Step 3: Update observer tests

**Files**: `packages/daemon/tests/observer.test.ts`
**Addresses**: REQ-V1-5, REQ-V1-7

Update `buildSystemPrompt()` tests to verify the new sections exist (context description, fixed output format, evidence emphasis). These are string-contains checks, not exact match, since the prompt will evolve.

Add a test for `buildUserMessage()` that verifies Tier 2 assembly: when recent entries and style profile are both provided, the user message contains all four sections in the correct order (recent entries, style profile, metrics, current entry). No Tier 2 assembly test exists today; existing tests at `observer.test.ts` lines 95-157 cover only the Tier 1 path (with and without profile).

Verify the evidence validation still works correctly. The validation logic itself doesn't change, but the prompt changes should reduce the number of observations that fail validation. This can't be unit tested (it requires LLM output), but document the expectation.

### Step 4: Validate against spec

Launch a sub-agent that reads the spec at `.lore/specs/v1-core-loop.md`, reviews the implementation changes, and flags any requirements not met. This step is not optional.

Additionally, this is the right moment to complete the acceptance check that was never run: exercise the Observer against a few hand-written test entries and verify each observation passes the curation test (citable evidence, classifiable pattern, no external comparisons). This was required by the v1 plan but skipped when Phase 2B review failed.

## Delegation Guide

- **Steps 1-3**: Standard implementation. No specialized expertise needed beyond familiarity with the codebase patterns.
- **Step 4**: Fresh-context review agent. The reviewer should not have participated in implementation, to catch assumptions the implementer carries.

## Open Questions

- **Stop word list scope**: A curated 40-60 word list covers common English function words. Should contractions be included ("don't", "isn't", "we're")? The tokenizer strips apostrophes via the regex `[^\w\s'-]` but preserves them within words. Contractions would survive tokenization and could appear in the top-10. Recommend: include contracted forms of auxiliaries and pronouns in the stop list.
- **Prompt iteration after deployment**: The system prompt changes in Step 2 are based on prompt engineering principles, not empirical testing against the actual LLM. The v1 plan budgeted 2-3 prompt revision cycles. This plan's Step 4 acceptance check may surface the need for a second pass. That's expected, not a failure.
