import { Hono } from "hono";
import { NudgeRequestSchema } from "@ink-mirror/shared";
import type { EntryMetrics } from "@ink-mirror/shared";
import type { SessionRunner } from "../session-runner.js";
import type { RouteModule } from "../types.js";
import { nudge } from "../nudger.js";

export interface NudgeDeps {
  sessionRunner: SessionRunner;
  computeMetrics: (text: string) => EntryMetrics;
  readEntry: (id: string) => Promise<string | undefined>;
  readStyleProfile?: () => Promise<string>;
}

/**
 * Nudge routes: on-demand craft analysis.
 *
 * POST /nudge - Analyze text for craft patterns, return Socratic questions.
 */
export function createNudgeRoutes(deps: NudgeDeps): RouteModule {
  const app = new Hono();

  app.post("/nudge", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = NudgeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Invalid request", details: parsed.error.message },
        400,
      );
    }

    // Resolve text: prefer provided text, fall back to entry lookup (REQ-CN-3)
    let text = parsed.data.text;
    if (!text) {
      if (!parsed.data.entryId) {
        return c.json({ error: "At least one of entryId or text is required" }, 400);
      }

      if (!/^entry-[\w-]+$/.test(parsed.data.entryId)) {
        return c.json({ error: "Invalid entry ID" }, 400);
      }

      text = await deps.readEntry(parsed.data.entryId);
      if (!text) {
        return c.json({ error: "Entry not found" }, 404);
      }
    }

    const result = await nudge(
      {
        sessionRunner: deps.sessionRunner,
        computeMetrics: deps.computeMetrics,
        readStyleProfile: deps.readStyleProfile,
      },
      text,
      parsed.data.context,
    );

    return c.json({
      nudges: result.nudges,
      metrics: result.metrics,
      ...(result.error ? { error: result.error } : {}),
    });
  });

  return {
    routes: app,
    operations: [
      {
        operationId: "nudge.analyze",
        name: "analyze",
        description: "Get craft nudges for a piece of writing",
        invocation: { method: "POST", path: "/nudge" },
        hierarchy: { root: "nudge", feature: "analyze" },
        parameters: [
          {
            name: "entryId",
            description: "Entry to nudge (reads text from storage)",
            required: false,
            type: "string" as const,
          },
          {
            name: "text",
            description: "Text to analyze directly",
            required: false,
            type: "string" as const,
          },
          {
            name: "context",
            description: "Optional context about the text",
            required: false,
            type: "string" as const,
          },
        ],
        idempotent: true,
      },
    ],
  };
}
