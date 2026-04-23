---
title: "Commission: Phase 5B: Review web client"
date: 2026-04-22
status: completed
tags: [commission]
worker: Thorne
workerDisplayTitle: "Guild Warden"
prompt: "Review Phase 5A of the nudge persistence build.\n\nSpec: `.lore/specs/craft-nudge-persistence.md`\nPlan: `.lore/plans/craft-nudge-persistence.md` (see \"Commission 5B — Review: web client\")\n\nReview `packages/web/components/entry-nudge.tsx` and `packages/web/lib/api.ts` against REQ-CNP-20, REQ-CNP-21 and the revised spec Test Plan / Success Criteria.\n\nConfirm:\n- No mount-time fetch. Component renders \"Nudge\" button before any click, nothing else.\n- Three post-click render states (fresh, cache-current, cache-stale) all render correctly.\n- Regenerate click posts `refresh: true`.\n- Abort-on-unmount guard is present and tested.\n- Every response field the daemon can emit (`source`, `stale`, `generatedAt`, `contentHash`, `error`) is handled.\n\nCapture findings in commission result body."
dependencies:
  - commission-Dalton-20260422-165117
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-04-22T23:51:23.900Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-04-22T23:51:23.902Z
    event: status_blocked
    reason: "Dependencies not satisfied"
    from: "pending"
    to: "blocked"
  - timestamp: 2026-04-23T00:20:25.903Z
    event: status_pending
    reason: "Dependencies satisfied"
    from: "blocked"
    to: "pending"
  - timestamp: 2026-04-23T00:20:25.905Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
  - timestamp: 2026-04-23T00:20:25.923Z
    event: status_in_progress
    reason: "Execution started"
    from: "dispatched"
    to: "in_progress"
  - timestamp: 2026-04-23T00:20:38.031Z
    event: progress_report
    reason: "Starting review of Phase 5A web client nudge persistence changes"
  - timestamp: 2026-04-23T00:23:13.268Z
    event: result_submitted
    reason: "# Phase 5A Web Client Review\n\nScope: `packages/web/components/entry-nudge.tsx` and `packages/web/lib/api.ts` against REQ-CNP-20, REQ-CNP-21, spec Test Plan (web section), and plan Commission 5A scope.\n\n## Verdict\n\nThe implementation satisfies the behavioral requirements by reading. Test coverage for the interactive paths is incomplete. One finding at TEST-GAP severity. Minor notes follow.\n\n---\n\n## Findings\n\n### 1. [TEST-GAP] Interactive component tests absent from `entry-nudge.test.tsx`\n\n**What's wrong.** The spec Test Plan (lines 270-275) and plan Commission 5A (lines 310-316) both require tests for:\n\n- First click on an entry with no saved nudge (fresh render).\n- First click on an entry with an existing saved nudge (cache render).\n- First click on an entry with a stale saved nudge.\n- Regenerate click posts `refresh: true` and re-renders.\n- **Component unmount during in-flight POST does not call setState.**\n\n`packages/web/tests/entry-nudge.test.tsx` covers only: the `formatRelativeTime` / `formatSavedLabel` / `toResultState` helpers, and a single `renderToStaticMarkup` assertion that the initial render shows only the Nudge button. `renderToStaticMarkup` cannot exercise click handlers, `useState` transitions, `useEffect` cleanup, or async behavior.\n\n**Why it matters.** The abort-on-unmount guard (entry-nudge.tsx:56-61, 77, 81-82, 85) is the kind of code that looks correct but silently degrades later. Without a test that mounts, fires a request, unmounts mid-flight, and resolves the promise, regressions will not be caught. Likewise, the post-click render states are the core UX of this commission and have no direct assertion. The helper tests validate the string format but not that the component actually composes them into the DOM after state transitions.\n\n**Where.** `packages/web/tests/entry-nudge.test.tsx` — no `describe` block for interactive behavior. Static markup at lines 108-116 is the only component-level test.\n\n**What to do.** Add interactive tests using a DOM-capable renderer (React Testing Library against jsdom, or equivalent matching the project's convention). At minimum:\n\n1. Click Nudge → POST issued without `refresh`, fresh response renders nudges + Saved label + Regenerate button.\n2. Click Nudge → cache response with `stale: false` renders without the \"— entry edited since\" suffix.\n3. Click Nudge → cache response with `stale: true` renders the \"— entry edited since\" suffix.\n4. Click Regenerate → POST issued with `refresh: true`.\n5. Mount, click Nudge, unmount before the fetch resolves, then resolve → no `setState` warning, no crash.\n\nInject `requestNudge` via module mock or via a test-only prop (match what other web tests in this repo already do).\n\n---\n\n### 2. [NOTE] `stale` is not gated on `source === \"cache\"`\n\n**What it is.** `toResultState` (entry-nudge.tsx:40-47) coerces `response.stale` to a boolean regardless of `response.source`. Per REQ-CNP-13 the daemon only emits `stale: true` with `source: \"cache\"`, so in a well-behaved system this never matters. But a daemon regression that sent `stale: true` with `source: \"fresh\"` would produce a \"Saved X ago — entry edited since\" label on a freshly-generated nudge.\n\n**Impact.** Low. The daemon tests should catch this. The client just trusts its contract.\n\n**What to do.** Optional: gate the stale flag on `response.source === \"cache\"` in `toResultState`. Or leave it and rely on the server tests. Reader's call.\n\n---\n\n### 3. [NOTE] Saved row renders alongside a parse-error response\n\n**What it is.** When the daemon returns a fresh response with `error` set and empty `nudges` (REQ-CN-34, REQ-CNP-14), `result` gets populated (generatedAt, source, empty nudges) and `nudgeError` also gets populated. The render falls through to the `result`-present branch: `NudgeResults` short-circuits to show the error div, and then the `savedRow` still shows \"Saved {time}\" + Regenerate. The \"Saved\" framing on a response that was not saved (REQ-CNP-7 forbids persisting error responses) is a minor semantic oddity.\n\n**Impact.** UX-only. The user can still Regenerate; functionality is fine.\n\n**What to do.** Optional: skip the Saved label when `result.nudges.length === 0` and an error is present, or surface the error without claiming a save happened. Not a blocker.\n\n---\n\n## Requirement-by-requirement\n\n| Req | Status | Notes |\n|-----|--------|-------|\n| REQ-CNP-20 (requestNudge accepts `refresh`, passes through) | PASS | api.ts:91-105. `refresh?: boolean` in the params type; passed via `JSON.stringify(params)`. |\n| REQ-CNP-21 — pre-click shows only Nudge button | PASS | entry-nudge.tsx:93-105 render branch. Covered by the static markup test. |\n| REQ-CNP-21 — fresh post-click render | PASS by reading, not tested | `toResultState` + `formatSavedLabel(false)` produces \"Saved X ago\"; render branch at lines 107-126. No interactive test. |\n| REQ-CNP-21 — cache-current render | PASS by reading, not tested | Same render path; no interactive test. |\n| REQ-CNP-21 — cache-stale render | PASS by reading, not tested | `formatSavedLabel(true)` appends \"— entry edited since\". Helper tested; component render path not. |\n| REQ-CNP-21 — Regenerate posts `refresh: true` | PASS by reading, not tested | entry-nudge.tsx:120 + lines 73-76. No click test. |\n| Spec Test Plan web: \"Component unmount during in-flight POST does not call setState\" | FAIL (missing test) | Guard exists in code; no test. See Finding 1. |\n| Spec Test Plan web: other rows (fresh/cache/stale/regenerate renderers) | FAIL (missing tests) | See Finding 1. |\n\n## Confirmations requested by the commission\n\n- **No mount-time fetch.** Confirmed. `useEffect` (entry-nudge.tsx:56-61) registers only an unmount cleanup. No fetch in component body.\n- **Three post-click render states render correctly.** Confirmed by reading; not verified by test.\n- **Regenerate click posts `refresh: true`.** Confirmed by reading; not verified by test.\n- **Abort-on-unmount guard present and tested.** Guard present (mountedRef + AbortController; checked at lines 77, 81-82, 85). NOT tested. See Finding 1.\n- **Every response field handled.** `source`, `stale`, `generatedAt`, `error` are consumed. `contentHash` is parsed into the typed response but intentionally not displayed; the spec does not require client display so this is acceptable. `metrics` likewise unused by this component.\n\n## Recommendation\n\nDispatch Commission 5C (conditional fix) to Dalton with scope: add the missing interactive tests for `entry-nudge.tsx` (fresh/cache/stale render, Regenerate click, unmount-during-fetch). Findings 2 and 3 are reader's discretion."
  - timestamp: 2026-04-23T00:23:21.141Z
    event: status_completed
    reason: "Execution completed"
    from: "in_progress"
    to: "completed"
