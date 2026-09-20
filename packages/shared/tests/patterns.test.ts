import { describe, expect, test } from "bun:test";
import {
  type PatternStatus,
  PatternStatusSchema,
  PATTERN_TRANSITIONS,
  isValidPatternTransition,
  PatternSchema,
  PatternRetirementSchema,
  SightingSchema,
  DossierSchema,
  ClassifyPatternRequestSchema,
  DetachSightingRequestSchema,
  MergePatternsRequestSchema,
  DismissPatternRequestSchema,
  PromotePatternRequestSchema,
  PatternProposalActionRequestSchema,
  RetirePatternRequestSchema,
  ReactivatePatternRequestSchema,
  WatchItemSchema,
} from "../src/patterns.js";

const ALL_STATUSES = PatternStatusSchema.options;

describe("PATTERN_TRANSITIONS / isValidPatternTransition (REQ-LPC-13/22)", () => {
  // Exhaustive: every (from, to) pair across all 5 statuses, per the spec's
  // Concepts section: candidate/undecided -> any classification; any
  // classified status re-classifies to another; retired only via a
  // retire/dismiss/merge action; retired -> undecided only, via reactivate.
  const expected: Record<PatternStatus, PatternStatus[]> = {
    candidate: ["intentional", "accidental", "undecided", "retired"],
    undecided: ["intentional", "accidental", "retired"],
    intentional: ["accidental", "undecided", "retired"],
    accidental: ["intentional", "undecided", "retired"],
    retired: ["undecided"],
  };

  test("PATTERN_TRANSITIONS matches the expected table exactly", () => {
    for (const from of ALL_STATUSES) {
      expect(PATTERN_TRANSITIONS[from].slice().sort()).toEqual(
        expected[from].slice().sort(),
      );
    }
  });

  test("every (from, to) pair agrees between isValidPatternTransition and the table", () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        const expectedValid = expected[from].includes(to);
        expect(isValidPatternTransition(from, to)).toBe(expectedValid);
      }
    }
  });

  test("no status transitions into itself", () => {
    for (const status of ALL_STATUSES) {
      expect(isValidPatternTransition(status, status)).toBe(false);
    }
  });

  test("retired is only reachable from a classified or candidate status, never from itself", () => {
    for (const from of ALL_STATUSES) {
      const canRetire = isValidPatternTransition(from, "retired");
      expect(canRetire).toBe(from !== "retired");
    }
  });

  test("retired transitions only to undecided (reactivate)", () => {
    expect(PATTERN_TRANSITIONS.retired).toEqual(["undecided"]);
  });
});

describe("PatternSchema (REQ-LPC-1)", () => {
  const validPattern = {
    id: "pat-2026-07-09-001",
    statement: "Uses staccato rhythm for emphasis at paragraph endings",
    dimension: "sentence-rhythm",
    status: "candidate",
    createdAt: "2026-07-09T00:00:00.000Z",
    updatedAt: "2026-07-09T00:00:00.000Z",
    sightingCount: 1,
    entryIds: ["entry-2026-07-09-001"],
  };

  test("accepts a minimal valid pattern (no metricLink, watch, retirement, ruleId)", () => {
    const result = PatternSchema.safeParse(validPattern);
    expect(result.success).toBe(true);
  });

  test("accepts a pattern with a valid metricLink", () => {
    const result = PatternSchema.safeParse({ ...validPattern, metricLink: "avgSentenceLength" });
    expect(result.success).toBe(true);
  });

  test("rejects a pattern with a metricLink not in the linkable-metric registry", () => {
    const result = PatternSchema.safeParse({ ...validPattern, metricLink: "wordsPerMinute" });
    expect(result.success).toBe(false);
  });

  test("accepts migratedNoHistory (REQ-LPC-27: migration marks patterns created from a v1 rule)", () => {
    const result = PatternSchema.safeParse({ ...validPattern, migratedNoHistory: true });
    expect(result.success).toBe(true);
    expect(result.success && result.data.migratedNoHistory).toBe(true);
  });

  test("migratedNoHistory defaults to absent for an ordinary pattern", () => {
    const result = PatternSchema.safeParse(validPattern);
    expect(result.success && result.data.migratedNoHistory).toBeUndefined();
  });

  test("rejects an empty statement", () => {
    const result = PatternSchema.safeParse({ ...validPattern, statement: "" });
    expect(result.success).toBe(false);
  });

  test("rejects an invalid status", () => {
    const result = PatternSchema.safeParse({ ...validPattern, status: "confirmed" });
    expect(result.success).toBe(false);
  });

  test("accepts a retired pattern with a dismissedAsWrong marker", () => {
    const result = PatternSchema.safeParse({
      ...validPattern,
      status: "retired",
      retirement: { dismissedAsWrong: true },
    });
    expect(result.success).toBe(true);
  });

  test("accepts a retired pattern with a mergedInto marker", () => {
    const result = PatternSchema.safeParse({
      ...validPattern,
      status: "retired",
      retirement: { mergedInto: "pat-2026-07-01-000" },
    });
    expect(result.success).toBe(true);
  });

  test("accepts a pattern with a watch item", () => {
    const result = PatternSchema.safeParse({
      ...validPattern,
      status: "accidental",
      watch: { classifiedAt: "2026-07-09T00:00:00.000Z", resolved: false },
    });
    expect(result.success).toBe(true);
  });
});

