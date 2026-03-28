---
title: "Phase 4A Review: Profile Format and Transformation"
date: 2026-03-27
status: resolved
reviewer: Thorne
resolver: Dalton
tags: [review, phase-4a, profile]
---

## Phase 4A Review Complete

**Verdict:** All five requirements (REQ-V1-13, REQ-V1-20, REQ-V1-21, REQ-V1-22, REQ-V1-23) satisfied. All findings resolved.

### Defects (resolved)

**F1: Current entry duplicated in Tier 2 context** (`index.ts:61-70`).
When corpus >= 5, the just-created entry appeared both in "Recent Entries" and as "Current Entry".
**Fix:** Filtered `entryIdStr` from `recentEntries` in `index.ts`.

**F2: Profile update failure silently swallowed** (`observations.ts:93-98`).
The try/catch around `onIntentional` swallowed all errors silently.
**Fix:** Response now includes `profileUpdated: boolean`. Errors are logged via `console.error`. Tests added for both success and failure cases.

### Concerns (resolved)

**F3: `onIntentional` optional in interface.**
A wiring mistake would mean silent no-profile-ever.
**Fix:** Made `onIntentional` required in `ObservationsDeps`. All call sites updated to provide the callback.

**F5: `profileFromMarkdown` silently drops rules in unrecognized sections.**
Users editing via `$EDITOR` could lose rules by renaming a section header.
**Fix:** Added `headerToDimension()` with fallback matching (exact label, substring, raw dimension key). Sections with rule-formatted content but unrecognized headers now emit `console.warn`. Tests added.

### Test Gaps (resolved)

**F6: `patternsMatch` had no direct unit tests.**
**Fix:** Exported `patternsMatch` from module scope. Added 7 direct unit tests covering exact match, containment, high overlap merge, low overlap rejection, empty-word edge case, filler-word stripping, and false-merge prevention.

**F7: Tier 2 boundary tested at 3 and 7, not at threshold.**
**Fix:** Added tests at corpus size 4 (no Tier 2) and 5 (Tier 2 activates), catching any off-by-one.

### Code Quality / Minor (resolved)

**F4: Dimension label map duplicated.**
**Fix:** Extracted `DIMENSION_LABELS` constant at module scope. Both `profileToMarkdown` and `toPromptMarkdown` now reference it.

**F8: `createdAt` lost on markdown round-trip.**
**Fix:** `profileToMarkdown` now serializes `createdAt` in the HTML comment (`<!-- id:X created:Y -->`). `profileFromMarkdown` extracts it with optional capture group (backwards-compatible with old format). Round-trip test added.
