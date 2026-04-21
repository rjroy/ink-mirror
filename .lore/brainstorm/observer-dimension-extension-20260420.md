---
title: "Brainstorm: Extending the Observer's Dimension Set"
status: approved
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

> **Editor's note (2026-04-20, Octavia):** cleanup pass. Removed two candidate dimensions that did not trace to the research (`punctuation-habits` and `discourse-connectives`), replaced "not previously discussed = better" reasoning with research-grounded selection criteria, and corrected factual claims about the codebase (notably: the CLI does not have a `DIMENSION_LABELS` constant; it has local `labels` maps).

## Frame

**Commission question:** ink-mirror's Observer currently selects from three fixed dimensions. What should extending the set look like, and is the user's hypothesis "just a prompt update" correct?

**Vision status:** `active` (reviewed 2026-03-26). The `review_trigger` is "After first working prototype delivers the write-observe-curate loop." Per project memory, v1 core loop + Craft Nudge shipped end-to-end on 2026-04-18, so the trigger has fired, but the vision has not been re-reviewed. Flagging, not blocking.

**Context scanned:**
- Vision principles and "What It Is Not" (`vision.md`)
- Requirements REQ-V1-5 through REQ-V1-10 and stub `[STUB: observation-expansion]` (`specs/v1-core-loop.md:115`)
- Granularity research and MVP-filter research (six categories proposed, three kept)
- Observer implementation: system prompt (`packages/daemon/src/observer.ts:105-165`), zod enum (`packages/shared/src/observations.ts:5-9`), metrics schema (`packages/shared/src/metrics.ts:79-86`), metrics modules (`packages/daemon/src/metrics/`)
- Profile rendering: daemon `DIMENSION_LABELS` at `packages/daemon/src/profile-store.ts:45-49`, and two local `labels` maps in the CLI at `packages/cli/src/profile.ts:40-44` and `packages/cli/src/profile.ts:147-151` that shadow the same data
- Contradiction detection: `OPPOSING_SIGNALS` at `packages/daemon/src/curation.ts:15-26`
- UI: `packages/web/app/entries/[id]/page.tsx:60` renders `obs.dimension` as a raw string, so it is dimension-agnostic
- Recent retros (none touching dimension extension directly; the Observer Prompt Quality chain resolved stop-word filtering and a prompt rewrite)

**Recent brainstorms check:** `.lore/brainstorm/` does not yet exist. No prior proposals to deduplicate against.

---

## 1. Inventory

### Live today (three)

From `packages/shared/src/observations.ts:5-9` and `packages/daemon/src/observer.ts:125-131`:

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
3. System prompt dimension definitions block (`observer.ts:125-131`)
4. `DIMENSION_LABELS` constant in daemon profile renderer (`profile-store.ts:45-49`)
5. Local `labels` record in the CLI profile module, declared twice — once in `showProfile` (`packages/cli/src/profile.ts:40-44`) and once in `buildProfileMarkdown` (`packages/cli/src/profile.ts:147-151`). The CLI never imports or references the daemon `DIMENSION_LABELS`; it rebuilds the same mapping inline.

Optional touch points: `OPPOSING_SIGNALS` for contradiction detection (`curation.ts:15-26`) and the `EntryMetrics` schema plus `metrics/` modules for pre-computed analysis. Neither blocks adding a dimension; both degrade that dimension's quality if skipped.

---

## 2. Candidates to Add (ranked)

**Candidate set.** This brainstorm draws exclusively from the six categories surfaced by `.lore/research/observation-granularity.md` and assessed in `.lore/research/minimum-viable-observation.md`. Three are already live (sentence-rhythm, word-level-habits, sentence-structure). The three remaining research-backed candidates are ranked below.

**Ranking criteria** (applied in order):
1. **Evidence availability.** How much signal can the Observer actually ground in the entry? Prefer dimensions where metrics already exist or can be computed deterministically; penalize dimensions that require LLM-native judgment with weak observational footing.
2. **Observer signal-to-noise.** Can the LLM produce a curatable pattern-level observation reliably, without needing a long worked example to stay non-evaluative?
3. **Non-overlap with live dimensions.** A new dimension that competes with `word-level-habits` or `sentence-structure` for the same observation dilutes selection. Prefer dimensions with a clean boundary.
4. **Vision alignment risk.** How fragile is the observation/evaluation rail for this dimension? The vision's "observations, not evaluations" line is load-bearing; dimensions that make it easy to slip into judgment are riskier.

