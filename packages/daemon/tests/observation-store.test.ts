import { describe, expect, test } from "bun:test";
import { observationId } from "@ink-mirror/shared";
import type { RawObservation } from "@ink-mirror/shared";
import {
  createObservationStore,
  toYaml,
  fromYaml,
  type ObservationStoreFs,
} from "../src/observation-store.js";

function mockFs(): ObservationStoreFs & { files: Record<string, string> } {
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
  };
}

const sampleRaw: RawObservation = {
  pattern: "Uses three consecutive short sentences for emphasis",
  evidence: ["I stopped.", "I turned.", "I left."],
  dimension: "sentence-rhythm",
};

const SAMPLE_PATTERN_ID = "pat-2026-03-27-001";

describe("YAML serialization", () => {
  test("round-trips through toYaml and fromYaml", () => {
    const obs = {
      id: "obs-2026-03-27-001",
      entryId: "entry-2026-03-27-001",
      patternId: SAMPLE_PATTERN_ID,
      pattern: "Uses short sentences for emphasis",
      evidence: ["I stopped. I turned."],
      dimension: "sentence-rhythm" as const,
      createdAt: "2026-03-27T10:00:00.000Z",
      updatedAt: "2026-03-27T10:00:00.000Z",
    };

    const yaml = toYaml(obs);
    const parsed = fromYaml(yaml);

    expect(parsed).toEqual({
      ...obs,
      validationStatus: "verified",
      validationWarnings: [],
      validationDiagnostics: [],
    });
  });

  test("handles multiline patterns", () => {
    const obs = {
      id: "obs-001",
      entryId: "entry-001",
      patternId: SAMPLE_PATTERN_ID,
      pattern: "Line one\nLine two",
      evidence: ["Some evidence"],
      dimension: "word-level-habits" as const,
      createdAt: "2026-03-27T10:00:00Z",
      updatedAt: "2026-03-27T10:00:00Z",
    };

    const yaml = toYaml(obs);
    const parsed = fromYaml(yaml);

    expect(parsed?.pattern).toBe("Line one\nLine two");
  });

  test("round-trips unverified evidence diagnostics", () => {
    const obs = {
      id: "obs-001",
      entryId: "entry-001",
      patternId: SAMPLE_PATTERN_ID,
      pattern: "A pattern",
      evidence: ["Fabricated evidence"],
      dimension: "word-level-habits" as const,
      validationStatus: "unverified" as const,
      validationWarnings: ["evidence-not-found-in-entry" as const],
      validationDiagnostics: [{
        code: "evidence-not-found-in-entry" as const,
        fragment: "Fabricated evidence",
        message: "Cited evidence was not found in the source entry",
      }],
      createdAt: "2026-03-27T10:00:00Z",
      updatedAt: "2026-03-27T10:00:00Z",
    };

    expect(fromYaml(toYaml(obs))).toEqual(obs);
  });

  test("preserves trailing whitespace in evidence fragments", () => {
    const obs = {
      id: "obs-001",
      entryId: "entry-001",
      patternId: SAMPLE_PATTERN_ID,
      pattern: "A pattern",
      evidence: ["first  ", "last\n"],
      dimension: "word-level-habits" as const,
      createdAt: "2026-03-27T10:00:00Z",
      updatedAt: "2026-03-27T10:00:00Z",
    };

    expect(fromYaml(toYaml(obs))?.evidence).toEqual(["first  ", "last\n"]);
  });

  test("returns undefined for invalid YAML", () => {
    expect(fromYaml("just some text")).toBeUndefined();
  });
});

