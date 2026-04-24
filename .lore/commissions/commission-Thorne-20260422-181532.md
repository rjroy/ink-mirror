---
title: "Commission: Phase 5D: Review entry-nudge interactive tests"
date: 2026-04-23
status: completed
tags: [commission]
worker: Thorne
workerDisplayTitle: "Guild Warden"
prompt: "Review Dalton's fix from commission `commission-Dalton-20260422-181513` addressing Phase 5B findings.\n\nScope: `packages/web/tests/entry-nudge.test.tsx` and any localized touch-ups in `packages/web/components/entry-nudge.tsx`.\n\nVerify the five required test cases from Thorne's Phase 5B review are present and actually exercise the interactive paths (not just SSR markup or helper functions):\n1. Click Nudge + fresh response renders Saved label + Regenerate.\n2. Click Nudge + cache response without stale.\n3. Click Nudge + cache response with stale shows \"— entry edited since\".\n4. Click Regenerate posts `refresh: true` and re-renders.\n5. Unmount during in-flight POST does not call setState.\n\nAlso check whether Dalton picked up the optional hardening (gating `stale` on `source === \"cache\"`; suppressing Saved label on error responses). Both are discretionary; flag if picked up inconsistently.\n\nConfirm no mount-time fetch was reintroduced. Confirm `bun test packages/web`, `bun run typecheck`, `bun run lint` all pass.\n\nCapture findings in commission result body."
dependencies:
  - commission-Dalton-20260422-181513
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-04-23T01:15:32.614Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-04-23T01:15:32.615Z
    event: status_blocked
    reason: "Dependencies not satisfied"
    from: "pending"
    to: "blocked"
  - timestamp: 2026-04-23T01:21:30.636Z
    event: status_pending
    reason: "Dependencies satisfied"
    from: "blocked"
    to: "pending"
  - timestamp: 2026-04-23T01:21:30.639Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
  - timestamp: 2026-04-23T01:21:30.657Z
    event: status_in_progress
    reason: "Execution started"
    from: "dispatched"
    to: "in_progress"
  - timestamp: 2026-04-23T01:21:50.477Z
    event: progress_report
    reason: "Read component + test file + Dalton's commission. All 5 required scenarios present. Checking for mount-time fetch reintroduction and running verification commands."
  - timestamp: 2026-04-23T01:24:05.525Z
    event: result_submitted
    reason: "\n# Phase 5C Review — Dalton commission-Dalton-20260422-181513\n\n## Verdict\n\nTest coverage work is correct and thorough. The five required interactive tests are present and actually exercise interactive paths. Both optional hardenings were picked up consistently. **However, Dalton's verification claim is wrong: `bun test packages/web` does not pass. A cross-file regression in `sse-streaming.test.ts` surfaces when both tests run in the same bun process.**\n\n---\n\n## Findings\n\n### Finding 1 — CRITICAL: Regression in `sse-streaming.test.ts` caused by `@happy-dom/global-registrator`\n\n**Where:** `packages/web/tests/entry-nudge.test.tsx:5-8` (registration); manifests in `packages/web/tests/sse-streaming.test.ts:59-65`.\n\n**Evidence:**\n- `bun test packages/web`: **68 pass, 1 fail** (not 69/0 as Dalton reported).\n- Failure: `SSE streaming > GET /events/observations returns SSE stream` — `TypeError: writable.getWriter is not a function` inside the daemon's SSE route, returning 500 instead of 200.\n- Controlled proof:\n  - `git stash` Dalton's changes, run `bun test packages/web/tests/sse-streaming.test.ts` alone → **4/4 pass**.\n  - Restore Dalton's changes, run sse-streaming alone → **4/4 pass**.\n  - Restore Dalton's changes, run `bun test packages/web/tests/entry-nudge.test.tsx packages/web/tests/sse-streaming.test.ts` → **21 pass, 1 fail** (SSE breaks).\n  - Order-independent: sse first then entry-nudge also fails. Bun test files in the same run share process globals, so once happy-dom is registered, it persists.\n\n**Root cause:** `GlobalRegistrator.register({ url: ... })` replaces bun's native `WritableStream` (and related) with happy-dom's shim. Happy-dom's `WritableStream` lacks `getWriter`, which Hono's SSE helper calls when producing `text/event-stream` responses. Registration is gated on `typeof document === \"undefined\"` but that gate only prevents double-registration, not the side effect on non-DOM tests sharing the process.\n\n**Why it matters:** Dalton reported the test suite clean. The commission explicitly required `bun test packages/web` to pass. SSE streaming is not a peripheral feature — it's the mechanism behind the web UI's live observations.\n\n**What to do:**\n- Isolate happy-dom to tests that need it. Options, in order of preference:\n  1. Give entry-nudge tests a separate bun test preload/setup file scoped by a glob or test-file naming (e.g. `*.dom.test.tsx`) and register happy-dom only there. Run `bun test` with split invocations or a `bunfig.toml` `preload` keyed to a subdirectory.\n  2. Snapshot and restore the affected globals (`WritableStream`, `ReadableStream`, etc.) in `beforeAll`/`afterAll` of the entry-nudge test — brittle, avoid if (1) is feasible.\n  3. Put DOM tests in `packages/web/tests/dom/` and configure CI to run `bun test packages/web/tests/dom` separately from `bun test packages/web` (non-DOM).\n\n### Finding 2 — Required test scenarios: all present and exercising interactive paths\n\n**Where:** `packages/web/tests/entry-nudge.test.tsx`\n\nChecked against the five-case scope:\n\n1. **Click Nudge + fresh response → Saved label + Regenerate** — `lines 225-258`. Real click via `findButton(\"Nudge\").click()`, asserts POST body has `entryId` only (no `refresh`), asserts rendered output contains `Craft Nudges`, the observation text, `Saved`, and locates a `Regenerate` button. ✓\n2. **Click Nudge + cache stale:false** — `lines 260-283`. Asserts the `— entry edited since` suffix is absent. ✓\n3. **Click Nudge + cache stale:true** — `lines 285-307`. Asserts the suffix is present. ✓\n4. **Click Regenerate posts `refresh: true`** — `lines 309-359`. Queues two responses, clicks Nudge then Regenerate, asserts two calls, first body has no `refresh`, second body has `refresh: true`, rendered observation swaps. ✓\n5. **Unmount during in-flight POST** — `lines 361-424`. Holds a `resolveFetch` closure, calls `root.unmount()` before resolving, then resolves post-unmount. Asserts no console errors matching `unmounted` / `memory leak` / `act(...`. Directly exercises the guard at `entry-nudge.tsx:79, 83-84, 87`. ✓\n\nNone are SSR-only or helper-only. All use `createRoot` + `act` + DOM assertions.\n\n### Finding 3 — Mount-time fetch: not reintroduced\n\n**Where:** `packages/web/components/entry-nudge.tsx:58-63`, `95-106`.\n\nThe `useEffect` has `[]` deps and contains only a cleanup closure (`mountedRef.current = false; abortRef.current?.abort()`). `runNudge` is invoked only from `onClick` handlers (lines 100, 122, 133). The initial render (line 95 guard) shows just the Nudge button until a click occurs. ✓\n\n### Finding 4 — Optional hardenings: both applied, consistent\n\n**Finding 2 of Phase 5B (stale gated on source === \"cache\"):**\n- Applied at `entry-nudge.tsx:46`: `stale: response.source === \"cache\" && response.stale === true`, with an explanatory comment at lines 44-45.\n- Regression test at `entry-nudge.test.tsx:145-156` asserts stale clamps to false when source is `\"fresh\"`.\n\n**Finding 3 of Phase 5B (suppress Saved label on error+empty):**\n- `entry-nudge.tsx:115` — saved row gated on `result.nudges.length > 0`.\n- `entry-nudge.tsx:129` — \"Try again\" row fires for `nudgeError && (!result || result.nudges.length === 0)`, preserving a retry affordance for both error-without-result and error-with-empty-nudges shapes.\n- Regression test at `entry-nudge.test.tsx:451-482` asserts `Saved` absent and `llm unavailable` present.\n\nBoth hardenings are applied without inconsistency. ✓\n\n### Finding 5 — typecheck / lint: clean\n\n- `bun run typecheck` → clean (no output).\n- `bun run lint` → clean (no output).\n\n### Finding 6 — minor: test file could not fail if component stopped rendering `— entry edited since` literally\n\n**Where:** `entry-nudge.test.tsx:282, 306`.\n\nThe assertions use `\\u2014 entry edited since` (em-dash + exact copy). This is fine, but note the component literal at `entry-nudge.tsx:22` is a real em-dash. If anyone changes the suffix wording (e.g., replaces the em-dash per the writing-style rule that bans them in prose), tests will fail loudly. Not an error — calling it out because the suffix text is duplicated between component and test with no shared constant. Discretionary.\n\n### Finding 7 — minor: `requestNudge` is injected via `globalThis.fetch` override, not a seam\n\n**Where:** `entry-nudge.test.tsx:196-208`.\n\nThe tests rely on `requestNudge` (in `lib/api.ts`) calling `fetch` at top level. If `requestNudge` is ever refactored to use a different HTTP transport or to wrap fetch in a module-level client, the tests silently degrade. Matches the convention Dalton cited (other web tests override `globalThis.fetch`), so not a defect — surfaced so you know the tests are coupled to `fetch`'s identity at call time. Discretionary.\n\n---\n\n## Requirement coverage against commission scope\n\n| Requirement | Status |\n|---|---|\n| 5 required test cases present | ✓ |\n| Exercise interactive paths (not SSR/helpers) | ✓ |\n| Finding 2 hardening applied | ✓ |\n| Finding 3 hardening applied | ✓ |\n| Findings 2/3 applied consistently | ✓ |\n| No mount-time fetch reintroduced | ✓ |\n| `bun test packages/web` passes | **✗ — 1 failing test** |\n| `bun run typecheck` passes | ✓ |\n| `bun run lint` passes | ✓ |\n\n## Recommendation\n\nDo not accept until Finding 1 is addressed. The sse-streaming failure is a real regression introduced by this commission's test infrastructure choice, not a pre-existing issue. Dalton's \"all passing\" report came from running the one test file in isolation. The fix is mechanical (isolate happy-dom's registration from non-DOM test files) but must be done before this change is merged — otherwise CI that runs `bun test packages/web` as a whole will break.\n"
  - timestamp: 2026-04-23T01:24:12.264Z
    event: status_completed
    reason: "Execution completed"
    from: "in_progress"
    to: "completed"
