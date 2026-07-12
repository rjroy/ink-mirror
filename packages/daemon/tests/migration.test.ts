import { describe, expect, test } from "bun:test";
import type { Profile } from "@ink-mirror/shared";
import { runMigration, type MigrationFs } from "../src/migration.js";
import { createPatternStore } from "../src/pattern-store.js";
import { createProfileStore, profileToMarkdown } from "../src/profile-store.js";
import { createObservationStore } from "../src/observation-store.js";

/**
 * Migration tests use ONLY an in-memory mock filesystem, never the real
 * data path (~/.local/state/ink-mirror or similar) — migration is the one
 * irreversible step in the whole longitudinal-pattern-confirmation plan, and
 * these fixtures must never touch a real deployed instance's data.
 */

const DATA_DIR = "/data";
const PROFILE_PATH = "/data/profile.md";
const LEGACY_OBSERVATIONS_DIR = "/data/observations";
const SIGHTINGS_DIR = "/data/sightings";
const PATTERNS_DIR = "/data/patterns";

function mockFs(): MigrationFs & { files: Record<string, string> } {
  const files: Record<string, string> = {};

  return {
    files,
    async readdir(path: string): Promise<string[]> {
      const prefix = path.endsWith("/") ? path : path + "/";
      return Object.keys(files)
        .filter((f) => f.startsWith(prefix))
        .map((f) => f.slice(prefix.length))
        .filter((f) => !f.includes("/"));
    },
    async readFile(path: string): Promise<string> {
      if (!(path in files)) throw new Error(`ENOENT: ${path}`);
      return files[path];
    },
    async writeFile(path: string, content: string): Promise<void> {
      files[path] = content;
    },
    async mkdir(): Promise<void> {},
    async unlink(path: string): Promise<void> {
      if (!(path in files)) throw new Error(`ENOENT: ${path}`);
      delete files[path];
    },
  };
}

function makeStores(fs: MigrationFs, now: () => string) {
  const patternStore = createPatternStore({ patternsDir: PATTERNS_DIR, fs, now });
  const profileStore = createProfileStore({ profilePath: PROFILE_PATH, fs, now });
  const observationStore = createObservationStore({
    observationsDir: SIGHTINGS_DIR,
    legacyObservationsDir: LEGACY_OBSERVATIONS_DIR,
    fs,
    now,
  });
  return { patternStore, profileStore, observationStore };
}

function migrationDeps(fs: MigrationFs, now: () => string) {
  const stores = makeStores(fs, now);
  return {
    ...stores,
    profilePath: PROFILE_PATH,
    legacyObservationsDir: LEGACY_OBSERVATIONS_DIR,
    sightingsDir: SIGHTINGS_DIR,
    dataDir: DATA_DIR,
    fs,
    now,
  };
}

/** A hand-written pre-Phase-3 observation file: no patternId, has status. Mirrors observation-store.ts's toYaml shape from before the rename/field removal. */
function legacyYaml(opts: {
  id: string;
  entryId: string;
  pattern: string;
  evidence: string;
  dimension: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}): string {
  return [
    `id: ${opts.id}`,
    `entryId: ${opts.entryId}`,
    `dimension: ${opts.dimension}`,
    `status: ${opts.status}`,
    `createdAt: ${opts.createdAt}`,
    `updatedAt: ${opts.updatedAt}`,
    `pattern: |`,
    `  ${opts.pattern}`,
    `evidence: |`,
    `  ${opts.evidence}`,
    "",
  ].join("\n");
}

