---
title: "Commission: Implement paragraph-structure dimension"
date: 2026-04-21
status: dispatched
tags: [commission]
worker: Dalton
workerDisplayTitle: "Guild Artificer"
prompt: "Implement `.lore/specs/observer-paragraph-structure.md` end-to-end.\n\n## Your source of truth\n\nRead `.lore/specs/observer-paragraph-structure.md` in full before starting. The spec is intentionally narrow: one new dimension, `paragraph-structure`. Do not expand scope. Do not touch vocabulary register, tonal markers, the 2-3 observation cap, or the label-map duplication.\n\n## What to build\n\nFollow the spec's \"Touch points\" section literally. Expect to modify:\n- `packages/shared/src/observations.ts` — zod enum\n- `packages/shared/src/metrics.ts` — any new pre-computed field(s) the spec names\n- `packages/daemon/src/observer.ts` — system prompt dimension list, definition, \"not this\" clause against `sentence-structure`, worked example if the spec calls for one\n- `packages/daemon/src/profile-store.ts` — `DIMENSION_LABELS`\n- `packages/cli/src/profile.ts` — BOTH local `labels` records (one in `showProfile`, one in `buildProfileMarkdown`). Do not consolidate them; that's a separate tracked issue.\n- `packages/daemon/src/curation.ts` — `OPPOSING_SIGNALS` additions per the spec (2-3 pairs)\n- `packages/daemon/src/metrics/sentence-structure.ts` — extend to surface the new paragraph signals the spec names. Keep existing signals intact.\n\n## Tests are mandatory\n\nWrite tests as part of this commission, not later:\n- Observer unit test covering the new dimension\n- Integration test covering curation contradiction detection for the new dimension\n- Analyzer tests for the new paragraph signals\n\nRun `bun test`, `bun run typecheck`, and `bun run lint` before reporting done. All must pass.\n\n## Posture\n\nThe spec is the contract. If you find the spec ambiguous or contradictory, stop and record the question in the commission notes — don't invent.\n\nNo CHANGELOG update (user handles that at release time).\n\n## Reporting\n\nReport:\n- Files changed with one-line per file of what changed\n- Test results summary (counts)\n- Any spec ambiguity you had to resolve and how\n- Anything out-of-spec you felt tempted to fix but didn't"
dependencies: []
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-04-21T16:00:20.198Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-04-21T16:00:20.201Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
current_progress: ""
projectName: ink-mirror
---