Each proposal below names the dimension, the evidence trail back to the research, the rationale, vision alignment, and scope.

### Proposal A. Paragraph / discourse structure (**recommended first expansion**)

**Evidence.** Named as one of the six candidate categories in `observation-granularity.md` (see the synthesis table) and deferred from the MVP set by `minimum-viable-observation.md:93` for entry-length reasons, not on principle. The current metrics already compute `paragraphCount` and `paragraphOpeners` (schema in `packages/shared/src/metrics.ts:61-68`, surfaced in the Observer prompt at `observer.ts:249-253`), but no dimension claims paragraph patterns as primary territory — they bleed into `sentence-structure` today.

**Proposal.** Add `paragraph-structure` for: paragraph-length distribution; opening-vs-closing paragraph asymmetry; topic-sentence patterns (does the first sentence announce the topic?); transition-vs-juxtaposition habits (explicit connectives vs. abrupt shifts); single-sentence-paragraph use for emphasis.

**Rationale.** Promotes a real category from the research that's currently smeared across `sentence-structure`. Separating it makes both dimensions cleaner. Fires meaningfully on entries with 4+ paragraphs; below that, gracefully produces nothing (matches the granularity research's "fires when the data supports it" principle).

**Vision alignment.**
- *Anti-goal check.* Pattern observation, not structural advice. ✓
- *Principle alignment.* Feedback Accelerates Skill; frictionless (no observation when the entry is too short to support one). ✓
- *Tension resolution.* Risks overlap with `sentence-structure`. The line is: sentence-level patterns stay there, paragraph-level patterns move here. Each dimension definition in the prompt needs an explicit "not this" clause.
- *Constraint check.* ✓

**Scope.** **Small-to-Medium.** Prompt update, zod enum, label maps. Paragraph data already exists in `EntryMetrics.sentenceStructure.paragraphCount` and `paragraphOpeners`; deeper signals (single-sentence paragraphs, length distribution) are a modest addition to the existing structure analyzer. Not a new module.

---

### Proposal B. Vocabulary register (formal / casual mixing)

**Evidence.** One of the six research-backed categories (`observation-granularity.md` synthesis table). Deferred by `minimum-viable-observation.md:91` on cold-start judgment risk, not on principle. Granularity research ranked it medium on both viability criteria.

**Proposal.** Add `vocabulary-register` for formal/casual code-switching within an entry, jargon clustering, concrete-vs-abstract noun density, latinate-vs-germanic word-root tendencies.

**Rationale.** Real dimension, real signal, but specifically a *later* dimension because it becomes interesting only after a register baseline exists. The question a writer can curate is "did I mean to shift register in paragraph 3?", which requires establishing what their usual register is. The style profile infrastructure that now exists weakens the original cold-start objection but doesn't eliminate it.

**Vision alignment.**
- *Anti-goal check.* Risk of "formal" reading as "better" in the writer's ear. Prompt must avoid evaluative phrasing ("formal" and "casual" are both fine).
- *Principle alignment.* Feedback Accelerates Skill, but weaker for cold-start.
- *Tension resolution.* Partially resolved by the style profile now existing; partially still open.

**Scope.** **Medium.** Prompt update, zod enum, label maps. Pre-computed metrics would need a register-indicator lexicon (~200 words). Or LLM-native, accepting judgment variance. Either way, a worked example is mandatory for the register-isn't-quality rail.

---

### Proposal C. Tonal markers (stance and directness)

**Evidence.** One of the six research-backed categories, and the one the research explicitly flagged as the highest evaluation-boundary risk (`minimum-viable-observation.md:95`). The Observer Prompt Quality chain (retro `commission-cleanup-20260328.md:22`) tightened the evidence and non-evaluation rail since the research was written. The risk that justified deferral has partially, not fully, resolved.

**Proposal.** Add `tonal-markers` covering stance patterns: hedging *intensity* (not just presence, which word-level-habits already covers), direct-assertion density, rhetorical question use, conditional framing ("if…then," "when…then"), absolute language ("always," "never," "everyone"), and second-guessing patterns ("or maybe," "but actually," "I don't know, ").

