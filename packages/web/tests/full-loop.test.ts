import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApp } from "../../daemon/src/app.js";
import { createEntryStore } from "../../daemon/src/entry-store.js";
import { createObservationStore } from "../../daemon/src/observation-store.js";
import { createProfileStore } from "../../daemon/src/profile-store.js";
import { createEntryRoutes } from "../../daemon/src/routes/entries.js";
import { createObservationRoutes } from "../../daemon/src/routes/observations.js";
import { createProfileRoutes } from "../../daemon/src/routes/profile.js";
import { createEventsRoutes } from "../../daemon/src/routes/events.js";
import { createEventBus } from "../../daemon/src/event-bus.js";
import type { Hono } from "hono";
import type { Entry, Observation, CurationSession, Profile, ObservationDimension } from "@ink-mirror/shared";

/**
 * Full loop integration test through the daemon API.
 * Simulates: write entry -> observe -> curate -> verify profile.
 *
 * Uses mocked observer (no LLM) to produce known observations,
 * then verifies the complete flow through curation to profile.
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

describe("full loop integration", () => {
  let dataDir: string;
  let hono: Hono;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "ink-mirror-loop-test-"));
    const entryStore = createEntryStore({ entriesDir: join(dataDir, "entries") });
    const observationStore = createObservationStore({ observationsDir: join(dataDir, "observations") });
    const profileStore = createProfileStore({ profilePath: join(dataDir, "profile.md") });
    const eventBus = createEventBus();

    // Mock observer: produces a known observation for every entry
    // Mock observer: produces a known observation for every entry.
    // Does NOT emit to eventBus here; the entries route handles that.
    const onEntryCreated = async (entryId: string, _entryText: string) => {
      const obs = await observationStore.save(entryId, {
        pattern: "Uses short declarative sentences for emphasis",
        evidence: "Short sentence.",
        dimension: "sentence-rhythm",
      });
      return { observations: [obs], errors: [] };
    };

    const entryRoutes = createEntryRoutes({ entryStore, onEntryCreated, eventBus });
    const observationRoutes = createObservationRoutes({
      observationStore,
      entryStore,
      onIntentional: async (pattern, dimension) => {
        await profileStore.addOrMergeRule(pattern, dimension as ObservationDimension);
      },
    });
    const profileRoutes = createProfileRoutes({ profileStore });
    const eventsRoutes = createEventsRoutes({ eventBus });

    const app = createApp({
      routeModules: [entryRoutes, observationRoutes, profileRoutes, eventsRoutes],
      eventBus,
    });
    hono = app.hono;
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

    // Step 2: Verify observation appears in curation session
    const pendingRes = await hono.request(req("/observations/pending"));
    expect(pendingRes.status).toBe(200);
    const session: CurationSession = await pendingRes.json();
    expect(session.observations.length).toBeGreaterThan(0);

    const obsToClassify = session.observations[0];
    expect(obsToClassify.entryText).toBeDefined();

    // Step 3: Classify as intentional
    const classifyRes = await hono.request(
      req(`/observations/${obsToClassify.id}`, {
        method: "PATCH",
        body: { status: "intentional" },
      }),
    );
    expect(classifyRes.status).toBe(200);
    const classified: Observation & { profileUpdated: boolean } = await classifyRes.json();
    expect(classified.status).toBe("intentional");
    expect(classified.profileUpdated).toBe(true);

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
    expect(observations[0].status).toBe("pending");

    const pendingRes = await hono.request(req("/observations?status=pending"));
    const pending: Observation[] = await pendingRes.json();
    expect(pending.length).toBe(observations.length);
  });

  test("profile is editable after rule creation", async () => {
    // Create entry and classify observation
    const createRes = await hono.request(
      req("/entries", { method: "POST", body: { body: "Entry." } }),
    );
    const entry: Entry & { observations?: Observation[] } = await createRes.json();

    if (entry.observations && entry.observations.length > 0) {
      await hono.request(
        req(`/observations/${entry.observations[0].id}`, {
          method: "PATCH",
          body: { status: "intentional" },
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
    // Set up a separate app with sentence-structure observations
    const dataDir3 = mkdtempSync(join(tmpdir(), "ink-mirror-dim3-test-"));
    const entryStore = createEntryStore({ entriesDir: join(dataDir3, "entries") });
    const observationStore = createObservationStore({ observationsDir: join(dataDir3, "observations") });
    const profileStore = createProfileStore({ profilePath: join(dataDir3, "profile.md") });
    const eventBus = createEventBus();

    const onEntryCreated = async (entryId: string, _entryText: string) => {
      const obs = await observationStore.save(entryId, {
        pattern: "Favors compound sentences joined by conjunctions",
        evidence: "Multiple clauses connected with 'and' or 'but'.",
        dimension: "sentence-structure",
      });
      return { observations: [obs], errors: [] };
    };

    const entryRoutes = createEntryRoutes({ entryStore, onEntryCreated, eventBus });
    const observationRoutes = createObservationRoutes({
      observationStore,
      entryStore,
      onIntentional: async (pattern, dimension) => {
        await profileStore.addOrMergeRule(pattern, dimension as ObservationDimension);
      },
    });
    const profileRoutes = createProfileRoutes({ profileStore });
    const eventsRoutes = createEventsRoutes({ eventBus });

    const app = createApp({
      routeModules: [entryRoutes, observationRoutes, profileRoutes, eventsRoutes],
      eventBus,
    });

    // Create entry
    const createRes = await app.hono.request(
      req("/entries", {
        method: "POST",
        body: { body: "She walked and she talked, but she never stopped." },
      }),
    );
    expect(createRes.status).toBe(201);

    // Get pending observations
    const pendingRes = await app.hono.request(req("/observations/pending"));
    const session: CurationSession = await pendingRes.json();
    expect(session.observations.length).toBeGreaterThan(0);
    expect(session.observations[0].dimension).toBe("sentence-structure");

    // Classify as intentional
    const classifyRes = await app.hono.request(
      req(`/observations/${session.observations[0].id}`, {
        method: "PATCH",
        body: { status: "intentional" },
      }),
    );
    expect(classifyRes.status).toBe(200);

    // Verify profile
    const profileRes = await app.hono.request(req("/profile"));
    const profile: Profile & { markdown: string } = await profileRes.json();
    expect(profile.rules.length).toBeGreaterThan(0);
    expect(profile.rules[0].dimension).toBe("sentence-structure");
    expect(profile.rules[0].pattern).toBe("Favors compound sentences joined by conjunctions");

    rmSync(dataDir3, { recursive: true, force: true });
  });

  test("EventBus receives observation events during entry creation", async () => {
    const eventBus = createEventBus();
    const received: Observation[] = [];
    eventBus.subscribe<Observation>("observation:created", (obs) => {
      received.push(obs);
    });

    const dataDir2 = mkdtempSync(join(tmpdir(), "ink-mirror-evt-test-"));
    const entryStore = createEntryStore({ entriesDir: join(dataDir2, "entries") });
    const observationStore = createObservationStore({ observationsDir: join(dataDir2, "observations") });
    const profileStore = createProfileStore({ profilePath: join(dataDir2, "profile.md") });

    // The entries route emits to eventBus after onEntryCreated returns
    const onEntryCreated = async (entryId: string, _entryText: string) => {
      const obs = await observationStore.save(entryId, {
        pattern: "Streamed observation",
        evidence: "test text",
        dimension: "word-level-habits",
      });
      return { observations: [obs], errors: [] };
    };

    const entryRoutes = createEntryRoutes({ entryStore, onEntryCreated, eventBus });
    const observationRoutes = createObservationRoutes({
      observationStore,
      entryStore,
      onIntentional: async () => {},
    });
    const profileRoutes = createProfileRoutes({ profileStore });
    const eventsRoutes = createEventsRoutes({ eventBus });

    const app = createApp({
      routeModules: [entryRoutes, observationRoutes, profileRoutes, eventsRoutes],
      eventBus,
    });

    await app.hono.request(
      req("/entries", { method: "POST", body: { body: "test text for streaming" } }),
    );

    expect(received).toHaveLength(1);
    expect(received[0].pattern).toBe("Streamed observation");
    expect(received[0].dimension).toBe("word-level-habits");

    rmSync(dataDir2, { recursive: true, force: true });
  });
});
