import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import * as YAML from "yaml";
import {
  PatternSchema,
  isValidPatternTransition,
  type Pattern,
  type PatternStatus,
  type PatternRetirement,
  type Sighting,
  type WatchItem,
  type ObservationDimension,
  type LinkableMetricKey,
} from "@ink-mirror/shared";

/**
 * Filesystem operations needed by PatternStore.
 * Same interface pattern as ObservationStore/SnapshotStore for consistency.
 */
export interface PatternStoreFs {
  readdir(path: string): Promise<string[]>;
  readFile(path: string, encoding: "utf-8"): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  mkdir(path: string, opts: { recursive: true }): Promise<void>;
}

export interface PatternStoreDeps {
  patternsDir: string;
  fs?: PatternStoreFs;
  now?: () => string;
}

/** Input to create a brand-new candidate pattern (REQ-LPC-2). */
export interface NewPatternInput {
  statement: string;
  dimension: ObservationDimension;
  /** Must already be a valid linkable-metric key; validate before calling create(). */
  metricLink?: LinkableMetricKey;
  /**
   * Stamped by Phase 5's migration (REQ-LPC-27) when this pattern is created
   * from a pre-existing v1 profile rule's text rather than accumulated
   * sighting evidence. See PatternSchema.migratedNoHistory for the full
   * rationale.
   */
  migratedNoHistory?: boolean;
}

export interface PatternListFilter {
  status?: PatternStatus;
}

export interface PatternStore {
  create(input: NewPatternInput): Promise<Pattern>;
  get(id: string): Promise<Pattern | undefined>;
  list(filter?: PatternListFilter): Promise<Pattern[]>;
  /**
   * Enforces isValidPatternTransition; throws on an invalid transition.
   * `retirement` is only meaningful when `status` is "retired" (dismiss
   * passes `{ dismissedAsWrong: true }`, plain retire passes nothing); any
   * transition away from "retired" (i.e. reactivate) always clears a
   * pattern's `retirement` marker regardless of this argument, since a
   * pattern that's active again shouldn't carry a stale dismiss/retire
   * reason (planning decision 1: "reactivates to undecided, marker
   * cleared").
   */
  updateStatus(id: string, status: PatternStatus, retirement?: PatternRetirement): Promise<Pattern>;
  /** Bumps sightingCount, adds entryId to entryIds if new, updates lastSightingAt. */
  recordSighting(patternId: string, sighting: Sighting): Promise<Pattern>;
  /**
   * Removes one sighting's contribution from a pattern's denormalized
   * counters. Takes the pattern's *remaining* sightings (post-removal, not
   * yet filtered to this pattern) so entryIds/sightingCount/lastSightingAt
   * are recomputed correctly even when the removed sighting shared an entry
   * with another surviving sighting — the same reason rebuildCounters exists.
   */
  detachSighting(patternId: string, remainingSightings: Sighting[]): Promise<Pattern>;
  /**
   * Writer-ratified merge (planning decision 2): the duplicate's counters
   * fold into the survivor and the duplicate retires with mergedInto set.
   * Requires both patterns share a dimension. This only updates pattern-level
   * bookkeeping — rewriting the moved sightings' own patternId field is a
   * route-layer concern (Phase 4) with access to the observation/sighting
   * store, which this module does not have.
   */
  merge(survivorId: string, duplicateId: string): Promise<Pattern>;
  setWatch(patternId: string, watch: WatchItem | undefined): Promise<Pattern>;
  linkRule(patternId: string, ruleId: string): Promise<Pattern>;
  /**
   * Records that the writer declined a promotion proposal (Phase 4 planning
   * decision): stamps `proposalDeclinedAt` so promotion.ts's proposalFor()
   * stops re-proposing this pattern until a newer sighting arrives. The
   * decline/accept action itself is a route-layer concern (Phase 4's other
   * sub-task); this is the data-layer primitive it calls. Also clears
   * `proposalSurfacedAt`, so if new evidence later reopens the proposal
   * (proposalFor()'s decline-suppression lifts), the route layer sees an
   * unset marker and treats it as surfacing again for `pattern:proposal`
   * event purposes.
   */
  declineProposal(patternId: string): Promise<Pattern>;
  /**
   * Stamps `proposalSurfacedAt` (Phase 4 route-layer concern): the route
   * calls this the first time it computes and emits a `pattern:proposal`
   * event for a pattern, so repeated GET /patterns/session calls don't
   * re-emit the same proposal every time.
   */
  markProposalSurfaced(patternId: string): Promise<Pattern>;
  /** Recomputes sightingCount/entryIds/lastSightingAt from a sighting list (migration/repair). */
  rebuildCounters(patternId: string, sightings: Sighting[]): Promise<Pattern>;
}

