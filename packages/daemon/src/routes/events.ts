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

      // Keep connection alive until client disconnects
      while (true) {
        await stream.sleep(30000);
      }
    });
  });

  return {
    routes: app,
    operations: [],
  };
}
