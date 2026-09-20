import { describe, expect, test } from "bun:test";
import {
  ObservationSchema,
  RawObservationSchema,
  ObserverOutputSchema,
  ObservationDimensionSchema,
  PatternRefSchema,
} from "../src/observations.js";

describe("ObservationDimensionSchema", () => {
  test("accepts valid dimensions", () => {
    expect(ObservationDimensionSchema.parse("sentence-rhythm")).toBe("sentence-rhythm");
    expect(ObservationDimensionSchema.parse("word-level-habits")).toBe("word-level-habits");
    expect(ObservationDimensionSchema.parse("sentence-structure")).toBe("sentence-structure");
    expect(ObservationDimensionSchema.parse("paragraph-structure")).toBe("paragraph-structure");
  });

  test("rejects invalid dimensions", () => {
    expect(() => ObservationDimensionSchema.parse("invalid")).toThrow();
    expect(() => ObservationDimensionSchema.parse("grammar")).toThrow();
  });
});

describe("RawObservationSchema", () => {
  test("accepts valid raw observation", () => {
    const result = RawObservationSchema.safeParse({
      pattern: "Short sentence emphasis",
      evidence: "I stopped. I turned.",
      dimension: "sentence-rhythm",
    });
    expect(result.success).toBe(true);
  });

  test("rejects empty pattern", () => {
    const result = RawObservationSchema.safeParse({
      pattern: "",
      evidence: "some text",
      dimension: "sentence-rhythm",
    });
    expect(result.success).toBe(false);
  });

  test("rejects empty evidence", () => {
    const result = RawObservationSchema.safeParse({
      pattern: "pattern",
      evidence: "",
      dimension: "sentence-rhythm",
    });
    expect(result.success).toBe(false);
  });

  test("accepts a raw observation without patternRef (pre-Phase-3 shape)", () => {
    const result = RawObservationSchema.safeParse({
      pattern: "Short sentence emphasis",
      evidence: "I stopped. I turned.",
      dimension: "sentence-rhythm",
    });
    expect(result.success).toBe(true);
  });

  test("accepts a raw observation with a patternRef to an existing pattern", () => {
    const result = RawObservationSchema.safeParse({
      pattern: "Short sentence emphasis",
      evidence: "I stopped. I turned.",
      dimension: "sentence-rhythm",
      patternRef: { patternId: "pat-2026-07-09-001" },
    });
    expect(result.success).toBe(true);
  });

  test("accepts a raw observation with a patternRef declaring a new pattern", () => {
    const result = RawObservationSchema.safeParse({
      pattern: "Short sentence emphasis",
      evidence: "I stopped. I turned.",
      dimension: "sentence-rhythm",
      patternRef: {
        newPattern: {
          statement: "Uses short sentences for emphasis",
          dimension: "sentence-rhythm",
        },
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("PatternRefSchema (existing-ID vs. new-pattern XOR, REQ-LPC-4)", () => {
  test("accepts patternId alone", () => {
    const result = PatternRefSchema.safeParse({ patternId: "pat-2026-07-09-001" });
    expect(result.success).toBe(true);
  });

  test("accepts newPattern alone", () => {
    const result = PatternRefSchema.safeParse({
      newPattern: {
        statement: "Uses short sentences for emphasis",
        dimension: "sentence-rhythm",
      },
    });
    expect(result.success).toBe(true);
  });

  test("accepts newPattern with an unvalidated metricLink (downgrades to qualitative later, not rejected here)", () => {
    const result = PatternRefSchema.safeParse({
      newPattern: {
        statement: "Uses short sentences for emphasis",
        dimension: "sentence-rhythm",
        metricLink: "not-a-real-registry-key",
      },
    });
    expect(result.success).toBe(true);
  });

  test("rejects both patternId and newPattern present", () => {
    const result = PatternRefSchema.safeParse({
      patternId: "pat-2026-07-09-001",
      newPattern: {
        statement: "Uses short sentences for emphasis",
        dimension: "sentence-rhythm",
      },
    });
    expect(result.success).toBe(false);
  });

  test("rejects neither patternId nor newPattern present", () => {
    const result = PatternRefSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("ObserverOutputSchema", () => {
  test("accepts 1-3 observations", () => {
    const one = ObserverOutputSchema.safeParse({
      observations: [
        { pattern: "a", evidence: "x", dimension: "sentence-rhythm" },
      ],
    });
    expect(one.success).toBe(true);

    const three = ObserverOutputSchema.safeParse({
      observations: [
        { pattern: "a", evidence: "x", dimension: "sentence-rhythm" },
        { pattern: "b", evidence: "y", dimension: "word-level-habits" },
        { pattern: "c", evidence: "z", dimension: "sentence-rhythm" },
      ],
    });
    expect(three.success).toBe(true);
  });

  test("accepts empty observations", () => {
    const result = ObserverOutputSchema.safeParse({ observations: [] });
    expect(result.success).toBe(true);
  });

  test("rejects more than 3 observations", () => {
    const result = ObserverOutputSchema.safeParse({
      observations: [
        { pattern: "a", evidence: "x", dimension: "sentence-rhythm" },
        { pattern: "b", evidence: "y", dimension: "sentence-rhythm" },
        { pattern: "c", evidence: "z", dimension: "sentence-rhythm" },
        { pattern: "d", evidence: "w", dimension: "sentence-rhythm" },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("ObservationSchema", () => {
  test("accepts full observation with all fields (no status field, REQ-LPC-30)", () => {
    const result = ObservationSchema.safeParse({
      id: "obs-2026-03-27-001",
      entryId: "entry-2026-03-27-001",
      patternId: "pat-2026-03-27-001",
      pattern: "Short sentences",
      evidence: "I stopped.",
      dimension: "sentence-rhythm",
      createdAt: "2026-03-27T10:00:00.000Z",
      updatedAt: "2026-03-27T10:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });
});
