---
title: "Plan: Observer Dimension Label Map Consolidation"
date: 2026-04-21
status: executed
issue: .lore/issues/observer-label-map-consolidation.md
tags: [plan, refactor, observer, shared-package, label-map]
modules: [shared, daemon, cli]
related:
  - .lore/issues/observer-label-map-consolidation.md
  - .lore/brainstorm/observer-dimension-extension-20260420.md
  - .lore/specs/observer-paragraph-structure.md
---

# Plan: Observer Dimension Label Map Consolidation

## Overview

One commission, no fan-out. Move `DIMENSION_LABELS` from `packages/daemon/src/profile-store.ts` to `packages/shared/src/observations.ts`, then update both CLI sites to import it. The daemon drops its local constant; the CLI drops two inline records. No behavior change — same keys, same strings — but the type tightens from `Record<string, string>` to `Record<ObservationDimension, string>`, which makes future dimension additions a TypeScript error until the label is filled in.

## Codebase Context

Three sites currently hold identical key-to-label mappings:

1. `packages/daemon/src/profile-store.ts:45-50` — `const DIMENSION_LABELS: Record<string, string>` (named constant, weakly typed). The daemon already imports `ObservationDimension` from `@ink-mirror/shared` on line 1.
2. `packages/cli/src/profile.ts:40-45` — inline `labels: Record<string, string>` inside `showProfile`.
3. `packages/cli/src/profile.ts:148-153` — inline `labels: Record<string, string>` inside `buildProfileMarkdown`.

`ObservationDimensionSchema` and its inferred type `ObservationDimension` live in `packages/shared/src/observations.ts:5-12`. This is the right home for the consolidated constant.

**CLI type gap:** The CLI's local `ProfileResponse` interface (line 6-16) types `dimension` as `string`, not `ObservationDimension`. Indexing `Record<ObservationDimension, string>` with a `string` key will produce a TypeScript error. The fix is to update that field's type to `ObservationDimension` and add a type import from `@ink-mirror/shared`. This is a natural part of the refactor, not an expansion of scope.

**Tests:** No test file imports `DIMENSION_LABELS` directly. `profile-store.test.ts` imports only `createProfileStore`, `profileToMarkdown`, `profileFromMarkdown`, `transformToStablePattern`, `patternsMatch` from `../src/profile-store.js`. All label-string assertions in both daemon and CLI tests exercise rendered output, not the constant itself. No test import paths change.

## Order of Operations

Shared first, then daemon, then CLI. `@ink-mirror/shared` has no dependencies on the other packages; daemon and CLI both depend on it. Compiling in this order means each step builds on a complete foundation.

## Steps

### Step 1: Add `DIMENSION_LABELS` to `packages/shared/src/observations.ts`

**After line 12** (the `ObservationDimension` type alias), add:

```typescript
export const DIMENSION_LABELS: Record<ObservationDimension, string> = {
  "sentence-rhythm": "Sentence Rhythm",
  "word-level-habits": "Word-Level Habits",
  "sentence-structure": "Sentence Structure",
  "paragraph-structure": "Paragraph Structure",
};
```

Using `Record<ObservationDimension, string>` enforces exhaustiveness: TypeScript will surface an error here if a new value is added to `ObservationDimensionSchema` without a corresponding label entry. This is the consolidation's core value.

Also add `DIMENSION_LABELS` to `packages/shared/src/index.ts` exports alongside the existing observation exports.

No test changes in shared. The constant is verified through its consumers' tests.

### Step 2: Update daemon `profile-store.ts`

**File:** `packages/daemon/src/profile-store.ts`

1. Add `DIMENSION_LABELS` to the existing import from `@ink-mirror/shared` (line 1):
   ```typescript
   import type { Profile, ProfileRule, ObservationDimension } from "@ink-mirror/shared";
   import { DIMENSION_LABELS } from "@ink-mirror/shared";
   ```
   Or combine into one statement if Dalton prefers. The `type` keyword applies only to the type-only imports.

2. Remove the local `DIMENSION_LABELS` constant (lines 44-50, including the JSDoc comment above it).

All existing usages of `DIMENSION_LABELS` inside the file are unchanged by name, so no further edits required. The type upgrade from `Record<string, string>` to `Record<ObservationDimension, string>` is safe because `ProfileRule.dimension` is already typed as `ObservationDimension` in the shared schema.

### Step 3: Update CLI `profile.ts`

**File:** `packages/cli/src/profile.ts`

1. Add a new import at the top of the file:
   ```typescript
   import type { ObservationDimension } from "@ink-mirror/shared";
   import { DIMENSION_LABELS } from "@ink-mirror/shared";
   ```

2. In the `ProfileResponse` interface (lines 9-14), update `dimension: string` to `dimension: ObservationDimension`. This makes the indexing type-safe and accurately reflects what the daemon actually sends.

3. Remove the inline `labels` record from `showProfile` (lines 40-45).

4. Replace all uses of `labels[dimension]` in `showProfile` with `DIMENSION_LABELS[dimension]`. The existing `?? dimension` fallback becomes logically dead (every valid dimension key is in the map) but is harmless to leave in place. Dalton may remove it for clarity.

5. Remove the inline `labels` record from `buildProfileMarkdown` (lines 148-153).

6. Replace all uses of `labels[dimension]` in `buildProfileMarkdown` with `DIMENSION_LABELS[dimension]`. Same fallback note applies.

### Step 4: Verify

From the project root:

```bash
bun run typecheck   # confirms Record<ObservationDimension, string> exhaustiveness and CLI type fix
bun run lint        # no style violations
bun test            # all label-rendering tests pass unchanged
```

Expected: clean on all three. If typecheck fails on the CLI, confirm `ProfileResponse.rules[].dimension` was updated to `ObservationDimension`. If any label-rendering test fails, a string value drifted — compare the new constant against the removed inline records.

## Out of Scope

Per the issue: no label text changes, no translations, no other dimension metadata moves to shared.

## Verification Criteria

- `DIMENSION_LABELS` is defined in `packages/shared/src/observations.ts` and exported from `packages/shared/src/index.ts`.
- `DIMENSION_LABELS` does not appear in `packages/daemon/src/profile-store.ts` or `packages/cli/src/profile.ts`.
- Type is `Record<ObservationDimension, string>` at its definition site.
- CLI's `ProfileResponse.rules[].dimension` is `ObservationDimension`, not `string`.
- `bun run typecheck`, `bun run lint`, and `bun test` all pass.
