/**
 * Migration: one-time, idempotent upgrade from the pre-Phase-3 storage shape
 * to the pattern-ledger shape (REQ-LPC-27/30). Runs at daemon startup, before
 * the server starts accepting requests (src/index.ts), so every store the
 * rest of the app touches is already in the new shape by the time a request
 * can reach it.
 *
 * This is explicitly called out in the plan as the one irreversible step in
 * the whole longitudinal-pattern-confirmation build: it rewrites `profile.md`
 * and every legacy observation file. Two structural safeguards follow from
 * that:
 *
 *  1. Everything that will be rewritten is copied to `DATA_DIR/backup-<date>/`
 *     before a single byte of the real files changes.
 *  2. The whole run is idempotent: `runMigration` first decides whether there
 *     is anything to do at all (profile still version 1, or any file left in
 *     the legacy observations directory) and returns immediately, with no
 *     backup and no writes, when the answer is no. A second call against
 *     already-migrated state is a true no-op, not a re-derivation that
 *     happens to land on the same values.
 *
 * Two migration paths, independent of each other:
 *  - Profile v1 -> v2 (REQ-LPC-27): every existing rule becomes
 *    `writer-asserted`; a new `intentional` pattern is created from the
 *    rule's own text, flagged `migratedNoHistory: true` (nothing richer is
 *    recoverable from the v1 format â€” REQ-LPC-18's documented exception).
 *  - Legacy observations -> sightings (REQ-LPC-30): every file left in the
 *    pre-Phase-3 `observations/` directory becomes its own new candidate
 *    pattern (1:1, no LLM re-matching â€” that's what curation's merge action
 *    is for afterward) with a first sighting, its old `status` mapped onto
 *    the new pattern's classification, then the file is rewritten into
 *    `sightings/` without the now-removed `status` field.
 *
 * `patternStore.rebuildCounters` runs last, over every pattern in the store,
 * so denormalized counters are correct regardless of which path (or neither)
 * produced them.
 */
