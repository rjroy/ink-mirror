---
title: "Commission: Phase 3A: Build nudge route persistence"
date: 2026-04-22
status: completed
tags: [commission]
worker: Dalton
workerDisplayTitle: "Guild Artificer"
prompt: "Implement Phase 3A of `.lore/plans/craft-nudge-persistence.md`. This is the load-bearing phase.\n\n**FIRST**: Read Thorne's review from commission `commission-Thorne-20260422-165027`. Address ALL findings (must-fix and nice-to-have) before starting Phase 3A work.\n\n**THEN**: Build route integration per the plan's \"Commission 3A — Build: nudge route persistence\".\n\nSpec: `.lore/specs/craft-nudge-persistence.md`\nPlan: `.lore/plans/craft-nudge-persistence.md`\n\nScope:\n- Edit `packages/daemon/src/routes/nudge.ts`: add deps, implement direct-text path and entry-scoped path with cache/refresh/stale/hash logic per plan section 3A.\n- Wire `nudgeStore` in `packages/daemon/src/index.ts` (add NUDGES_DIR, construct store, pass into createNudgeRoutes).\n- Add `refresh` parameter to the `nudge.analyze` operation definition (stays in the same file as the route).\n- Extend `packages/daemon/tests/routes/nudge.test.ts` with all 14 test cases listed in the plan.\n\nCritical points:\n- Persistence side effects only on entry-scoped path (REQ-CNP-3).\n- Parse failures never persist (REQ-CNP-7).\n- Store save failure is isolated: wrap in try/catch, log, do not fail the request.\n- Empty context normalization: `undefined` vs `\"\"` must not create phantom `stale`.\n\nOut of scope: CLI surface beyond the parameter add, web client.\n\nVerify:\n```\nbun test packages/daemon\nbun run typecheck\nbun run lint\n```\n\nAll must pass before reporting complete."
dependencies:
  - commission-Thorne-20260422-165027
linked_artifacts:
  - packages/daemon/src/routes/nudge.ts

  - packages/daemon/src/index.ts
  - packages/daemon/src/nudge-store.ts
  - packages/daemon/tests/routes/nudge.test.ts
  - packages/shared/src/nudge.ts
  - packages/shared/tests/nudge.test.ts
  - packages/daemon/src/index.ts
  - packages/daemon/src/nudge-store.ts
  - packages/daemon/tests/routes/nudge.test.ts
  - packages/shared/src/nudge.ts
  - packages/shared/tests/nudge.test.ts
