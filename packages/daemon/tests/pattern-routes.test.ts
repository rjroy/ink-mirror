import { describe, expect, test } from "bun:test";
import { createApp } from "../src/app.js";
import { createEntryStore, type EntryStoreFs } from "../src/entry-store.js";
import { createObservationStore, type ObservationStoreFs } from "../src/observation-store.js";
import { createPatternStore, type PatternStoreFs } from "../src/pattern-store.js";
import { createSnapshotStore, type SnapshotStoreFs } from "../src/snapshot-store.js";
import { createProfileStore, type ProfileStoreFs } from "../src/profile-store.js";
import { createPatternRoutes } from "../src/routes/patterns.js";
import { createEventBus } from "../src/event-bus.js";
import type { EventBus } from "../src/types.js";
import { DEFAULT_CONFIG, type Config } from "../src/config.js";
import { observationId } from "@ink-mirror/shared";
import { computeEntryMetrics } from "../src/metrics/index.js";

/**
 * Route-level tests for the pattern-grain curation API (REQ-LPC-28), using
 * Hono's app.request() test client with the real (in-memory-fs-backed)
 * stores wired together, following this project's existing route-test
 * convention (curation-integration.test.ts). Covers each new endpoint's
 * happy path plus at least one validation-failure path, and the specific
 * behaviors called out in the Phase 4 gate: classify-and-promote below
 * threshold, detach producing a new candidate, merge moving sightings,
 * dismiss never creating a watch item, proposal accept/decline.
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

function post(path: string, body?: unknown): Request {
  return req(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function setup(now: () => string, config: Config = DEFAULT_CONFIG, eventBus?: EventBus) {
  const fs = mockFs();
  const entryStore = createEntryStore({ entriesDir: "/data/entries", fs, now: () => now().slice(0, 10) });
  const observationStore = createObservationStore({ observationsDir: "/data/observations", fs, now });
  const patternStore = createPatternStore({ patternsDir: "/data/patterns", fs, now });
  const snapshotStore = createSnapshotStore({ snapshotsDir: "/data/snapshots", fs });
  const profileStore = createProfileStore({ profilePath: "/data/profile.md", fs, now });

  const patternRoutes = createPatternRoutes({
    patternStore,
    observationStore,
    entryStore,
    snapshotStore,
    profileStore,
    config,
    eventBus,
    now,
  });
  const { hono } = createApp({ routeModules: [patternRoutes], eventBus });

  return { hono, entryStore, observationStore, patternStore, profileStore, snapshotStore };
}

/** Creates a pattern with one sighting in a freshly-created entry, returning both. */
async function seedPatternWithSighting(
  stores: ReturnType<typeof setup>,
  overrides: { statement: string; dimension?: "sentence-rhythm" | "word-level-habits"; entryText?: string },
) {
  const { entryStore, observationStore, patternStore } = stores;
  const entry = await entryStore.create(overrides.entryText ?? "Short. Sharp. Done.");
  const pattern = await patternStore.create({
    statement: overrides.statement,
    dimension: overrides.dimension ?? "sentence-rhythm",
  });
  const obs = await observationStore.save(
    entry.id,
    { pattern: overrides.statement, evidence: [entry.body], dimension: pattern.dimension },
    pattern.id,
  );
  const recorded = await patternStore.recordSighting(pattern.id, {
    id: obs.id,
    patternId: pattern.id,
    entryId: entry.id,
    evidence: obs.evidence,
    dimension: obs.dimension,
    createdAt: obs.createdAt,
  });
  return { entry, pattern: recorded, obs };
}

