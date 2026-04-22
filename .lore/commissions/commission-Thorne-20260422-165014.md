---
title: "Commission: Phase 1B: Review nudge persistence shared schema"
date: 2026-04-22
status: completed
tags: [commission]
worker: Thorne
workerDisplayTitle: "Guild Warden"
prompt: "Review Phase 1A of the nudge persistence build.\n\nSpec: `.lore/specs/craft-nudge-persistence.md`\nPlan: `.lore/plans/craft-nudge-persistence.md` (see \"Commission 1B — Review: shared schema\")\n\nCheck the schema additions in `packages/shared/src/nudge.ts` and `packages/shared/src/index.ts` against REQ-CNP-8, REQ-CNP-12, REQ-CNP-13, REQ-CNP-14. The plan's 1B review checklist is your guide.\n\nCapture all findings in your commission result body (must-fix vs nice-to-have). No file writes."
dependencies:
  - commission-Dalton-20260422-165008
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-04-22T23:50:14.156Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-04-22T23:50:14.157Z
    event: status_blocked
    reason: "Dependencies not satisfied"
    from: "pending"
    to: "blocked"
  - timestamp: 2026-04-22T23:52:02.085Z
    event: status_pending
    reason: "Dependencies satisfied"
    from: "blocked"
    to: "pending"
  - timestamp: 2026-04-22T23:52:02.089Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
  - timestamp: 2026-04-22T23:52:02.107Z
    event: status_in_progress
    reason: "Execution started"
    from: "dispatched"
    to: "in_progress"
  - timestamp: 2026-04-22T23:52:55.219Z
    event: progress_report
    reason: "Read spec, plan, nudge.ts, index.ts, and nudge.test.ts. Walking the 1B checklist against the code."
  - timestamp: 2026-04-22T23:53:59.205Z
    event: result_submitted
    reason: "\n# Phase 1B Review — Shared Schema for Craft Nudge Persistence\n\n**Verdict: APPROVED.** All checklist items from the plan are satisfied. No must-fix findings. Three nice-to-have observations noted below.\n\n## Scope reviewed\n\n- `packages/shared/src/nudge.ts` (additions from commission 1A)\n- `packages/shared/src/index.ts` (barrel exports)\n- `packages/shared/tests/nudge.test.ts` (new request/response/saved tests)\n\nChecked against REQ-CNP-8, REQ-CNP-12, REQ-CNP-13, REQ-CNP-14 and the plan's Commission 1B checklist.\n\n## Checklist results\n\n| Item | Result | Evidence |\n|------|--------|----------|\n| `refresh` optional, no default (route sees `undefined` → false) | Pass | `nudge.ts:48` — `refresh: z.boolean().optional()`. `.refine()` for `entryId\\|\\|text` still applies at `nudge.ts:50`. |\n| `stale` optional (REQ-CNP-13) | Pass | `nudge.ts:73` — `stale: z.boolean().optional()`. |\n| `contentHash` optional (REQ-CNP-12, omitted for direct-text) | Pass | `nudge.ts:75` — `contentHash: z.string().optional()` in response; required in `SavedNudgeSchema` as expected. |\n| `source` strict enum | Pass | `nudge.ts:72` — `z.enum([\"cache\",\"fresh\"])`. Negative test at `nudge.test.ts:295-308`. |\n| Metrics factored to one schema | Pass | `NudgeMetricsSchema` at `nudge.ts:58-63`; referenced by `NudgeResponseSchema` (line 71) and `SavedNudgeSchema` (line 89). Single source of truth. |\n| Barrel export complete | Pass | `index.ts:66-81` — `NudgeMetricsSchema`, `SavedNudgeSchema`, `NudgeMetrics`, `SavedNudge` all exported alongside prior nudge symbols. |\n\n## Requirement coverage\n\n- **REQ-CNP-8** (`refresh?: boolean`): Satisfied. Tests at `nudge.test.ts:180-201` cover `true`, `false`, and omitted. Note: spec says \"Default: false\", schema has no default. The plan's 1B text resolves this: the route reads `undefined` and treats it as `false`. Consistent with plan; no finding.\n- **REQ-CNP-12** (`source`, `generatedAt`, `contentHash?`): Satisfied structurally. All three present; `contentHash` optional. Cache-with-hash test at `nudge.test.ts:254-274`; fresh-without-hash test at `nudge.test.ts:276-293`.\n- **REQ-CNP-13** (`stale?`): Satisfied structurally. Optional, boolean.\n- **REQ-CNP-14** (cache responses omit `error`): Partially satisfied. See Finding 1 below.\n\n## Findings (nice-to-have)\n\n### Finding 1 — Schema does not enforce REQ-CNP-14\n`error: z.string().optional()` at `nudge.ts:76` is unconditional. A payload with `{ source: \"cache\", error: \"...\" }` parses successfully. The \"cache responses omit error\" constraint lives only at the route. A `z.discriminatedUnion(\"source\", [FreshSchema, CacheSchema])` would encode this at the type level and catch drift in future route edits.\n\n**Impact:** Route-layer violations of REQ-CNP-14 will not be caught by schema validation. Phase 3B review will have to carry the weight of this check manually.\n\n**Recommendation:** Leave as-is for now (plan does not require discriminated union). Flag for 3B reviewer so the route audit covers it. Optional improvement if you want the stronger contract.\n\n### Finding 2 — `contentHash` has no format constraint\nBoth response and saved-record `contentHash` are plain `z.string()`. The spec's File Format section shows `contentHash: sha256:<hex>` (spec line 210), and the plan Phase 3 constructs it as `\"sha256:\" + crypto.createHash(\"sha256\").update(s).digest(\"hex\")`. A regex like `z.string().regex(/^sha256:[0-9a-f]{64}$/)` would catch accidental prefix omission or hex typos early.\n\n**Impact:** If Phase 3 or a later refactor forgets the `sha256:` prefix, schema validation will not catch it. Downstream code that parses the prefix (none today) would silently break.\n\n**Recommendation:** Optional hardening. Not blocking.\n\n### Finding 3 — No schema-level test for required-field omission on the response\nTests cover the happy cases for `NudgeResponseSchema` plus the `source` enum. No explicit negative test for a response missing `source` or `generatedAt`. The positive tests would fail if those fields were dropped, so coverage is transitively adequate, but an explicit `rejects missing source` test would make intent clearer and lock the contract.\n\n**Impact:** Low. The contract is effectively tested.\n\n**Recommendation:** Add one negative test per omission when convenient.\n\n## Ready for downstream\n\nPhase 2 (NudgeStore) can proceed. `SavedNudgeSchema` is stable and correctly shaped per REQ-CNP-2. Phase 3 (route) has the request/response vocabulary it needs.\n"
  - timestamp: 2026-04-22T23:54:02.872Z
    event: status_completed
    reason: "Execution completed"
    from: "in_progress"
    to: "completed"
