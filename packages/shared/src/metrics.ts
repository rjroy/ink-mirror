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

// --- Function word frequency analysis (REQ-LPC-9) ---

/**
 * Frequencies of the tokens that WordFrequencyAnalysis's STOP_WORDS filtering
 * discards. Research finding: function words are the topic-independent style
 * signal, so both content-word and function-word frequencies are kept.
 */
export const FunctionWordFrequencyAnalysisSchema = z.object({
  tokenFrequencies: z.record(z.string(), z.number().int().positive()),
  totalTokens: z.number().int().nonnegative(),
});

export type FunctionWordFrequencyAnalysis = z.infer<
  typeof FunctionWordFrequencyAnalysisSchema
>;

// --- Punctuation analysis (REQ-LPC-9) ---

/** Per-1,000-word rates for each tracked punctuation mark. */
export const PunctuationAnalysisSchema = z.object({
  commaRatePer1000: z.number().nonnegative(),
  semicolonRatePer1000: z.number().nonnegative(),
  colonRatePer1000: z.number().nonnegative(),
  dashRatePer1000: z.number().nonnegative(),
  parenthesisRatePer1000: z.number().nonnegative(),
  questionRatePer1000: z.number().nonnegative(),
  exclamationRatePer1000: z.number().nonnegative(),
  ellipsisRatePer1000: z.number().nonnegative(),
});

export type PunctuationAnalysis = z.infer<typeof PunctuationAnalysisSchema>;

// --- Top-level entry metrics ---

export const EntryMetricsSchema = z.object({
  sentences: z.array(SentenceMetricsSchema),
  rhythm: RhythmAnalysisSchema,
  wordFrequency: WordFrequencyAnalysisSchema,
  sentenceStructure: SentenceStructureAnalysisSchema,
  // Optional until Phase 2 wires packages/daemon/src/metrics/index.ts to
  // compute and populate these on every entry (REQ-LPC-9). Marking them
  // required now would break computeEntryMetrics's return type ahead of
  // that phase's work.
  functionWordFrequencies: FunctionWordFrequencyAnalysisSchema.optional(),
  punctuation: PunctuationAnalysisSchema.optional(),
});

export type EntryMetrics = z.infer<typeof EntryMetricsSchema>;

// --- Metric snapshot: one per entry, forms a durable time series ---

export const MetricSnapshotSchema = z.object({
  entryId: z.string(),
  date: z.string(),
  metrics: EntryMetricsSchema,
  /** Schema version of this snapshot file, for future migration. */
  schemaVersion: z.literal(1),
});

export type MetricSnapshot = z.infer<typeof MetricSnapshotSchema>;

// --- Linkable-metric registry ---
//
// Stable field names a Pattern's `metricLink` may reference, mapped to the
// dot-path accessor into a MetricSnapshot's `metrics` object. Validation of
// a metricLink (PatternSchema, patterns.ts) accepts only keys present here.
// These names are a stable contract also consumed by the future
// profile-versioning spec, so treat renames as breaking changes.
export const LINKABLE_METRIC_REGISTRY = {
  avgSentenceLength: "rhythm.mean",
  sentenceLengthVariance: "rhythm.variance",
  passiveVoiceRatio: "sentenceStructure.passiveRatio",
  fragmentCount: "sentenceStructure.fragmentCount",
  singleSentenceParagraphCount: "sentenceStructure.singleSentenceParagraphCount",
  commaRatePer1000: "punctuation.commaRatePer1000",
  semicolonRatePer1000: "punctuation.semicolonRatePer1000",
  colonRatePer1000: "punctuation.colonRatePer1000",
  dashRatePer1000: "punctuation.dashRatePer1000",
  parenthesisRatePer1000: "punctuation.parenthesisRatePer1000",
  questionRatePer1000: "punctuation.questionRatePer1000",
  exclamationRatePer1000: "punctuation.exclamationRatePer1000",
  ellipsisRatePer1000: "punctuation.ellipsisRatePer1000",
} as const satisfies Record<string, string>;

export type LinkableMetricKey = keyof typeof LINKABLE_METRIC_REGISTRY;

export function isLinkableMetricKey(key: string): key is LinkableMetricKey {
  return Object.prototype.hasOwnProperty.call(LINKABLE_METRIC_REGISTRY, key);
}