describe("GET /patterns and /patterns/:id", () => {
  test("lists all patterns and filters by status", async () => {
    const stores = setup(() => "2026-04-01T00:00:00.000Z");
    await seedPatternWithSighting(stores, { statement: "Pattern A" });
    const { pattern: patternB } = await seedPatternWithSighting(stores, { statement: "Pattern B" });
    await stores.patternStore.updateStatus(patternB.id, "intentional");

    const all = await (await stores.hono.request(req("/patterns"))).json();
    expect(all).toHaveLength(2);

    const intentional = await (await stores.hono.request(req("/patterns?status=intentional"))).json();
    expect(intentional).toHaveLength(1);
    expect(intentional[0].id).toBe(patternB.id);
  });

  test("rejects an invalid status filter", async () => {
    const stores = setup(() => "2026-04-01T00:00:00.000Z");
    const res = await stores.hono.request(req("/patterns?status=bogus"));
    expect(res.status).toBe(400);
  });

  test("returns a single pattern's dossier", async () => {
    const stores = setup(() => "2026-04-01T00:00:00.000Z");
    const { pattern, entry } = await seedPatternWithSighting(stores, { statement: "Pattern A" });

    const res = await stores.hono.request(req(`/patterns/${pattern.id}`));
    expect(res.status).toBe(200);
    const dossier = await res.json();
    expect(dossier.pattern.id).toBe(pattern.id);
    expect(dossier.sightings).toHaveLength(1);
    expect(dossier.sightings[0].entryText).toBe(entry.body);
  });

  test("returns 404 for an unknown pattern", async () => {
    const stores = setup(() => "2026-04-01T00:00:00.000Z");
    const res = await stores.hono.request(req("/patterns/pat-nonexistent"));
    expect(res.status).toBe(404);
  });

  test("rejects a malformed pattern ID", async () => {
    const stores = setup(() => "2026-04-01T00:00:00.000Z");
    const res = await stores.hono.request(req("/patterns/not-a-pattern-id"));
    expect(res.status).toBe(400);
  });
});