current_progress: "Read spec, plan, nudge.ts, index.ts, and nudge.test.ts. Walking the 1B checklist against the code."
projectName: ink-mirror
---

# Phase 1B Review — Shared Schema for Craft Nudge Persistence

**Verdict: APPROVED.** All checklist items from the plan are satisfied. No must-fix findings. Three nice-to-have observations noted below.

## Scope reviewed

- `packages/shared/src/nudge.ts` (additions from commission 1A)
- `packages/shared/src/index.ts` (barrel exports)
- `packages/shared/tests/nudge.test.ts` (new request/response/saved tests)

Checked against REQ-CNP-8, REQ-CNP-12, REQ-CNP-13, REQ-CNP-14 and the plan's Commission 1B checklist.

## Checklist results

| Item | Result | Evidence |
|------|--------|----------|
| `refresh` optional, no default (route sees `undefined` → false) | Pass | `nudge.ts:48` — `refresh: z.boolean().optional()`. `.refine()` for `entryId\|\|text` still applies at `nudge.ts:50`. |
| `stale` optional (REQ-CNP-13) | Pass | `nudge.ts:73` — `stale: z.boolean().optional()`. |
| `contentHash` optional (REQ-CNP-12, omitted for direct-text) | Pass | `nudge.ts:75` — `contentHash: z.string().optional()` in response; required in `SavedNudgeSchema` as expected. |
| `source` strict enum | Pass | `nudge.ts:72` — `z.enum(["cache","fresh"])`. Negative test at `nudge.test.ts:295-308`. |
| Metrics factored to one schema | Pass | `NudgeMetricsSchema` at `nudge.ts:58-63`; referenced by `NudgeResponseSchema` (line 71) and `SavedNudgeSchema` (line 89). Single source of truth. |
| Barrel export complete | Pass | `index.ts:66-81` — `NudgeMetricsSchema`, `SavedNudgeSchema`, `NudgeMetrics`, `SavedNudge` all exported alongside prior nudge symbols. |

