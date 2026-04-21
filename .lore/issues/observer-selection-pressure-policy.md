---
title: "Decide selection-pressure policy for Observer dimension set >= 5"
date: 2026-04-21
status: open
priority: low-until-triggered
type: design-decision
origin: .lore/brainstorm/observer-dimension-extension-20260420.md
tags: [design-decision, observer, selection-pressure, dimensions]
related:
  - .lore/brainstorm/observer-dimension-extension-20260420.md
  - .lore/specs/v1-core-loop.md
  - .lore/research/observation-granularity.md
---

# Selection-pressure policy for Observer dimension set ≥ 5

## Problem

The Observer caps output at 2-3 observations per entry (`ObserverOutputSchema` in `packages/shared/src/observations.ts:49-54`) and the system prompt asks the LLM to prefer different dimensions across those slots (`packages/daemon/src/observer.ts:118`).

At N=3 dimensions (today) and N=4 (after `.lore/specs/observer-paragraph-structure.md` lands), the cap comfortably covers the set. Each dimension usually gets an observation, or misses a turn at most.

At N=5 or N=6, the math breaks. Two or three observations cannot cover five or six dimensions; per-entry output becomes a sample. The writer's experience changes from "my writing was read along these dimensions" to "my writing was noticed for these things this time." Both are valid. They are different products.

The brainstorm (`.lore/brainstorm/observer-dimension-extension-20260420.md` Section 3) framed this as "a character change, not a tuning knob."

## Trigger

This issue becomes actionable when the dimension set approaches 5. Concretely: when a second spec lands that proposes a fifth dimension (the current candidates are `vocabulary-register` and `tonal-markers`, in that order), this policy must be resolved before that spec ships.

Not actionable now. Filing so the decision isn't lost.

## Three responses on the table

From the brainstorm's Section 3 table:

1. **Trust the LLM to pick best.** Zero change. Selection quality is unverified. Risk: the LLM will gravitate to dimensions with richer pre-computed metrics, so dimensions without metrics get under-selected.
2. **Keep the per-entry cap, rotate across sessions.** Observer tracks which dimensions it surfaced recently. The prompt hints "these have not been observed in the last N entries." Requires a small recent-dimension counter in the observation store. Medium change.
3. **Raise the cap proportionally.** Cap becomes 3-5 instead of 2-3. Violates the 2-3 pedagogy guideline from `observation-granularity.md`, which was written for an instructor-student dynamic. ink-mirror is a mirror, not a teacher — the research itself flagged the guideline's load-bearing assumption as weak here.

Each option has downstream consequences this issue doesn't resolve. The decision is a product decision, not a code decision.

## Inputs needed before deciding

- Has the vision re-review (`.lore/issues/vision-re-review-overdue.md`) closed? The re-review should inform whether "rotating emphasis" fits the product identity or whether "reliable spread" is load-bearing.
- How many dimensions exist at the decision moment? If dimension 5 is paired with clear metric signal (e.g., `vocabulary-register` with a register lexicon), the dimensions-without-metrics asymmetry in option 1 is less severe.
- What does the observation-evaluation gap (`.lore/issues/observation-evaluation-methodology.md`) produce by then? If there is any signal on selection quality, it feeds into the "trust the LLM" question directly.

## Reference

- Full analysis: `.lore/brainstorm/observer-dimension-extension-20260420.md` Section 3 ("Selection Pressure") and Section 6 ("Recommended Next Move") final paragraph on deferrals.
- Current cap: `packages/shared/src/observations.ts:49-54`.
- Current selection hint in prompt: `packages/daemon/src/observer.ts:118`.
