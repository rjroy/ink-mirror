import { describe, expect, test } from "bun:test";
import {
  ObservationSchema,
  RawObservationSchema,
  ObserverOutputSchema,
  ObservationDimensionSchema,
  CurationStatusSchema,
} from "../src/observations.js";

describe("ObservationDimensionSchema", () => {
  test("accepts valid dimensions", () => {
    expect(ObservationDimensionSchema.parse("sentence-rhythm")).toBe("sentence-rhythm");
    expect(ObservationDimensionSchema.parse("word-level-habits")).toBe("word-level-habits");
    expect(ObservationDimensionSchema.parse("sentence-structure")).toBe("sentence-structure");
  });

  test("rejects invalid dimensions", () => {
    expect(() => ObservationDimensionSchema.parse("invalid")).toThrow();
    expect(() => ObservationDimensionSchema.parse("grammar")).toThrow();
  });
});

describe("CurationStatusSchema", () => {
  test("accepts all valid statuses", () => {
    expect(CurationStatusSchema.parse("pending")).toBe("pending");
    expect(CurationStatusSchema.parse("intentional")).toBe("intentional");
    expect(CurationStatusSchema.parse("accidental")).toBe("accidental");
    expect(CurationStatusSchema.parse("undecided")).toBe("undecided");
  });

  test("rejects invalid status", () => {
    expect(() => CurationStatusSchema.parse("approved")).toThrow();
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

  test("rejects empty observations", () => {
    const result = ObserverOutputSchema.safeParse({ observations: [] });
    expect(result.success).toBe(false);
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
  test("accepts full observation with all fields", () => {
    const result = ObservationSchema.safeParse({
      id: "obs-2026-03-27-001",
      entryId: "entry-2026-03-27-001",
      pattern: "Short sentences",
      evidence: "I stopped.",
      dimension: "sentence-rhythm",
      status: "pending",
      createdAt: "2026-03-27T10:00:00.000Z",
      updatedAt: "2026-03-27T10:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });
});
