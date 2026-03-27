import { describe, expect, test } from "bun:test";
import type { Observation } from "@ink-mirror/shared";
import { isValidTransition } from "@ink-mirror/shared";
import { assembleCurationSession, detectContradiction } from "../src/curation.js";

function makeObs(overrides: Partial<Observation> & { id: string }): Observation {
  return {
    entryId: "entry-2026-03-27-001",
    pattern: "Some pattern",
    evidence: "Some evidence",
    dimension: "sentence-rhythm",
    status: "pending",
    createdAt: "2026-03-27T10:00:00.000Z",
    updatedAt: "2026-03-27T10:00:00.000Z",
    ...overrides,
  };
}

const entryTexts: Record<string, string> = {
  "entry-2026-03-27-001": "I stopped. I turned. I left.",
  "entry-2026-03-27-002": "The morning was long and the afternoon stretched further.",
  "entry-2026-03-27-003": "Test entry three.",
  "entry-2026-03-28-001": "Entry from the next day.",
  "entry-2026-03-28-002": "Another entry from the next day.",
  "entry-2026-03-28-003": "Third entry from the next day.",
  "entry-2026-03-28-004": "Fourth entry from the next day.",
};

const getEntryText = async (id: string) => entryTexts[id];

describe("state transitions", () => {
  test("pending -> intentional is valid", () => {
    expect(isValidTransition("pending", "intentional")).toBe(true);
  });

  test("pending -> accidental is valid", () => {
    expect(isValidTransition("pending", "accidental")).toBe(true);
  });

  test("pending -> undecided is valid", () => {
    expect(isValidTransition("pending", "undecided")).toBe(true);
  });

  test("undecided -> intentional is valid", () => {
    expect(isValidTransition("undecided", "intentional")).toBe(true);
  });

  test("undecided -> accidental is valid", () => {
    expect(isValidTransition("undecided", "accidental")).toBe(true);
  });

  test("accidental -> pending is invalid", () => {
    expect(isValidTransition("accidental", "pending")).toBe(false);
  });

  test("accidental -> intentional is invalid", () => {
    expect(isValidTransition("accidental", "intentional")).toBe(false);
  });

  test("intentional -> pending is invalid", () => {
    expect(isValidTransition("intentional", "pending")).toBe(false);
  });

  test("intentional -> accidental is invalid", () => {
    expect(isValidTransition("intentional", "accidental")).toBe(false);
  });

  test("undecided -> pending is invalid", () => {
    expect(isValidTransition("undecided", "pending")).toBe(false);
  });
});

describe("curation session assembly", () => {
  test("returns empty session when no observations", async () => {
    const session = await assembleCurationSession([], getEntryText);
    expect(session.observations).toEqual([]);
    expect(session.contradictions).toEqual([]);
  });

  test("includes all pending observations", async () => {
    const obs = [
      makeObs({ id: "obs-001", status: "pending" }),
      makeObs({ id: "obs-002", status: "pending" }),
    ];

    const session = await assembleCurationSession(obs, getEntryText);
    expect(session.observations).toHaveLength(2);
    expect(session.observations[0].id).toBe("obs-001");
    expect(session.observations[1].id).toBe("obs-002");
  });

  test("includes entry text with each observation", async () => {
    const obs = [makeObs({ id: "obs-001", status: "pending" })];
    const session = await assembleCurationSession(obs, getEntryText);
    expect(session.observations[0].entryText).toBe("I stopped. I turned. I left.");
  });

  test("pending observations come before undecided", async () => {
    const obs = [
      makeObs({ id: "obs-undecided", status: "undecided", createdAt: "2026-03-27T09:00:00.000Z" }),
      makeObs({ id: "obs-pending", status: "pending", createdAt: "2026-03-27T10:00:00.000Z" }),
    ];

    const session = await assembleCurationSession(obs, getEntryText);
    expect(session.observations[0].id).toBe("obs-pending");
    expect(session.observations[1].id).toBe("obs-undecided");
  });

  test("caps undecided observations at 3", async () => {
    const obs = [
      makeObs({ id: "obs-u1", status: "undecided", entryId: "entry-2026-03-28-001", createdAt: "2026-03-28T01:00:00.000Z" }),
      makeObs({ id: "obs-u2", status: "undecided", entryId: "entry-2026-03-28-002", createdAt: "2026-03-28T02:00:00.000Z" }),
      makeObs({ id: "obs-u3", status: "undecided", entryId: "entry-2026-03-28-003", createdAt: "2026-03-28T03:00:00.000Z" }),
      makeObs({ id: "obs-u4", status: "undecided", entryId: "entry-2026-03-28-004", createdAt: "2026-03-28T04:00:00.000Z" }),
    ];

    const session = await assembleCurationSession(obs, getEntryText);
    // Only 3 undecided, most recent first
    expect(session.observations).toHaveLength(3);
    expect(session.observations[0].id).toBe("obs-u4");
    expect(session.observations[1].id).toBe("obs-u3");
    expect(session.observations[2].id).toBe("obs-u2");
  });

  test("excludes intentional and accidental observations from session", async () => {
    const obs = [
      makeObs({ id: "obs-001", status: "pending" }),
      makeObs({ id: "obs-002", status: "intentional" }),
      makeObs({ id: "obs-003", status: "accidental" }),
    ];

    const session = await assembleCurationSession(obs, getEntryText);
    expect(session.observations).toHaveLength(1);
    expect(session.observations[0].id).toBe("obs-001");
  });

  test("combines pending and undecided correctly", async () => {
    const obs = [
      makeObs({ id: "obs-p1", status: "pending" }),
      makeObs({ id: "obs-p2", status: "pending" }),
      makeObs({ id: "obs-u1", status: "undecided", entryId: "entry-2026-03-28-001", createdAt: "2026-03-28T01:00:00.000Z" }),
      makeObs({ id: "obs-u2", status: "undecided", entryId: "entry-2026-03-28-002", createdAt: "2026-03-28T02:00:00.000Z" }),
    ];

    const session = await assembleCurationSession(obs, getEntryText);
    expect(session.observations).toHaveLength(4);
    // Pending first, then undecided most-recent-first
    expect(session.observations[0].id).toBe("obs-p1");
    expect(session.observations[1].id).toBe("obs-p2");
    expect(session.observations[2].id).toBe("obs-u2");
    expect(session.observations[3].id).toBe("obs-u1");
  });
});