activity_timeline:
  - timestamp: 2026-04-22T23:50:38.178Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-04-22T23:50:38.179Z
    event: status_blocked
    reason: "Dependencies not satisfied"
    from: "pending"
    to: "blocked"
  - timestamp: 2026-04-23T00:02:15.978Z
    event: status_pending
    reason: "Dependencies satisfied"
    from: "blocked"
    to: "pending"
  - timestamp: 2026-04-23T00:02:15.981Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
  - timestamp: 2026-04-23T00:02:16.000Z
    event: status_in_progress
    reason: "Execution started"
    from: "dispatched"
    to: "in_progress"
  - timestamp: 2026-04-23T00:02:52.834Z
    event: progress_report
    reason: "Thorne 2B review read (APPROVED, 3 nice-to-haves). Reading current route/store/index files now."
  - timestamp: 2026-04-23T00:09:51.911Z
    event: result_submitted
    reason: "\n# Phase 3A Complete — Nudge Route Persistence\n\n**Status:** All Phase 3A verification passes. Thorne 2B findings addressed.\n\n## Verification\n\n- `bun test packages/daemon` → 416 pass, 0 fail (1009 expect calls)\n- `bun run typecheck` → clean\n- `bun run lint` → clean\n\nThree pre-existing failures remain in `packages/web/tests/nudge-route.test.ts` (NudgeResponseSchema fixture tests). They are stale fixtures left over from Phase 1A's schema tightening — they omit the now-required `source` and `generatedAt` fields. Out of Phase 3A scope (web is Phase 5), but should be addressed before Phase 5 fan-out. Confirmed pre-existing via `git stash` test against HEAD.\n\n## Thorne 2B findings addressed\n\n- **Finding 1 (route must populate `generatedAt` before save):** Satisfied in the route — `generatedAt` is computed via `now()` immediately before `record` construction on the fresh entry-scoped path (`routes/nudge.ts:149-157`) and not before. Same ISO string is used in both the stored record and the response so cache reads return the identical timestamp.\n- **Finding 2 (`contentHash` prefix not enforced):** Hardened `SavedNudgeSchema.contentHash` in `packages/shared/src/nudge.ts` to `z.string().regex(/^sha256:[0-9a-f]{64}$/)`. Bad hex now fails persistence validation rather than silently saving. Updated 2 fixture hashes in `packages/shared/tests/nudge.test.ts` to satisfy the tightened format. `NudgeResponseSchema.contentHash` stays permissive (plain string) since the response is consumed, not persisted.\n- **Finding 3 (`emptyRe` dead-code in `readContext`):** Removed. `readStringField`'s `quotedRe` branch already handles `context: \"\"` correctly. Confirmed with `bun test packages/daemon/tests/nudge-store.test.ts` (12/12 pass).\n\n## Build scope delivered\n\n### `packages/daemon/src/routes/nudge.ts` — full rewrite\n\n- Added `nudgeStore`, `now?`, `hashFn?` to `NudgeDeps`. Defaults: `new Date().toISOString()` and `\"sha256:\" + createHash(\"sha256\").update(text).digest(\"hex\")` via `node:crypto`.\n- Single `isEntryScoped = !parsed.data.text && !!parsed.data.entryId` gates all persistence behavior (REQ-CNP-3).\n- **Direct-text path:** runs fresh, no store touch, no `contentHash`. `refresh` is accepted but ignored (REQ-CNP-10).\n- **Entry-scoped path:**\n  - Hash + normalized context (`?? \"\"`) computed before cache check.\n  - `!refresh`: `nudgeStore.get(entryId)`; if present and both `contentHash` and `context` match → `source: \"cache\"`, no `stale`. Else → `source: \"cache\", stale: true`, record not mutated (REQ-CNP-4, REQ-CNP-5).\n  - `refresh: true` or cache miss: run LLM. If `result.error` set → response carries the error, `contentHash` still present (entry-scoped), store not written (REQ-CNP-7). Clean result → build record, `nudgeStore.save` in try/catch, `console.error` on failure but response still 200 (REQ-CNP-9, REQ-CNP-11, plus store-failure isolation).\n- Route always populates `generatedAt = now()` before `save` — Thorne 2B Finding 1 honored.\n- Entry ID regex (`^entry-[\\w-]+$`) unchanged (REQ-CNP-18). Added an explicit `if (!entryId)` guard after the `isEntryScoped` branch to narrow types cleanly without a non-null assertion.\n- Added `refresh` parameter (`type: \"boolean\"`, required false) to `nudge.analyze` operation definition (REQ-CNP-19).\n\n### `packages/daemon/src/index.ts` — wiring\n\n- Added `NUDGES_DIR = join(DATA_DIR, \"nudges\")`.\n- Imported `createNudgeStore`, constructed `const nudgeStore = createNudgeStore({ nudgesDir: NUDGES_DIR });`.\n- Passed into `createNudgeRoutes({ ..., nudgeStore })`.\n\n### `packages/daemon/tests/routes/nudge.test.ts` — 14 persistence test cases + preserved basics\n\nAll 14 plan cases covered, one test per case. Test doubles:\n- `memoryStore()` — in-memory `Map<string, SavedNudge>` with `getCalls`, `saveCalls`, `saveShouldThrow` knobs.\n- `spySessionRunner()` — wraps `createSessionRunner` with a call counter.\n- Injected `now: () => FIXED_NOW` and the default `hashFn` via `sha()` in tests (real SHA-256 so assertions against `createHash(...)` match).\n\nCase highlights:\n1. First call → fresh, `sessionRunner` called, `nudgeStore.save` called, record fields asserted.\n2. Unchanged body/context → cache, no LLM, no stale, saved `generatedAt` returned.\n3. Changed body → cache + stale; `store.records.get()` deep-equals the original record (no mutation).\n4. Changed context → cache + stale.\n5. Empty-context normalization — saved `\"\"` vs request undefined → cache hit (no phantom stale); saved `\"\"` vs request `\"formal\"` → stale.\n6. `refresh: true` → fresh; asserted record.contentHash and record.generatedAt both updated after overwrite.\n7. Direct text → no `contentHash`, `store.getCalls === 0 && store.saveCalls === 0`.\n8. Direct text + `refresh: true` → 200, no error, no store side effect.\n9. Parse failure on entry-scoped → response has `error`, `contentHash` present, `saveCalls === 0`; subsequent call runs fresh again (`spy.calls === 2`), no stale cache of the bad result.\n10. Invalid entry ID `../etc/passwd` → 400, store + LLM untouched.\n11. Entry not found → 404, store + LLM untouched.\n12. `store.save` throws on entry-scoped fresh → 200, `source: \"fresh\"`, nudges in payload (store-failure isolation).\n13. Direct-text never triggers `store.save` even if `saveShouldThrow === true`.\n14. SHA-256 determinism: same input equals, different input differs, format matches `/^sha256:[0-9a-f]{64}$/`.\n\nAdded an operations-metadata test confirming `refresh` is exposed as a boolean with `required: false`.\n\n## Critical guarantees (Phase 3B checklist)\n\n- Persistence only on entry-scoped path: direct-text branch returns before any `nudgeStore.get/save` call.\n- Parse failures never persist: the error-carrying response path returns before the record is built.\n- Store save failure is isolated: try/catch around `save` only; failure logs and returns fresh payload.\n- Empty-context normalization: request `context` is coerced via `?? \"\"` exactly once before comparison, so undefined and `\"\"` both match saved `\"\"`.\n- Cache responses never carry `error`: the cache-branch response object literal has no `error` key, and saved records cannot carry errors (REQ-CNP-7 enforced upstream).\n- `contentHash` in responses: present on every entry-scoped response (cache hit, cache stale, fresh-success, fresh-parse-failure); omitted on direct-text.\n\n## Files touched\n\n- `packages/shared/src/nudge.ts` — tightened `SavedNudgeSchema.contentHash` regex (Thorne 2B Finding 2).\n- `packages/shared/tests/nudge.test.ts` — updated 2 SavedNudge fixture hashes to 64-hex format.\n- `packages/daemon/src/nudge-store.ts` — removed redundant `emptyRe` + misleading comment in `readContext` (Thorne 2B Finding 3).\n- `packages/daemon/src/routes/nudge.ts` — Phase 3A route implementation, operation metadata.\n- `packages/daemon/src/index.ts` — NUDGES_DIR + nudgeStore construction + wiring.\n- `packages/daemon/tests/routes/nudge.test.ts` — 14 persistence test cases (replaces prior single-file test; all prior coverage retained in \"basic handling\" block).\n\n## Handoff to 3B\n\nReady for review. Flagging for Thorne:\n\n1. Web test fixtures in `packages/web/tests/nudge-route.test.ts` are stale (missing `source`/`generatedAt` in 3 `NudgeResponseSchema.safeParse` calls). Pre-existing; should be fixed before Phase 5 or as a tiny follow-up commission.\n2. The `if (!entryId)` guard after `isEntryScoped` checks is type-safety-only — it cannot fire given the boolean's derivation. Intentional over a non-null assertion (eslint prohibits those).\n3. `NudgeResponseSchema.contentHash` remains plain `z.string().optional()` while `SavedNudgeSchema.contentHash` has the regex. Rationale: the regex enforces on-disk hygiene where the daemon is the sole writer; the response type is consumed by downstream callers (web, CLI) and a test double in consumer tests might want a shorter stand-in. Open to moving the regex to the response type if Thorne prefers uniformity.\n"
  - timestamp: 2026-04-23T00:09:56.042Z
    event: status_completed
    reason: "Execution completed"
    from: "in_progress"
    to: "completed"