/**
 * Serialize a pattern to YAML using the `yaml` package (same dependency
 * snapshot-store.ts added in Phase 2). Patterns nest optional objects
 * (retirement, watch) and an array (entryIds), which is beyond what the
 * hand-rolled block-literal writer (observation-store.ts/nudge-store.ts)
 * supports — see the Phase 3 serialization decision in the plan.
 */
export function toYaml(pattern: Pattern): string {
  return YAML.stringify(pattern);
}

/**
 * Parse a pattern `.yaml` file back into a Pattern. Never throws; malformed
 * or schema-invalid content is treated as absent, matching the other
 * stores' contract.
 */
export function fromYaml(content: string): Pattern | undefined {
  let parsed: unknown;
  try {
    parsed = YAML.parse(content);
  } catch {
    return undefined;
  }

  const result = PatternSchema.safeParse(parsed);
  return result.success ? result.data : undefined;
}

const realFs: PatternStoreFs = {
  readdir: (p) => readdir(p),
  readFile: (p, enc) => readFile(p, enc),
  writeFile: (p, c) => writeFile(p, c, "utf-8"),
  mkdir: (p, o) => mkdir(p, o).then(() => {}),
};

/** Generates a sequential pattern ID for the given date (matches obs-YYYY-MM-DD-NNN scheme). */
async function nextPatternId(
  dir: string,
  dateStr: string,
  fs: PatternStoreFs,
): Promise<string> {
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    files = [];
  }

  const prefix = `pat-${dateStr}-`;
  let maxSeq = 0;
  for (const f of files) {
    if (f.startsWith(prefix) && f.endsWith(".yaml")) {
      const seqStr = f.slice(prefix.length, -5);
      const seq = parseInt(seqStr, 10);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  }

  return `pat-${dateStr}-${String(maxSeq + 1).padStart(3, "0")}`;
}

/** Recomputes sightingCount/entryIds/lastSightingAt from a sighting list, filtered to patternId. */
function computeCounters(
  patternId: string,
  sightings: Sighting[],
): { sightingCount: number; entryIds: string[]; lastSightingAt: string | undefined } {
  const relevant = sightings.filter((s) => s.patternId === patternId);
  const entryIds: string[] = [];
  const seen = new Set<string>();
  let lastSightingAt: string | undefined;

  for (const s of relevant) {
    if (!seen.has(s.entryId)) {
      seen.add(s.entryId);
      entryIds.push(s.entryId);
    }
    if (lastSightingAt === undefined || s.createdAt > lastSightingAt) {
      lastSightingAt = s.createdAt;
    }
  }

  return { sightingCount: relevant.length, entryIds, lastSightingAt };
}

