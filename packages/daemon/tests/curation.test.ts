import { describe, expect, test } from "bun:test";
import type { Pattern, Observation, MetricSnapshot, LinkableMetricKey, ProfileRule } from "@ink-mirror/shared";
import { LINKABLE_METRIC_REGISTRY } from "@ink-mirror/shared";
import { computeEntryMetrics } from "../src/metrics/index.js";
import {
  assembleCurationSession,
  detectContradiction,
  sightingsForPattern,
  toSighting,
} from "../src/curation.js";

// --- Fixture builders ---

function makePattern(overrides: Partial<Pattern> & { id: string }): Pattern {
  return {
    statement: "Some pattern statement",
    dimension: "sentence-rhythm",
    status: "candidate",
    createdAt: "2026-03-27T10:00:00.000Z",
    updatedAt: "2026-03-27T10:00:00.000Z",
    sightingCount: 0,
    entryIds: [],
    ...overrides,
  };
}

function makeObservation(overrides: Partial<Observation> & { id: string; patternId: string }): Observation {
  return {
    entryId: "entry-2026-03-27-001",
    pattern: "Some pattern",
    evidence: ["Some evidence"],
    dimension: "sentence-rhythm",
    validationStatus: "verified",
    validationWarnings: [],
    validationDiagnostics: [],
    createdAt: "2026-03-27T10:00:00.000Z",
    updatedAt: "2026-03-27T10:00:00.000Z",
    ...overrides,
  };
}

