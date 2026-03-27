import { Hono } from "hono";
import {
  observationId,
  ClassifyObservationRequestSchema,
  CurationStatusSchema,
  isValidTransition,
} from "@ink-mirror/shared";
import type { CurationStatus } from "@ink-mirror/shared";
import type { ObservationStore } from "../observation-store.js";
import type { EntryStore } from "../entry-store.js";
import type { RouteModule } from "../types.js";
import { assembleCurationSession } from "../curation.js";

export interface ObservationsDeps {
  observationStore: ObservationStore;
  entryStore: EntryStore;
}

/**
 * Observation routes: curation session, classify, list with filters.
 *
 * GET  /observations/pending - Assemble curation session (pending + resurfaced undecided)
 * PATCH /observations/:id    - Classify an observation
 * GET  /observations         - List all observations (optional ?status= filter)
 */
export function createObservationRoutes(deps: ObservationsDeps): RouteModule {
  const app = new Hono();
  const { observationStore, entryStore } = deps;

  // Curation session assembly (REQ-V1-17, REQ-V1-18, REQ-V1-19)
  app.get("/observations/pending", async (c) => {
    const allObs = await observationStore.list();

    const getEntryText = async (entryId: string): Promise<string | undefined> => {
      const entry = await entryStore.get(entryId as ReturnType<typeof import("@ink-mirror/shared").entryId>);
      return entry?.body;
    };

    const session = await assembleCurationSession(allObs, getEntryText);
    return c.json(session);
  });

  // Classify an observation (state transition validation)
  app.patch("/observations/:id", async (c) => {
    const rawId = c.req.param("id");

    if (!/^obs-[\w-]+$/.test(rawId)) {
      return c.json({ error: "Invalid observation ID" }, 400);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = ClassifyObservationRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Invalid request", details: parsed.error.message },
        400,
      );
    }

    const id = observationId(rawId);
    const existing = await observationStore.get(id);

    if (!existing) {
      return c.json({ error: "Observation not found" }, 404);
    }

    const newStatus = parsed.data.status as CurationStatus;
    if (!isValidTransition(existing.status, newStatus)) {
      return c.json(
        {
          error: `Invalid transition from "${existing.status}" to "${newStatus}"`,
        },
        409,
      );
    }

    const updated = await observationStore.updateStatus(id, newStatus);
    if (!updated) {
      return c.json({ error: "Observation not found during update" }, 404);
    }
    return c.json(updated);
  });

  // List all observations with optional status filter
  app.get("/observations", async (c) => {
    const statusFilter = c.req.query("status");

    if (statusFilter) {
      const parsed = CurationStatusSchema.safeParse(statusFilter);
      if (!parsed.success) {
        return c.json({ error: `Invalid status filter: "${statusFilter}"` }, 400);
      }
    }

    let observations = await observationStore.list();

    if (statusFilter) {
      observations = observations.filter((o) => o.status === statusFilter);
    }

    return c.json(observations);
  });

  return {
    routes: app,
    operations: [
      {
        operationId: "observations.pending",
        name: "curate",
        description: "Get pending observations for curation",
        invocation: { method: "GET", path: "/observations/pending" },
        hierarchy: { root: "observations", feature: "curate" },
        idempotent: true,
      },
      {
        operationId: "observations.classify",
        name: "classify",
        description: "Classify an observation as intentional, accidental, or undecided",
        invocation: { method: "PATCH", path: "/observations/:id" },
        hierarchy: { root: "observations", feature: "classify" },
        parameters: [
          {
            name: "id",
            description: "Observation ID",
            required: true,
            type: "string" as const,
          },
          {
            name: "status",
            description: "Classification: intentional, accidental, or undecided",
            required: true,
            type: "string" as const,
          },
        ],
        idempotent: false,
      },
      {
        operationId: "observations.list",
        name: "list",
        description: "List all observations (optional --status filter)",
        invocation: { method: "GET", path: "/observations" },
        hierarchy: { root: "observations", feature: "list" },
        parameters: [
          {
            name: "status",
            description: "Filter by status: pending, intentional, accidental, undecided",
            required: false,
            type: "string" as const,
          },
        ],
        idempotent: true,
      },
    ],
  };
}
