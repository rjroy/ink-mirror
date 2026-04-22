---
title: "Craft Nudge Persistence"
date: 2026-04-21
status: approved
tags: [spec, craft-nudge, persistence, caching]
req-prefix: CNP
related:
  - .lore/specs/craft-nudge.md
  - .lore/vision.md
supersedes-requirement: REQ-CN scope line "Storage of nudge results. Nudges are ephemeral."
---

# Spec: Craft Nudge Persistence

## Problem

The nudge runs on demand (unlike the Observer, which runs automatically on entry submission). Every call regenerates the nudge against the LLM. Nothing is saved. This was an intentional early decision (`craft-nudge.md` scope: "Storage of nudge results. Nudges are ephemeral."), but it has proven too ephemeral — users re-open an entry and press Nudge, burning tokens to regenerate guidance they already saw.

The fix: the first nudge for an entry is persisted. Subsequent calls return the saved result. The user can force a fresh run when they want one. The nudge stays on-demand — it still never runs automatically — but the result stops evaporating.

## Current State

The LLM call is the only side effect in the nudge path today. No storage, no hash, no re-use.

- `packages/daemon/src/routes/nudge.ts:23-71` — `POST /nudge` handler. Resolves text (either provided or read from `entryStore` via `readEntry`) and calls `nudge(...)`. No persistence.
- `packages/daemon/src/nudger.ts:38-82` — `nudge(deps, text, context)`. Computes metrics, builds prompts, calls `sessionRunner.run`, parses output. Returns `{ nudges, metrics, error? }`.
- `packages/daemon/src/index.ts:92-100` — Wires `createNudgeRoutes` with `readEntry` pulling from `entryStore`. No nudge store today.
- `packages/shared/src/nudge.ts:57-68` — `NudgeResponseSchema`: `{ nudges, metrics, error? }`. No provenance fields.
- `packages/web/app/api/nudge/route.ts:4-13` — Web proxy; POSTs body through to daemon.
- `packages/web/components/entry-nudge.tsx:9-47` — Client component. Single "Nudge" button, always requests fresh.
- `packages/web/lib/api.ts:91-100` — `requestNudge({ text?, entryId?, context? })`. No refresh affordance.
- `packages/cli/src/executor.ts:8-75` — Generic executor; CLI surface is whatever `help` publishes. There is no nudge-specific CLI code; the invocation is `nudge analyze` with positional args mapped from `parameters`.

Observations, by contrast, already persist. `packages/daemon/src/observation-store.ts:147-226` stores one YAML file per observation under `observations/`, keyed by observation ID, with `entryId` as a field. The nudge store proposed below is the parallel pattern — with a different key (one file per entry, not one per finding) because nudges are 1:N with entries rather than N:M.

## Proposed Design

### Scope

Nudge persistence applies only when the request targets an entry (`entryId` provided, `text` omitted). Direct-text requests (`text` provided without `entryId`, or `text` overriding `entryId`) run fresh and are never cached. The cache key is the entry ID; there is no meaningful key for ad-hoc text.

The nudge remains on-demand. This spec changes what happens on the second call, not on the first.

### Storage Location (Open Question 1)

**Decision:** Add a new `nudges/` directory under the daemon data root, parallel to `entries/` and `observations/`. One YAML file per entry, named by entry ID: `nudges/{entryId}.yaml`.

Rationale:

- **Parallel to observations.** The existing pattern for "derived artifacts about an entry" is a sibling directory of sidecar YAML. Readers already know where to look.
- **Deterministic lookup.** One file per entry means `get(entryId)` is a direct read, no scan.
- **Keeps entry files clean.** Entry markdown stays human-readable for the writer. We do not bloat the entry's frontmatter with 3–5 multiline nudge blocks.
- **Human-readable, file-based.** Same YAML conventions as `observation-store.ts`.

Rejected alternatives:

- **Frontmatter in the entry file.** Nudges carry multiline `evidence`, `observation`, and `question` fields. Inlining 3–5 of them balloons the frontmatter and makes the entry file awkward to read. Entries are the writer's content; nudges are cache.
- **Sidecar next to the entry (`entries/{id}.nudge.yaml`).** Mixes content and cache in one directory. `list()` on entries has to filter by extension. Small cost, but gains nothing over a dedicated directory.

### Invalidation (Open Question 2)

