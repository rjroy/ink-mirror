import type { EntryMetrics } from "@ink-mirror/shared";
import { splitProse, stripMarkdown, computeSentenceMetrics } from "./sentences.js";
import { analyzeRhythm } from "./rhythm.js";
import { analyzeWordFrequency } from "./word-frequency.js";
import { analyzeSentenceStructure } from "./sentence-structure.js";

export { splitSentences, splitProse, stripMarkdown, computeSentenceMetrics, countWords } from "./sentences.js";
export { analyzeRhythm } from "./rhythm.js";
export { analyzeWordFrequency } from "./word-frequency.js";
export { analyzeSentenceStructure, isPassiveVoice, isFragment, classifyOpener, splitParagraphs } from "./sentence-structure.js";

/**
 * Run the full metrics pipeline on an entry's text.
 * Pure function: text in, structured metrics out.
 *
 * Strips markdown once up front so both the sentence splitter
 * and word frequency analyzer work on prose content.
 */
export function computeEntryMetrics(text: string): EntryMetrics {
  const prose = stripMarkdown(text);
  const sentences = splitProse(prose);
  const sentenceMetrics = computeSentenceMetrics(sentences);

  return {
    sentences: sentenceMetrics,
    rhythm: analyzeRhythm(sentenceMetrics),
    wordFrequency: analyzeWordFrequency(prose),
    sentenceStructure: analyzeSentenceStructure(sentences, prose),
  };
}