describe("PatternRetirementSchema (planning decisions 1 and 2)", () => {
  test("accepts dismissedAsWrong alone", () => {
    const result = PatternRetirementSchema.safeParse({ dismissedAsWrong: true });
    expect(result.success).toBe(true);
  });

  test("accepts mergedInto alone", () => {
    const result = PatternRetirementSchema.safeParse({ mergedInto: "pat-2026-07-01-000" });
    expect(result.success).toBe(true);
  });

  test("accepts neither marker (plain retirement)", () => {
    const result = PatternRetirementSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test("rejects dismissedAsWrong and mergedInto both set", () => {
    const result = PatternRetirementSchema.safeParse({
      dismissedAsWrong: true,
      mergedInto: "pat-2026-07-01-000",
    });
    expect(result.success).toBe(false);
  });
});

describe("WatchItemSchema (REQ-LPC-23/25)", () => {
  test("accepts an unresolved watch item without a baseline (qualitative pattern)", () => {
    const result = WatchItemSchema.safeParse({
      classifiedAt: "2026-07-09T00:00:00.000Z",
      resolved: false,
    });
    expect(result.success).toBe(true);
  });

  test("accepts a resolved watch item with baseline and resolvedAt (computable pattern)", () => {
    const result = WatchItemSchema.safeParse({
      classifiedAt: "2026-07-09T00:00:00.000Z",
      baseline: 4.2,
      resolved: true,
      resolvedAt: "2026-07-20T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  test("rejects a missing resolved flag", () => {
    const result = WatchItemSchema.safeParse({ classifiedAt: "2026-07-09T00:00:00.000Z" });
    expect(result.success).toBe(false);
  });
});

describe("SightingSchema (REQ-LPC-3)", () => {
  test("accepts a valid sighting", () => {
    const result = SightingSchema.safeParse({
      id: "obs-2026-07-09-001",
      patternId: "pat-2026-07-09-001",
      entryId: "entry-2026-07-09-001",
      evidence: ["I stopped. I turned."],
      dimension: "sentence-rhythm",
      createdAt: "2026-07-09T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  test("rejects empty evidence", () => {
    const result = SightingSchema.safeParse({
      id: "obs-2026-07-09-001",
      patternId: "pat-2026-07-09-001",
      entryId: "entry-2026-07-09-001",
      evidence: [""],
      dimension: "sentence-rhythm",
      createdAt: "2026-07-09T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("DossierSchema (REQ-LPC-12)", () => {
  const pattern = {
    id: "pat-2026-07-09-001",
    statement: "Uses staccato rhythm for emphasis at paragraph endings",
    dimension: "sentence-rhythm",
    status: "candidate",
    createdAt: "2026-07-09T00:00:00.000Z",
    updatedAt: "2026-07-09T00:00:00.000Z",
    sightingCount: 1,
    entryIds: ["entry-2026-07-09-001"],
  };

  test("accepts a dossier with no sightings context, trend, or watch status", () => {
    const result = DossierSchema.safeParse({
      pattern,
      sightings: [],
      distinctEntryCount: 0,
      isProposal: false,
    });
    expect(result.success).toBe(true);
  });

  test("accepts a dossier with sightings, a substrate trend, and watch status", () => {
    const result = DossierSchema.safeParse({
      pattern: { ...pattern, metricLink: "avgSentenceLength" },
      sightings: [
        {
          id: "obs-2026-07-09-001",
          patternId: "pat-2026-07-09-001",
          entryId: "entry-2026-07-09-001",
          evidence: ["I stopped."],
          dimension: "sentence-rhythm",
          createdAt: "2026-07-09T00:00:00.000Z",
          entryText: "I stopped. I turned around.",
        },
      ],
      distinctEntryCount: 1,
      trend: { metricLink: "avgSentenceLength", rollingMean: 8.2, windowSize: 5 },
      watchStatus: {
        classifiedAt: "2026-07-09T00:00:00.000Z",
        recurrenceText: "seen in 2 of 5 entries since you marked this accidental",
        resolved: false,
      },
      isProposal: true,
    });
    expect(result.success).toBe(true);
  });

  test("rejects a trend with a metricLink outside the linkable-metric registry", () => {
    const result = DossierSchema.safeParse({
      pattern,
      sightings: [],
      distinctEntryCount: 0,
      trend: { metricLink: "notARealMetric", rollingMean: 1, windowSize: 5 },
      isProposal: false,
    });
    expect(result.success).toBe(false);
  });
});

describe("Pattern-grain curation request schemas (REQ-LPC-28)", () => {
  test("ClassifyPatternRequestSchema accepts a classification with optional promote", () => {
    expect(ClassifyPatternRequestSchema.safeParse({ status: "intentional" }).success).toBe(true);
    expect(
      ClassifyPatternRequestSchema.safeParse({ status: "intentional", promote: true }).success,
    ).toBe(true);
  });

  test("ClassifyPatternRequestSchema rejects candidate/retired as classify targets", () => {
    expect(ClassifyPatternRequestSchema.safeParse({ status: "candidate" }).success).toBe(false);
    expect(ClassifyPatternRequestSchema.safeParse({ status: "retired" }).success).toBe(false);
  });

  test("DetachSightingRequestSchema requires a sightingId", () => {
    expect(DetachSightingRequestSchema.safeParse({ sightingId: "obs-1" }).success).toBe(true);
    expect(DetachSightingRequestSchema.safeParse({}).success).toBe(false);
  });

  test("MergePatternsRequestSchema requires a duplicateId", () => {
    expect(MergePatternsRequestSchema.safeParse({ duplicateId: "pat-2" }).success).toBe(true);
    expect(MergePatternsRequestSchema.safeParse({}).success).toBe(false);
  });

  test("DismissPatternRequestSchema/PromotePatternRequestSchema/RetirePatternRequestSchema/ReactivatePatternRequestSchema accept an empty body", () => {
    expect(DismissPatternRequestSchema.safeParse({}).success).toBe(true);
    expect(PromotePatternRequestSchema.safeParse({}).success).toBe(true);
    expect(RetirePatternRequestSchema.safeParse({}).success).toBe(true);
    expect(ReactivatePatternRequestSchema.safeParse({}).success).toBe(true);
  });

  test("PatternProposalActionRequestSchema accepts accept/decline and rejects anything else", () => {
    expect(PatternProposalActionRequestSchema.safeParse({ action: "accept" }).success).toBe(true);
    expect(PatternProposalActionRequestSchema.safeParse({ action: "decline" }).success).toBe(true);
    expect(PatternProposalActionRequestSchema.safeParse({ action: "maybe" }).success).toBe(false);
  });
});
