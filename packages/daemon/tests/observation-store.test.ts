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
  evidence: "I stopped. I turned. I left.",
  dimension: "sentence-rhythm",
};

describe("YAML serialization", () => {
  test("round-trips through toYaml and fromYaml", () => {
    const obs = {
      id: "obs-2026-03-27-001",
      entryId: "entry-2026-03-27-001",
      pattern: "Uses short sentences for emphasis",
      evidence: "I stopped. I turned.",
      dimension: "sentence-rhythm" as const,
      status: "pending" as const,
      createdAt: "2026-03-27T10:00:00.000Z",
      updatedAt: "2026-03-27T10:00:00.000Z",
    };

    const yaml = toYaml(obs);
    const parsed = fromYaml(yaml);

    expect(parsed).toEqual(obs);
  });

  test("handles multiline patterns", () => {
    const obs = {
      id: "obs-001",
      entryId: "entry-001",
      pattern: "Line one\nLine two",
      evidence: "Some evidence",
      dimension: "word-level-habits" as const,
      status: "pending" as const,
      createdAt: "2026-03-27T10:00:00Z",
      updatedAt: "2026-03-27T10:00:00Z",
    };

    const yaml = toYaml(obs);
    const parsed = fromYaml(yaml);

    expect(parsed?.pattern).toBe("Line one\nLine two");
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

    const obs = await store.save("entry-2026-03-27-001", sampleRaw);

    expect(obs.id).toBe("obs-2026-03-27-001");
    expect(obs.entryId).toBe("entry-2026-03-27-001");
    expect(obs.pattern).toBe(sampleRaw.pattern);
    expect(obs.evidence).toBe(sampleRaw.evidence);
    expect(obs.dimension).toBe("sentence-rhythm");
    expect(obs.status).toBe("pending");
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

    const obs1 = await store.save("entry-001", sampleRaw);
    const obs2 = await store.save("entry-001", sampleRaw);

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

    await store.save("entry-001", sampleRaw);
    await store.save("entry-001", {
      ...sampleRaw,
      dimension: "word-level-habits",
    });

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

    await store.save("entry-001", sampleRaw);

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

  test("updates curation status", async () => {
    const fs = mockFs();
    const store = createObservationStore({
      observationsDir: "/data/observations",
      fs,
      now: () => "2026-03-27T10:00:00.000Z",
    });

    await store.save("entry-001", sampleRaw);

    const updated = await store.updateStatus(
      observationId("obs-2026-03-27-001"),
      "intentional",
    );

    expect(updated).toBeDefined();
    expect(updated!.status).toBe("intentional");
    expect(updated!.updatedAt).toBe("2026-03-27T10:00:00.000Z");

    // Verify persistence
    const reread = await store.get(observationId("obs-2026-03-27-001"));
    expect(reread!.status).toBe("intentional");
  });

  test("updateStatus returns undefined for unknown ID", async () => {
    const fs = mockFs();
    const store = createObservationStore({
      observationsDir: "/data/observations",
      fs,
    });

    const result = await store.updateStatus(
      observationId("obs-nonexistent"),
      "intentional",
    );
    expect(result).toBeUndefined();
  });
});