## Requirement coverage

- **REQ-CNP-8** (`refresh?: boolean`): Satisfied. Tests at `nudge.test.ts:180-201` cover `true`, `false`, and omitted. Note: spec says "Default: false", schema has no default. The plan's 1B text resolves this: the route reads `undefined` and treats it as `false`. Consistent with plan; no finding.
- **REQ-CNP-12** (`source`, `generatedAt`, `contentHash?`): Satisfied structurally. All three present; `contentHash` optional. Cache-with-hash test at `nudge.test.ts:254-274`; fresh-without-hash test at `nudge.test.ts:276-293`.
- **REQ-CNP-13** (`stale?`): Satisfied structurally. Optional, boolean.
- **REQ-CNP-14** (cache responses omit `error`): Partially satisfied. See Finding 1 below.

## Findings (nice-to-have)

### Finding 1 — Schema does not enforce REQ-CNP-14
`error: z.string().optional()` at `nudge.ts:76` is unconditional. A payload with `{ source: "cache", error: "..." }` parses successfully. The "cache responses omit error" constraint lives only at the route. A `z.discriminatedUnion("source", [FreshSchema, CacheSchema])` would encode this at the type level and catch drift in future route edits.

**Impact:** Route-layer violations of REQ-CNP-14 will not be caught by schema validation. Phase 3B review will have to carry the weight of this check manually.

**Recommendation:** Leave as-is for now (plan does not require discriminated union). Flag for 3B reviewer so the route audit covers it. Optional improvement if you want the stronger contract.

### Finding 2 — `contentHash` has no format constraint
Both response and saved-record `contentHash` are plain `z.string()`. The spec's File Format section shows `contentHash: sha256:<hex>` (spec line 210), and the plan Phase 3 constructs it as `"sha256:" + crypto.createHash("sha256").update(s).digest("hex")`. A regex like `z.string().regex(/^sha256:[0-9a-f]{64}$/)` would catch accidental prefix omission or hex typos early.

**Impact:** If Phase 3 or a later refactor forgets the `sha256:` prefix, schema validation will not catch it. Downstream code that parses the prefix (none today) would silently break.

**Recommendation:** Optional hardening. Not blocking.

### Finding 3 — No schema-level test for required-field omission on the response
Tests cover the happy cases for `NudgeResponseSchema` plus the `source` enum. No explicit negative test for a response missing `source` or `generatedAt`. The positive tests would fail if those fields were dropped, so coverage is transitively adequate, but an explicit `rejects missing source` test would make intent clearer and lock the contract.

**Impact:** Low. The contract is effectively tested.

**Recommendation:** Add one negative test per omission when convenient.

## Ready for downstream