describe("observation store", () => {
  test("saves an observation and assigns sequential ID", async () => {
    const fs = mockFs();
    const store = createObservationStore({
      observationsDir: "/data/observations",
      fs,
      now: () => "2026-03-27T10:00:00.000Z",
    });

    const obs = await store.save("entry-2026-03-27-001", sampleRaw, SAMPLE_PATTERN_ID);

    expect(obs.id).toBe("obs-2026-03-27-001");
    expect(obs.entryId).toBe("entry-2026-03-27-001");
    expect(obs.pattern).toBe(sampleRaw.pattern);
    expect(obs.evidence).toBe(sampleRaw.evidence);
    expect(obs.dimension).toBe("sentence-rhythm");
    expect(obs.createdAt).toBe("2026-03-27T10:00:00.000Z");

    // File was written
    expect(fs.files["/data/observations/obs-2026-03-27-001.yaml"]).toBeDefined();
  });

  test("increments sequence for same date", async () => {
    const fs = mockFs();
    const store = createObservationStore({
      observationsDir: "/data/observations",
      fs,
      now: () => "2026-03-27T10:00:00.000Z",
    });

    const obs1 = await store.save("entry-001", sampleRaw, SAMPLE_PATTERN_ID);
    const obs2 = await store.save("entry-001", sampleRaw, SAMPLE_PATTERN_ID);

    expect(obs1.id).toBe("obs-2026-03-27-001");
    expect(obs2.id).toBe("obs-2026-03-27-002");
  });

  test("lists all observations", async () => {
    const fs = mockFs();
    const store = createObservationStore({
      observationsDir: "/data/observations",
      fs,
      now: () => "2026-03-27T10:00:00.000Z",
    });

    await store.save("entry-001", sampleRaw, SAMPLE_PATTERN_ID);
    await store.save("entry-001", {
      ...sampleRaw,
      dimension: "word-level-habits",
    }, SAMPLE_PATTERN_ID);

    const list = await store.list();
    expect(list).toHaveLength(2);
    expect(list[0].dimension).toBe("sentence-rhythm");
    expect(list[1].dimension).toBe("word-level-habits");
  });

  test("returns empty list when directory doesn't exist", async () => {
    const fs = mockFs();
    const store = createObservationStore({
      observationsDir: "/nonexistent",
      fs,
    });

    const list = await store.list();
    expect(list).toEqual([]);
  });

  test("gets observation by ID", async () => {
    const fs = mockFs();
    const store = createObservationStore({
      observationsDir: "/data/observations",
      fs,
      now: () => "2026-03-27T10:00:00.000Z",
    });

    await store.save("entry-001", sampleRaw, SAMPLE_PATTERN_ID);

    const obs = await store.get(observationId("obs-2026-03-27-001"));
    expect(obs).toBeDefined();
    expect(obs!.pattern).toBe(sampleRaw.pattern);
  });

  test("returns undefined for unknown ID", async () => {
    const fs = mockFs();
    const store = createObservationStore({
      observationsDir: "/data/observations",
      fs,
    });

    const obs = await store.get(observationId("obs-nonexistent"));
    expect(obs).toBeUndefined();
  });

  test("serializes overlapping reflection replacements and preserves the last accepted current set after reload", async () => {
    const fs = mockFs();
    const options = {
      observationsDir: "/data/observations",
      fs,
      now: () => "2026-03-27T10:00:00.000Z",
    };
    const store = createObservationStore(options);

    const prior = await store.save("entry-001", sampleRaw, SAMPLE_PATTERN_ID);
    const firstReflection = await store.save("entry-001", {
      ...sampleRaw,
      pattern: "First overlapping reflection",
    }, SAMPLE_PATTERN_ID);
    const lastReflection = await store.save("entry-001", {
      ...sampleRaw,
      pattern: "Last overlapping reflection",
    }, SAMPLE_PATTERN_ID);

    await Promise.all([
      store.replaceCurrentForEntry?.("entry-001", [firstReflection.id]),
      store.replaceCurrentForEntry?.("entry-001", [lastReflection.id]),
    ]);

    const reloadedStore = createObservationStore(options);
    const reloaded = await reloadedStore.list();
    expect(reloaded.find((observation) => observation.id === prior.id)?.supersededAt).toBeDefined();
    expect(reloaded.find((observation) => observation.id === firstReflection.id)?.supersededAt).toBeDefined();
    expect(reloaded.filter((observation) => !observation.supersededAt).map((observation) => observation.id))
      .toEqual([lastReflection.id]);
  });

  describe("reassignPattern", () => {
    test("rewrites patternId and persists it, confirmed by a re-read", async () => {
      const fs = mockFs();
      const store = createObservationStore({
        observationsDir: "/data/observations",
        fs,
        now: () => "2026-03-27T10:00:00.000Z",
      });

      const obs = await store.save("entry-001", sampleRaw, SAMPLE_PATTERN_ID);
      expect(obs.patternId).toBe(SAMPLE_PATTERN_ID);

      const NEW_PATTERN_ID = "pat-2026-03-27-002";
      const updated = await store.reassignPattern(observationId(obs.id), NEW_PATTERN_ID);
      expect(updated).toBeDefined();
      expect(updated!.patternId).toBe(NEW_PATTERN_ID);

      // Persisted, not just the in-memory return value.
      const reread = await store.get(observationId(obs.id));
      expect(reread).toBeDefined();
      expect(reread!.patternId).toBe(NEW_PATTERN_ID);
      // Everything else about the observation is untouched by the reassignment.
      expect(reread!.pattern).toBe(sampleRaw.pattern);
      expect(reread!.evidence).toEqual(sampleRaw.evidence);
    });

    test("returns undefined (does not throw) for an unknown observation ID", async () => {
      const fs = mockFs();
      const store = createObservationStore({
        observationsDir: "/data/observations",
        fs,
      });

      const result = await store.reassignPattern(observationId("obs-nonexistent"), "pat-2026-03-27-002");
      expect(result).toBeUndefined();
    });
  });
});

