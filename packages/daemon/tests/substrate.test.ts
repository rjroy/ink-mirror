import { describe, expect, test } from "bun:test";
import type { MetricSnapshot, Pattern, Sighting, LinkableMetricKey } from "@ink-mirror/shared";
import { LINKABLE_METRIC_REGISTRY } from "@ink-mirror/shared";
import { computeEntryMetrics } from "../src/metrics/index.js";
import {
  rollingMean,
  recurrenceSince,
  detectDrift,
  isStale,
  watchResolution,
  trendSummary,
} from "../src/substrate.js";
import { CORPUS_FIXTURE } from "./fixtures/corpus.js";

// --- Fixture builders ---

function setByPath(obj: Record<string, unknown>, path: string, value: number): void {
  const parts = path.split(".");
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    current = current[parts[i]] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

/** A snapshot with one linkable metric forced to a controlled value. */
function makeSnapshot(entryId: string, date: string, metricKey: LinkableMetricKey, value: number): MetricSnapshot {
  const metrics = computeEntryMetrics("Filler entry text used only as a metrics carrier.");
  setByPath(metrics as unknown as Record<string, unknown>, LINKABLE_METRIC_REGISTRY[metricKey], value);
  return { entryId, date, metrics, schemaVersion: 1 };
}

function makePattern(overrides: Partial<Pattern> = {}): Pattern {
  return {
    id: "pat-2026-01-01-001",
    statement: "Uses short declarative sentences for emphasis.",
    dimension: "sentence-rhythm",
    status: "accidental",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    sightingCount: 0,
    entryIds: [],
    ...overrides,
  };
}

function makeSighting(overrides: Partial<Sighting> = {}): Sighting {
  return {
    id: "sight-001",
    patternId: "pat-2026-01-01-001",
    entryId: "entry-1",
    evidence: ["some evidence"],
    dimension: "sentence-rhythm",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const METRIC: LinkableMetricKey = "commaRatePer1000";

function assertNoNaN(value: unknown, path = "root"): void {
  if (typeof value === "number") {
    expect(Number.isNaN(value)).toBe(false);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoNaN(v, `${path}[${i}]`));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) assertNoNaN(v, `${path}.${k}`);
  }
}

// --- rollingMean ---

describe("rollingMean", () => {
  test("empty corpus returns 0, not NaN", () => {
    expect(rollingMean([], METRIC, 5)).toBe(0);
  });

  test("single entry returns that entry's value", () => {
    const snapshots = [makeSnapshot("e1", "2026-01-01", METRIC, 42)];
    expect(rollingMean(snapshots, METRIC, 5)).toBe(42);
  });

  test("all-identical entries return the shared value", () => {
    const snapshots = [
      makeSnapshot("e1", "2026-01-01", METRIC, 10),
      makeSnapshot("e2", "2026-01-02", METRIC, 10),
      makeSnapshot("e3", "2026-01-03", METRIC, 10),
    ];
    expect(rollingMean(snapshots, METRIC, 5)).toBe(10);
  });

  test("uses only the last N entries by date when window is smaller than the corpus", () => {
    const snapshots = [
      makeSnapshot("e1", "2026-01-01", METRIC, 0),
      makeSnapshot("e2", "2026-01-02", METRIC, 0),
      makeSnapshot("e3", "2026-01-03", METRIC, 100),
      makeSnapshot("e4", "2026-01-04", METRIC, 100),
    ];
    // Window of 2 should only see e3, e4 (mean 100), ignoring the older 0s.
    expect(rollingMean(snapshots, METRIC, 2)).toBe(100);
  });

  test("uses all available entries when window exceeds the corpus size", () => {
    const snapshots = [
      makeSnapshot("e1", "2026-01-01", METRIC, 0),
      makeSnapshot("e2", "2026-01-02", METRIC, 20),
    ];
    expect(rollingMean(snapshots, METRIC, 100)).toBe(10);
  });

  test("a non-positive window returns 0 rather than the whole corpus", () => {
    const snapshots = [makeSnapshot("e1", "2026-01-01", METRIC, 500)];
    expect(rollingMean(snapshots, METRIC, 0)).toBe(0);
    expect(rollingMean(snapshots, METRIC, -3)).toBe(0);
  });

  test("sorts by date before windowing, regardless of input order", () => {
    const snapshots = [
      makeSnapshot("later", "2026-01-05", METRIC, 100),
      makeSnapshot("earlier", "2026-01-01", METRIC, 0),
    ];
    // window=1 should pick the later date's value (100), not whichever
    // element happens to be last in the input array.
    expect(rollingMean(snapshots, METRIC, 1)).toBe(100);
  });

  test("is deterministic: repeated calls on the fixture corpus return the same value", () => {
    const snapshots = CORPUS_FIXTURE.map((e) => ({
      entryId: e.entryId,
      date: e.date,
      metrics: computeEntryMetrics(e.text),
      schemaVersion: 1 as const,
    }));
    const first = rollingMean(snapshots, METRIC, 5);
    const second = rollingMean(snapshots, METRIC, 5);
    expect(first).toBe(second);
    expect(Number.isNaN(first)).toBe(false);
  });
});

// --- recurrenceSince ---

describe("recurrenceSince", () => {
  test("empty sightings and empty entriesSince return zero of zero", () => {
    const result = recurrenceSince([], [], "2026-01-01T00:00:00.000Z");
    expect(result).toEqual({ count: 0, of: 0 });
  });

  test("counts a distinct entry once even with multiple sightings in it", () => {
    const sightings = [
      makeSighting({ entryId: "entry-2", createdAt: "2026-01-05T00:00:00.000Z" }),
      makeSighting({ entryId: "entry-2", createdAt: "2026-01-06T00:00:00.000Z" }),
    ];
    const result = recurrenceSince(sightings, ["entry-1", "entry-2", "entry-3"], "2026-01-01T00:00:00.000Z");
    expect(result).toEqual({ count: 1, of: 3 });
  });

  test("excludes sightings dated before the cutoff", () => {
    const sightings = [makeSighting({ entryId: "entry-1", createdAt: "2025-12-31T00:00:00.000Z" })];
    const result = recurrenceSince(sightings, ["entry-1"], "2026-01-01T00:00:00.000Z");
    expect(result.count).toBe(0);
  });

  test("excludes sightings for entries outside the scoped population", () => {
    const sightings = [makeSighting({ entryId: "entry-outside", createdAt: "2026-02-01T00:00:00.000Z" })];
    const result = recurrenceSince(sightings, ["entry-1", "entry-2"], "2026-01-01T00:00:00.000Z");
    expect(result).toEqual({ count: 0, of: 2 });
  });
});

// --- detectDrift ---

describe("detectDrift", () => {
  test("zero baseline and zero mean is not drifting (no NaN from 0/0)", () => {
    const snapshots = [makeSnapshot("e1", "2026-01-01", METRIC, 0)];
    const result = detectDrift(snapshots, METRIC, 0, 0.5, 1);
    expect(result.relativeDeviation).toBe(0);
    expect(result.isDrifting).toBe(false);
    expect(Number.isNaN(result.relativeDeviation)).toBe(false);
  });

  test("zero baseline with a nonzero mean is treated as full deviation", () => {
    const snapshots = [makeSnapshot("e1", "2026-01-01", METRIC, 5)];
    const result = detectDrift(snapshots, METRIC, 0, 0.5, 1);
    expect(result.relativeDeviation).toBe(1);
    expect(result.isDrifting).toBe(true);
  });

  test("does not flag drift exactly at the margin boundary", () => {
    // baseline 10, mean 15 => deviation 0.5, margin 0.5: not > margin.
    const snapshots = [makeSnapshot("e1", "2026-01-01", METRIC, 15)];
    const result = detectDrift(snapshots, METRIC, 10, 0.5, 1);
    expect(result.relativeDeviation).toBe(0.5);
    expect(result.isDrifting).toBe(false);
  });

  test("flags drift just past the margin", () => {
    const snapshots = [makeSnapshot("e1", "2026-01-01", METRIC, 15.01)];
    const result = detectDrift(snapshots, METRIC, 10, 0.5, 1);
    expect(result.isDrifting).toBe(true);
  });

  test("empty corpus never produces NaN even with a nonzero baseline", () => {
    const result = detectDrift([], METRIC, 10, 0.5, 5);
    expect(result.rollingMean).toBe(0);
    expect(Number.isNaN(result.relativeDeviation)).toBe(false);
  });
});

// --- isStale ---

describe("isStale", () => {
  test("returns false when there are no recent entries to judge against", () => {
    const pattern = makePattern({ entryIds: [] });
    expect(isStale(pattern, [], 10)).toBe(false);
  });

  test("a pattern sighted within the window is not stale", () => {
    const pattern = makePattern({ entryIds: ["entry-5"] });
    const recent = ["entry-10", "entry-9", "entry-8", "entry-7", "entry-6", "entry-5"];
    expect(isStale(pattern, recent, 10)).toBe(false);
  });

  test("a pattern with no sighting anywhere in the window is stale", () => {
    const pattern = makePattern({ entryIds: ["entry-old"] });
    const recent = ["entry-10", "entry-9", "entry-8"];
    expect(isStale(pattern, recent, 10)).toBe(true);
  });

  test("a sighting just outside the window boundary still counts as stale", () => {
    const pattern = makePattern({ entryIds: ["entry-11"] });
    // window=10, so only the first 10 of these count; entry-11 is 11th.
    const recent = [
      "entry-10", "entry-9", "entry-8", "entry-7", "entry-6",
      "entry-5", "entry-4", "entry-3", "entry-2", "entry-1", "entry-11",
    ];
    expect(isStale(pattern, recent, 10)).toBe(true);
  });

  test("a sighting exactly at the window boundary is not stale", () => {
    const pattern = makePattern({ entryIds: ["entry-1"] });
    const recent = ["entry-10", "entry-9", "entry-8", "entry-7", "entry-6", "entry-5", "entry-4", "entry-3", "entry-2", "entry-1"];
    expect(isStale(pattern, recent, 10)).toBe(false);
  });
});

// --- watchResolution ---

describe("watchResolution", () => {
  const CLASSIFIED_AT = "2026-01-05T00:00:00.000Z";

  function snapshotsAfterClassification(count: number, values: number[]): MetricSnapshot[] {
    return Array.from({ length: count }, (_, i) =>
      makeSnapshot(`entry-${i}`, `2026-01-${String(6 + i).padStart(2, "0")}T00:00:00.000Z`, METRIC, values[i]),
    );
  }

  test("no watch attached never resolves", () => {
    const pattern = makePattern({ watch: undefined });
    const result = watchResolution(pattern, [], [], { computableWatchWindow: 5, qualitativeWatchWindow: 10 });
    expect(result.shouldResolve).toBe(false);
  });

  test("an already-resolved watch never resolves again", () => {
    const pattern = makePattern({
      watch: { classifiedAt: CLASSIFIED_AT, resolved: true, resolvedAt: "2026-01-06T00:00:00.000Z" },
    });
    const result = watchResolution(pattern, [], [], { computableWatchWindow: 5, qualitativeWatchWindow: 10 });
    expect(result.shouldResolve).toBe(false);
  });

  describe("computable branch", () => {
    test("does not resolve with fewer than the full window since classification", () => {
      const pattern = makePattern({
        metricLink: METRIC,
        watch: { classifiedAt: CLASSIFIED_AT, baseline: 10, resolved: false },
      });
      const snapshots = snapshotsAfterClassification(4, [1, 1, 1, 1]);
      const result = watchResolution(pattern, snapshots, [], { computableWatchWindow: 5, qualitativeWatchWindow: 10 });
      expect(result.kind).toBe("computable");
      expect(result.shouldResolve).toBe(false);
    });

    test("resolves when all entries in the window stay below baseline", () => {
      const pattern = makePattern({
        metricLink: METRIC,
        watch: { classifiedAt: CLASSIFIED_AT, baseline: 10, resolved: false },
      });
      const snapshots = snapshotsAfterClassification(5, [1, 2, 3, 4, 5]);
      const result = watchResolution(pattern, snapshots, [], { computableWatchWindow: 5, qualitativeWatchWindow: 10 });
      expect(result.shouldResolve).toBe(true);
    });

    test("does not resolve if any entry in the window is at or above baseline", () => {
      const pattern = makePattern({
        metricLink: METRIC,
        watch: { classifiedAt: CLASSIFIED_AT, baseline: 10, resolved: false },
      });
      const snapshots = snapshotsAfterClassification(5, [1, 2, 3, 4, 10]);
      const result = watchResolution(pattern, snapshots, [], { computableWatchWindow: 5, qualitativeWatchWindow: 10 });
      expect(result.shouldResolve).toBe(false);
    });
  });

  describe("qualitative branch", () => {
    test("does not resolve with fewer than the full window since classification", () => {
      const pattern = makePattern({ watch: { classifiedAt: CLASSIFIED_AT, resolved: false } });
      const snapshots = snapshotsAfterClassification(9, new Array(9).fill(0));
      const result = watchResolution(pattern, snapshots, [], { computableWatchWindow: 5, qualitativeWatchWindow: 10 });
      expect(result.kind).toBe("qualitative");
      expect(result.shouldResolve).toBe(false);
    });

    test("resolves when no sighting falls within the full window", () => {
      const pattern = makePattern({ watch: { classifiedAt: CLASSIFIED_AT, resolved: false } });
      const snapshots = snapshotsAfterClassification(10, new Array(10).fill(0));
      const result = watchResolution(pattern, snapshots, [], { computableWatchWindow: 5, qualitativeWatchWindow: 10 });
      expect(result.shouldResolve).toBe(true);
    });

    test("does not resolve when a sighting falls within the window", () => {
      const pattern = makePattern({ id: "pat-1", watch: { classifiedAt: CLASSIFIED_AT, resolved: false } });
      const snapshots = snapshotsAfterClassification(10, new Array(10).fill(0));
      const sightings = [makeSighting({ patternId: "pat-1", entryId: "entry-3" })];
      const result = watchResolution(pattern, snapshots, sightings, { computableWatchWindow: 5, qualitativeWatchWindow: 10 });
      expect(result.shouldResolve).toBe(false);
    });

    test("a sighting for a different pattern does not block resolution", () => {
      const pattern = makePattern({ id: "pat-1", watch: { classifiedAt: CLASSIFIED_AT, resolved: false } });
      const snapshots = snapshotsAfterClassification(10, new Array(10).fill(0));
      const sightings = [makeSighting({ patternId: "pat-other", entryId: "entry-3" })];
      const result = watchResolution(pattern, snapshots, sightings, { computableWatchWindow: 5, qualitativeWatchWindow: 10 });
      expect(result.shouldResolve).toBe(true);
    });
  });
});

// --- trendSummary ---

describe("trendSummary", () => {
  test("empty corpus is flat with zero magnitude, not NaN", () => {
    const result = trendSummary([], METRIC, 5);
    expect(result).toEqual({ metricKey: METRIC, windowSize: 0, rollingMean: 0, direction: "flat", magnitude: 0 });
  });

  test("a single entry is flat with zero magnitude", () => {
    const snapshots = [makeSnapshot("e1", "2026-01-01", METRIC, 50)];
    const result = trendSummary(snapshots, METRIC, 5);
    expect(result.direction).toBe("flat");
    expect(result.magnitude).toBe(0);
    expect(result.rollingMean).toBe(50);
  });

  test("all-identical entries are flat", () => {
    const snapshots = [
      makeSnapshot("e1", "2026-01-01", METRIC, 10),
      makeSnapshot("e2", "2026-01-02", METRIC, 10),
      makeSnapshot("e3", "2026-01-03", METRIC, 10),
      makeSnapshot("e4", "2026-01-04", METRIC, 10),
    ];
    const result = trendSummary(snapshots, METRIC, 4);
    expect(result.direction).toBe("flat");
    expect(result.magnitude).toBe(0);
  });

  test("detects an upward trend", () => {
    const snapshots = [
      makeSnapshot("e1", "2026-01-01", METRIC, 0),
      makeSnapshot("e2", "2026-01-02", METRIC, 0),
      makeSnapshot("e3", "2026-01-03", METRIC, 20),
      makeSnapshot("e4", "2026-01-04", METRIC, 20),
    ];
    const result = trendSummary(snapshots, METRIC, 4);
    expect(result.direction).toBe("up");
    expect(result.magnitude).toBeGreaterThan(0);
  });

  test("detects a downward trend", () => {
    const snapshots = [
      makeSnapshot("e1", "2026-01-01", METRIC, 20),
      makeSnapshot("e2", "2026-01-02", METRIC, 20),
      makeSnapshot("e3", "2026-01-03", METRIC, 0),
      makeSnapshot("e4", "2026-01-04", METRIC, 0),
    ];
    const result = trendSummary(snapshots, METRIC, 4);
    expect(result.direction).toBe("down");
  });

  test("is deterministic across repeated runs on the fixture corpus", () => {
    const snapshots = CORPUS_FIXTURE.map((e) => ({
      entryId: e.entryId,
      date: e.date,
      metrics: computeEntryMetrics(e.text),
      schemaVersion: 1 as const,
    }));
    const first = JSON.stringify(trendSummary(snapshots, METRIC, 5));
    const second = JSON.stringify(trendSummary(snapshots, METRIC, 5));
    expect(first).toBe(second);
  });
});

// --- NaN sweep across every function's edge cases ---

describe("no NaN reaches a returned value (lessons-learned hazard)", () => {
  test("across every function's empty/degenerate inputs", () => {
    assertNoNaN(rollingMean([], METRIC, 5));
    assertNoNaN(recurrenceSince([], [], "2026-01-01"));
    assertNoNaN(detectDrift([], METRIC, 0, 0.5));
    assertNoNaN(detectDrift([], METRIC, 10, 0.5));
    assertNoNaN(isStale(makePattern(), [], 10));
    assertNoNaN(
      watchResolution(makePattern({ watch: undefined }), [], [], {
        computableWatchWindow: 5,
        qualitativeWatchWindow: 10,
      }),
    );
    assertNoNaN(trendSummary([], METRIC, 5));
  });
});