current_progress: "Read component + test file + Dalton's commission. All 5 required scenarios present. Checking for mount-time fetch reintroduction and running verification commands."
projectName: ink-mirror
---

# Phase 5C Review — Dalton commission-Dalton-20260422-181513

## Verdict

Test coverage work is correct and thorough. The five required interactive tests are present and actually exercise interactive paths. Both optional hardenings were picked up consistently. **However, Dalton's verification claim is wrong: `bun test packages/web` does not pass. A cross-file regression in `sse-streaming.test.ts` surfaces when both tests run in the same bun process.**

---

## Findings

### Finding 1 — CRITICAL: Regression in `sse-streaming.test.ts` caused by `@happy-dom/global-registrator`

**Where:** `packages/web/tests/entry-nudge.test.tsx:5-8` (registration); manifests in `packages/web/tests/sse-streaming.test.ts:59-65`.

**Evidence:**
- `bun test packages/web`: **68 pass, 1 fail** (not 69/0 as Dalton reported).
- Failure: `SSE streaming > GET /events/observations returns SSE stream` — `TypeError: writable.getWriter is not a function` inside the daemon's SSE route, returning 500 instead of 200.
- Controlled proof:
  - `git stash` Dalton's changes, run `bun test packages/web/tests/sse-streaming.test.ts` alone → **4/4 pass**.
  - Restore Dalton's changes, run sse-streaming alone → **4/4 pass**.
  - Restore Dalton's changes, run `bun test packages/web/tests/entry-nudge.test.tsx packages/web/tests/sse-streaming.test.ts` → **21 pass, 1 fail** (SSE breaks).
  - Order-independent: sse first then entry-nudge also fails. Bun test files in the same run share process globals, so once happy-dom is registered, it persists.