current_progress: "Thorne 2B review read (APPROVED, 3 nice-to-haves). Reading current route/store/index files now."
projectName: ink-mirror
---

# Phase 3A Complete — Nudge Route Persistence

**Status:** All Phase 3A verification passes. Thorne 2B findings addressed.

## Verification

- `bun test packages/daemon` → 416 pass, 0 fail (1009 expect calls)
- `bun run typecheck` → clean
- `bun run lint` → clean

Three pre-existing failures remain in `packages/web/tests/nudge-route.test.ts` (NudgeResponseSchema fixture tests). They are stale fixtures left over from Phase 1A's schema tightening — they omit the now-required `source` and `generatedAt` fields. Out of Phase 3A scope (web is Phase 5), but should be addressed before Phase 5 fan-out. Confirmed pre-existing via `git stash` test against HEAD.

## Thorne 2B findings addressed

- **Finding 1 (route must populate `generatedAt` before save):** Satisfied in the route — `generatedAt` is computed via `now()` immediately before `record` construction on the fresh entry-scoped path (`routes/nudge.ts:149-157`) and not before. Same ISO string is used in both the stored record and the response so cache reads return the identical timestamp.
- **Finding 2 (`contentHash` prefix not enforced):** Hardened `SavedNudgeSchema.contentHash` in `packages/shared/src/nudge.ts` to `z.string().regex(/^sha256:[0-9a-f]{64}$/)`. Bad hex now fails persistence validation rather than silently saving. Updated 2 fixture hashes in `packages/shared/tests/nudge.test.ts` to satisfy the tightened format. `NudgeResponseSchema.contentHash` stays permissive (plain string) since the response is consumed, not persisted.
- **Finding 3 (`emptyRe` dead-code in `readContext`):** Removed. `readStringField`'s `quotedRe` branch already handles `context: ""` correctly. Confirmed with `bun test packages/daemon/tests/nudge-store.test.ts` (12/12 pass).

