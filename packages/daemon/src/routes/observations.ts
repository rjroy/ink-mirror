import { Hono } from "hono";
import type { ObservationStore } from "../observation-store.js";
import type { RouteModule } from "../types.js";

export interface ObservationsDeps {
  observationStore: ObservationStore;
}

/**
 * Observation (sighting) routes: read-only listing.
 *
 * GET /observations - List all stored observations, i.e. every sighting
 *                      ever recorded, regardless of its pattern's status.
 *
 * Classification moved entirely to pattern grain (REQ-LPC-13/28): the old
 * curation-session endpoint (GET /observations/pending) is replaced by
 * GET /patterns/session, and the classify endpoint (PATCH /observations/:id)
 * plus its classify-writes-a-rule side effect are removed (REQ-LPC-28). The
 * `?status=` filter is dropped too — CurationStatus is being retired as a
 * per-observation concept (REQ-LPC-30); classification lives on the pattern
 * now, and this route no longer has a meaningful status to filter by.
 */
export function createObservationRoutes(deps: ObservationsDeps): RouteModule {
  const app = new Hono();
  const { observationStore } = deps;

  app.get("/observations", async (c) => {
    const observations = await observationStore.list();
    return c.json(observations);
  });

  return {
    routes: app,
    operations: [
      {
        operationId: "observations.list",
        name: "list",
        description: "List all recorded sightings",
        invocation: { method: "GET", path: "/observations" },
        hierarchy: { root: "observations", feature: "list" },
        idempotent: true,
      },
    ],
  };
}