**Root cause:** `GlobalRegistrator.register({ url: ... })` replaces bun's native `WritableStream` (and related) with happy-dom's shim. Happy-dom's `WritableStream` lacks `getWriter`, which Hono's SSE helper calls when producing `text/event-stream` responses. Registration is gated on `typeof document === "undefined"` but that gate only prevents double-registration, not the side effect on non-DOM tests sharing the process.

**Why it matters:** Dalton reported the test suite clean. The commission explicitly required `bun test packages/web` to pass. SSE streaming is not a peripheral feature — it's the mechanism behind the web UI's live observations.

**What to do:**
- Isolate happy-dom to tests that need it. Options, in order of preference:
  1. Give entry-nudge tests a separate bun test preload/setup file scoped by a glob or test-file naming (e.g. `*.dom.test.tsx`) and register happy-dom only there. Run `bun test` with split invocations or a `bunfig.toml` `preload` keyed to a subdirectory.
  2. Snapshot and restore the affected globals (`WritableStream`, `ReadableStream`, etc.) in `beforeAll`/`afterAll` of the entry-nudge test — brittle, avoid if (1) is feasible.
  3. Put DOM tests in `packages/web/tests/dom/` and configure CI to run `bun test packages/web/tests/dom` separately from `bun test packages/web` (non-DOM).

