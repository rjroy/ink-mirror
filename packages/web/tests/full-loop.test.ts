import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApp } from "../../daemon/src/app.js";
import { createEntryStore } from "../../daemon/src/entry-store.js";
import { createObservationStore } from "../../daemon/src/observation-store.js";
import { createPatternStore } from "../../daemon/src/pattern-store.js";
import { createSnapshotStore } from "../../daemon/src/snapshot-store.js";
import { createProfileStore } from "../../daemon/src/profile-store.js";
import { DEFAULT_CONFIG } from "../../daemon/src/config.js";
import { createEntryRoutes } from "../../daemon/src/routes/entries.js";
import { createObservationRoutes } from "../../daemon/src/routes/observations.js";
import { createPatternRoutes } from "../../daemon/src/routes/patterns.js";
import { createProfileRoutes } from "../../daemon/src/routes/profile.js";
import { createEventsRoutes } from "../../daemon/src/routes/events.js";
import { createEventBus } from "../../daemon/src/event-bus.js";
import type { Hono } from "hono";
import type { Entry, Observation, Profile, PatternCurationSession } from "@ink-mirror/shared";

/**
 * Full loop integration test through the daemon API.
 * Simulates: write entry -> observe -> curate -> verify profile.
 *
 * Uses a mocked observer (no LLM) that resolves every entry to a known
 * pattern + sighting, then verifies the complete flow through the
 * pattern-grain curation surface (REQ-LPC-28) to the profile. Classification
 * moved off routes/observations.ts entirely in Phase 4: this suite now
 * exercises POST /patterns/:id/classify (with { promote: true }) instead of
 * the removed PATCH /observations/:id + onIntentional side effect.
 */

function req(path: string, opts?: { method?: string; body?: unknown }): Request {
  const method = opts?.method ?? "GET";
  const init: RequestInit = { method };
  if (opts?.body) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(opts.body);
  }
  return new Request(`http://localhost${path}`, init);
}

/** Wires up a full daemon app instance (entries/observations/patterns/profile/events) rooted at `dataDir`, with a mock observer that turns every entry into one sighting of a fixed-statement pattern. */
function buildApp(dataDir: string, statement: string, dimension: "sentence-rhythm" | "sentence-structure" | "word-level-habits") {
  const entryStore = createEntryStore({ entriesDir: join(dataDir, "entries") });
  const observationStore = createObservationStore({ observationsDir: join(dataDir, "observations") });
  const patternStore = createPatternStore({ patternsDir: join(dataDir, "patterns") });
  const snapshotStore = createSnapshotStore({ snapshotsDir: join(dataDir, "snapshots") });
  const profileStore = createProfileStore({ profilePath: join(dataDir, "profile.md") });
  const eventBus = createEventBus();

  // Mock observer: resolves every entry to one sighting of a fixed pattern,
  // matching what observer.ts's resolveAndStoreObservation does for a
  // ledger match/discovery, just without the LLM round-trip.
  const onEntryCreated = async (entryId: string, entryText: string) => {
    const existing = (await patternStore.list()).find((p) => p.statement === statement);
    const pattern = existing ?? (await patternStore.create({ statement, dimension }));
    const obs = await observationStore.save(entryId, { pattern: statement, evidence: [entryText], dimension }, pattern.id);
    await patternStore.recordSighting(pattern.id, {
      id: obs.id, patternId: pattern.id, entryId, evidence: obs.evidence, dimension: obs.dimension, createdAt: obs.createdAt,
    });
    return { observations: [obs], errors: [], discoveries: existing ? [] : [pattern] };
  };

  const entryRoutes = createEntryRoutes({ entryStore, onEntryCreated, eventBus });
  const observationRoutes = createObservationRoutes({ observationStore });
  const patternRoutes = createPatternRoutes({
    patternStore,
    observationStore,
    entryStore,
    snapshotStore,
    profileStore,
    config: DEFAULT_CONFIG,
    eventBus,
  });
  const profileRoutes = createProfileRoutes({ profileStore });
  const eventsRoutes = createEventsRoutes({ eventBus });

  const app = createApp({
    routeModules: [entryRoutes, observationRoutes, patternRoutes, profileRoutes, eventsRoutes],
    eventBus,
  });

  return { hono: app.hono, eventBus, entryStore, observationStore, patternStore, profileStore };
}

