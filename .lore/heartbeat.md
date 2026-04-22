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
- 16:51 commission-Dalton-20260422-165008 result: Phase 1A complete. Extended `packages/shared/src/nudge.ts`: added optional `refresh` to `NudgeRequestSchema`; factored `NudgeMetricsSchema`; extended `NudgeResponseSchema` with `source` (enum), `stale...

- 16:52 commission-Dalton-20260422-165008 completed
- 16:53 commission-Thorne-20260422-165014 result: 
# Phase 1B Review — Shared Schema for Craft Nudge Persistence

**Verdict: APPROVED.** All checklist items from the plan are satisfied. No must-fix findings. Three nice-to-have observations noted belo...
- 16:54 commission-Thorne-20260422-165014 completed