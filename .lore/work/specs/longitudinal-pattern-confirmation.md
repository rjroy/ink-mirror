---
title: Longitudinal pattern confirmation layer
date: 2026-07-03
status: draft
tags: [spec, observer, curation, profile, longitudinal, pattern-ledger, watch-list]
modules: [daemon, shared, observer, curation, profile-store, metrics]
req-prefix: LPC
related:
  - .lore/work/brainstorm/longitudinal-gap.md
  - .lore/work/research/stylometry-and-feedback-for-longitudinal-design.md
  - .lore/specs/v1-core-loop.md
  - .lore/research/profile-versioning.md
  - .lore/issues/observation-evaluation-methodology.md
  - .lore/issues/observer-selection-pressure-policy.md
---

# Spec: Longitudinal pattern confirmation layer

## Overview

v1 observes single entries and promotes single-sighting observations into permanent profile claims. Stylometry research says a single journal entry is below the floor where style claims mean anything (~2,000 words minimum); the profile-based paradigm (accumulate evidence across samples, claim from the accumulation) is the established fix. Pedagogy research says the highest-value missing piece is knowledge of results: did the pattern I disowned actually decline?

This layer makes **pattern** a first-class entity with a lifecycle. Observations become **sightings** of patterns. Curation judges patterns with accumulated evidence dossiers. Profile rules require recurrence before the system proposes them (the writer can still bless anything). Rules carry health and resurface when stale. Accidental patterns get a watch list with deterministic trend feedback.

Scope decisions (Ronald, 2026-07-03): full layer in one spec; pattern identity via LLM matching with writer-correctable merges; below evidence thresholds, sightings are shown but claims are gated.

This spec occupies the v1 exit points `[STUB: profile-versioning]` (partially: rule health, not snapshots) and `[STUB: observation-expansion]` (the ledger changes what an observation is), and resolves two v1 open questions: the observation-to-rule transformation format (REQ-LPC-17/18) and undecided resurfacing scope (unchanged, already capped in code).

## Concepts

- **Pattern**: a named, dimension-tagged writing habit with a stable ID and a lifecycle status: `candidate` (seen, not yet judged), `intentional`, `accidental`, `undecided`, `retired`. The canonical statement is phrased as a stable characteristic ("Uses staccato rhythm for emphasis at paragraph endings"). Lifecycle transitions: curation moves `candidate`/`undecided` to any classification; any classified pattern can be re-classified; `retired` is entered only by writer action (REQ-LPC-22) and reactivates to `undecided`.
- **Sighting**: one occurrence of a pattern in one entry: entry ID, verbatim evidence quote, date, source observation.
- **Dossier**: a pattern plus all its sightings and any substrate trend, as presented at curation.
- **Metric snapshot**: the per-entry metrics vector, persisted, forming a time series across the corpus.
- **Substrate**: deterministic statistics computed from metric snapshots. No LLM involvement.
- **Computable pattern**: a pattern linked at creation to a named metric field in the snapshot schema (the Observer proposes the link; validation accepts it only if the field exists in a registry of linkable metrics). Patterns without a valid link are **qualitative**: only sighting-based evidence applies to them. The computable/qualitative distinction decides which branch of REQ-LPC-12, 19, 21, 23, and 25 a pattern takes.
- **Watch item**: tracking metadata attached to a pattern classified `accidental`: classification date, pre-classification baseline (computable patterns only), recurrence record since classification, and resolution state. A watch item never changes the pattern's classification or any rule; it only records and reports.

## Requirements

### Pattern ledger

- REQ-LPC-1: Patterns are first-class stored entities: stable ID, canonical statement, dimension, lifecycle status, creation date. Stored as human-readable files per REQ-V1-26.
- REQ-LPC-2: Every stored observation is either a sighting of an existing pattern or a discovery that creates a new `candidate` pattern with its first sighting. No orphan observations.
- REQ-LPC-3: A sighting records entry ID, verbatim evidence, and date. Evidence validation per REQ-V1-7 (exact text from the entry) continues to apply.
- REQ-LPC-4: Identity matching is proposed by the Observer: the prompt includes the ledger of active patterns (ID, canonical statement, dimension), and each output observation either references an existing pattern ID or declares a new pattern. An output referencing a nonexistent pattern ID is rejected by validation.
- REQ-LPC-5: The ledger included in the Observer prompt is bounded: active (non-retired) patterns only, capped at 50 patterns by default (configurable), sized to keep total Observer context within the v1 cost constraint (< $1.50/month at daily journaling). When the cap binds, patterns are prioritized by recency of last sighting.
- REQ-LPC-6: Merges are visible and reversible. The curation surface shows which entries each dossier draws from, and the writer can detach a mis-attributed sighting; a detached sighting becomes a new `candidate` pattern.

