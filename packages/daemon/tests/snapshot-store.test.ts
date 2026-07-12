import { describe, expect, test } from "bun:test";
import * as YAML from "yaml";
import type { MetricSnapshot } from "@ink-mirror/shared";
import {
  createSnapshotStore,
  toYaml,
  fromYaml,
  type SnapshotStoreFs,
} from "../src/snapshot-store.js";
import { computeEntryMetrics } from "../src/metrics/index.js";

interface MockFs extends SnapshotStoreFs {
  files: Record<string, string>;
  mkdirCalls: string[];
}

function mockFs(): MockFs {
  const files: Record<string, string> = {};
  const mkdirCalls: string[] = [];

  return {
    files,
    mkdirCalls,
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
    async mkdir(path: string): Promise<void> {
      mkdirCalls.push(path);
    },
  };
}

const sampleSnapshot: MetricSnapshot = {
  entryId: "entry-2026-07-09-001",
  date: "2026-07-09T10:00:00.000Z",
  metrics: computeEntryMetrics("I stopped. I turned. I left."),
  schemaVersion: 1,
};

describe("YAML serialization", () => {
  test("round-trips a full snapshot including nested arrays and maps", () => {
    const yaml = toYaml(sampleSnapshot);
    const parsed = fromYaml(yaml);
    expect(parsed).toEqual(sampleSnapshot);
  });

  test("produces genuine YAML, not JSON-in-a-.yaml-file", () => {
    const yaml = toYaml(sampleSnapshot);
    // A JSON-in-yaml workaround would open with `{` and quote every key.
    // Idiomatic YAML uses bare block-mapping keys and indentation instead.
    expect(yaml.trimStart().startsWith("{")).toBe(false);
    expect(yaml).toContain("entryId: entry-2026-07-09-001");
    expect(yaml).toContain("schemaVersion: 1");
  });

  test("fromYaml returns undefined on malformed content", () => {
    expect(fromYaml("this is not json at all")).toBeUndefined();
    expect(fromYaml("")).toBeUndefined();
  });

  test("fromYaml returns undefined when the parsed content fails schema validation", () => {
    const broken = YAML.stringify({ entryId: "entry-1" }); // missing required fields
    expect(fromYaml(broken)).toBeUndefined();
  });

  test("fromYaml rejects a schema version other than 1", () => {
    const badVersion = YAML.stringify({ ...sampleSnapshot, schemaVersion: 2 });
    expect(fromYaml(badVersion)).toBeUndefined();
  });

  test("running toYaml twice on the same snapshot is byte-identical", () => {
    expect(toYaml(sampleSnapshot)).toBe(toYaml(sampleSnapshot));
  });
});

describe("snapshot store", () => {
  test("save then get round-trips a full snapshot", async () => {
    const fs = mockFs();
    const store = createSnapshotStore({ snapshotsDir: "/data/snapshots", fs });

    await store.save(sampleSnapshot.entryId, sampleSnapshot);
    const loaded = await store.get(sampleSnapshot.entryId);

    expect(loaded).toEqual(sampleSnapshot);
    expect(fs.files[`/data/snapshots/${sampleSnapshot.entryId}.yaml`]).toBeDefined();
  });

  test("get returns undefined when no file exists for the entry", async () => {
    const fs = mockFs();
    const store = createSnapshotStore({ snapshotsDir: "/data/snapshots", fs });

    const loaded = await store.get("entry-does-not-exist");
    expect(loaded).toBeUndefined();
  });

  test("save creates the snapshots directory if missing", async () => {
    const fs = mockFs();
    const store = createSnapshotStore({ snapshotsDir: "/data/snapshots", fs });

    await store.save(sampleSnapshot.entryId, sampleSnapshot);

    expect(fs.mkdirCalls).toContain("/data/snapshots");
  });

  test("multiple saves for the same entry overwrite without history", async () => {
    const fs = mockFs();
    const store = createSnapshotStore({ snapshotsDir: "/data/snapshots", fs });

    await store.save(sampleSnapshot.entryId, sampleSnapshot);

    const updated: MetricSnapshot = {
      ...sampleSnapshot,
      metrics: computeEntryMetrics("A completely different entry with new words."),
    };
    await store.save(updated.entryId, updated);

    const loaded = await store.get(updated.entryId);
    expect(loaded).toEqual(updated);

    const fileKeys = Object.keys(fs.files).filter((k) => k.includes(updated.entryId));
    expect(fileKeys).toHaveLength(1);
  });

  test("get returns undefined when the on-disk file is malformed", async () => {
    const fs = mockFs();
    fs.files[`/data/snapshots/${sampleSnapshot.entryId}.yaml`] = "not a valid snapshot";
    const store = createSnapshotStore({ snapshotsDir: "/data/snapshots", fs });

    const loaded = await store.get(sampleSnapshot.entryId);
    expect(loaded).toBeUndefined();
  });

  test("listAll returns an empty array when the directory doesn't exist", async () => {
    const fs = mockFs();
    const store = createSnapshotStore({ snapshotsDir: "/data/snapshots", fs });

    expect(await store.listAll()).toEqual([]);
  });

  test("listAll returns snapshots ordered oldest-to-newest by date", async () => {
    const fs = mockFs();
    const store = createSnapshotStore({ snapshotsDir: "/data/snapshots", fs });

    const snapshots: MetricSnapshot[] = [
      { ...sampleSnapshot, entryId: "entry-c", date: "2026-01-03T00:00:00.000Z" },
      { ...sampleSnapshot, entryId: "entry-a", date: "2026-01-01T00:00:00.000Z" },
      { ...sampleSnapshot, entryId: "entry-b", date: "2026-01-02T00:00:00.000Z" },
    ];
    for (const s of snapshots) await store.save(s.entryId, s);

    const all = await store.listAll();
    expect(all.map((s) => s.entryId)).toEqual(["entry-a", "entry-b", "entry-c"]);
  });

  test("listAll skips malformed files instead of throwing", async () => {
    const fs = mockFs();
    const store = createSnapshotStore({ snapshotsDir: "/data/snapshots", fs });

    await store.save(sampleSnapshot.entryId, sampleSnapshot);
    fs.files["/data/snapshots/garbage.yaml"] = "not a valid snapshot";

    const all = await store.listAll();
    expect(all).toHaveLength(1);
    expect(all[0].entryId).toBe(sampleSnapshot.entryId);
  });
});
