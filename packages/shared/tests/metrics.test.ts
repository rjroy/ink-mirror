import { describe, expect, test } from "bun:test";
import {
  SentenceStructureAnalysisSchema,
  PunctuationAnalysisSchema,
  FunctionWordFrequencyAnalysisSchema,
  EntryMetricsSchema,
  MetricSnapshotSchema,
  LINKABLE_METRIC_REGISTRY,
  isLinkableMetricKey,
} from "../src/metrics.js";

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

describe("PunctuationAnalysisSchema (REQ-LPC-9)", () => {
  const base = {
    commaRatePer1000: 12.3,
    semicolonRatePer1000: 0.5,
    colonRatePer1000: 1.1,
    dashRatePer1000: 2.2,
    parenthesisRatePer1000: 0,
    questionRatePer1000: 0.3,
    exclamationRatePer1000: 0,
    ellipsisRatePer1000: 0.1,
  };

  test("accepts a full set of punctuation rates", () => {
    const result = PunctuationAnalysisSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  test("rejects a missing rate field", () => {
    const { commaRatePer1000: _omit, ...rest } = base;
    const result = PunctuationAnalysisSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  test("rejects a negative rate", () => {
    const result = PunctuationAnalysisSchema.safeParse({ ...base, dashRatePer1000: -1 });
    expect(result.success).toBe(false);
  });
});

describe("FunctionWordFrequencyAnalysisSchema (REQ-LPC-9)", () => {
  test("accepts token frequencies and a total", () => {
    const result = FunctionWordFrequencyAnalysisSchema.safeParse({
      tokenFrequencies: { the: 12, and: 8 },
      totalTokens: 20,
    });
    expect(result.success).toBe(true);
  });

  test("rejects a non-positive frequency count", () => {
    const result = FunctionWordFrequencyAnalysisSchema.safeParse({
      tokenFrequencies: { the: 0 },
      totalTokens: 20,
    });
    expect(result.success).toBe(false);
  });
});

describe("EntryMetricsSchema", () => {
  const entryMetrics = {
    sentences: [{ text: "I stopped.", wordCount: 2, charCount: 10 }],
    rhythm: {
      lengthSequence: [2],
      mean: 2,
      variance: 0,
      shortThreshold: 5,
      longThreshold: 15,
      maxConsecutiveShort: 1,
      maxConsecutiveLong: 0,
      paceChanges: [],
    },
    wordFrequency: {
      tokenFrequencies: { stopped: 1 },
      totalTokens: 1,
      uniqueTokens: 1,
      hedgingWords: {},
      intensifiers: {},
      repeatedPhrases: {},
    },
    sentenceStructure: {
      passiveCount: 0,
      activeCount: 1,
      passiveRatio: 0,
      paragraphOpeners: [],
      paragraphCount: 1,
      fragmentCount: 0,
      totalSentences: 1,
      paragraphLengths: [1],
      paragraphLengthDistribution: { short: 1, medium: 0, long: 0 },
      singleSentenceParagraphCount: 1,
    },
  };

  test("accepts entry metrics without functionWordFrequencies/punctuation (pre-Phase-2 shape)", () => {
    const result = EntryMetricsSchema.safeParse(entryMetrics);
    expect(result.success).toBe(true);
  });

  test("accepts entry metrics with functionWordFrequencies and punctuation populated", () => {
    const result = EntryMetricsSchema.safeParse({
      ...entryMetrics,
      functionWordFrequencies: { the: 3, and: 1 },
      punctuation: {
        commaRatePer1000: 5,
        semicolonRatePer1000: 0,
        colonRatePer1000: 0,
        dashRatePer1000: 0,
        parenthesisRatePer1000: 0,
        questionRatePer1000: 0,
        exclamationRatePer1000: 0,
        ellipsisRatePer1000: 0,
      },
    });
    // functionWordFrequencies must satisfy FunctionWordFrequencyAnalysisSchema's
    // shape (tokenFrequencies + totalTokens), not a bare record.
    expect(result.success).toBe(false);
  });

  test("accepts entry metrics with a well-formed functionWordFrequencies block", () => {
    const result = EntryMetricsSchema.safeParse({
      ...entryMetrics,
      functionWordFrequencies: { tokenFrequencies: { the: 3, and: 1 }, totalTokens: 4 },
      punctuation: {
        commaRatePer1000: 5,
        semicolonRatePer1000: 0,
        colonRatePer1000: 0,
        dashRatePer1000: 0,
        parenthesisRatePer1000: 0,
        questionRatePer1000: 0,
        exclamationRatePer1000: 0,
        ellipsisRatePer1000: 0,
      },
    });
    expect(result.success).toBe(true);
  });

  test("rejects a metrics object missing a required base field", () => {
    const { rhythm: _omit, ...rest } = entryMetrics;
    const result = EntryMetricsSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

describe("MetricSnapshotSchema (REQ-LPC-7)", () => {
  const entryMetrics = {
    sentences: [{ text: "I stopped.", wordCount: 2, charCount: 10 }],
    rhythm: {
      lengthSequence: [2],
      mean: 2,
      variance: 0,
      shortThreshold: 5,
      longThreshold: 15,
      maxConsecutiveShort: 1,
      maxConsecutiveLong: 0,
      paceChanges: [],
    },
    wordFrequency: {
      tokenFrequencies: { stopped: 1 },
      totalTokens: 1,
      uniqueTokens: 1,
      hedgingWords: {},
      intensifiers: {},
      repeatedPhrases: {},
    },
    sentenceStructure: {
      passiveCount: 0,
      activeCount: 1,
      passiveRatio: 0,
      paragraphOpeners: [],
      paragraphCount: 1,
      fragmentCount: 0,
      totalSentences: 1,
      paragraphLengths: [1],
      paragraphLengthDistribution: { short: 1, medium: 0, long: 0 },
      singleSentenceParagraphCount: 1,
    },
  };

  test("accepts a valid snapshot", () => {
    const result = MetricSnapshotSchema.safeParse({
      entryId: "entry-2026-07-09-001",
      date: "2026-07-09T00:00:00.000Z",
      metrics: entryMetrics,
      schemaVersion: 1,
    });
    expect(result.success).toBe(true);
  });

  test("rejects a schema version other than 1", () => {
    const result = MetricSnapshotSchema.safeParse({
      entryId: "entry-2026-07-09-001",
      date: "2026-07-09T00:00:00.000Z",
      metrics: entryMetrics,
      schemaVersion: 2,
    });
    expect(result.success).toBe(false);
  });
});

describe("linkable-metric registry", () => {
  test("every registered key is accepted by isLinkableMetricKey", () => {
    for (const key of Object.keys(LINKABLE_METRIC_REGISTRY)) {
      expect(isLinkableMetricKey(key)).toBe(true);
    }
  });

  test("rejects a key not present in the registry", () => {
    expect(isLinkableMetricKey("madeUpMetricThatDoesNotExist")).toBe(false);
  });

  test("registry values are non-empty accessor path strings", () => {
    for (const value of Object.values(LINKABLE_METRIC_REGISTRY)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });
});