import { join } from "node:path";
import { readdir, readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import {
  ObservationDimensionSchema,
  type Observation,
  type ObservationDimension,
  type PatternStatus,
  type ProfileRule,
  type Sighting,
  type WatchItem,
} from "@ink-mirror/shared";
import type { PatternStore } from "./pattern-store.js";
import type { ProfileStore } from "./profile-store.js";
import type { ObservationStore } from "./observation-store.js";
import { toYaml as sightingToYaml } from "./observation-store.js";
import { toSighting } from "./curation.js";

export interface MigrationFs {
  readdir(path: string): Promise<string[]>;
  readFile(path: string, encoding: "utf-8"): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  mkdir(path: string, opts: { recursive: true }): Promise<void>;
  unlink(path: string): Promise<void>;
}

export interface MigrationDeps {
  patternStore: PatternStore;
  profileStore: ProfileStore;
  /**
   * The observation store already wired to `sightingsDir` (and, ideally,
   * `legacyObservationsDir`) â€” reused, after this module finishes moving
   * files, to gather the full up-to-date sighting list for the final
   * rebuildCounters pass (REQ-LPC-1's rebuild seam), rather than
   * reimplementing sighting-file reads here.
   */
  observationStore: ObservationStore;
  /** Raw path to profile.md, read directly for a byte-exact backup copy (profileStore re-serializes on read). */
  profilePath: string;
  /** Pre-Phase-3 directory holding observation files with no `patternId`/with a `status` field. */
  legacyObservationsDir: string;
  /** Phase 3's renamed directory; where migrated legacy files land in their new shape. */
  sightingsDir: string;
  /** Root data directory; backups are written to `<dataDir>/backup-<date>/`. */
  dataDir: string;
  fs?: MigrationFs;
  now?: () => string;
}

export interface MigrationResult {
  /** False when nothing needed migrating (idempotent no-op: no backup, no writes). */
  migrated: boolean;
  profileMigrated: boolean;
  legacyObservationsMigrated: number;
  patternsCreated: number;
  backupDir?: string;
}

const realFs: MigrationFs = {
  readdir: (p) => readdir(p),
  readFile: (p, enc) => readFile(p, enc),
  writeFile: (p, c) => writeFile(p, c, "utf-8"),
  mkdir: (p, o) => mkdir(p, o).then(() => {}),
  unlink: (p) => unlink(p),
};

/**
 * Old CurationStatus -> new PatternStatus (REQ-LPC-30's stored-file half).
 * Every value the old enum ever had (`pending | intentional | accidental |
 * undecided`, packages/shared/src/observations.ts before this phase) is
 * mapped explicitly rather than falling through a default, per the plan's
 * instruction not to leave any legacy value unmapped. `pending` -> `candidate`
 * is the only renamed value; the other three carry straight across since the
 * vocabulary is otherwise unchanged (REQ-LPC-13).
 */
const LEGACY_STATUS_MAP: Record<string, PatternStatus> = {
  pending: "candidate",
  intentional: "intentional",
  accidental: "accidental",
  undecided: "undecided",
};

/**
 * Maps a raw legacy status string to a PatternStatus. A value outside the
 * four known ones (a hand-edited or corrupted file) is not silently dropped
 * or thrown on: it defaults to `candidate`, the least destructive outcome
 * (the pattern lands back in ordinary curation instead of being silently
 * classified either way), and callers log a warning so the anomaly is
 * visible rather than hidden.
 */
function mapLegacyStatus(raw: string): PatternStatus {
  return LEGACY_STATUS_MAP[raw] ?? "candidate";
}

/** One legacy observation file, parsed directly (not via observation-store.ts's fromYaml, which no longer reads `status` at all post-REQ-LPC-30). */
interface LegacyRecord {
  fileName: string;
  id: string;
  entryId: string;
  /** Present only on a file that was already mid-migration (rare/defensive) when the process previously crashed. */
  patternId?: string;
  pattern: string;
  evidence: string;
  dimension: ObservationDimension;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Parses one legacy observation file's raw content. Mirrors the scalar/block
 * extraction in observation-store.ts's fromYaml (same hand-rolled file
 * format), but additionally reads `status` (needed here for the
 * classification mapping) and does not require `patternId` (true legacy
 * files never had one).
 */
function parseLegacyObservation(fileName: string, content: string): LegacyRecord | undefined {
  const scalar = (key: string): string | undefined => {
    const m = content.match(new RegExp(`^${key}:\\s+(.+)$`, "m"));
    return m?.[1]?.trim();
  };

  const block = (key: string): string | undefined => {
    const m = content.match(new RegExp(`^${key}:\\s*\\|\\n((?:  .+\\n?)*)`, "m"));
    if (!m) return undefined;
    return m[1]
      .split("\n")
      .map((l) => l.replace(/^ {2}/, ""))
      .join("\n")
      .trimEnd();
  };

  const id = scalar("id");
  const entryId = scalar("entryId");
  const patternId = scalar("patternId");
  const dimensionRaw = scalar("dimension");
  const status = scalar("status");
  const createdAt = scalar("createdAt");
  const updatedAt = scalar("updatedAt");
  const pattern = block("pattern");
  const evidence = block("evidence");

  if (!id || !entryId || !dimensionRaw || !status || !createdAt || !updatedAt || !pattern || !evidence) {
    return undefined;
  }

  const parsedDimension = ObservationDimensionSchema.safeParse(dimensionRaw);
  if (!parsedDimension.success) return undefined;

  return {
    fileName,
    id,
    entryId,
    patternId: patternId || undefined,
    pattern,
    evidence,
    dimension: parsedDimension.data,
    status,
    createdAt,
    updatedAt,
  };
}

async function listYamlFiles(dir: string, fs: MigrationFs): Promise<string[]> {
  try {
    const files = await fs.readdir(dir);
    return files.filter((f) => f.endsWith(".yaml")).sort();
  } catch {
    return [];
  }
}

async function fileExists(fs: MigrationFs, path: string): Promise<boolean> {
  try {
    await fs.readFile(path, "utf-8");
    return true;
  } catch {
    return false;
  }
}

/**
 * A legacy file's own filename (`obs-YYYY-MM-DD-NNN.yaml`) is not guaranteed
 * unique against `sightingsDir`: the two directories had independent ID
 * sequences (sightingsDir's sequence only ever scanned itself), so a legacy
 * file and a genuinely new sighting created on the same calendar date can
 * collide on filename. Silently overwriting one with the other on move would
 * be exactly the kind of silent, irreversible data loss this migration is
 * supposed to guard against, so a collision gets a suffixed filename instead.
 */
async function uniqueSightingFilename(fs: MigrationFs, dir: string, desired: string): Promise<string> {
  if (!(await fileExists(fs, join(dir, desired)))) return desired;

  let suffix = 1;
  let candidate: string;
  do {
    candidate = desired.replace(/\.yaml$/, `-legacy-${suffix}.yaml`);
    suffix++;
  } while (await fileExists(fs, join(dir, candidate)));
  return candidate;
}

/** Copies profile.md (if it exists) and every legacy observation file into `<dataDir>/backup-<dateStr>/`, before any real write happens. */
async function backupOriginals(opts: {
  fs: MigrationFs;
  dataDir: string;
  dateStr: string;
  profilePath: string;
  legacyObservationsDir: string;
  legacyFileNames: string[];
}): Promise<string> {
  const { fs, dataDir, dateStr, profilePath, legacyObservationsDir, legacyFileNames } = opts;
  const backupPath = join(dataDir, `backup-${dateStr}`);
  await fs.mkdir(backupPath, { recursive: true });

  try {
    const content = await fs.readFile(profilePath, "utf-8");
    await fs.writeFile(join(backupPath, "profile.md"), content);
  } catch {
    // No profile.md on disk yet (fresh install with no rules ever written) — nothing to back up.
  }

  if (legacyFileNames.length > 0) {
    const backupObsDir = join(backupPath, "observations");
    await fs.mkdir(backupObsDir, { recursive: true });
    for (const name of legacyFileNames) {
      const content = await fs.readFile(join(legacyObservationsDir, name), "utf-8");
      await fs.writeFile(join(backupObsDir, name), content);
    }
  }

  return backupPath;
}

/**
 * Migrates every v1 profile rule to a linked, `writer-asserted`,
 * `migratedNoHistory` pattern (REQ-LPC-27). Rewrites the whole profile via
 * `profileStore.save` (not `addOrMergeRule`, which would mint a *new* rule
 * ID) so each rule keeps its original id/createdAt/text and only gains
 * migration metadata.
 *
 * `lastSupportedAt` is stamped to the migration timestamp on every migrated
 * rule: "the staleness clock starts at migration, not at the rule's original
 * creation date" (REQ-LPC-27) is most naturally a statement about *when this
 * rule was last known-good*, which is exactly what lastSupportedAt means
 * elsewhere (reaffirmRule). See this module's top-level doc / the
 * accompanying report for the caveat that substrate.ts's current isStale
 * does not yet consult this field.
 */
async function migrateProfile(
  deps: Pick<MigrationDeps, "patternStore" | "profileStore">,
  rules: ProfileRule[],
  timestamp: string,
): Promise<{ updatedRules: ProfileRule[]; patternsCreated: number }> {
  const { patternStore, profileStore } = deps;
  const updatedRules: ProfileRule[] = [];
  let patternsCreated = 0;

  for (const rule of rules) {
    const pattern = await patternStore.create({
      statement: rule.pattern,
      dimension: rule.dimension,
      migratedNoHistory: true,
    });
    await patternStore.updateStatus(pattern.id, "intentional");
    await patternStore.linkRule(pattern.id, rule.id);
    patternsCreated++;

    updatedRules.push({
      ...rule,
      patternId: pattern.id,
      provenance: "writer-asserted",
      lastSupportedAt: timestamp,
    });
  }

  await profileStore.save({ version: 2, updatedAt: timestamp, rules: updatedRules });
  return { updatedRules, patternsCreated };
}

/**
 * Migrates every legacy observation file into a sighting of its own new
 * candidate pattern (REQ-LPC-2/30), 1:1 â€” no LLM re-matching across legacy
 * files is attempted here; that's what curation's merge action is for
 * afterward if two legacy files turn out to describe the same habit.
 */
async function migrateLegacyObservations(
  deps: Pick<MigrationDeps, "patternStore">,
  fs: MigrationFs,
  legacyObservationsDir: string,
  sightingsDir: string,
  records: LegacyRecord[],
  now: () => string,
): Promise<{ migrated: number; patternsCreated: number }> {
  const { patternStore } = deps;
  let migrated = 0;
  let patternsCreated = 0;

  for (const record of records) {
    let patternId = record.patternId;

    if (!patternId) {
      const pattern = await patternStore.create({
        statement: record.pattern,
        dimension: record.dimension,
      });
      patternId = pattern.id;
      patternsCreated++;

      const mappedStatus = mapLegacyStatus(record.status);
      if (!(record.status in LEGACY_STATUS_MAP)) {
        console.warn(
          `[migration] legacy observation ${record.fileName} has unrecognized status "${record.status}"; defaulting its pattern to candidate`,
        );
      }
      if (mappedStatus !== "candidate") {
        await patternStore.updateStatus(pattern.id, mappedStatus);
      }
      // Accidental patterns start a watch (REQ-LPC-23); no baseline is
      // recorded because these patterns have no metricLink (migration never
      // infers one from raw legacy text) — "no computable link yet for
      // these" per the plan.
      if (mappedStatus === "accidental") {
        const watch: WatchItem = { classifiedAt: now(), resolved: false };
        await patternStore.setWatch(pattern.id, watch);
      }
    }

    const sighting: Sighting = {
      id: record.id,
      patternId,
      entryId: record.entryId,
      evidence: [record.evidence],
      dimension: record.dimension,
      createdAt: record.createdAt,
    };

    const newObs: Observation = {
      id: record.id,
      entryId: record.entryId,
      patternId,
      pattern: record.pattern,
      evidence: [record.evidence],
      dimension: record.dimension,
      validationStatus: "verified",
      validationWarnings: [],
      validationDiagnostics: [],
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };

    const filename = await uniqueSightingFilename(fs, sightingsDir, record.fileName);
    await fs.mkdir(sightingsDir, { recursive: true });
    await fs.writeFile(join(sightingsDir, filename), sightingToYaml(newObs));
    await fs.unlink(join(legacyObservationsDir, record.fileName));

    await patternStore.recordSighting(patternId, sighting);
    migrated++;
  }

  return { migrated, patternsCreated };
}

/**
 * Runs the full migration, idempotently. Safe to call on every daemon
 * startup: it detects whether there is anything left to migrate and returns
 * immediately (no backup, no writes) when there isn't.
 */
export async function runMigration(deps: MigrationDeps): Promise<MigrationResult> {
  const fs = deps.fs ?? realFs;
  const now = deps.now ?? (() => new Date().toISOString());
  const { patternStore, profileStore, observationStore, profilePath, legacyObservationsDir, sightingsDir, dataDir } =
    deps;

  const profile = await profileStore.get();
  const profileNeedsMigration = profile.version === 1;

  const legacyFileNames = await listYamlFiles(legacyObservationsDir, fs);
  const legacyNeedsMigration = legacyFileNames.length > 0;

  if (!profileNeedsMigration && !legacyNeedsMigration) {
    return { migrated: false, profileMigrated: false, legacyObservationsMigrated: 0, patternsCreated: 0 };
  }

  const timestamp = now();
  const dateStr = timestamp.slice(0, 10);
  const backupDir = await backupOriginals({
    fs,
    dataDir,
    dateStr,
    profilePath,
    legacyObservationsDir,
    legacyFileNames,
  });

  let patternsCreated = 0;

  if (profileNeedsMigration) {
    const { patternsCreated: created } = await migrateProfile({ patternStore, profileStore }, profile.rules, timestamp);
    patternsCreated += created;
  }

  const legacyRecords: LegacyRecord[] = [];
  for (const fileName of legacyFileNames) {
    const content = await fs.readFile(join(legacyObservationsDir, fileName), "utf-8");
    const record = parseLegacyObservation(fileName, content);
    if (record) {
      legacyRecords.push(record);
    } else {
      // Malformed/unparseable legacy file: left in place rather than
      // silently dropped. It will surface again (and get retried) on the
      // next startup, and a warning makes the anomaly visible instead of
      // hidden (project lessons-learned: silent failures at integration
      // points are bugs).
      console.warn(`[migration] could not parse legacy observation file ${fileName}; left in place`);
    }
  }

  let legacyObservationsMigrated = 0;
  if (legacyRecords.length > 0) {
    const result = await migrateLegacyObservations(
      { patternStore },
      fs,
      legacyObservationsDir,
      sightingsDir,
      legacyRecords,
      now,
    );
    legacyObservationsMigrated = result.migrated;
    patternsCreated += result.patternsCreated;
  }

  // rebuildCounters runs last, over every pattern currently in the store, so
  // denormalized counters are correct regardless of which path (if any)
  // produced them (REQ-LPC-1's rebuild seam covers both migration paths at
  // once rather than needing separate bookkeeping per path).
  const allPatterns = await patternStore.list();
  const allObservations = await observationStore.list();
  const allSightings = allObservations.map(toSighting);
  for (const pattern of allPatterns) {
    await patternStore.rebuildCounters(pattern.id, allSightings);
  }

  return {
    migrated: true,
    profileMigrated: profileNeedsMigration,
    legacyObservationsMigrated,
    patternsCreated,
    backupDir,
  };
}
