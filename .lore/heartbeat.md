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
- 21:30 commission-Dalton-20260421-212827 result: Done. DIMENSION_LABELS consolidated into @ink-mirror/shared.

**Changes**
- `packages/shared/src/observations.ts`: added `export const DIMENSION_LABELS: Record<ObservationDimension, string>` after the...

- 21:30 commission-Dalton-20260421-212827 completed
- 21:32 commission-Thorne-20260421-212836 result: Refactor lands clean. All six required checks pass. No must-fix findings; one minor consistency nit and one style note for the reader's call.
- 21:32 commission-Thorne-20260421-212836 completed
- 21:36 commission-Octavia-20260421-213223 result: Spec written to `.lore/specs/craft-nudge-persistence.md`. Decisions resolved:

1. **Storage:** New `nudges/` directory, one YAML file per entry (`nudges/{entryId}.yaml`). Parallel to `observations/`, ...
- 21:36 commission-Octavia-20260421-213223 completed