### Finding 2 — Required test scenarios: all present and exercising interactive paths

**Where:** `packages/web/tests/entry-nudge.test.tsx`

Checked against the five-case scope:

1. **Click Nudge + fresh response → Saved label + Regenerate** — `lines 225-258`. Real click via `findButton("Nudge").click()`, asserts POST body has `entryId` only (no `refresh`), asserts rendered output contains `Craft Nudges`, the observation text, `Saved`, and locates a `Regenerate` button. ✓
2. **Click Nudge + cache stale:false** — `lines 260-283`. Asserts the `— entry edited since` suffix is absent. ✓
3. **Click Nudge + cache stale:true** — `lines 285-307`. Asserts the suffix is present. ✓
4. **Click Regenerate posts `refresh: true`** — `lines 309-359`. Queues two responses, clicks Nudge then Regenerate, asserts two calls, first body has no `refresh`, second body has `refresh: true`, rendered observation swaps. ✓
5. **Unmount during in-flight POST** — `lines 361-424`. Holds a `resolveFetch` closure, calls `root.unmount()` before resolving, then resolves post-unmount. Asserts no console errors matching `unmounted` / `memory leak` / `act(...`. Directly exercises the guard at `entry-nudge.tsx:79, 83-84, 87`. ✓

None are SSR-only or helper-only. All use `createRoot` + `act` + DOM assertions.

### Finding 3 — Mount-time fetch: not reintroduced

**Where:** `packages/web/components/entry-nudge.tsx:58-63`, `95-106`.

The `useEffect` has `[]` deps and contains only a cleanup closure (`mountedRef.current = false; abortRef.current?.abort()`). `runNudge` is invoked only from `onClick` handlers (lines 100, 122, 133). The initial render (line 95 guard) shows just the Nudge button until a click occurs. ✓

### Finding 4 — Optional hardenings: both applied, consistent

**Finding 2 of Phase 5B (stale gated on source === "cache"):**
- Applied at `entry-nudge.tsx:46`: `stale: response.source === "cache" && response.stale === true`, with an explanatory comment at lines 44-45.
- Regression test at `entry-nudge.test.tsx:145-156` asserts stale clamps to false when source is `"fresh"`.

**Finding 3 of Phase 5B (suppress Saved label on error+empty):**
- `entry-nudge.tsx:115` — saved row gated on `result.nudges.length > 0`.
- `entry-nudge.tsx:129` — "Try again" row fires for `nudgeError && (!result || result.nudges.length === 0)`, preserving a retry affordance for both error-without-result and error-with-empty-nudges shapes.
- Regression test at `entry-nudge.test.tsx:451-482` asserts `Saved` absent and `llm unavailable` present.

Both hardenings are applied without inconsistency. ✓

### Finding 5 — typecheck / lint: clean

- `bun run typecheck` → clean (no output).
- `bun run lint` → clean (no output).

### Finding 6 — minor: test file could not fail if component stopped rendering `— entry edited since` literally

**Where:** `entry-nudge.test.tsx:282, 306`.

The assertions use `\u2014 entry edited since` (em-dash + exact copy). This is fine, but note the component literal at `entry-nudge.tsx:22` is a real em-dash. If anyone changes the suffix wording (e.g., replaces the em-dash per the writing-style rule that bans them in prose), tests will fail loudly. Not an error — calling it out because the suffix text is duplicated between component and test with no shared constant. Discretionary.

### Finding 7 — minor: `requestNudge` is injected via `globalThis.fetch` override, not a seam

**Where:** `entry-nudge.test.tsx:196-208`.

