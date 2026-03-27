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
  tokenFrequencies: z.record(z.string(), z.number().int().positive()),
  totalTokens: z.number().int().nonnegative(),
  uniqueTokens: z.number().int().nonnegative(),
  hedgingWords: z.record(z.string(), z.number().int().positive()),
  intensifiers: z.record(z.string(), z.number().int().positive()),
  repeatedPhrases: z.record(z.string(), z.number().int().positive()),
});

export type WordFrequencyAnalysis = z.infer<typeof WordFrequencyAnalysisSchema>;

// --- Top-level entry metrics ---

export const EntryMetricsSchema = z.object({
  sentences: z.array(SentenceMetricsSchema),
  rhythm: RhythmAnalysisSchema,
  wordFrequency: WordFrequencyAnalysisSchema,
});

export type EntryMetrics = z.infer<typeof EntryMetricsSchema>;