### Stats substrate

- REQ-LPC-7: Every entry's computed metrics are persisted as a metric snapshot at submission time, human-readable, one per entry.
- REQ-LPC-8: All cross-entry numeric claims surfaced anywhere in the product (counts, rates, trends, "N of last M entries") are computed deterministically from metric snapshots and the sighting ledger. The LLM may narrate these numbers; it never generates them.
- REQ-LPC-9: Metric snapshots include function-word frequencies and punctuation habits in addition to the existing rhythm/hedging/structure metrics. Research finding: function words are the topic-independent style signal; the current stop-word filtering discards exactly the stable signal for identity purposes. (Content-word frequencies remain useful for per-entry observation; both are kept.)

### Observer changes

- REQ-LPC-10: The Observer prompt includes substrate trends and per-pattern sighting counts for the ledger patterns it receives, and instructs the model that longitudinal statements must cite those supplied numbers. This requirement is testable at the prompt level (the numbers are present) and by instruction (the system prompt forbids estimating frequencies); it is best-effort at the output level. The authoritative product surface for numbers is REQ-LPC-8: any count the UI displays comes from the substrate/ledger, never from LLM prose.
- REQ-LPC-11: Observations appear immediately after submission (practice stays rewarding), presented as unconfirmed sightings until their pattern crosses confirmation thresholds. The full below-threshold experience is specified in REQ-LPC-26.

### Curation on dossiers

- REQ-LPC-12: Curation presents patterns with dossiers: sighting count, distinct-entry count, per-sighting evidence with entry context (preserving REQ-V1-17), and substrate trend where the pattern is computable. The intentionality question is asked of the pattern, not of an isolated observation.
- REQ-LPC-13: The classification vocabulary is unchanged (intentional / accidental / undecided) and applies at pattern level. Re-classification is allowed at any time. Contradiction detection (REQ-V1-19) compares patterns, not raw observation strings.

### Promotion probation

- REQ-LPC-14: The system proposes promotion of a pattern to a profile rule only when all of: (a) the pattern is classified `intentional`, (b) ≥ 3 sightings, (c) across ≥ 3 distinct entries, (d) the supporting entries total ≥ 2,000 words. Thresholds are configurable constants grounded in the attribution-research floor documented in the stylometry research doc. Classification is always a precondition: no pattern reaches the profile without the writer having judged it intentional (preserves REQ-V1-16/20).
- REQ-LPC-15: A proposal is a suggestion, not an action: it surfaces at the next curation session and the rule is created only when the writer accepts. Classification alone no longer auto-creates a rule (this replaces the current classify-intentional-immediately-writes-a-rule behavior).
- REQ-LPC-16: The writer may promote any `intentional` pattern at any time regardless of evidence thresholds (a single action may classify and promote together). Writer-promoted rules are marked `writer-asserted`; proposal-accepted ones are marked `evidence-confirmed`. This is the asymmetric evidence standard: the system needs recurrence, the writer's judgment doesn't.
- REQ-LPC-17: A profile rule's text derives from its pattern's canonical statement (editable per REQ-V1-22). The regex-based `transformToStablePattern` promotion path is removed.
- REQ-LPC-18: Every profile rule links to its pattern ID, and the dossier is reachable from the rule: the profile can answer "why does it say this?" with cited evidence. Exception: rules migrated under REQ-LPC-27 carry an explicit "migrated, no historical sightings recorded" dossier state until they accumulate real sightings post-migration.

### Rule health

