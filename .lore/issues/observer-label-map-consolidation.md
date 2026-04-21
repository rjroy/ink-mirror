---
title: "Consolidate dimension-to-label mapping into @ink-mirror/shared"
date: 2026-04-21
status: open
priority: medium
type: refactor
origin: .lore/brainstorm/observer-dimension-extension-20260420.md
tags: [refactor, observer, shared-package, label-map]
related:
  - .lore/brainstorm/observer-dimension-extension-20260420.md
  - .lore/specs/observer-paragraph-structure.md
---

# Consolidate dimension-to-label mapping into `@ink-mirror/shared`

## Problem

The dimension-to-label mapping lives in three places. Every dimension addition requires touching all three, and the CLI does not reference the daemon's constant.

- `packages/daemon/src/profile-store.ts:45-49` — `DIMENSION_LABELS` (the only one named as such).
- `packages/cli/src/profile.ts:40-44` — inline `labels` record inside `showProfile`.
- `packages/cli/src/profile.ts:147-151` — inline `labels` record inside `buildProfileMarkdown`.

All three hold the same key-to-label mapping, updated independently. Drift is silent: if one site gets a new dimension and another doesn't, the lagging site falls back to the raw dimension key (`paragraph-structure`) instead of the human label (`Paragraph Structure`).

The brainstorm's Section 4 "Prompt-only vs. Structural" analysis flagged this as a hidden cost of dimension expansion and Section "Open Threads" named it as the first follow-up.

## Proposed shape

Promote the label map to `@ink-mirror/shared`, colocated with `ObservationDimensionSchema` in `packages/shared/src/observations.ts`. A single exported constant like `DIMENSION_LABELS: Record<ObservationDimension, string>` (with the type parameter enforcing exhaustiveness) replaces all three sites. The daemon `profile-store.ts` and both CLI sites import and reference it.

Exhaustiveness matters: using `Record<ObservationDimension, string>` (not `Record<string, string>`) makes adding a new dimension a TypeScript error until the label is filled in. This is the whole point of consolidating — moving drift-catching from human discipline to the type checker.

## Why now (trigger)

Before the dimension set grows past 4. The spec at `.lore/specs/observer-paragraph-structure.md` lands dimension 4 (`paragraph-structure`) by updating all three sites in place. Dimension 5 would triple the maintenance cost without this refactor. The brainstorm's Section 6 explicitly sequences this: "if this expansion feels smooth, the duplicated label map becomes a simplification opportunity."

The refactor is not a blocker for the paragraph-structure spec. It is the follow-up that should land before `vocabulary-register` or `tonal-markers` are implemented.

## Scope

- Add exported `DIMENSION_LABELS` to `packages/shared/src/observations.ts`.
- Update `packages/daemon/src/profile-store.ts` to import and use it (drop the local constant).
- Update both `packages/cli/src/profile.ts` sites (`showProfile` and `buildProfileMarkdown`) to import and use it (drop both inline records).
- Update relevant tests (daemon `profile-store.test.ts`, any CLI tests that assert label rendering) so import paths resolve.
- No runtime behavior change. Same labels, same rendering, just one source.

Out of scope: changing label text, adding translations, moving any other dimension metadata into shared.

## Reference

- Full motivation and cost analysis: `.lore/brainstorm/observer-dimension-extension-20260420.md` Section 4 ("Prompt-only vs. Structural"), Section 6 ("Recommended Next Move"), and "Open Threads" first bullet.
- First dimension addition using all three sites in place: `.lore/specs/observer-paragraph-structure.md` Section 4 "Touch Points".
