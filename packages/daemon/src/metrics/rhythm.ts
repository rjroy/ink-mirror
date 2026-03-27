import type { RhythmAnalysis, PaceChange, SentenceMetrics } from "@ink-mirror/shared";

/**
 * Compute the arithmetic mean of an array of numbers.
 * Returns 0 for empty arrays.
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Compute population variance for an array of numbers.
 * Returns 0 for arrays with fewer than 2 elements.
 */
function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
}

/**
 * Find the longest consecutive run where every element satisfies a predicate.
 */
function maxConsecutiveRun(values: number[], predicate: (v: number) => boolean): number {
  let max = 0;
  let current = 0;
  for (const v of values) {
    if (predicate(v)) {
      current++;
      if (current > max) max = current;
    } else {
      current = 0;
    }
  }
  return max;
}

/**
 * Size of the sliding window for pace change detection.
 * A window of 3 sentences balances sensitivity with noise resistance.
 */
const PACE_WINDOW = 3;

/**
 * Minimum ratio between two window averages to count as a pace change.
 * A 50% shift in average sentence length is noticeable to a reader.
 */
const PACE_CHANGE_RATIO = 1.5;

/**
 * Detect pace changes: positions where the average sentence length
 * shifts significantly between adjacent windows of sentences.
 *
 * Uses a sliding window approach. A pace change is recorded when
 * the ratio between two adjacent windows exceeds the threshold.
 */
function detectPaceChanges(lengths: number[]): PaceChange[] {
  if (lengths.length < PACE_WINDOW * 2) return [];

  const changes: PaceChange[] = [];

  for (let i = 0; i <= lengths.length - PACE_WINDOW * 2; i++) {
    const windowA = lengths.slice(i, i + PACE_WINDOW);
    const windowB = lengths.slice(i + PACE_WINDOW, i + PACE_WINDOW * 2);
    const avgA = mean(windowA);
    const avgB = mean(windowB);

    if (avgA === 0 || avgB === 0) continue;

    const ratio = Math.max(avgA, avgB) / Math.min(avgA, avgB);
    if (ratio >= PACE_CHANGE_RATIO) {
      changes.push({
        position: i + PACE_WINDOW,
        fromAvgLength: Math.round(avgA * 10) / 10,
        toAvgLength: Math.round(avgB * 10) / 10,
      });
    }
  }

  return changes;
}

/**
 * Analyze the rhythm of sentence lengths across an entry.
 *
 * Short/long thresholds are relative to the entry's own mean:
 * - Short: less than half the mean (or <= 5 words if mean is very low)
 * - Long: more than 1.5x the mean (or >= 20 words if mean is very low)
 */
export function analyzeRhythm(sentences: SentenceMetrics[]): RhythmAnalysis {
  const lengths = sentences.map((s) => s.wordCount);
  const avg = mean(lengths);
  const v = variance(lengths);

  const shortThreshold = Math.max(Math.floor(avg * 0.5), 5);
  const longThreshold = Math.max(Math.ceil(avg * 1.5), 20);

  return {
    lengthSequence: lengths,
    mean: Math.round(avg * 10) / 10,
    variance: Math.round(v * 10) / 10,
    shortThreshold,
    longThreshold,
    maxConsecutiveShort: maxConsecutiveRun(lengths, (l) => l <= shortThreshold),
    maxConsecutiveLong: maxConsecutiveRun(lengths, (l) => l >= longThreshold),
    paceChanges: detectPaceChanges(lengths),
  };
}