describe("contradiction detection", () => {
  test("detects short vs long in same dimension", () => {
    const a = makeObs({ id: "a", pattern: "Uses short declarative sentences" });
    const b = makeObs({ id: "b", pattern: "Uses long compound sentences" });
    expect(detectContradiction(a, b)).toBe(true);
  });

  test("does not flag observations in different dimensions", () => {
    const a = makeObs({ id: "a", dimension: "sentence-rhythm", pattern: "Uses short sentences" });
    const b = makeObs({ id: "b", dimension: "word-level-habits", pattern: "Uses long words" });
    expect(detectContradiction(a, b)).toBe(false);
  });

  test("does not flag non-opposing patterns in same dimension", () => {
    const a = makeObs({ id: "a", pattern: "Varies sentence length throughout" });
    const b = makeObs({ id: "b", pattern: "Opens paragraphs with questions" });
    expect(detectContradiction(a, b)).toBe(false);
  });

  test("detects staccato vs flowing", () => {
    const a = makeObs({ id: "a", pattern: "Staccato rhythm in conclusions" });
    const b = makeObs({ id: "b", pattern: "Flowing sentence structure" });
    expect(detectContradiction(a, b)).toBe(true);
  });

  test("detects avoids vs relies-on", () => {
    const a = makeObs({ id: "a", dimension: "word-level-habits", pattern: "Avoids hedging language" });
    const b = makeObs({ id: "b", dimension: "word-level-habits", pattern: "Relies on hedging phrases frequently" });
    expect(detectContradiction(a, b)).toBe(true);
  });

  test("detects rare vs frequent", () => {
    const a = makeObs({ id: "a", dimension: "word-level-habits", pattern: "Rarely uses intensifiers" });
    const b = makeObs({ id: "b", dimension: "word-level-habits", pattern: "Frequently uses intensifiers" });
    expect(detectContradiction(a, b)).toBe(true);
  });

  test("contradiction surfaces in curation session", async () => {
    const obs = [
      makeObs({
        id: "obs-new",
        status: "pending",
        pattern: "Uses short declarative sentences",
        entryId: "entry-2026-03-27-001",
      }),
      makeObs({
        id: "obs-confirmed",
        status: "intentional",
        pattern: "Uses long compound sentences",
        entryId: "entry-2026-03-27-002",
      }),
    ];

    const session = await assembleCurationSession(obs, getEntryText);
    expect(session.contradictions).toHaveLength(1);
    expect(session.contradictions[0].newObservation.id).toBe("obs-new");
    expect(session.contradictions[0].confirmedObservation.id).toBe("obs-confirmed");
    expect(session.contradictions[0].dimension).toBe("sentence-rhythm");
  });

  test("limits to one contradiction per pending observation", async () => {
    const obs = [
      makeObs({
        id: "obs-new",
        status: "pending",
        pattern: "Uses short declarative sentences",
        entryId: "entry-2026-03-27-001",
      }),
      makeObs({
        id: "obs-conf-1",
        status: "intentional",
        pattern: "Uses long compound sentences",
        entryId: "entry-2026-03-27-002",
      }),
      makeObs({
        id: "obs-conf-2",
        status: "intentional",
        pattern: "Relies on long flowing constructions",
        entryId: "entry-2026-03-27-003",
      }),
    ];

    const session = await assembleCurationSession(obs, getEntryText);
    // Only one contradiction should surface per pending observation
    expect(session.contradictions).toHaveLength(1);
    expect(session.contradictions[0].newObservation.id).toBe("obs-new");
  });

  test("no contradictions when no confirmed observations", async () => {
    const obs = [
      makeObs({ id: "obs-1", status: "pending", pattern: "Uses short sentences" }),
      makeObs({ id: "obs-2", status: "pending", pattern: "Uses long sentences" }),
    ];

    const session = await assembleCurationSession(obs, getEntryText);
    expect(session.contradictions).toEqual([]);
  });

  test("no contradictions when patterns don't oppose", async () => {
    const obs = [
      makeObs({ id: "obs-new", status: "pending", pattern: "Varies sentence length" }),
      makeObs({ id: "obs-conf", status: "intentional", pattern: "Uses questions as openers" }),
    ];

    const session = await assembleCurationSession(obs, getEntryText);
    expect(session.contradictions).toEqual([]);
  });
});