describe("full loop integration", () => {
  let dataDir: string;
  let hono: Hono;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "ink-mirror-loop-test-"));
    ({ hono } = buildApp(dataDir, "Uses short declarative sentences for emphasis", "sentence-rhythm"));
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  test("write -> observe -> curate -> profile", async () => {
    // Step 1: Write entry
    const createRes = await hono.request(
      req("/entries", {
        method: "POST",
        body: { body: "Short sentence. Another short one. Then a longer sentence that flows." },
      }),
    );
    expect(createRes.status).toBe(201);
    const entry: Entry & { observations?: Observation[] } = await createRes.json();
    expect(entry.id).toBeDefined();
    expect(entry.observations).toBeDefined();
    expect(entry.observations!.length).toBeGreaterThan(0);

    // Step 2: Verify the sighting appears in the pattern curation session
    const sessionRes = await hono.request(req("/patterns/session"));
    expect(sessionRes.status).toBe(200);
    const session: PatternCurationSession = await sessionRes.json();
    expect(session.dossiers.length).toBeGreaterThan(0);

    const dossier = session.dossiers[0];
    expect(dossier.sightings[0].entryText).toBeDefined();

    // Step 3: Classify-and-promote the pattern in one action (REQ-LPC-16)
    const classifyRes = await hono.request(
      req(`/patterns/${dossier.pattern.id}/classify`, {
        method: "POST",
        body: { status: "intentional", promote: true },
      }),
    );
    expect(classifyRes.status).toBe(200);
    const classified = await classifyRes.json();
    expect(classified.status).toBe("intentional");
    expect(classified.ruleId).toBeDefined();

    // Step 4: Verify profile has the new rule
    const profileRes = await hono.request(req("/profile"));
    expect(profileRes.status).toBe(200);
    const profile: Profile & { markdown: string } = await profileRes.json();
    expect(profile.rules.length).toBeGreaterThan(0);
    expect(profile.rules[0].pattern).toBe("Uses short declarative sentences for emphasis");
    expect(profile.rules[0].dimension).toBe("sentence-rhythm");
  });

  test("entry created via one client visible via another (REQ-V1-25)", async () => {
    // Create entry (simulates CLI POST)
    const createRes = await hono.request(
      req("/entries", {
        method: "POST",
        body: { body: "CLI-created entry with unique content 12345." },
      }),
    );
    const created: Entry = await createRes.json();

    // Read entry back (simulates web GET)
    const readRes = await hono.request(req(`/entries/${created.id}`));
    const entry: Entry = await readRes.json();
    expect(entry.body).toBe("CLI-created entry with unique content 12345.");

    // List entries (simulates web list view)
    const listRes = await hono.request(req("/entries"));
    const list = await listRes.json();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(created.id);
  });

  test("observations accessible after entry creation", async () => {
    await hono.request(
      req("/entries", {
        method: "POST",
        body: { body: "Entry that generates observations." },
      }),
    );

    const obsRes = await hono.request(req("/observations"));
    expect(obsRes.status).toBe(200);
    const observations: Observation[] = await obsRes.json();
    expect(observations.length).toBeGreaterThan(0);
  });

  test("profile is editable after rule creation", async () => {
    // Create entry and classify-and-promote its pattern
    const createRes = await hono.request(
      req("/entries", { method: "POST", body: { body: "Entry." } }),
    );
    const entry: Entry & { observations?: Observation[] } = await createRes.json();

    if (entry.observations && entry.observations.length > 0) {
      const patternId = entry.observations[0].patternId;
      await hono.request(
        req(`/patterns/${patternId}/classify`, {
          method: "POST",
          body: { status: "intentional", promote: true },
        }),
      );
    }

    // Get profile
    const profileRes = await hono.request(req("/profile"));
    const profile: Profile = await profileRes.json();

    if (profile.rules.length > 0) {
      // Edit rule
      const editRes = await hono.request(
        req(`/profile/rules/${profile.rules[0].id}`, {
          method: "PATCH",
          body: { pattern: "Updated pattern description" },
        }),
      );
      expect(editRes.status).toBe(200);

      // Verify edit persisted
      const verifyRes = await hono.request(req("/profile"));
      const updated: Profile = await verifyRes.json();
      expect(updated.rules[0].pattern).toBe("Updated pattern description");

      // Delete rule
      const deleteRes = await hono.request(
        req(`/profile/rules/${profile.rules[0].id}`, { method: "DELETE" }),
      );
      expect(deleteRes.status).toBe(200);

      // Verify deletion
      const finalRes = await hono.request(req("/profile"));
      const final: Profile = await finalRes.json();
      expect(final.rules).toHaveLength(0);
    }
  });

  test("sentence-structure dimension flows through full loop", async () => {
    const dataDir3 = mkdtempSync(join(tmpdir(), "ink-mirror-dim3-test-"));
    const { hono: hono3 } = buildApp(
      dataDir3,
      "Favors compound sentences joined by conjunctions",
      "sentence-structure",
    );

    // Create entry
    const createRes = await hono3.request(
      req("/entries", {
        method: "POST",
        body: { body: "She walked and she talked, but she never stopped." },
      }),
    );
    expect(createRes.status).toBe(201);

    // Get curation session
    const sessionRes = await hono3.request(req("/patterns/session"));
    const session: PatternCurationSession = await sessionRes.json();
    expect(session.dossiers.length).toBeGreaterThan(0);
    expect(session.dossiers[0].pattern.dimension).toBe("sentence-structure");

    // Classify-and-promote
    const classifyRes = await hono3.request(
      req(`/patterns/${session.dossiers[0].pattern.id}/classify`, {
        method: "POST",
        body: { status: "intentional", promote: true },
      }),
    );
    expect(classifyRes.status).toBe(200);

    // Verify profile
    const profileRes = await hono3.request(req("/profile"));
    const profile: Profile & { markdown: string } = await profileRes.json();
    expect(profile.rules.length).toBeGreaterThan(0);
    expect(profile.rules[0].dimension).toBe("sentence-structure");
    expect(profile.rules[0].pattern).toBe("Favors compound sentences joined by conjunctions");

    rmSync(dataDir3, { recursive: true, force: true });
  });

  test("EventBus receives observation and pattern:discovered events during entry creation", async () => {
    const dataDir2 = mkdtempSync(join(tmpdir(), "ink-mirror-evt-test-"));
    const { hono: hono2, eventBus } = buildApp(dataDir2, "Streamed observation", "word-level-habits");

    const receivedObs: Observation[] = [];
    const receivedDiscoveries: unknown[] = [];
    eventBus.subscribe<Observation>("observation:created", (obs) => receivedObs.push(obs));
    eventBus.subscribe("pattern:discovered", (event) => receivedDiscoveries.push(event));

    await hono2.request(
      req("/entries", { method: "POST", body: { body: "test text for streaming" } }),
    );

    expect(receivedObs).toHaveLength(1);
    expect(receivedObs[0].pattern).toBe("Streamed observation");
    expect(receivedObs[0].dimension).toBe("word-level-habits");
    expect(receivedDiscoveries).toHaveLength(1);

    rmSync(dataDir2, { recursive: true, force: true });
  });

  test("promotion proposal surfaces once thresholds are crossed, and accept creates an evidence-confirmed rule (REQ-LPC-14/15)", async () => {
    const dataDir4 = mkdtempSync(join(tmpdir(), "ink-mirror-proposal-test-"));
    const { hono: hono4 } = buildApp(
      dataDir4,
      "Leans on em dashes for interruption",
      "sentence-structure",
    );

    // 3 distinct entries, each >=700 words, clear the >=2,000 total-word
    // floor (REQ-LPC-14d) alongside the sighting (>=3) and distinct-entry
    // (>=3) thresholds — all three gates from DEFAULT_CONFIG at once.
    const longEntryBody = (label: string) =>
      Array.from({ length: 700 }, (_, i) => `${label}word${i}`).join(" ");

    let patternId = "";
    for (const label of ["alpha", "beta", "gamma"]) {
      const createRes = await hono4.request(
        req("/entries", { method: "POST", body: { body: longEntryBody(label) } }),
      );
      expect(createRes.status).toBe(201);
      const entry: Entry & { observations?: Observation[] } = await createRes.json();
      patternId = entry.observations![0].patternId;
    }

    // Below threshold check: before classification, an intentional-only gate
    // (REQ-LPC-14a) means this pattern must not yet appear as a proposal.
    const preClassifySession = await hono4.request(req("/patterns/session"));
    const preClassify = await preClassifySession.json();
    expect(preClassify.proposals.some((p: { patternId: string }) => p.patternId === patternId)).toBe(false);

    const classifyRes = await hono4.request(
      req(`/patterns/${patternId}/classify`, { method: "POST", body: { status: "intentional" } }),
    );
    expect(classifyRes.status).toBe(200);
    const classified = await classifyRes.json();
    expect(classified.ruleId).toBeUndefined();

    const sessionRes = await hono4.request(req("/patterns/session"));
    const session = await sessionRes.json();
    const proposal = session.proposals.find((p: { patternId: string }) => p.patternId === patternId);
    expect(proposal).toBeDefined();
    expect(proposal.sightingCount).toBeGreaterThanOrEqual(3);
    expect(proposal.distinctEntryCount).toBeGreaterThanOrEqual(3);
    expect(proposal.totalWordCount).toBeGreaterThanOrEqual(2000);

    const acceptRes = await hono4.request(
      req(`/patterns/${patternId}/proposal`, { method: "POST", body: { action: "accept" } }),
    );
    expect(acceptRes.status).toBe(200);
    const accepted = await acceptRes.json();
    expect(accepted.ruleId).toBeDefined();
    expect(accepted.rule.provenance).toBe("evidence-confirmed");

    const profileRes = await hono4.request(req("/profile"));
    const profile: Profile = await profileRes.json();
    expect(profile.rules.some((r) => r.patternId === patternId && r.provenance === "evidence-confirmed")).toBe(true);

    rmSync(dataDir4, { recursive: true, force: true });
  });

  test("classifying a pattern accidental starts a watch that reports recurrence in the session's watchList (REQ-LPC-23/24)", async () => {
    const dataDir5 = mkdtempSync(join(tmpdir(), "ink-mirror-watch-test-"));
    const { hono: hono5 } = buildApp(dataDir5, "Overuses the word 'suddenly'", "word-level-habits");

    const createRes = await hono5.request(
      req("/entries", { method: "POST", body: { body: "Suddenly, everything changed." } }),
    );
    const entry: Entry & { observations?: Observation[] } = await createRes.json();
    const patternId = entry.observations![0].patternId;

    const classifyRes = await hono5.request(
      req(`/patterns/${patternId}/classify`, { method: "POST", body: { status: "accidental" } }),
    );
    expect(classifyRes.status).toBe(200);
    const classified = await classifyRes.json();
    expect(classified.status).toBe("accidental");
    expect(classified.watch).toBeDefined();
    expect(classified.watch.resolved).toBe(false);

    const watchRes = await hono5.request(req("/patterns/watch"));
    expect(watchRes.status).toBe(200);
    const { watchList } = await watchRes.json();
    const watched = watchList.find((d: { pattern: { id: string } }) => d.pattern.id === patternId);
    expect(watched).toBeDefined();
    expect(watched.watchStatus.resolved).toBe(false);
    expect(typeof watched.watchStatus.recurrenceText).toBe("string");
    expect(watched.watchStatus.recurrenceText.length).toBeGreaterThan(0);

    const sessionRes = await hono5.request(req("/patterns/session"));
    const session: PatternCurationSession = await sessionRes.json();
    expect(session.watchList.some((d) => d.pattern.id === patternId)).toBe(true);

    rmSync(dataDir5, { recursive: true, force: true });
  });

  test("dismiss retires a pattern as wrong without starting a watch (planning decision 1)", async () => {
    const dataDir6 = mkdtempSync(join(tmpdir(), "ink-mirror-dismiss-test-"));
    const { hono: hono6 } = buildApp(dataDir6, "Misfired observation", "word-level-habits");

    const createRes = await hono6.request(
      req("/entries", { method: "POST", body: { body: "Not actually a real pattern." } }),
    );
    const entry: Entry & { observations?: Observation[] } = await createRes.json();
    const patternId = entry.observations![0].patternId;

    const dismissRes = await hono6.request(
      req(`/patterns/${patternId}/dismiss`, { method: "POST" }),
    );
    expect(dismissRes.status).toBe(200);
    const dismissed = await dismissRes.json();
    expect(dismissed.status).toBe("retired");
    expect(dismissed.retirement.dismissedAsWrong).toBe(true);
    expect(dismissed.watch).toBeUndefined();

    const watchRes = await hono6.request(req("/patterns/watch"));
    const { watchList } = await watchRes.json();
    expect(watchList.some((d: { pattern: { id: string } }) => d.pattern.id === patternId)).toBe(false);

    rmSync(dataDir6, { recursive: true, force: true });
  });

  test("detach splits a mis-attributed sighting into its own candidate, and merge folds a duplicate back in (REQ-LPC-6)", async () => {
    const dataDir7 = mkdtempSync(join(tmpdir(), "ink-mirror-detach-merge-test-"));
    const { hono: hono7, observationStore, patternStore } = buildApp(
      dataDir7,
      "Uses short declarative sentences for emphasis",
      "sentence-rhythm",
    );

    const createRes = await hono7.request(
      req("/entries", { method: "POST", body: { body: "Short. Sharp. Done." } }),
    );
    const entry: Entry & { observations?: Observation[] } = await createRes.json();
    const sourcePatternId = entry.observations![0].patternId;
    const sightingId = entry.observations![0].id;

    const detachRes = await hono7.request(
      req(`/patterns/${sourcePatternId}/detach`, { method: "POST", body: { sightingId } }),
    );
    expect(detachRes.status).toBe(200);
    const { source, newPattern } = await detachRes.json();
    expect(source.sightingCount).toBe(0);
    expect(newPattern.status).toBe("candidate");
    expect(newPattern.sightingCount).toBe(1);

    // Reversal: merge the detached candidate back into the original pattern
    // (REQ-LPC-6's "visible and reversible"), which requires them to share a
    // dimension — true here since detach preserves the sighting's dimension.
    const mergeRes = await hono7.request(
      req(`/patterns/${sourcePatternId}/merge`, {
        method: "POST",
        body: { duplicateId: newPattern.id },
      }),
    );
    expect(mergeRes.status).toBe(200);
    const merged = await mergeRes.json();
    expect(merged.sightingCount).toBe(1);
    expect(merged.entryIds).toContain(entry.id);

    const reassigned = (await observationStore.list()).find((o) => o.id === sightingId);
    expect(reassigned?.patternId).toBe(sourcePatternId);

    const duplicateAfterMerge = await patternStore.get(newPattern.id);
    expect(duplicateAfterMerge?.status).toBe("retired");
    expect(duplicateAfterMerge?.retirement?.mergedInto).toBe(sourcePatternId);

    rmSync(dataDir7, { recursive: true, force: true });
  });
});