## Build scope delivered

### `packages/daemon/src/routes/nudge.ts` — full rewrite

- Added `nudgeStore`, `now?`, `hashFn?` to `NudgeDeps`. Defaults: `new Date().toISOString()` and `"sha256:" + createHash("sha256").update(text).digest("hex")` via `node:crypto`.
- Single `isEntryScoped = !parsed.data.text && !!parsed.data.entryId` gates all persistence behavior (REQ-CNP-3).
- **Direct-text path:** runs fresh, no store touch, no `contentHash`. `refresh` is accepted but ignored (REQ-CNP-10).
- **Entry-scoped path:**
  - Hash + normalized context (`?? ""`) computed before cache check.
  - `!refresh`: `nudgeStore.get(entryId)`; if present and both `contentHash` and `context` match → `source: "cache"`, no `stale`. Else → `source: "cache", stale: true`, record not mutated (REQ-CNP-4, REQ-CNP-5).
  - `refresh: true` or cache miss: run LLM. If `result.error` set → response carries the error, `contentHash` still present (entry-scoped), store not written (REQ-CNP-7). Clean result → build record, `nudgeStore.save` in try/catch, `console.error` on failure but response still 200 (REQ-CNP-9, REQ-CNP-11, plus store-failure isolation).
- Route always populates `generatedAt = now()` before `save` — Thorne 2B Finding 1 honored.
- Entry ID regex (`^entry-[\w-]+$`) unchanged (REQ-CNP-18). Added an explicit `if (!entryId)` guard after the `isEntryScoped` branch to narrow types cleanly without a non-null assertion.
- Added `refresh` parameter (`type: "boolean"`, required false) to `nudge.analyze` operation definition (REQ-CNP-19).

### `packages/daemon/src/index.ts` — wiring

- Added `NUDGES_DIR = join(DATA_DIR, "nudges")`.
- Imported `createNudgeStore`, constructed `const nudgeStore = createNudgeStore({ nudgesDir: NUDGES_DIR });`.
- Passed into `createNudgeRoutes({ ..., nudgeStore })`.

### `packages/daemon/tests/routes/nudge.test.ts` — 14 persistence test cases + preserved basics

