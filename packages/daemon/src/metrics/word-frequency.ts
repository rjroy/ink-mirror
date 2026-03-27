import type { WordFrequencyAnalysis } from "@ink-mirror/shared";

/**
 * Words that signal hedging or uncertainty.
 * These reduce the force of a statement and often appear unconsciously.
 */
const HEDGING_WORDS = new Set([
  "just", "actually", "probably", "maybe", "perhaps",
  "somewhat", "fairly", "rather", "slightly", "basically",
  "essentially", "virtually", "apparently", "arguably",
  "seemingly", "supposedly", "presumably",
]);

/**
 * Multi-word hedging phrases. Checked separately from single-word hedges.
 */
const HEDGING_PHRASES = [
  "i think", "i guess", "i suppose", "i feel like",
  "kind of", "sort of", "a bit", "a little",
  "more or less", "in a way", "to some extent",
];

/**
 * Words that amplify or intensify, often weakening precision.
 */
const INTENSIFIERS = new Set([
  "very", "really", "extremely", "incredibly", "absolutely",
  "totally", "completely", "utterly", "quite", "truly",
  "remarkably", "exceptionally", "enormously", "immensely",
  "particularly", "especially", "definitely", "certainly",
]);

/**
 * Tokenize text into lowercase words, stripping punctuation.
 * Preserves hyphenated words as single tokens.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s'-]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/**
 * Build a frequency map from tokens.
 */
function buildFrequencyMap(tokens: string[]): Record<string, number> {
  const freq: Record<string, number> = {};
  for (const token of tokens) {
    freq[token] = (freq[token] ?? 0) + 1;
  }
  return freq;
}

/**
 * Filter a frequency map to only include keys in the given set.
 */
function filterBySet(
  freq: Record<string, number>,
  set: Set<string>,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [word, count] of Object.entries(freq)) {
    if (set.has(word)) {
      result[word] = count;
    }
  }
  return result;
}

/**
 * Minimum phrase length (in words) to search for repeated phrases.
 */
const MIN_PHRASE_LENGTH = 2;

/**
 * Maximum phrase length (in words) to search for repeated phrases.
 */
const MAX_PHRASE_LENGTH = 4;

/**
 * Minimum number of occurrences to count as a repeated phrase.
 */
const MIN_PHRASE_OCCURRENCES = 2;

/**
 * Detect repeated multi-word phrases (2-4 words, appearing 2+ times).
 * Uses the lowercase text for matching.
 */
function findRepeatedPhrases(text: string): Record<string, number> {
  const normalized = text.toLowerCase().replace(/[^\w\s'-]/g, "");
  const words = normalized.split(/\s+/).filter((w) => w.length > 0);
  const phrases: Record<string, number> = {};

  for (let len = MIN_PHRASE_LENGTH; len <= MAX_PHRASE_LENGTH; len++) {
    for (let i = 0; i <= words.length - len; i++) {
      const phrase = words.slice(i, i + len).join(" ");
      phrases[phrase] = (phrases[phrase] ?? 0) + 1;
    }
  }

  // Filter to only repeated phrases
  const repeated: Record<string, number> = {};
  for (const [phrase, count] of Object.entries(phrases)) {
    if (count >= MIN_PHRASE_OCCURRENCES) {
      repeated[phrase] = count;
    }
  }

  return repeated;
}

/**
 * Detect hedging phrases in text. Returns a map of phrase to count.
 * Searches for both single hedging words (via token frequency) and
 * multi-word hedging phrases (via string matching).
 */
function findHedgingWords(
  tokenFreq: Record<string, number>,
  text: string,
): Record<string, number> {
  const result = filterBySet(tokenFreq, HEDGING_WORDS);

  const lowerText = text.toLowerCase();
  for (const phrase of HEDGING_PHRASES) {
    let count = 0;
    let pos = 0;
    while ((pos = lowerText.indexOf(phrase, pos)) !== -1) {
      count++;
      pos += phrase.length;
    }
    if (count > 0) {
      result[phrase] = count;
    }
  }

  return result;
}

/**
 * Analyze word frequencies, hedging patterns, intensifier usage,
 * and repeated phrases in the entry text.
 */
export function analyzeWordFrequency(text: string): WordFrequencyAnalysis {
  const tokens = tokenize(text);
  const tokenFrequencies = buildFrequencyMap(tokens);
  const uniqueTokens = Object.keys(tokenFrequencies).length;

  return {
    tokenFrequencies,
    totalTokens: tokens.length,
    uniqueTokens,
    hedgingWords: findHedgingWords(tokenFrequencies, text),
    intensifiers: filterBySet(tokenFrequencies, INTENSIFIERS),
    repeatedPhrases: findRepeatedPhrases(text),
  };
}
