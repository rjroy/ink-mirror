import type { SentenceStructureAnalysis } from "@ink-mirror/shared";

/**
 * Auxiliary verbs that appear before a past participle in passive constructions.
 * "was eaten", "were taken", "is being watched", "has been done".
 */
const PASSIVE_AUXILIARIES = /\b(was|were|is|are|am|been|being|be|get|gets|got|gotten)\b/i;

/**
 * Common irregular past participles that don't end in -ed.
 * Used alongside the -ed/-en suffix check for passive voice detection.
 */
const IRREGULAR_PAST_PARTICIPLES = new Set([
  "been", "born", "broken", "brought", "built", "bought", "caught",
  "chosen", "come", "cut", "done", "drawn", "driven", "eaten",
  "fallen", "felt", "found", "forgotten", "frozen", "given", "gone",
  "grown", "heard", "held", "hidden", "hit", "hung", "hurt", "kept",
  "known", "laid", "led", "left", "lent", "let", "lain", "lost",
  "made", "meant", "met", "paid", "put", "read", "ridden", "risen",
  "run", "said", "seen", "sent", "set", "shaken", "shown", "shut",
  "sold", "spent", "spoken", "stood", "stolen", "struck", "stuck",
  "sung", "sat", "slept", "swept", "swum", "sworn", "taken", "taught",
  "thought", "thrown", "told", "torn", "understood", "woken", "won",
  "worn", "written",
]);

/**
 * Detect whether a sentence is in passive voice using rule-based heuristics.
 *
 * Looks for: auxiliary verb + optional adverbs + past participle pattern.
 * Past participle is identified by -ed/-en suffix or membership in the
 * irregular set. This catches ~80% of passive constructions, which is
 * sufficient for observation-level metrics (the LLM interprets the numbers).
 */
export function isPassiveVoice(sentence: string): boolean {
  const words = sentence
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => w.toLowerCase());

  for (let i = 0; i < words.length - 1; i++) {
    if (!PASSIVE_AUXILIARIES.test(words[i])) continue;

    // Look ahead for a past participle (allow up to 2 intervening adverbs)
    const lookAhead = Math.min(i + 4, words.length);
    for (let j = i + 1; j < lookAhead; j++) {
      const word = words[j];
      if (isPastParticiple(word)) return true;
      // Stop looking if we hit something that isn't an adverb-like word
      if (!isLikelyAdverb(word)) break;
    }
  }

  return false;
}

/**
 * Common -ed words that are primarily adjectives, not passive participles.
 * "I was tired" is a linking verb + adjective, not a passive construction.
 * These are high-frequency in journal writing and inflate passive counts if included.
 */
const ADJECTIVE_ED = new Set([
  "tired", "excited", "bored", "interested", "confused",
  "worried", "surprised", "scared", "relaxed", "pleased",
  "convinced", "satisfied", "disappointed", "embarrassed",
  "frustrated", "overwhelmed", "amazed", "determined",
  "prepared", "organized", "complicated", "dedicated",
]);

function isPastParticiple(word: string): boolean {
  if (IRREGULAR_PAST_PARTICIPLES.has(word)) return true;
  // Regular past participles end in -ed (exclude common adjective-only -ed words)
  if (word.endsWith("ed") && word.length > 3) {
    if (ADJECTIVE_ED.has(word)) return false;
    return true;
  }
  if (word.endsWith("en") && word.length > 3) return true;
  return false;
}

function isLikelyAdverb(word: string): boolean {
  // Common adverbs that appear between auxiliary and participle
  return word.endsWith("ly") ||
    ["not", "never", "also", "already", "always", "just",
     "still", "even", "only", "often", "then"].includes(word);
}

/**
 * Common verbs used to identify sentences that have a main verb
 * (i.e., are not fragments). This is a simplified check.
 */
const COMMON_VERBS = new Set([
  // Be verbs
  "is", "are", "am", "was", "were", "be", "been", "being",
  // Have verbs
  "have", "has", "had", "having",
  // Do verbs
  "do", "does", "did",
  // Modals
  "can", "could", "will", "would", "shall", "should", "may", "might", "must",
  // Common action verbs (high frequency in journal writing)
  "go", "went", "gone", "going",
  "get", "got", "getting",
  "make", "made", "making",
  "know", "knew", "known",
  "think", "thought", "thinking",
  "take", "took", "taken",
  "come", "came", "coming",
  "see", "saw", "seen",
  "want", "wanted", "wanting",
  "give", "gave", "given",
  "use", "used", "using",
  "find", "found", "finding",
  "tell", "told", "telling",
  "say", "said", "saying",
  "work", "worked", "working",
  "call", "called", "calling",
  "try", "tried", "trying",
  "ask", "asked", "asking",
  "need", "needed", "needing",
  "feel", "felt", "feeling",
  "become", "became", "becoming",
  "leave", "left", "leaving",
  "put", "keep", "kept",
  "let", "begin", "began",
  "seem", "seemed", "seeming",
  "help", "helped", "helping",
  "show", "showed", "shown",
  "hear", "heard", "hearing",
  "play", "played", "playing",
  "run", "ran", "running",
  "move", "moved", "moving",
  "live", "lived", "living",
  "believe", "believed",
  "happen", "happened",
  "write", "wrote", "written",
  "sit", "sat", "sitting",
  "stand", "stood", "standing",
  "lose", "lost", "losing",
  "pay", "paid", "paying",
  "meet", "met", "meeting",
  "stop", "stopped", "stopping",
  "turn", "turned", "turning",
  "start", "started", "starting",
  "open", "opened", "opening",
  "close", "closed", "closing",
  "read", "remember", "remembered",
  "love", "loved", "loving",
  "walk", "walked", "walking",
  "look", "looked", "looking",
]);

