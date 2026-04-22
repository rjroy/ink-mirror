---
title: "Plan: Craft Nudge Persistence"
date: 2026-04-22
status: approved
tags: [plan, craft-nudge, persistence, caching]
modules: [shared, daemon, cli, web]
related:
  - .lore/specs/craft-nudge-persistence.md
  - .lore/specs/craft-nudge.md
  - .lore/plans/craft-nudge.md
---

# Plan: Craft Nudge Persistence

## Spec Reference

**Spec**: `.lore/specs/craft-nudge-persistence.md`

Requirements addressed, per phase:

- **Phase 1 (shared schema)**: REQ-CNP-8, REQ-CNP-12, REQ-CNP-13, REQ-CNP-14 (schema-level)
- **Phase 2 (NudgeStore)**: REQ-CNP-1, REQ-CNP-2, REQ-CNP-15, REQ-CNP-16
- **Phase 3 (route integration)**: REQ-CNP-3 through REQ-CNP-11, REQ-CNP-17, REQ-CNP-18
- **Phase 4 (CLI surface)**: REQ-CNP-19
- **Phase 5 (web surface)**: REQ-CNP-20, REQ-CNP-21

## Dependency Order

```
Phase 1 (shared schema)
   ├── Phase 2 (NudgeStore)       ─┐
   │                                ├── Phase 3 (route)
   │                                │        ├── Phase 4 (CLI op metadata)  [independent, can run parallel to 5]
   │                                │        └── Phase 5 (web surface)
```

Phase 1 is foundational: both Phase 2 (response type references) and Phase 3 (request type references) depend on it, and Phase 5 consumes the new response fields.

Phase 2 and Phase 3 are serial: the route cannot integrate a store that does not exist. Phase 2 review gates must close before Phase 3 begins.

Phase 4 and Phase 5 fan out from Phase 3 and are independent of each other.

**Review gates**: Phase 1 and Phase 2 are shared foundations; each gets a review commission before downstream work begins. Phase 3 gets a review before Phases 4 and 5 fan out because its cache/refresh/stale matrix is load-bearing for the web surface. Phases 4 and 5 each get a single build-then-review, no fan-out downstream.

---

## Phase 1: Shared Schema

### Commission 1A — Build: extend nudge schemas

- **Worker**: Dalton
- **Dependencies**: none
- **Files**:
  - `packages/shared/src/nudge.ts` (edit)
  - `packages/shared/tests/nudge.test.ts` (edit — or create if absent)
- **Scope**:
  - Add `refresh: z.boolean().optional()` to `NudgeRequestSchema`. The existing `.refine()` that requires `entryId || text` must still apply.
  - Extend `NudgeResponseSchema` with:
    - `source: z.enum(["cache", "fresh"])`
    - `stale: z.boolean().optional()`
    - `generatedAt: z.string()` (ISO 8601; no format validation beyond `string`)
    - `contentHash: z.string().optional()`
  - Introduce a new `SavedNudgeSchema` and `SavedNudge` type (the on-disk record):
    - `entryId: string`
    - `contentHash: string` (sha256 hex, prefixed `sha256:` per spec File Format)
    - `context: string` (empty string when absent per REQ-CNP-2)
    - `generatedAt: string` (ISO 8601)
    - `nudges: z.array(CraftNudgeSchema)`
    - `metrics: <same shape as NudgeResponseSchema.metrics>` — factor the metrics object to a named schema (`NudgeMetricsSchema`) to avoid duplication.
  - Export new types and schemas from `packages/shared/src/index.ts` alongside existing nudge exports.
- **Tests** (`packages/shared/tests/nudge.test.ts`):
  - `NudgeRequestSchema` accepts `refresh: true`, `refresh: false`, and omitted `refresh`.
  - `NudgeResponseSchema` accepts a cache response (`source: "cache"`, `stale: true`, `generatedAt`, `contentHash`).
  - `NudgeResponseSchema` accepts a fresh response without `stale` or `contentHash` (direct-text case).
  - `SavedNudgeSchema` round-trips a full record.
