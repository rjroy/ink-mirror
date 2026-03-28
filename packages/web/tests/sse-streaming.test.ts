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
import type { EventBus } from "../../daemon/src/types.js";
import type { Hono } from "hono";
import type { Observation } from "@ink-mirror/shared";

/**
 * Tests SSE streaming of observation events.
 * Verifies that events emitted via EventBus are delivered to SSE subscribers.
 */

function req(path: string): Request {
  return new Request(`http://localhost${path}`);
}

describe("SSE streaming", () => {
  let dataDir: string;
  let hono: Hono;
  let eventBus: EventBus;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "ink-mirror-sse-test-"));
    const entryStore = createEntryStore({ entriesDir: join(dataDir, "entries") });
    const observationStore = createObservationStore({ observationsDir: join(dataDir, "observations") });
    const profileStore = createProfileStore({ profilePath: join(dataDir, "profile.md") });
    eventBus = createEventBus();

    const entryRoutes = createEntryRoutes({ entryStore, eventBus });
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
    hono = app.hono;
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  test("GET /events/observations returns SSE stream", async () => {
    const res = await hono.request(req("/events/observations"));
    expect(res.status).toBe(200);

    const contentType = res.headers.get("content-type");
    expect(contentType).toContain("text/event-stream");
  });

  test("EventBus emits observation events", () => {
    const received: Observation[] = [];
    eventBus.subscribe<Observation>("observation:created", (obs) => {
      received.push(obs);
    });

    const mockObs: Observation = {
      id: "obs-2026-03-27-001",
      entryId: "entry-2026-03-27-001",
      pattern: "Test pattern",
      evidence: "Test evidence",
      dimension: "sentence-rhythm",
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    eventBus.emit("observation:created", mockObs);

    expect(received).toHaveLength(1);
    expect(received[0].pattern).toBe("Test pattern");
  });

  test("EventBus subscriber count tracks correctly", () => {
    expect(eventBus.subscriberCount("observation:created")).toBe(0);

    const unsub = eventBus.subscribe("observation:created", () => {});
    expect(eventBus.subscriberCount("observation:created")).toBe(1);

    unsub();
    expect(eventBus.subscriberCount("observation:created")).toBe(0);
  });

  test("multiple subscribers receive same event", () => {
    const received1: unknown[] = [];
    const received2: unknown[] = [];

    eventBus.subscribe("observation:created", (obs) => received1.push(obs));
    eventBus.subscribe("observation:created", (obs) => received2.push(obs));

    eventBus.emit("observation:created", { pattern: "test" });

    expect(received1).toHaveLength(1);
    expect(received2).toHaveLength(1);
  });
});
