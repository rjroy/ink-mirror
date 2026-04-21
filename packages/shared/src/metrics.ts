import { z } from "zod";

// --- Per-sentence metrics ---

export const SentenceMetricsSchema = z.object({
  text: z.string(),
  wordCount: z.number().int().nonnegative(),
  charCount: z.number().int().nonnegative(),
});

export type SentenceMetrics = z.infer<typeof SentenceMetricsSchema>;

// --- Rhythm analysis ---

export const PaceChangeSchema = z.object({
  position: z.number().int().nonnegative(),
  fromAvgLength: z.number(),
  toAvgLength: z.number(),
});

export type PaceChange = z.infer<typeof PaceChangeSchema>;

export const RhythmAnalysisSchema = z.object({
  lengthSequence: z.array(z.number().int().nonnegative()),
  mean: z.number(),
  variance: z.number(),
  shortThreshold: z.number(),
  longThreshold: z.number(),
  maxConsecutiveShort: z.number().int().nonnegative(),
  maxConsecutiveLong: z.number().int().nonnegative(),
  paceChanges: z.array(PaceChangeSchema),
});

export type RhythmAnalysis = z.infer<typeof RhythmAnalysisSchema>;

// --- Word frequency analysis ---

export const WordFrequencyAnalysisSchema = z.object({
  // Filtered: common English stop words (articles, prepositions, pronouns,
  // auxiliaries, conjunctions) are excluded. Contains content words only.
  tokenFrequencies: z.record(z.string(), z.number().int().positive()),
  totalTokens: z.number().int().nonnegative(),
  uniqueTokens: z.number().int().nonnegative(),
  hedgingWords: z.record(z.string(), z.number().int().positive()),
  intensifiers: z.record(z.string(), z.number().int().positive()),
  repeatedPhrases: z.record(z.string(), z.number().int().positive()),
});

export type WordFrequencyAnalysis = z.infer<typeof WordFrequencyAnalysisSchema>;

// --- Sentence structure analysis ---

export const SentenceStructureAnalysisSchema = z.object({
  /** Count of sentences detected as passive voice. */
  passiveCount: z.number().int().nonnegative(),
  /** Count of sentences detected as active voice. */
  activeCount: z.number().int().nonnegative(),
  /** Passive voice ratio (0-1). */
  passiveRatio: z.number().min(0).max(1),
  /** Most common paragraph opener patterns (e.g., "I + verb", "temporal marker"). */
  paragraphOpeners: z.array(
    z.object({
      pattern: z.string(),
      count: z.number().int().positive(),
    }),
  ),
  /** Total number of paragraphs analyzed. */
  paragraphCount: z.number().int().nonnegative(),
  /** Count of sentence fragments (sentences lacking a main verb). */
  fragmentCount: z.number().int().nonnegative(),
  /** Total sentences analyzed (denominator for ratios). */
  totalSentences: z.number().int().nonnegative(),
  /** Sentence count per paragraph, in document order. Length equals paragraphCount. */
  paragraphLengths: z.array(z.number().int().nonnegative()),
  /** Bucketed paragraph counts: short (1-2), medium (3-5), long (6+). */
  paragraphLengthDistribution: z.object({
    short: z.number().int().nonnegative(),
    medium: z.number().int().nonnegative(),
    long: z.number().int().nonnegative(),
  }),
  /** Count of paragraphs whose sentence count is exactly 1 (subset of short). */
  singleSentenceParagraphCount: z.number().int().nonnegative(),
});

export type SentenceStructureAnalysis = z.infer<typeof SentenceStructureAnalysisSchema>;

// --- Top-level entry metrics ---

export const EntryMetricsSchema = z.object({
  sentences: z.array(SentenceMetricsSchema),
  rhythm: RhythmAnalysisSchema,
  wordFrequency: WordFrequencyAnalysisSchema,
  sentenceStructure: SentenceStructureAnalysisSchema,
});

export type EntryMetrics = z.infer<typeof EntryMetricsSchema>;
