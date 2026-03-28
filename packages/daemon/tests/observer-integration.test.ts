import { describe, expect, test } from "bun:test";
import { createApp } from "../src/app.js";
import { createEntryStore, type EntryStoreFs } from "../src/entry-store.js";
import { createObservationStore, type ObservationStoreFs } from "../src/observation-store.js";
import { createSessionRunner } from "../src/session-runner.js";
import { observe } from "../src/observer.js";
import { computeEntryMetrics } from "../src/metrics/index.js";
import { createEntryRoutes } from "../src/routes/entries.js";

/**
 * In-memory filesystem shared between entry and observation stores.
 */
function mockFs(): EntryStoreFs & ObservationStoreFs & { files: Record<string, string> } {
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
    async exists(path: string): Promise<boolean> {
      return path in files;
    },
  };
}

const SAMPLE_ENTRY =
  "I stopped. I turned. I left. The door closed behind me. I probably should have stayed longer, but I just couldn't take it anymore.";

const MOCK_OBSERVER_OUTPUT = JSON.stringify({
  observations: [
    {
      pattern: "Three consecutive short declarative sentences",
      evidence: "I stopped. I turned. I left.",
      dimension: "sentence-rhythm",
    },
    {
      pattern: 'Hedging with "just" and "probably"',
      evidence: "I probably should have stayed longer, but I just couldn't take it anymore.",
      dimension: "word-level-habits",
    },
  ],
});

const THREE_DIM_OBSERVER_OUTPUT = JSON.stringify({
  observations: [
    {
      pattern: "Three consecutive short declarative sentences",
      evidence: "I stopped. I turned. I left.",
      dimension: "sentence-rhythm",
    },
    {
      pattern: 'Hedging with "just" and "probably"',
      evidence: "I probably should have stayed longer, but I just couldn't take it anymore.",
      dimension: "word-level-habits",
    },
    {
      pattern: "Consistent 'I + past tense' paragraph opener pattern",
      evidence: "I stopped.",
      dimension: "sentence-structure",
    },
  ],
});

describe("observer integration: entry submission triggers observations", () => {
  test("POST /entries returns entry with observations (mocked LLM)", async () => {
    const fs = mockFs();

    const entryStore = createEntryStore({
      entriesDir: "/data/entries",
      fs,
      now: () => "2026-03-27",
    });

    const observationStore = createObservationStore({
      observationsDir: "/data/observations",
      fs,
      now: () => "2026-03-27T10:00:00.000Z",
    });

    const sessionRunner = createSessionRunner({
      queryFn: async () => ({ content: MOCK_OBSERVER_OUTPUT }),
    });

    const onEntryCreated = (entryId: string, entryText: string) =>
      observe(
        {
          sessionRunner,
          observationStore,
          computeMetrics: computeEntryMetrics,
        },
        entryId,
        entryText,
      );

    const entryRoutes = createEntryRoutes({ entryStore, onEntryCreated });
    const { hono } = createApp({ routeModules: [entryRoutes] });

    const res = await hono.request(
      new Request("http://localhost/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: SAMPLE_ENTRY }),
      }),
    );

    expect(res.status).toBe(201);
    const json = await res.json();

    // Entry was created
    expect(json.id).toMatch(/^entry-/);
    expect(json.body).toBe(SAMPLE_ENTRY);

    // Observations were returned inline
    expect(json.observations).toHaveLength(2);
    expect(json.observations[0].pattern).toBe(
      "Three consecutive short declarative sentences",
    );
    expect(json.observations[0].status).toBe("pending");
    expect(json.observations[0].dimension).toBe("sentence-rhythm");
    expect(json.observations[1].dimension).toBe("word-level-habits");

    // Observations were persisted to filesystem
    const obsFiles = Object.keys(fs.files).filter((f) =>
      f.includes("observations"),
    );
    expect(obsFiles).toHaveLength(2);
  });

  test("entry creation succeeds even when observer fails", async () => {
    const fs = mockFs();

    const entryStore = createEntryStore({
      entriesDir: "/data/entries",
      fs,
      now: () => "2026-03-27",
    });

    const entryRoutes = createEntryRoutes({
      entryStore,
      onEntryCreated: async () => {
        throw new Error("LLM unavailable");
      },
    });

    const { hono } = createApp({ routeModules: [entryRoutes] });

    const res = await hono.request(
      new Request("http://localhost/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: SAMPLE_ENTRY }),
      }),
    );

    // Entry still created successfully
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toMatch(/^entry-/);
    expect(json.observations).toBeUndefined();
  });

  test("POST /entries supports all three observation dimensions (REQ-V1-10)", async () => {
    const fs = mockFs();

    const entryStore = createEntryStore({
      entriesDir: "/data/entries",
      fs,
      now: () => "2026-03-27",
    });

    const observationStore = createObservationStore({
      observationsDir: "/data/observations",
      fs,
      now: () => "2026-03-27T10:00:00.000Z",
    });

    const sessionRunner = createSessionRunner({
      queryFn: async () => ({ content: THREE_DIM_OBSERVER_OUTPUT }),
    });

    const onEntryCreated = (entryId: string, entryText: string) =>
      observe(
        {
          sessionRunner,
          observationStore,
          computeMetrics: computeEntryMetrics,
        },
        entryId,
        entryText,
      );

    const entryRoutes = createEntryRoutes({ entryStore, onEntryCreated });
    const { hono } = createApp({ routeModules: [entryRoutes] });

    const res = await hono.request(
      new Request("http://localhost/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: SAMPLE_ENTRY }),
      }),
    );

    expect(res.status).toBe(201);
    const json = await res.json();

    // All three dimensions present
    expect(json.observations).toHaveLength(3);
    const dimensions = json.observations.map((o: { dimension: string }) => o.dimension).sort();
    expect(dimensions).toEqual(["sentence-rhythm", "sentence-structure", "word-level-habits"]);

    // Sentence structure observation stored correctly
    const structureObs = json.observations.find(
      (o: { dimension: string }) => o.dimension === "sentence-structure",
    );
    expect(structureObs.pattern).toContain("opener pattern");
    expect(structureObs.status).toBe("pending");
  });

  test("observations are stored with correct entry reference", async () => {
    const fs = mockFs();

    const entryStore = createEntryStore({
      entriesDir: "/data/entries",
      fs,
      now: () => "2026-03-27",
    });

    const observationStore = createObservationStore({
      observationsDir: "/data/observations",
      fs,
      now: () => "2026-03-27T10:00:00.000Z",
    });

    const sessionRunner = createSessionRunner({
      queryFn: async () => ({ content: MOCK_OBSERVER_OUTPUT }),
    });

    const onEntryCreated = (entryId: string, entryText: string) =>
      observe(
        {
          sessionRunner,
          observationStore,
          computeMetrics: computeEntryMetrics,
        },
        entryId,
        entryText,
      );

    const entryRoutes = createEntryRoutes({ entryStore, onEntryCreated });
    const { hono } = createApp({ routeModules: [entryRoutes] });

    await hono.request(
      new Request("http://localhost/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: SAMPLE_ENTRY }),
      }),
    );

    // Verify stored observations reference the correct entry
    const allObs = await observationStore.list();
    expect(allObs).toHaveLength(2);
    expect(allObs[0].entryId).toMatch(/^entry-2026-03-27-/);
    expect(allObs[1].entryId).toBe(allObs[0].entryId);
  });
});