// Pre-Phase-3 real deployed instances have observation files with no
// `patternId` field, living in the pre-rename directory (`observations/`,
// before the Phase 3 rename to `sightings/`). These tests use an injected
// in-memory fs with fixture paths, never the real legacy directory, to prove
// `legacyObservationsDir` keeps those files readable until Phase 5's
// migration moves them.
describe("legacy directory fallback (legacyObservationsDir)", () => {
  const LEGACY_ID = "obs-2026-01-01-001";
  // Hand-written, not produced via toYaml, because toYaml always emits a
  // patternId line — this mimics a real pre-Phase-3 file that predates the
  // field entirely.
  const LEGACY_YAML = `id: ${LEGACY_ID}
entryId: entry-2026-01-01-001
dimension: sentence-rhythm
status: pending
createdAt: 2026-01-01T09:00:00.000Z
updatedAt: 2026-01-01T09:00:00.000Z
pattern: |
  Legacy pattern text
evidence: |
  Legacy evidence text
`;

  test("get() falls back to the legacy directory when the ID isn't in the current one", async () => {
    const fs = mockFs();
    fs.files[`/data/observations/${LEGACY_ID}.yaml`] = LEGACY_YAML;

    const store = createObservationStore({
      observationsDir: "/data/sightings",
      legacyObservationsDir: "/data/observations",
      fs,
    });

    const obs = await store.get(observationId(LEGACY_ID));
    expect(obs).toBeDefined();
    expect(obs!.pattern).toBe("Legacy pattern text");
    // No patternId in the source file: falls back to the sentinel rather
    // than failing to parse (Phase 5 migration is what gives it a real one).
    expect(obs!.patternId).toBe("");
  });

  test("get() returns undefined when the ID is in neither directory", async () => {
    const fs = mockFs();
    const store = createObservationStore({
      observationsDir: "/data/sightings",
      legacyObservationsDir: "/data/observations",
      fs,
    });

    const obs = await store.get(observationId("obs-nonexistent"));
    expect(obs).toBeUndefined();
  });

  test("list() merges legacy files with current sightings, current dir winning on ID collision", async () => {
    const fs = mockFs();
    fs.files[`/data/observations/${LEGACY_ID}.yaml`] = LEGACY_YAML;

    const store = createObservationStore({
      observationsDir: "/data/sightings",
      legacyObservationsDir: "/data/observations",
      fs,
      now: () => "2026-07-10T10:00:00.000Z",
    });

    // A genuinely new sighting, written through the store into the new dir.
    await store.save("entry-2026-07-10-001", sampleRaw, SAMPLE_PATTERN_ID);

    const list = await store.list();
    expect(list).toHaveLength(2);

    const legacyEntry = list.find((o) => o.id === LEGACY_ID);
    expect(legacyEntry).toBeDefined();
    expect(legacyEntry!.patternId).toBe("");

    const newEntry = list.find((o) => o.id !== LEGACY_ID);
    expect(newEntry).toBeDefined();
    expect(newEntry!.patternId).toBe(SAMPLE_PATTERN_ID);
  });

  test("omitting legacyObservationsDir leaves legacy files invisible (no silent global fallback)", async () => {
    const fs = mockFs();
    fs.files[`/data/observations/${LEGACY_ID}.yaml`] = LEGACY_YAML;

    const store = createObservationStore({
      observationsDir: "/data/sightings",
      fs,
    });

    expect(await store.get(observationId(LEGACY_ID))).toBeUndefined();
    expect(await store.list()).toEqual([]);
  });
});
