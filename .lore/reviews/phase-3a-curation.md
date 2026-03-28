---
title: "Phase 3A Review: Curation API and CLI"
date: 2026-03-27
reviewer: Thorne
status: resolved
tags: [review, phase-3a, curation]
---

## Findings

### F1 (Medium) - FIXED

CLI truncated entry text to 200 characters (`cli/src/curate.ts:52-55`). REQ-V1-17 says "original text," not "preview." The API returned full text; this was a CLI rendering limitation.

**Fix:** Removed the 200-char truncation. Full entry text is now displayed. Added test verifying no truncation occurs.

### F2 (Medium) - Acknowledged

Contradiction detection depends on Observer vocabulary. The `OPPOSING_SIGNALS` regex pairs match specific English words. If the Observer uses synonyms ("concise" instead of "short"), contradictions go undetected. Impact is false negatives only, not false positives.

**Decision:** No code change. This is a known design constraint. Worth revisiting if detection proves unreliable in practice.

### F3 (Low) - FIXED

Missing entry text silently fell back to empty string (`curation.ts:85`). No indication to the user that the source entry was gone.

**Fix:** Changed fallback from `""` to `"[source entry not found]"`. Added test for missing entry lookup.

### F4 (Low) - FIXED

Pending observations were not explicitly sorted (`curation.ts:72`). Order was incidentally correct due to sequential ID naming, not intentionally enforced.

**Fix:** Added explicit `.sort()` by `createdAt` on pending observations. Added test with out-of-order input verifying chronological output.