const V1_PROFILE: Profile = {
  version: 1,
  updatedAt: "2026-01-01T00:00:00.000Z",
  rules: [
    {
      id: "rule-sentence-rhythm-001",
      pattern: "Uses staccato rhythm for emphasis at paragraph endings",
      dimension: "sentence-rhythm",
      sourceCount: 3,
      sourceSummary: "Confirmed across 3 entries",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "rule-word-level-habits-001",
      pattern: "Relies on hedging words ('just', 'probably') in technical writing",
      dimension: "word-level-habits",
      sourceCount: 2,
      sourceSummary: "Confirmed across 2 entries",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
};

describe("migration: profile v1 -> v2 (REQ-LPC-27)", () => {
  test("migrates each rule's text unchanged, marks writer-asserted, creates an intentional migratedNoHistory pattern, and bumps the profile to version 2", async () => {
    const fs = mockFs();
    fs.files[PROFILE_PATH] = profileToMarkdown(V1_PROFILE);
    const now = () => "2026-07-10T12:00:00.000Z";
    const deps = migrationDeps(fs, now);

    const result = await runMigration(deps);

    expect(result.migrated).toBe(true);
    expect(result.profileMigrated).toBe(true);
    expect(result.patternsCreated).toBe(2);

    const profile = await deps.profileStore.get();
    expect(profile.version).toBe(2);
    expect(profile.rules).toHaveLength(2);

    for (const [original, migrated] of [
      [V1_PROFILE.rules[0], profile.rules.find((r) => r.id === "rule-sentence-rhythm-001")],
      [V1_PROFILE.rules[1], profile.rules.find((r) => r.id === "rule-word-level-habits-001")],
    ] as const) {
      expect(migrated).toBeDefined();
      // Text unchanged.
      expect(migrated!.pattern).toBe(original.pattern);
      expect(migrated!.id).toBe(original.id);
      expect(migrated!.createdAt).toBe(original.createdAt);
      expect(migrated!.provenance).toBe("writer-asserted");
      expect(migrated!.patternId).toBeDefined();
      expect(migrated!.lastSupportedAt).toBe(now());
    }

    const patterns = await deps.patternStore.list();
    expect(patterns).toHaveLength(2);
    for (const pattern of patterns) {
      expect(pattern.status).toBe("intentional");
      expect(pattern.migratedNoHistory).toBe(true);
      expect(pattern.sightingCount).toBe(0);
      expect(pattern.entryIds).toEqual([]);
      expect(pattern.ruleId).toBeDefined();
    }

    // Pattern <-> rule link is bidirectional (REQ-LPC-18).
    const rhythmPattern = patterns.find((p) => p.statement === V1_PROFILE.rules[0].pattern);
    const rhythmRule = profile.rules.find((r) => r.id === "rule-sentence-rhythm-001");
    expect(rhythmPattern?.ruleId).toBe(rhythmRule?.id);
    expect(rhythmRule?.patternId).toBe(rhythmPattern?.id);
  });

  test("empty v1 profile (cold start, zero rules) migrates to an empty version-2 profile", async () => {
    const fs = mockFs();
    fs.files[PROFILE_PATH] = profileToMarkdown({ version: 1, updatedAt: "2026-01-01T00:00:00.000Z", rules: [] });
    const deps = migrationDeps(fs, () => "2026-07-10T12:00:00.000Z");

    const result = await runMigration(deps);

    expect(result.migrated).toBe(true);
    expect(result.profileMigrated).toBe(true);
    expect(result.patternsCreated).toBe(0);

    const profile = await deps.profileStore.get();
    expect(profile.version).toBe(2);
    expect(profile.rules).toEqual([]);
  });

  test("no profile.md on disk at all still migrates cleanly to an empty version-2 profile", async () => {
    const fs = mockFs();
    // profile.md deliberately absent.
    const deps = migrationDeps(fs, () => "2026-07-10T12:00:00.000Z");

    const result = await runMigration(deps);

    expect(result.migrated).toBe(true);
    expect(result.profileMigrated).toBe(true);

    const profile = await deps.profileStore.get();
    expect(profile.version).toBe(2);
  });
});

describe("migration: legacy observations -> sightings (REQ-LPC-30)", () => {
  function seedLegacyFiles(fs: ReturnType<typeof mockFs>) {
    fs.files[`${LEGACY_OBSERVATIONS_DIR}/obs-2026-01-01-001.yaml`] = legacyYaml({
      id: "obs-2026-01-01-001",
      entryId: "entry-2026-01-01-001",
      pattern: "Uses short declarative sentences for emphasis",
      evidence: "I stopped. I turned.",
      dimension: "sentence-rhythm",
      status: "pending",
      createdAt: "2026-01-01T09:00:00.000Z",
      updatedAt: "2026-01-01T09:00:00.000Z",
    });
    fs.files[`${LEGACY_OBSERVATIONS_DIR}/obs-2026-01-02-001.yaml`] = legacyYaml({
      id: "obs-2026-01-02-001",
      entryId: "entry-2026-01-02-001",
      pattern: "Hedges with 'just' before admitting a reaction",
      evidence: "I just felt a little off.",
      dimension: "word-level-habits",
      status: "intentional",
      createdAt: "2026-01-02T09:00:00.000Z",
      updatedAt: "2026-01-02T09:00:00.000Z",
    });
    fs.files[`${LEGACY_OBSERVATIONS_DIR}/obs-2026-01-03-001.yaml`] = legacyYaml({
      id: "obs-2026-01-03-001",
      entryId: "entry-2026-01-03-001",
      pattern: "Opens paragraphs with a weather reference",
      evidence: "It was raining again.",
      dimension: "paragraph-structure",
      status: "accidental",
      createdAt: "2026-01-03T09:00:00.000Z",
      updatedAt: "2026-01-03T09:00:00.000Z",
    });
    fs.files[`${LEGACY_OBSERVATIONS_DIR}/obs-2026-01-04-001.yaml`] = legacyYaml({
      id: "obs-2026-01-04-001",
      entryId: "entry-2026-01-04-001",
      pattern: "Uses semicolons to join related independent clauses",
      evidence: "I left; I did not look back.",
      dimension: "sentence-structure",
      status: "undecided",
      createdAt: "2026-01-04T09:00:00.000Z",
      updatedAt: "2026-01-04T09:00:00.000Z",
    });
  }

  test("each legacy file becomes its own candidate pattern with a first sighting, status mapped explicitly", async () => {
    const fs = mockFs();
    seedLegacyFiles(fs);
    const now = () => "2026-07-10T12:00:00.000Z";
    const deps = migrationDeps(fs, now);

    const result = await runMigration(deps);

    expect(result.migrated).toBe(true);
    expect(result.legacyObservationsMigrated).toBe(4);
    expect(result.patternsCreated).toBe(4);

    const patterns = await deps.patternStore.list();
    expect(patterns).toHaveLength(4);

    const byStatement = new Map(patterns.map((p) => [p.statement, p]));

    // pending -> candidate
    const pending = byStatement.get("Uses short declarative sentences for emphasis");
    expect(pending?.status).toBe("candidate");
    expect(pending?.sightingCount).toBe(1);
    expect(pending?.entryIds).toEqual(["entry-2026-01-01-001"]);
    expect(pending?.migratedNoHistory).toBeUndefined();

    // intentional -> intentional
    const intentional = byStatement.get("Hedges with 'just' before admitting a reaction");
    expect(intentional?.status).toBe("intentional");

    // undecided -> undecided
    const undecided = byStatement.get("Uses semicolons to join related independent clauses");
    expect(undecided?.status).toBe("undecided");

    // accidental -> accidental, with a watch started and no baseline
    // (REQ-LPC-23: "no computable link yet for these").
    const accidental = byStatement.get("Opens paragraphs with a weather reference");
    expect(accidental?.status).toBe("accidental");
    expect(accidental?.watch).toBeDefined();
    expect(accidental?.watch?.classifiedAt).toBe(now());
    expect(accidental?.watch?.resolved).toBe(false);
    expect(accidental?.watch?.baseline).toBeUndefined();
  });

  test("moves legacy files into sightings/ in the current (status-free) shape and removes them from observations/", async () => {
    const fs = mockFs();
    seedLegacyFiles(fs);
    const deps = migrationDeps(fs, () => "2026-07-10T12:00:00.000Z");

    await runMigration(deps);

    const remainingLegacy = Object.keys(fs.files).filter((f) => f.startsWith(`${LEGACY_OBSERVATIONS_DIR}/`));
    expect(remainingLegacy).toEqual([]);

    const movedFile = fs.files[`${SIGHTINGS_DIR}/obs-2026-01-01-001.yaml`];
    expect(movedFile).toBeDefined();
    expect(movedFile).not.toContain("status:");
    expect(movedFile).toContain("patternId:");

    const sightings = await deps.observationStore.list();
    expect(sightings).toHaveLength(4);
    for (const sighting of sightings) {
      expect(sighting.patternId).not.toBe("");
    }
  });

  test("a filename collision between a legacy file and an existing sighting is not silently overwritten", async () => {
    const fs = mockFs();
    // A genuinely new, current-shape sighting already occupies the filename
    // a legacy file (from before the sightings/ rename) would also produce.
    fs.files[`${SIGHTINGS_DIR}/obs-2026-01-01-001.yaml`] = [
      `id: obs-2026-01-01-001`,
      `entryId: entry-modern-001`,
      `patternId: pat-2026-01-01-001`,
      `dimension: sentence-rhythm`,
      `createdAt: 2026-01-01T09:00:00.000Z`,
      `updatedAt: 2026-01-01T09:00:00.000Z`,
      `pattern: |`,
      `  Modern sighting, unrelated to the legacy file below`,
      `evidence: |`,
      `  Some modern evidence`,
      "",
    ].join("\n");

    fs.files[`${LEGACY_OBSERVATIONS_DIR}/obs-2026-01-01-001.yaml`] = legacyYaml({
      id: "obs-2026-01-01-001",
      entryId: "entry-legacy-001",
      pattern: "Legacy pattern text",
      evidence: "Legacy evidence text",
      dimension: "sentence-rhythm",
      status: "pending",
      createdAt: "2026-01-01T08:00:00.000Z",
      updatedAt: "2026-01-01T08:00:00.000Z",
    });

    const deps = migrationDeps(fs, () => "2026-07-10T12:00:00.000Z");
    await runMigration(deps);

    // The modern sighting must survive untouched.
    const modern = fs.files[`${SIGHTINGS_DIR}/obs-2026-01-01-001.yaml`];
    expect(modern).toContain("Modern sighting, unrelated to the legacy file below");

    // The legacy file must have been written under a different name, not lost.
    const allSightingFiles = Object.keys(fs.files).filter((f) => f.startsWith(`${SIGHTINGS_DIR}/`));
    expect(allSightingFiles).toHaveLength(2);
    const legacyMoved = allSightingFiles.find((f) => f !== `${SIGHTINGS_DIR}/obs-2026-01-01-001.yaml`);
    expect(legacyMoved).toBeDefined();
    expect(fs.files[legacyMoved!]).toContain("Legacy pattern text");
  });
});

describe("migration: backup (irreversible-step safeguard)", () => {
  test("copies profile.md and every legacy observation file to backup-<date>/ before any rewrite", async () => {
    const fs = mockFs();
    const originalProfileMd = profileToMarkdown(V1_PROFILE);
    fs.files[PROFILE_PATH] = originalProfileMd;

    const originalLegacy = legacyYaml({
      id: "obs-2026-01-01-001",
      entryId: "entry-2026-01-01-001",
      pattern: "Uses short declarative sentences for emphasis",
      evidence: "I stopped. I turned.",
      dimension: "sentence-rhythm",
      status: "pending",
      createdAt: "2026-01-01T09:00:00.000Z",
      updatedAt: "2026-01-01T09:00:00.000Z",
    });
    fs.files[`${LEGACY_OBSERVATIONS_DIR}/obs-2026-01-01-001.yaml`] = originalLegacy;

    const deps = migrationDeps(fs, () => "2026-07-10T12:00:00.000Z");
    const result = await runMigration(deps);

    expect(result.backupDir).toBe(`${DATA_DIR}/backup-2026-07-10`);
    expect(fs.files[`${DATA_DIR}/backup-2026-07-10/profile.md`]).toBe(originalProfileMd);
    expect(fs.files[`${DATA_DIR}/backup-2026-07-10/observations/obs-2026-01-01-001.yaml`]).toBe(originalLegacy);
  });

  test("skips backing up profile.md when no profile.md exists on disk yet", async () => {
    const fs = mockFs();
    fs.files[`${LEGACY_OBSERVATIONS_DIR}/obs-2026-01-01-001.yaml`] = legacyYaml({
      id: "obs-2026-01-01-001",
      entryId: "entry-2026-01-01-001",
      pattern: "Pattern text",
      evidence: "Evidence text",
      dimension: "sentence-rhythm",
      status: "pending",
      createdAt: "2026-01-01T09:00:00.000Z",
      updatedAt: "2026-01-01T09:00:00.000Z",
    });

    const deps = migrationDeps(fs, () => "2026-07-10T12:00:00.000Z");
    const result = await runMigration(deps);

    expect(result.backupDir).toBeDefined();
    expect(fs.files[`${result.backupDir}/profile.md`]).toBeUndefined();
  });
});

describe("migration: idempotency", () => {
  test("a second run against already-migrated state is a true no-op", async () => {
    const fs = mockFs();
    fs.files[PROFILE_PATH] = profileToMarkdown(V1_PROFILE);
    fs.files[`${LEGACY_OBSERVATIONS_DIR}/obs-2026-01-01-001.yaml`] = legacyYaml({
      id: "obs-2026-01-01-001",
      entryId: "entry-2026-01-01-001",
      pattern: "Uses short declarative sentences for emphasis",
      evidence: "I stopped. I turned.",
      dimension: "sentence-rhythm",
      status: "accidental",
      createdAt: "2026-01-01T09:00:00.000Z",
      updatedAt: "2026-01-01T09:00:00.000Z",
    });

    let day = "2026-07-10T12:00:00.000Z";
    const now = () => day;
    const deps = migrationDeps(fs, now);

    const first = await runMigration(deps);
    expect(first.migrated).toBe(true);

    const patternsAfterFirst = await deps.patternStore.list();
    const profileAfterFirst = fs.files[PROFILE_PATH];
    const fileCountAfterFirst = Object.keys(fs.files).length;

    // Advance the clock, as a real second startup (a later day) would see.
    day = "2026-07-11T09:00:00.000Z";

    const second = await runMigration(deps);
    expect(second.migrated).toBe(false);
    expect(second.profileMigrated).toBe(false);
    expect(second.legacyObservationsMigrated).toBe(0);
    expect(second.patternsCreated).toBe(0);
    expect(second.backupDir).toBeUndefined();

    const patternsAfterSecond = await deps.patternStore.list();
    expect(patternsAfterSecond).toHaveLength(patternsAfterFirst.length);
    expect(patternsAfterSecond).toEqual(patternsAfterFirst);
    expect(fs.files[PROFILE_PATH]).toBe(profileAfterFirst);
    // No new backup directory, no duplicated pattern files: file count is unchanged.
    expect(Object.keys(fs.files).length).toBe(fileCountAfterFirst);
  });
});

describe("migration: rebuildCounters covers both paths at once", () => {
  test("final counters are correct whether a pattern came from a v1 rule or a legacy observation", async () => {
    const fs = mockFs();
    fs.files[PROFILE_PATH] = profileToMarkdown(V1_PROFILE);
    fs.files[`${LEGACY_OBSERVATIONS_DIR}/obs-2026-01-01-001.yaml`] = legacyYaml({
      id: "obs-2026-01-01-001",
      entryId: "entry-2026-01-01-001",
      pattern: "Uses short declarative sentences for emphasis",
      evidence: "I stopped. I turned.",
      dimension: "sentence-rhythm",
      status: "pending",
      createdAt: "2026-01-01T09:00:00.000Z",
      updatedAt: "2026-01-01T09:00:00.000Z",
    });
    // A second sighting of the *same* legacy-derived habit is not attempted
    // here (migration does 1:1, no re-matching) — instead this adds a second
    // legacy file for the same dimension to confirm rebuildCounters doesn't
    // conflate the two independently-created patterns' counters.
    fs.files[`${LEGACY_OBSERVATIONS_DIR}/obs-2026-01-02-001.yaml`] = legacyYaml({
      id: "obs-2026-01-02-001",
      entryId: "entry-2026-01-02-001",
      pattern: "Uses short declarative sentences for emphasis",
      evidence: "I left. I did not look back.",
      dimension: "sentence-rhythm",
      status: "pending",
      createdAt: "2026-01-02T09:00:00.000Z",
      updatedAt: "2026-01-02T09:00:00.000Z",
    });

    const deps = migrationDeps(fs, () => "2026-07-10T12:00:00.000Z");
    const result = await runMigration(deps);

    expect(result.patternsCreated).toBe(4); // 2 rule-derived + 2 observation-derived

    const patterns = await deps.patternStore.list();
    expect(patterns).toHaveLength(4);

    const ruleDerivedPatterns = patterns.filter((p) => p.migratedNoHistory);
    expect(ruleDerivedPatterns).toHaveLength(2);
    for (const p of ruleDerivedPatterns) {
      expect(p.sightingCount).toBe(0);
      expect(p.entryIds).toEqual([]);
    }

    const obsDerivedPatterns = patterns.filter((p) => !p.migratedNoHistory);
    expect(obsDerivedPatterns).toHaveLength(2);
    for (const p of obsDerivedPatterns) {
      expect(p.sightingCount).toBe(1);
      expect(p.entryIds).toHaveLength(1);
    }

    const allSightings = await deps.observationStore.list();
    expect(allSightings).toHaveLength(2);
  });
});
