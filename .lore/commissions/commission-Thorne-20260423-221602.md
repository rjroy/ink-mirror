---
title: "Commission: Phase 5F: Review happy-dom isolation fix"
date: 2026-04-24
status: blocked
tags: [commission]
worker: Thorne
workerDisplayTitle: "Guild Warden"
prompt: "## Context\n\nRead `.lore/commissions/commission-Dalton-20260423-221548.md` for what Dalton just did. He was assigned to fix Finding 1 from your Phase 5D review (`.lore/commissions/commission-Thorne-20260422-181532.md`) — happy-dom global registration in `packages/web/tests/entry-nudge.test.tsx` was polluting `WritableStream` and breaking `packages/web/tests/sse-streaming.test.ts` when the full web suite runs.\n\n## What to verify\n\n1. Run `bun test packages/web` (the full web suite, single command). Confirm:\n   - All tests pass.\n   - `entry-nudge.test.tsx` and `sse-streaming.test.ts` both run and both pass.\n   - No `TypeError: writable.getWriter is not a function` or similar global-pollution symptoms.\n2. Run `bun test` (full repo). Confirm 1164+ pass, 0 fail.\n3. Run `bun run typecheck` and `bun run lint`. Both clean.\n4. Inspect Dalton's change — does the isolation actually scope happy-dom registration? If he used `beforeAll`/`afterAll`, does `unregister()` restore the native `WritableStream`? Try also running the DOM tests in **reverse order** with `sse-streaming` first, then `entry-nudge`, then another non-DOM test if one exists, to make sure registration order doesn't matter.\n5. Confirm no test in `entry-nudge.test.tsx` was weakened or skipped to make the global cleanup easier (all 5 originally-required scenarios still present and asserting the same things).\n\n## Reporting\n\nIf everything passes and the fix is sound: PASS verdict, brief summary.\n\nIf there's any regression or the isolation is incomplete: FAIL verdict with exact reproduction steps, file:line references, and what would need to change."
dependencies:
  - commission-Dalton-20260423-221548
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-04-24T05:16:02.385Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-04-24T05:16:02.386Z
    event: status_blocked
    reason: "Dependencies not satisfied"
    from: "pending"
    to: "blocked"
current_progress: ""
projectName: ink-mirror
---