The tests rely on `requestNudge` (in `lib/api.ts`) calling `fetch` at top level. If `requestNudge` is ever refactored to use a different HTTP transport or to wrap fetch in a module-level client, the tests silently degrade. Matches the convention Dalton cited (other web tests override `globalThis.fetch`), so not a defect — surfaced so you know the tests are coupled to `fetch`'s identity at call time. Discretionary.

---

## Requirement coverage against commission scope

| Requirement | Status |
|---|---|
| 5 required test cases present | ✓ |
| Exercise interactive paths (not SSR/helpers) | ✓ |
| Finding 2 hardening applied | ✓ |
| Finding 3 hardening applied | ✓ |
| Findings 2/3 applied consistently | ✓ |
| No mount-time fetch reintroduced | ✓ |
| `bun test packages/web` passes | **✗ — 1 failing test** |
| `bun run typecheck` passes | ✓ |
| `bun run lint` passes | ✓ |

## Recommendation

Do not accept until Finding 1 is addressed. The sse-streaming failure is a real regression introduced by this commission's test infrastructure choice, not a pre-existing issue. Dalton's "all passing" report came from running the one test file in isolation. The fix is mechanical (isolate happy-dom's registration from non-DOM test files) but must be done before this change is merged — otherwise CI that runs `bun test packages/web` as a whole will break.


## Decisions

**Does Dalton's fix introduce regressions in other web tests?**
Yes, critical regression: happy-dom global registration in entry-nudge.test.tsx breaks packages/web/tests/sse-streaming.test.ts when tests run together.
*Reasoning: Stashing Dalton's changes and running sse-streaming alone → 4 pass. Restoring Dalton's changes and running sse-streaming alone → 4 pass. But running entry-nudge then sse-streaming together → SSE test fails with 500 / TypeError: writable.getWriter is not a function. Bun tests share process globals; happy-dom's GlobalRegistrator replaces native WritableStream with a shim lacking getWriter, breaking Hono's SSE stream handling. Dalton reported 'bun test packages/web: 69 pass, 0 fail' but actual result is 68 pass / 1 fail. Dalton ran the isolated entry-nudge file, not the full suite.*

**Are all five required test cases present and exercising interactive paths?**
Yes. All five required scenarios are implemented with real click events, rendered DOM assertions, and fetch body inspection.
*Reasoning: Test 1 (lines 225-258): clicks Nudge, asserts POST body has no refresh, asserts 'Craft Nudges'/observation/'Saved'/Regenerate render. Test 2 (260-283): cache + stale:false, asserts '— entry edited since' absent. Test 3 (285-307): cache + stale:true, asserts suffix present. Test 4 (309-359): two-call sequence, asserts second body.refresh=true, new observation replaces first. Test 5 (361-424): fetch held pending with resolveFetch closure, root.unmount before resolve, then resolve post-unmount. Asserts no console errors matching unmount/memory-leak/act patterns. All exercise interactive paths via createRoot/act, not SSR or helpers.*

**Was mount-time fetch reintroduced?**
No. The component only fetches in response to button clicks.
*Reasoning: entry-nudge.tsx:58-63 useEffect has [] deps and only defines a cleanup (mountedRef=false, abort). runNudge is invoked only from button onClick handlers (lines 100, 122, 133). No mount-time fetch.*

**Were optional hardenings (Findings 2 and 3) applied?**
Both applied. Finding 2 gates stale on source==='cache' in toResultState (entry-nudge.tsx:46). Finding 3 suppresses Saved row when nudges empty (line 115).
*Reasoning: Finding 2: line 46 'stale: response.source === "cache" && response.stale === true' with explanatory comment. Test at 145-156 asserts stale clamps to false for fresh responses. Finding 3: line 115 savedRow gated on 'result.nudges.length > 0'; line 129 Try-again row fires for 'nudgeError && (!result || result.nudges.length === 0)'. Test at 451-482 asserts Saved label absent and error text present for error+empty response. Both applied consistently; no inconsistency to flag.*

**Do typecheck and lint pass?**
Yes for both. Only the web test suite has a regression.
*Reasoning: bun run typecheck: clean (tsc --build && tsc --noEmit -p packages/web, no output). bun run lint: clean (eslint, no output). The fail is only in bun test packages/web due to cross-file global-state pollution.*
