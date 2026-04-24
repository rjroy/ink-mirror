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
- 22:18 commission-Dalton-20260423-221548 result: 
# Phase 5D Finding 1 Fix — happy-dom global pollution

- 22:18 commission-Dalton-20260423-221548 completed
- 22:21 commission-Thorne-20260423-221602 result: 
# Verdict: PASS

Dalton's fix for the happy-dom global pollution bug is sound. The full web suite, the full repo suite, typecheck, and lint all run clean. The isolation works regardless of test execu...
- 22:21 commission-Thorne-20260423-221602 completed
## What changed

`packages/web/tests/entry-nudge.test.tsx`:

- Removed the module-scope `GlobalRegistrator.register(...)` call.
- Added a `setup...