**Rationale.** Likely the highest-value dimension in the long run — stance is the hardest thing a writer self-observes. The distinction from `word-level-habits`: that dimension names which words recur; tonal markers name what stance those words signal. The reason this is ranked last, not first, is evaluation risk: the granularity research explicitly cites tonal markers as the place where the observation/evaluation line is thinnest.

**Vision alignment.**
- *Anti-goal check.* Highest risk of crossing into evaluation ("you sound uncertain"). The guardrail: every tonal observation must cite evidence and name the *pattern*, not the *effect on reader*. "You qualified five of seven assertions with 'I think' or 'maybe'" is observation; "your writing sounds tentative" is evaluation. ✓ *if* the prompt enforces this.
- *Principle alignment.* Feedback Accelerates Skill (stance is the hardest thing to self-observe). ✓
- *Tension resolution.* The vision's "observations, not evaluations" line is load-bearing here. Requires a worked example in the prompt that demonstrates the non-evaluative framing explicitly.
- *Constraint check.* No external comparison. ✓

**Scope.** **Medium.** Prompt update, zod enum, label maps, plus a tonal-markers worked example in the system prompt (the non-evaluation rail is fragile without one). Metrics optional: stance detection is judgment-heavy and better done LLM-native per `minimum-viable-observation.md:124` (LLM-native is a valid choice when parsing is subjective).

---

## 3. Selection Pressure

Current mechanism: `ObserverOutputSchema` caps observations at 2-3 (`observations.ts:49-54`). The system prompt tells the LLM to prefer different dimensions across the 2-3 slots (`observer.ts:118`).

With N=3 dimensions and a cap of 2-3, the natural behavior is near-total coverage each entry. Every dimension usually gets an observation. At N=5 or N=6 (the ceiling if all three remaining research-backed candidates land), the math breaks: 2-3 observations cannot cover 5-6 dimensions, so per-entry selection becomes a sample.

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
| Local `labels` maps in `packages/cli/src/profile.ts` | Always. The CLI does not import `DIMENSION_LABELS`; it declares the same mapping inline twice (`showProfile` at :40-44, `buildProfileMarkdown` at :147-151). | 2 lines (one entry per local copy) |
| `OPPOSING_SIGNALS` in `curation.ts` | Optional. Contradiction detection (REQ-V1-19) silently misses the new dimension without it. | 2-5 regex pairs |
| `EntryMetrics` schema + new `metrics/*.ts` module | Optional. Dimension works LLM-native without it, but loses determinism, and the LLM may hallucinate counts. | 30-100 lines |
| Worked-example coverage for non-evaluation rail | Required for tonal, register, any judgment-heavy dimension | embedded in prompt |
| Tests (observer unit test + integration test covering the new dimension) | Required | 20-50 lines per test file |

**Verdict:** The hypothesis is mostly right, but the phrase "primarily a prompt update" understates two persistent surfaces:

1. **Three places hold a dimension-to-label mapping** — one daemon `DIMENSION_LABELS` constant and two local `labels` records in the CLI — plus the zod enum. Adding a dimension without touching all of them leaves the CLI falling back to the raw dimension key in at least one surface.
2. **Contradiction detection silently degrades.** REQ-V1-19 says the Observer surfaces contradictory patterns during curation. A new dimension with no `OPPOSING_SIGNALS` entries simply never produces contradictions. Not a correctness bug, but a spec requirement that quietly weakens.

The hidden observation: **the duplicated label map is an abstraction that wants to exist.** Three call sites (daemon profile renderer, daemon prompt builder, CLI profile renderer — the CLI declares its copy inline twice) all derive human labels from dimension keys. Promoting a shared label map to `@ink-mirror/shared` collapses this and makes future dimension additions one-line-in-shared plus a prompt update. That is the shape the codebase is trying to say: dimensions are shared-package data, not daemon-local constants that the CLI silently reinvents.

---

## 5. Risks