export function createPatternStore(deps: PatternStoreDeps): PatternStore {
  const { patternsDir } = deps;
  const fs = deps.fs ?? realFs;
  const now = deps.now ?? (() => new Date().toISOString());

  async function readPattern(id: string): Promise<Pattern | undefined> {
    try {
      const content = await fs.readFile(join(patternsDir, `${id}.yaml`), "utf-8");
      return fromYaml(content);
    } catch {
      return undefined;
    }
  }

  async function writePattern(pattern: Pattern): Promise<void> {
    await fs.mkdir(patternsDir, { recursive: true });
    await fs.writeFile(join(patternsDir, `${pattern.id}.yaml`), toYaml(pattern));
  }

  async function requirePattern(id: string): Promise<Pattern> {
    const pattern = await readPattern(id);
    if (!pattern) {
      throw new Error(`Pattern not found: ${id}`);
    }
    return pattern;
  }

  return {
    async create(input: NewPatternInput): Promise<Pattern> {
      await fs.mkdir(patternsDir, { recursive: true });

      const dateStr = now().slice(0, 10);
      const id = await nextPatternId(patternsDir, dateStr, fs);
      const timestamp = now();

      const pattern: Pattern = {
        id,
        statement: input.statement,
        dimension: input.dimension,
        status: "candidate",
        createdAt: timestamp,
        updatedAt: timestamp,
        metricLink: input.metricLink,
        sightingCount: 0,
        entryIds: [],
        ...(input.migratedNoHistory ? { migratedNoHistory: true } : {}),
      };

      await writePattern(pattern);
      return pattern;
    },

    async get(id: string): Promise<Pattern | undefined> {
      return readPattern(id);
    },

    async list(filter?: PatternListFilter): Promise<Pattern[]> {
      let files: string[];
      try {
        files = await fs.readdir(patternsDir);
      } catch {
        return [];
      }

      const yamlFiles = files.filter((f) => f.endsWith(".yaml")).sort();
      const patterns: Pattern[] = [];

      for (const file of yamlFiles) {
        const content = await fs.readFile(join(patternsDir, file), "utf-8");
        const pattern = fromYaml(content);
        if (pattern) patterns.push(pattern);
      }

      if (filter?.status) {
        return patterns.filter((p) => p.status === filter.status);
      }
      return patterns;
    },

    async updateStatus(
      id: string,
      status: PatternStatus,
      retirement?: PatternRetirement,
    ): Promise<Pattern> {
      const pattern = await requirePattern(id);
      if (!isValidPatternTransition(pattern.status, status)) {
        throw new Error(
          `Invalid pattern transition from "${pattern.status}" to "${status}"`,
        );
      }

      const updated: Pattern = {
        ...pattern,
        status,
        // Only "retired" can carry a retirement reason; every other target
        // status (including "undecided" on reactivate) clears it.
        retirement: status === "retired" ? retirement : undefined,
        // A retired pattern's rule (if any) is being deleted from the
        // profile by the caller (routes/patterns.ts) in the same action —
        // clear the back-reference here so it can't outlive the rule it
        // pointed at. Without this, reactivating later would still see a
        // (now-deleted) ruleId and wrongly believe the pattern was already
        // promoted, permanently blocking re-promotion.
        ruleId: status === "retired" ? undefined : pattern.ruleId,
        updatedAt: now(),
      };
      await writePattern(updated);
      return updated;
    },

    async recordSighting(patternId: string, sighting: Sighting): Promise<Pattern> {
      const pattern = await requirePattern(patternId);

      const entryIds = pattern.entryIds.includes(sighting.entryId)
        ? pattern.entryIds
        : [...pattern.entryIds, sighting.entryId];
      const lastSightingAt =
        pattern.lastSightingAt === undefined || sighting.createdAt > pattern.lastSightingAt
          ? sighting.createdAt
          : pattern.lastSightingAt;

      const updated: Pattern = {
        ...pattern,
        sightingCount: pattern.sightingCount + 1,
        entryIds,
        lastSightingAt,
        updatedAt: now(),
      };
      await writePattern(updated);
      return updated;
    },

    async detachSighting(patternId: string, remainingSightings: Sighting[]): Promise<Pattern> {
      const pattern = await requirePattern(patternId);
      const counters = computeCounters(patternId, remainingSightings);

      const updated: Pattern = {
        ...pattern,
        sightingCount: counters.sightingCount,
        entryIds: counters.entryIds,
        lastSightingAt: counters.lastSightingAt,
        updatedAt: now(),
      };
      await writePattern(updated);
      return updated;
    },

    async merge(survivorId: string, duplicateId: string): Promise<Pattern> {
      const survivor = await requirePattern(survivorId);
      const duplicate = await requirePattern(duplicateId);

      if (survivor.dimension !== duplicate.dimension) {
        throw new Error(
          `Cannot merge patterns from different dimensions: "${survivor.dimension}" vs "${duplicate.dimension}"`,
        );
      }

      const mergedEntryIds = [...survivor.entryIds];
      for (const entryId of duplicate.entryIds) {
        if (!mergedEntryIds.includes(entryId)) mergedEntryIds.push(entryId);
      }
      const lastSightingAt =
        (survivor.lastSightingAt ?? "") > (duplicate.lastSightingAt ?? "")
          ? survivor.lastSightingAt
          : duplicate.lastSightingAt;

      const timestamp = now();
      const updatedSurvivor: Pattern = {
        ...survivor,
        sightingCount: survivor.sightingCount + duplicate.sightingCount,
        entryIds: mergedEntryIds,
        lastSightingAt,
        updatedAt: timestamp,
      };
      await writePattern(updatedSurvivor);

      const retiredDuplicate: Pattern = {
        ...duplicate,
        status: "retired",
        retirement: { mergedInto: survivorId },
        // The duplicate's sightings were just folded into the survivor above
        // (and the route layer reassigns the sightings' own patternId right
        // after this call), so the duplicate itself no longer has any
        // sightings pointing at it. Zero its counters here so a later
        // reactivate doesn't resurrect stale, now-false sighting counts.
        sightingCount: 0,
        entryIds: [],
        lastSightingAt: undefined,
        // Same reasoning as updateStatus's retire branch: the route layer
        // deletes the duplicate's linked rule (if any) as part of this same
        // merge action, so the pattern-side reference must not outlive it.
        ruleId: undefined,
        updatedAt: timestamp,
      };
      await writePattern(retiredDuplicate);

      return updatedSurvivor;
    },

    async setWatch(patternId: string, watch: WatchItem | undefined): Promise<Pattern> {
      const pattern = await requirePattern(patternId);
      const updated: Pattern = { ...pattern, watch, updatedAt: now() };
      await writePattern(updated);
      return updated;
    },

    async linkRule(patternId: string, ruleId: string): Promise<Pattern> {
      const pattern = await requirePattern(patternId);
      const updated: Pattern = { ...pattern, ruleId, updatedAt: now() };
      await writePattern(updated);
      return updated;
    },

    async declineProposal(patternId: string): Promise<Pattern> {
      const pattern = await requirePattern(patternId);
      const timestamp = now();
      const updated: Pattern = {
        ...pattern,
        proposalDeclinedAt: timestamp,
        proposalSurfacedAt: undefined,
        updatedAt: timestamp,
      };
      await writePattern(updated);
      return updated;
    },

    async markProposalSurfaced(patternId: string): Promise<Pattern> {
      const pattern = await requirePattern(patternId);
      const updated: Pattern = { ...pattern, proposalSurfacedAt: now(), updatedAt: now() };
      await writePattern(updated);
      return updated;
    },

    async rebuildCounters(patternId: string, sightings: Sighting[]): Promise<Pattern> {
      const pattern = await requirePattern(patternId);
      const counters = computeCounters(patternId, sightings);

      const updated: Pattern = {
        ...pattern,
        sightingCount: counters.sightingCount,
        entryIds: counters.entryIds,
        lastSightingAt: counters.lastSightingAt,
        updatedAt: now(),
      };
      await writePattern(updated);
      return updated;
    },
  };
}
