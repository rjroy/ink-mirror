/**
 * Integration test for the onEntryCreated wiring pattern used in
 * src/index.ts. Calls the real `createOnEntryCreated` factory exported from
 * src/index.ts (rather than a hand-rolled duplicate) with mock deps, so the
 * "compute once, persist, pass along" contract (Phase 2 plan item 6) is
 * verified end-to-end through the real HTTP route against the real wiring
 * function, not just a copy of its logic.
 *
 * Importing src/index.js is safe here: its daemon bootstrap (socket bind,
 * Bun.serve, pi-agent warm-up) only runs when that module is the process
 * entry point (`import.meta.main`), which is false when it's imported by a
 * test.
 */
import { describe, expect, test } from "bun:test";
import { createApp } from "../src/app.js";
import { createEntryStore } from "../src/entry-store.js";
import { createEntryRoutes } from "../src/routes/entries.js";
import { createObservationStore, type ObservationStoreFs } from "../src/observation-store.js";
import { createPatternStore, type PatternStoreFs } from "../src/pattern-store.js";
import { createSnapshotStore, type SnapshotStoreFs } from "../src/snapshot-store.js";
import { createProfileStore, type ProfileStoreFs } from "../src/profile-store.js";
import { createSessionRunner } from "../src/session-runner.js";
import { createOnEntryCreated, type OnEntryCreatedDeps } from "../src/index.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function req(path: string, opts?: { method?: string; body?: unknown }): Request {
  const method = opts?.method ?? "GET";
  const init: RequestInit = { method };
  if (opts?.body) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(opts.body);
  }
  return new Request(`http://localhost${path}`, init);
}

function mockObservationFs(): ObservationStoreFs & { files: Record<string, string> } {
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

/**
 * `onWrite`, when supplied, fires after every persisted write — used by the
 * tests below to record when the snapshot save completes relative to the
 * Observer's LLM call, without needing to intercept `createOnEntryCreated`
 * itself (it's the real factory from src/index.js, not a test double).
 */
function mockSnapshotFs(onWrite?: () => void): SnapshotStoreFs & { files: Record<string, string> } {
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
      onWrite?.();
    },
    async mkdir(): Promise<void> {},
  };
}

/** Empty in-memory profile store fs: `toPromptMarkdown()` reads a
 * nonexistent path, which profile-store.ts already treats as "no profile
 * yet" rather than an error. */
