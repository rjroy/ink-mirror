---
title: "Brainstorm: Extending the Observer's Dimension Set"
status: draft
date: 2026-04-20
author: Celeste
related:
  - .lore/vision.md
  - .lore/specs/v1-core-loop.md
  - .lore/research/observation-granularity.md
  - .lore/research/minimum-viable-observation.md
  - .lore/retros/commission-cleanup-20260328.md
  - .lore/retros/commission-cleanup-20260418.md
tags: [observer, brainstorm, observation-model]
---

# Extending the Observer's Dimension Set

## Frame

**Commission question:** ink-mirror's Observer currently selects from three fixed dimensions. What should extending the set look like, and is the user's hypothesis "just a prompt update" correct?

**Vision status:** `active` (reviewed 2026-03-26). The `review_trigger` is "After first working prototype delivers the write-observe-curate loop." Per project memory, v1 core loop + Craft Nudge shipped end-to-end on 2026-04-18, so the trigger has fired, but the vision has not been re-reviewed. Flagging, not blocking.

**Context scanned:**
- Vision principles and "What It Is Not" (`vision.md`)
- Requirements REQ-V1-5 through REQ-V1-10 and stub `[STUB: observation-expansion]` (`specs/v1-core-loop.md:115`)
- Granularity research and MVP-filter research (six categories proposed, three kept)
- Observer implementation: system prompt (`packages/daemon/src/observer.ts:105-165`), zod enum (`packages/shared/src/observations.ts:5-9`), metrics schema (`packages/shared/src/metrics.ts:79-86`), metrics modules (`packages/daemon/src/metrics/`)
- Profile rendering: `profile-store.ts:45-49` and duplicated label map at `packages/cli/src/profile.ts:41-43,148-150`
- Contradiction detection: `OPPOSING_SIGNALS` at `packages/daemon/src/curation.ts:15-26`
- UI: `packages/web/app/entries/[id]/page.tsx:60` renders `obs.dimension` as a raw string, so it is dimension-agnostic
- Recent retros (none touching dimension extension directly; the Observer Prompt Quality chain resolved stop-word filtering and a prompt rewrite)

**Recent brainstorms check:** `.lore/brainstorm/` does not yet exist. No prior proposals to deduplicate against.

---

## 1. Inventory

### Live today (three)

From `packages/shared/src/observations.ts:5-9` and `packages/daemon/src/observer.ts:126-131`:

| Dimension | Category | Pre-computed metrics? |
|-----------|----------|-----------------------|
| `sentence-rhythm` | Structural | Yes, via `rhythm.ts` (length sequence, variance, consecutive short/long, pace changes) |
| `word-level-habits` | Lexical | Yes, via `word-frequency.ts` (token frequencies with stop-word filter, hedging words/phrases, intensifiers, repeated phrases) |
| `sentence-structure` | Structural (secondary) | Yes, via `sentence-structure.ts` (active/passive, paragraph openers, fragments) |

### Considered but cut (from `minimum-viable-observation.md`)

| Dimension | Cut reason | Still valid? |
|-----------|-----------|--------------|
| **Vocabulary register** (formal/casual mix) | Requires judgment calls about what counts as "formal"; evaluative framing risk. Needs curation history to establish a register baseline. | Reason still holds cold-start. Now that a style profile exists, the "baseline" argument weakens. |
| **Paragraph / structural** (length distribution, topic sentence patterns, transitions) | Many journal entries are short; needs longer entries to produce meaningful patterns. Better fit for "Entry 6-20" adaptive stage. | Reason still holds for short entries. Fires cleanly on long entries. Length-conditional activation is available. |
| **Tonal markers** (directness, hedging intensity, emotional range) | Observation/evaluation boundary thinnest here. Prompt engineering challenge that shouldn't be the first thing validated. | Reason weakens now that the prompt rewrite (Observer Prompt Quality chain, 2026-03-28) has shipped with worked examples and evidence emphasis. The no-evaluation rail is better established. |

### What the architecture encodes

The three current dimensions are hard-coded in five places:

1. Zod enum (`packages/shared/src/observations.ts:5-9`)
2. System prompt dimension list (`observer.ts:122`)
3. System prompt dimension definitions block (`observer.ts:126-131`)
4. `DIMENSION_LABELS` in daemon profile renderer (`profile-store.ts:45-49`)
5. `DIMENSION_LABELS` duplicated in CLI (`packages/cli/src/profile.ts:41-43,148-150`)

