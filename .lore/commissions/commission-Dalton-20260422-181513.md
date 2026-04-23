---
title: "Commission: Phase 5C: Add interactive tests for entry-nudge component"
date: 2026-04-23
status: dispatched
tags: [commission]
worker: Dalton
workerDisplayTitle: "Guild Artificer"
prompt: "Add the missing interactive tests for the entry-nudge web component surfaced by Thorne's Phase 5B review (`.lore/commissions/commission-Thorne-20260422-165123.md`).\n\nThe component behavior is correct by reading, but `packages/web/tests/entry-nudge.test.tsx` currently covers only helper functions and a single SSR markup assertion. The click paths, render-state transitions, and abort-on-unmount guard have no direct test.\n\n## Scope\n\nAdd tests against `packages/web/components/entry-nudge.tsx`, using a DOM-capable renderer that matches the project's web test conventions (React Testing Library against jsdom is the likely choice — check what other web tests already use and match it).\n\nRequired test cases (per Thorne's Finding 1):\n\n1. Click Nudge on an entry with no saved nudge → POST issued without `refresh`, fresh response renders nudges + Saved label + Regenerate button.\n2. Click Nudge → cache response with `stale: false` renders nudges without the \"— entry edited since\" suffix.\n3. Click Nudge → cache response with `stale: true` renders the \"— entry edited since\" suffix.\n4. Click Regenerate → POST issued with `refresh: true`; rendered result updates with the new `generatedAt`.\n5. Mount, click Nudge, unmount before the fetch resolves, then resolve the fetch → no setState warning, no crash. This exercises the abort-on-unmount guard at entry-nudge.tsx:56-61, 77, 81-82, 85.\n\nInject `requestNudge` via module mock or test-only prop — match whatever pattern the rest of the web tests use. Do not use `mock.module()` per project convention.\n\n## Optional hardening (Thorne Findings 2 and 3)\n\nReader (Dalton) discretion:\n- **Finding 2**: gate `stale` on `response.source === \"cache\"` inside `toResultState` so a malformed fresh response cannot display the stale suffix. Safe defensive change.\n- **Finding 3**: suppress the \"Saved\" label when the response has `error` set and empty `nudges`, since REQ-CNP-7 forbids persisting those responses.\n\nInclude both if they are small and localized. Skip either if doing so would expand the blast radius beyond `entry-nudge.tsx`.\n\n## Verify\n\n```\nbun test packages/web\nbun run typecheck\nbun run lint\n```\n\nAll must pass."
dependencies: []
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-04-23T01:15:13.365Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-04-23T01:15:13.366Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
current_progress: ""
projectName: ink-mirror
---
