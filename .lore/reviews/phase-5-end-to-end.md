---
title: "Phase 5 End-to-End Review"
date: 2026-03-27
reviewer: Thorne (Guild Warden)
status: resolved
tags: [review, phase-5, end-to-end, v1]
---

# Phase 5 End-to-End Review

The v1 core loop is architecturally sound. All 11 success criteria pass. All 32 requirements verified as satisfied.

## Findings

### DEFECTS (all fixed)

1. **F-01: Production model contradicts spec cost constraint.**
   `daemon/src/index.ts:44` hardcoded `claude-opus-4-6`. Spec budgets $1.50/month on Sonnet.
   **Fix:** Changed to `claude-sonnet-4-6`.

2. **F-02: CLI profile missing "sentence-structure" label.**
   `cli/src/profile.ts` had two-entry dimension labels maps missing the third dimension.
   **Fix:** Added `"sentence-structure": "Sentence Structure"` to both maps.

3. **F-03: Client API `getEntry()` targets non-existent route.**
   `web/lib/api.ts` exported `getEntry()` calling `/api/entries/${id}`, but no matching route existed.
   **Fix:** Removed the dead function and its test.

### CONCERNS (all addressed)

4. **F-04: Web API proxy routes don't handle daemon-down.**
   All `app/api/*/route.ts` files lacked try/catch.
   **Fix:** Added try/catch to all 7 proxy route handlers, returning 502 with `"Daemon unavailable"`.

5. **F-05: YAML parsing casts without validation.**
   `observation-store.ts` cast dimension/status strings without Zod validation.
   **Fix:** Added `ObservationDimensionSchema.safeParse()` and `CurationStatusSchema.safeParse()` validation. Invalid values now cause the observation to be skipped (returns undefined).

6. **F-06: Contradiction detection has narrow coverage.**
   Known tradeoff per plan. No fix needed.

7. **F-07: Test casts exclude sentence-structure.**
   Test dimension casts used two-member union instead of three.
   **Fix:** Changed casts to use `ObservationDimension` type from shared package. Added full-loop integration test exercising the `sentence-structure` dimension through write -> observe -> curate -> profile.

### Additional fixes

8. **Stale build artifacts shadowing source.**
   Compiled `.js`/`.d.ts` files in `packages/daemon/src/` and `packages/web/tests/` were shadowing `.ts` source files, causing bun to resolve stale code. Cleaned all stale artifacts.

9. **Test command running dist/ tests.**
   `bun test --recursive` picked up compiled test files in `packages/daemon/dist/`. Changed test command to target specific test directories.
