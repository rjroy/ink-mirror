import { describe, test, expect } from "bun:test";
import { buildUserMessage } from "../src/observer.js";
import type { EntryMetrics } from "@ink-mirror/shared";

const stubMetrics: EntryMetrics = {
  sentences: [{ text: "Hello world.", wordCount: 2, charCount: 12 }],
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
    tokenFrequencies: { hello: 1, world: 1 },
    totalTokens: 2,
    uniqueTokens: 2,
    hedgingWords: {},
    intensifiers: {},
    repeatedPhrases: {},
  },
  sentenceStructure: {
    passiveCount: 0,
    activeCount: 1,
    passiveRatio: 0,
    paragraphOpeners: [{ pattern: "other", count: 1 }],
    paragraphCount: 1,
    fragmentCount: 0,
    totalSentences: 1,
    paragraphLengths: [1],
    paragraphLengthDistribution: { short: 1, medium: 0, long: 0 },
    singleSentenceParagraphCount: 1,
  },
};

describe("Tier 2 context assembly", () => {
  test("includes recent entries when provided", () => {
    const recentEntries = [
      "First recent entry about writing.",
      "Second recent entry about style.",
    ];
    const message = buildUserMessage("Current entry text.", stubMetrics, "", recentEntries);

    expect(message).toContain("## Recent Entries");
    expect(message).toContain("### Recent Entry 1");
    expect(message).toContain("First recent entry about writing.");
    expect(message).toContain("### Recent Entry 2");
    expect(message).toContain("Second recent entry about style.");
    // Current entry at the end
    expect(message.indexOf("Current entry text.")).toBeGreaterThan(
      message.indexOf("Second recent entry"),
    );
  });

  test("omits recent entries section when empty", () => {
    const message = buildUserMessage("Current entry text.", stubMetrics, "", []);
    expect(message).not.toContain("## Recent Entries");
    expect(message).toContain("## Current Entry");
  });

  test("places recent entries before current entry (REQ-V1-15)", () => {
    const recentEntries = ["Old entry one.", "Old entry two."];
    const message = buildUserMessage("New entry text.", stubMetrics, "", recentEntries);

    const recentPos = message.indexOf("## Recent Entries");
    const currentPos = message.indexOf("## Current Entry");
    expect(recentPos).toBeLessThan(currentPos);
  });

  test("includes style profile in correct position", () => {
    const message = buildUserMessage(
      "Current text.",
      stubMetrics,
      "### Sentence Rhythm\n- Uses short sentences",
      ["Recent entry."],
    );

    const recentPos = message.indexOf("## Recent Entries");
    const profilePos = message.indexOf("## Writer's Style Profile");
    const currentPos = message.indexOf("## Current Entry");

    // Order: recent entries, profile, metrics, current entry
    expect(recentPos).toBeLessThan(profilePos);
    expect(profilePos).toBeLessThan(currentPos);
  });
});

