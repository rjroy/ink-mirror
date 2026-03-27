import type { SentenceMetrics } from "@ink-mirror/shared";

/**
 * Common abbreviations that end with a period but don't end a sentence.
 * Sorted by frequency of appearance in informal writing.
 */
const ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "sr", "jr",
  "st", "ave", "blvd", "rd",
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
  "vs", "etc", "approx", "dept", "est", "govt",
  "inc", "ltd", "corp", "co",
  "e.g", "i.e", "a.m", "p.m",
]);

/**
 * Strip markdown formatting to get prose content for sentence splitting.
 * Removes headings, code blocks, list markers, emphasis markers, links,
 * and images. Preserves the text content within inline formatting.
 */
export function stripMarkdown(text: string): string {
  let result = text;

  // Remove fenced code blocks entirely (they're not prose)
  result = result.replace(/```[\s\S]*?```/g, "");
  result = result.replace(/`[^`\n]+`/g, "");

  // Remove heading markers but keep text
  result = result.replace(/^#{1,6}\s+/gm, "");

  // Remove horizontal rules
  result = result.replace(/^[-*_]{3,}\s*$/gm, "");

  // Remove images entirely
  result = result.replace(/!\[[^\]]*\]\([^)]*\)/g, "");

  // Convert links to just their text
  result = result.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");

  // Remove emphasis markers but keep text
  result = result.replace(/(\*{1,3}|_{1,3})(.+?)\1/g, "$2");

  // Remove list markers (-, *, +, 1.)
  result = result.replace(/^\s*[-*+]\s+/gm, "");
  result = result.replace(/^\s*\d+\.\s+/gm, "");

  // Remove blockquote markers
  result = result.replace(/^\s*>\s?/gm, "");

  return result;
}

/**
 * Split text into sentences. Handles:
 * - Standard sentence-ending punctuation (. ! ?)
 * - Abbreviations (Mr., Dr., etc., e.g., i.e.)
 * - Dialogue quotes ("Hello." she said)
 * - Ellipses (...)
 * - Multiple punctuation marks (!!, ?!, ...)
 */
export function splitSentences(text: string): string[] {
  const stripped = stripMarkdown(text);

  // Normalize whitespace: collapse runs of whitespace (including newlines) into single spaces
  const normalized = stripped.replace(/\s+/g, " ").trim();

  if (normalized.length === 0) return [];

  const sentences: string[] = [];
  let current = "";

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    current += char;

    // Check if this character could end a sentence
    if (char === "." || char === "!" || char === "?") {
      // Skip ellipses: if next char is a dot, or previous char was a dot
      // (we're at the trailing end of "...")
      if (char === ".") {
        if (i + 1 < normalized.length && normalized[i + 1] === ".") {
          continue;
        }
        if (i > 0 && normalized[i - 1] === ".") {
          continue;
        }
      }

      // Skip multiple punctuation (!! ?! etc.)
      if (i + 1 < normalized.length && (normalized[i + 1] === "!" || normalized[i + 1] === "?")) {
        continue;
      }

      // Check for abbreviation: look back for the word before the period
      if (char === ".") {
        const beforePeriod = current.slice(0, -1);
        const lastWord = beforePeriod.split(/\s/).pop() ?? "";
        const cleaned = lastWord.replace(/[^a-zA-Z.]/g, "").toLowerCase();
        if (ABBREVIATIONS.has(cleaned)) {
          continue;
        }
        // Single letter followed by period (initials like "J." or "U.S.")
        if (cleaned.length === 1) {
          continue;
        }
        // Dotted abbreviations like "Ph.D." - check two patterns:
        // 1. The word before period contains dots (e.g., "ph.d" from "Ph.D.")
        if (/^[a-z]{1,3}(\.[a-z]{1,3})+$/i.test(cleaned)) {
          continue;
        }
        // 2. The next chars form another abbreviated segment (e.g., after "Ph." comes "D.")
        const rest = normalized.slice(i + 1);
        if (/^[A-Za-z]{1,3}\./.test(rest)) {
          continue;
        }
      }

      // Check if followed by a closing quote (the quote is part of this sentence)
      if (i + 1 < normalized.length && (normalized[i + 1] === '"' || normalized[i + 1] === "'")) {
        current += normalized[i + 1];
        i++;
      }

      // This looks like a sentence boundary
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        sentences.push(trimmed);
      }
      current = "";
    }
  }

  // Remaining text that didn't end with punctuation
  const trimmed = current.trim();
  if (trimmed.length > 0) {
    sentences.push(trimmed);
  }

  return sentences;
}

/**
 * Count words in a string. Words are sequences of non-whitespace characters.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Compute per-sentence metrics for a list of sentences.
 */
export function computeSentenceMetrics(sentences: string[]): SentenceMetrics[] {
  return sentences.map((text) => ({
    text,
    wordCount: countWords(text),
    charCount: text.length,
  }));
}
