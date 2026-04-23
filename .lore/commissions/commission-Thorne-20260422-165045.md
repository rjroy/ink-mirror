---
title: "Commission: Phase 3B: Review nudge route persistence"
date: 2026-04-22
status: completed
tags: [commission]
worker: Thorne
workerDisplayTitle: "Guild Warden"
prompt: "Review Phase 3A of the nudge persistence build. This is the gating review before fan-out to CLI and web phases.\n\nSpec: `.lore/specs/craft-nudge-persistence.md`\nPlan: `.lore/plans/craft-nudge-persistence.md` (see \"Commission 3B — Review: route integration\")\n\nCross-check `packages/daemon/src/routes/nudge.ts`, `packages/daemon/src/index.ts`, and `packages/daemon/tests/routes/nudge.test.ts` against REQ-CNP-3 through REQ-CNP-11, REQ-CNP-17, REQ-CNP-18. Use the 3B review checklist in the plan.\n\nPay particular attention to:\n- `stale` emission rules (only cache, only on mismatch)\n- `error` field only on fresh responses\n- Direct-text path never touches store (mechanical verification)\n- Empty-context normalization\n- Store save failure does not fail the request\n\nFlag anything the web phase (Phase 5) will need to work around.\n\nCapture findings in commission result body."
dependencies:
  - commission-Dalton-20260422-165038
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-04-22T23:50:45.081Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-04-22T23:50:45.082Z
    event: status_blocked
    reason: "Dependencies not satisfied"
    from: "pending"
    to: "blocked"
  - timestamp: 2026-04-23T00:09:56.236Z
    event: status_pending
    reason: "Dependencies satisfied"
    from: "blocked"
    to: "pending"
  - timestamp: 2026-04-23T00:09:56.240Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
  - timestamp: 2026-04-23T00:09:56.258Z
    event: status_in_progress
    reason: "Execution started"
    from: "dispatched"
    to: "in_progress"
  - timestamp: 2026-04-23T00:10:05.903Z
    event: progress_report
    reason: "Starting Phase 3A review. Loading spec, plan, and target files."
  - timestamp: 2026-04-23T00:11:52.909Z
    event: progress_report
    reason: "Review complete. All targeted requirements satisfied. Four minor findings to report; no blocking issues for fan-out."
  - timestamp: 2026-04-23T00:12:40.352Z
    event: result_submitted
    reason: "# Phase 3A Review: Nudge Route Persistence\n\n**Verdict: PASS.** Phase 3A satisfies REQ-CNP-3 through REQ-CNP-11, REQ-CNP-17, and REQ-CNP-18. Fan-out to Phases 4 and 5 can proceed. No 3C fix commission is required. Four minor observations are recorded below; none gate downstream work.\n\n## Requirements coverage\n\n| Req | Satisfied | Evidence |\n|-----|-----------|----------|\n| REQ-CNP-3 | Yes | `isEntryScoped = !parsed.data.text && !!parsed.data.entryId` gates all persistence. Direct-text branch at `routes/nudge.ts:91-100` has no store access. |\n| REQ-CNP-4 | Yes | `routes/nudge.ts:117-127`. Cache hit returns `source: \"cache\"`, `generatedAt`, `contentHash`; no `stale` key. Test case 2. |\n| REQ-CNP-5 | Yes | `routes/nudge.ts:130-138`. Stale path sets `stale: true` without mutating `existing`. Test case 3 asserts `store.records.get(...)` still equals the original record. |\n| REQ-CNP-6 | Yes | Fresh branch at `routes/nudge.ts:142-181` runs `nudge`, builds `record`, saves, returns `source: \"fresh\"`. Test case 1. |\n| REQ-CNP-7 | Yes | `routes/nudge.ts:146-155` returns before `save`. Test case 9 asserts `store.saveCalls === 0` and next call retries. |\n| REQ-CNP-8 | Yes (schema-level; verified via tests in Phase 1, re-used here) | `NudgeRequestSchema.refresh: z.boolean().optional()`. |\n| REQ-CNP-9 | Yes | `if (!parsed.data.refresh)` at `routes/nudge.ts:111` bypasses cache read on refresh. Test case 6. |\n| REQ-CNP-10 | Yes | Direct-text branch at `routes/nudge.ts:91-100` runs regardless of `refresh`. Tests 8 and 13. |\n| REQ-CNP-11 | Yes | `nudgeStore.save` overwrites; no history mechanism. Test case 6 verifies overwrite. |\n| REQ-CNP-17 | Yes | `NudgeDeps.nudgeStore` added at `routes/nudge.ts:15`. Wiring at `index.ts:8, 24, 29, 103`. |\n| REQ-CNP-18 | Yes | Entry-ID regex guard at `routes/nudge.ts:67` runs before `readEntry` and before any nudge-store call. Test case 10 confirms 400 + `store.getCalls === 0`. |\n\n## AI Validation checks\n\n- **Direct-text never persists, even when save would throw:** Verified. Test 13 sets `saveShouldThrow = true` and asserts `store.saveCalls === 0`.\n- **`refresh: true` overwrites but does not append:** Verified. Test 6 asserts the post-refresh record's `contentHash` and `nudges[0].craftPrinciple` match the new result, not the seeded old values.\n\n## Findings\n\n### F1 — WARN: `refresh: true` + hash-matching saved record is not tested\n\n**Where:** `packages/daemon/tests/routes/nudge.test.ts` case 6.\n\n**Observation:** Case 6 seeds the store with `contentHash: sha(\"OLD\")` while the resolved text is `SAMPLE_TEXT`, so the hashes differ. Without `refresh`, this request would hit the stale-cache branch. The test asserts `source === \"fresh\"` and `spy.calls === 1` after passing `refresh: true`, which proves fresh runs *on top of a differing-hash record*. It does not prove that `refresh: true` bypasses the cache when the hashes match.\n\n**Why it matters:** The user's primary \"Regenerate\" gesture is most likely pressed when the entry has NOT changed (they want a different nudge from the same text). The code path is correct (`if (!parsed.data.refresh)` guards the entire cache branch), but the test matrix does not exercise it.\n\n**Suggested action:** Add a test that seeds the store with `contentHash: sha(SAMPLE_TEXT)` and submits `{ entryId: \"entry-001\", refresh: true }`. Assert `source === \"fresh\"`, `spy.calls === 1`, `store.saveCalls === 1`, and the saved record's `generatedAt` equals `FIXED_NOW` (distinct from the pre-seeded timestamp).\n\n### F2 — INFO: Dead type-narrowing guard at `routes/nudge.ts:104-107`\n\n**Where:** \n\n```ts\nconst entryId = parsed.data.entryId;\nif (!entryId) {\n  return c.json({ error: \"At least one of entryId or text is required\" }, 400);\n}\n```\n\n**Observation:** Unreachable at runtime. `isEntryScoped === true` implies `parsed.data.entryId` is truthy. The comment acknowledges this is for the type checker.\n\n**Why it matters:** Minor. A future reader could waste time reasoning about when this 400 could fire. A non-null assertion with a one-line comment would signal intent more directly.\n\n**Suggested action:** Optional. Replace with `const entryId = parsed.data.entryId!;` plus a brief `// isEntryScoped guarantees presence` comment, or leave as is.\n\n### F3 — INFO: Empty-string `text` with `entryId` is treated as entry-scoped\n\n**Where:** `routes/nudge.ts:57` — `isEntryScoped = !parsed.data.text && !!parsed.data.entryId`.\n\n**Observation:** `!\"\"` is `true`, so `{ entryId: \"entry-x\", text: \"\" }` enters the entry-scoped branch and reads the entry from storage. The schema refine at `packages/shared/src/nudge.ts:50` also treats `text: \"\"` as \"not provided\" (`data.entryId || data.text`), so the two surfaces are self-consistent.\n\n**Why it matters:** The spec says \"If `text` is provided directly (with or without `entryId`), the route runs fresh.\" A literal reading could expect `text: \"\"` + `entryId` to fail or run direct. The implementation treats `\"\"` as absent, which is internally coherent and has no practical failure mode (an empty string is not meaningful nudge input). Worth naming so no one re-litigates it later.\n\n**Suggested action:** None required. Document-only if desired.\n\n### F4 — INFO (Phase 5 heads-up): Refresh + LLM parse failure leaves the prior record intact\n\n**Where:** `routes/nudge.ts:146-155`.\n\n**Observation:** Correct per REQ-CNP-7 (error never persists) combined with REQ-CNP-9 (\"if the LLM result parses successfully\" in the plan). When the user clicks Regenerate and the LLM errors:\n\n1. Response is `source: \"fresh\"`, `error: \"...\"`, `contentHash: hash`.\n2. The previously saved record is NOT overwritten.\n3. A subsequent non-refresh click on an unchanged body returns `source: \"cache\"` from the OLD record — no `stale`, no indication a refresh was ever attempted.\n\n**Why it matters for Phase 5:** The web client needs to treat a fresh-with-error response as a failed regenerate and probably keep the prior Saved label visible (since the saved record on disk is still valid). If the client eagerly replaces component state with the error response's `generatedAt`/`contentHash`, the user would see a \"Saved <now>\" label for a nudge that was actually rejected, followed by the old nudges re-appearing on a subsequent plain click. Handle the `error` case by preserving the prior display rather than overwriting it.\n\n**Suggested action:** Call out in the Phase 5 commission prompt that `response.error` on a fresh refresh must not replace the Saved label or cached display. The spec's success criteria don't explicitly cover this interaction.\n\n## Phase 5 hand-off notes (per 3B's cross-worker checklist)\n\n- **`stale` is ternary-ish:** emitted only as `true`; absent in all other cases. The schema also permits `false` but the daemon never emits it. Client should treat `!response.stale` as \"not stale,\" not `response.stale === false`.\n- **`error` field:** only on fresh responses. Cache responses provably cannot carry `error` (SavedNudge type has no error field; the save-path short-circuits on parse failure).\n- **`contentHash`:** present on every entry-scoped response (cache hit, cache stale, fresh success, fresh error). Absent only on direct-text. The web client won't traverse direct-text, so it can assume `contentHash` is always present.\n- **`generatedAt`:** always a string (ISO 8601). On cache hits it's the original generation time; on fresh it's `now()`. The spec for the Saved label wants the ORIGINAL time for cache hits — the route returns that correctly.\n\n## Artifacts reviewed\n\n- `.lore/specs/craft-nudge-persistence.md`\n- `.lore/plans/craft-nudge-persistence.md` (3A scope, 3B checklist)\n- `packages/daemon/src/routes/nudge.ts`\n- `packages/daemon/src/index.ts`\n- `packages/daemon/tests/routes/nudge.test.ts`\n- `packages/shared/src/nudge.ts` (schema sanity cross-check)\n\nNo defects block fan-out. Recommend dispatching Phase 4 and Phase 5 in parallel. Findings F1–F4 are for record; F1 is the only one worth queuing a follow-up for, and at the reader's discretion."
  - timestamp: 2026-04-23T00:12:45.637Z
    event: status_completed
    reason: "Execution completed"
    from: "in_progress"
    to: "completed"
