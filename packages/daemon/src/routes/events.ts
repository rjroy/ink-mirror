import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { EventBus, RouteModule } from "../types.js";

export interface EventsDeps {
  eventBus: EventBus;
}

/**
 * SSE route for streaming observation and pattern-ledger events to clients
 * (REQ-LPC-29: the event contract is versioned, and pattern:* events ride
 * the same stream as observation:created since they're both consequences
 * of writing/curating in the same session).
 *
 * GET /events/observations - SSE stream of observation:created and pattern:* events
 */
export function createEventsRoutes(deps: EventsDeps): RouteModule {
  const app = new Hono();
  const { eventBus } = deps;

  app.get("/events/observations", (c) => {
    return streamSSE(c, async (stream) => {
      const unsubs = [
        eventBus.subscribe("observation:created", (obs) => {
          void stream.writeSSE({ data: JSON.stringify(obs), event: "observation" });
        }),
        eventBus.subscribe("pattern:discovered", (event) => {
          void stream.writeSSE({ data: JSON.stringify(event), event: "pattern:discovered" });
        }),
        eventBus.subscribe("pattern:proposal", (event) => {
          void stream.writeSSE({ data: JSON.stringify(event), event: "pattern:proposal" });
        }),
        eventBus.subscribe("pattern:watch-resolved", (event) => {
          void stream.writeSSE({ data: JSON.stringify(event), event: "pattern:watch-resolved" });
        }),
      ];

      stream.onAbort(() => {
        for (const unsub of unsubs) unsub();
      });

      // Heartbeat keeps Bun from killing the connection as idle
      while (true) {
        await stream.writeSSE({ data: "", event: "keepalive" });
        await stream.sleep(5000);
      }
    });
  });

  return {
    routes: app,
    operations: [],
  };
}