/**
 * Common words ending in -ing or -ed that are not verb forms.
 * Prevents false negatives in fragment detection.
 */
const NON_VERB_ING_ED = new Set([
  "nothing", "something", "everything", "anything",
  "morning", "evening", "ceiling",
  "thing", "string", "ring", "king",
  "during", "according", "regarding",
  "red", "bed", "shed", "hundred", "sacred",
]);

/**
 * Detect whether a sentence is a fragment (lacks a main verb).
 *
 * Uses a vocabulary-based check: if no word in the sentence matches
 * known verb forms, it's likely a fragment. Also catches -ed/-ing
 * suffixed words as potential verbs. Not perfect, but fragments in
 * journal writing are typically short and verb-free ("Just silence."
 * "Nothing but rain.").
 */
export function isFragment(sentence: string): boolean {
  const words = sentence
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => w.toLowerCase());

  // Single-word sentences are fragments unless they're a verb
  if (words.length <= 1) return true;

  for (const word of words) {
    if (COMMON_VERBS.has(word)) return false;
    // Catch verb forms ending in -ed or -ing that aren't in our list.
    // Exclude common non-verb words that happen to end in -ing or -ed.
    if (word.length > 3 && (word.endsWith("ed") || word.endsWith("ing"))) {
      if (!NON_VERB_ING_ED.has(word)) return false;
    }
  }

  return true;
}

/**
 * Opener pattern categories for paragraph-initial sentences.
 */
type OpenerPattern =
  | "I + verb"
  | "pronoun + verb"
  | "temporal marker"
  | "conjunction"
  | "article/determiner"
  | "other";

/** Words that start temporal-marker paragraphs. */
const TEMPORAL_MARKERS = new Set([
  "today", "yesterday", "tomorrow", "tonight", "later",
  "earlier", "afterward", "afterwards", "meanwhile",
  "eventually", "finally", "recently", "suddenly",
  "soon", "now", "then", "once", "last", "next",
  "this morning", "this afternoon", "this evening",
]);

/** Conjunctions that open paragraphs. */
const CONJUNCTIONS = new Set([
  "and", "but", "or", "so", "yet", "because", "although",
  "though", "however", "still", "anyway", "besides",
]);

const PRONOUNS = new Set([
  "he", "she", "they", "we", "it", "you", "who",
]);

const ARTICLES_DETERMINERS = new Set([
  "the", "a", "an", "this", "that", "these", "those",
  "my", "his", "her", "their", "our", "its", "your",
  "some", "any", "each", "every", "no",
]);

/**
 * Classify the opener pattern of a sentence (typically paragraph-initial).
 */
export function classifyOpener(sentence: string): OpenerPattern {
  const words = sentence
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (words.length === 0) return "other";

  const first = words[0].toLowerCase();
  const twoWord = words.length > 1 ? `${first} ${words[1].toLowerCase()}` : "";

  // Check two-word temporal markers first
  if (TEMPORAL_MARKERS.has(twoWord)) return "temporal marker";
  if (TEMPORAL_MARKERS.has(first)) return "temporal marker";

  if (first === "i") return "I + verb";
  if (PRONOUNS.has(first)) return "pronoun + verb";
  if (CONJUNCTIONS.has(first)) return "conjunction";
  if (ARTICLES_DETERMINERS.has(first)) return "article/determiner";

  return "other";
}

/**
 * Split already-stripped prose into paragraphs.
 * A paragraph boundary is one or more blank lines.
 */
export function splitParagraphs(proseText: string): string[] {
  return proseText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Analyze sentence structure: voice, paragraph openers, and fragments.
 *
 * Takes pre-split sentences and the original stripped prose (for paragraph
 * boundaries). All inputs come from the existing metrics pipeline.
 */
export function analyzeSentenceStructure(
  sentences: string[],
  proseText: string,
): SentenceStructureAnalysis {
  if (sentences.length === 0) {
    return {
      passiveCount: 0,
      activeCount: 0,
      passiveRatio: 0,
      paragraphOpeners: [],
      paragraphCount: 0,
      fragmentCount: 0,
      totalSentences: 0,
    };
  }

  // Voice analysis
  let passiveCount = 0;
  let fragmentCount = 0;

  for (const sentence of sentences) {
    if (isFragment(sentence)) {
      fragmentCount++;
    } else if (isPassiveVoice(sentence)) {
      passiveCount++;
    }
  }

  const nonFragments = sentences.length - fragmentCount;
  const activeCount = nonFragments - passiveCount;
  const passiveRatio = nonFragments > 0
    ? Math.round((passiveCount / nonFragments) * 100) / 100
    : 0;

  // Paragraph opener analysis
  const paragraphs = splitParagraphs(proseText);
  const openerCounts: Partial<Record<OpenerPattern, number>> = {};

  for (const para of paragraphs) {
    // The first sentence of each paragraph determines the opener pattern
    const firstSentenceEnd = para.search(/[.!?]/);
    const firstSentence = firstSentenceEnd >= 0
      ? para.slice(0, firstSentenceEnd + 1)
      : para;

    const pattern = classifyOpener(firstSentence);
    openerCounts[pattern] = (openerCounts[pattern] ?? 0) + 1;
  }

  const paragraphOpeners = Object.entries(openerCounts)
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((a, b) => b.count - a.count);

  return {
    passiveCount,
    activeCount,
    passiveRatio,
    paragraphOpeners,
    paragraphCount: paragraphs.length,
    fragmentCount,
    totalSentences: sentences.length,
  };
}