**Decision:** Option (c). Tag the saved nudge with a content hash computed at generation time. Subsequent reads compare the hash against the current entry body. When they differ, the saved nudge is returned with `stale: true`. The user sees the old nudge and is told the entry has changed since. They decide whether to refresh.

Rationale:

- **Option (a) — return stale silently.** Hides the drift. The writer doesn't know the nudge is out of date.
- **Option (b) — invalidate and force re-run.** Wastes tokens on trivial edits (typo fix, single word change). Defeats the point of persistence.
- **Option (c) — tag with hash and surface staleness.** The common case (no edit since nudge) hits cache. The edited case still serves the last nudge for free and labels it honestly. The writer chooses when to pay for a fresh run.

Hash function: SHA-256 of the entry body as stored (after `EntryStore.get()` returns; the body the LLM saw). Recorded as `contentHash: sha256:<hex>` in the YAML. Hashing is cheap enough that we compute it on every request to check staleness.

Note on `context`: the optional `context` field can also differ between calls. When persistence is active, the context at the time of generation is saved alongside the nudge. A subsequent call with a different `context` is treated like a content change: the saved nudge is returned with `stale: true`. This keeps the invalidation model coherent — the nudge is a function of (text, context), and either input changing makes the cached result drift.

### Re-run Override (Open Question 3)

**Decision:** Add a `refresh: boolean` parameter to `POST /nudge`. When `refresh` is `true`, the route skips the cache read, runs the LLM, overwrites the saved nudge, and returns the new result. When `refresh` is `false` or omitted, the route serves from cache when a saved nudge exists.

No history. The fresh nudge overwrites the previous saved nudge. Single-user tool, no accumulation use case today. If a history view ever becomes valuable, the exit point below covers it.

**CLI.** The CLI discovers operations from the help tree. Adding a `refresh` parameter of `type: "boolean"` to the operation definition makes it available as a positional arg on `nudge analyze`. The executor maps positional args to parameter order, so the call shape is `ink-mirror nudge analyze <entryId> "" "" true` to force a refresh. This is awkward. The existing executor does not support named flags. Rather than expand the executor's contract for one operation, the spec lands on: CLI users who want refresh invoke it via a direct daemon call (`curl --unix-socket ... -X POST /nudge -d '{"entryId":"...","refresh":true}'`) until a broader CLI flag system exists. Exit point: named-flag support in the CLI executor.

**Web.** When a saved nudge is shown, the `Nudge` button is replaced by two controls: a passive label "Saved <timestamp>, <stale|current>" and a "Regenerate" button. Clicking "Regenerate" posts with `refresh: true`. When no saved nudge exists, the current single "Nudge" button behavior is preserved. The regenerate affordance also appears when the nudge is stale (the common prompt to update).

### Response Shape (Open Question 4)

The response tells the caller provenance and freshness. Additive; existing fields preserved.

Proposed `NudgeResponse`:

```typescript
{
  nudges: CraftNudge[];          // unchanged
  metrics: {                      // unchanged
    passiveRatio: number;
    totalSentences: number;
    hedgingWordCount: number;
    rhythmVariance: number;
  };
  source: "cache" | "fresh";      // NEW: how this response was produced
  stale?: boolean;                // NEW: true only when source=cache and content/context hash differs; omitted otherwise
  generatedAt: string;            // NEW: ISO 8601 timestamp the nudges were produced
  contentHash?: string;           // NEW: sha256 hex of the text at generation time; omitted for direct-text (non-cached) responses
  error?: string;                 // unchanged
}
```

Semantics:

- `source: "fresh"` — Ran the LLM on this request. Always the case for direct-text requests and for refresh requests. Also the case the first time a given entry is nudged.
- `source: "cache"` — Returned a persisted nudge without calling the LLM.
- `stale: true` — Only present when `source: "cache"` and the current entry body hash or context string does not match what was saved. Omitted in all other cases.
- `generatedAt` — For cache hits, the original generation time. For fresh runs, the current time.
- `contentHash` — Present whenever the response is tied to an entry (cache or fresh-from-entry). Omitted when the request was direct-text with no entryId.

### Migration (Open Question 5)

**Confirmed.** No backfill. Existing entries simply have no `nudges/{id}.yaml`. The first nudge request for each existing entry runs the LLM, saves the result, and future calls hit cache. The `nudges/` directory is created on first write.

This is safe because:

- Nudge output has no cumulative meaning — there is no "first observation" that seeds downstream state.
- The cost of first-call regeneration is identical to the pre-persistence status quo.

## Requirements

### Persistence

