import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { EventBus, RouteModule } from "../types.js";

export interface EventsDeps {
  eventBus: EventBus;
}

/**
 * SSE route for streaming observation events to clients.
 *
 * GET /events/observations - SSE stream of observation events
 */
export function createEventsRoutes(deps: EventsDeps): RouteModule {
  const app = new Hono();
  const { eventBus } = deps;

  app.get("/events/observations", (c) => {
    return streamSSE(c, async (stream) => {
      const unsub = eventBus.subscribe("observation:created", (obs) => {
        void stream.writeSSE({
          data: JSON.stringify(obs),
          event: "observation",
        });
      });

      stream.onAbort(() => {
        unsub();
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
