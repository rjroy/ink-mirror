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
 * Common English function words filtered from tokenFrequencies.
 * Removing these surfaces content words (the patterns worth observing)
 * instead of burying them under articles and prepositions.
 * Includes contracted forms since the tokenizer preserves apostrophes.
 */
const STOP_WORDS = new Set([
  // Articles and determiners
  "a", "an", "the", "this", "that", "these", "those",
  // Prepositions
  "in", "on", "at", "to", "for", "of", "with", "by", "from",
  "up", "about", "into", "through", "during", "before", "after",
  "above", "below", "between", "out", "off", "over", "under",
  // Pronouns
  "i", "me", "my", "mine", "myself",
  "you", "your", "yours", "yourself",
  "he", "him", "his", "himself",
  "she", "her", "hers", "herself",
  "it", "its", "itself",
  "we", "us", "our", "ours", "ourselves",
  "they", "them", "their", "theirs", "themselves",
  // Auxiliaries and copulas
  "is", "am", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "having",
  "do", "does", "did",
  "will", "would", "shall", "should",
  "can", "could", "may", "might", "must",
  // Conjunctions
  "and", "but", "or", "nor", "so", "yet",
  // Other common function words
  "not", "no", "if", "then", "than", "too", "also",
  "as", "when", "what", "which", "who", "whom", "how",
  "all", "each", "every", "both", "few", "more", "most",
  "other", "some", "any", "such",
  // Contracted auxiliaries/pronouns
  "i'm", "i've", "i'll", "i'd",
  "you're", "you've", "you'll", "you'd",
  "he's", "he'll", "he'd",
  "she's", "she'll", "she'd",
  "it's", "it'll",
  "we're", "we've", "we'll", "we'd",
  "they're", "they've", "they'll", "they'd",
  "that's", "there's", "here's",
  "don't", "doesn't", "didn't",
  "won't", "wouldn't", "shan't", "shouldn't",
  "can't", "couldn't", "mustn't",
  "isn't", "aren't", "wasn't", "weren't",
  "hasn't", "haven't", "hadn't",
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
    const pattern = new RegExp(`\\b${phrase}\\b`, "g");
    const matches = lowerText.match(pattern);
    if (matches) {
      result[phrase] = matches.length;
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
  const allFrequencies = buildFrequencyMap(tokens);

  // Filter stop words so the LLM sees content words, not articles/prepositions.
  // totalTokens stays unfiltered (describes entry volume).
  // uniqueTokens reflects the filtered map (matches what the LLM sees).
  const tokenFrequencies: Record<string, number> = {};
  for (const [word, count] of Object.entries(allFrequencies)) {
    if (!STOP_WORDS.has(word)) {
      tokenFrequencies[word] = count;
    }
  }
  const uniqueTokens = Object.keys(tokenFrequencies).length;

  return {
    tokenFrequencies,
    totalTokens: tokens.length,
    uniqueTokens,
    hedgingWords: findHedgingWords(allFrequencies, text),
    intensifiers: filterBySet(allFrequencies, INTENSIFIERS),
    repeatedPhrases: findRepeatedPhrases(text),
  };
}
