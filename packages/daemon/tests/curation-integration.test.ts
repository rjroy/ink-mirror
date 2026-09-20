import { describe, expect, test } from "bun:test";
import { createApp } from "../src/app.js";
import { createEntryStore, type EntryStoreFs } from "../src/entry-store.js";
import { createObservationStore, type ObservationStoreFs } from "../src/observation-store.js";
import { createPatternStore, type PatternStoreFs } from "../src/pattern-store.js";
import { createSnapshotStore, type SnapshotStoreFs } from "../src/snapshot-store.js";
import { createProfileStore, type ProfileStoreFs } from "../src/profile-store.js";
import { createEntryRoutes } from "../src/routes/entries.js";
import { createObservationRoutes } from "../src/routes/observations.js";
import { createPatternRoutes } from "../src/routes/patterns.js";
import { DEFAULT_CONFIG } from "../src/config.js";
import type { PatternCurationSession } from "@ink-mirror/shared";

/**
 * Full pattern-grain curation loop through the daemon API: write an entry,
 * simulate the Observer storing sightings against patterns, curate via
 * GET/POST /patterns/*, and verify the resulting state persists. Supersedes
 * the old observation-grain version of this test (REQ-LPC-28 moved the
 * whole curation surface off routes/observations.ts).
 */

function mockFs(): EntryStoreFs &
  ObservationStoreFs &
  PatternStoreFs &
  SnapshotStoreFs &
  ProfileStoreFs & { files: Record<string, string> } {
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

function setup(fs: ReturnType<typeof mockFs>, now: () => string) {
  const entryStore = createEntryStore({ entriesDir: "/data/entries", fs, now: () => now().slice(0, 10) });
  const observationStore = createObservationStore({ observationsDir: "/data/observations", fs, now });
  const patternStore = createPatternStore({ patternsDir: "/data/patterns", fs, now });
  const snapshotStore = createSnapshotStore({ snapshotsDir: "/data/snapshots", fs });
  const profileStore = createProfileStore({ profilePath: "/data/profile.md", fs, now });

  const entryRoutes = createEntryRoutes({ entryStore });
  const observationRoutes = createObservationRoutes({ observationStore });
  const patternRoutes = createPatternRoutes({
    patternStore,
    observationStore,
    entryStore,
    snapshotStore,
    profileStore,
    config: DEFAULT_CONFIG,
    now,
  });
  const { hono } = createApp({ routeModules: [entryRoutes, observationRoutes, patternRoutes] });

  return { hono, entryStore, observationStore, patternStore, profileStore };
}

describe("pattern-grain curation integration", () => {
  test("create entry, save sightings, curate via API, verify state persists", async () => {
    const fs = mockFs();
    const { hono, entryStore, observationStore, patternStore } = setup(fs, () => "2026-03-27T10:00:00.000Z");

    const entry = await entryStore.create("I stopped. I turned. I left.");

    const pattern1 = await patternStore.create({
      statement: "Uses three consecutive short sentences",
      dimension: "sentence-rhythm",
    });
    const obs1 = await observationStore.save(entry.id, {
      pattern: "Uses three consecutive short sentences",
      evidence: ["I stopped. I turned. I left."],
      dimension: "sentence-rhythm",
    }, pattern1.id);
    await patternStore.recordSighting(pattern1.id, {
      id: obs1.id, patternId: pattern1.id, entryId: entry.id, evidence: obs1.evidence, dimension: obs1.dimension, createdAt: obs1.createdAt,
    });

    const pattern2 = await patternStore.create({
      statement: "Favors first-person declarative statements",
      dimension: "word-level-habits",
    });
    const obs2 = await observationStore.save(entry.id, {
      pattern: "Favors first-person declarative statements",
      evidence: ["I stopped. I turned. I left."],
      dimension: "word-level-habits",
    }, pattern2.id);
    await patternStore.recordSighting(pattern2.id, {
      id: obs2.id, patternId: pattern2.id, entryId: entry.id, evidence: obs2.evidence, dimension: obs2.dimension, createdAt: obs2.createdAt,
    });

    // Get curation session
    const sessionRes = await hono.request(req("/patterns/session"));
    expect(sessionRes.status).toBe(200);
    const session: PatternCurationSession = await sessionRes.json();
    expect(session.dossiers).toHaveLength(2);
    expect(session.dossiers[0].sightings[0].entryText).toBe("I stopped. I turned. I left.");

    // Classify first as intentional
    const classifyRes1 = await hono.request(
      req(`/patterns/${session.dossiers[0].pattern.id}/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "intentional" }),
      }),
    );
    expect(classifyRes1.status).toBe(200);

    // Classify second as undecided
    const classifyRes2 = await hono.request(
      req(`/patterns/${session.dossiers[1].pattern.id}/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "undecided" }),
      }),
    );
    expect(classifyRes2.status).toBe(200);

    // Verify state persists: list filtered by intentional
    const intentionalRes = await hono.request(req("/patterns?status=intentional"));
    const intentional = await intentionalRes.json();
    expect(intentional).toHaveLength(1);
    expect(intentional[0].statement).toBe("Uses three consecutive short sentences");

    // Verify undecided resurfaces in next session
    const nextSession: PatternCurationSession = await (
      await hono.request(req("/patterns/session"))
    ).json();
    expect(nextSession.dossiers).toHaveLength(1);
    expect(nextSession.dossiers[0].pattern.status).toBe("undecided");
  });

  test("contradictory patterns surface during curation", async () => {
    const fs = mockFs();
    const { hono, entryStore, observationStore, patternStore } = setup(fs, () => "2026-03-27T10:00:00.000Z");

    const entry1 = await entryStore.create("I stopped. I turned. I left. Short.");
    const entry2 = await entryStore.create("The morning was long and the afternoon stretched further into evening.");

    const confirmed = await patternStore.create({
      statement: "Uses short declarative sentences for impact",
      dimension: "sentence-rhythm",
    });
    await patternStore.updateStatus(confirmed.id, "intentional");
    const obs1 = await observationStore.save(entry1.id, {
      pattern: "Uses short declarative sentences for impact",
      evidence: ["I stopped. I turned. I left."],
      dimension: "sentence-rhythm",
    }, confirmed.id);
    await patternStore.recordSighting(confirmed.id, {
      id: obs1.id, patternId: confirmed.id, entryId: entry1.id, evidence: obs1.evidence, dimension: obs1.dimension, createdAt: obs1.createdAt,
    });

    const candidate = await patternStore.create({
      statement: "Uses long compound sentences that flow continuously",
      dimension: "sentence-rhythm",
    });
    const obs2 = await observationStore.save(entry2.id, {
      pattern: "Uses long compound sentences that flow continuously",
      evidence: ["The morning was long and the afternoon stretched further into evening."],
      dimension: "sentence-rhythm",
    }, candidate.id);
    await patternStore.recordSighting(candidate.id, {
      id: obs2.id, patternId: candidate.id, entryId: entry2.id, evidence: obs2.evidence, dimension: obs2.dimension, createdAt: obs2.createdAt,
    });

    const res = await hono.request(req("/patterns/session"));
    const session: PatternCurationSession = await res.json();

    expect(session.dossiers).toHaveLength(1);
    expect(session.contradictions).toHaveLength(1);
    expect(session.contradictions[0].dimension).toBe("sentence-rhythm");
    expect(session.contradictions[0].pattern.statement).toContain("long");
    expect(session.contradictions[0].contradicts.statement).toContain("short");
  });

  test("invalid state transitions are rejected", async () => {
    const fs = mockFs();
    const { hono, entryStore, observationStore, patternStore } = setup(fs, () => "2026-03-27T10:00:00.000Z");

    const entry = await entryStore.create("Test entry.");
    const pattern = await patternStore.create({ statement: "Test pattern", dimension: "sentence-rhythm" });
    const obs = await observationStore.save(entry.id, {
      pattern: "Test pattern",
      evidence: ["Test evidence"],
      dimension: "sentence-rhythm",
    }, pattern.id);
    await patternStore.recordSighting(pattern.id, {
      id: obs.id, patternId: pattern.id, entryId: entry.id, evidence: obs.evidence, dimension: obs.dimension, createdAt: obs.createdAt,
    });

    // Classify as accidental
    const res1 = await hono.request(
      req(`/patterns/${pattern.id}/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "accidental" }),
      }),
    );
    expect(res1.status).toBe(200);

    // Try to re-classify as pending (not a valid classification target at all)
    const res2 = await hono.request(
      req(`/patterns/${pattern.id}/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      }),
    );
    expect(res2.status).toBe(400);
  });

  test("classify-and-promote in one action creates a writer-asserted rule below normal thresholds (REQ-LPC-16)", async () => {
    const fs = mockFs();
    const { hono, entryStore, observationStore, patternStore, profileStore } = setup(fs, () => "2026-03-27T10:00:00.000Z");

    const entry = await entryStore.create("Short. Sharp. Done.");
    const pattern = await patternStore.create({ statement: "Uses staccato rhythm for emphasis", dimension: "sentence-rhythm" });
    const obs = await observationStore.save(entry.id, {
      pattern: "Uses staccato rhythm for emphasis",
      evidence: ["Short. Sharp. Done."],
      dimension: "sentence-rhythm",
    }, pattern.id);
    await patternStore.recordSighting(pattern.id, {
      id: obs.id, patternId: pattern.id, entryId: entry.id, evidence: obs.evidence, dimension: obs.dimension, createdAt: obs.createdAt,
    });

    // Single sighting, single entry: below every promotion threshold.
    const res = await hono.request(
      req(`/patterns/${pattern.id}/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "intentional", promote: true }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("intentional");
    expect(body.ruleId).toBeDefined();
    expect(body.rule.provenance).toBe("writer-asserted");

    const profile = await profileStore.get();
    expect(profile.rules).toHaveLength(1);
    expect(profile.rules[0].provenance).toBe("writer-asserted");
    expect(profile.rules[0].patternId).toBe(pattern.id);
  });
});