Optional touch points: `OPPOSING_SIGNALS` for contradiction detection (`curation.ts:15-26`) and the `EntryMetrics` schema plus `metrics/` modules for pre-computed analysis. Neither blocks adding a dimension; both degrade that dimension's quality if skipped.

---

## 2. Candidates to Add (ranked)

Each proposal names the dimension, the evidence trail, the rationale, vision alignment, and scope.

### Proposal A. Punctuation habits (**recommended first expansion**)

**Evidence.** Not in the original six-category research. Surfaced by the working profile of ink-mirror itself: the user's global writing rules explicitly ban em-dashes (`rules/writing-style-rules.md`), meaning punctuation *is* voice. The current word-level-habits dimension filters punctuation out during tokenization (`word-frequency.ts:92`, `replace(/[^\w\s'-]/g, "")`), so punctuation patterns are invisible to the Observer today.

**Proposal.** Add `punctuation-habits` as a lexical-adjacent dimension. Measurable signals: em-dash, semicolon, and colon density per 100 words; ellipsis use; parenthetical density; exclamation-to-period ratio; question-mark clustering; Oxford comma consistency.

**Rationale.** Punctuation is one of the strongest writer fingerprints and one of the most invisible to the writer. The surprise factor matches word-level-habits (writers don't notice their own tics). Deterministic to measure. Pattern-level curation is clean ("you used parentheticals in 6 of 10 sentences, voice or crutch?").

**Vision alignment.**
- *Anti-goal check.* Not grammar correction, not editing, not style prescription. "Used 9 em-dashes, often mid-clause" is observational. ✓
- *Principle alignment.* Feedback Accelerates Skill (surprises the writer with a pattern they don't see); Frictionless (one more surface, same 2-3 cap). ✓
- *Tension resolution.* No tension with "What It Is Not."
- *Constraint check.* No external comparison; patterns are within-entry or against the writer's profile. ✓

**Scope.** **Small.** Prompt update, plus one zod enum line, plus two label-map entries. Optional deterministic metrics block (~40 lines in a new `metrics/punctuation.ts`, mirrors existing modules).

---

### Proposal B. Tonal markers (stance and directness)

**Evidence.** Deferred by `minimum-viable-observation.md:93-95` explicitly on prompt-engineering risk, not principle. The Observer Prompt Quality chain (retro `commission-cleanup-20260328.md:22`) tightened the evidence and non-evaluation rail. The risk that justified deferral has partially resolved.

**Proposal.** Add `tonal-markers` covering stance patterns: hedging *intensity* (not just presence, which word-level-habits already covers), direct-assertion density, rhetorical question use, conditional framing ("if…then," "when…then"), absolute language ("always," "never," "everyone"), and second-guessing patterns ("or maybe," "but actually," "I don't know, ").

**Rationale.** This is the dimension most likely to produce observations the writer didn't realize were patterns. It maps to Biber's *Overt Expression of Persuasion* dimension (see granularity research) but at a grain a journal writer can curate. The distinction from word-level-habits: that dimension names which words recur; tonal markers name what stance those words signal.

**Vision alignment.**
- *Anti-goal check.* Highest risk of crossing into evaluation ("you sound uncertain"). The guardrail: every tonal observation must cite evidence and name the *pattern*, not the *effect on reader*. "You qualified five of seven assertions with 'I think' or 'maybe'" is observation; "your writing sounds tentative" is evaluation. ✓ *if* the prompt enforces this.
- *Principle alignment.* Feedback Accelerates Skill (stance is the hardest thing to self-observe). ✓
- *Tension resolution.* The vision's "observations, not evaluations" line is load-bearing here. Requires a worked example in the prompt that demonstrates the non-evaluative framing explicitly.
- *Constraint check.* No external comparison. ✓

**Scope.** **Medium.** Prompt update, zod enum, label maps, plus a tonal-markers worked example in the system prompt (the non-evaluation rail is fragile without one). Metrics optional: stance detection is judgment-heavy and better done LLM-native per `minimum-viable-observation.md:124` (LLM-native is a valid choice when parsing is subjective).

---

### Proposal C. Paragraph / discourse structure

**Evidence.** Deferred by `minimum-viable-observation.md:92` for entry-length reasons. The current metrics already compute `paragraphCount` (`sentence-structure.ts`, surfaced in the prompt at `observer.ts:249`), but no dimension claims paragraph patterns as primary territory. They bleed into `sentence-structure`.

**Proposal.** Add `paragraph-structure` for: paragraph-length distribution; opening-vs-closing paragraph asymmetry; topic-sentence patterns (does the first sentence announce the topic?); transition-vs-juxtaposition habits (explicit connectives vs. abrupt shifts); single-sentence-paragraph use for emphasis.

**Rationale.** Promotes a real category from the research that's currently smeared across `sentence-structure`. Separating it makes both dimensions cleaner. Fires meaningfully on entries with 4+ paragraphs; below that, gracefully produces nothing.

**Vision alignment.**
- *Anti-goal check.* Pattern observation, not structural advice. ✓
- *Principle alignment.* Feedback Accelerates Skill; frictionless (no observation when the entry is too short to support one). ✓
- *Tension resolution.* Risks overlap with `sentence-structure`. The line is: sentence-level patterns stay there, paragraph-level patterns move here.
- *Constraint check.* ✓

**Scope.** **Small-to-Medium.** Prompt update, zod enum, label maps. Paragraph data already exists in `EntryMetrics.sentenceStructure.paragraphCount` and `paragraphOpeners`; deeper signals (single-sentence paragraphs, length distribution) are ~30 lines of additions to the existing structure analyzer. Not a new module.

---

### Proposal D. Vocabulary register (formal / casual mixing)

**Evidence.** Deferred by `minimum-viable-observation.md:91` on cold-start judgment risk. Granularity research ranked it medium on both viability criteria.

**Proposal.** Add `vocabulary-register` for formal/casual code-switching within an entry, jargon clustering, concrete-vs-abstract noun density, latinate-vs-germanic word-root tendencies.

**Rationale.** Real dimension, real signal, but specifically a *later* dimension because it becomes interesting only after a register baseline exists. The question a writer can curate is "did I mean to shift register in paragraph 3?", which requires establishing what their usual register is.

**Vision alignment.**
- *Anti-goal check.* Risk of "formal" reading as "better" in the writer's ear. Prompt must avoid evaluative phrasing ("formal" and "casual" are both fine).
- *Principle alignment.* Feedback Accelerates Skill, but weaker for cold-start.
- *Tension resolution.* Partially resolved by the style profile now existing; partially still open.

**Scope.** **Medium.** Prompt update, zod enum, label maps. Pre-computed metrics would need a register-indicator lexicon (~200 words). Or LLM-native, accepting judgment variance. Either way, a worked example is mandatory for the register-isn't-quality rail.

---

### Proposal E. Discourse connectives (transition patterns)

**Evidence.** Not in the original six categories. Surfaces from re-reading the granularity table: most transition signals currently get absorbed into word-level-habits (e.g., "so," "but," "however" would appear in `tokenFrequencies`), but they carry a different semantic weight than filler words.

**Proposal.** Add `discourse-connectives` for how the writer moves between ideas: conjunctive adverbs ("however," "therefore," "meanwhile"); coordinating-conjunction-at-sentence-start habits ("And then," "But honestly"); sequence markers ("first," "then," "finally"); concession patterns ("although," "even if"); causal chains ("because," "so," "which meant").

**Rationale.** Narrower than register, less risky than tonal markers, but overlaps noticeably with word-level-habits. Best case: it surfaces a genuinely distinct shape of voice (how ideas *link*). Worst case: the LLM puts observations here that would have fit word-level-habits, and the dimensions compete.

**Vision alignment.**
- *Anti-goal check.* Pure pattern observation. ✓
- *Principle alignment.* ✓
- *Tension resolution.* Overlap risk with word-level-habits is the main friction; the dimensions need crisp boundaries in the prompt.
- *Constraint check.* ✓

**Scope.** **Small.** Prompt update, zod enum, label maps. Existing tokenization covers detection; no new metric module required.

---

## 3. Selection Pressure

Current mechanism: `ObserverOutputSchema` caps observations at 2-3 (`observations.ts:49-54`). The system prompt tells the LLM to prefer different dimensions across the 2-3 slots (`observer.ts:118`).

With N=3 dimensions and a cap of 2-3, the natural behavior is near-total coverage each entry. Every dimension usually gets an observation. With N=5 or N=6, the math breaks: 2-3 observations cannot cover 5-6 dimensions, so per-entry selection becomes a sample.

**This is a character change, not a tuning knob.** Today's Observer delivers a reliable spread across all defined dimensions. Tomorrow's Observer (with an expanded set) delivers a rotating emphasis. The writer's experience shifts from "my writing was read along these three axes" to "my writing was noticed for these two or three things this time." Both are valid. They produce different feedback dynamics.

Three responses available:

| Response | What it changes | Cost |
|----------|-----------------|------|
| **Trust the LLM to pick best** | Nothing. Current mechanism holds. | Zero. But selection quality is unverified, and the LLM will likely gravitate to dimensions with richer pre-computed metrics. Dimensions without metrics get under-selected. |
| **Per-entry cap stays, but rotate across sessions** | Observer tracks which dimensions it surfaced recently and the prompt hints "these have not been observed lately." | Requires state. A small recent-dimension counter in the observation store. Medium change. |
| **Raise the cap proportionally** | Cap becomes 3-5 instead of 2-3. | Violates the 2-3 pedagogy guideline from `observation-granularity.md:205`. But that guideline assumes an instructor-student dynamic; ink-mirror is a mirror, not a teacher (the research explicitly flagged this in its open threads). Worth reconsidering. |

**My read:** The minimum first expansion (one new dimension) does not yet need selection-pressure changes. N=4 with cap 2-3 is still workable. Past N=5, rotation or an expanded cap becomes a real question. This is a sequencing observation: dimension expansion and selection mechanism are separable decisions, but the second one becomes load-bearing by the time the set doubles.

---

## 4. Prompt-only vs. Structural: Pressure-testing the Hypothesis

The user's framing: "primarily a prompt update." Here is what actually changes per dimension added:

| Touch point | Required? | Size |
|-------------|-----------|------|
| System prompt dimension list | Always | 1 line |
| System prompt dimension definition | Always | 2-3 lines |
| System prompt worked example | Recommended for any dimension with subjective framing | 3-5 lines |
| Zod enum (`observations.ts:5-9`) | **Always.** Schema validation rejects unknown dimensions. | 1 line |
| `DIMENSION_LABELS` in `profile-store.ts` | Always. Profile renders with raw key fallback, but the daemon map is authoritative. | 1 line |
| `DIMENSION_LABELS` in `packages/cli/src/profile.ts` | Always. CLI duplicates the map in two places. | 2 lines (one duplication) |
| `OPPOSING_SIGNALS` in `curation.ts` | Optional. Contradiction detection (REQ-V1-19) silently misses the new dimension without it. | 2-5 regex pairs |
| `EntryMetrics` schema + new `metrics/*.ts` module | Optional. Dimension works LLM-native without it, but loses determinism, and the LLM may hallucinate counts. | 30-100 lines |
| Worked-example coverage for non-evaluation rail | Required for tonal, register, any judgment-heavy dimension | embedded in prompt |
| Tests (observer unit test + integration test covering the new dimension) | Required | 20-50 lines per test file |

**Verdict:** The hypothesis is mostly right, but the phrase "primarily a prompt update" understates two persistent surfaces:

1. **Three places hold a dimension list** (zod enum plus two `DIMENSION_LABELS`), and the CLI one is a duplication of the daemon one. Adding a dimension without touching all three leaves the profile renderer showing raw keys in one surface.
2. **Contradiction detection silently degrades.** REQ-V1-19 says the Observer surfaces contradictory patterns during curation. A new dimension with no `OPPOSING_SIGNALS` entries simply never produces contradictions. Not a correctness bug, but a spec requirement that quietly weakens.

The hidden observation: **the duplicated `DIMENSION_LABELS` is an abstraction that wants to exist.** Three workers (daemon profile renderer, daemon prompt builder, CLI profile renderer) all derive human labels from dimension keys, and each has its own copy. Promoting the label map to `@ink-mirror/shared` collapses this and makes future dimension additions one-line-in-shared plus a prompt update. That is the shape the codebase is trying to say: dimensions are shared-package data, not daemon-local constants.

---

## 5. Risks

- **Observer dilution.** More options, same 2-3 cap. Selection quality degrades if the LLM doesn't know how to prioritize. Mitigation: don't expand past 4-5 without revisiting the cap or introducing rotation.
- **Prompt bloat.** Current dimension definitions block is ~6 lines. Doubling dimensions doubles that. With worked examples per dimension, it balloons further. Watch the system prompt token budget against REQ-V1-13's Tier 1 budget (2,300-3,700 tokens).
- **Metric / LLM drift.** Dimensions with pre-computed metrics feel more rigorous to the LLM; it will preferentially cite them. Dimensions without metrics risk becoming hallucinated counts ("you used 6 em-dashes" when it was actually 4). Mitigation: for any dimension with countable signals, add metrics; for dimensions that are irreducibly subjective (tone, register), the LLM-native path is correct, but the prompt should forbid numeric claims.
- **Evaluation gap.** There is no golden corpus for observation quality. Adding a dimension is adding an unvalidated hypothesis. Mitigation: treat the first real-world week of observations as the validation. The writer's curation decisions (intentional / accidental / undecided) are the ground truth.
- **Overlap creep.** Discourse connectives overlaps word-level-habits; tonal markers overlaps word-level-habits; paragraph structure overlaps sentence-structure. Without crisp boundaries in the prompt, two dimensions compete for the same observation and the Observer gets confused. Mitigation: each dimension definition must include a "not this" clause.
- **Vision review overdue.** `review_trigger` has fired (v1 loop + Craft Nudge shipped). A dimension expansion is exactly the kind of decision the re-review should inform. Consider scheduling the review before committing to a multi-dimension expansion.

---

## 6. Recommended Next Move

**Add `punctuation-habits` as the first and only expansion in this cycle.** Nothing else.

Why this specifically:

- Highest surprise-to-risk ratio of any candidate. Writers rarely notice their own punctuation; there is no observation/evaluation boundary to navigate.
- Smallest touch-point set. Prompt update plus three dimension-list additions plus an optional deterministic metrics module. Scope = Small.
- Validates the expansion path without stressing selection pressure: N=4 is safely below the cap-breakage point.
- Produces a natural test of the "primarily a prompt update" hypothesis. If this expansion feels smooth, the duplicated `DIMENSION_LABELS` becomes a simplification opportunity. If it feels bumpy, that friction points at the real refactor needed before the next dimension lands.

Spec-ready framing for the follow-up commission:

> Add a fourth observation dimension, `punctuation-habits`, covering em-dash, semicolon, colon density; ellipsis use; parenthetical density; and exclamation/question use. Update the zod enum, the daemon and CLI label maps, the Observer system prompt (dimension list, definition, worked example), and add a `metrics/punctuation.ts` module that mirrors the existing structure modules. Add 2-3 `OPPOSING_SIGNALS` pairs for contradiction detection. Do not change the 2-3 observation cap. Hold selection-pressure changes and further dimensions for a separate cycle.

Deferred (worth naming, not doing now):

- **Tonal markers.** The highest-value future dimension. Wait until punctuation expansion validates the process and the vision re-review closes.
- **Paragraph structure.** Promote when the `DIMENSION_LABELS` duplication is collapsed; it's a natural companion refactor.
- **Vocabulary register and discourse connectives.** Defer until multi-dimension rotation and cap policy are settled.

---

## Open Threads

- **`DIMENSION_LABELS` duplication.** Three copies of dimension-to-label mapping across daemon and CLI. Collapse into `@ink-mirror/shared` before the third or fourth dimension lands. This is the pattern the codebase is trying to say. Naming it explicitly before it becomes a six-place change.
- **Selection-pressure policy for N >= 5.** Rotation state, an expanded cap, or continued trust in LLM selection. Separate decision from dimension choice, but binds by the time the set doubles.
- **Vision re-review.** Trigger has fired. Any non-trivial expansion benefits from reconfirming the principles before committing.
- **Evaluation methodology.** No golden corpus exists. The writer's own curation decisions are currently the only quality signal. Worth naming this as a known gap before observation quality becomes a debate.