function mockProfileFs(): ProfileStoreFs {
  const files: Record<string, string> = {};
  return {
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

function mockPatternFs(): PatternStoreFs {
  const files: Record<string, string> = {};
  return {
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

const VALID_OBSERVER_JSON = JSON.stringify({
  observations: [
    {
      pattern: "Uses short sentences for emphasis",
      evidence: ["A wiring test entry."],
      dimension: "sentence-rhythm",
      patternRef: { newPattern: { statement: "Uses short sentences for emphasis", dimension: "sentence-rhythm" } },
    },
  ],
});

describe("onEntryCreated wiring: compute once, snapshot, then observe (Phase 2 plan item 6)", () => {
  test("saves a snapshot before the Observer runs, and observe receives the same computed metrics", async () => {
    const entriesDir = mkdtempSync(join(tmpdir(), "ink-mirror-wiring-test-"));
    const observationFs = mockObservationFs();

    const entryStore = createEntryStore({ entriesDir });
    const observationStore = createObservationStore({
      observationsDir: "/data/observations",
      fs: observationFs,
      now: () => "2026-07-10T10:00:00.000Z",
    });
    const patternStore = createPatternStore({ patternsDir: "/data/patterns", fs: mockPatternFs() });
    const profileStore = createProfileStore({ profilePath: "/data/profile.md", fs: mockProfileFs() });

    const callOrder: string[] = [];
    const snapshotFs = mockSnapshotFs(() => callOrder.push("snapshot-saved"));
    const snapshotStore = createSnapshotStore({ snapshotsDir: "/data/snapshots", fs: snapshotFs });

    const sessionRunner = createSessionRunner({
      queryFn: async () => {
        callOrder.push("observer-llm-call");
        return { content: VALID_OBSERVER_JSON };
      },
    });

    // The real wiring factory from src/index.js (Phase 2 plan item 6):
    // compute metrics once, persist the snapshot, then hand the same
    // metrics into observe() as precomputedMetrics.
    const deps: OnEntryCreatedDeps = {
      snapshotStore,
      sessionRunner,
      observationStore,
      patternStore,
      entryStore,
      profileStore,
      now: () => "2026-07-10T10:00:00.000Z",
    };
    const onEntryCreated = createOnEntryCreated(deps);

    const entryRoutes = createEntryRoutes({ entryStore, onEntryCreated });
    const { hono } = createApp({ routeModules: [entryRoutes] });

    const createRes = await hono.request(
      req("/entries", { method: "POST", body: { body: "A wiring test entry." } }),
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    // Snapshot persisted before the Observer's LLM call ran.
    expect(callOrder).toEqual(["snapshot-saved", "observer-llm-call"]);

    // The snapshot is durably readable and carries the entry's real metrics.
    const snapshot = await snapshotStore.get(created.id);
    expect(snapshot).toBeDefined();
    expect(snapshot?.entryId).toBe(created.id);
    expect(snapshot?.metrics.rhythm.mean).toBeGreaterThan(0);

    // The Observer still ran and stored its observation.
    expect(created.observations).toHaveLength(1);

    rmSync(entriesDir, { recursive: true, force: true });
  });

  test("a snapshot-save failure surfaces as observeError without failing entry creation", async () => {
    const entriesDir = mkdtempSync(join(tmpdir(), "ink-mirror-wiring-test-"));
    const observationFs = mockObservationFs();
    const entryStore = createEntryStore({ entriesDir });
    const observationStore = createObservationStore({
      observationsDir: "/data/observations",
      fs: observationFs,
      now: () => "2026-07-10T10:00:00.000Z",
    });

    // A snapshot store fs whose writeFile always rejects (e.g. disk full),
    // so snapshotStore.save() itself fails through the real code path
    // instead of a bare thrown error standing in for it.
    const failingSnapshotFs: SnapshotStoreFs = {
      async readdir(): Promise<string[]> {
        return [];
      },
      async readFile(): Promise<string> {
        throw new Error("ENOENT");
      },
      async writeFile(): Promise<void> {
        throw new Error("disk full");
      },
      async mkdir(): Promise<void> {},
    };
    const snapshotStore = createSnapshotStore({
      snapshotsDir: "/data/snapshots",
      fs: failingSnapshotFs,
    });

    const sessionRunner = createSessionRunner({
      queryFn: async () => ({ content: VALID_OBSERVER_JSON }),
    });

    const patternStore = createPatternStore({ patternsDir: "/data/patterns", fs: mockPatternFs() });
    const profileStore = createProfileStore({ profilePath: "/data/profile.md", fs: mockProfileFs() });

    // The real wiring factory from src/index.js, with a snapshot store that
    // genuinely fails on save().
    const deps: OnEntryCreatedDeps = {
      snapshotStore,
      sessionRunner,
      observationStore,
      patternStore,
      entryStore,
      profileStore,
      now: () => "2026-07-10T10:00:00.000Z",
    };
    const onEntryCreated = createOnEntryCreated(deps);

    const entryRoutes = createEntryRoutes({ entryStore, onEntryCreated });
    const { hono } = createApp({ routeModules: [entryRoutes] });

    const createRes = await hono.request(
      req("/entries", { method: "POST", body: { body: "Entry that should still save." } }),
    );

    // Entry creation succeeds even though the snapshot/observer step failed.
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.observeError).toContain("disk full");
    expect(created.observations).toBeUndefined();

    rmSync(entriesDir, { recursive: true, force: true });
  });
});
