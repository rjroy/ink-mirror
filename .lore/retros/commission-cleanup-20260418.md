---
title: Commission batch cleanup (2026-03-28 to 2026-03-30)
date: 2026-04-18
status: complete
tags: [retro, commissions, cleanup]
---

## Context

Three commissions across two workers: the prior cleanup commission itself (Octavia, 2026-03-28), Dalton's Craft Nudge web UI wiring (2026-03-28), and Dalton's iOS keyboard zoom fix (2026-03-30). All completed cleanly. Both Dalton commissions shipped in commit `faf092e` (PR #6).

## What Worked

Both Dalton commissions ran single-shot: prompt in, tests+typecheck green, result submitted. No review cycle needed. The Craft Nudge wiring followed the existing proxy/fetchApi/CSS-module pattern exactly as specified, and the iOS fix was a three-attribute change to `app/layout.tsx`. Tight, well-scoped prompts produced tight, well-scoped diffs.

The iOS fix commission used `resource_overrides.model: sonnet` and executed without incident, which contrasts against the prior batch's `claude-sonnet-4-6` override that 500'd. Whatever the prior failure was, it wasn't a blanket override problem.

## Loose Threads

Prior retro's open threads that this batch did not touch:

1. **Phase 2B Observer integration** still has no independent review (session runner wiring, auto-trigger logic, observation storage).
2. **Craft Nudge manual LLM spot-check** against real output, per the spec's AI Validation section. Nudge is now wired in the UI, which makes the spot-check easier to perform but does not perform it.
3. **Contradiction detection** still uses 10 regex pairs.

Threads that closed since the prior retro (via commit `5d8fc21`, outside this batch's commissions):

- `@types/react`, `@types/node`, `@types/react-dom` are present in `packages/web/package.json`.
- `bun.lock` is committed at the repo root.

## Lessons

**Single-shot commissions are fine when the prompt already contains the review.** Both Dalton commissions had the acceptance criteria embedded in the prompt ("run `bun test` and `bun run typecheck` before declaring done", plus explicit file-by-file targets). No separate review commission was needed, and none would have added value. Reserve review cycles for commissions where the prompt can't fully specify "done."