Phase 2 (NudgeStore) can proceed. `SavedNudgeSchema` is stable and correctly shaped per REQ-CNP-2. Phase 3 (route) has the request/response vocabulary it needs.


## Decisions

**Does NudgeRequestSchema satisfy REQ-CNP-8 and the 1B checklist for `refresh`?**
Satisfied. `refresh: z.boolean().optional()` at nudge.ts:48 with no default; `.refine()` for `entryId || text` remains intact at nudge.ts:50. Request tests cover refresh: true/false/omitted at nudge.test.ts:180-201.
*Reasoning: Plan 1B requires "refresh is optional with no default (so route sees undefined and treats as false)." Schema does exactly this. Spec REQ-CNP-8 text says "Default: false", but the plan intentionally resolves this as undefined-treated-as-false at the route level; the schema matches the plan.*

**Does NudgeResponseSchema satisfy REQ-CNP-12, REQ-CNP-13, and the strict-enum/optionality checklist?**
Satisfied on the strict-field checks. `source: z.enum(["cache","fresh"])` (strict), `stale: z.boolean().optional()`, `generatedAt: z.string()`, `contentHash: z.string().optional()`. Tests cover cache-with-stale-and-hash and fresh-without-stale-or-hash cases, and a negative test for source outside the enum.
*Reasoning: Plan 1B explicitly calls out these four structural checks. Each matches the schema at nudge.ts:69-77. Tests at nudge.test.ts:254-308 confirm round-trip behavior.*

**Does the schema enforce REQ-CNP-14 (cache-served responses omit `error`)?**
Not enforced at schema level. `error: z.string().optional()` is present unconditionally in NudgeResponseSchema, so a `{source: "cache", error: "..."}` payload parses successfully. The constraint is left to the route to enforce. Flag as nice-to-have, not must-fix.
*Reasoning: Plan 1B does not require a discriminated union; it only lists structural checks. A discriminated union (`z.discriminatedUnion("source", [FreshSchema, CacheSchema])`) would encode REQ-CNP-14 in the type system but increases schema complexity. Phase 3 review (3B) explicitly checks the route for the same constraint. Acceptable to leave as contract commentary; worth noting the schema cannot catch a route-layer violation of REQ-CNP-14.*

**Is metrics factored to avoid drift between response and saved record (plan 1B check)?**
Satisfied. `NudgeMetricsSchema` is defined once at nudge.ts:58-63 and referenced by both `NudgeResponseSchema` (line 71) and `SavedNudgeSchema` (line 89).
*Reasoning: Plan 1B: "Metrics schema is factored so both NudgeResponseSchema and SavedNudgeSchema reference the same definition (avoids drift)." Direct read confirms single source of truth.*

**Are the barrel exports in packages/shared/src/index.ts complete?**
Satisfied. index.ts:66-81 exports `NudgeMetricsSchema`, `SavedNudgeSchema`, and types `NudgeMetrics`, `SavedNudge` alongside the prior nudge exports. Nothing from nudge.ts is unreachable from consumers.
*Reasoning: Plan 1B requires the barrel to be complete. Every exported symbol in nudge.ts appears in the barrel: the five schemas and their inferred types plus NudgeMetrics/SavedNudge additions.*

**Does contentHash schema enforce the sha256: prefix the File Format section specifies?**
Not enforced. Both `NudgeResponseSchema.contentHash` and `SavedNudgeSchema.contentHash` are plain `z.string()`. The `sha256:` prefix is a convention the route/store must apply. Nice-to-have; not blocking.
*Reasoning: Spec File Format section (line 210) shows `contentHash: sha256:<hex>`. Plan 1A says `z.string()` is sufficient. A regex like `/^sha256:[0-9a-f]{64}$/` would catch accidental drift in the route/store wiring. Phase 3 will insert the prefix server-side; acceptable to leave unconstrained at the schema level, but worth noting so drift later surfaces early.*
