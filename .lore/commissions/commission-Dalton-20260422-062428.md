---
title: "Commission: Cleanup: remove dead fallback and unify import style in profile-store"
date: 2026-04-22
status: dispatched
tags: [commission]
worker: Dalton
workerDisplayTitle: "Guild Artificer"
prompt: "Small cleanup following Thorne's review of the label map consolidation.\n\nThorne's review findings (both non-blocking but should be consistent):\n\n1. **Dead fallback inconsistency.** `packages/daemon/src/profile-store.ts:89` and `:344` still use `DIMENSION_LABELS[dimension] ?? dimension`. Since `dimension: ObservationDimension` and `DIMENSION_LABELS` is `Record<ObservationDimension, string>`, the fallback is unreachable. The CLI sites (`packages/cli/src/profile.ts`) dropped the equivalent fallback in the same refactor. Remove the `?? dimension` fallbacks in the daemon sites for consistency with CLI and to drop dead code.\n\n2. **Import style.** In `packages/daemon/src/profile-store.ts` and `packages/cli/src/profile.ts`, the refactor produced two import lines:\n   ```typescript\n   import type { ObservationDimension } from \"@ink-mirror/shared\";\n   import { DIMENSION_LABELS } from \"@ink-mirror/shared\";\n   ```\n   Combine into one statement using inline `type`:\n   ```typescript\n   import { type ObservationDimension, DIMENSION_LABELS } from \"@ink-mirror/shared\";\n   ```\n   Or merge with whatever other imports already exist from `@ink-mirror/shared` in each file, keeping the inline `type` qualifier on type-only names.\n\nVerify with `bun run typecheck`, `bun run lint`, `bun test`. All must pass.\n\nNo other changes. This is a strict cleanup pass."
dependencies: []
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-04-22T13:24:28.302Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-04-22T13:24:28.304Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
current_progress: ""
projectName: ink-mirror
---