current_progress: "Starting review of Phase 5A web client nudge persistence changes"
projectName: ink-mirror
---
# Phase 5A Web Client Review

Scope: `packages/web/components/entry-nudge.tsx` and `packages/web/lib/api.ts` against REQ-CNP-20, REQ-CNP-21, spec Test Plan (web section), and plan Commission 5A scope.

## Verdict

The implementation satisfies the behavioral requirements by reading. Test coverage for the interactive paths is incomplete. One finding at TEST-GAP severity. Minor notes follow.

---

## Findings

### 1. [TEST-GAP] Interactive component tests absent from `entry-nudge.test.tsx`

**What's wrong.** The spec Test Plan (lines 270-275) and plan Commission 5A (lines 310-316) both require tests for:

- First click on an entry with no saved nudge (fresh render).
- First click on an entry with an existing saved nudge (cache render).
- First click on an entry with a stale saved nudge.
- Regenerate click posts `refresh: true` and re-renders.
- **Component unmount during in-flight POST does not call setState.**

`packages/web/tests/entry-nudge.test.tsx` covers only: the `formatRelativeTime` / `formatSavedLabel` / `toResultState` helpers, and a single `renderToStaticMarkup` assertion that the initial render shows only the Nudge button. `renderToStaticMarkup` cannot exercise click handlers, `useState` transitions, `useEffect` cleanup, or async behavior.

