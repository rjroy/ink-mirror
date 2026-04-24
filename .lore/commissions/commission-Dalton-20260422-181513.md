---
title: "Commission: Phase 5C: Add interactive tests for entry-nudge component"
date: 2026-04-23
status: completed
tags: [commission]
worker: Dalton
workerDisplayTitle: "Guild Artificer"
prompt: "Add the missing interactive tests for the entry-nudge web component surfaced by Thorne's Phase 5B review (`.lore/commissions/commission-Thorne-20260422-165123.md`).\n\nThe component behavior is correct by reading, but `packages/web/tests/entry-nudge.test.tsx` currently covers only helper functions and a single SSR markup assertion. The click paths, render-state transitions, and abort-on-unmount guard have no direct test.\n\n## Scope\n\nAdd tests against `packages/web/components/entry-nudge.tsx`, using a DOM-capable renderer that matches the project's web test conventions (React Testing Library against jsdom is the likely choice — check what other web tests already use and match it).\n\nRequired test cases (per Thorne's Finding 1):\n\n1. Click Nudge on an entry with no saved nudge → POST issued without `refresh`, fresh response renders nudges + Saved label + Regenerate button.\n2. Click Nudge → cache response with `stale: false` renders nudges without the \"— entry edited since\" suffix.\n3. Click Nudge → cache response with `stale: true` renders the \"— entry edited since\" suffix.\n4. Click Regenerate → POST issued with `refresh: true`; rendered result updates with the new `generatedAt`.\n5. Mount, click Nudge, unmount before the fetch resolves, then resolve the fetch → no setState warning, no crash. This exercises the abort-on-unmount guard at entry-nudge.tsx:56-61, 77, 81-82, 85.\n\nInject `requestNudge` via module mock or test-only prop — match whatever pattern the rest of the web tests use. Do not use `mock.module()` per project convention.\n\n## Optional hardening (Thorne Findings 2 and 3)\n\nReader (Dalton) discretion:\n- **Finding 2**: gate `stale` on `response.source === \"cache\"` inside `toResultState` so a malformed fresh response cannot display the stale suffix. Safe defensive change.\n- **Finding 3**: suppress the \"Saved\" label when the response has `error` set and empty `nudges`, since REQ-CNP-7 forbids persisting those responses.\n\nInclude both if they are small and localized. Skip either if doing so would expand the blast radius beyond `entry-nudge.tsx`.\n\n## Verify\n\n```\nbun test packages/web\nbun run typecheck\nbun run lint\n```\n\nAll must pass."
dependencies: []
linked_artifacts:
  - packages/web/tests/entry-nudge.test.tsx

  - packages/web/components/entry-nudge.tsx
  - packages/web/package.json
  - bun.lock
  - packages/web/components/entry-nudge.tsx
  - packages/web/package.json
  - bun.lock
activity_timeline:
  - timestamp: 2026-04-23T01:15:13.365Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-04-23T01:15:13.366Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
  - timestamp: 2026-04-23T01:15:13.386Z
    event: status_in_progress
    reason: "Execution started"
    from: "dispatched"
    to: "in_progress"
  - timestamp: 2026-04-23T01:18:20.960Z
    event: progress_report
    reason: "Explored code + test conventions. No existing DOM test infra — installed @happy-dom/global-registrator for jsdom-style rendering. Writing interactive tests using react-dom/client + act, overriding globalThis.fetch to match existing web test pattern."
  - timestamp: 2026-04-23T01:21:27.442Z
    event: result_submitted
    reason: "Added 7 new interactive tests for `packages/web/components/entry-nudge.tsx`, covering all five scenarios from Thorne Finding 1, plus both optional hardenings (Findings 2 and 3).\n\n**Test infrastructure introduced**\n- Added `@happy-dom/global-registrator` as a devDependency in `packages/web`. Registered at the top of the test file when `document` is undefined. This is the bun-recommended path for DOM testing and keeps the footprint small (no testing-library).\n- Interactive tests use `createRoot` from `react-dom/client` plus `act` from React 19. Mocks follow the project convention of overriding `globalThis.fetch` rather than `mock.module()`.\n- Added a file-level `/* eslint-disable @typescript-eslint/require-await */` with a comment, because both `act(async () => { syncWork })` and the `typeof fetch` mock shape legitimately require async callbacks without inner awaits.\n\n**Tests added (all in `packages/web/tests/entry-nudge.test.tsx`)**\n1. Click Nudge with no saved nudge: asserts POST body `{ entryId }` with no `refresh`, and that the rendered output contains \"Craft Nudges\", the nudge observation text, \"Saved\", and a \"Regenerate\" button.\n2. Cache response with `stale: false`: asserts the \"— entry edited since\" suffix is absent.\n3. Cache response with `stale: true`: asserts the suffix is present.\n4. Click Regenerate: asserts two POST calls, the second with `refresh: true`, and that the rendered nudge text swaps to the second response's content.\n5. Mount + click + unmount + fetch-resolves-after-unmount: pending `fetch` is resolved manually after `root.unmount()`; asserts no crash and no unmount/state-leak console errors. This exercises the guard at `entry-nudge.tsx:56-61, 77, 81-82, 85`.\n6. `toResultState` with `source: \"fresh\"` and `stale: true` (Finding 2 regression test): asserts the defensive gate clamps stale to `false`.\n7. Error + empty nudges response (Finding 3 regression test): asserts the \"Saved\" label is suppressed and the error text is rendered.\n\n**Component changes (`packages/web/components/entry-nudge.tsx`)**\n- Finding 2: `toResultState` now sets `stale` to `response.source === \"cache\" && response.stale === true`. Brief comment explains why the gate exists.\n- Finding 3: the `savedRow` containing the \"Saved\" label and Regenerate button only renders when `result.nudges.length > 0`. The fallback \"Try again\" row now fires whenever we have an error and no usable nudges, so the error-with-no-result and error-with-empty-nudges cases both get a retry affordance.\n\n**Verification**\n- `bun test packages/web`: 69 pass, 0 fail, 153 expect() calls. The new test file adds 18 tests (7 new + 11 previously existing; all pass).\n- `bun run typecheck`: clean.\n- `bun run lint`: clean."
  - timestamp: 2026-04-23T01:21:30.400Z
    event: status_completed
    reason: "Execution completed"
    from: "in_progress"
    to: "completed"
