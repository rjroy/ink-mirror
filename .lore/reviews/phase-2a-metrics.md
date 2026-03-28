---
title: "Review: Phase 2A Metrics Preprocessing"
date: 2026-03-27
status: resolved
reviewer: Thorne
resolver: Dalton
tags: [review, metrics, phase-2a]
---

# Phase 2A Metrics Preprocessing Review

Reviewed by Thorne (Guild Warden). All findings resolved by Dalton (Guild Artificer).

## Findings

### F1 (Medium) - FIXED: Hedging phrase detection matched substrings

`word-frequency.ts` used `indexOf` for multi-word phrases, matching across word boundaries ("kind of" inside "mankind of"). Fixed by replacing `indexOf` scanning with `\b`-anchored regex matching.

Tests added: word-boundary false positives for "kind of", "sort of", "a bit".

### F2 (Low) - FIXED: Double markdown stripping in pipeline

`computeEntryMetrics` stripped markdown, then passed to `splitSentences` which stripped again. Fixed by extracting `splitProse()` (no markdown stripping) and having `computeEntryMetrics` call `splitProse` directly. Public `splitSentences` still strips markdown for external callers.

### F3 (Low) - FIXED: No Unicode ellipsis handling

Unicode ellipsis (U+2026) was not normalized. Fixed by converting `\u2026` to ASCII `...` during whitespace normalization in `splitProse`. This ensures consistent behavior with the existing ASCII ellipsis handling.

Tests added: Unicode ellipsis mid-sentence, Unicode ellipsis at end of text.

### F4 (Low) - FIXED: Single-letter sentence-ending suppression

Any single letter before a period was treated as an initial, preventing "The answer is I." from splitting. Fixed by only suppressing for single letters that are not "i" or "a" (the common single-letter English words). Initials like "J." and "K." still suppress correctly.

Tests added: "The answer is I." splits into two sentences.

### F5 (Info) - No action: tokenFrequencies includes stop words

Phase 2B prompt assembly will need to filter. Not a 2A defect.

## Verification

- All 78 metrics tests pass (5 new tests added)
- Pre-existing failures in other test files (missing packages) are unrelated
- No regressions in existing sentence splitting, rhythm, or word frequency tests