- REQ-CNP-1: The daemon maintains a nudge store at `{DATA_DIR}/nudges/`, created on first write. One YAML file per entry, named `{entryId}.yaml`.
- REQ-CNP-2: A saved nudge record contains: `entryId`, `contentHash` (SHA-256 hex of the entry body at generation time), `context` (the optional context string, empty string when absent), `generatedAt` (ISO 8601), `nudges` (the `CraftNudge[]` array), and `metrics` (the same summary the API returns).
- REQ-CNP-3: Persistence applies only when the request resolves text from an entry. If `text` is provided directly (with or without `entryId`), the route runs fresh and does not read or write the nudge store.
- REQ-CNP-4: When the route reads text from storage via `readEntry` and the request does not set `refresh: true`, the route first checks for a saved nudge. If found and the saved `contentHash` equals `sha256(body)` and the saved `context` equals the request context, the route returns the saved nudge with `source: "cache"`, no `stale` field.
- REQ-CNP-5: If a saved nudge exists but the hash or context differs, the route returns the saved nudge with `source: "cache"` and `stale: true`. The saved record is not mutated.
- REQ-CNP-6: If no saved nudge exists for the entry, the route runs the LLM, saves the result as described in REQ-CNP-2, and returns `source: "fresh"`.
- REQ-CNP-7: A parse failure from the LLM (`error` set, empty `nudges`) is not persisted. Saving an empty-nudges-with-error payload would cement the bad response. Next call retries fresh.

### Refresh

- REQ-CNP-8: The request schema gains a `refresh?: boolean` field. Default: false.
- REQ-CNP-9: When `refresh: true` and text was resolved from an entry, the route runs the LLM, overwrites any existing saved nudge (if the LLM result parses successfully), and returns `source: "fresh"`.
- REQ-CNP-10: When `refresh: true` is supplied with direct text (no `entryId` or `text` overriding), the route runs fresh with no persistence side effect. This is the same as `refresh: false` for direct text; the field is a no-op in that path but must not error.
- REQ-CNP-11: Refresh does not preserve history. The previous saved nudge is overwritten.

### Response Shape

- REQ-CNP-12: The response adds `source: "cache" | "fresh"`, `generatedAt: string (ISO 8601)`, and `contentHash?: string`. `contentHash` is present when the response is tied to an entry (cache or fresh-from-entry), omitted otherwise.
- REQ-CNP-13: The response adds `stale?: boolean`, present and `true` only when `source: "cache"` and either the content hash or context does not match what was saved. Omitted in all other cases.
- REQ-CNP-14: Cache-served responses omit any `error` field. Fresh responses preserve today's error semantics (REQ-CN-34).

### Store Contract

- REQ-CNP-15: A new `NudgeStore` interface, parallel in style to `ObservationStore`, exposes: `get(entryId): Promise<SavedNudge | undefined>`, `save(entryId, record: SavedNudge): Promise<void>`. No `list` or `delete` in this spec.
- REQ-CNP-16: `NudgeStore` is constructed with `{ nudgesDir, fs?, now? }` using the same filesystem-abstraction pattern as `EntryStore` and `ObservationStore`, so tests can inject mocks.
- REQ-CNP-17: `createNudgeRoutes` gains `nudgeStore: NudgeStore` in its `NudgeDeps`. The daemon wiring in `packages/daemon/src/index.ts` constructs the store from `{DATA_DIR}/nudges/` and passes it in.
- REQ-CNP-18: The route validates `entryId` format (`^entry-[\w-]+$`) before any filesystem access, matching the existing guard in `packages/daemon/src/routes/nudge.ts:46`. This prevents path traversal through the nudge store as well.

### CLI and Web Surfaces

