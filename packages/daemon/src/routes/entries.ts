import { Hono } from "hono";
import { entryId, CreateEntryRequestSchema } from "@ink-mirror/shared";
import type { EntryStore } from "../entry-store.js";
import type { RouteModule } from "../types.js";

export interface EntriesDeps {
  entryStore: EntryStore;
}

/**
 * Entry routes: create, list, read journal entries.
 *
 * POST /entries     - Create a new entry
 * GET  /entries     - List all entries
 * GET  /entries/:id - Read a single entry
 */
export function createEntryRoutes(deps: EntriesDeps): RouteModule {
  const app = new Hono();
  const { entryStore } = deps;

  app.post("/entries", async (c) => {
    const raw = await c.req.json();
    const parsed = CreateEntryRequestSchema.safeParse(raw);

    if (!parsed.success) {
      return c.json(
        { error: "Invalid request", details: parsed.error.message },
        400,
      );
    }

    const entry = await entryStore.create(parsed.data.body, parsed.data.title);
    return c.json(entry, 201);
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
    ],
  };
}
