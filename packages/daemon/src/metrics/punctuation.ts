import type { PunctuationAnalysis } from "@ink-mirror/shared";
import { countWords } from "./sentences.js";

/**
 * Matches a "dash" habit: an em dash, an en dash, or a hyphen used as a
 * standalone word separator (spaced on both sides, e.g. "the door - the
 * one at the end"). Deliberately excludes hyphens inside compound words
 * ("well-known") since those aren't a punctuation-rhythm choice.
 */
const DASH_PATTERN = /[—–]|(?:\s-\s)/g;

/**
 * Matches an ellipsis: three-or-more literal dots, or the Unicode ellipsis
 * character. Checked before comma/colon counting isn't needed since dots
 * aren't otherwise tracked.
 */
const ELLIPSIS_PATTERN = /\.{3,}|…/g;

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

function countChar(text: string, char: string): number {
  let count = 0;
  for (const c of text) {
    if (c === char) count += 1;
  }
  return count;
}

/**
 * Rate per 1,000 words. Guards the zero-word case explicitly: dividing by
 * zero would produce NaN, which JSON.stringify silently turns into `null`
 * on any later serialization (a named hazard for this project).
 */
function ratePer1000(count: number, wordCount: number): number {
  if (wordCount === 0) return 0;
  return (count / wordCount) * 1000;
}

/**
 * Compute per-1,000-word punctuation rates for an entry (REQ-LPC-9).
 * Pure function: takes already-markdown-stripped prose text, same
 * convention as analyzeWordFrequency.
 */
export function analyzePunctuation(text: string): PunctuationAnalysis {
  const wordCount = countWords(text);

  // Ellipsis runs ("...") are made of dots that would otherwise also match
  // any dot-based counting, so they're counted first and not double-counted
  // elsewhere (no other tracked mark uses ".").
  const ellipsisCount = countMatches(text, ELLIPSIS_PATTERN);

  return {
    commaRatePer1000: ratePer1000(countChar(text, ","), wordCount),
    semicolonRatePer1000: ratePer1000(countChar(text, ";"), wordCount),
    colonRatePer1000: ratePer1000(countChar(text, ":"), wordCount),
    dashRatePer1000: ratePer1000(countMatches(text, DASH_PATTERN), wordCount),
    // One count per parenthetical aside (opening paren only), not per mark.
    parenthesisRatePer1000: ratePer1000(countChar(text, "("), wordCount),
    questionRatePer1000: ratePer1000(countChar(text, "?"), wordCount),
    exclamationRatePer1000: ratePer1000(countChar(text, "!"), wordCount),
    ellipsisRatePer1000: ratePer1000(ellipsisCount, wordCount),
  };
}
