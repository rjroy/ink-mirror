/**
 * Substrate: deterministic statistics computed from metric snapshots and
 * the sighting ledger. No store access, no LLM calls (REQ-LPC-8) — every
 * function here is a pure, total function of its arguments so the same
 * corpus always produces byte-identical numbers.
 *
 * NaN hazard (project lessons-learned: NaN round-trips through
 * JSON.stringify as null): every division in this file guards its
 * denominator explicitly. No returned value can be NaN.
 */
import {
  LINKABLE_METRIC_REGISTRY,
  type LinkableMetricKey,
  type MetricSnapshot,
  type Pattern,
  type Sighting,
} from "@ink-mirror/shared";
import type { Config } from "./config.js";

// --- Shared helpers ---

function sortByDate<T extends { date: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.date.localeCompare(b.date));
}

/** Mean of a numeric array. Empty input returns 0, never NaN. */
function average(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/**
 * Reads a dot-path (e.g. "rhythm.mean", "punctuation.commaRatePer1000") off
 * a snapshot's metrics object. Returns undefined for a missing path or a
 * non-finite value (covers old snapshots predating a metric, or a stray
 * NaN) so callers can filter it out instead of propagating it.
 */
function getMetricValue(snapshot: MetricSnapshot, path: string): number | undefined {
  const parts = path.split(".");
  let current: unknown = snapshot.metrics;
  for (const part of parts) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "number" && Number.isFinite(current) ? current : undefined;
}

/** Last `window` snapshots by date, ascending. window <= 0 yields []. */
function lastWindow(snapshots: MetricSnapshot[], window: number): MetricSnapshot[] {
  if (window <= 0) return [];
  const sorted = sortByDate(snapshots);
  return sorted.slice(Math.max(0, sorted.length - window));
}

function valuesForKey(snapshots: MetricSnapshot[], metricKey: LinkableMetricKey): number[] {
  const path = LINKABLE_METRIC_REGISTRY[metricKey];
  const values: number[] = [];
  for (const s of snapshots) {
    const v = getMetricValue(s, path);
    if (v !== undefined) values.push(v);
  }
  return values;
}

// --- Rolling mean (REQ-LPC-8/21) ---

/**
 * Mean of `metricKey`'s value over the last `window` entries by date.
 * Snapshots missing the metric (e.g. pre-Phase-2 records) are skipped
 * rather than treated as zero. Empty corpus, a single entry, and an
 * all-identical corpus all resolve without NaN.
 */
export function rollingMean(
  snapshots: MetricSnapshot[],
  metricKey: LinkableMetricKey,
  window: number,
): number {
  return average(valuesForKey(lastWindow(snapshots, window), metricKey));
}

// --- Recurrence since a date (REQ-LPC-24) ---

export interface Recurrence {
  /** Distinct entries (within `of`) that have a sighting on/after the cutoff date. */
  count: number;
  /** Size of the entry population being measured against. */
  of: number;
}

/**
 * "N of last M entries" since a cutoff date (typically a watch's
 * classifiedAt). `entriesSince` is the caller-scoped population of entry
 * IDs to measure against (the M); `sightings` should already be scoped to
 * one pattern. A sighting counts only if it's dated on/after `date` *and*
 * its entry is in `entriesSince`, so stale sightings predating the cutoff
 * (or from entries outside the scoped population) don't inflate the count.
 */
export function recurrenceSince(
  sightings: Sighting[],
  entriesSince: string[],
  date: string,
): Recurrence {
  const scoped = new Set(entriesSince);
  const matched = new Set<string>();
  for (const sighting of sightings) {
    if (sighting.createdAt >= date && scoped.has(sighting.entryId)) {
      matched.add(sighting.entryId);
    }
  }
  return { count: matched.size, of: entriesSince.length };
}

// --- Drift detection (REQ-LPC-21) ---

export interface DriftResult {
  isDrifting: boolean;
  rollingMean: number;
  baseline: number;
  /** Relative deviation of rollingMean from baseline; always finite. */
  relativeDeviation: number;
}

/**
 * Flags drift when the rolling mean over the last `window` entries (default
 * 5) deviates from `baseline` by more than the relative `margin` (e.g. 0.5
 * for 50%). A zero baseline can't produce a relative (divide-by-zero)
 * deviation: any nonzero mean against a zero baseline is treated as full
 * deviation (1.0); a zero mean against a zero baseline is no deviation (0).
 */
export function detectDrift(
  snapshots: MetricSnapshot[],
  metricKey: LinkableMetricKey,
  baseline: number,
  margin: number,
  window = 5,
): DriftResult {
  const mean = rollingMean(snapshots, metricKey, window);
  const relativeDeviation =
    baseline === 0 ? (mean === 0 ? 0 : 1) : Math.abs(mean - baseline) / Math.abs(baseline);

  return {
    isDrifting: relativeDeviation > margin,
    rollingMean: mean,
    baseline,
    relativeDeviation,
  };
}

// --- Staleness (REQ-LPC-20) ---

/**
 * True when `pattern` has no sighting among the last `window` (default 10)
 * entry IDs. `lastNEntryIds` is the caller-supplied recent-entries slice,
 * newest-first; only its first `window` items are considered. An empty
 * `lastNEntryIds` (nothing to judge staleness against, e.g. a fresh corpus)
 * returns false rather than vacuously flagging every pattern stale.
 */
export function isStale(pattern: Pattern, lastNEntryIds: string[], window = 10): boolean {
  const recent = lastNEntryIds.slice(0, window);
  if (recent.length === 0) return false;

  const sighted = new Set(pattern.entryIds);
  return !recent.some((id) => sighted.has(id));
}

// --- Watch resolution (REQ-LPC-25) ---

export interface WatchResolutionResult {
  shouldResolve: boolean;
  kind: "computable" | "qualitative";
}

/** Snapshots dated on/after `date`, ascending. */
function snapshotsSince(snapshots: MetricSnapshot[], date: string): MetricSnapshot[] {
  return sortByDate(snapshots.filter((s) => s.date >= date));
}

/**
 * Decides whether a watched pattern's watch should resolve now. Pure: it
 * reports whether resolution conditions are met, it does not mutate
 * anything — the caller (pattern-store, a later phase) is responsible for
 * writing `resolved`/`resolvedAt` (REQ-LPC-25: resolution touches watch
 * metadata only, never classification).
 *
 * Computable branch: the linked metric must stay below the watch's
 * pre-classification baseline for `config.computableWatchWindow`
 * consecutive entries since classification.
 * Qualitative branch: no sighting of the pattern in
 * `config.qualitativeWatchWindow` consecutive entries since classification.
 * Both branches require a *full* window of entries since classification;
 * a short post-classification history never resolves early.
 */
export function watchResolution(
  pattern: Pattern,
  snapshots: MetricSnapshot[],
  sightings: Sighting[],
  config: Pick<Config, "computableWatchWindow" | "qualitativeWatchWindow">,
): WatchResolutionResult {
  const watch = pattern.watch;
  // Both metricLink and watch.baseline are required for the computable
  // branch. Per REQ-LPC-23, baseline should always be set when a computable
  // pattern is classified accidental, but this function is pure and doesn't
  // trust its caller — a computable pattern whose watch is missing a
  // baseline (e.g. an upstream bug or a pre-migration record) falls back to
  // the qualitative branch rather than crashing or dividing by an undefined
  // value.
  const isComputable = pattern.metricLink !== undefined && watch?.baseline !== undefined;
  const kind: "computable" | "qualitative" = isComputable ? "computable" : "qualitative";

  if (!watch || watch.resolved) {
    return { shouldResolve: false, kind };
  }

  const since = snapshotsSince(snapshots, watch.classifiedAt);

  if (isComputable) {
    const window = config.computableWatchWindow;
    const last = since.slice(-window);
    if (last.length < window) return { shouldResolve: false, kind };

    const path = LINKABLE_METRIC_REGISTRY[pattern.metricLink as LinkableMetricKey];
    const baseline = watch.baseline as number;
    const allBelowBaseline = last.every((s) => {
      const value = getMetricValue(s, path);
      return value !== undefined && value < baseline;
    });
    return { shouldResolve: allBelowBaseline, kind };
  }

  const window = config.qualitativeWatchWindow;
  const last = since.slice(-window);
  if (last.length < window) return { shouldResolve: false, kind };

  const sightedEntryIds = new Set(
    sightings.filter((s) => s.patternId === pattern.id).map((s) => s.entryId),
  );
  const noSightings = last.every((s) => !sightedEntryIds.has(s.entryId));
  return { shouldResolve: noSightings, kind };
}

// --- Trend summary for dossier/prompt display (REQ-LPC-10/12) ---

export interface TrendSummary {
  metricKey: LinkableMetricKey;
  windowSize: number;
  rollingMean: number;
  direction: "up" | "down" | "flat";
  /** Absolute difference between the window's first-half and second-half means. */
  magnitude: number;
}

const FLAT_EPSILON = 1e-9;

/**
 * Summarizes direction/magnitude of `metricKey` over the last `window`
 * entries (default 5), by splitting the window in half and comparing
 * means. Fewer than 2 usable data points (empty corpus, single entry, or a
 * corpus missing the metric everywhere) reports "flat" with zero
 * magnitude rather than a misleading trend.
 */
export function trendSummary(
  snapshots: MetricSnapshot[],
  metricKey: LinkableMetricKey,
  window = 5,
): TrendSummary {
  const windowed = lastWindow(snapshots, window);
  const values = valuesForKey(windowed, metricKey);
  const mean = average(values);

  if (values.length < 2) {
    return { metricKey, windowSize: windowed.length, rollingMean: mean, direction: "flat", magnitude: 0 };
  }

  const midpoint = Math.floor(values.length / 2);
  const firstMean = average(values.slice(0, midpoint));
  const secondMean = average(values.slice(midpoint));
  const magnitude = Math.abs(secondMean - firstMean);
  const direction: "up" | "down" | "flat" =
    magnitude < FLAT_EPSILON ? "flat" : secondMean > firstMean ? "up" : "down";

  return { metricKey, windowSize: windowed.length, rollingMean: mean, direction, magnitude };
}
