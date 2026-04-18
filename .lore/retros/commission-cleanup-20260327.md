---
title: Commission batch cleanup (2026-03-26 to 2026-03-27)
date: 2026-03-27
status: complete
tags: [retro, commissions, cleanup]
---

## Validation Note (2026-04-18)

Loose threads tagged inline with current status after code-verification pass: [RESOLVED], [OPEN], or [DIVERGED]. Lessons section retained as historical observation. Infrastructure Issues section trimmed where the underlying premise no longer holds (see `.lore/lore-config.md` — the `reviews/` custom directory was removed 2026-04-18; it was declared but never practiced).

## Context

36 commissions across 5 workers (Celeste, Verity, Dalton, Thorne, Sienna, Octavia), spanning March 26-27. The batch covers the full v1 core loop: vision authoring, four research threads, spec/plan, five implementation phases with paired reviews and fixes, art direction, DX cleanup, and a lore tend pass. Every commission completed successfully.

## What Worked

The implement-review-fix chain pattern produced consistent quality. Thorne caught real defects (path traversal in 1B, entry duplication in Tier 2 context, wrong model in production) that Dalton fixed in every case. Research commissions (Verity) ran in parallel and fed cleanly into vision and spec work.

Phase ordering was good: putting the observation pipeline (Phase 2) right after scaffold (Phase 1) surfaced integration risk early. The fail-fast structure in the plan paid off.

## Loose Threads

### 1. Phase 2B Observer was never reviewed [OPEN]

Thorne's review commission (103935) couldn't write the review file. Dalton's fix commission (103940) found no review to act on and verified test state instead. The Observer integration (session runner, prompt construction, auto-trigger, observation storage) is the highest-risk component and has no independent review artifact. Consider a retrospective review before extending observer behavior.

*2026-04-18: Reframed. Original text claimed a convention gap around `.lore/reviews/`; that directory was declared in `lore-config.md` but never practiced, and has since been removed from config. The real thread is simpler: Observer shipped without independent review. Inline review in a commission or retro would close it.*

### 2. Web package missing type dependencies [RESOLVED]

`@types/react` and `@types/node` are missing from `packages/web/package.json`. Noted in both DX commissions (Dalton-154203, Dalton-154212). The npm registry was blocked during execution, preventing installation. Web is excluded from root tsconfig as a result. This needs manual resolution: `cd packages/web && bun add -D @types/react @types/node`.

*2026-04-18: Resolved. `packages/web/package.json` now lists `@types/react`, `@types/node`, `@types/react-dom` in devDependencies.*

### 3. bun.lock not committed [RESOLVED]

Thorne flagged missing lockfile in Phase 1A review. Dalton documented it for manual resolution (npm registry blocked). Reproducible builds require a committed lockfile.

*2026-04-18: Resolved. `bun.lock` is committed at the repo root.*

### 4. Stop word filtering in token frequencies [RESOLVED]

Thorne 2A review F5 (info-level): `tokenFrequencies` includes stop words. Tagged for Phase 2B to handle, but no explicit filtering was added. The Observer prompt may get noisy word lists. Low priority but worth noting if observation quality issues surface.

*2026-04-18: Resolved. Stop word filtering lives in `packages/daemon/src/metrics/word-frequency.ts` and is consumed by `observer.ts`.*

### 5. Contradiction detection coverage [OPEN]

Phase 5 review F-06: contradiction detection uses 10 regex pairs. The detection has narrow coverage. Worth revisiting if curation feedback suggests missed contradictions.

*2026-04-18: Pair count confirmed (10 pairs in `OPPOSING_SIGNALS`, `packages/daemon/src/curation.ts:15-26`). Removed original "false negatives only, no false positives" framing — the matcher is purely lexical within a dimension, so same-dimension observations containing opposing tokens in unrelated contexts can false-positive (e.g. "short words" vs "long clauses"). False negatives AND false positives are both possible.*

## Infrastructure Issues

### Thorne cannot persist review files [DIVERGED]

Thorne's toolset is read-only by design (reviews without modifying code). Phase 2B's review was lost entirely; Phase 5's was captured inline but not persisted. Dalton wrote review files in subsequent fix commissions as a workaround.

*2026-04-18: Original framing assumed reviews belonged in a dedicated `.lore/reviews/` directory. That convention was removed from `lore-config.md` — it was declared but never practiced. The real gap is narrower: Thorne produces review content that has to land somewhere, and the commission chain sometimes drops it. Inline capture in the review commission body (or a follow-up commission) is sufficient; no separate directory is needed.*

### Duplicate linked_artifacts

Sienna's commission (135151) has duplicate entries in `linked_artifacts` (icon.png, style-reference.png, journal-screen-mockup.html, mockup-journal-screen.png each listed twice). Cosmetic, but indicates the artifact linking mechanism doesn't deduplicate.

### npm registry blocked throughout

All implementation commissions ran with npm registry blocked (403). Tests passed against existing node_modules, but `bun install` could not run. This constrained the entire batch: no new dependencies could be added, web types couldn't be installed, lockfile couldn't be generated.

## Lessons

1. **Review toolset must match review output.** A reviewer that can't write findings creates a gap that downstream commissions can't fill reliably. Phase 2B's missing review is the concrete cost.

2. **The implement-review-fix chain works.** Every phase where the chain completed fully (1A, 1B, 2A, 3A, 4A, 5) produced measurably better code. The pattern should be the default for all implementation work.

3. **Blocked npm registry cascades.** A single environment constraint (403 from registry) affected lockfile generation, type dependency installation, and web package builds across the entire batch. Environment readiness should be verified before dispatching implementation batches.