current_progress: "Explored code + test conventions. No existing DOM test infra — installed @happy-dom/global-registrator for jsdom-style rendering. Writing interactive tests using react-dom/client + act, overriding globalThis.fetch to match existing web test pattern."
projectName: ink-mirror
---
Added 7 new interactive tests for `packages/web/components/entry-nudge.tsx`, covering all five scenarios from Thorne Finding 1, plus both optional hardenings (Findings 2 and 3).

**Test infrastructure introduced**
- Added `@happy-dom/global-registrator` as a devDependency in `packages/web`. Registered at the top of the test file when `document` is undefined. This is the bun-recommended path for DOM testing and keeps the footprint small (no testing-library).
- Interactive tests use `createRoot` from `react-dom/client` plus `act` from React 19. Mocks follow the project convention of overriding `globalThis.fetch` rather than `mock.module()`.
- Added a file-level `/* eslint-disable @typescript-eslint/require-await */` with a comment, because both `act(async () => { syncWork })` and the `typeof fetch` mock shape legitimately require async callbacks without inner awaits.

**Tests added (all in `packages/web/tests/entry-nudge.test.tsx`)**
1. Click Nudge with no saved nudge: asserts POST body `{ entryId }` with no `refresh`, and that the rendered output contains "Craft Nudges", the nudge observation text, "Saved", and a "Regenerate" button.
2. Cache response with `stale: false`: asserts the "— entry edited since" suffix is absent.
3. Cache response with `stale: true`: asserts the suffix is present.
4. Click Regenerate: asserts two POST calls, the second with `refresh: true`, and that the rendered nudge text swaps to the second response's content.
5. Mount + click + unmount + fetch-resolves-after-unmount: pending `fetch` is resolved manually after `root.unmount()`; asserts no crash and no unmount/state-leak console errors. This exercises the guard at `entry-nudge.tsx:56-61, 77, 81-82, 85`.
6. `toResultState` with `source: "fresh"` and `stale: true` (Finding 2 regression test): asserts the defensive gate clamps stale to `false`.
7. Error + empty nudges response (Finding 3 regression test): asserts the "Saved" label is suppressed and the error text is rendered.

**Component changes (`packages/web/components/entry-nudge.tsx`)**
- Finding 2: `toResultState` now sets `stale` to `response.source === "cache" && response.stale === true`. Brief comment explains why the gate exists.
- Finding 3: the `savedRow` containing the "Saved" label and Regenerate button only renders when `result.nudges.length > 0`. The fallback "Try again" row now fires whenever we have an error and no usable nudges, so the error-with-no-result and error-with-empty-nudges cases both get a retry affordance.

**Verification**
- `bun test packages/web`: 69 pass, 0 fail, 153 expect() calls. The new test file adds 18 tests (7 new + 11 previously existing; all pass).
- `bun run typecheck`: clean.
- `bun run lint`: clean.
