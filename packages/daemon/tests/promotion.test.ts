import { describe, expect, test } from "bun:test";
import type { Pattern, Sighting } from "@ink-mirror/shared";
import { DEFAULT_CONFIG } from "../src/config.js";
import { proposalFor, type EntryWordCounts } from "../src/promotion.js";

function makePattern(overrides: Partial<Pattern> & { id: string }): Pattern {
  return {
    statement: "Uses short declarative sentences for emphasis.",
    dimension: "sentence-rhythm",
    status: "intentional",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    sightingCount: 0,
    entryIds: [],
    ...overrides,
  };
}

function makeSighting(overrides: Partial<Sighting> & { id: string }): Sighting {
  return {
    patternId: "pat-1",
    entryId: "entry-1",
    evidence: "some evidence",
    dimension: "sentence-rhythm",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** N sightings, one per distinct entry `e1..eN`, each dated sequentially. */
function sightingsAcrossEntries(patternId: string, entryCount: number): Sighting[] {
  return Array.from({ length: entryCount }, (_, i) =>
    makeSighting({
      id: `sight-${i + 1}`,
      patternId,
      entryId: `e${i + 1}`,
      createdAt: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
    }),
  );
}

function wordCountsFor(entryIds: string[], wordsPerEntry: number): EntryWordCounts {
  const counts: EntryWordCounts = {};
  for (const id of entryIds) counts[id] = wordsPerEntry;
  return counts;
}

describe("proposalFor: classification gate", () => {
  // Sightings/entries/words all comfortably satisfy the other three gates,
  // so only the classification status varies.
  const sightings = sightingsAcrossEntries("pat-1", 3);
  const words = wordCountsFor(["e1", "e2", "e3"], 700); // 2100 total, >= 2000

  test("suppressed just below the gate: candidate is not intentional", () => {
    const pattern = makePattern({ id: "pat-1", status: "candidate" });
    expect(proposalFor(pattern, sightings, words, DEFAULT_CONFIG)).toBeUndefined();
  });

  test("suppressed: undecided is not intentional", () => {
    const pattern = makePattern({ id: "pat-1", status: "undecided" });
    expect(proposalFor(pattern, sightings, words, DEFAULT_CONFIG)).toBeUndefined();
  });

  test("emitted at the gate: intentional with sufficient evidence proposes", () => {
    const pattern = makePattern({ id: "pat-1", status: "intentional" });
    const proposal = proposalFor(pattern, sightings, words, DEFAULT_CONFIG);
    expect(proposal).toBeDefined();
    expect(proposal?.patternId).toBe("pat-1");
  });
});

describe("proposalFor: sighting-count gate", () => {
  // Isolate the sighting-count gate: distinct-entry and word-count
  // thresholds are relaxed to 1/0 so they can never be the reason for
  // suppression here. sightingCount == distinctEntryCount in this fixture
  // (one sighting per entry), which is fine since we're only asserting on
  // the sighting-threshold boundary.
  const config = { ...DEFAULT_CONFIG, distinctEntryThreshold: 1, wordCountThreshold: 0 };

  test("suppressed just below the gate: 2 sightings (threshold is 3)", () => {
    const pattern = makePattern({ id: "pat-1" });
    const sightings = sightingsAcrossEntries("pat-1", DEFAULT_CONFIG.sightingThreshold - 1);
    const words = wordCountsFor(["e1", "e2"], 0);
    expect(proposalFor(pattern, sightings, words, config)).toBeUndefined();
  });

  test("emitted at the gate: 3 sightings", () => {
    const pattern = makePattern({ id: "pat-1" });
    const sightings = sightingsAcrossEntries("pat-1", DEFAULT_CONFIG.sightingThreshold);
    const words = wordCountsFor(["e1", "e2", "e3"], 0);
    const proposal = proposalFor(pattern, sightings, words, config);
    expect(proposal).toBeDefined();
    expect(proposal?.sightingCount).toBe(DEFAULT_CONFIG.sightingThreshold);
  });
});

describe("proposalFor: distinct-entry-count gate", () => {
  // Isolate the distinct-entry gate: sighting and word-count thresholds are
  // relaxed to 1/0. Multiple sightings land in the same one or two entries
  // so sightingCount stays comfortably above its own (relaxed) threshold
  // while distinctEntryCount is what's under test.
  const config = { ...DEFAULT_CONFIG, sightingThreshold: 1, wordCountThreshold: 0 };

  test("suppressed just below the gate: 2 distinct entries (threshold is 3)", () => {
    const pattern = makePattern({ id: "pat-1" });
    const entryCount = DEFAULT_CONFIG.distinctEntryThreshold - 1;
    const sightings = sightingsAcrossEntries("pat-1", entryCount);
    const words = wordCountsFor(
      Array.from({ length: entryCount }, (_, i) => `e${i + 1}`),
      0,
    );
    expect(proposalFor(pattern, sightings, words, config)).toBeUndefined();
  });

  test("emitted at the gate: 3 distinct entries", () => {
    const pattern = makePattern({ id: "pat-1" });
    const entryCount = DEFAULT_CONFIG.distinctEntryThreshold;
    const sightings = sightingsAcrossEntries("pat-1", entryCount);
    const words = wordCountsFor(
      Array.from({ length: entryCount }, (_, i) => `e${i + 1}`),
      0,
    );
    const proposal = proposalFor(pattern, sightings, words, config);
    expect(proposal).toBeDefined();
    expect(proposal?.distinctEntryCount).toBe(DEFAULT_CONFIG.distinctEntryThreshold);
  });
});

describe("proposalFor: word-count gate", () => {
  // Isolate the word-count gate: sighting and distinct-entry thresholds are
  // relaxed to 1 so only the total-word-count boundary is under test.
  const config = { ...DEFAULT_CONFIG, sightingThreshold: 1, distinctEntryThreshold: 1 };
  const sightings = sightingsAcrossEntries("pat-1", 2);

  test("suppressed just below the gate: 1999 total words (threshold is 2000)", () => {
    const pattern = makePattern({ id: "pat-1" });
    const words: EntryWordCounts = { e1: 1000, e2: 999 }; // 1999 total
    expect(proposalFor(pattern, sightings, words, config)).toBeUndefined();
  });

  test("emitted at the gate: 2000 total words", () => {
    const pattern = makePattern({ id: "pat-1" });
    const words = wordCountsFor(["e1", "e2"], 1000); // 2000 total
    const proposal = proposalFor(pattern, sightings, words, config);
    expect(proposal).toBeDefined();
    expect(proposal?.totalWordCount).toBe(2000);
  });
});

describe("proposalFor: decline suppression", () => {
  const sightings = sightingsAcrossEntries("pat-1", 3);
  const words = wordCountsFor(["e1", "e2", "e3"], 700);

  test("a declined proposal does not resurface when no newer sighting exists", () => {
    const pattern = makePattern({
      id: "pat-1",
      proposalDeclinedAt: "2026-02-01T00:00:00.000Z",
      lastSightingAt: sightings[sightings.length - 1].createdAt,
    });
    expect(proposalFor(pattern, sightings, words, DEFAULT_CONFIG)).toBeUndefined();
  });

  test("a sighting recorded after the decline makes the pattern eligible again", () => {
    const pattern = makePattern({
      id: "pat-1",
      proposalDeclinedAt: "2026-01-02T12:00:00.000Z",
    });
    const sightingsWithNewOne = [
      ...sightings,
      makeSighting({ id: "sight-new", patternId: "pat-1", entryId: "e4", createdAt: "2026-01-05T00:00:00.000Z" }),
    ];
    const wordsWithNewEntry = { ...words, e4: 700 };

    const proposal = proposalFor(pattern, sightingsWithNewOne, wordsWithNewEntry, DEFAULT_CONFIG);
    expect(proposal).toBeDefined();
  });

  test("a sighting older than the decline date does not clear suppression", () => {
    const pattern = makePattern({
      id: "pat-1",
      proposalDeclinedAt: "2026-06-01T00:00:00.000Z",
    });
    // All sightings predate the decline.
    expect(proposalFor(pattern, sightings, words, DEFAULT_CONFIG)).toBeUndefined();
  });
});

describe("proposalFor: sightings for other patterns are ignored", () => {
  test("filters the sightings array down to this pattern's own sightings", () => {
    const pattern = makePattern({ id: "pat-1" });
    const sightings = [
      ...sightingsAcrossEntries("pat-1", 3),
      ...sightingsAcrossEntries("pat-other", 5),
    ];
    const words = wordCountsFor(["e1", "e2", "e3"], 700);
    const proposal = proposalFor(pattern, sightings, words, DEFAULT_CONFIG);
    expect(proposal?.sightingCount).toBe(3);
  });
});
