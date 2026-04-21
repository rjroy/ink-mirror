---
title: "Run vision re-review — trigger has fired"
date: 2026-04-21
status: open
priority: medium
type: vision
origin: .lore/brainstorm/observer-dimension-extension-20260420.md
tags: [vision, review, governance]
related:
  - .lore/vision.md
  - .lore/brainstorm/observer-dimension-extension-20260420.md
---

# Run vision re-review — trigger has fired

## Problem

`.lore/vision.md` defines `review_trigger: "After first working prototype delivers the write-observe-curate loop"`. The trigger has fired — v1 core loop plus Craft Nudge shipped end-to-end on 2026-04-18 (confirmed in project memory).

The vision was last reviewed 2026-03-26 by Ronald Roy (`reviewed_date: 2026-03-26` in the frontmatter), two weeks before the core loop shipped. No re-review has happened since the trigger fired.

The brainstorm (`.lore/brainstorm/observer-dimension-extension-20260420.md` Section "Frame" and Section "Risks" final bullet) flagged this explicitly: dimension expansion is exactly the kind of decision that benefits from reconfirming the vision principles first.

## Trigger (why now)

Before the next non-trivial expansion. Concretely: before starting implementation of any second Observer dimension beyond `paragraph-structure`, or before starting any spec that changes the observation cap, the Tier 2 threshold, the curation model, or the Observer's role. The `paragraph-structure` spec itself is narrow enough to proceed without blocking on this, but it is the last expansion that should.

## What the re-review covers

From the vision's own terms: reconfirm, adjust, or replace the principles, anti-goals, and "What It Is Not" clauses against what v1 actually produced. Specific prompts the re-review should answer:

- **Are the anti-goals still the right anti-goals?** "Not a writing course" is load-bearing in the Craft Nudge boundary. "Not generating for the writer" is load-bearing in the Observer. Are there anti-goals that only became visible after v1 ran?
- **Do the principles still explain the product?** "Feedback Accelerates Skill," "Observations over Evaluations" — do they still describe what ink-mirror does, or has the product drifted from them?
- **What should Observer dimension expansion look like?** This is the concrete question that prompted filing the issue. The re-review's answer shapes whether the project adds `vocabulary-register` and `tonal-markers` (the deferred candidates) and how.

## Scope

- Read the current vision, compare against what v1 plus Craft Nudge actually does.
- Update or replace clauses that no longer match.
- Update `reviewed_by` and `reviewed_date` frontmatter. Either keep `review_trigger` (pointing at the next inflection) or add a new one.
- If the vision is unchanged, record that explicitly in a short re-review note so the absence of changes is intentional, not accidental.

Out of scope: retroactively specs-ing previous decisions. The re-review informs upcoming decisions, not past ones.

## Reference

- Vision: `.lore/vision.md` (frontmatter `reviewed_date: 2026-03-26`, `review_trigger: "After first working prototype delivers the write-observe-curate loop"`).
- Trigger evidence: project memory records v1 core loop + Craft Nudge shipped 2026-04-18.
- Full context: `.lore/brainstorm/observer-dimension-extension-20260420.md` "Frame" paragraph on vision status, and "Risks" final bullet.
