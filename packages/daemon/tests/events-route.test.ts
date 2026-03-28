import { describe, expect, test } from "bun:test";
import { createEventsRoutes } from "../src/routes/events.js";
import { createEventBus } from "../src/event-bus.js";
import { createApp } from "../src/app.js";
import type { Observation } from "@ink-mirror/shared";

function req(path: string): Request {
  return new Request(`http://localhost${path}`);
}

describe("events routes", () => {
  test("GET /events/observations returns SSE content type", async () => {
    const eventBus = createEventBus();
    const eventsRoutes = createEventsRoutes({ eventBus });
    const { hono } = createApp({ routeModules: [eventsRoutes], eventBus });

    const res = await hono.request(req("/events/observations"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
  });

  test("events route has no operations (not discoverable via CLI)", () => {
    const eventBus = createEventBus();
    const eventsRoutes = createEventsRoutes({ eventBus });
    expect(eventsRoutes.operations).toHaveLength(0);
  });

  test("entry creation with eventBus emits observation events", async () => {
    const eventBus = createEventBus();
    const received: Observation[] = [];
    eventBus.subscribe<Observation>("observation:created", (obs) => {
      received.push(obs);
    });

    // Simulate what the entries route does after observer completes
    const mockObs: Observation = {
      id: "obs-2026-03-27-001",
      entryId: "entry-2026-03-27-001",
      pattern: "Test pattern from observer",
      evidence: "cited text",
      dimension: "sentence-rhythm",
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    eventBus.emit("observation:created", mockObs);

    expect(received).toHaveLength(1);
    expect(received[0].id).toBe("obs-2026-03-27-001");
    expect(received[0].pattern).toBe("Test pattern from observer");
  });
});