- **Verification**:
  ```bash
  bun test packages/shared
  bun run typecheck
  ```
- **Out of scope**: daemon route changes, storage code, web client changes.

### Commission 1B — Review: shared schema

- **Worker**: Thorne
- **Dependencies**: 1A
- **Scope**: Review that schema additions match REQ-CNP-8, REQ-CNP-12, REQ-CNP-13, REQ-CNP-14. Confirm:
  - `refresh` is optional with no default (so route sees `undefined` and treats as false).
  - `stale` is optional (omitted except in one case per REQ-CNP-13).
  - `contentHash` is optional (omitted for direct-text per REQ-CNP-12).
  - `source` is a strict enum.
  - Metrics schema is factored so both `NudgeResponseSchema` and `SavedNudgeSchema` reference the same definition (avoids drift).
  - Barrel export in `packages/shared/src/index.ts` is complete.
- **No bash execution needed**; review by reading.

---

## Phase 2: NudgeStore

### Commission 2A — Build: NudgeStore

- **Worker**: Dalton
- **Dependencies**: 1A, 1B
- **Files**:
  - `packages/daemon/src/nudge-store.ts` (new)
  - `packages/daemon/tests/nudge-store.test.ts` (new)
- **Scope**: Mirror the style of `packages/daemon/src/observation-store.ts`:
  - `NudgeStoreFs` interface: `readFile`, `writeFile`, `mkdir` (no `readdir` — there is no `list`). Do not include methods the store does not need.
  - `NudgeStore` interface:
    - `get(entryId: string): Promise<SavedNudge | undefined>`
    - `save(entryId: string, record: SavedNudge): Promise<void>`
  - `NudgeStoreDeps`: `{ nudgesDir: string; fs?: NudgeStoreFs }`. No `now?` — the route is responsible for populating `generatedAt` on the record before calling `save` (this keeps the store a dumb persistence layer, consistent with the spec treating the record as a closed value).
  - Hand-rolled YAML via a `toYaml(record)` helper. Fields in stable order: `entryId`, `contentHash`, `context` (block literal), `generatedAt`, `metrics` (nested mapping), `nudges` (sequence of mappings, each with `craftPrinciple` scalar then `evidence`, `observation`, `question` as `|` block literals). Mirror `observation-store.ts:41-56` indentation conventions.
  - `fromYaml(content)` parser that returns `SavedNudge | undefined` on malformed content. Must not throw. Accept both block-literal and simple-quoted scalars for string fields, per spec's resilience note.
  - `save` calls `fs.mkdir(nudgesDir, { recursive: true })` before `writeFile`, matching `observation-store.ts:154`.
  - `get` catches filesystem errors and returns `undefined`, matching `observation-store.ts:195-205`.
  - A `realFs` default binding using `node:fs/promises`, same pattern as `observation-store.ts:109-117` (minus `readdir`).
  - Factory function `createNudgeStore(deps)` returning the `NudgeStore` implementation.
- **Tests** (`packages/daemon/tests/nudge-store.test.ts`), using in-memory fs fake — same pattern as `observation-store.test.ts`:
  - `save` + `get` round trip for a full record including multi-line `evidence` and `observation`.
  - `get` returns `undefined` when no file exists for the entry.
  - `save` creates `nudgesDir` if it does not exist.
  - YAML serialization preserves multiline fields via `|` block literal.
  - `fromYaml` returns `undefined` on malformed content (missing required field, bad indentation).
  - Empty `context` round-trips correctly.
  - Multiple saves for the same entry overwrite (no append, no history).
- **Verification**:
  ```bash
  bun test packages/daemon/tests/nudge-store.test.ts
  bun run typecheck
  bun run lint
  ```
- **Out of scope**: route integration, daemon wiring, computing hashes (hash computation lives in the route per spec Hash function note: "compute it on every request to check staleness").

### Commission 2B — Review: NudgeStore

