---
title: Commission batch cleanup (2026-03-26 to 2026-03-27)
date: 2026-03-27
status: complete
tags: [retro, commissions, cleanup]
---

## Context

36 commissions across 5 workers (Celeste, Verity, Dalton, Thorne, Sienna, Octavia), spanning March 26-27. The batch covers the full v1 core loop: vision authoring, four research threads, spec/plan, five implementation phases with paired reviews and fixes, art direction, DX cleanup, and a lore tend pass. Every commission completed successfully.

## What Worked

The implement-review-fix chain pattern produced consistent quality. Thorne caught real defects (path traversal in 1B, entry duplication in Tier 2 context, wrong model in production) that Dalton fixed in every case. Research commissions (Verity) ran in parallel and fed cleanly into vision and spec work.

Phase ordering was good: putting the observation pipeline (Phase 2) right after scaffold (Phase 1) surfaced integration risk early. The fail-fast structure in the plan paid off.

## Loose Threads

### 1. Phase 2B Observer was never reviewed

Thorne's review commission (103935) couldn't write the review file due to read-only toolset. Dalton's fix commission (103940) found no review to act on and verified test state instead. The Observer integration (session runner, prompt construction, auto-trigger, observation storage) is the highest-risk component and has no independent review artifact. Consider a retrospective review before extending observer behavior.

### 2. Web package missing type dependencies

`@types/react` and `@types/node` are missing from `packages/web/package.json`. Noted in both DX commissions (Dalton-154203, Dalton-154212). The npm registry was blocked during execution, preventing installation. Web is excluded from root tsconfig as a result. This needs manual resolution: `cd packages/web && bun add -D @types/react @types/node`.

### 3. bun.lock not committed

Thorne flagged missing lockfile in Phase 1A review. Dalton documented it for manual resolution (npm registry blocked). Reproducible builds require a committed lockfile.

### 4. Stop word filtering in token frequencies

Thorne 2A review F5 (info-level): `tokenFrequencies` includes stop words. Tagged for Phase 2B to handle, but no explicit filtering was added. The Observer prompt may get noisy word lists. Low priority but worth noting if observation quality issues surface.

### 5. Contradiction detection coverage

Phase 5 review F-06: contradiction detection uses 10 regex pairs. Acknowledged as a known tradeoff (false negatives only, no false positives). The detection works but has narrow coverage. Worth revisiting if curation feedback suggests missed contradictions.

## Infrastructure Issues

### Thorne cannot persist review files

Thorne's toolset is read-only by design (reviews without modifying code). But review artifacts are files that need writing. This caused failures in Phase 2B (review lost entirely) and Phase 5 (review captured inline but not persisted). Dalton wrote the review files in subsequent fix commissions as a workaround.

This is a structural gap in the commission system: the reviewer role needs write access to `.lore/reviews/` without having write access to source code.

### Duplicate linked_artifacts

Sienna's commission (135151) has duplicate entries in `linked_artifacts` (icon.png, style-reference.png, journal-screen-mockup.html, mockup-journal-screen.png each listed twice). Cosmetic, but indicates the artifact linking mechanism doesn't deduplicate.

### npm registry blocked throughout

All implementation commissions ran with npm registry blocked (403). Tests passed against existing node_modules, but `bun install` could not run. This constrained the entire batch: no new dependencies could be added, web types couldn't be installed, lockfile couldn't be generated.

## Lessons

1. **Review toolset must match review output.** A reviewer that can't write findings creates a gap that downstream commissions can't fill reliably. Phase 2B's missing review is the concrete cost.

2. **The implement-review-fix chain works.** Every phase where the chain completed fully (1A, 1B, 2A, 3A, 4A, 5) produced measurably better code. The pattern should be the default for all implementation work.

3. **Blocked npm registry cascades.** A single environment constraint (403 from registry) affected lockfile generation, type dependency installation, and web package builds across the entire batch. Environment readiness should be verified before dispatching implementation batches.