current_progress: "Review complete. All targeted requirements satisfied. Four minor findings to report; no blocking issues for fan-out."
projectName: ink-mirror
---
# Phase 3A Review: Nudge Route Persistence

**Verdict: PASS.** Phase 3A satisfies REQ-CNP-3 through REQ-CNP-11, REQ-CNP-17, and REQ-CNP-18. Fan-out to Phases 4 and 5 can proceed. No 3C fix commission is required. Four minor observations are recorded below; none gate downstream work.

## Requirements coverage

| Req | Satisfied | Evidence |
|-----|-----------|----------|
| REQ-CNP-3 | Yes | `isEntryScoped = !parsed.data.text && !!parsed.data.entryId` gates all persistence. Direct-text branch at `routes/nudge.ts:91-100` has no store access. |
| REQ-CNP-4 | Yes | `routes/nudge.ts:117-127`. Cache hit returns `source: "cache"`, `generatedAt`, `contentHash`; no `stale` key. Test case 2. |
| REQ-CNP-5 | Yes | `routes/nudge.ts:130-138`. Stale path sets `stale: true` without mutating `existing`. Test case 3 asserts `store.records.get(...)` still equals the original record. |
| REQ-CNP-6 | Yes | Fresh branch at `routes/nudge.ts:142-181` runs `nudge`, builds `record`, saves, returns `source: "fresh"`. Test case 1. |
| REQ-CNP-7 | Yes | `routes/nudge.ts:146-155` returns before `save`. Test case 9 asserts `store.saveCalls === 0` and next call retries. |
| REQ-CNP-8 | Yes (schema-level; verified via tests in Phase 1, re-used here) | `NudgeRequestSchema.refresh: z.boolean().optional()`. |
| REQ-CNP-9 | Yes | `if (!parsed.data.refresh)` at `routes/nudge.ts:111` bypasses cache read on refresh. Test case 6. |
| REQ-CNP-10 | Yes | Direct-text branch at `routes/nudge.ts:91-100` runs regardless of `refresh`. Tests 8 and 13. |
| REQ-CNP-11 | Yes | `nudgeStore.save` overwrites; no history mechanism. Test case 6 verifies overwrite. |
| REQ-CNP-17 | Yes | `NudgeDeps.nudgeStore` added at `routes/nudge.ts:15`. Wiring at `index.ts:8, 24, 29, 103`. |
| REQ-CNP-18 | Yes | Entry-ID regex guard at `routes/nudge.ts:67` runs before `readEntry` and before any nudge-store call. Test case 10 confirms 400 + `store.getCalls === 0`. |

