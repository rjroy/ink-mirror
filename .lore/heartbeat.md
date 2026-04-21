---
status: active
---
# Heartbeat

This file controls what the guild does autonomously. Every hour (configurable),
a Guild Master session reads this file and decides which standing orders warrant
action: creating commissions, dispatching work, or starting meetings.

**Standing Orders** are lines starting with `- `. Write them in plain language.
If you want the guild to check with you before acting on an order, say so in the
order itself.

**Watch Items** are things to monitor. The guild reads these for context but won't
create commissions from them directly.

**Context Notes** are operational context the guild should know (merge freezes, priorities).

**Recent Activity** is managed by the daemon. Don't edit this section manually.
Workers can also add entries to this file during their sessions.

## Standing Orders

## Watch Items

## Context Notes

## Recent Activity
- 08:51 commission-Octavia-20260421-084511 result: Delivered both artifacts, fully grounded in the brainstorm and verified against the codebase.

**Deliverable 1 — Spec**

- Path: `.lore/specs/observer-paragraph-structure.md`
- Sections: 9 numbered se...

- 08:51 commission-Octavia-20260421-084511 completed
- 09:11 commission-Dalton-20260421-090020 result: Implemented `.lore/specs/observer-paragraph-structure.md` end-to-end.

**Files changed:**
- `packages/shared/src/observations.ts` — added `"paragraph-structure"` to `ObservationDimensionSchema` enum.
...
- 09:11 commission-Dalton-20260421-090020 completed
- 09:14 commission-Thorne-20260421-090037 result: Implementation conforms to spec. All tests, typecheck, and lint pass. Three nit-level findings, no blockers. Recommend merge.
- 09:15 commission-Thorne-20260421-090037 completed
- 09:16 commission-Dalton-20260421-090047 result: Addressed Thorne's sole nit-level finding on the paragraph-structure worked example.

- 09:16 commission-Dalton-20260421-090047 completed
## Per-finding disposition

**Finding (nit): Worked example at observer.ts:167-170 did not demonstrate paragraph-l...