describe("Tier 2 activation logic", () => {
  // These test the observe() function's decision to include Tier 2 context.
  // Since observe() is async and calls deps, we test the boundary:
  // corpusSize determines whether recentEntries is called.

  test("recentEntries not called when corpus < 5", async () => {
    const { observe } = await import("../src/observer.js");
    let recentCalled = false;

    const result = await observe(
      {
        sessionRunner: {
          run: async () => ({
            content: JSON.stringify({
              observations: [{
                pattern: "Test pattern",
                evidence: "hello world",
                dimension: "sentence-rhythm",
              }],
            }),
          }),
        },
        observationStore: {
          save: async (_eid, raw) => ({
            id: "obs-1",
            entryId: "entry-1",
            pattern: raw.pattern,
            evidence: raw.evidence,
            dimension: raw.dimension,
            status: "pending" as const,
            createdAt: "2026-01-01",
            updatedAt: "2026-01-01",
          }),
          list: async () => [],
          get: async () => undefined,
          updateStatus: async () => undefined,
        },
        computeMetrics: () => stubMetrics,
        corpusSize: async () => 3,
        recentEntries: async () => {
          recentCalled = true;
          return [];
        },
      },
      "entry-1",
      "hello world",
    );

    expect(recentCalled).toBe(false);
    expect(result.observations).toHaveLength(1);
  });

  test("recentEntries called when corpus >= 5", async () => {
    const { observe } = await import("../src/observer.js");
    let recentCalled = false;

    await observe(
      {
        sessionRunner: {
          run: async () => ({
            content: JSON.stringify({
              observations: [{
                pattern: "Test pattern",
                evidence: "hello world",
                dimension: "sentence-rhythm",
              }],
            }),
          }),
        },
        observationStore: {
          save: async (_eid, raw) => ({
            id: "obs-1",
            entryId: "entry-1",
            pattern: raw.pattern,
            evidence: raw.evidence,
            dimension: raw.dimension,
            status: "pending" as const,
            createdAt: "2026-01-01",
            updatedAt: "2026-01-01",
          }),
          list: async () => [],
          get: async () => undefined,
          updateStatus: async () => undefined,
        },
        computeMetrics: () => stubMetrics,
        corpusSize: async () => 7,
        recentEntries: async (limit: number) => {
          recentCalled = true;
          expect(limit).toBe(5);
          return [
            { id: "e1", body: "Entry one." },
            { id: "e2", body: "Entry two." },
          ];
        },
      },
      "entry-1",
      "hello world",
    );

    expect(recentCalled).toBe(true);
  });

  // F7: Tier 2 boundary tests at the exact threshold (4 and 5)
  test("recentEntries not called when corpus is exactly 4", async () => {
    const { observe } = await import("../src/observer.js");
    let recentCalled = false;

    await observe(
      {
        sessionRunner: {
          run: async () => ({
            content: JSON.stringify({
              observations: [{
                pattern: "Test pattern",
                evidence: "hello world",
                dimension: "sentence-rhythm",
              }],
            }),
          }),
        },
        observationStore: {
          save: async (_eid, raw) => ({
            id: "obs-1",
            entryId: "entry-1",
            pattern: raw.pattern,
            evidence: raw.evidence,
            dimension: raw.dimension,
            status: "pending" as const,
            createdAt: "2026-01-01",
            updatedAt: "2026-01-01",
          }),
          list: async () => [],
          get: async () => undefined,
          updateStatus: async () => undefined,
        },
        computeMetrics: () => stubMetrics,
        corpusSize: async () => 4,
        recentEntries: async () => {
          recentCalled = true;
          return [];
        },
      },
      "entry-1",
      "hello world",
    );

    expect(recentCalled).toBe(false);
  });

  test("recentEntries called when corpus is exactly 5", async () => {
    const { observe } = await import("../src/observer.js");
    let recentCalled = false;

    await observe(
      {
        sessionRunner: {
          run: async () => ({
            content: JSON.stringify({
              observations: [{
                pattern: "Test pattern",
                evidence: "hello world",
                dimension: "sentence-rhythm",
              }],
            }),
          }),
        },
        observationStore: {
          save: async (_eid, raw) => ({
            id: "obs-1",
            entryId: "entry-1",
            pattern: raw.pattern,
            evidence: raw.evidence,
            dimension: raw.dimension,
            status: "pending" as const,
            createdAt: "2026-01-01",
            updatedAt: "2026-01-01",
          }),
          list: async () => [],
          get: async () => undefined,
          updateStatus: async () => undefined,
        },
        computeMetrics: () => stubMetrics,
        corpusSize: async () => 5,
        recentEntries: async (limit: number) => {
          recentCalled = true;
          expect(limit).toBe(5);
          return [{ id: "e1", body: "Entry." }];
        },
      },
      "entry-1",
      "hello world",
    );

    expect(recentCalled).toBe(true);
  });
});
