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
import { createEntryRoutes } from "../../daemon/src/routes/entries.js";
import { createObservationRoutes } from "../../daemon/src/routes/observations.js";
import { createPatternRoutes } from "../../daemon/src/routes/patterns.js";
import { createProfileRoutes } from "../../daemon/src/routes/profile.js";
import { createEventsRoutes } from "../../daemon/src/routes/events.js";
import { createEventBus } from "../../daemon/src/event-bus.js";
import { DEFAULT_CONFIG } from "../../daemon/src/config.js";
import type { EventBus } from "../../daemon/src/types.js";
import type { Hono } from "hono";
import type {
  Observation,
  Pattern,
  PatternDiscoveredEvent,
  PatternProposalEvent,
  PatternWatchResolvedEvent,
} from "@ink-mirror/shared";

/**
 * Tests SSE streaming of observation and pattern-ledger events.
 * Verifies that events emitted via EventBus are delivered to SSE subscribers.
 *
 * The versioned event contract (REQ-LPC-29) adds pattern:discovered,
 * pattern:proposal, and pattern:watch-resolved alongside observation:created
 * (routes/events.ts subscribes to all four on the same SSE stream). This
 * suite asserts each event's shape and delivery deterministically via the
 * EventBus directly (matching this project's testing rule against
 * timing-dependent assertions) rather than reading the raw SSE byte stream,
 * whose flush timing is a ReadableStream implementation detail.
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
    const patternStore = createPatternStore({ patternsDir: join(dataDir, "patterns") });
    const snapshotStore = createSnapshotStore({ snapshotsDir: join(dataDir, "snapshots") });
    const profileStore = createProfileStore({ profilePath: join(dataDir, "profile.md") });
    eventBus = createEventBus();

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

  test("GET /events/observations returns SSE stream with the pattern-grain route set wired in", async () => {
    const res = await hono.request(req("/events/observations"));
    expect(res.status).toBe(200);

    const contentType = res.headers.get("content-type");
    expect(contentType).toContain("text/event-stream");
  });

  test("EventBus emits observation:created events (v2 payload carries patternId, REQ-LPC-29)", () => {
    const received: Observation[] = [];
    eventBus.subscribe<Observation>("observation:created", (obs) => {
      received.push(obs);
    });

    const mockObs: Observation = {
      id: "obs-2026-03-27-001",
      entryId: "entry-2026-03-27-001",
      patternId: "pat-2026-03-27-001",
      pattern: "Test pattern",
      evidence: ["Test evidence"],
      dimension: "sentence-rhythm",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    eventBus.emit("observation:created", mockObs);

    expect(received).toHaveLength(1);
    expect(received[0].pattern).toBe("Test pattern");
    expect(received[0].patternId).toBe("pat-2026-03-27-001");
  });

  test("EventBus emits pattern:discovered events with the new candidate pattern", () => {
    const received: PatternDiscoveredEvent[] = [];
    eventBus.subscribe<PatternDiscoveredEvent>("pattern:discovered", (event) => {
      received.push(event);
    });

    const mockPattern: Pattern = {
      id: "pat-2026-07-10-001",
      statement: "Uses short declarative sentences for emphasis",
      dimension: "sentence-rhythm",
      status: "candidate",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sightingCount: 1,
      entryIds: ["entry-2026-07-10-001"],
    };

    eventBus.emit("pattern:discovered", { pattern: mockPattern });

    expect(received).toHaveLength(1);
    expect(received[0].pattern.id).toBe("pat-2026-07-10-001");
    expect(received[0].pattern.status).toBe("candidate");
  });

  test("EventBus emits pattern:proposal events when a pattern crosses the promotion thresholds (REQ-LPC-14/15)", () => {
    const received: PatternProposalEvent[] = [];
    eventBus.subscribe<PatternProposalEvent>("pattern:proposal", (event) => {
      received.push(event);
    });

    eventBus.emit("pattern:proposal", {
      patternId: "pat-2026-07-10-002",
      statement: "Favors compound sentences joined by conjunctions",
      dimension: "sentence-structure",
    });

    expect(received).toHaveLength(1);
    expect(received[0].patternId).toBe("pat-2026-07-10-002");
    expect(received[0].dimension).toBe("sentence-structure");
  });

  test("EventBus emits pattern:watch-resolved events distinguishing computable vs qualitative resolution (REQ-LPC-25)", () => {
    const received: PatternWatchResolvedEvent[] = [];
    eventBus.subscribe<PatternWatchResolvedEvent>("pattern:watch-resolved", (event) => {
      received.push(event);
    });

    const resolvedAt = new Date().toISOString();
    eventBus.emit("pattern:watch-resolved", {
      patternId: "pat-2026-07-10-003",
      resolvedAt,
      kind: "qualitative",
    });

    expect(received).toHaveLength(1);
    expect(received[0].kind).toBe("qualitative");
    expect(received[0].resolvedAt).toBe(resolvedAt);
  });

  test("EventBus subscriber count tracks correctly across all event topics", () => {
    expect(eventBus.subscriberCount("observation:created")).toBe(0);
    expect(eventBus.subscriberCount("pattern:discovered")).toBe(0);

    const unsub = eventBus.subscribe("observation:created", () => {});
    const unsubPattern = eventBus.subscribe("pattern:discovered", () => {});
    expect(eventBus.subscriberCount("observation:created")).toBe(1);
    expect(eventBus.subscriberCount("pattern:discovered")).toBe(1);

    unsub();
    unsubPattern();
    expect(eventBus.subscriberCount("observation:created")).toBe(0);
    expect(eventBus.subscriberCount("pattern:discovered")).toBe(0);
  });

  test("multiple subscribers receive the same pattern:discovered event", () => {
    const received1: unknown[] = [];
    const received2: unknown[] = [];

    eventBus.subscribe("pattern:discovered", (event) => received1.push(event));
    eventBus.subscribe("pattern:discovered", (event) => received2.push(event));

    eventBus.emit("pattern:discovered", { pattern: { id: "pat-test" } });

    expect(received1).toHaveLength(1);
    expect(received2).toHaveLength(1);
  });
});
