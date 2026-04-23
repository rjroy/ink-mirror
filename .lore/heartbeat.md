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
- 18:17 commission-Dalton-20260422-181456 result: Both bugs fixed.

**Finding 1 — executor type coercion** (`packages/cli/src/executor.ts`):
- Added `coerceArg()` that coerces raw positional args to the parameter's declared type.
- `boolean`: accepts...

- 18:17 commission-Dalton-20260422-181456 completed
- 18:19 commission-Thorne-20260422-181524 result: ## Verdict

Dalton's fix is correct and complete for Phase 4B findings. All verification criteria are satisfied. One latent edge case is worth flagging but is outside the commission's stated scope.

#...
- 18:19 commission-Thorne-20260422-181524 completed