describe("POST /patterns/:id/classify", () => {
  test("classifying accidental opens a watch item", async () => {
    const stores = setup(() => "2026-04-01T00:00:00.000Z");
    const { pattern } = await seedPatternWithSighting(stores, { statement: "Overuses hedging" });

    const res = await stores.hono.request(post(`/patterns/${pattern.id}/classify`, { status: "accidental" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("accidental");
    expect(body.watch).toBeDefined();
    expect(body.watch.resolved).toBe(false);
  });

  test("classify-and-promote below normal thresholds still creates a writer-asserted rule (REQ-LPC-16)", async () => {
    const stores = setup(() => "2026-04-01T00:00:00.000Z");
    // A single sighting in a single entry: below sighting/entry/word thresholds.
    const { pattern } = await seedPatternWithSighting(stores, { statement: "Uses staccato rhythm for emphasis" });

    const res = await stores.hono.request(
      post(`/patterns/${pattern.id}/classify`, { status: "intentional", promote: true }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("intentional");
    expect(body.ruleId).toBeDefined();
    expect(body.rule.provenance).toBe("writer-asserted");

    const profile = await stores.profileStore.get();
    expect(profile.rules).toHaveLength(1);
    expect(profile.rules[0].provenance).toBe("writer-asserted");
  });

  test("rejects an invalid status value", async () => {
    const stores = setup(() => "2026-04-01T00:00:00.000Z");
    const { pattern } = await seedPatternWithSighting(stores, { statement: "Pattern A" });

    const res = await stores.hono.request(post(`/patterns/${pattern.id}/classify`, { status: "pending" }));
    expect(res.status).toBe(400);
  });

  test("returns 404 for an unknown pattern", async () => {
    const stores = setup(() => "2026-04-01T00:00:00.000Z");
    const res = await stores.hono.request(post("/patterns/pat-nonexistent/classify", { status: "intentional" }));
    expect(res.status).toBe(404);
  });
});

describe("POST /patterns/:id/detach", () => {
  test("detach removes the sighting from the source dossier and creates a new candidate pattern", async () => {
    const stores = setup(() => "2026-04-01T00:00:00.000Z");
    const { pattern, obs } = await seedPatternWithSighting(stores, { statement: "Uses short sentences" });

    const res = await stores.hono.request(post(`/patterns/${pattern.id}/detach`, { sightingId: obs.id }));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.source.sightingCount).toBe(0);
    expect(body.source.entryIds).toEqual([]);
    expect(body.newPattern.status).toBe("candidate");
    expect(body.newPattern.sightingCount).toBe(1);
    expect(body.newPattern.statement).toBe("Uses short sentences");

    // The dossier for the original pattern is now empty of sightings.
    const sourceDossier = await (await stores.hono.request(req(`/patterns/${pattern.id}`))).json();
    expect(sourceDossier.sightings).toHaveLength(0);

    // The new candidate pattern owns the sighting now.
    const newDossier = await (await stores.hono.request(req(`/patterns/${body.newPattern.id}`))).json();
    expect(newDossier.sightings).toHaveLength(1);
    expect(newDossier.sightings[0].id).toBe(obs.id);
  });

  test("returns 404 when the sighting doesn't belong to the pattern", async () => {
    const stores = setup(() => "2026-04-01T00:00:00.000Z");
    const { pattern } = await seedPatternWithSighting(stores, { statement: "Pattern A" });

    const res = await stores.hono.request(post(`/patterns/${pattern.id}/detach`, { sightingId: "obs-nonexistent" }));
    expect(res.status).toBe(404);
  });

  test("emits pattern:discovered for the new candidate pattern (REQ-LPC-29)", async () => {
    const eventBus = createEventBus();
    const events: unknown[] = [];
    eventBus.subscribe("pattern:discovered", (e) => events.push(e));

    const stores = setup(() => "2026-04-01T00:00:00.000Z", DEFAULT_CONFIG, eventBus);
    const { pattern, obs } = await seedPatternWithSighting(stores, { statement: "Uses short sentences" });

    const res = await stores.hono.request(post(`/patterns/${pattern.id}/detach`, { sightingId: obs.id }));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(events).toHaveLength(1);
    expect((events[0] as { pattern: { id: string } }).pattern.id).toBe(body.newPattern.id);
  });
});

describe("POST /patterns/:id/merge", () => {
  test("merge moves the duplicate's sightings to the survivor and marks it mergedInto", async () => {
    const stores = setup(() => "2026-04-01T00:00:00.000Z");
    const { pattern: survivor } = await seedPatternWithSighting(stores, { statement: "Uses short sentences" });
    const { pattern: duplicate, obs: dupObs } = await seedPatternWithSighting(stores, { statement: "Uses very short sentences" });

    const res = await stores.hono.request(post(`/patterns/${survivor.id}/merge`, { duplicateId: duplicate.id }));
    expect(res.status).toBe(200);
    const merged = await res.json();
    expect(merged.sightingCount).toBe(2);

    const duplicateAfter = await stores.patternStore.get(duplicate.id);
    expect(duplicateAfter?.status).toBe("retired");
    expect(duplicateAfter?.retirement?.mergedInto).toBe(survivor.id);

    const movedObs = await stores.observationStore.get(observationId(dupObs.id));
    expect(movedObs?.patternId).toBe(survivor.id);
  });

  test("rejects merging a pattern into itself", async () => {
    const stores = setup(() => "2026-04-01T00:00:00.000Z");
    const { pattern } = await seedPatternWithSighting(stores, { statement: "Pattern A" });

    const res = await stores.hono.request(post(`/patterns/${pattern.id}/merge`, { duplicateId: pattern.id }));
    expect(res.status).toBe(400);
  });

  test("rejects a malformed duplicateId (path-traversal guard, mirrors F-01)", async () => {
    const stores = setup(() => "2026-04-01T00:00:00.000Z");
    const { pattern } = await seedPatternWithSighting(stores, { statement: "Pattern A" });

    const res = await stores.hono.request(
      post(`/patterns/${pattern.id}/merge`, { duplicateId: "../../../etc/passwd" }),
    );
    expect(res.status).toBe(400);
  });

  test("rejects merging patterns from different dimensions", async () => {
    const stores = setup(() => "2026-04-01T00:00:00.000Z");
    const { pattern: survivor } = await seedPatternWithSighting(stores, { statement: "Pattern A", dimension: "sentence-rhythm" });
    const { pattern: duplicate } = await seedPatternWithSighting(stores, { statement: "Pattern B", dimension: "word-level-habits" });

    const res = await stores.hono.request(post(`/patterns/${survivor.id}/merge`, { duplicateId: duplicate.id }));
    expect(res.status).toBe(409);
  });

  test("merging a duplicate that has a linked rule removes the orphaned rule from the profile", async () => {
    // Regression: merge() retires the duplicate but previously never deleted
    // its linked rule (unlike retire), leaving a promoted rule permanently
    // orphaned in the profile with no backing pattern.
    const stores = setup(() => "2026-04-01T00:00:00.000Z");
    const { pattern: survivor } = await seedPatternWithSighting(stores, { statement: "Uses short sentences" });
    const { pattern: duplicate } = await seedPatternWithSighting(stores, { statement: "Uses very short sentences" });
    await stores.hono.request(post(`/patterns/${duplicate.id}/classify`, { status: "intentional", promote: true }));

    const profileBefore = await stores.profileStore.get();
    expect(profileBefore.rules).toHaveLength(1);

    const res = await stores.hono.request(post(`/patterns/${survivor.id}/merge`, { duplicateId: duplicate.id }));
    expect(res.status).toBe(200);

    const profileAfter = await stores.profileStore.get();
    expect(profileAfter.rules).toHaveLength(0);

    const duplicateAfter = await stores.patternStore.get(duplicate.id);
    expect(duplicateAfter?.ruleId).toBeUndefined();
  });
});

describe("POST /patterns/:id/dismiss", () => {
  test("dismiss retires the pattern with dismissedAsWrong and never creates a watch item", async () => {
    const stores = setup(() => "2026-04-01T00:00:00.000Z");
    const { pattern } = await seedPatternWithSighting(stores, { statement: "Pattern A" });

    const res = await stores.hono.request(post(`/patterns/${pattern.id}/dismiss`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("retired");
    expect(body.retirement?.dismissedAsWrong).toBe(true);
    expect(body.watch).toBeUndefined();

    const watchRes = await stores.hono.request(req("/patterns/watch"));
    const watch = await watchRes.json();
    expect(watch.watchList).toEqual([]);
  });

  test("dismissing a pattern that has a linked rule removes the orphaned rule from the profile", async () => {
    // Regression: dismiss retires the pattern but previously never deleted
    // its linked rule (unlike retire), leaving a promoted rule permanently
    // orphaned in the profile with no backing pattern.
    const stores = setup(() => "2026-04-01T00:00:00.000Z");
    const { pattern } = await seedPatternWithSighting(stores, { statement: "Uses staccato rhythm" });
    await stores.hono.request(post(`/patterns/${pattern.id}/classify`, { status: "intentional", promote: true }));

    const profileBefore = await stores.profileStore.get();
    expect(profileBefore.rules).toHaveLength(1);

    const res = await stores.hono.request(post(`/patterns/${pattern.id}/dismiss`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ruleId).toBeUndefined();

    const profileAfter = await stores.profileStore.get();
    expect(profileAfter.rules).toHaveLength(0);
  });
});

describe("POST /patterns/:id/retire and /reactivate", () => {
  test("retiring a pattern with a linked rule removes the rule from the profile", async () => {
    const stores = setup(() => "2026-04-01T00:00:00.000Z");
    const { pattern } = await seedPatternWithSighting(stores, { statement: "Uses staccato rhythm" });
    await stores.hono.request(post(`/patterns/${pattern.id}/classify`, { status: "intentional", promote: true }));

    const profileBefore = await stores.profileStore.get();
    expect(profileBefore.rules).toHaveLength(1);

    const res = await stores.hono.request(post(`/patterns/${pattern.id}/retire`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("retired");
    // Regression: updateStatus previously never cleared ruleId on retire, so
    // the pattern kept pointing at a rule that had just been deleted.
    expect(body.ruleId).toBeUndefined();

    const profileAfter = await stores.profileStore.get();
    expect(profileAfter.rules).toHaveLength(0);
  });

  test("a reactivated pattern can be classified-and-promoted again, creating a fresh rule", async () => {
    // Regression: with ruleId never cleared on retire, classify-and-promote's
    // `!updated.ruleId` guard would treat a reactivated pattern as already
    // promoted forever, silently blocking legitimate re-promotion.
    const stores = setup(() => "2026-04-01T00:00:00.000Z");
    const { pattern } = await seedPatternWithSighting(stores, { statement: "Uses staccato rhythm" });
    await stores.hono.request(post(`/patterns/${pattern.id}/classify`, { status: "intentional", promote: true }));
    await stores.hono.request(post(`/patterns/${pattern.id}/retire`));
    await stores.hono.request(post(`/patterns/${pattern.id}/reactivate`));

    const res = await stores.hono.request(
      post(`/patterns/${pattern.id}/classify`, { status: "intentional", promote: true }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ruleId).toBeDefined();

    const profile = await stores.profileStore.get();
    expect(profile.rules).toHaveLength(1);
  });

  test("reactivate returns a retired pattern to undecided and clears retirement markers", async () => {
    const stores = setup(() => "2026-04-01T00:00:00.000Z");
    const { pattern } = await seedPatternWithSighting(stores, { statement: "Pattern A" });
    await stores.hono.request(post(`/patterns/${pattern.id}/dismiss`));

    const res = await stores.hono.request(post(`/patterns/${pattern.id}/reactivate`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("undecided");
    expect(body.retirement).toBeUndefined();
  });

  test("rejects reactivating a pattern that isn't retired", async () => {
    const stores = setup(() => "2026-04-01T00:00:00.000Z");
    const { pattern } = await seedPatternWithSighting(stores, { statement: "Pattern A" });

    const res = await stores.hono.request(post(`/patterns/${pattern.id}/reactivate`));
    expect(res.status).toBe(409);
  });
});

describe("POST /patterns/:id/proposal", () => {
  test("accept creates an evidence-confirmed rule when the pattern meets promotion thresholds", async () => {
    const now = () => "2026-04-01T00:00:00.000Z";
    const stores = setup(now);
    const { entryStore, observationStore, patternStore, profileStore, hono } = stores;

    const pattern = await patternStore.create({ statement: "Uses staccato rhythm for emphasis", dimension: "sentence-rhythm" });
    await patternStore.updateStatus(pattern.id, "intentional");

    // 3 sightings across 3 distinct entries, >= 2000 words total (REQ-LPC-14).
    const longBody = "word ".repeat(700).trim();
    for (let i = 0; i < 3; i++) {
      const entry = await entryStore.create(longBody);
      const obs = await observationStore.save(
        entry.id,
        { pattern: pattern.statement, evidence: [longBody.slice(0, 10)], dimension: "sentence-rhythm" },
        pattern.id,
      );
      await patternStore.recordSighting(pattern.id, {
        id: obs.id, patternId: pattern.id, entryId: entry.id, evidence: obs.evidence, dimension: obs.dimension, createdAt: obs.createdAt,
      });
    }

    const res = await hono.request(post(`/patterns/${pattern.id}/proposal`, { action: "accept" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ruleId).toBeDefined();
    expect(body.rule.provenance).toBe("evidence-confirmed");

    const profile = await profileStore.get();
    expect(profile.rules).toHaveLength(1);
    expect(profile.rules[0].provenance).toBe("evidence-confirmed");
  });

  test("accept is rejected when the pattern no longer meets thresholds, and creates no rule", async () => {
    const stores = setup(() => "2026-04-01T00:00:00.000Z");
    // Only a single sighting: below every threshold.
    const { pattern } = await seedPatternWithSighting(stores, { statement: "Pattern A" });
    await stores.patternStore.updateStatus(pattern.id, "intentional");

    const res = await stores.hono.request(post(`/patterns/${pattern.id}/proposal`, { action: "accept" }));
    expect(res.status).toBe(409);

    const profile = await stores.profileStore.get();
    expect(profile.rules).toHaveLength(0);
  });

  test("decline calls declineProposal and creates no rule", async () => {
    const stores = setup(() => "2026-04-01T00:00:00.000Z");
    const { pattern } = await seedPatternWithSighting(stores, { statement: "Pattern A" });
    await stores.patternStore.updateStatus(pattern.id, "intentional");

    const res = await stores.hono.request(post(`/patterns/${pattern.id}/proposal`, { action: "decline" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.proposalDeclinedAt).toBeDefined();

    const profile = await stores.profileStore.get();
    expect(profile.rules).toHaveLength(0);
  });

  test("rejects an invalid action value", async () => {
    const stores = setup(() => "2026-04-01T00:00:00.000Z");
    const { pattern } = await seedPatternWithSighting(stores, { statement: "Pattern A" });

    const res = await stores.hono.request(post(`/patterns/${pattern.id}/proposal`, { action: "bogus" }));
    expect(res.status).toBe(400);
  });
});

describe("GET /patterns/session: proposals and events", () => {
  test("session includes a proposal for an intentional pattern crossing thresholds, and emits pattern:proposal once", async () => {
    const eventBus = createEventBus();
    const events: unknown[] = [];
    eventBus.subscribe("pattern:proposal", (e) => events.push(e));

    const stores = setup(() => "2026-04-01T00:00:00.000Z", DEFAULT_CONFIG, eventBus);
    const { entryStore, observationStore, patternStore, hono } = stores;

    const pattern = await patternStore.create({ statement: "Uses staccato rhythm for emphasis", dimension: "sentence-rhythm" });
    await patternStore.updateStatus(pattern.id, "intentional");

    const longBody = "word ".repeat(700).trim();
    for (let i = 0; i < 3; i++) {
      const entry = await entryStore.create(longBody);
      const obs = await observationStore.save(
        entry.id,
        { pattern: pattern.statement, evidence: [longBody.slice(0, 10)], dimension: "sentence-rhythm" },
        pattern.id,
      );
      await patternStore.recordSighting(pattern.id, {
        id: obs.id, patternId: pattern.id, entryId: entry.id, evidence: obs.evidence, dimension: obs.dimension, createdAt: obs.createdAt,
      });
    }

    const session1 = await (await hono.request(req("/patterns/session"))).json();
    expect(session1.proposals).toHaveLength(1);
    expect(session1.proposals[0].patternId).toBe(pattern.id);
    expect(events).toHaveLength(1);

    // A second session-assembly call must not re-emit the same proposal.
    await hono.request(req("/patterns/session"));
    expect(events).toHaveLength(1);
  });

  test("dismissed patterns never appear in the session's dossiers or watch list", async () => {
    const stores = setup(() => "2026-04-01T00:00:00.000Z");
    const { pattern } = await seedPatternWithSighting(stores, { statement: "Pattern A" });
    await stores.hono.request(post(`/patterns/${pattern.id}/dismiss`));

    const session = await (await stores.hono.request(req("/patterns/session"))).json();
    expect(session.dossiers).toEqual([]);
    expect(session.watchList).toEqual([]);
  });
});

describe("GET /patterns/session: watch resolution (REQ-LPC-25)", () => {
  /**
   * End-to-end coverage for resolveWatchesAndEmit: a qualitative watch (no
   * metricLink, so classify-accidental leaves baseline undefined) resolves
   * once `qualitativeWatchWindow` consecutive entries pass with no sighting
   * of the watched pattern. Uses a mutable clock so snapshots can be dated
   * strictly after watch.classifiedAt, matching substrate.ts's watchResolution
   * contract (snapshotsSince filters on `s.date >= watch.classifiedAt`).
   */
  test("a qualitative watch resolves after a silent window, persisting resolved/resolvedAt and emitting pattern:watch-resolved", async () => {
    const eventBus = createEventBus();
    const resolvedEvents: unknown[] = [];
    eventBus.subscribe("pattern:watch-resolved", (e) => resolvedEvents.push(e));

    let clock = Date.parse("2026-04-01T00:00:00.000Z");
    const now = () => new Date(clock).toISOString();
    // Small window so the test doesn't need 10 filler snapshots.
    const config: Config = { ...DEFAULT_CONFIG, qualitativeWatchWindow: 2 };

    const stores = setup(now, config, eventBus);
    const { pattern } = await seedPatternWithSighting(stores, {
      statement: "Overuses hedging",
      dimension: "word-level-habits",
    });

    // Classify accidental: opens a watch. No metricLink on this pattern, so
    // baseline stays undefined and watchResolution takes the qualitative
    // branch (REQ-LPC-25's asymmetric computable/qualitative resolution).
    const classifyRes = await stores.hono.request(post(`/patterns/${pattern.id}/classify`, { status: "accidental" }));
    expect(classifyRes.status).toBe(200);
    const classified = await classifyRes.json();
    expect(classified.watch.classifiedAt).toBe(now());
    expect(classified.watch.baseline).toBeUndefined();

    // Two snapshots dated after classification, from entries with no
    // sighting of the watched pattern — satisfies qualitativeWatchWindow=2's
    // "no sighting in the full window" condition.
    clock += 24 * 60 * 60 * 1000;
    await stores.snapshotStore.save("entry-silent-1", {
      entryId: "entry-silent-1",
      date: now(),
      metrics: computeEntryMetrics("A quiet entry with nothing notable."),
      schemaVersion: 1,
    });
    clock += 24 * 60 * 60 * 1000;
    await stores.snapshotStore.save("entry-silent-2", {
      entryId: "entry-silent-2",
      date: now(),
      metrics: computeEntryMetrics("Another quiet entry, still nothing notable."),
      schemaVersion: 1,
    });

    const resolvedAtBeforeCall = now();
    const session = await (await stores.hono.request(req("/patterns/session"))).json();

    // Persisted: re-reading the pattern store shows resolved/resolvedAt, not
    // just the route's response for this one call.
    const stored = await stores.patternStore.get(pattern.id);
    expect(stored?.watch?.resolved).toBe(true);
    expect(stored?.watch?.resolvedAt).toBe(resolvedAtBeforeCall);

    // The session response reflects the same up-to-date watch state.
    const sessionEntry = session.watchList.find((d: { pattern: { id: string } }) => d.pattern.id === pattern.id);
    expect(sessionEntry).toBeDefined();
    expect(sessionEntry.pattern.watch.resolved).toBe(true);

    expect(resolvedEvents).toHaveLength(1);
    expect(resolvedEvents[0]).toEqual({
      patternId: pattern.id,
      resolvedAt: resolvedAtBeforeCall,
      kind: "qualitative",
    });

    // A second session-assembly call must not re-resolve or re-emit.
    await stores.hono.request(req("/patterns/session"));
    expect(resolvedEvents).toHaveLength(1);
  });
});

describe("GET /patterns/session: rule health resurfacing (REQ-LPC-19/20/21)", () => {
  /** Promotes a pattern's single sighting into a writer-asserted rule via the classify-and-promote action, returning the created rule's id. */
  async function promoteToRule(stores: ReturnType<typeof setup>, patternId: string): Promise<string> {
    const res = await stores.hono.request(
      post(`/patterns/${patternId}/classify`, { status: "intentional", promote: true }),
    );
    const body = await res.json();
    return body.ruleId as string;
  }

  test("a rule whose pattern has no sighting in the configured window resurfaces for reaffirm-or-retire", async () => {
    // Small window so the test doesn't need many filler entries.
    const config: Config = { ...DEFAULT_CONFIG, stalenessWindow: 2 };
    const stores = setup(() => "2026-04-01T00:00:00.000Z", config);
    const { pattern } = await seedPatternWithSighting(stores, { statement: "Uses staccato rhythm" });
    const ruleId = await promoteToRule(stores, pattern.id);

    // Two more entries (with snapshots) submitted with no further sighting
    // of the pattern — exceeds stalenessWindow=2, so the pattern's only
    // sighting is now outside the recent-entries window.
    await stores.snapshotStore.save("entry-silent-1", {
      entryId: "entry-silent-1",
      date: "2026-04-02T00:00:00.000Z",
      metrics: computeEntryMetrics("A quiet entry with nothing notable."),
      schemaVersion: 1,
    });
    await stores.snapshotStore.save("entry-silent-2", {
      entryId: "entry-silent-2",
      date: "2026-04-03T00:00:00.000Z",
      metrics: computeEntryMetrics("Another quiet entry, still nothing notable."),
      schemaVersion: 1,
    });

    const session = await (await stores.hono.request(req("/patterns/session"))).json();
    expect(session.resurfacedRules).toHaveLength(1);
    expect(session.resurfacedRules[0].rule.id).toBe(ruleId);
    expect(session.resurfacedRules[0].pattern.id).toBe(pattern.id);
    expect(session.resurfacedRules[0].reasons).toEqual(["stale"]);
  });

  test("nothing auto-mutates: repeated session assembly never changes the stale rule or retires the pattern", async () => {
    const config: Config = { ...DEFAULT_CONFIG, stalenessWindow: 2 };
    const stores = setup(() => "2026-04-01T00:00:00.000Z", config);
    const { pattern } = await seedPatternWithSighting(stores, { statement: "Uses staccato rhythm" });
    const ruleId = await promoteToRule(stores, pattern.id);
    await stores.snapshotStore.save("entry-silent-1", {
      entryId: "entry-silent-1", date: "2026-04-02T00:00:00.000Z",
      metrics: computeEntryMetrics("A quiet entry."), schemaVersion: 1,
    });
    await stores.snapshotStore.save("entry-silent-2", {
      entryId: "entry-silent-2", date: "2026-04-03T00:00:00.000Z",
      metrics: computeEntryMetrics("Another quiet entry."), schemaVersion: 1,
    });

    await stores.hono.request(req("/patterns/session"));
    await stores.hono.request(req("/patterns/session"));

    const ruleAfter = await stores.profileStore.getRule(ruleId);
    expect(ruleAfter).toBeDefined();
    expect(ruleAfter!.lastSupportedAt).toBeUndefined();

    const patternAfter = await stores.patternStore.get(pattern.id);
    expect(patternAfter?.status).toBe("intentional");
  });

  test("retiring a resurfaced rule's pattern removes the rule and retires the pattern (confirms both sides)", async () => {
    const config: Config = { ...DEFAULT_CONFIG, stalenessWindow: 2 };
    const stores = setup(() => "2026-04-01T00:00:00.000Z", config);
    const { pattern } = await seedPatternWithSighting(stores, { statement: "Uses staccato rhythm" });
    await promoteToRule(stores, pattern.id);
    await stores.snapshotStore.save("entry-silent-1", {
      entryId: "entry-silent-1", date: "2026-04-02T00:00:00.000Z",
      metrics: computeEntryMetrics("A quiet entry."), schemaVersion: 1,
    });
    await stores.snapshotStore.save("entry-silent-2", {
      entryId: "entry-silent-2", date: "2026-04-03T00:00:00.000Z",
      metrics: computeEntryMetrics("Another quiet entry."), schemaVersion: 1,
    });

    const before = await (await stores.hono.request(req("/patterns/session"))).json();
    expect(before.resurfacedRules).toHaveLength(1);

    // Retire is reached the same way as any other pattern-grain action —
    // there is no separate "retire this resurfaced rule" endpoint.
    const retireRes = await stores.hono.request(post(`/patterns/${pattern.id}/retire`));
    expect(retireRes.status).toBe(200);

    const patternAfter = await stores.patternStore.get(pattern.id);
    expect(patternAfter?.status).toBe("retired");

    const profileAfter = await stores.profileStore.get();
    expect(profileAfter.rules).toHaveLength(0);

    const after = await (await stores.hono.request(req("/patterns/session"))).json();
    expect(after.resurfacedRules).toEqual([]);
  });
});

describe("POST /patterns/:id/reaffirm", () => {
  test("reaffirm sets the linked rule's lastSupportedAt to now", async () => {
    const stores = setup(() => "2026-04-01T00:00:00.000Z");
    const { pattern } = await seedPatternWithSighting(stores, { statement: "Uses staccato rhythm" });
    const classifyRes = await stores.hono.request(
      post(`/patterns/${pattern.id}/classify`, { status: "intentional", promote: true }),
    );
    const { ruleId } = await classifyRes.json();

    const ruleBefore = await stores.profileStore.getRule(ruleId);
    expect(ruleBefore!.lastSupportedAt).toBeUndefined();

    const res = await stores.hono.request(post(`/patterns/${pattern.id}/reaffirm`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.lastSupportedAt).toBe("2026-04-01T00:00:00.000Z");

    // Persisted, not just the route's response.
    const ruleAfter = await stores.profileStore.getRule(ruleId);
    expect(ruleAfter!.lastSupportedAt).toBe("2026-04-01T00:00:00.000Z");
  });

  test("returns 409 when the pattern has no linked rule", async () => {
    const stores = setup(() => "2026-04-01T00:00:00.000Z");
    const { pattern } = await seedPatternWithSighting(stores, { statement: "Pattern A" });

    const res = await stores.hono.request(post(`/patterns/${pattern.id}/reaffirm`));
    expect(res.status).toBe(409);
  });

  test("returns 404 for an unknown pattern", async () => {
    const stores = setup(() => "2026-04-01T00:00:00.000Z");
    const res = await stores.hono.request(post("/patterns/pat-nonexistent/reaffirm"));
    expect(res.status).toBe(404);
  });
});
