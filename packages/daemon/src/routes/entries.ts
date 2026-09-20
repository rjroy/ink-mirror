import { Hono } from "hono";
import { entryId, CreateEntryRequestSchema, ReflectEntryResponseSchema } from "@ink-mirror/shared";
import type { EntryStore } from "../entry-store.js";
import type { EventBus, RouteModule } from "../types.js";
import type { ObserveResult } from "../observer.js";

/**
 * Observer function signature. When provided, runs automatically
 * after entry creation (REQ-V1-4).
 */
export type ObserveFn = (entryId: string, entryText: string) => Promise<ObserveResult>;

export interface EntriesDeps {
  entryStore: EntryStore;
  onEntryCreated?: ObserveFn;
  onEntryReflected?: ObserveFn;
  eventBus?: EventBus;
}

/**
 * Entry routes: create, list, read journal entries.
 *
 * POST /entries     - Create a new entry
 * GET  /entries     - List all entries
 * GET  /entries/:id - Read a single entry
 * POST /entries/:id/reflect - Explicitly re-run observation for an existing entry
 */
export function createEntryRoutes(deps: EntriesDeps): RouteModule {
  const app = new Hono();
  const { entryStore, onEntryCreated, onEntryReflected, eventBus } = deps;

  app.post("/entries", async (c) => {
    const raw: unknown = await c.req.json();
    const parsed = CreateEntryRequestSchema.safeParse(raw);

    if (!parsed.success) {
      return c.json(
        { error: "Invalid request", details: parsed.error.message },
        400,
      );
    }

    const entry = await entryStore.create(parsed.data.body, parsed.data.title);

    // Auto-trigger observation (REQ-V1-4).
    // Runs after storage so the entry is durable before we call the LLM.
    // Observation errors don't fail entry creation.
    let observeResult: ObserveResult | undefined;
    let observeError: string | undefined;
    if (onEntryCreated) {
      try {
        observeResult = await onEntryCreated(entry.id, entry.body);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[daemon] observer failed for ${entry.id}: ${message}`);
        observeError = message;
      }
    }

    // Emit observation and pattern-discovery events for SSE subscribers
    // (REQ-LPC-29: observation:created carries the resolved pattern
    // reference already, via Observation.patternId; pattern:discovered
    // covers observer-side discovery here, and routes/patterns.ts covers
    // the detach-produces-a-new-candidate case separately).
    if (observeResult && eventBus) {
      for (const obs of observeResult.observations) {
        eventBus.emit("observation:created", obs);
      }
      for (const pattern of observeResult.discoveries) {
        eventBus.emit("pattern:discovered", { pattern });
      }
    }

    return c.json(
      {
        ...entry,
        ...(observeResult ? { observations: observeResult.observations } : {}),
        ...(observeError ? { observeError } : {}),
      },
      201,
    );
  });

  app.get("/entries", async (c) => {
    const entries = await entryStore.list();
    return c.json(entries);
  });

  app.get("/entries/:id", async (c) => {
    const raw = c.req.param("id");

    // Validate ID format to prevent path traversal (F-01)
    if (!/^entry-[\w-]+$/.test(raw)) {
      return c.json({ error: "Invalid entry ID" }, 400);
    }

    const id = entryId(raw);
    const entry = await entryStore.get(id);

    if (!entry) {
      return c.json({ error: "Entry not found" }, 404);
    }

    return c.json(entry);
  });

  app.post("/entries/:id/reflect", async (c) => {
    const raw = c.req.param("id");
    if (!/^entry-[\w-]+$/.test(raw)) {
      return c.json({ error: "Invalid entry ID" }, 400);
    }

    const entry = await entryStore.get(entryId(raw));
    if (!entry) {
      return c.json({ error: "Entry not found" }, 404);
    }
    if (!onEntryReflected) {
      return c.json({ error: "Observation is unavailable" }, 503);
    }

    try {
      const result = await onEntryReflected(entry.id, entry.body);
      if (eventBus) {
        for (const observation of result.observations) {
          eventBus.emit("observation:created", observation);
        }
        for (const pattern of result.discoveries) {
          eventBus.emit("pattern:discovered", { pattern });
        }
      }
      return c.json(ReflectEntryResponseSchema.parse({
        observations: result.observations,
        errors: result.errors,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[daemon] observer failed for ${entry.id}: ${message}`);
      return c.json({ error: "Observation failed", details: message }, 502);
    }
  });

  return {
    routes: app,
    operations: [
      {
        operationId: "entries.create",
        name: "write",
        description: "Create a new journal entry",
        invocation: { method: "POST", path: "/entries" },
        hierarchy: { root: "entries", feature: "write" },
        parameters: [
          {
            name: "body",
            description: "Entry text content",
            required: true,
            type: "string" as const,
          },
          {
            name: "title",
            description: "Optional entry title",
            required: false,
            type: "string" as const,
          },
        ],
        idempotent: false,
      },
      {
        operationId: "entries.list",
        name: "list",
        description: "List all journal entries",
        invocation: { method: "GET", path: "/entries" },
        hierarchy: { root: "entries", feature: "list" },
        idempotent: true,
      },
      {
        operationId: "entries.read",
        name: "show",
        description: "Read a single journal entry",
        invocation: { method: "GET", path: "/entries/:id" },
        hierarchy: { root: "entries", feature: "show" },
        parameters: [
          {
            name: "id",
            description: "Entry ID",
            required: true,
            type: "string" as const,
          },
        ],
        idempotent: true,
      },
      {
        operationId: "entries.reflect",
        name: "reflect",
        description: "Explicitly re-run observation for an existing journal entry",
        invocation: { method: "POST", path: "/entries/:id/reflect" },
        hierarchy: { root: "entries", feature: "reflect" },
        parameters: [
          {
            name: "id",
            description: "Entry ID",
            required: true,
            type: "string" as const,
          },
        ],
        idempotent: false,
      },
    ],
  };
}
