---
title: "Commission: Cleanup: remove dead fallback and unify import style in profile-store"
date: 2026-04-22
status: completed
tags: [commission]
worker: Dalton
workerDisplayTitle: "Guild Artificer"
prompt: "Small cleanup following Thorne's review of the label map consolidation.\n\nThorne's review findings (both non-blocking but should be consistent):\n\n1. **Dead fallback inconsistency.** `packages/daemon/src/profile-store.ts:89` and `:344` still use `DIMENSION_LABELS[dimension] ?? dimension`. Since `dimension: ObservationDimension` and `DIMENSION_LABELS` is `Record<ObservationDimension, string>`, the fallback is unreachable. The CLI sites (`packages/cli/src/profile.ts`) dropped the equivalent fallback in the same refactor. Remove the `?? dimension` fallbacks in the daemon sites for consistency with CLI and to drop dead code.\n\n2. **Import style.** In `packages/daemon/src/profile-store.ts` and `packages/cli/src/profile.ts`, the refactor produced two import lines:\n   ```typescript\n   import type { ObservationDimension } from \"@ink-mirror/shared\";\n   import { DIMENSION_LABELS } from \"@ink-mirror/shared\";\n   ```\n   Combine into one statement using inline `type`:\n   ```typescript\n   import { type ObservationDimension, DIMENSION_LABELS } from \"@ink-mirror/shared\";\n   ```\n   Or merge with whatever other imports already exist from `@ink-mirror/shared` in each file, keeping the inline `type` qualifier on type-only names.\n\nVerify with `bun run typecheck`, `bun run lint`, `bun test`. All must pass.\n\nNo other changes. This is a strict cleanup pass."
dependencies: []
linked_artifacts:
  - packages/daemon/src/profile-store.ts

  - packages/cli/src/profile.ts
  - packages/cli/src/profile.ts
activity_timeline:
  - timestamp: 2026-04-22T13:24:28.302Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-04-22T13:24:28.304Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
  - timestamp: 2026-04-22T13:24:28.324Z
    event: status_in_progress
    reason: "Execution started"
    from: "dispatched"
    to: "in_progress"
  - timestamp: 2026-04-22T13:24:46.777Z
    event: progress_report
    reason: "Read both files. Applying the two edits: merge imports and remove unreachable `?? dimension` fallbacks in profile-store.ts:89 and :344."
  - timestamp: 2026-04-22T13:25:24.113Z
    event: result_submitted
    reason: "Done. Applied both cleanups:\n\n1. **Dead fallbacks removed.** `packages/daemon/src/profile-store.ts:89` and `:344` now use `DIMENSION_LABELS[dimension]` directly (no `?? dimension`). Matches the CLI sites and drops unreachable code since `dimension: ObservationDimension` is always a key of `DIMENSION_LABELS`.\n\n2. **Imports merged.** Both `packages/daemon/src/profile-store.ts` and `packages/cli/src/profile.ts` now have a single `@ink-mirror/shared` import line using inline `type` qualifiers. Daemon: `import { type Profile, type ProfileRule, type ObservationDimension, DIMENSION_LABELS } from \"@ink-mirror/shared\";`. CLI: `import { type ObservationDimension, DIMENSION_LABELS } from \"@ink-mirror/shared\";`.\n\nVerification:\n- `bun run typecheck` — clean\n- `bun run lint` — clean\n- `bun test` — 1063 pass, 0 fail, across 82 files\n\nNo behavior changes; strict cleanup only."
  - timestamp: 2026-04-22T13:25:27.660Z
    event: status_completed
    reason: "Execution completed"
    from: "in_progress"
    to: "completed"
current_progress: "Read both files. Applying the two edits: merge imports and remove unreachable `?? dimension` fallbacks in profile-store.ts:89 and :344."
projectName: ink-mirror
---
Done. Applied both cleanups:

1. **Dead fallbacks removed.** `packages/daemon/src/profile-store.ts:89` and `:344` now use `DIMENSION_LABELS[dimension]` directly (no `?? dimension`). Matches the CLI sites and drops unreachable code since `dimension: ObservationDimension` is always a key of `DIMENSION_LABELS`.

2. **Imports merged.** Both `packages/daemon/src/profile-store.ts` and `packages/cli/src/profile.ts` now have a single `@ink-mirror/shared` import line using inline `type` qualifiers. Daemon: `import { type Profile, type ProfileRule, type ObservationDimension, DIMENSION_LABELS } from "@ink-mirror/shared";`. CLI: `import { type ObservationDimension, DIMENSION_LABELS } from "@ink-mirror/shared";`.

Verification:
- `bun run typecheck` — clean
- `bun run lint` — clean
- `bun test` — 1063 pass, 0 fail, across 82 files

No behavior changes; strict cleanup only.
