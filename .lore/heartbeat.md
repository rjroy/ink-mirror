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
- 16:58 commission-Dalton-20260422-165021 result: Phase 2A complete: NudgeStore built and verified.

**Thorne 1B review handling**: No must-fix findings. Two nice-to-haves (discriminated union enforcing REQ-CNP-14 at schema level; sha256: regex on co...
- 16:58 commission-Dalton-20260422-165021 completed
- 17:02 commission-Thorne-20260422-165027 result: 
# Phase 2B Review — NudgeStore

**Verdict: APPROVED.** All 2B checklist items pass. REQ-CNP-1, REQ-CNP-2, REQ-CNP-15 are cleanly satisfied. REQ-CNP-16 has a deliberate plan-driven drift (`now?` omitt...
- 17:02 commission-Thorne-20260422-165027 completed
- 17:09 commission-Dalton-20260422-165038 result: 
# Phase 3A Complete — Nudge Route Persistence

**Status:** All Phase 3A verification passes. Thorne 2B findings addressed.

- 17:09 commission-Dalton-20260422-165038 completed
- 17:12 commission-Thorne-20260422-165045 result: # Phase 3A Review: Nudge Route Persistence

**Verdict: PASS.** Phase 3A satisfies REQ-CNP-3 through REQ-CNP-11, REQ-CNP-17, and REQ-CNP-18. Fan-out to Phases 4 and 5 can proceed. No 3C fix commission ...
- 17:12 commission-Thorne-20260422-165045 completed
- 17:14 commission-Dalton-20260422-165050 result: ## Phase 3C — Fix: Thorne's 3B findings addressed

**Verdict:** All actionable findings resolved. Verification clean.

### Findings dispatched

| # | Severity | Action taken |
|---|----------|--------...
- 17:14 commission-Dalton-20260422-165050 completed
## Verification

- `bun test packages/daemon` → 416 pass, 0 fail (1009 expe...