## AI Validation checks

- **Direct-text never persists, even when save would throw:** Verified. Test 13 sets `saveShouldThrow = true` and asserts `store.saveCalls === 0`.
- **`refresh: true` overwrites but does not append:** Verified. Test 6 asserts the post-refresh record's `contentHash` and `nudges[0].craftPrinciple` match the new result, not the seeded old values.

## Findings

### F1 — WARN: `refresh: true` + hash-matching saved record is not tested

**Where:** `packages/daemon/tests/routes/nudge.test.ts` case 6.

**Observation:** Case 6 seeds the store with `contentHash: sha("OLD")` while the resolved text is `SAMPLE_TEXT`, so the hashes differ. Without `refresh`, this request would hit the stale-cache branch. The test asserts `source === "fresh"` and `spy.calls === 1` after passing `refresh: true`, which proves fresh runs *on top of a differing-hash record*. It does not prove that `refresh: true` bypasses the cache when the hashes match.

**Why it matters:** The user's primary "Regenerate" gesture is most likely pressed when the entry has NOT changed (they want a different nudge from the same text). The code path is correct (`if (!parsed.data.refresh)` guards the entire cache branch), but the test matrix does not exercise it.

**Suggested action:** Add a test that seeds the store with `contentHash: sha(SAMPLE_TEXT)` and submits `{ entryId: "entry-001", refresh: true }`. Assert `source === "fresh"`, `spy.calls === 1`, `store.saveCalls === 1`, and the saved record's `generatedAt` equals `FIXED_NOW` (distinct from the pre-seeded timestamp).

