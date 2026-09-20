import { describe, expect, test } from "bun:test";
import {
  ObservationCreatedEventSchema,
  PatternDiscoveredEventSchema,
  PatternProposalEventSchema,
  PatternWatchResolvedEventSchema,
  EVENT_TOPICS,
} from "../src/events.js";

const baseObservation = {
  id: "obs-2026-07-09-001",
  entryId: "entry-2026-07-09-001",
  pattern: "Short sentences",
  evidence: ["I stopped."],
  dimension: "sentence-rhythm",
  status: "pending",
  createdAt: "2026-07-09T00:00:00.000Z",
  updatedAt: "2026-07-09T00:00:00.000Z",
};

const basePattern = {
  id: "pat-2026-07-09-001",
  statement: "Uses staccato rhythm for emphasis at paragraph endings",
  dimension: "sentence-rhythm",
  status: "candidate",
  createdAt: "2026-07-09T00:00:00.000Z",
  updatedAt: "2026-07-09T00:00:00.000Z",
  sightingCount: 1,
  entryIds: ["entry-2026-07-09-001"],
};

describe("ObservationCreatedEventSchema (REQ-LPC-29)", () => {
  test("accepts the existing observation payload plus a resolved pattern reference", () => {
    const result = ObservationCreatedEventSchema.safeParse({
      ...baseObservation,
      patternId: "pat-2026-07-09-001",
    });
    expect(result.success).toBe(true);
  });

  test("rejects the payload without a patternId (every observation resolves to a pattern, REQ-LPC-2)", () => {
    const result = ObservationCreatedEventSchema.safeParse(baseObservation);
    expect(result.success).toBe(false);
  });
});

describe("PatternDiscoveredEventSchema (REQ-LPC-29)", () => {
  test("accepts a newly discovered pattern", () => {
    const result = PatternDiscoveredEventSchema.safeParse({ pattern: basePattern });
    expect(result.success).toBe(true);
  });
});

describe("PatternProposalEventSchema (REQ-LPC-29)", () => {
  test("accepts a proposal payload", () => {
    const result = PatternProposalEventSchema.safeParse({
      patternId: "pat-2026-07-09-001",
      statement: basePattern.statement,
      dimension: "sentence-rhythm",
    });
    expect(result.success).toBe(true);
  });
});

describe("PatternWatchResolvedEventSchema (REQ-LPC-29)", () => {
  test("accepts a computable resolution", () => {
    const result = PatternWatchResolvedEventSchema.safeParse({
      patternId: "pat-2026-07-09-001",
      resolvedAt: "2026-07-20T00:00:00.000Z",
      kind: "computable",
    });
    expect(result.success).toBe(true);
  });

  test("accepts a qualitative resolution", () => {
    const result = PatternWatchResolvedEventSchema.safeParse({
      patternId: "pat-2026-07-09-001",
      resolvedAt: "2026-07-20T00:00:00.000Z",
      kind: "qualitative",
    });
    expect(result.success).toBe(true);
  });

  test("rejects an unknown kind", () => {
    const result = PatternWatchResolvedEventSchema.safeParse({
      patternId: "pat-2026-07-09-001",
      resolvedAt: "2026-07-20T00:00:00.000Z",
      kind: "manual",
    });
    expect(result.success).toBe(false);
  });
});

describe("EVENT_TOPICS", () => {
  test("carries the versioned topic names REQ-LPC-29 requires", () => {
    expect(EVENT_TOPICS.observationCreated).toBe("observation:created");
    expect(EVENT_TOPICS.patternDiscovered).toBe("pattern:discovered");
    expect(EVENT_TOPICS.patternProposal).toBe("pattern:proposal");
    expect(EVENT_TOPICS.patternWatchResolved).toBe("pattern:watch-resolved");
  });
});