- REQ-LPC-19: Rules carry support metadata: total sightings, distinct entries, last-supported date, and (for computable patterns) a substrate support measure.
- REQ-LPC-20: Absence of a sighting is not evidence of absence: the Observer samples 2-3 observations per entry (see `.lore/issues/observer-selection-pressure-policy.md`). Therefore qualitative rule decay is resurfacing, not deletion: a rule with no sighting in the last 10 entries (configurable) resurfaces at curation for reaffirm-or-retire. The system never auto-deletes or auto-retires a rule (consistent with REQ-V1-19's never-auto-reconcile).
- REQ-LPC-21: For computable patterns, the substrate flags drift when the rolling mean of the linked metric over the last 5 entries deviates from the rule's recorded baseline by a configured relative margin (default 50%); a drift flag resurfaces the rule the same way as staleness. The margin joins the other configurable constants in Open Questions.
- REQ-LPC-22: Retiring is a writer action, taken on a resurfaced rule or directly on a pattern at curation. Retiring a rule removes it from the profile and retires its linked pattern; retiring a pattern with no rule just sets its status. Retired patterns leave the Observer ledger (REQ-LPC-5) but keep their sighting history, and the writer can reactivate one, returning it to `undecided`.

### Accidental watch list

- REQ-LPC-23: Classifying a pattern `accidental` places it on a watch list, recording the classification date and, for computable patterns, the pre-classification baseline rate.
- REQ-LPC-24: Watch feedback reports recurrence since disowning ("appeared in 2 of 5 entries since you marked this accidental"), computed per REQ-LPC-8. Watch status is visible during curation sessions.
- REQ-LPC-25: Watch resolution is asymmetric by pattern kind, because sighting absence is weak evidence (REQ-LPC-20). Computable patterns resolve when the linked metric stays below the pre-classification baseline for 5 consecutive entries (substrate-verified). Qualitative patterns resolve only after a longer window with no sightings (default 10 consecutive entries), and the report is worded as observation, not verdict ("not seen in your last 10 entries"), never "fixed." Resolution changes watch-tracking metadata only — never the pattern's classification or any rule — so it observes and reports rather than auto-reconciling (REQ-V1-19). Resolution is affirmatively reported to the writer: this is the knowledge-of-results loop from deliberate-practice research, not silent removal.

### Cold start and migration

- REQ-LPC-26: Below promotion thresholds the full observe/curate experience still functions: sightings appear, curation runs, manual promotion works. Only system promotion proposals are gated. The UI labels the corpus state honestly (e.g., evidence still accumulating) rather than pretending confirmation.
- REQ-LPC-27: Existing profile rules migrate as `writer-asserted` rules, text unchanged. Each gets a pattern created from its rule text with status `intentional` (the current format stores no curation history or evidence, so nothing richer is recoverable) and the "migrated, no historical sightings recorded" dossier state per REQ-LPC-18. Migrated rules participate in health tracking from migration forward; the staleness clock (REQ-LPC-20) starts at migration, not at the rule's original creation date.

### Surface and contract changes

- REQ-LPC-28: The curation API moves to pattern grain: endpoints exist to fetch a curation session of dossiers, classify a pattern, detach a sighting, accept or decline a promotion proposal, promote an intentional pattern directly, retire/reactivate, and read the watch list. The observation-level classify endpoint and its classify-intentional-writes-a-rule side effect are removed. Concrete route shapes are design-document territory; the CLI discovers whatever ships via the operations registry (REQ-V1-29).
- REQ-LPC-29: The SSE event contract is versioned with this change: events carry pattern IDs alongside observation payloads (e.g., `observation:created` gains the resolved pattern reference, and pattern-level events cover discovery, proposal, and watch resolution). Existing clients in this repo (web, CLI) are updated in the same change; there are no external consumers.
- REQ-LPC-30: The per-observation `status` field and its transition table are removed from the sighting schema: classification is a pattern-level concept only (REQ-LPC-13). Stored historical observations migrate their status to their pattern where one is created for them.

## Non-Goals

- **Curation vocabulary change** (keep/change/watch instead of intentional/accidental/undecided): deliberately out of scope; would touch vision.md and all clients. Revisit after this layer proves out.
- **Genre/context tagging of entries**: research says context confounds cross-entry comparison, but the friction/benefit tradeoff is unproven. Open question, not a requirement.
- **Corpus-wide retrospective observer** (monthly whole-corpus report): different grain, parked in the brainstorm.
- **Profile snapshots/versioning and diffs**: still its own stub (`.lore/research/profile-versioning.md`); rule health here is complementary, not a replacement.
- **Tier 3 semantic retrieval** (REQ-V1-14): still deferred.

## Success Criteria

- [ ] Submitting an entry produces observations that are sightings: each either extends an existing pattern's dossier or creates a candidate pattern
- [ ] A repeated habit across entries accumulates in one dossier, visible with all evidence at curation
- [ ] A mis-merged sighting can be detached and becomes its own candidate pattern
- [ ] The system never proposes promotion below the thresholds or for a pattern not classified intentional; it does propose at or above them; a rule is created only on writer acceptance
- [ ] The writer can classify-and-promote a single-sighting pattern in one action, and the profile marks it writer-asserted
- [ ] Every post-migration profile rule can show its evidence dossier; migrated rules show the explicit migrated/no-history state
- [ ] A rule unsupported for the configured window resurfaces for reaffirm-or-retire; nothing is auto-deleted
- [ ] A computable rule whose linked metric drifts past the configured margin resurfaces, distinctly testable from staleness
- [ ] Marking a pattern accidental starts watch tracking; recurrence and resolution are both reported with deterministic numbers, and qualitative resolutions are worded as observation, not verdict
- [ ] All numeric cross-entry claims trace to metric snapshots or sighting counts, reproducible without an LLM
- [ ] Pre-existing profile rules survive migration unchanged in text, marked writer-asserted
- [ ] Entries, patterns, sightings, snapshots, and the profile remain human-readable files

## AI Validation

**Defaults apply:** unit tests with mocked LLM/filesystem via dependency injection (no `mock.module()`); 90%+ coverage on new code; fresh-context sub-agent code review.

**Custom, behavioral:**
- Substrate determinism: fixed entry fixtures produce byte-identical metric snapshots and trend outputs across runs; property tests for rate/window math edge cases (empty corpus, single entry, all-identical entries).
- Ledger integrity: validation rejects Observer output referencing unknown pattern IDs; every stored observation resolves to exactly one pattern; detach produces a new candidate and removes the sighting from the source dossier.
- Promotion gate: constructed corpora just below and just above each threshold (classification status, sightings, distinct entries, word count) verify proposal suppression and emission respectively; a proposal without writer acceptance creates no rule.
- Rule health: fixtures verify staleness resurfacing at the window boundary and drift-flag firing just past the configured margin (and not just under it), as separate cases.
- Watch loop: scripted sequences per pattern kind verify trend text and resolution firing at each configured window (substrate-gated for computable, longer sighting-absence window for qualitative), and that resolution mutates only watch metadata.
- Prompt contract: with a populated ledger, the built Observer prompt contains the pattern IDs, sighting counts, and substrate block (REQ-LPC-10's testable surface); Observer output referencing an unknown pattern ID is rejected (REQ-LPC-4).
- Migration: a fixture profile in the current markdown format round-trips through migration with rule text unchanged, writer-asserted marking present, linked patterns created as intentional, and the migrated/no-history dossier state set.
- Identity-match quality has no automated oracle (no golden corpus; see `.lore/issues/observation-evaluation-methodology.md`): acceptance requires a manual spot-check protocol — submit a scripted series of entries with deliberately recurring habits and verify the ledger converges to one pattern per habit rather than near-duplicates.
- Cost check: measure Observer prompt token count with a full (capped) ledger against the v1 budget constraint.

## Open Questions

- **Identity-match quality measurement.** The LLM-matching bet needs an evaluation method eventually; the parked golden-corpus issue is the natural home. What convergence rate (patterns per true habit) counts as acceptable?
- **Near-duplicate candidate cleanup.** When the Observer creates a discovery that a human would call an existing pattern, should curation offer a merge action (writer-ratified), or is detach-only (split) sufficient for v1 of this layer?
- **Genre/mood confounds.** If false drift flags become noisy in practice, revisit entry auto-tagging.
- **Exact constants.** 3 sightings / 3 entries / 2,000 words / 10-entry staleness / 5-entry computable watch resolution / 10-entry qualitative watch resolution / 50-pattern ledger cap / 50% drift margin are research-informed defaults, not measured ones. Ship configurable, tune from use.

## Context

Direct inputs: the longitudinal-gap brainstorm (`.lore/work/brainstorm/longitudinal-gap.md`) and the stylometry/feedback research (`.lore/work/research/stylometry-and-feedback-for-longitudinal-design.md`). The research grounded: function words as stable signal (REQ-LPC-9), the ~2,000-word claim floor (REQ-LPC-14), the profile-based aggregation paradigm (the ledger itself), rolling-window trend mechanics (REQ-LPC-8/21), process/self-regulation feedback levels (dossier-based curation), and the deliberate-practice knowledge-of-results loop (REQ-LPC-25).

Code this touches: `packages/daemon/src/observer.ts` (prompt, validation), `observation-store.ts` (sightings), a new pattern-ledger store, `curation.ts` (dossier assembly, pattern-level contradiction), `profile-store.ts` (rule linkage, health, removal of `transformToStablePattern`), `packages/daemon/src/metrics/*` (snapshot persistence, function-word/punctuation tracking), `routes/observations.ts` (pattern-grain curation endpoints, removal of the classify-writes-a-rule side effect), `routes/events.ts` (event contract), and the corresponding shared schemas (including removal of sighting-level status/transitions) plus web/CLI curation surfaces. The dimension label map triplication (`.lore/issues/observer-label-map-consolidation.md`) intersects any schema change here.
