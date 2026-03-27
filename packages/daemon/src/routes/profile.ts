import { Hono } from "hono";
import {
  UpdateProfileRuleRequestSchema,
  PutProfileRequestSchema,
} from "@ink-mirror/shared";
import type { ProfileStore } from "../profile-store.js";
import type { RouteModule } from "../types.js";

export interface ProfileDeps {
  profileStore: ProfileStore;
}

/**
 * Profile routes: read, edit rules, full profile replace.
 *
 * GET    /profile           - Read current profile (markdown + structured)
 * PATCH  /profile/rules/:id - Edit a single rule
 * DELETE /profile/rules/:id - Remove a rule
 * PUT    /profile           - Full profile replace from markdown
 */
export function createProfileRoutes(deps: ProfileDeps): RouteModule {
  const app = new Hono();
  const { profileStore } = deps;

  app.get("/profile", async (c) => {
    const profile = await profileStore.get();
    const markdown = await profileStore.toPromptMarkdown();
    return c.json({ ...profile, markdown });
  });

  app.patch("/profile/rules/:id", async (c) => {
    const ruleId = c.req.param("id");

    if (!/^rule-[\w-]+$/.test(ruleId)) {
      return c.json({ error: "Invalid rule ID" }, 400);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = UpdateProfileRuleRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Invalid request", details: parsed.error.message },
        400,
      );
    }

    if (!parsed.data.pattern && !parsed.data.dimension) {
      return c.json({ error: "At least one field (pattern, dimension) must be provided" }, 400);
    }

    const updated = await profileStore.updateRule(ruleId, parsed.data);
    if (!updated) {
      return c.json({ error: "Rule not found" }, 404);
    }

    return c.json(updated);
  });

  app.delete("/profile/rules/:id", async (c) => {
    const ruleId = c.req.param("id");

    if (!/^rule-[\w-]+$/.test(ruleId)) {
      return c.json({ error: "Invalid rule ID" }, 400);
    }

    const deleted = await profileStore.deleteRule(ruleId);
    if (!deleted) {
      return c.json({ error: "Rule not found" }, 404);
    }

    return c.json({ ok: true });
  });

  app.put("/profile", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = PutProfileRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Invalid request", details: parsed.error.message },
        400,
      );
    }

    try {
      const profile = await profileStore.replaceFromMarkdown(parsed.data.markdown);
      return c.json(profile);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return c.json({ error: message }, 400);
    }
  });

  return {
    routes: app,
    operations: [
      {
        operationId: "profile.read",
        name: "profile",
        description: "Display your writing style profile",
        invocation: { method: "GET", path: "/profile" },
        hierarchy: { root: "profile", feature: "show" },
        idempotent: true,
      },
      {
        operationId: "profile.editRule",
        name: "edit-rule",
        description: "Edit a profile rule",
        invocation: { method: "PATCH", path: "/profile/rules/:id" },
        hierarchy: { root: "profile", feature: "edit-rule" },
        parameters: [
          {
            name: "id",
            description: "Rule ID",
            required: true,
            type: "string" as const,
          },
          {
            name: "pattern",
            description: "New pattern description",
            required: false,
            type: "string" as const,
          },
        ],
        idempotent: false,
      },
      {
        operationId: "profile.deleteRule",
        name: "delete-rule",
        description: "Remove a profile rule",
        invocation: { method: "DELETE", path: "/profile/rules/:id" },
        hierarchy: { root: "profile", feature: "delete-rule" },
        parameters: [
          {
            name: "id",
            description: "Rule ID",
            required: true,
            type: "string" as const,
          },
        ],
        idempotent: false,
      },
      {
        operationId: "profile.replace",
        name: "edit",
        description: "Open profile in $EDITOR for full editing",
        invocation: { method: "PUT", path: "/profile" },
        hierarchy: { root: "profile", feature: "edit" },
        parameters: [
          {
            name: "markdown",
            description: "Full profile markdown content",
            required: true,
            type: "string" as const,
          },
        ],
        idempotent: false,
      },
    ],
  };
}
