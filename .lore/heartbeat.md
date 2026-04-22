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
- 19:45 commission-Octavia-20260421-194207 result: ## Validation Findings

All issue claims confirmed against the codebase. Two minor line number drifts — neither is material.

**`packages/daemon/src/profile-store.ts`:** `DIMENSION_LABELS` exists at l...

- 19:45 commission-Octavia-20260421-194207 completed