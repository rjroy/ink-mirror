import { describe, expect, test } from "bun:test";
import { analyzeRhythm } from "../../src/metrics/rhythm.js";
import type { SentenceMetrics } from "@ink-mirror/shared";

function makeSentences(wordCounts: number[]): SentenceMetrics[] {
  return wordCounts.map((wc) => ({
    text: "x ".repeat(wc).trim() + ".",
    wordCount: wc,
    charCount: wc * 2,
  }));
}

describe("analyzeRhythm", () => {
  test("computes length sequence from sentence word counts", () => {
    const result = analyzeRhythm(makeSentences([3, 7, 12]));
    expect(result.lengthSequence).toEqual([3, 7, 12]);
  });

  test("computes mean word count", () => {
    const result = analyzeRhythm(makeSentences([4, 6, 8]));
    expect(result.mean).toBe(6);
  });

  test("computes population variance", () => {
    // [4, 6, 8] => mean 6, variance = ((4)+(0)+(4))/3 = 2.667
    const result = analyzeRhythm(makeSentences([4, 6, 8]));
    expect(result.variance).toBeCloseTo(2.7, 1);
  });

  test("returns 0 variance for single sentence", () => {
    const result = analyzeRhythm(makeSentences([10]));
    expect(result.variance).toBe(0);
  });

  test("returns 0 mean for empty input", () => {
    const result = analyzeRhythm([]);
    expect(result.mean).toBe(0);
    expect(result.variance).toBe(0);
  });

  test("detects consecutive short sentences", () => {
    // Mean = 10, short threshold = max(floor(5), 5) = 5
    // Sentences: 3, 4, 3, 15, 20, 15 => three shorts at start
    const result = analyzeRhythm(makeSentences([3, 4, 3, 15, 20, 15]));
    expect(result.maxConsecutiveShort).toBe(3);
  });

  test("detects consecutive long sentences", () => {
    // Mean ~8.3, long threshold = max(ceil(12.5), 20) = 20
    // Sentences: 3, 4, 5, 22, 25, 28 => three longs at end
    const result = analyzeRhythm(makeSentences([3, 4, 5, 22, 25, 28]));
    expect(result.maxConsecutiveLong).toBeGreaterThanOrEqual(3);
  });

  test("reports 0 consecutive runs when none exist", () => {
    // All sentences at moderate length around the mean
    const result = analyzeRhythm(makeSentences([10, 12, 11, 10, 13]));
    expect(result.maxConsecutiveShort).toBe(0);
    expect(result.maxConsecutiveLong).toBe(0);
  });

  test("detects pace changes between sections", () => {
    // Window of 3: first three avg ~4, next three avg ~20
    // Ratio ~5x, well above 1.5 threshold
    const result = analyzeRhythm(makeSentences([3, 4, 5, 18, 22, 20]));
    expect(result.paceChanges.length).toBeGreaterThanOrEqual(1);
    expect(result.paceChanges[0].position).toBe(3);
    expect(result.paceChanges[0].fromAvgLength).toBeCloseTo(4, 0);
    expect(result.paceChanges[0].toAvgLength).toBeCloseTo(20, 0);
  });

  test("returns no pace changes for uniform text", () => {
    const result = analyzeRhythm(makeSentences([10, 11, 10, 11, 10, 11]));
    expect(result.paceChanges).toEqual([]);
  });

  test("returns no pace changes when too few sentences", () => {
    const result = analyzeRhythm(makeSentences([3, 20]));
    expect(result.paceChanges).toEqual([]);
  });

  test("short/long thresholds use minimum floors", () => {
    // Very short mean (2 words): threshold floors kick in
    const result = analyzeRhythm(makeSentences([1, 2, 3]));
    expect(result.shortThreshold).toBe(5);
    expect(result.longThreshold).toBe(20);
  });
});
