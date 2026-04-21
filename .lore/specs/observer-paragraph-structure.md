---
title: "Observer Dimension: paragraph-structure"
date: 2026-04-21
status: resolved
tags: [spec, observer, observation-dimension, paragraph-structure]
req-prefix: OPS
related:
  - .lore/brainstorm/observer-dimension-extension-20260420.md
  - .lore/specs/v1-core-loop.md
  - .lore/research/observation-granularity.md
  - .lore/research/minimum-viable-observation.md
  - .lore/vision.md
---

# Spec: Observer Dimension — paragraph-structure

## 1. Frame

Add a fourth Observer dimension, `paragraph-structure`, covering paragraph-level patterns that are currently either invisible to the Observer or smeared into `sentence-structure`. The new dimension promotes one of the research-backed categories from `minimum-viable-observation.md` (deferred from v1 on entry-length grounds, not on principle) and exercises the expansion path recommended in Section 6 of the brainstorm (`.lore/brainstorm/observer-dimension-extension-20260420.md:196-216`).

The hypothesis this spec validates is the user's framing: adding a dimension is *primarily a prompt update*, with predictable touches to the zod enum, the label maps, opposing-signals regexes, and the sentence-structure analyzer. If the expansion feels smooth, that confirms the shape. If it feels bumpy, the friction points at the label-map duplication that wants its own refactor (tracked separately as an issue). Either way, the cap stays at 2-3 and selection-pressure policy is explicitly out of scope.

## 2. Scope

**In scope:**

- A new `paragraph-structure` value in `ObservationDimensionSchema`.
- System-prompt changes in `packages/daemon/src/observer.ts`: adding the dimension to the dimension list in rule 5, adding its definition paragraph, adding a "not this" clause distinguishing it from `sentence-structure`, and adding one worked example entry to the output-format JSON so the Observer sees the dimension used non-evaluatively.
- Label-map updates at the three sites named in the brainstorm: daemon `DIMENSION_LABELS` (`packages/daemon/src/profile-store.ts`) and both inline `labels` records in the CLI (`packages/cli/src/profile.ts`).
- New `OPPOSING_SIGNALS` pairs in `packages/daemon/src/curation.ts` so contradiction detection (REQ-V1-19) covers the new dimension.
- Extending `analyzeSentenceStructure` in `packages/daemon/src/metrics/sentence-structure.ts` to surface paragraph-length distribution and single-sentence-paragraph counts. Existing voice, fragment, and paragraph-opener signals must stay intact.
- Extending `SentenceStructureAnalysisSchema` in `packages/shared/src/metrics.ts` with the new numeric fields.
- Surfacing the new fields in the `formatMetrics` function inside `observer.ts` so the Observer sees them.
- Tests: observer unit coverage for the new dimension, a curation integration test for contradiction detection on `paragraph-structure`, analyzer tests for the new signals, and schema/snapshot coverage where those already exist.

**Out of scope (do not touch):**

- `vocabulary-register` or `tonal-markers` additions. Those are deferred per the brainstorm's Section 6.
- Changes to the 2-3 observation cap in `ObserverOutputSchema`. Selection-pressure policy for N ≥ 5 is a separate decision, tracked as its own issue.
- Consolidating the duplicated label maps into `@ink-mirror/shared`. That refactor is filed as its own issue; this spec updates all three call sites in place without moving them.
- Re-reviewing the vision. The `review_trigger` in `.lore/vision.md` has fired, but the re-review runs separately.
- Any change to the Observer's non-evaluation rail worked examples beyond adding the single `paragraph-structure` entry in the output-format JSON.

## 3. Observation Definition

The `paragraph-structure` dimension observes paragraph-level patterns *within the entry*. It covers:

- **Paragraph-length distribution.** The ratio of short to medium to long paragraphs, and whether the entry favors uniform blocks or mixed lengths.
- **Opening-vs-closing asymmetry.** Whether the first and last paragraphs differ in length or sentence count from the body (e.g., a long lead paragraph followed by shorter body paragraphs, or a single-sentence closing after longer preceding paragraphs).
- **Topic-sentence patterns.** Whether the first sentence of a paragraph announces what the paragraph is about, or whether paragraphs open with detail before arriving at their subject. This is a structural observation ("paragraphs lead with their topic") not an evaluative one ("topic sentences are missing").
- **Transition-vs-juxtaposition habits.** Whether paragraphs connect with explicit transitions ("But…", "However…", "Later…") or are set next to each other without a bridge, letting juxtaposition do the work.
- **Single-sentence-paragraph use for emphasis.** When a paragraph is one sentence, what role that isolation plays across the entry (e.g., three single-sentence paragraphs appearing at paragraph boundaries for emphasis).

