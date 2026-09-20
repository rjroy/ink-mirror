---
title: Fixing the longitudinal gap in observe→curate→profile
date: 2026-07-03
status: resolved
tags: [observer, curation, profile, longitudinal, aggregation, pattern-identity]
modules: [daemon, observer, curation, profile-store]
related: [.lore/work/research/stylometry-and-feedback-for-longitudinal-design.md, .lore/specs/v1-core-loop.md]
---

# Fixing the longitudinal gap in observe→curate→profile

Captured retroactively; this brainstorm ran in-session on 2026-07-03 and fed directly into the stylometry research doc. Recorded here because that doc cites it.

## The problem

Observations are per-entry salience. "Pattern" is just a string on an observation. Nothing aggregates across entries, and `transformToStablePattern()` promotes single-sighting anecdotes into permanent profile claims via regex tense-rewriting. The product promise (a truthful style profile, skill-building feedback) requires longitudinal confirmation that no component performs.

## Where aggregation could live (options considered)

- **A. In the Observer.** Feed it the known-pattern ledger, let it make cross-entry claims. Rejected as primary mechanism: makes the LLM the bookkeeper, and LLM counts are vibes.
- **B. A new component between observe and curate (the Ledger).** Every observation is matched against known patterns: a *sighting* of an existing pattern (increment, attach evidence) or a *discovery* (new candidate). Curation operates on patterns with dossiers.
- **C. In curation.** Show accumulated evidence ("4 of your last 9 entries") when asking the intentionality question.
- **D. At promotion (probation).** Profile rules require N sightings across M entries before eligibility. Kills the regex tense-shift promotion.
- **E. After promotion (rule health).** Rules are hypotheses; each new entry supports or fails to support them; support ratio and last-seen date; stale rules resurface for re-curation. Profile stops being append-only.

Conclusion: B+D+E as one coherent architecture, with C as the UX expression of B. A is the trap.

## Pattern identity (the crux)

Options: tuned string matching (fails both directions), fixed taxonomy (caps what the mirror can notice), LLM matching against the ledger with auditable output, writer ratifies every merge (honest, high friction). Leaned LLM-matching with user-visible, reversible merge provenance. Research later confirmed no off-the-shelf answer exists; this stays a design bet.

## Stats-first substrate

The metrics module already computes per-entry numbers. Persist them as a time series and derive trend claims deterministically; the LLM narrates verified statistics instead of generating them. Hard numbers underneath, pattern language on top. Limitation: only covers computable patterns, so qualitative ones still need identity matching.

## Questions carried into research

1. Does frequency deserve to gate the profile? (Resolved: asymmetric standard. The system needs recurrence; the writer can bless one-offs.)
2. What happens to "accidental"? (Resolved: watch list with trend; the missing knowledge-of-results loop, highest pedagogical value.)
3. Should old support decay? (Supported by within-author drift findings; recency matters.)
4. Cold start below ~5 entries. (Resolved by scope decision: show sightings, gate claims.)

## Tangent parked

A scheduled retrospective pass that rereads the whole corpus monthly and writes a corpus-level report is a different grain of observer. Not this commission.

## Resolution

Folded into `.lore/work/specs/longitudinal-pattern-confirmation.md` after research grounding. Scope decisions made by Ronald 2026-07-03: full layer in one spec; LLM identity matching with writer correction; sightings shown but claims gated below threshold.