- **Worker**: Thorne
- **Dependencies**: 2A
- **Scope**: Read `nudge-store.ts` and its test file against REQ-CNP-1, REQ-CNP-2, REQ-CNP-15, REQ-CNP-16 and the File Format section of the spec. Confirm:
  - The `NudgeStoreFs` surface is minimal (no `readdir` since no `list`).
  - `get` does not throw on missing file.
  - `save` does not throw on missing directory (calls `mkdir` first).
  - YAML layout matches the spec's example file format, including `contentHash: sha256:…` prefix.
  - Tests cover the malformed-file case (REQ-CNP-7 depends on this tolerance).
  - Style parity with `observation-store.ts` (naming, error handling, fs abstraction).
- **No bash execution needed**.

---

## Phase 3: Route Integration

This is the load-bearing phase. It wires the cache, refresh, stale detection, hash comparison, and direct-text bypass into `POST /nudge`.

### Commission 3A — Build: nudge route persistence

- **Worker**: Dalton
- **Dependencies**: 1A, 1B, 2A, 2B
- **Files**:
  - `packages/daemon/src/routes/nudge.ts` (edit)
  - `packages/daemon/src/index.ts` (edit)
  - `packages/daemon/tests/routes/nudge.test.ts` (edit — extend existing)
- **Scope**:
  1. **Deps**: Add `nudgeStore: NudgeStore` to `NudgeDeps`. Add `now?: () => string` and `hashFn?: (s: string) => string` to `NudgeDeps` for test injection. Defaults: `() => new Date().toISOString()` and `(s) => "sha256:" + crypto.createHash("sha256").update(s).digest("hex")` using `node:crypto`.
  2. **Route logic** in the existing `POST /nudge` handler, after the parse/validate/text-resolution block (current `routes/nudge.ts:40-54`):

     Decide the path by a single boolean `isEntryScoped = !parsed.data.text && !!parsed.data.entryId`. Everything about persistence is gated on this.

     - **Direct text path** (`!isEntryScoped`): Call `nudge(...)` as today. Build the response with `source: "fresh"`, `generatedAt: now()`. Omit `contentHash` and `stale`. The `refresh` field is accepted but ignored here (REQ-CNP-10).
     - **Entry-scoped path** (`isEntryScoped`):
       - Compute `hash = hashFn(text)` (text here is the body already loaded from `entryStore` via `readEntry`).
       - Let `requestContext = parsed.data.context ?? ""`.
       - If `!parsed.data.refresh`, call `nudgeStore.get(parsed.data.entryId)`. If a record exists:
         - If `record.contentHash === hash && record.context === requestContext`: return `{ nudges, metrics, source: "cache", generatedAt: record.generatedAt, contentHash: record.contentHash }` (REQ-CNP-4). No `error` field even if one was saved; stored records never contain errors per REQ-CNP-7, so this is moot but worth a comment.
         - Else (hash or context differs): return `{ nudges: record.nudges, metrics: record.metrics, source: "cache", stale: true, generatedAt: record.generatedAt, contentHash: record.contentHash }` (REQ-CNP-5). Do not mutate the record.
       - If `refresh: true` or no saved record exists: call `nudge(...)`. On a clean result (no `result.error`), build the record:
         ```ts
         const record: SavedNudge = {
           entryId: parsed.data.entryId,
           contentHash: hash,
           context: requestContext,
           generatedAt: now(),
           nudges: result.nudges,
           metrics: result.metrics,
         };
         await nudgeStore.save(parsed.data.entryId, record);
         ```
         Return `{ nudges: result.nudges, metrics: result.metrics, source: "fresh", generatedAt: record.generatedAt, contentHash: record.contentHash }`.
       - If `result.error` is set (parse failure): do **not** save (REQ-CNP-7). Return `{ nudges: result.nudges, metrics: result.metrics, source: "fresh", generatedAt: now(), contentHash: hash, error: result.error }`. `contentHash` is still present because the request was entry-scoped (REQ-CNP-12).
  3. **Store save failure isolation**: Wrap `nudgeStore.save` in try/catch. On failure, log and continue — the response must still succeed per the spec's AI Validation note ("a test that exercises the direct-text path must pass a store whose `save` throws; the request must still succeed"). Note: the spec only requires this for direct-text, but applying it to the entry-scoped fresh path as well is safer: a disk error should not fail the user's nudge. Log via `console.error` consistent with existing patterns.
  4. **Entry ID guard**: The existing `^entry-[\w-]+$` check at `routes/nudge.ts:46` already satisfies REQ-CNP-18. Leave it in place. No additional validation needed before the store call — the regex already ensures the filename is safe.
  5. **Operations metadata**: Add a `refresh` parameter to the `nudge.analyze` operation definition (see Phase 4 — keep the build scope here minimal, but include the param since the operation definition is in the same file and splitting it would create a merge hazard). Tag the parameter `required: false, type: "boolean"`, description "Force fresh generation and overwrite saved nudge".
  6. **Wiring** in `packages/daemon/src/index.ts`:
     - Add `const NUDGES_DIR = join(DATA_DIR, "nudges");` near line 22.
     - Import `createNudgeStore` from `./nudge-store.js`.
     - Construct `const nudgeStore = createNudgeStore({ nudgesDir: NUDGES_DIR });` near line 26.
     - Pass `nudgeStore` into `createNudgeRoutes({ ... })` at line 92.