### Not this: boundary against `sentence-structure`

`sentence-structure` observes **sentence-level** patterns inside the entry: active/passive voice, fragments, paragraph-opener word classes (e.g., "most paragraphs start with 'I'"). `paragraph-structure` observes **paragraph-level** patterns: how paragraphs are shaped, how they end, how they relate to one another, and when single-sentence paragraphs appear.

Rule of thumb:

- If the unit of observation is a sentence (even if that sentence is at a paragraph boundary), the observation is `sentence-structure`.
- If the unit of observation is a paragraph (length, position, role, isolation, transition between), the observation is `paragraph-structure`.

Paragraph-opener *word classes* (e.g., "I + verb," "temporal marker") continue to live in `sentence-structure` because the unit is the opening sentence. Paragraph-opener *topic-sentence behavior* (does the first sentence announce the paragraph's subject?) lives in `paragraph-structure` because the unit is the paragraph's shape.

### Graceful silence on short entries

The Observer must produce zero `paragraph-structure` observations when the entry does not support them. Concretely: an entry with fewer than 3 paragraphs cannot carry a distribution, an asymmetry, or a transition pattern. The Observer is free to select this dimension anyway if a single-sentence-paragraph emphasis pattern is genuinely present, but must not manufacture an observation on a 1-2 paragraph entry to satisfy coverage. This matches the granularity research's "fires when the data supports it" principle.

## 4. Touch Points

Every file that must change, with exact paths and approximate sizes. Sizes are guidance, not limits.

| File | Change | Approx. size |
|------|--------|--------------|
| `packages/shared/src/observations.ts` | Add `"paragraph-structure"` to `ObservationDimensionSchema` enum (line 5-9). | 1 line |
| `packages/shared/src/metrics.ts` | Extend `SentenceStructureAnalysisSchema` (line 53-73) with the new paragraph-distribution and single-sentence-paragraph fields defined in Section 5. Existing fields remain. | 8-14 lines |
| `packages/daemon/src/observer.ts` | (a) Rule 5 dimension list (line 122): add `"paragraph-structure"` to the enumerated list. (b) Dimensions block (lines 125-131): add a definition paragraph for `paragraph-structure` plus a "not this" clause for both `sentence-structure` and `paragraph-structure` that draws the sentence-level vs. paragraph-level boundary. (c) Output-format JSON example (lines 146-163): add one observation entry with `"dimension": "paragraph-structure"` showing non-evaluative phrasing. (d) `formatMetrics` (lines 244-253): render the new paragraph-distribution and single-sentence-paragraph fields alongside the existing structure summary. | 20-40 lines |
| `packages/daemon/src/profile-store.ts` | Add `"paragraph-structure": "Paragraph Structure"` to `DIMENSION_LABELS` (line 45-49). | 1 line |
| `packages/cli/src/profile.ts` | Add `"paragraph-structure": "Paragraph Structure"` to the inline `labels` record inside `showProfile` (line 40-44) **and** to the inline `labels` record inside `buildProfileMarkdown` (line 147-151). Both sites must be updated; the CLI does not share these with the daemon. | 2 lines (one per site) |
| `packages/daemon/src/curation.ts` | Add 2-3 opposing-signal regex pairs to `OPPOSING_SIGNALS` (line 15-26) covering paragraph-length polarity and transition-vs-juxtaposition polarity. See Section 5 for the exact pairs. | 2-3 lines |
| `packages/daemon/src/metrics/sentence-structure.ts` | Extend `analyzeSentenceStructure` (line 276-338) to compute the new signals. Preserve every existing field. The function already calls `splitParagraphs` (line 263-268) and iterates paragraphs; the new computation is incremental over that loop. | 30-60 lines |

No new files. No new modules. No changes to `EntryMetricsSchema` beyond what extending `SentenceStructureAnalysisSchema` implies.

## 5. Metrics Additions

The sentence-structure analyzer produces the following new numeric signals, all within the existing `SentenceStructureAnalysis` shape. These are the only new metrics; do not invent others.

- `paragraphLengths` — Array of sentence counts per paragraph, in document order. Length equals `paragraphCount`.
- `paragraphLengthDistribution` — Buckets of paragraph counts:
  - `short`: paragraphs with 1-2 sentences
  - `medium`: paragraphs with 3-5 sentences
  - `long`: paragraphs with 6 or more sentences
  
  Expressed as `{ short: number, medium: number, long: number }`. Short/medium/long thresholds are embedded constants in the analyzer.
- `singleSentenceParagraphCount` — Count of paragraphs whose sentence count is exactly 1. A subset of `short`, surfaced separately because single-sentence paragraphs are the clearest emphasis signal and the Observer benefits from seeing them as a distinct count.

All three fields must be added to `SentenceStructureAnalysisSchema` in `packages/shared/src/metrics.ts` with non-negative integer validators (array of integers for `paragraphLengths`, object of integers for `paragraphLengthDistribution`, integer for `singleSentenceParagraphCount`).

### Opposing-signal pairs

Add 2-3 regex pairs to `OPPOSING_SIGNALS` in `packages/daemon/src/curation.ts`. Suggested (implementer may adjust wording but must preserve the intent):

- `/\bshort\s+paragraphs?\b/i` vs `/\blong\s+paragraphs?\b/i`
- `/\buniform\b/i` vs `/\bvaried\b/i` *(paragraph-length uniformity vs. variety)*
- `/\btransitions?\b/i` vs `/\bjuxtaposition\b|\babrupt\b/i`

These fire only when both pattern descriptions are in the same dimension (existing `detectContradiction` logic at `packages/daemon/src/curation.ts:32-51` already enforces dimension match). The pairs are chosen so they do not overlap with the existing `short`/`long` pair (line 16), which triggers on sentence-rhythm patterns. Because contradiction detection already scopes by dimension, this is safe.

## 6. Tests

All tests are required. None can be deferred.

### 6.1 Analyzer unit tests (`packages/daemon/tests/metrics/sentence-structure.test.ts`)

Extend the existing file. Do not create a new one.

- A 6-paragraph fixture with mixed lengths (e.g., `[1, 4, 3, 1, 7, 2]`) asserts:
  - `paragraphLengths` equals `[1, 4, 3, 1, 7, 2]` in document order.
  - `paragraphLengthDistribution` equals `{ short: 3, medium: 2, long: 1 }`.
  - `singleSentenceParagraphCount` equals `2`.
- A single-paragraph fixture asserts `paragraphLengths` has one entry, distribution bucketed correctly, and `singleSentenceParagraphCount` matches.
- An empty input (empty string / zero sentences) asserts all three new fields take their empty defaults (`[]`, `{ short: 0, medium: 0, long: 0 }`, `0`) and that existing fields still produce their empty defaults.
- At least one existing assertion (passive ratio, paragraph openers, fragment count) is retained unchanged on a fixture that also exercises the new fields, proving the new computation does not mutate existing output.

### 6.2 Observer unit tests (`packages/daemon/tests/observer.test.ts`)

Extend the existing file. Do not create a new one.

- A fixture where the mocked session runner returns JSON with a `"paragraph-structure"` observation passes validation and storage. The cited evidence must be present in the entry text (existing validator requirement at `packages/daemon/src/observer.ts:324`).
- A fixture where the session runner returns `"paragraph-structure"` with evidence not in the entry fails validation exactly like the other dimensions (same error path at `packages/daemon/src/observer.ts:325`).
- The built system prompt (`buildSystemPrompt`) contains the `paragraph-structure` dimension name in the dimension list, in the definition block, and in the output-format example.
- The built user message (`buildUserMessage`) contains rendered `paragraphLengthDistribution` and `singleSentenceParagraphCount` values on an entry where those fields are non-trivial.

### 6.3 Curation integration test (`packages/daemon/tests/curation.test.ts` or `curation-integration.test.ts`)

Extend whichever file currently covers `detectContradiction`; do not create a new one.

- Two observations in the `paragraph-structure` dimension with opposing pattern text (e.g., "Uses short paragraphs throughout" vs. "Uses long paragraphs throughout") trigger `detectContradiction` → `true`.
- The same two patterns across different dimensions (one in `paragraph-structure`, one in `sentence-rhythm`) do **not** trigger contradiction. This protects against the overlap with the existing `short`/`long` pair.
- At least one existing contradiction test case is retained unchanged to prove no regression on existing dimensions.

### 6.4 Schema / type coverage

- Zod schema parsing tests (wherever `ObservationDimensionSchema` is exercised, e.g., `observation-routes.test.ts` or shared-package tests) include at least one case that parses `"paragraph-structure"` successfully.
- `SentenceStructureAnalysisSchema` parses an object containing the three new fields successfully and rejects inputs where they are missing or wrong-typed.

### 6.5 Profile rendering (light coverage acceptable)

If `profile-store.test.ts` currently asserts dimension label rendering for all dimensions, extend it. If it only asserts a sample, add one case that confirms `"paragraph-structure"` renders as `"Paragraph Structure"`. No new test file needed.

## 7. Acceptance Criteria

Numbered and testable. Each criterion maps to at least one test from Section 6 or to manual spot-check.

1. **Schema accepts the new dimension.** `ObservationDimensionSchema.parse("paragraph-structure")` succeeds. Parsing any of the four live dimensions (`sentence-rhythm`, `word-level-habits`, `sentence-structure`, `paragraph-structure`) succeeds. Parsing any other string fails.

2. **Analyzer produces the new fields on mixed-length entries.** For a 6-paragraph entry with paragraph sentence-counts `[1, 4, 3, 1, 7, 2]`, `analyzeSentenceStructure` returns `paragraphLengths = [1, 4, 3, 1, 7, 2]`, `paragraphLengthDistribution = { short: 3, medium: 2, long: 1 }`, and `singleSentenceParagraphCount = 2`.

3. **Analyzer preserves existing fields.** On the same fixture, `activeCount`, `passiveCount`, `passiveRatio`, `paragraphOpeners`, `paragraphCount`, `fragmentCount`, and `totalSentences` match their values produced by the current analyzer for an equivalent fixture. (Regression guard for REQ-V1-10's structural dimension.)

4. **Observer prompt contains the new dimension.** `buildSystemPrompt()` output contains all three of: the string `"paragraph-structure"` in the rule-5 enumerated list, a definition paragraph for `paragraph-structure`, and a worked example with `"dimension": "paragraph-structure"` in the output-format JSON.

5. **Observer prompt contains the not-this boundary.** The dimension definitions block explicitly contrasts `paragraph-structure` against `sentence-structure`, naming that sentence-level patterns stay in `sentence-structure` and paragraph-level patterns go to `paragraph-structure`.

6. **Observer accepts valid paragraph-structure observations.** Given a 6-paragraph entry with varied paragraph lengths, if the mocked session runner returns an observation with `"dimension": "paragraph-structure"` and evidence that is a verbatim substring of the entry, the Observer stores that observation and produces no validation error for it.

7. **Observer rejects invalid evidence in the new dimension, consistent with existing dimensions.** Given the same entry, if the mocked runner returns a `"paragraph-structure"` observation whose evidence is not in the entry text, validation rejects it and records an error, matching the behavior for the other three dimensions.

8. **Label maps render the new dimension consistently.** Daemon profile markdown (`profile-store.ts`), CLI `showProfile`, and CLI `buildProfileMarkdown` all render a `paragraph-structure` rule under the heading `"Paragraph Structure"` (no raw-key fallback).

9. **Contradiction detection covers the new dimension.** `detectContradiction` returns `true` for two `paragraph-structure` observations with opposing signals from the new regex pairs, and `false` when the same opposing signals appear across different dimensions.

10. **No regression on existing dimensions.** Every existing observer, analyzer, profile, and curation test passes unchanged. Any test assertion that enumerates dimensions is updated to include `paragraph-structure`; none are weakened.

11. **Cap unchanged.** `ObserverOutputSchema.max(3)` remains `3`. No code change to `packages/shared/src/observations.ts:52`.

## 8. Non-Acceptance

This spec does NOT deliver:

- Any label-map consolidation into `@ink-mirror/shared`. The duplicated mapping is intentionally updated in all three sites. The consolidation refactor is filed as `.lore/issues/observer-label-map-consolidation.md`.
- Any observation-cap change. The cap stays at 2-3 (`ObserverOutputSchema` at `packages/shared/src/observations.ts:49-54`).
- Any selection-pressure mechanism (rotation, state tracking, expanded cap). Filed as `.lore/issues/observer-selection-pressure-policy.md`, not actionable until the dimension set reaches 5.
- Any `vocabulary-register` or `tonal-markers` prompt content, schema value, or metrics.
- Any vision re-review. Filed as `.lore/issues/vision-re-review-overdue.md`.
- Any observation-quality evaluation infrastructure (golden corpus, automated scoring). Filed as `.lore/issues/observation-evaluation-methodology.md`.
- Any change to Tier 2 activation rules (REQ-V1-13) or the prompt layout (REQ-V1-15).

## 9. Open Questions

Tight list. The brainstorm settled most decisions; these are the remaining ones that affect the implementer.

- **Worked-example phrasing for `paragraph-structure`.** The spec requires one output-format example entry. Implementer drafts the phrasing; the non-evaluation rail is not at its thinnest here (paragraph patterns are descriptive), so a short example is sufficient. If during review the example reads as evaluative ("well-balanced paragraphs"), revise toward descriptive ("alternates short and long paragraphs in the first half").

- **Paragraph-length bucket thresholds.** Spec names 1-2 as short, 3-5 as medium, 6+ as long. If fixture data on real entries shows the medium bucket swallowing everything, the implementer may adjust, but must update the analyzer test fixtures and this spec in the same PR rather than leaving the spec out of sync.

No other open questions. If the implementer hits one, state the interpretation, proceed, and surface it in the plan-review step rather than pausing the commission.