### F2 — INFO: Dead type-narrowing guard at `routes/nudge.ts:104-107`

**Where:** 

```ts
const entryId = parsed.data.entryId;
if (!entryId) {
  return c.json({ error: "At least one of entryId or text is required" }, 400);
}
```

**Observation:** Unreachable at runtime. `isEntryScoped === true` implies `parsed.data.entryId` is truthy. The comment acknowledges this is for the type checker.

**Why it matters:** Minor. A future reader could waste time reasoning about when this 400 could fire. A non-null assertion with a one-line comment would signal intent more directly.

**Suggested action:** Optional. Replace with `const entryId = parsed.data.entryId!;` plus a brief `// isEntryScoped guarantees presence` comment, or leave as is.

### F3 — INFO: Empty-string `text` with `entryId` is treated as entry-scoped

**Where:** `routes/nudge.ts:57` — `isEntryScoped = !parsed.data.text && !!parsed.data.entryId`.

**Observation:** `!""` is `true`, so `{ entryId: "entry-x", text: "" }` enters the entry-scoped branch and reads the entry from storage. The schema refine at `packages/shared/src/nudge.ts:50` also treats `text: ""` as "not provided" (`data.entryId || data.text`), so the two surfaces are self-consistent.

**Why it matters:** The spec says "If `text` is provided directly (with or without `entryId`), the route runs fresh." A literal reading could expect `text: ""` + `entryId` to fail or run direct. The implementation treats `""` as absent, which is internally coherent and has no practical failure mode (an empty string is not meaningful nudge input). Worth naming so no one re-litigates it later.

**Suggested action:** None required. Document-only if desired.

### F4 — INFO (Phase 5 heads-up): Refresh + LLM parse failure leaves the prior record intact

**Where:** `routes/nudge.ts:146-155`.

**Observation:** Correct per REQ-CNP-7 (error never persists) combined with REQ-CNP-9 ("if the LLM result parses successfully" in the plan). When the user clicks Regenerate and the LLM errors:

1. Response is `source: "fresh"`, `error: "..."`, `contentHash: hash`.
2. The previously saved record is NOT overwritten.
3. A subsequent non-refresh click on an unchanged body returns `source: "cache"` from the OLD record — no `stale`, no indication a refresh was ever attempted.

