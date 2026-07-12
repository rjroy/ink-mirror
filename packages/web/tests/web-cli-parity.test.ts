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
import { createPatternRoutes } from "../../daemon/src/routes/patterns.js";
import { createProfileRoutes } from "../../daemon/src/routes/profile.js";
import { createEventsRoutes } from "../../daemon/src/routes/events.js";
import { createEventBus } from "../../daemon/src/event-bus.js";
import { createPatternStore } from "../../daemon/src/pattern-store.js";
import { createSnapshotStore } from "../../daemon/src/snapshot-store.js";
import { DEFAULT_CONFIG } from "../../daemon/src/config.js";
import type { Hono } from "hono";
import type { Entry, EntryListItem, Observation, Profile, PatternCurationSession } from "@ink-mirror/shared";

/**
 * Tests that web API calls produce identical results to CLI calls
 * against the same daemon. Both are rendering surfaces over the same API (REQ-V1-25).
 *
 * These tests use Hono's test client (app.request()) to simulate both
 * web proxy calls and CLI calls hitting the same daemon endpoints.
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

describe("web-cli parity", () => {
  let dataDir: string;
  let hono: Hono;
  let patternStore: ReturnType<typeof createPatternStore>;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "ink-mirror-web-test-"));
    const entryStore = createEntryStore({ entriesDir: join(dataDir, "entries") });
    const observationStore = createObservationStore({ observationsDir: join(dataDir, "observations") });
    patternStore = createPatternStore({ patternsDir: join(dataDir, "patterns") });
    const snapshotStore = createSnapshotStore({ snapshotsDir: join(dataDir, "snapshots") });
    const profileStore = createProfileStore({ profilePath: join(dataDir, "profile.md") });
    const eventBus = createEventBus();

    const entryRoutes = createEntryRoutes({ entryStore, eventBus });
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
    hono = app.hono;
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  test("POST /entries returns identical entry from GET /entries/:id", async () => {
    const createRes = await hono.request(
      req("/entries", { method: "POST", body: { body: "Web test entry.", title: "Test Title" } }),
    );
    expect(createRes.status).toBe(201);
    const created: Entry = await createRes.json();

    const readRes = await hono.request(req(`/entries/${created.id}`));
    expect(readRes.status).toBe(200);
    const entry: Entry = await readRes.json();

    expect(entry.id).toBe(created.id);
    expect(entry.body).toBe("Web test entry.");
    expect(entry.title).toBe("Test Title");
    expect(entry.date).toBe(created.date);
  });

  test("GET /entries returns all entries in list format", async () => {
    await hono.request(req("/entries", { method: "POST", body: { body: "First entry." } }));
    await hono.request(req("/entries", { method: "POST", body: { body: "Second entry." } }));

    const listRes = await hono.request(req("/entries"));
    expect(listRes.status).toBe(200);
    const list: EntryListItem[] = await listRes.json();

    expect(list).toHaveLength(2);
    expect(list[0].preview).toBeDefined();
    expect(list[1].preview).toBeDefined();
  });

  test("GET /patterns/session returns the pattern curation session", async () => {
    const sessionRes = await hono.request(req("/patterns/session"));
    expect(sessionRes.status).toBe(200);
    const session: PatternCurationSession = await sessionRes.json();

    expect(session.dossiers).toBeDefined();
    expect(session.contradictions).toBeDefined();
    expect(Array.isArray(session.dossiers)).toBe(true);
    expect(Array.isArray(session.contradictions)).toBe(true);
  });

  test("GET /profile returns profile with markdown", async () => {
    const profileRes = await hono.request(req("/profile"));
    expect(profileRes.status).toBe(200);
    const profile: Profile & { markdown: string } = await profileRes.json();

    expect(profile.version).toBe(1);
    expect(profile.rules).toBeDefined();
    expect(Array.isArray(profile.rules)).toBe(true);
    expect(typeof profile.markdown).toBe("string");
  });

  test("PUT /profile replaces profile from markdown", async () => {
    const markdown = `---
version: 1
updatedAt: "2026-03-27T00:00:00.000Z"
---

## Sentence Rhythm

- **Uses short sentences for emphasis**
  *Confirmed across 2 entries* <!-- id:rule-sentence-rhythm-001 created:2026-03-27T00:00:00.000Z -->
`;

    const putRes = await hono.request(
      req("/profile", { method: "PUT", body: { markdown } }),
    );
    expect(putRes.status).toBe(200);
    const updated: Profile = await putRes.json();
    expect(updated.rules.length).toBeGreaterThan(0);
    expect(updated.rules[0].pattern).toBe("Uses short sentences for emphasis");
  });

  test("GET /health returns ok", async () => {
    const healthRes = await hono.request(req("/health"));
    expect(healthRes.status).toBe(200);
    const health = await healthRes.json();
    expect(health.status).toBe("ok");
  });

  test("GET /entries/:id returns 404 for missing entry", async () => {
    const res = await hono.request(req("/entries/entry-2026-01-01-999"));
    expect(res.status).toBe(404);
  });

  test("GET /entries/:id rejects invalid ID format", async () => {
    const res = await hono.request(req("/entries/not-an-entry-id"));
    expect(res.status).toBe(400);
  });

  test("PATCH /observations/:id no longer exists (REQ-LPC-28: classification moved to pattern grain)", async () => {
    const res = await hono.request(
      req("/observations/not-an-obs-id", { method: "PATCH", body: { status: "intentional" } }),
    );
    expect(res.status).toBe(404);
  });

  test("GET /observations lists sightings without a status filter (REQ-LPC-30)", async () => {
    const res = await hono.request(req("/observations"));
    expect(res.status).toBe(200);
    const obs: Observation[] = await res.json();
    expect(Array.isArray(obs)).toBe(true);
  });

  test("POST /patterns/:id/classify rejects an invalid pattern ID format", async () => {
    const res = await hono.request(
      req("/patterns/not-a-pattern-id/classify", { method: "POST", body: { status: "intentional" } }),
    );
    expect(res.status).toBe(400);
  });

  test("GET /patterns/watch returns an empty watch list before any pattern is classified accidental", async () => {
    const res = await hono.request(req("/patterns/watch"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.watchList)).toBe(true);
    expect(body.watchList).toHaveLength(0);
  });

  test("GET /patterns?status= filters the ledger by lifecycle status (REQ-LPC-1)", async () => {
    const res = await hono.request(req("/patterns?status=intentional"));
    expect(res.status).toBe(200);
    const patterns = await res.json();
    expect(Array.isArray(patterns)).toBe(true);
  });

  test("GET /patterns?status= rejects an invalid status value", async () => {
    const res = await hono.request(req("/patterns?status=not-a-real-status"));
    expect(res.status).toBe(400);
  });

  test("GET /patterns/:id returns 404 for a well-formed but nonexistent pattern ID", async () => {
    const res = await hono.request(req("/patterns/pat-2026-01-01-999"));
    expect(res.status).toBe(404);
  });

  test("POST /patterns/:id/promote returns 404 for a nonexistent pattern", async () => {
    const res = await hono.request(req("/patterns/pat-2026-01-01-999/promote", { method: "POST" }));
    expect(res.status).toBe(404);
  });

  test("POST /patterns/:id/dismiss returns 404 for a nonexistent pattern", async () => {
    const res = await hono.request(req("/patterns/pat-2026-01-01-999/dismiss", { method: "POST" }));
    expect(res.status).toBe(404);
  });

  test("POST /patterns/:id/retire returns 404 for a nonexistent pattern", async () => {
    const res = await hono.request(req("/patterns/pat-2026-01-01-999/retire", { method: "POST" }));
    expect(res.status).toBe(404);
  });

  test("POST /patterns/:id/reactivate rejects a pattern that isn't retired", async () => {
    // A freshly-created pattern is "candidate", not "retired" — the route
    // should reject reactivating it (409), the same rule the daemon and CLI
    // both enforce (REQ-LPC-22). This suite has no observer wired
    // (no onEntryCreated), so the pattern is created directly rather than
    // via entry submission.
    const pattern = await patternStore.create({
      statement: "Candidate pattern for reactivate parity check",
      dimension: "sentence-rhythm",
    });
    const res = await hono.request(req(`/patterns/${pattern.id}/reactivate`, { method: "POST" }));
    expect(res.status).toBe(409);
  });

  test("POST /patterns/:id/merge rejects merging a pattern into itself", async () => {
    const pattern = await patternStore.create({
      statement: "Pattern for self-merge parity check",
      dimension: "sentence-rhythm",
    });
    const res = await hono.request(
      req(`/patterns/${pattern.id}/merge`, { method: "POST", body: { duplicateId: pattern.id } }),
    );
    expect(res.status).toBe(400);
  });
});
