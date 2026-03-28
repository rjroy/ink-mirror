---
title: "Review: Craft Nudge (Step 5 Spec Validation)"
date: 2026-03-28
status: resolved
reviewer: Thorne
resolver: Dalton
tags: [review, craft-nudge]
---

## Verdict

Implementation is solid. All 37 REQ-CN requirements verified against code. Two findings, both resolved.

## Findings

### F1 (Medium, RESOLVED): Worked example question implies a rewrite

`nudger.ts:141` -- The worked example question's second clause ("or did specific people start the project and gather requirements?") constructs the active-voice alternative by implication. The LLM will model its output on this example.

**Fix:** Shortened to "The passive voice here reads as institutional report register. Was that your intent?" Removed the "or did..." clause.

### F2 (Low, RESOLVED): Profile reader failures propagate as unhandled 500s

`nudger.ts:46-48` -- A `readStyleProfile` that throws propagated as 500, taking down the nudge endpoint even though the spec says profiles are optional calibration.

**Fix:** Wrapped in try/catch. Profile read failures are silently absorbed since profile is optional calibration (REQ-CN-15). Added test covering this path.

## Verification

- `bun test`: 1009 pass, 0 fail
- `bun run typecheck`: clean
- New test: "survives readStyleProfile failure without throwing"
