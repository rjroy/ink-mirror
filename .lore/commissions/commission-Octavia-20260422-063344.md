---
title: "Commission: Plan: Craft nudge persistence implementation"
date: 2026-04-22
status: dispatched
tags: [commission]
worker: Octavia
workerDisplayTitle: "Guild Chronicler"
prompt: "Write the implementation plan for the craft nudge persistence spec.\n\nSpec: `.lore/specs/craft-nudge-persistence.md` (approved).\n\nReference implementation pattern: `packages/daemon/src/observation-store.ts` is the style guide for the new `NudgeStore`. The route under edit is `packages/daemon/src/routes/nudge.ts`. The web client lives at `packages/web/components/entry-nudge.tsx` and `packages/web/lib/api.ts`.\n\nStructure the plan as an ordered sequence of focused commissions (2-3 phases each, right-sized per Guild Master conventions). Each phase should be a coherent chunk with explicit verification steps.\n\nLikely shape (but verify and adjust):\n\n1. **Shared schema updates.** Extend `NudgeResponseSchema` with `source`, `stale`, `generatedAt`, `contentHash`. Add `refresh` to request schema. Any new `SavedNudge` type.\n2. **NudgeStore.** New file `packages/daemon/src/nudge-store.ts` mirroring `observation-store.ts` style. Unit tests. Factory wired through DI.\n3. **Route integration.** Update `packages/daemon/src/routes/nudge.ts` to read cache, write cache, handle refresh, compute hash, handle direct-text bypass. Update `NudgeDeps`. Wire `nudgeStore` in `packages/daemon/src/index.ts`. Route tests covering all cache/refresh/stale/direct-text/error matrices per the spec's Test Plan.\n4. **CLI surface.** Add `refresh` boolean param to the nudge.analyze operation definition. Confirm CLI discovery picks it up. No executor changes.\n5. **Web surface.** Update `requestNudge` signature and `entry-nudge.tsx` to fetch on mount, render Saved/Stale/Regenerate states, and POST with `refresh: true` when regenerating. Component tests.\n\nCall out dependencies explicitly (shared schema must land before route work; store must land before route integration; route work must land before web work).\n\nFor each commission proposal, list:\n- Title\n- Worker (Dalton for build, Thorne for review)\n- Dependencies (by phase name for now; I'll assign commission IDs when dispatching)\n- Scope (what changes, what tests, what verification commands)\n- Out of scope (what the next phase handles)\n\nInclude a review gate after any phase that touches a shared foundation other phases depend on. Per Guild Master convention: implement → review → fix, then fan out.\n\nWrite the plan to `.lore/plans/craft-nudge-persistence.md`. Keep it actionable — this is the dispatch guide for the build, not an essay."
dependencies: []
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-04-22T13:33:44.015Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-04-22T13:33:44.019Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
current_progress: ""
projectName: ink-mirror
---