- **Tests** (`packages/daemon/tests/routes/nudge.test.ts`), covering the Test Plan matrix from the spec. Use the route factory's DI to inject:
  - A fake `sessionRunner` with a spy to assert it was/was not called.
  - A fake `nudgeStore` backed by an in-memory map (or Dalton's preferred test double pattern — match how other route tests do it).
  - Injected `now` returning a fixed ISO string; injected `hashFn` returning `"sha256:" + text.length` or similar deterministic stand-in for readability in assertions.

  Required test cases (each is one test):
  1. First call on an entry → `source: "fresh"`, `sessionRunner.run` called once, `nudgeStore.save` called with the expected record, `contentHash` present.
  2. Second call, same entry, unchanged body and context → `source: "cache"`, `sessionRunner.run` NOT called, no `stale` field, `generatedAt` matches the saved record.
  3. Second call, same entry, changed body → `source: "cache"`, `stale: true`, `sessionRunner.run` NOT called, saved record unchanged (read after to confirm).
  4. Second call, same entry, same body, different context → `source: "cache"`, `stale: true`, `sessionRunner.run` NOT called.
  5. Cached-empty-context vs. request-with-context (or vice versa) → `stale: true`. This catches the empty-string vs. undefined normalization path.
  6. Third call with `refresh: true` → `source: "fresh"`, `sessionRunner.run` called once, saved record overwritten with new `contentHash` and `generatedAt`.
  7. Direct text (no `entryId`) → `source: "fresh"`, no `contentHash` in response, `nudgeStore.get`/`save` both untouched.
  8. Direct text with `refresh: true` → `source: "fresh"`, no store side effect, no error.
  9. LLM parse failure on entry-scoped path → response includes `error`, `source: "fresh"`, `nudgeStore.save` NOT called; subsequent call with unchanged text runs fresh again (no stale cache of the bad result).
  10. Invalid entry ID format → 400, store not touched.
  11. Entry not found (`readEntry` returns undefined) → 404, store not touched.
  12. Store `save` throws on entry-scoped fresh path → response still 200 with `source: "fresh"` and nudge payload. Log side effect is implementation detail, not required to assert.
  13. Store `save` throws on direct-text path → this cannot trigger (direct-text never calls save), but assert `save` is not called regardless of the store's behavior.
  14. Hash determinism: a unit-level test of the hash helper (or, if `hashFn` is injected and private, a sanity assertion that two `SHA-256` calls over the same string return the same hex).
- **Verification**:
  ```bash
  bun test packages/daemon
  bun run typecheck
  bun run lint
  ```
- **Out of scope**: CLI operation wiring beyond the parameter add (that is Phase 4's review concern), web client changes.

### Commission 3B — Review: route integration

- **Worker**: Thorne
- **Dependencies**: 3A
- **Scope**: Cross-check route against REQ-CNP-3 through REQ-CNP-11, REQ-CNP-17, REQ-CNP-18 and the AI Validation notes. Specifically:
  - Persistence side effects occur only on the entry-scoped path (REQ-CNP-3).
  - `stale` is only set with `source: "cache"` and only when hash OR context differs (REQ-CNP-5, REQ-CNP-13).
  - Parse failures never persist (REQ-CNP-7).
  - `refresh: true` overwrites without history (REQ-CNP-9, REQ-CNP-11).
  - `refresh: true` on direct-text does not error and does not persist (REQ-CNP-10).
  - `contentHash` present/absent pattern matches REQ-CNP-12 in all response shapes.
  - `error` field is only on fresh responses (REQ-CNP-14) — no spec case produces `error` on a cache response, but confirm no code path can emit one.
  - Store save failure does not fail the request.
  - Empty `context` normalization is consistent (request `undefined` vs. stored `""` does not create phantom `stale`).
- **Cross-worker note**: This is the last review gate before fan-out. Flag anything that Phase 5 (web) would need to work around.
- **No bash execution needed**; review by reading tests and source.

### Commission 3C — Fix: route integration (conditional)

- **Worker**: Dalton
- **Dependencies**: 3B (only dispatched if 3B surfaces findings)
- **Scope**: Address all Thorne findings from 3B, WARN-level included. Re-run verification commands.
- **Out of scope**: any change beyond the surfaced findings.

---

## Phase 4: CLI Surface

CLI changes are trivial — one parameter in the operation definition — and are already partially landed in Phase 3 to avoid merge hazard. This phase confirms discovery works end-to-end.

### Commission 4A — Build: confirm CLI discovery of `refresh`

- **Worker**: Dalton
- **Dependencies**: 3C (or 3B if no fix needed)
- **Files**:
  - `packages/cli/tests/*` (extend if a help-tree test exists; otherwise, no test file change)
  - No executor changes per REQ-CNP-19 and spec Re-run Override note.
- **Scope**:
  - Confirm the `refresh` parameter added in Phase 3 surfaces in the help tree. If the CLI package has a help-tree snapshot or integration test, update its fixture.
  - Document in the commit message that CLI refresh invocation is positional-only (`nudge analyze <entryId> "" "" true`) and that named flags are out of scope per spec Exit Points.
- **Verification**:
  ```bash
  bun run --filter '@ink-mirror/cli' start
  # Manually: invoke help for `nudge analyze` and confirm `refresh` is listed with type boolean.
  bun test packages/cli
  bun run typecheck
  ```
- **Out of scope**: executor-level named-flag support (spec Exit Point), any UX improvements beyond surfacing the param.

### Commission 4B — Review: CLI surface

- **Worker**: Thorne
- **Dependencies**: 4A
- **Scope**: Confirm the operation definition's `refresh` parameter renders in help output and the CLI can pass it through positionally. Verify no executor-level changes were made. Short review.
- **No bash execution needed**.

---

## Phase 5: Web Surface

Independent of Phase 4. Can run in parallel with Phase 4A/4B once Phase 3 closes.

### Commission 5A — Build: web client persistence UX

- **Worker**: Dalton
- **Dependencies**: 3C (or 3B if no fix needed)
- **Files**:
  - `packages/web/lib/api.ts` (edit)
  - `packages/web/components/entry-nudge.tsx` (edit)
  - `packages/web/components/entry-nudge.module.css` (edit — new styles for Saved label, Regenerate button)
  - `packages/web/tests/entry-nudge.test.tsx` (edit or create)
- **Scope**:
  1. **`requestNudge` signature** (`api.ts:91-100`):
     - Extend params with `refresh?: boolean`.
     - Pass it through to the daemon in the JSON body. No other changes.
  2. **`EntryNudge` component** (`entry-nudge.tsx`):
     - There is one interaction: a button click. No `useEffect` mount fetch, no `getSavedNudge` helper, no GET endpoint.
     - State is the last response received: `{ nudges, source, stale, generatedAt }` (plus `error` if present).
     - Before any click: render the "Nudge" button only.
     - On click: POST `requestNudge({ entryId })` (or `{ entryId, refresh: true }` for Regenerate). Use an abort-on-unmount guard so a navigation during the in-flight POST does not call `setState` on an unmounted component.
     - After a click that produced a result (any `source`): render nudges + "Saved {relativeTime(generatedAt)}" label + "Regenerate" button. Append " — entry edited since" to the label when `stale: true`.
     - Cache vs. fresh is invisible to the user — the UI shape is the same; only the label timestamp differs.
     - Preserve existing error handling for `response.error`.
  3. **Styling**: Add classes for the Saved label and Regenerate button. Match existing `nudgeBtn` styling for the Regenerate button.
- **Tests** (`entry-nudge.test.tsx`), using React Testing Library against a mocked `api` module (or via test-only prop injection — match the project's web test conventions):
  - Initial render: "Nudge" button is present, no nudges, no Saved label, no Regenerate button. No network call has been made.
  - First click on an entry with no saved nudge: POSTs without `refresh`, daemon returns `source: "fresh"`, component renders nudges + "Saved …" label + "Regenerate" button.
  - First click on an entry with an existing saved nudge: POSTs without `refresh`, daemon returns `source: "cache"` + `stale: false`, component renders nudges + "Saved …" label + "Regenerate" button.
  - First click on an entry with a stale saved nudge: POSTs without `refresh`, daemon returns `source: "cache"` + `stale: true`, component renders nudges + "Saved … — entry edited since" label + "Regenerate" button.
  - Click "Regenerate": POSTs with `refresh: true`, renders the updated result, Saved label updates to the new `generatedAt`.
  - Component unmount during in-flight POST does not call `setState`.
- **Verification**:
  ```bash
  bun test packages/web
  bun run typecheck
  bun run lint
  bun run dev  # manual spot-check per spec AI Validation runtime testing note
  ```
- **Out of scope**: other entry-view UI changes, profile integration, observer display.

### Commission 5B — Review: web client

- **Worker**: Thorne
- **Dependencies**: 5A
- **Scope**: Review `entry-nudge.tsx` and `api.ts` against REQ-CNP-20, REQ-CNP-21 and the Test Plan's web component section. Confirm:
  - No mount-time fetch and no GET helper. The component does nothing until the user clicks.
  - Pre-click render shows only the "Nudge" button.
  - Post-click render (for any `source`) shows nudges + Saved label + Regenerate button; the stale suffix appears only when `stale: true`.
  - Regenerate click POSTs `refresh: true`.
  - Unmount during fetch does not call `setState` on an unmounted component.
  - Client/daemon divergence watch — per Octavia's operational notes, client rendering paths are the most common bug class. Confirm every response field the daemon can emit is handled.
- **No bash execution needed**.

### Commission 5C — Fix: web client (conditional)

- **Worker**: Dalton
- **Dependencies**: 5B (only dispatched if 5B surfaces findings)
- **Scope**: Address all 5B findings.

---

## Out of Scope (Plan-Wide)

- Nudge history (spec Exit Point).
- CLI named-flag executor support (spec Exit Point).
- Profile-aware invalidation (spec Exit Point).
- Observer changes (spec Out of Scope).
- Streaming (spec Out of Scope).

## Verification Criteria (End of Phase 5)

Drawn from the spec's Success Criteria. All must hold:

- [ ] `{DATA_DIR}/nudges/{entryId}.yaml` is written on first nudge for an entry.
- [ ] Subsequent same-entry calls return `source: "cache"` without calling the LLM.
- [ ] Body change yields `source: "cache"` + `stale: true`; no LLM call.
- [ ] `refresh: true` overwrites the saved nudge and returns `source: "fresh"`.
- [ ] Direct-text requests never touch the nudge store (even when `save` would throw).
- [ ] Web UI serves saved nudges on click without calling the LLM; a "Regenerate" control is present after any result is rendered.
- [ ] Response shape includes `source`, `generatedAt`, `contentHash` (entry-scoped only), `stale` (cache-served drift only).
- [ ] Malformed LLM output is not persisted.
- [ ] All `bun test`, `bun run typecheck`, `bun run lint` pass.
