---
title: "Commission: Phase 5E: Fix happy-dom global pollution breaking SSE tests"
date: 2026-04-24
status: completed
tags: [commission]
worker: Dalton
workerDisplayTitle: "Guild Artificer"
prompt: "## Context\n\nRead Thorne's review at `.lore/commissions/commission-Thorne-20260422-181532.md` (Phase 5D review of entry-nudge interactive tests). Address Finding 1 in full.\n\n## The bug\n\n`packages/web/tests/entry-nudge.test.tsx` calls `GlobalRegistrator.register()` from `@happy-dom/global-registrator` at module scope. This mutates **process-wide** globals (including `WritableStream`). When `bun test packages/web` runs the full suite, the happy-dom `WritableStream` shim leaks into `packages/web/tests/sse-streaming.test.ts`, where Hono's SSE handler calls `.getWriter()` on the stream — the shim lacks that method, so the SSE test crashes with `TypeError: writable.getWriter is not a function` and a 500 response.\n\nDalton (you, prior commission) reported \"bun test packages/web: 69 pass, 0 fail.\" That was wrong — it was the result of running the entry-nudge file in isolation. The real full-suite result is 68 pass / 1 fail.\n\n## What to do\n\nScope happy-dom's global registration so it does not pollute other test files. Pick whichever of these is cleanest:\n\n1. **`beforeAll` / `afterAll` in entry-nudge.test.tsx** — register at suite start, `GlobalRegistrator.unregister()` at suite end. This is the most surgical fix and keeps the change in the offending file.\n2. **Restore the specific globals you need post-test** — if `unregister()` doesn't fully restore `WritableStream`, snapshot the native `WritableStream` reference before registration and restore it in `afterAll`.\n3. **Separate test runner config for DOM tests** — if Bun supports a per-file or per-glob preload that isolates the DOM env, use that. Only worth it if (1) and (2) don't work.\n\nTry (1) first. Verify by running `bun test packages/web` (the full suite) and confirming both `entry-nudge.test.tsx` and `sse-streaming.test.ts` pass together.\n\n## Verification (must all be green before submitting)\n\n- `bun test packages/web` — full web suite, run as a single command. All tests pass.\n- `bun test` — full repo suite. All tests pass (1164+).\n- `bun run typecheck` — clean.\n- `bun run lint` — clean.\n\nDo not report success based on running individual files in isolation. The bug only manifests in the full suite.\n\n## Out of scope\n\n- The `Q1` finding from Thorne's Phase 4D review (required+empty numeric coerces to 0). File a stub note in your result if you want, but do not modify the executor.\n- Any other refactor."
dependencies:
  - commission-Thorne-20260422-181532
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-04-24T05:15:48.037Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-04-24T05:15:48.040Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
  - timestamp: 2026-04-24T05:15:48.067Z
    event: status_in_progress
    reason: "Execution started"
    from: "dispatched"
    to: "in_progress"
  - timestamp: 2026-04-24T05:16:56.479Z
    event: progress_report
    reason: "Reproduced bug: `bun test packages/web` → 68 pass, 1 fail with `TypeError: writable.getWriter is not a function`. Implementing Option 1: move happy-dom registration into describe-scoped beforeAll/afterAll."
  - timestamp: 2026-04-24T05:18:09.147Z
    event: progress_report
    reason: "Fix verified. `bun test packages/web` 69/0, full repo `bun test` 1171/0, typecheck clean, lint clean."
  - timestamp: 2026-04-24T05:18:29.644Z
    event: result_submitted
    reason: "\n# Phase 5D Finding 1 Fix — happy-dom global pollution\n\n## What changed\n\n`packages/web/tests/entry-nudge.test.tsx`:\n\n- Removed the module-scope `GlobalRegistrator.register(...)` call.\n- Added a `setupHappyDom()` helper that snapshots `WritableStream` / `ReadableStream` / `TransformStream` at file-load time, then registers happy-dom in `beforeAll` and unregisters + restores snapshotted stream globals in `afterAll` (Option 1 from Thorne's recommendation, with Option 2 layered on as a safety net).\n- Called `setupHappyDom()` inside the two describes that need a DOM: `EntryNudge interactive behavior` and `EntryNudge error handling`. The SSR-only (`renderToStaticMarkup`) and pure-function describes remain unaffected — they never see happy-dom.\n- `afterAll` is `async` and awaits `GlobalRegistrator.unregister()` (it returns a Promise; leaving it floating tripped `no-floating-promises`).\n\n## Why the snapshot-and-restore safety net\n\n`GlobalRegistrator.unregister()` does restore the globals it replaced in this version of happy-dom, but trusting that in perpetuity is fragile — a silent regression there would re-introduce the exact symptom Thorne caught. Snapshotting the three stream classes at module load and writing them back in `afterAll` makes the restoration independent of happy-dom's unregister behavior. Cost is trivial (three property assignments per describe teardown).\n\n## Verification (all run as single commands, not per-file)\n\n| Check | Result |\n|---|---|\n| `bun test packages/web` | **69 pass, 0 fail** (was 68/1) |\n| `bun test` (full repo) | **1171 pass, 0 fail** across 85 files |\n| `bun run typecheck` | clean |\n| `bun run lint` | clean |\n\nVerified the SSE failure is gone: the previously failing `SSE streaming > GET /events/observations returns SSE stream` now passes as part of the full web run.\n\n## Out of scope\n\nThorne's `Q1` (required+empty numeric coercing to `0`) from the Phase 4D review was not touched, per commission instructions. Noting here so the stub doesn't get lost: the executor coerces `\"\"` to `0` for required numerics; a separate commission should decide whether that's a bug or intended.\n\n## Lesson captured\n\nVerification that runs a single test file is not verification of the suite. Bun shares process globals across test files in the same run; any test that touches globals (especially via `GlobalRegistrator`-style shims) must scope its side effects or the pollution surfaces only in full-suite runs. Going forward: report full-suite results, and when a test needs a DOM, scope the DOM to the describe, never to the module.\n"
  - timestamp: 2026-04-24T05:18:33.865Z
    event: status_completed
    reason: "Execution completed"
    from: "in_progress"
    to: "completed"