- REQ-CNP-19: The operation definition for `nudge.analyze` gains a `refresh` parameter of `type: "boolean"`. CLI discovery picks this up automatically. A dedicated CLI flag UX is out of scope (see Exit Points).
- REQ-CNP-20: `web/lib/api.ts` `requestNudge` accepts an optional `refresh?: boolean` and passes it through.
- REQ-CNP-21: `web/components/entry-nudge.tsx` renders different states: no saved nudge (show "Nudge" button, today's behavior), saved and current (show the saved nudges with a `Saved <timestamp>` label and a "Regenerate" button), saved and stale (show the saved nudges with a `Saved <timestamp> — entry edited since` label and a "Regenerate" button). Regenerate posts with `refresh: true`.
- REQ-CNP-22: The client fetches the saved nudge on mount for the entry view, so the stored result renders without a user click. This is a pure GET-equivalent (POST with `refresh: false`) — no LLM call, no token cost. The existing "Nudge" interaction is preserved for the no-saved-nudge state.

## API Contract

### Request (amended from REQ-CN-24)

```typescript
{
  entryId?: string;
  text?: string;
  context?: string;
  refresh?: boolean;  // NEW: force fresh generation, overwrite saved nudge (entry-resolved path only)
  // At least one of entryId or text is required.
}
```

### Response (amended from REQ-CN-25)

```typescript
{
  nudges: CraftNudge[];
  metrics: {
    passiveRatio: number;
    totalSentences: number;
    hedgingWordCount: number;
    rhythmVariance: number;
  };
  source: "cache" | "fresh";   // NEW
  stale?: boolean;             // NEW, only when source="cache" and content/context changed
  generatedAt: string;         // NEW, ISO 8601
  contentHash?: string;        // NEW, sha256 hex; omitted for direct-text responses
  error?: string;
}
```

## File Format

### Before (no file exists)

Today there is no `nudges/` directory.

### After — `{DATA_DIR}/nudges/entry-2026-04-21-001.yaml`

```yaml
entryId: entry-2026-04-21-001
contentHash: sha256:9af15f5c7b1e4d3a8c2e6f4a1b3d7e9c2f8a5b3c7d9e1f4a6b8c2d4e6f8a1b3c
context: ""
generatedAt: 2026-04-21T18:03:12.447Z
metrics:
  passiveRatio: 0.42
  totalSentences: 12
  hedgingWordCount: 3
  rhythmVariance: 18.7
nudges:
  - craftPrinciple: passive-voice-clustering
    evidence: |
      The project was started in January. The requirements were gathered over two weeks.
    observation: |
      Two consecutive passive sentences remove the actors from the narrative.
    question: |
      The passive voice here reads as institutional report register. Was that your intent?
  - craftPrinciple: hedging-accumulation
    evidence: |
      I think we might possibly want to consider perhaps revisiting this.
    observation: |
      Four hedging markers in a single sentence.
    question: |
      This sentence carries several softeners. Is the uncertainty deliberate, or is it doing other work?
```

YAML is hand-rolled by the store, mirroring `observation-store.ts:41-56`, to avoid pulling in a YAML dependency. The reader accepts either `|` block-literal or quoted scalar for string fields, for resilience against human edits (though the feature does not require human editing).

### Entry file

The entry's `.md` file is not modified by this spec. Persistence is entirely in the sidecar `nudges/` directory.

## Test Plan

Unit tests with mocked dependencies, following the project's testing conventions (no `mock.module()`, dependency injection).

**NudgeStore (`nudge-store.test.ts`):**

- `save` + `get` round trip for a full record.
- `get` returns `undefined` when no file exists.
- `save` creates the directory if missing (matches `observation-store.ts:154`).
- YAML serialization preserves multiline fields via `|` block literal.
- `fromYaml` returns `undefined` on malformed content (does not throw).

**Route (`routes/nudge.test.ts` additions):**

- First call on an entry: `source: "fresh"`, saves to store, `contentHash` set.
- Second call, same entry, unchanged body and context: `source: "cache"`, no LLM call (assert `sessionRunner` not invoked), no `stale` field.
- Second call, same entry, changed body: `source: "cache"`, `stale: true`, saved record unchanged.
- Second call, same entry, changed context: `source: "cache"`, `stale: true`.
- Third call with `refresh: true`: `source: "fresh"`, overwrites saved record, new `contentHash` and `generatedAt`.
- Direct text (no `entryId`): `source: "fresh"`, store not read or written, no `contentHash` in response.
- Direct text with `refresh: true`: `source: "fresh"`, no store side effect, no error.
- LLM parse failure: response includes `error`, `source: "fresh"`, store not written.
- Invalid entry ID format: returns 400 before touching the store.
- Entry not found (`readEntry` returns undefined) when request has `entryId` only: returns 404, store not written.

**Hash determinism:** a pure function test that SHA-256 of the entry body yields stable output.

**Web component (`entry-nudge.test.tsx` additions):**

- Mount with no saved nudge: renders "Nudge" button, no auto-fetch network call to LLM (but auto-fetch with `refresh: false` may return cache-miss empty; component decides by `source`).
- Mount with saved nudge, `stale: false`: renders nudges, "Saved <time>" label, "Regenerate" button.
- Mount with saved nudge, `stale: true`: renders nudges, "Saved <time> — entry edited since" label, "Regenerate" button.
- Click "Regenerate": posts with `refresh: true`, re-renders with `source: "fresh"`.

**Integration (manual, per project conventions):**

- Create an entry, press Nudge, observe `{DATA_DIR}/nudges/{id}.yaml` appears with the expected fields.
- Navigate away, return to the entry, confirm saved nudges render without a network call to the LLM.
- Edit the entry's body on disk, return to the web view, confirm `stale: true` rendering.
- Click Regenerate, confirm the file is overwritten with new `contentHash` and `generatedAt`.

## Success Criteria

- [ ] First nudge call for an entry runs the LLM and writes `{DATA_DIR}/nudges/{entryId}.yaml`.
- [ ] Subsequent nudge calls for the same entry (unchanged body and context) return the saved result without calling the LLM. Response has `source: "cache"`.
- [ ] When the entry body changes, the saved nudge is returned with `stale: true`. LLM is not called.
- [ ] A request with `refresh: true` overwrites the saved nudge and returns `source: "fresh"`.
- [ ] Direct-text requests (`text` without `entryId`) never read or write the nudge store.
- [ ] The web UI renders saved nudges on entry view load without a user click and exposes a Regenerate control.
- [ ] The nudge operation remains on-demand (no automatic trigger on entry creation, no background generation).
- [ ] The response includes `source`, `generatedAt`, `contentHash` (when entry-scoped), and `stale` (only when cache-served and drifted).
- [ ] Malformed LLM output is not persisted; the next call retries.

## AI Validation

**Defaults apply:**
- Unit tests with mocked LLM, filesystem, and clock dependencies.
- 90%+ coverage on new code.
- Code review by fresh-context sub-agent.

**Custom:**
- Mechanically verify: no persistence side effect in the direct-text path. A test that exercises the direct-text path must pass a store whose `save` throws; the request must still succeed.
- Mechanically verify: `refresh: true` overwrites but does not append. Assert file contents equal the new record exactly after refresh.
- Spot-check: manual end-to-end on a real entry demonstrates cache hit, stale detection, and refresh. Runtime testing is required per project convention; passing unit tests are necessary but not sufficient.

## Out of Scope

- **Nudge history.** Refresh overwrites. No per-entry history of past nudges. See Exit Points.
- **Cross-entry nudge aggregation.** No query like "show me every passive-voice-clustering nudge across my journal." That's a different feature.
- **Observer changes.** This spec is nudge-only. REQ-CN-30 (observer and nudge are separate) still holds.
- **Profile influence on invalidation.** A change to the style profile does not invalidate saved nudges. Profile is calibration, not evidence. If the writer wants a fresh nudge after updating the profile, they refresh.
- **Streaming.** Nudge remains a single request/response. No SSE for this feature.
- **CLI named flags.** Refresh is exposed as a boolean parameter in the help tree; a richer CLI flag experience is a separate executor-level change.

## Exit Points

| Exit | Triggers When | Target |
|------|---------------|--------|
| Nudge history | The writer wants to compare the nudge before and after a revision | [STUB: nudge-history] |
| CLI named flags | Refresh becomes a common enough CLI gesture that the positional-args-only contract is painful | [STUB: cli-named-flags] |
| Profile-aware invalidation | Style profile changes demonstrably shift nudge output in ways users want to see reflected without a manual refresh | [STUB: profile-aware-nudge-invalidation] |
| Combined review | Both nudge persistence and profile reflection are mature | [STUB: combined-review] (inherited from craft-nudge.md) |

## Open Questions

None that block implementation. Decisions above resolve the five questions from the commission brief.

## Context

This spec amends `craft-nudge.md`. The scope line "Storage of nudge results. Nudges are ephemeral." is superseded by the requirements here. All other `craft-nudge.md` requirements (REQ-CN-1 through REQ-CN-37) stand unchanged; in particular, REQ-CN-1 (never runs by default), REQ-CN-20 (3–5 nudges per request), and REQ-CN-34 (malformed output returns 200 with empty nudges and error field) remain in force — persistence happens after the nudge function returns, and it respects the same output contract.

Pattern parallel: `packages/daemon/src/observation-store.ts` is the reference implementation style for the new `NudgeStore`. The difference is that observations are 1:N per entry keyed by observation ID, while nudges are 1:1 per entry keyed by entry ID — a simpler lookup.
