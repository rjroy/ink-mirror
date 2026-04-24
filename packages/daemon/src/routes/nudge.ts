import { createHash } from "node:crypto";
import { Hono } from "hono";
import { NudgeRequestSchema } from "@ink-mirror/shared";
import type { EntryMetrics, SavedNudge } from "@ink-mirror/shared";
import type { SessionRunner } from "../session-runner.js";
import type { NudgeStore } from "../nudge-store.js";
import type { RouteModule } from "../types.js";
import { nudge } from "../nudger.js";

export interface NudgeDeps {
  sessionRunner: SessionRunner;
  computeMetrics: (text: string) => EntryMetrics;
  readEntry: (id: string) => Promise<string | undefined>;
  readStyleProfile?: () => Promise<string>;
  nudgeStore: NudgeStore;
  now?: () => string;
  hashFn?: (text: string) => string;
}

const defaultNow = (): string => new Date().toISOString();

const defaultHashFn = (text: string): string =>
  "sha256:" + createHash("sha256").update(text).digest("hex");

/**
 * Nudge routes: on-demand craft analysis.
 *
 * POST /nudge - Analyze text for craft patterns, return Socratic questions.
 * Persists results keyed by entryId when the request is entry-scoped
 * (REQ-CNP-3); direct-text requests never touch the store.
 */
export function createNudgeRoutes(deps: NudgeDeps): RouteModule {
  const app = new Hono();
  const now = deps.now ?? defaultNow;
  const hashFn = deps.hashFn ?? defaultHashFn;

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

    // Resolve text: prefer provided text, fall back to entry lookup (REQ-CN-3).
    // isEntryScoped gates all persistence behavior (REQ-CNP-3): persistence
    // applies only when text is resolved from an entry, never when the caller
    // supplied text directly.
    const isEntryScoped = !parsed.data.text && !!parsed.data.entryId;

    let text: string;
    if (parsed.data.text) {
      text = parsed.data.text;
    } else {
      if (!parsed.data.entryId) {
        return c.json({ error: "At least one of entryId or text is required" }, 400);
      }

      if (!/^entry-[\w-]+$/.test(parsed.data.entryId)) {
        return c.json({ error: "Invalid entry ID" }, 400);
      }

      const resolved = await deps.readEntry(parsed.data.entryId);
      if (!resolved) {
        return c.json({ error: "Entry not found" }, 404);
      }
      text = resolved;
    }

    const runNudge = () =>
      nudge(
        {
          sessionRunner: deps.sessionRunner,
          computeMetrics: deps.computeMetrics,
          readStyleProfile: deps.readStyleProfile,
        },
        text,
        parsed.data.context,
      );

    // Direct-text path: no cache read, no save, no contentHash (REQ-CNP-3, REQ-CNP-10, REQ-CNP-12).
    // The refresh flag is accepted but has no effect here.
    if (!isEntryScoped) {
      const result = await runNudge();
      return c.json({
        nudges: result.nudges,
        metrics: result.metrics,
        source: "fresh" as const,
        generatedAt: now(),
        ...(result.error ? { error: result.error } : {}),
      });
    }

    // Entry-scoped path. `isEntryScoped` (text absent + entryId present) guarantees entryId.
    const entryId = parsed.data.entryId!;
    const hash = hashFn(text);
    const requestContext = parsed.data.context ?? "";

    if (!parsed.data.refresh) {
      const existing = await deps.nudgeStore.get(entryId);
      if (existing) {
        // Cache responses never include `error` (REQ-CNP-14). Saved records
        // are never persisted with errors (REQ-CNP-7), so no error field can
        // reach this response.
        const hit =
          existing.contentHash === hash && existing.context === requestContext;
        if (hit) {
          return c.json({
            nudges: existing.nudges,
            metrics: existing.metrics,
            source: "cache" as const,
            generatedAt: existing.generatedAt,
            contentHash: existing.contentHash,
          });
        }
        // Hash or context drift: serve stale cache without mutating the record
        // (REQ-CNP-5, REQ-CNP-13).
        return c.json({
          nudges: existing.nudges,
          metrics: existing.metrics,
          source: "cache" as const,
          stale: true,
          generatedAt: existing.generatedAt,
          contentHash: existing.contentHash,
        });
      }
    }

    // Fresh run: either refresh=true or no cached record.
    const result = await runNudge();

    // Parse failure: do not persist (REQ-CNP-7). contentHash still present
    // because the response is tied to an entry (REQ-CNP-12).
    if (result.error) {
      return c.json({
        nudges: result.nudges,
        metrics: result.metrics,
        source: "fresh" as const,
        generatedAt: now(),
        contentHash: hash,
        error: result.error,
      });
    }

    const generatedAt = now();
    const record: SavedNudge = {
      entryId,
      contentHash: hash,
      context: requestContext,
      generatedAt,
      nudges: result.nudges,
      metrics: result.metrics,
    };

    // Store save failure is isolated: log and continue so a disk error does
    // not fail the user's nudge.
    try {
      await deps.nudgeStore.save(entryId, record);
    } catch (err) {
      console.error(`[nudge] failed to persist ${entryId}:`, err);
    }

    return c.json({
      nudges: result.nudges,
      metrics: result.metrics,
      source: "fresh" as const,
      generatedAt,
      contentHash: hash,
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
          {
            name: "refresh",
            description: "Force fresh generation and overwrite saved nudge",
            required: false,
            type: "boolean" as const,
          },
        ],
        idempotent: true,
      },
    ],
  };
}