**Why it matters for Phase 5:** The web client needs to treat a fresh-with-error response as a failed regenerate and probably keep the prior Saved label visible (since the saved record on disk is still valid). If the client eagerly replaces component state with the error response's `generatedAt`/`contentHash`, the user would see a "Saved <now>" label for a nudge that was actually rejected, followed by the old nudges re-appearing on a subsequent plain click. Handle the `error` case by preserving the prior display rather than overwriting it.

**Suggested action:** Call out in the Phase 5 commission prompt that `response.error` on a fresh refresh must not replace the Saved label or cached display. The spec's success criteria don't explicitly cover this interaction.

## Phase 5 hand-off notes (per 3B's cross-worker checklist)

- **`stale` is ternary-ish:** emitted only as `true`; absent in all other cases. The schema also permits `false` but the daemon never emits it. Client should treat `!response.stale` as "not stale," not `response.stale === false`.
- **`error` field:** only on fresh responses. Cache responses provably cannot carry `error` (SavedNudge type has no error field; the save-path short-circuits on parse failure).
- **`contentHash`:** present on every entry-scoped response (cache hit, cache stale, fresh success, fresh error). Absent only on direct-text. The web client won't traverse direct-text, so it can assume `contentHash` is always present.
- **`generatedAt`:** always a string (ISO 8601). On cache hits it's the original generation time; on fresh it's `now()`. The spec for the Saved label wants the ORIGINAL time for cache hits — the route returns that correctly.

## Artifacts reviewed

- `.lore/specs/craft-nudge-persistence.md`
- `.lore/plans/craft-nudge-persistence.md` (3A scope, 3B checklist)
- `packages/daemon/src/routes/nudge.ts`
- `packages/daemon/src/index.ts`
- `packages/daemon/tests/routes/nudge.test.ts`
- `packages/shared/src/nudge.ts` (schema sanity cross-check)

No defects block fan-out. Recommend dispatching Phase 4 and Phase 5 in parallel. Findings F1–F4 are for record; F1 is the only one worth queuing a follow-up for, and at the reader's discretion.

## Decisions

**Does Phase 3A satisfy all targeted REQ-CNP-3 through REQ-CNP-11, REQ-CNP-17, REQ-CNP-18?**
Yes. All targeted requirements satisfied. The route's entry-scoped/direct-text bifurcation, hash comparison, context normalization, parse-failure non-persistence, refresh semantics, and store-failure isolation all match the spec. Only minor findings surfaced: a dead type-narrowing guard, one missing test variant, and two Phase 5 behavioral notes.
*Reasoning: Line-by-line cross-check against each requirement. REQ-CNP-3: isEntryScoped=!text && !!entryId correctly gates persistence. REQ-CNP-4: cache hit returns source/generatedAt/contentHash with no stale. REQ-CNP-5: hash OR context mismatch → stale:true, record not mutated (test 3 verifies). REQ-CNP-6: fresh branch saves. REQ-CNP-7: result.error path returns before save (test 9 verifies). REQ-CNP-9/11: overwrite via save. REQ-CNP-10: direct-text + refresh never touches store (tests 8, 13). REQ-CNP-17: nudgeStore in deps, wired in index.ts line 29, 103. REQ-CNP-18: /^entry-[\w-]+$/ guard at line 67 runs before any fs access.*

**Is the store-save failure isolation per AI Validation requirement met?**
Yes, with scope broader than the minimum spec. Test 12 demonstrates save-throws on entry-scoped fresh returns 200; test 13 demonstrates direct-text never invokes save. The try/catch at routes/nudge.ts:169-173 isolates the save failure as the plan prescribed.
*Reasoning: Spec's AI Validation only strictly required direct-text resilience (which is trivially true since save is never called). The implementation extends this to entry-scoped fresh, per the plan's safety argument. The catch logs via console.error and proceeds to return the success payload.*

**Empty-context normalization: can request undefined vs stored empty-string produce a phantom stale?**
No. requestContext = parsed.data.context ?? "" normalizes undefined to "". Saved records always store the normalized value (the route's save path uses the same requestContext). Comparison uses existing.context === requestContext. Test 5 verifies both directions (omitted match "", then "formal" vs "" is stale).
*Reasoning: The only path that writes to disk passes requestContext, which is already normalized. There is no code path where a stored record could have context: undefined. Consistency holds.*