current_progress: "Fix verified. `bun test packages/web` 69/0, full repo `bun test` 1171/0, typecheck clean, lint clean."
projectName: ink-mirror
---

# Phase 5D Finding 1 Fix — happy-dom global pollution

## What changed

`packages/web/tests/entry-nudge.test.tsx`:

- Removed the module-scope `GlobalRegistrator.register(...)` call.
- Added a `setupHappyDom()` helper that snapshots `WritableStream` / `ReadableStream` / `TransformStream` at file-load time, then registers happy-dom in `beforeAll` and unregisters + restores snapshotted stream globals in `afterAll` (Option 1 from Thorne's recommendation, with Option 2 layered on as a safety net).
- Called `setupHappyDom()` inside the two describes that need a DOM: `EntryNudge interactive behavior` and `EntryNudge error handling`. The SSR-only (`renderToStaticMarkup`) and pure-function describes remain unaffected — they never see happy-dom.
- `afterAll` is `async` and awaits `GlobalRegistrator.unregister()` (it returns a Promise; leaving it floating tripped `no-floating-promises`).

## Why the snapshot-and-restore safety net

`GlobalRegistrator.unregister()` does restore the globals it replaced in this version of happy-dom, but trusting that in perpetuity is fragile — a silent regression there would re-introduce the exact symptom Thorne caught. Snapshotting the three stream classes at module load and writing them back in `afterAll` makes the restoration independent of happy-dom's unregister behavior. Cost is trivial (three property assignments per describe teardown).

## Verification (all run as single commands, not per-file)

| Check | Result |
|---|---|
| `bun test packages/web` | **69 pass, 0 fail** (was 68/1) |
| `bun test` (full repo) | **1171 pass, 0 fail** across 85 files |
| `bun run typecheck` | clean |
| `bun run lint` | clean |

Verified the SSE failure is gone: the previously failing `SSE streaming > GET /events/observations returns SSE stream` now passes as part of the full web run.

## Out of scope

Thorne's `Q1` (required+empty numeric coercing to `0`) from the Phase 4D review was not touched, per commission instructions. Noting here so the stub doesn't get lost: the executor coerces `""` to `0` for required numerics; a separate commission should decide whether that's a bug or intended.

## Lesson captured

Verification that runs a single test file is not verification of the suite. Bun shares process globals across test files in the same run; any test that touches globals (especially via `GlobalRegistrator`-style shims) must scope its side effects or the pollution surfaces only in full-suite runs. Going forward: report full-suite results, and when a test needs a DOM, scope the DOM to the describe, never to the module.

