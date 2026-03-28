import { describe, expect, test } from "bun:test";
import { createApp } from "../src/app.js";
import { createEntryStore, type EntryStoreFs } from "../src/entry-store.js";
import {
  createObservationStore,
  type ObservationStoreFs,
} from "../src/observation-store.js";
import { createEntryRoutes } from "../src/routes/entries.js";
import { createObservationRoutes } from "../src/routes/observations.js";
import type { Observation, CurationSession } from "@ink-mirror/shared";

/**
 * In-memory filesystem mock shared by both stores.
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

function req(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

describe("curation integration", () => {
  test("create entry, save observations, curate via API, verify state persists", async () => {
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

    // Create an entry
    const entry = await entryStore.create("I stopped. I turned. I left.");

    // Save observations (normally Observer does this, we simulate)
    await observationStore.save(entry.id, {
      pattern: "Uses three consecutive short sentences",
      evidence: "I stopped. I turned. I left.",
      dimension: "sentence-rhythm",
    });
    await observationStore.save(entry.id, {
      pattern: "Favors first-person declarative statements",
      evidence: "I stopped. I turned. I left.",
      dimension: "word-level-habits",
    });

    // Wire up the app
    const entryRoutes = createEntryRoutes({ entryStore });
    const observationRoutes = createObservationRoutes({ observationStore, entryStore, onIntentional: async () => {} });
    const { hono } = createApp({ routeModules: [entryRoutes, observationRoutes] });

    // Get curation session
    const pendingRes = await hono.request(req("/observations/pending"));
    expect(pendingRes.status).toBe(200);
    const session: CurationSession = await pendingRes.json();
    expect(session.observations).toHaveLength(2);
    expect(session.observations[0].entryText).toBe("I stopped. I turned. I left.");

    // Classify first as intentional
    const classifyRes1 = await hono.request(
      req(`/observations/${session.observations[0].id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "intentional" }),
      }),
    );
    expect(classifyRes1.status).toBe(200);

    // Classify second as undecided
    const classifyRes2 = await hono.request(
      req(`/observations/${session.observations[1].id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "undecided" }),
      }),
    );
    expect(classifyRes2.status).toBe(200);

    // Verify state persists: list filtered by intentional
    const intentionalRes = await hono.request(req("/observations?status=intentional"));
    const intentional: Observation[] = await intentionalRes.json();
    expect(intentional).toHaveLength(1);
    expect(intentional[0].pattern).toBe("Uses three consecutive short sentences");

    // Verify undecided resurfaces in next session
    const nextSession: CurationSession = await (
      await hono.request(req("/observations/pending"))
    ).json();
    expect(nextSession.observations).toHaveLength(1);
    expect(nextSession.observations[0].status).toBe("undecided");
  });

  test("contradictory patterns surface during curation", async () => {
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

    // Create two entries
    const entry1 = await entryStore.create("I stopped. I turned. I left. Short.");
    const entry2 = await entryStore.create(
      "The morning was long and the afternoon stretched further into evening.",
    );

    // First observation, confirmed as intentional
    await observationStore.save(entry1.id, {
      pattern: "Uses short declarative sentences for impact",
      evidence: "I stopped. I turned. I left.",
      dimension: "sentence-rhythm",
    });

    // Classify as intentional directly
    const obs1 = (await observationStore.list())[0];
    await observationStore.updateStatus(obs1.id as ReturnType<typeof import("@ink-mirror/shared").observationId>, "intentional");

    // Second observation (contradictory, still pending)
    await observationStore.save(entry2.id, {
      pattern: "Uses long compound sentences that flow continuously",
      evidence: "The morning was long and the afternoon stretched further into evening.",
      dimension: "sentence-rhythm",
    });

    const entryRoutes = createEntryRoutes({ entryStore });
    const observationRoutes = createObservationRoutes({ observationStore, entryStore, onIntentional: async () => {} });
    const { hono } = createApp({ routeModules: [entryRoutes, observationRoutes] });

    // Get curation session: should surface the contradiction
    const res = await hono.request(req("/observations/pending"));
    const session: CurationSession = await res.json();

    expect(session.observations).toHaveLength(1);
    expect(session.contradictions).toHaveLength(1);
    expect(session.contradictions[0].dimension).toBe("sentence-rhythm");
    expect(session.contradictions[0].newObservation.pattern).toContain("long");
    expect(session.contradictions[0].confirmedObservation.pattern).toContain("short");
  });

  test("invalid state transitions are rejected", async () => {
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

    const entry = await entryStore.create("Test entry.");
    await observationStore.save(entry.id, {
      pattern: "Test pattern",
      evidence: "Test evidence",
      dimension: "sentence-rhythm",
    });

    const entryRoutes = createEntryRoutes({ entryStore });
    const observationRoutes = createObservationRoutes({ observationStore, entryStore, onIntentional: async () => {} });
    const { hono } = createApp({ routeModules: [entryRoutes, observationRoutes] });

    // Classify as accidental
    const obs = (await observationStore.list())[0];
    const res1 = await hono.request(
      req(`/observations/${obs.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "accidental" }),
      }),
    );
    expect(res1.status).toBe(200);

    // Try to re-classify as intentional (accidental -> intentional is invalid)
    const res2 = await hono.request(
      req(`/observations/${obs.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "intentional" }),
      }),
    );
    expect(res2.status).toBe(409);
  });
});