**Why it matters.** The abort-on-unmount guard (entry-nudge.tsx:56-61, 77, 81-82, 85) is the kind of code that looks correct but silently degrades later. Without a test that mounts, fires a request, unmounts mid-flight, and resolves the promise, regressions will not be caught. Likewise, the post-click render states are the core UX of this commission and have no direct assertion. The helper tests validate the string format but not that the component actually composes them into the DOM after state transitions.

**Where.** `packages/web/tests/entry-nudge.test.tsx` — no `describe` block for interactive behavior. Static markup at lines 108-116 is the only component-level test.

**What to do.** Add interactive tests using a DOM-capable renderer (React Testing Library against jsdom, or equivalent matching the project's convention). At minimum:

1. Click Nudge → POST issued without `refresh`, fresh response renders nudges + Saved label + Regenerate button.
2. Click Nudge → cache response with `stale: false` renders without the "— entry edited since" suffix.
3. Click Nudge → cache response with `stale: true` renders the "— entry edited since" suffix.
4. Click Regenerate → POST issued with `refresh: true`.
5. Mount, click Nudge, unmount before the fetch resolves, then resolve → no `setState` warning, no crash.

Inject `requestNudge` via module mock or via a test-only prop (match what other web tests in this repo already do).

---

### 2. [NOTE] `stale` is not gated on `source === "cache"`

**What it is.** `toResultState` (entry-nudge.tsx:40-47) coerces `response.stale` to a boolean regardless of `response.source`. Per REQ-CNP-13 the daemon only emits `stale: true` with `source: "cache"`, so in a well-behaved system this never matters. But a daemon regression that sent `stale: true` with `source: "fresh"` would produce a "Saved X ago — entry edited since" label on a freshly-generated nudge.

**Impact.** Low. The daemon tests should catch this. The client just trusts its contract.

**What to do.** Optional: gate the stale flag on `response.source === "cache"` in `toResultState`. Or leave it and rely on the server tests. Reader's call.

---

### 3. [NOTE] Saved row renders alongside a parse-error response

**What it is.** When the daemon returns a fresh response with `error` set and empty `nudges` (REQ-CN-34, REQ-CNP-14), `result` gets populated (generatedAt, source, empty nudges) and `nudgeError` also gets populated. The render falls through to the `result`-present branch: `NudgeResults` short-circuits to show the error div, and then the `savedRow` still shows "Saved {time}" + Regenerate. The "Saved" framing on a response that was not saved (REQ-CNP-7 forbids persisting error responses) is a minor semantic oddity.

**Impact.** UX-only. The user can still Regenerate; functionality is fine.

**What to do.** Optional: skip the Saved label when `result.nudges.length === 0` and an error is present, or surface the error without claiming a save happened. Not a blocker.

---

## Requirement-by-requirement

| Req | Status | Notes |
|-----|--------|-------|
| REQ-CNP-20 (requestNudge accepts `refresh`, passes through) | PASS | api.ts:91-105. `refresh?: boolean` in the params type; passed via `JSON.stringify(params)`. |
| REQ-CNP-21 — pre-click shows only Nudge button | PASS | entry-nudge.tsx:93-105 render branch. Covered by the static markup test. |
| REQ-CNP-21 — fresh post-click render | PASS by reading, not tested | `toResultState` + `formatSavedLabel(false)` produces "Saved X ago"; render branch at lines 107-126. No interactive test. |
| REQ-CNP-21 — cache-current render | PASS by reading, not tested | Same render path; no interactive test. |
| REQ-CNP-21 — cache-stale render | PASS by reading, not tested | `formatSavedLabel(true)` appends "— entry edited since". Helper tested; component render path not. |
| REQ-CNP-21 — Regenerate posts `refresh: true` | PASS by reading, not tested | entry-nudge.tsx:120 + lines 73-76. No click test. |
| Spec Test Plan web: "Component unmount during in-flight POST does not call setState" | FAIL (missing test) | Guard exists in code; no test. See Finding 1. |
| Spec Test Plan web: other rows (fresh/cache/stale/regenerate renderers) | FAIL (missing tests) | See Finding 1. |

## Confirmations requested by the commission

- **No mount-time fetch.** Confirmed. `useEffect` (entry-nudge.tsx:56-61) registers only an unmount cleanup. No fetch in component body.
- **Three post-click render states render correctly.** Confirmed by reading; not verified by test.
- **Regenerate click posts `refresh: true`.** Confirmed by reading; not verified by test.
- **Abort-on-unmount guard present and tested.** Guard present (mountedRef + AbortController; checked at lines 77, 81-82, 85). NOT tested. See Finding 1.
- **Every response field handled.** `source`, `stale`, `generatedAt`, `error` are consumed. `contentHash` is parsed into the typed response but intentionally not displayed; the spec does not require client display so this is acceptable. `metrics` likewise unused by this component.

## Recommendation

Dispatch Commission 5C (conditional fix) to Dalton with scope: add the missing interactive tests for `entry-nudge.tsx` (fresh/cache/stale render, Regenerate click, unmount-during-fetch). Findings 2 and 3 are reader's discretion.

## Decisions

**Does entry-nudge.tsx have a mount-time fetch per REQ-CNP-21?**
No mount-time fetch present. The single useEffect only registers an unmount cleanup (mountedRef=false + abort). No fetch call on mount.
*Reasoning: entry-nudge.tsx:56-61 shows useEffect with empty deps returning only a cleanup function. The only fetch path is inside runNudge, which is only invoked by onClick handlers on the Nudge/Regenerate buttons. Initial render branch at lines 93-105 returns only the Nudge button when result=null and error=null.*

**Are all three post-click render states correct (fresh, cache-current, cache-stale)?**
Yes. toResultState normalizes stale to a boolean; formatSavedLabel appends "— entry edited since" when stale=true. Fresh without stale -> plain "Saved X ago"; cache with stale=false -> plain "Saved X ago"; cache with stale=true -> with suffix. All three states render NudgeResults + saved label + Regenerate button.
*Reasoning: entry-nudge.tsx:107-126 renders NudgeResults plus savedRow whenever result exists. formatSavedLabel (lines 16-23) conditionally appends the suffix based on stale. Unit tests in entry-nudge.test.tsx verify the helper functions with both stale=false and stale=true inputs.*

**Does Regenerate click POST refresh: true?**
Yes. onClick on the Regenerate button calls runNudge(true) which passes { entryId, refresh: true } to requestNudge.
*Reasoning: entry-nudge.tsx:120 binds onClick to runNudge(true); lines 73-76 build the body as `refresh ? { entryId, refresh: true } : { entryId }`. api.ts:91-105 requestNudge accepts refresh and passes params through JSON.stringify unchanged.*

**Is the abort-on-unmount guard present and tested?**
Present in code but not tested. The guard works via mountedRef + AbortController: on unmount, mountedRef is flipped false and the in-flight controller is aborted; runNudge checks both before calling setState in both success and catch paths. However, entry-nudge.test.tsx does not exercise this path — the test file only covers pure helpers and initial SSR markup, with no interactive mount/unmount test.
*Reasoning: entry-nudge.tsx:56-61 registers the cleanup; lines 77, 81-82, and 85 check mountedRef.current and controller.signal.aborted before setState. Plan 5A (line 315) and spec Test Plan (line 275) both list "Component unmount during in-flight POST does not call setState" as a required test. The test file in packages/web/tests/entry-nudge.test.tsx has no such case — it uses renderToStaticMarkup which cannot exercise interactive state transitions, unmount, or async.*

**Are all response fields (source, stale, generatedAt, contentHash, error) handled?**
Partially. source, stale, generatedAt, and error are consumed. contentHash is read into the typed response but never used by the UI, which is acceptable because the spec does not require client display. One latent robustness concern: toResultState preserves stale regardless of source, so a malformed "fresh" response with stale:true would display the stale suffix. Low risk but not defended against.
*Reasoning: entry-nudge.tsx:40-47 toResultState copies source, stale (coerced), generatedAt; ignores contentHash and metrics. Line 79 consumes response.error into nudgeError. Spec REQ-CNP-13 states stale appears only with source="cache" — defensive code could gate stale on source, but the current code trusts the daemon.*