- **Observer dilution.** More options, same 2-3 cap. Selection quality degrades if the LLM doesn't know how to prioritize. Mitigation: don't expand past 4-5 without revisiting the cap or introducing rotation.
- **Prompt bloat.** Current dimension definitions block is ~6 lines. Doubling dimensions doubles that. With worked examples per dimension, it balloons further. Watch the system prompt token budget against REQ-V1-13's Tier 1 budget (2,300-3,700 tokens).
- **Metric / LLM drift.** Dimensions with pre-computed metrics feel more rigorous to the LLM; it will preferentially cite them. Dimensions without metrics risk becoming hallucinated counts ("you used 6 em-dashes" when it was actually 4). Mitigation: for any dimension with countable signals, add metrics; for dimensions that are irreducibly subjective (tone, register), the LLM-native path is correct, but the prompt should forbid numeric claims.
- **Evaluation gap.** There is no golden corpus for observation quality. Adding a dimension is adding an unvalidated hypothesis. Mitigation: treat the first real-world week of observations as the validation. The writer's curation decisions (intentional / accidental / undecided) are the ground truth.
- **Overlap creep.** Tonal markers overlaps `word-level-habits` (both are lexical); paragraph structure overlaps `sentence-structure` (paragraph openers are currently measured there). Without crisp boundaries in the prompt, two dimensions compete for the same observation and the Observer gets confused. Mitigation: each dimension definition must include a "not this" clause.
- **Vision review overdue.** `review_trigger` has fired (v1 loop + Craft Nudge shipped). A dimension expansion is exactly the kind of decision the re-review should inform. Consider scheduling the review before committing to a multi-dimension expansion.

---

## 6. Recommended Next Move

**Add `paragraph-structure` as the first and only expansion in this cycle.** Nothing else.

Why this specifically, against the ranking criteria:

- **Evidence availability is highest of the remaining candidates.** `paragraphCount` and `paragraphOpeners` already exist in `EntryMetrics` and already reach the Observer prompt. Deeper signals (single-sentence paragraphs, length distribution) extend the existing structure analyzer rather than introducing a new metric module.
- **Lowest evaluation-boundary risk.** Paragraph patterns are pure description — length, asymmetry, transitions. No stance judgment, no register judgment, no "sounds X" trap. The observation/evaluation rail does not need a new worked example the way tonal or register would.
- **Overlap is with `sentence-structure`, which is a clean boundary to draw.** Paragraph-level patterns move here; sentence-level patterns stay there. One "not this" clause per dimension settles it.
- **Validates the expansion path without stressing selection pressure.** N=4 with cap 2-3 is still workable. Past N=5, selection-pressure policy becomes load-bearing; this expansion leaves that decision for the next cycle.
- **Produces a natural test of the "primarily a prompt update" hypothesis.** If this expansion feels smooth, the duplicated label map becomes a simplification opportunity. If it feels bumpy, that friction points at the real refactor needed before the next dimension lands.

Spec-ready framing for the follow-up commission:

> Add a fourth observation dimension, `paragraph-structure`, covering paragraph-length distribution, opening-vs-closing asymmetry, topic-sentence patterns, transition-vs-juxtaposition habits, and single-sentence-paragraph use for emphasis. Update the zod enum, the daemon `DIMENSION_LABELS`, both CLI local `labels` maps, and the Observer system prompt (dimension list, definition, "not this" boundary against `sentence-structure`). Extend the sentence-structure analyzer to surface the additional paragraph signals it doesn't already compute. Add 2-3 `OPPOSING_SIGNALS` pairs for contradiction detection. Do not change the 2-3 observation cap. Hold selection-pressure changes and further dimensions for a separate cycle.

Deferred (worth naming, not doing now):

- **Vocabulary register.** Promote once either a lexicon path is chosen or the register-isn't-quality rail has a worked example in the prompt. The style profile now existing softens the original cold-start objection but doesn't close it.
- **Tonal markers.** The highest-value future dimension, held for last on the ranking because its evaluation-boundary risk is the one the research explicitly flagged. Wait until the paragraph expansion validates the process, the vision re-review closes, and a tonal-specific worked example is drafted.

---

## Open Threads

- **Label map duplication.** One daemon `DIMENSION_LABELS` constant plus two inline `labels` records in the CLI (`showProfile` and `buildProfileMarkdown`). The CLI does not import the daemon constant. Three call sites, same mapping, three places to keep in sync. Collapse into `@ink-mirror/shared` before the fourth or fifth dimension lands; otherwise each addition multiplies across all three sites.
- **Selection-pressure policy for N >= 5.** Rotation state, an expanded cap, or continued trust in LLM selection. Separate decision from dimension choice, but binds by the time the set doubles.
- **Vision re-review.** Trigger has fired. Any non-trivial expansion benefits from reconfirming the principles before committing.
- **Evaluation methodology.** No golden corpus exists. The writer's own curation decisions are currently the only quality signal. Worth naming this as a known gap before observation quality becomes a debate.