function setByPath(obj: Record<string, unknown>, path: string, value: number): void {
  const parts = path.split(".");
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    current = current[parts[i]] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

function makeSnapshot(
  entryId: string,
  date: string,
  metricKey: LinkableMetricKey,
  value: number,
): MetricSnapshot {
  const metrics = computeEntryMetrics("Filler entry text used only as a metrics carrier.");
  setByPath(metrics as unknown as Record<string, unknown>, LINKABLE_METRIC_REGISTRY[metricKey], value);
  return { entryId, date, metrics, schemaVersion: 1 };
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

// --- detectContradiction (pattern grain, REQ-LPC-13) ---

describe("detectContradiction", () => {
  test("detects short vs long in same dimension", () => {
    const a = makePattern({ id: "a", statement: "Uses short declarative sentences" });
    const b = makePattern({ id: "b", statement: "Uses long compound sentences" });
    expect(detectContradiction(a, b)).toBe(true);
  });

  test("does not flag patterns in different dimensions", () => {
    const a = makePattern({ id: "a", dimension: "sentence-rhythm", statement: "Uses short sentences" });
    const b = makePattern({ id: "b", dimension: "word-level-habits", statement: "Uses long words" });
    expect(detectContradiction(a, b)).toBe(false);
  });

  test("does not flag non-opposing patterns in same dimension", () => {
    const a = makePattern({ id: "a", statement: "Varies sentence length throughout" });
    const b = makePattern({ id: "b", statement: "Opens paragraphs with questions" });
    expect(detectContradiction(a, b)).toBe(false);
  });

  test("detects staccato vs flowing", () => {
    const a = makePattern({ id: "a", statement: "Staccato rhythm in conclusions" });
    const b = makePattern({ id: "b", statement: "Flowing sentence structure" });
    expect(detectContradiction(a, b)).toBe(true);
  });

  test("detects avoids vs relies-on", () => {
    const a = makePattern({ id: "a", dimension: "word-level-habits", statement: "Avoids hedging language" });
    const b = makePattern({ id: "b", dimension: "word-level-habits", statement: "Relies on hedging phrases frequently" });
    expect(detectContradiction(a, b)).toBe(true);
  });
});

// --- sightingsForPattern / toSighting ---

describe("sightingsForPattern", () => {
  test("filters observations to the given pattern and maps to Sighting shape", () => {
    const obs = [
      makeObservation({ id: "obs-1", patternId: "pat-1", entryId: "entry-2026-03-27-001", createdAt: "2026-03-27T09:00:00.000Z" }),
      makeObservation({ id: "obs-2", patternId: "pat-2", entryId: "entry-2026-03-27-002" }),
    ];

    const sightings = sightingsForPattern("pat-1", obs);
    expect(sightings).toHaveLength(1);
    expect(sightings[0]).toEqual(toSighting(obs[0]));
  });

  test("sorts sightings oldest-first", () => {
    const obs = [
      makeObservation({ id: "obs-newer", patternId: "pat-1", createdAt: "2026-03-28T00:00:00.000Z" }),
      makeObservation({ id: "obs-older", patternId: "pat-1", createdAt: "2026-03-27T00:00:00.000Z" }),
    ];

    const sightings = sightingsForPattern("pat-1", obs);
    expect(sightings[0].id).toBe("obs-older");
    expect(sightings[1].id).toBe("obs-newer");
  });

  test("returns empty array when the pattern has no sightings", () => {
    expect(sightingsForPattern("pat-none", [])).toEqual([]);
  });
});

// --- assembleCurationSession: session composition ---

describe("assembleCurationSession session composition", () => {
  test("returns empty session when there are no patterns", async () => {
    const session = await assembleCurationSession([], [], [], getEntryText);
    expect(session.dossiers).toEqual([]);
    expect(session.contradictions).toEqual([]);
    expect(session.watchList).toEqual([]);
    expect(session.resurfacedRules).toEqual([]);
  });

  test("includes candidate patterns oldest-first", async () => {
    const patterns = [
      makePattern({ id: "pat-newer", status: "candidate", createdAt: "2026-03-28T10:00:00.000Z" }),
      makePattern({ id: "pat-older", status: "candidate", createdAt: "2026-03-27T08:00:00.000Z" }),
      makePattern({ id: "pat-middle", status: "candidate", createdAt: "2026-03-27T14:00:00.000Z" }),
    ];

    const session = await assembleCurationSession(patterns, [], [], getEntryText);
    expect(session.dossiers.map((d) => d.pattern.id)).toEqual(["pat-older", "pat-middle", "pat-newer"]);
  });

  test("caps undecided dossiers at 3, most-recently-updated first", async () => {
    const patterns = [
      makePattern({ id: "pat-u1", status: "undecided", updatedAt: "2026-03-28T01:00:00.000Z" }),
      makePattern({ id: "pat-u2", status: "undecided", updatedAt: "2026-03-28T02:00:00.000Z" }),
      makePattern({ id: "pat-u3", status: "undecided", updatedAt: "2026-03-28T03:00:00.000Z" }),
      makePattern({ id: "pat-u4", status: "undecided", updatedAt: "2026-03-28T04:00:00.000Z" }),
    ];

    const session = await assembleCurationSession(patterns, [], [], getEntryText);
    expect(session.dossiers).toHaveLength(3);
    expect(session.dossiers.map((d) => d.pattern.id)).toEqual(["pat-u4", "pat-u3", "pat-u2"]);
  });

  test("candidates come before undecided in the dossier list", async () => {
    const patterns = [
      makePattern({ id: "pat-undecided", status: "undecided", updatedAt: "2026-03-27T09:00:00.000Z" }),
      makePattern({ id: "pat-candidate", status: "candidate", createdAt: "2026-03-27T10:00:00.000Z" }),
    ];

    const session = await assembleCurationSession(patterns, [], [], getEntryText);
    expect(session.dossiers.map((d) => d.pattern.id)).toEqual(["pat-candidate", "pat-undecided"]);
  });

  test("excludes intentional, accidental, and retired patterns from the dossier list", async () => {
    const patterns = [
      makePattern({ id: "pat-candidate", status: "candidate" }),
      makePattern({ id: "pat-intentional", status: "intentional" }),
      makePattern({ id: "pat-accidental", status: "accidental" }),
      makePattern({ id: "pat-retired", status: "retired" }),
    ];

    const session = await assembleCurationSession(patterns, [], [], getEntryText);
    expect(session.dossiers.map((d) => d.pattern.id)).toEqual(["pat-candidate"]);
  });
});

// --- assembleCurationSession: dossier content ---

describe("dossier assembly", () => {
  test("includes sightings with entry context", async () => {
    const patterns = [makePattern({ id: "pat-1", status: "candidate" })];
    const obs = [
      makeObservation({ id: "obs-1", patternId: "pat-1", entryId: "entry-2026-03-27-001" }),
    ];

    const session = await assembleCurationSession(patterns, obs, [], getEntryText);
    const dossier = session.dossiers[0];
    expect(dossier.sightings).toHaveLength(1);
    expect(dossier.sightings[0].entryText).toBe("I stopped. I turned. I left.");
    expect(dossier.distinctEntryCount).toBe(1);
  });

  test("shows placeholder when a sighting's source entry is missing", async () => {
    const patterns = [makePattern({ id: "pat-1", status: "candidate" })];
    const obs = [
      makeObservation({ id: "obs-1", patternId: "pat-1", entryId: "nonexistent-entry" }),
    ];

    const missingLookup = async () => undefined;
    const session = await assembleCurationSession(patterns, obs, [], missingLookup);
    expect(session.dossiers[0].sightings[0].entryText).toBe("[source entry not found]");
  });

  test("distinctEntryCount counts unique entries, not sighting count", async () => {
    const patterns = [makePattern({ id: "pat-1", status: "candidate" })];
    const obs = [
      makeObservation({ id: "obs-1", patternId: "pat-1", entryId: "entry-2026-03-27-001" }),
      makeObservation({ id: "obs-2", patternId: "pat-1", entryId: "entry-2026-03-27-001" }),
      makeObservation({ id: "obs-3", patternId: "pat-1", entryId: "entry-2026-03-27-002" }),
    ];

    const session = await assembleCurationSession(patterns, obs, [], getEntryText);
    expect(session.dossiers[0].sightings).toHaveLength(3);
    expect(session.dossiers[0].distinctEntryCount).toBe(2);
  });

  test("includes a substrate trend for a computable pattern", async () => {
    const patterns = [
      makePattern({ id: "pat-1", status: "candidate", metricLink: "commaRatePer1000" }),
    ];
    const snapshots = [
      makeSnapshot("e1", "2026-01-01", "commaRatePer1000", 10),
      makeSnapshot("e2", "2026-01-02", "commaRatePer1000", 20),
    ];

    const session = await assembleCurationSession(patterns, [], snapshots, getEntryText);
    expect(session.dossiers[0].trend).toBeDefined();
    expect(session.dossiers[0].trend?.metricLink).toBe("commaRatePer1000");
  });

  test("omits the substrate trend for a qualitative pattern", async () => {
    const patterns = [makePattern({ id: "pat-1", status: "candidate" })];
    const snapshots = [makeSnapshot("e1", "2026-01-01", "commaRatePer1000", 10)];

    const session = await assembleCurationSession(patterns, [], snapshots, getEntryText);
    expect(session.dossiers[0].trend).toBeUndefined();
  });

  test("dossiers assembled here are never proposals", async () => {
    const patterns = [makePattern({ id: "pat-1", status: "candidate" })];
    const session = await assembleCurationSession(patterns, [], [], getEntryText);
    expect(session.dossiers[0].isProposal).toBe(false);
  });

  test("resurfacedRules is empty when no profile rules are supplied", async () => {
    const patterns = [makePattern({ id: "pat-1", status: "candidate" })];
    const session = await assembleCurationSession(patterns, [], [], getEntryText);
    expect(session.resurfacedRules).toEqual([]);
  });
});

// --- assembleCurationSession: watch-status block ---

describe("watch-status block", () => {
  test("builds a watchList dossier for a pattern on the accidental watch list", async () => {
    const patterns = [
      makePattern({
        id: "pat-watched",
        status: "accidental",
        watch: { classifiedAt: "2026-03-27T00:00:00.000Z", resolved: false },
      }),
    ];

    const session = await assembleCurationSession(patterns, [], [], getEntryText);
    expect(session.watchList).toHaveLength(1);
    expect(session.watchList[0].pattern.id).toBe("pat-watched");
    expect(session.watchList[0].watchStatus).toBeDefined();
    expect(session.watchList[0].watchStatus?.resolved).toBe(false);
  });

  test("watchList recurrence text reports sightings against entries since classification", async () => {
    const classifiedAt = "2026-01-03T00:00:00.000Z";
    const patterns = [
      makePattern({ id: "pat-watched", status: "accidental", watch: { classifiedAt, resolved: false } }),
    ];
    // 5 entries total, 3 on/after the classification date. Snapshot dates
    // use full ISO timestamps (as production's snapshot-store.ts does via
    // now().toISOString()) so string comparison against classifiedAt's ISO
    // timestamp lines up correctly — a bare "YYYY-MM-DD" would compare as
    // lexicographically *less than* a same-day ISO timestamp.
    const snapshots = [
      makeSnapshot("e1", "2026-01-01T09:00:00.000Z", "commaRatePer1000", 1),
      makeSnapshot("e2", "2026-01-02T09:00:00.000Z", "commaRatePer1000", 1),
      makeSnapshot("e3", "2026-01-03T09:00:00.000Z", "commaRatePer1000", 1),
      makeSnapshot("e4", "2026-01-04T09:00:00.000Z", "commaRatePer1000", 1),
      makeSnapshot("e5", "2026-01-05T09:00:00.000Z", "commaRatePer1000", 1),
    ];
    // Sighted again in 2 of those 3 post-classification entries
    const obs = [
      makeObservation({ id: "obs-1", patternId: "pat-watched", entryId: "e3", createdAt: "2026-01-03T12:00:00.000Z" }),
      makeObservation({ id: "obs-2", patternId: "pat-watched", entryId: "e4", createdAt: "2026-01-04T12:00:00.000Z" }),
    ];

    const session = await assembleCurationSession(patterns, obs, snapshots, getEntryText);
    expect(session.watchList[0].watchStatus?.recurrenceText).toBe(
      "Seen in 2 of 3 entries since you marked this accidental.",
    );
  });

  test("a pattern with no watch metadata is absent from watchList", async () => {
    const patterns = [makePattern({ id: "pat-plain", status: "candidate" })];
    const session = await assembleCurationSession(patterns, [], [], getEntryText);
    expect(session.watchList).toEqual([]);
  });

  test("a resolved watch still reports its resolution state", async () => {
    const patterns = [
      makePattern({
        id: "pat-resolved",
        status: "accidental",
        watch: { classifiedAt: "2026-03-27T00:00:00.000Z", resolved: true, resolvedAt: "2026-04-01T00:00:00.000Z" },
      }),
    ];

    const session = await assembleCurationSession(patterns, [], [], getEntryText);
    expect(session.watchList[0].watchStatus?.resolved).toBe(true);
    expect(session.watchList[0].watchStatus?.resolvedAt).toBe("2026-04-01T00:00:00.000Z");
  });
});

// --- contradiction detection within the assembled session ---

describe("contradiction detection in session", () => {
  test("flags a candidate pattern against an opposing intentional pattern in the same dimension", async () => {
    const patterns = [
      makePattern({ id: "pat-new", status: "candidate", statement: "Uses short declarative sentences" }),
      makePattern({ id: "pat-confirmed", status: "intentional", statement: "Uses long compound sentences" }),
    ];

    const session = await assembleCurationSession(patterns, [], [], getEntryText);
    expect(session.contradictions).toHaveLength(1);
    expect(session.contradictions[0].pattern.id).toBe("pat-new");
    expect(session.contradictions[0].contradicts.id).toBe("pat-confirmed");
    expect(session.contradictions[0].dimension).toBe("sentence-rhythm");
  });

  test("flags an undecided pattern against an opposing intentional pattern", async () => {
    const patterns = [
      makePattern({ id: "pat-undecided", status: "undecided", statement: "Staccato rhythm in conclusions" }),
      makePattern({ id: "pat-confirmed", status: "intentional", statement: "Flowing sentence structure" }),
    ];

    const session = await assembleCurationSession(patterns, [], [], getEntryText);
    expect(session.contradictions).toHaveLength(1);
    expect(session.contradictions[0].pattern.id).toBe("pat-undecided");
  });

  test("does not flag opposing statements in different dimensions", async () => {
    const patterns = [
      makePattern({ id: "pat-new", status: "candidate", dimension: "paragraph-structure", statement: "Uses short paragraphs throughout" }),
      makePattern({ id: "pat-confirmed", status: "intentional", dimension: "sentence-rhythm", statement: "Uses long sentences throughout" }),
    ];

    const session = await assembleCurationSession(patterns, [], [], getEntryText);
    expect(session.contradictions).toEqual([]);
  });

  test("does not flag non-opposing patterns", async () => {
    const patterns = [
      makePattern({ id: "pat-new", status: "candidate", statement: "Varies sentence length" }),
      makePattern({ id: "pat-confirmed", status: "intentional", statement: "Uses questions as openers" }),
    ];

    const session = await assembleCurationSession(patterns, [], [], getEntryText);
    expect(session.contradictions).toEqual([]);
  });

  test("limits to one contradiction per unclassified pattern", async () => {
    const patterns = [
      makePattern({ id: "pat-new", status: "candidate", statement: "Uses short declarative sentences" }),
      makePattern({ id: "pat-conf-1", status: "intentional", statement: "Uses long compound sentences" }),
      makePattern({ id: "pat-conf-2", status: "intentional", statement: "Relies on long flowing constructions" }),
    ];

    const session = await assembleCurationSession(patterns, [], [], getEntryText);
    expect(session.contradictions).toHaveLength(1);
    expect(session.contradictions[0].pattern.id).toBe("pat-new");
  });

  test("no contradictions when there are no intentional patterns", async () => {
    const patterns = [
      makePattern({ id: "pat-1", status: "candidate", statement: "Uses short sentences" }),
      makePattern({ id: "pat-2", status: "candidate", statement: "Uses long sentences" }),
    ];

    const session = await assembleCurationSession(patterns, [], [], getEntryText);
    expect(session.contradictions).toEqual([]);
  });
});

// --- rule health: resurfacedRules (REQ-LPC-19/20/21) ---

describe("rule health: resurfacedRules", () => {
  function makeRule(overrides: Partial<ProfileRule> & { id: string }): ProfileRule {
    return {
      pattern: "Uses staccato rhythm",
      dimension: "sentence-rhythm",
      sourceCount: 3,
      sourceSummary: "Confirmed across 3 entries",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      ...overrides,
    };
  }

  const METRIC: LinkableMetricKey = "commaRatePer1000";

  /** 5 same-valued snapshots so rollingMean(window=5) is exactly `value`, isolating the drift math from averaging. */
  function driftSnapshots(value: number): MetricSnapshot[] {
    return [
      makeSnapshot("entry-1", "2026-01-01", METRIC, value),
      makeSnapshot("entry-2", "2026-01-02", METRIC, value),
      makeSnapshot("entry-3", "2026-01-03", METRIC, value),
      makeSnapshot("entry-4", "2026-01-04", METRIC, value),
      makeSnapshot("entry-5", "2026-01-05", METRIC, value),
    ];
  }

  test("a rule with no patternId is never resurfaced", async () => {
    const pattern = makePattern({ id: "pat-1", status: "intentional" });
    const rule = makeRule({ id: "rule-1" }); // no patternId
    const session = await assembleCurationSession(
      [pattern], [], [], getEntryText, [rule], { stalenessWindow: 1, driftMargin: 0.1 },
    );
    expect(session.resurfacedRules).toEqual([]);
  });

  test("a rule whose linked pattern has been retired is skipped defensively", async () => {
    // Retiring a rule normally deletes it from the profile too (REQ-LPC-22),
    // so this state shouldn't occur in practice; computeResurfacedRules
    // still guards against it rather than resurfacing orphaned state.
    const pattern = makePattern({ id: "pat-1", status: "retired", entryIds: [] });
    const rule = makeRule({ id: "rule-1", patternId: "pat-1" });
    const session = await assembleCurationSession(
      [pattern], [], [], getEntryText, [rule], { stalenessWindow: 1, driftMargin: 0.1 },
    );
    expect(session.resurfacedRules).toEqual([]);
  });

  // --- staleness boundary (REQ-LPC-20): exactly at the window edge vs. one entry past ---

  test("staleness boundary: a sighting exactly at the window edge is NOT yet stale", async () => {
    const snapshots = [
      makeSnapshot("entry-1", "2026-01-01", METRIC, 1),
      makeSnapshot("entry-2", "2026-01-02", METRIC, 1),
      makeSnapshot("entry-3", "2026-01-03", METRIC, 1),
      makeSnapshot("entry-4", "2026-01-04", METRIC, 1),
      makeSnapshot("entry-5", "2026-01-05", METRIC, 1),
    ];
    // Sighted only in entry-1, the oldest entry still inside a 5-entry window.
    const pattern = makePattern({ id: "pat-1", status: "intentional", entryIds: ["entry-1"], sightingCount: 1 });
    const rule = makeRule({ id: "rule-1", patternId: "pat-1" });

    const session = await assembleCurationSession(
      [pattern], [], snapshots, getEntryText, [rule], { stalenessWindow: 5, driftMargin: 0.5 },
    );
    expect(session.resurfacedRules).toEqual([]);
  });

  test("staleness boundary: a sighting one entry past the window IS stale", async () => {
    const snapshots = [
      makeSnapshot("entry-0", "2025-12-31", METRIC, 1),
      makeSnapshot("entry-1", "2026-01-01", METRIC, 1),
      makeSnapshot("entry-2", "2026-01-02", METRIC, 1),
      makeSnapshot("entry-3", "2026-01-03", METRIC, 1),
      makeSnapshot("entry-4", "2026-01-04", METRIC, 1),
      makeSnapshot("entry-5", "2026-01-05", METRIC, 1),
    ];
    // Sighted only in entry-0, now the 6th-most-recent entry — one past a
    // 5-entry window.
    const pattern = makePattern({ id: "pat-1", status: "intentional", entryIds: ["entry-0"], sightingCount: 1 });
    const rule = makeRule({ id: "rule-1", patternId: "pat-1" });

    const session = await assembleCurationSession(
      [pattern], [], snapshots, getEntryText, [rule], { stalenessWindow: 5, driftMargin: 0.5 },
    );
    expect(session.resurfacedRules).toHaveLength(1);
    expect(session.resurfacedRules[0].reasons).toEqual(["stale"]);
    expect(session.resurfacedRules[0].staleness).toEqual({ windowSize: 5 });
    expect(session.resurfacedRules[0].drift).toBeUndefined();
  });

  // --- migration grace period (REQ-LPC-27): staleness clock starts at migration ---

  test("a migrated pattern with no sighting history is NOT stale within the grace period", async () => {
    const snapshots = [
      makeSnapshot("entry-1", "2026-01-01", METRIC, 1),
      makeSnapshot("entry-2", "2026-01-02", METRIC, 1),
      makeSnapshot("entry-3", "2026-01-03", METRIC, 1),
    ];
    // migratedNoHistory pattern: zero entryIds, created at the corpus start.
    // Only 3 entries have elapsed since creation, short of a 5-entry window.
    const pattern = makePattern({
      id: "pat-1",
      status: "intentional",
      entryIds: [],
      sightingCount: 0,
      migratedNoHistory: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const rule = makeRule({ id: "rule-1", patternId: "pat-1" });

    const session = await assembleCurationSession(
      [pattern], [], snapshots, getEntryText, [rule], { stalenessWindow: 5, driftMargin: 0.5 },
    );
    expect(session.resurfacedRules).toEqual([]);
  });

  test("a migrated pattern with no sighting history IS stale once the grace period elapses", async () => {
    const snapshots = [
      makeSnapshot("entry-1", "2026-01-01", METRIC, 1),
      makeSnapshot("entry-2", "2026-01-02", METRIC, 1),
      makeSnapshot("entry-3", "2026-01-03", METRIC, 1),
      makeSnapshot("entry-4", "2026-01-04", METRIC, 1),
      makeSnapshot("entry-5", "2026-01-05", METRIC, 1),
    ];
    // Same pattern, but now 5 entries have elapsed since creation — the
    // grace period (window 5) has fully expired with still no sighting.
    const pattern = makePattern({
      id: "pat-1",
      status: "intentional",
      entryIds: [],
      sightingCount: 0,
      migratedNoHistory: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const rule = makeRule({ id: "rule-1", patternId: "pat-1" });

    const session = await assembleCurationSession(
      [pattern], [], snapshots, getEntryText, [rule], { stalenessWindow: 5, driftMargin: 0.5 },
    );
    expect(session.resurfacedRules).toHaveLength(1);
    expect(session.resurfacedRules[0].reasons).toEqual(["stale"]);
  });

  test("a non-migrated pattern with at least one entryId is unaffected by the grace period", async () => {
    // Guards against the grace-period fix accidentally widening beyond the
    // zero-entryIds case: a pattern with real (if old) sighting history
    // should behave exactly as the pre-existing staleness boundary tests
    // above, regardless of how recently it was created.
    const snapshots = [
      makeSnapshot("entry-0", "2025-12-31", METRIC, 1),
      makeSnapshot("entry-1", "2026-01-01", METRIC, 1),
      makeSnapshot("entry-2", "2026-01-02", METRIC, 1),
      makeSnapshot("entry-3", "2026-01-03", METRIC, 1),
      makeSnapshot("entry-4", "2026-01-04", METRIC, 1),
      makeSnapshot("entry-5", "2026-01-05", METRIC, 1),
    ];
    const pattern = makePattern({
      id: "pat-1",
      status: "intentional",
      entryIds: ["entry-0"],
      sightingCount: 1,
      createdAt: "2026-01-05T23:59:59.000Z", // created "after" every snapshot
    });
    const rule = makeRule({ id: "rule-1", patternId: "pat-1" });

    const session = await assembleCurationSession(
      [pattern], [], snapshots, getEntryText, [rule], { stalenessWindow: 5, driftMargin: 0.5 },
    );
    expect(session.resurfacedRules).toHaveLength(1);
    expect(session.resurfacedRules[0].reasons).toEqual(["stale"]);
  });

  // --- reaffirm grace period (REQ-LPC-19/20): reaffirm must actually clear
  // a staleness resurfacing, not just stamp a write-only timestamp. Phase 7
  // audit finding: this scenario ("reaffirm, then re-check the session")
  // was previously untested, which is why the bug shipped. ---

  test("reaffirming a stale rule suppresses resurfacing on the very next session, same entries that made it stale", async () => {
    // Same corpus/pattern shape as "staleness boundary: one entry past the
    // window IS stale" above (a sighting only in entry-0, now 6th-most-recent
    // in a 5-entry window) — without a reaffirm this would resurface.
    const snapshots = [
      makeSnapshot("entry-0", "2025-12-31", METRIC, 1),
      makeSnapshot("entry-1", "2026-01-01", METRIC, 1),
      makeSnapshot("entry-2", "2026-01-02", METRIC, 1),
      makeSnapshot("entry-3", "2026-01-03", METRIC, 1),
      makeSnapshot("entry-4", "2026-01-04", METRIC, 1),
      makeSnapshot("entry-5", "2026-01-05", METRIC, 1),
    ];
    const pattern = makePattern({
      id: "pat-1",
      status: "intentional",
      entryIds: ["entry-0"],
      sightingCount: 1,
      lastSightingAt: "2025-12-31T00:00:00.000Z",
    });
    // The writer reaffirmed today, after every entry in the corpus above.
    const rule = makeRule({ id: "rule-1", patternId: "pat-1", lastSupportedAt: "2026-01-06T00:00:00.000Z" });

    const session = await assembleCurationSession(
      [pattern], [], snapshots, getEntryText, [rule], { stalenessWindow: 5, driftMargin: 0.5 },
    );
    expect(session.resurfacedRules).toEqual([]);
  });

  test("a reaffirmed rule resurfaces again once the grace period elapses without a fresh sighting", async () => {
    const reaffirmedAt = "2026-01-06T00:00:00.000Z";
    const snapshots = [
      makeSnapshot("entry-0", "2025-12-31", METRIC, 1),
      makeSnapshot("entry-1", "2026-01-01", METRIC, 1),
      makeSnapshot("entry-2", "2026-01-02", METRIC, 1),
      makeSnapshot("entry-3", "2026-01-03", METRIC, 1),
      makeSnapshot("entry-4", "2026-01-04", METRIC, 1),
      makeSnapshot("entry-5", "2026-01-05", METRIC, 1),
      // 5 new entries land on/after the reaffirm date, still with no fresh
      // sighting of the pattern — the grace period (window 5) has now fully
      // elapsed since lastSupportedAt.
      makeSnapshot("entry-6", "2026-01-06", METRIC, 1),
      makeSnapshot("entry-7", "2026-01-07", METRIC, 1),
      makeSnapshot("entry-8", "2026-01-08", METRIC, 1),
      makeSnapshot("entry-9", "2026-01-09", METRIC, 1),
      makeSnapshot("entry-10", "2026-01-10", METRIC, 1),
    ];
    const pattern = makePattern({
      id: "pat-1",
      status: "intentional",
      entryIds: ["entry-0"],
      sightingCount: 1,
      lastSightingAt: "2025-12-31T00:00:00.000Z",
    });
    const rule = makeRule({ id: "rule-1", patternId: "pat-1", lastSupportedAt: reaffirmedAt });

    const session = await assembleCurationSession(
      [pattern], [], snapshots, getEntryText, [rule], { stalenessWindow: 5, driftMargin: 0.5 },
    );
    expect(session.resurfacedRules).toHaveLength(1);
    expect(session.resurfacedRules[0].reasons).toEqual(["stale"]);
  });

  test("a reaffirm older than the pattern's own last sighting does not override the sighting-based staleness check", async () => {
    // If a fresh sighting landed after the reaffirm, that sighting is the
    // authority on freshness (isStale's own entryIds check), not the older
    // reaffirm timestamp. Here the sighting is recent enough that the rule
    // isn't stale at all — proving the reaffirm grace period isn't required
    // (and doesn't wrongly suppress) once real evidence supersedes it.
    const snapshots = [
      makeSnapshot("entry-1", "2026-01-01", METRIC, 1),
      makeSnapshot("entry-2", "2026-01-02", METRIC, 1),
      makeSnapshot("entry-3", "2026-01-03", METRIC, 1),
      makeSnapshot("entry-4", "2026-01-04", METRIC, 1),
      makeSnapshot("entry-5", "2026-01-05", METRIC, 1),
    ];
    const pattern = makePattern({
      id: "pat-1",
      status: "intentional",
      entryIds: ["entry-5"],
      sightingCount: 1,
      lastSightingAt: "2026-01-05T00:00:00.000Z",
    });
    const rule = makeRule({ id: "rule-1", patternId: "pat-1", lastSupportedAt: "2026-01-01T00:00:00.000Z" });

    const session = await assembleCurationSession(
      [pattern], [], snapshots, getEntryText, [rule], { stalenessWindow: 5, driftMargin: 0.5 },
    );
    expect(session.resurfacedRules).toEqual([]);
  });

  // --- drift boundary (REQ-LPC-21): exactly at the margin vs. just past it ---

  test("drift boundary: relative deviation exactly at the margin does NOT flag drift", async () => {
    // baseline 10, rolling mean 15 -> relativeDeviation = 0.5, exactly the
    // margin. detectDrift's check is strict (`> margin`), so equal-to-margin
    // must not fire.
    const snapshots = driftSnapshots(15);
    const pattern = makePattern({
      id: "pat-1",
      status: "intentional",
      metricLink: METRIC,
      entryIds: ["entry-5"],
      sightingCount: 1,
    });
    const rule = makeRule({ id: "rule-1", patternId: "pat-1", baseline: 10 });

    const session = await assembleCurationSession(
      [pattern], [], snapshots, getEntryText, [rule], { stalenessWindow: 10, driftMargin: 0.5 },
    );
    expect(session.resurfacedRules).toEqual([]);
  });

  test("drift boundary: relative deviation just past the margin DOES flag drift", async () => {
    // baseline 10, rolling mean 15.1 -> relativeDeviation = 0.51 > margin 0.5.
    const snapshots = driftSnapshots(15.1);
    const pattern = makePattern({
      id: "pat-1",
      status: "intentional",
      metricLink: METRIC,
      entryIds: ["entry-5"],
      sightingCount: 1,
    });
    const rule = makeRule({ id: "rule-1", patternId: "pat-1", baseline: 10 });

    const session = await assembleCurationSession(
      [pattern], [], snapshots, getEntryText, [rule], { stalenessWindow: 10, driftMargin: 0.5 },
    );
    expect(session.resurfacedRules).toHaveLength(1);
    expect(session.resurfacedRules[0].reasons).toEqual(["drift"]);
    expect(session.resurfacedRules[0].drift?.relativeDeviation).toBeCloseTo(0.51, 5);
    expect(session.resurfacedRules[0].drift?.baseline).toBe(10);
    expect(session.resurfacedRules[0].drift?.margin).toBe(0.5);
    expect(session.resurfacedRules[0].staleness).toBeUndefined();
  });

  test("a computable pattern with no recorded baseline on the rule is only evaluated for staleness, not drift", async () => {
    const snapshots = driftSnapshots(1000); // would clearly "drift" if a baseline were ever assumed
    const pattern = makePattern({
      id: "pat-1",
      status: "intentional",
      metricLink: METRIC,
      entryIds: ["entry-5"],
      sightingCount: 1,
    });
    const rule = makeRule({ id: "rule-1", patternId: "pat-1" }); // no baseline

    const session = await assembleCurationSession(
      [pattern], [], snapshots, getEntryText, [rule], { stalenessWindow: 10, driftMargin: 0.5 },
    );
    expect(session.resurfacedRules).toEqual([]);
  });

  test("both staleness and drift can resurface the same rule at once", async () => {
    const snapshots = driftSnapshots(15.1);
    // Sighted only in an entry outside the staleness window.
    const pattern = makePattern({
      id: "pat-1",
      status: "intentional",
      metricLink: METRIC,
      entryIds: ["entry-0"],
      sightingCount: 1,
    });
    const rule = makeRule({ id: "rule-1", patternId: "pat-1", baseline: 10 });

    const session = await assembleCurationSession(
      [pattern], [], snapshots, getEntryText, [rule], { stalenessWindow: 5, driftMargin: 0.5 },
    );
    expect(session.resurfacedRules).toHaveLength(1);
    expect(session.resurfacedRules[0].reasons.sort()).toEqual(["drift", "stale"]);
  });
});
