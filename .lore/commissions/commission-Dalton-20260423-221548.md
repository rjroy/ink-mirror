---
title: "Commission: Phase 5E: Fix happy-dom global pollution breaking SSE tests"
date: 2026-04-24
status: dispatched
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
current_progress: ""
projectName: ink-mirror
---