All 14 plan cases covered, one test per case. Test doubles:
- `memoryStore()` — in-memory `Map<string, SavedNudge>` with `getCalls`, `saveCalls`, `saveShouldThrow` knobs.
- `spySessionRunner()` — wraps `createSessionRunner` with a call counter.
- Injected `now: () => FIXED_NOW` and the default `hashFn` via `sha()` in tests (real SHA-256 so assertions against `createHash(...)` match).

Case highlights:
1. First call → fresh, `sessionRunner` called, `nudgeStore.save` called, record fields asserted.
2. Unchanged body/context → cache, no LLM, no stale, saved `generatedAt` returned.
3. Changed body → cache + stale; `store.records.get()` deep-equals the original record (no mutation).
4. Changed context → cache + stale.
5. Empty-context normalization — saved `""` vs request undefined → cache hit (no phantom stale); saved `""` vs request `"formal"` → stale.
6. `refresh: true` → fresh; asserted record.contentHash and record.generatedAt both updated after overwrite.
7. Direct text → no `contentHash`, `store.getCalls === 0 && store.saveCalls === 0`.
8. Direct text + `refresh: true` → 200, no error, no store side effect.
9. Parse failure on entry-scoped → response has `error`, `contentHash` present, `saveCalls === 0`; subsequent call runs fresh again (`spy.calls === 2`), no stale cache of the bad result.
10. Invalid entry ID `../etc/passwd` → 400, store + LLM untouched.
11. Entry not found → 404, store + LLM untouched.
12. `store.save` throws on entry-scoped fresh → 200, `source: "fresh"`, nudges in payload (store-failure isolation).
13. Direct-text never triggers `store.save` even if `saveShouldThrow === true`.
14. SHA-256 determinism: same input equals, different input differs, format matches `/^sha256:[0-9a-f]{64}$/`.

Added an operations-metadata test confirming `refresh` is exposed as a boolean with `required: false`.

## Critical guarantees (Phase 3B checklist)

- Persistence only on entry-scoped path: direct-text branch returns before any `nudgeStore.get/save` call.
- Parse failures never persist: the error-carrying response path returns before the record is built.
- Store save failure is isolated: try/catch around `save` only; failure logs and returns fresh payload.
- Empty-context normalization: request `context` is coerced via `?? ""` exactly once before comparison, so undefined and `""` both match saved `""`.
- Cache responses never carry `error`: the cache-branch response object literal has no `error` key, and saved records cannot carry errors (REQ-CNP-7 enforced upstream).
- `contentHash` in responses: present on every entry-scoped response (cache hit, cache stale, fresh-success, fresh-parse-failure); omitted on direct-text.

## Files touched

- `packages/shared/src/nudge.ts` — tightened `SavedNudgeSchema.contentHash` regex (Thorne 2B Finding 2).
- `packages/shared/tests/nudge.test.ts` — updated 2 SavedNudge fixture hashes to 64-hex format.
- `packages/daemon/src/nudge-store.ts` — removed redundant `emptyRe` + misleading comment in `readContext` (Thorne 2B Finding 3).
- `packages/daemon/src/routes/nudge.ts` — Phase 3A route implementation, operation metadata.
- `packages/daemon/src/index.ts` — NUDGES_DIR + nudgeStore construction + wiring.
- `packages/daemon/tests/routes/nudge.test.ts` — 14 persistence test cases (replaces prior single-file test; all prior coverage retained in "basic handling" block).

## Handoff to 3B

Ready for review. Flagging for Thorne:

1. Web test fixtures in `packages/web/tests/nudge-route.test.ts` are stale (missing `source`/`generatedAt` in 3 `NudgeResponseSchema.safeParse` calls). Pre-existing; should be fixed before Phase 5 or as a tiny follow-up commission.
2. The `if (!entryId)` guard after `isEntryScoped` checks is type-safety-only — it cannot fire given the boolean's derivation. Intentional over a non-null assertion (eslint prohibits those).
3. `NudgeResponseSchema.contentHash` remains plain `z.string().optional()` while `SavedNudgeSchema.contentHash` has the regex. Rationale: the regex enforces on-disk hygiene where the daemon is the sole writer; the response type is consumed by downstream callers (web, CLI) and a test double in consumer tests might want a shorter stand-in. Open to moving the regex to the response type if Thorne prefers uniformity.

