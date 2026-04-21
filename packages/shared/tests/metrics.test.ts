import { describe, expect, test } from "bun:test";
import { SentenceStructureAnalysisSchema } from "../src/metrics.js";

describe("SentenceStructureAnalysisSchema", () => {
  const base = {
    passiveCount: 0,
    activeCount: 3,
    passiveRatio: 0,
    paragraphOpeners: [],
    paragraphCount: 3,
    fragmentCount: 0,
    totalSentences: 3,
    paragraphLengths: [1, 1, 1],
    paragraphLengthDistribution: { short: 3, medium: 0, long: 0 },
    singleSentenceParagraphCount: 3,
  };

  test("accepts object with all fields including new paragraph fields", () => {
    const result = SentenceStructureAnalysisSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  test("rejects missing paragraphLengths", () => {
    const { paragraphLengths: _omit, ...rest } = base;
    const result = SentenceStructureAnalysisSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  test("rejects missing paragraphLengthDistribution", () => {
    const { paragraphLengthDistribution: _omit, ...rest } = base;
    const result = SentenceStructureAnalysisSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  test("rejects missing singleSentenceParagraphCount", () => {
    const { singleSentenceParagraphCount: _omit, ...rest } = base;
    const result = SentenceStructureAnalysisSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  test("rejects wrong-typed paragraphLengths (string instead of number[])", () => {
    const bad = { ...base, paragraphLengths: ["1", "2"] };
    const result = SentenceStructureAnalysisSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  test("rejects negative singleSentenceParagraphCount", () => {
    const bad = { ...base, singleSentenceParagraphCount: -1 };
    const result = SentenceStructureAnalysisSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  test("rejects distribution with missing bucket", () => {
    const bad = { ...base, paragraphLengthDistribution: { short: 0, medium: 0 } };
    const result = SentenceStructureAnalysisSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});
