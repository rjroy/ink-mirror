/**
 * Pattern-grain curation API (REQ-LPC-28): the pattern ledger's read surface
 * (session/list/dossier/watch) and every writer action (classify, promote,
 * proposal accept/decline, detach, merge, dismiss, retire, reactivate,
 * reaffirm). Replaces the old observation-grain classify endpoint entirely
 * — see routes/observations.ts, which is now read-only.
 */
import { Hono } from "hono";
import {
  entryId,
  observationId,
  PatternStatusSchema,
  ClassifyPatternRequestSchema,
  DetachSightingRequestSchema,
  MergePatternsRequestSchema,
  DismissPatternRequestSchema,
  PromotePatternRequestSchema,
  PatternProposalActionRequestSchema,
  RetirePatternRequestSchema,
  ReactivatePatternRequestSchema,
  ReaffirmRuleRequestSchema,
  isLinkableMetricKey,
} from "@ink-mirror/shared";
import type { Pattern, PatternProposal, Sighting, Observation, MetricSnapshot } from "@ink-mirror/shared";
import type { PatternStore } from "../pattern-store.js";
import type { ObservationStore } from "../observation-store.js";
import type { EntryStore } from "../entry-store.js";
import type { SnapshotStore } from "../snapshot-store.js";
import type { ProfileStore } from "../profile-store.js";
import type { EventBus, RouteModule } from "../types.js";
import type { Config } from "../config.js";
import { assembleCurationSession, buildDossier, sightingsForPattern, toSighting } from "../curation.js";
import { proposalFor, type EntryWordCounts } from "../promotion.js";
import { rollingMean, watchResolution } from "../substrate.js";
import { countWords } from "../metrics/index.js";
import type { Context } from "hono";

export interface PatternsDeps {
  patternStore: PatternStore;
  observationStore: ObservationStore;
  entryStore: EntryStore;
  snapshotStore: SnapshotStore;
  profileStore: ProfileStore;
  config: Config;
  eventBus?: EventBus;
  /** Injectable clock, defaulting to the real one (matches the project's DI-for-time convention). */
  now?: () => string;
}

const PATTERN_ID_RE = /^pat-[\w-]+$/;

/** Rolling-mean window used to capture a computable pattern's pre-classification watch baseline (REQ-LPC-23). Matches substrate.ts's trendSummary default window for consistency. */
const WATCH_BASELINE_WINDOW = 5;

function isValidPatternId(id: string): boolean {
  return PATTERN_ID_RE.test(id);
}

/** Parses a request body as JSON, tolerating an empty body as `{}` (the empty-body request schemas — dismiss/promote/retire/reactivate — send no fields). */
async function readJsonBody(c: Context): Promise<{ ok: true; data: unknown } | { ok: false }> {
  const text = await c.req.text();
  if (!text) return { ok: true, data: {} };
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/** Resolves entry text with a fallback placeholder and a per-request cache, matching curation.ts's internal resolveText contract that buildDossier expects. */
function makeEntryTextResolver(entryStore: EntryStore): (id: string) => Promise<string> {
  const cache = new Map<string, string>();
  return async (id: string) => {
    const cached = cache.get(id);
    if (cached !== undefined) return cached;
    const entry = await entryStore.get(entryId(id));
    const text = entry?.body ?? "[source entry not found]";
    cache.set(id, text);
    return text;
  };
}

/**
 * Runs watch resolution (REQ-LPC-25) over every currently-watched,
 * unresolved pattern and persists+emits any that resolve now. Returns the
 * patterns array with resolved entries reflected, so the caller's
 * subsequent dossier assembly sees up-to-date watch state instead of a
 * stale pre-resolution snapshot.
 */
async function resolveWatchesAndEmit(
  patterns: Pattern[],
  allObservations: Observation[],
  snapshots: MetricSnapshot[],
  patternStore: PatternStore,
  eventBus: EventBus | undefined,
  config: Config,
  now: () => string,
): Promise<Pattern[]> {
  const resolved: Pattern[] = [];
  for (const pattern of patterns) {
    if (!pattern.watch || pattern.watch.resolved) {
      resolved.push(pattern);
      continue;
    }

    const sightings = sightingsForPattern(pattern.id, allObservations);
    const result = watchResolution(pattern, snapshots, sightings, config);
    if (!result.shouldResolve) {
      resolved.push(pattern);
      continue;
    }

    const resolvedAt = now();
    const updated = await patternStore.setWatch(pattern.id, {
      ...pattern.watch,
      resolved: true,
      resolvedAt,
    });
    eventBus?.emit("pattern:watch-resolved", { patternId: pattern.id, resolvedAt, kind: result.kind });
    resolved.push(updated);
  }
  return resolved;
}

/**
 * Computes promotion proposals for every `intentional` pattern (REQ-LPC-14),
 * emitting `pattern:proposal` (and stamping `proposalSurfacedAt`) the first
 * time each one surfaces. entryWordCounts is built lazily, scoped to just
 * the entries the intentional patterns were sighted in.
 */
async function computeProposals(
  patterns: Pattern[],
  allObservations: Observation[],
  entryStore: EntryStore,
  patternStore: PatternStore,
  eventBus: EventBus | undefined,
  config: Config,
): Promise<PatternProposal[]> {
  const intentional = patterns.filter((p) => p.status === "intentional");

  const entryWordCounts: EntryWordCounts = {};
  for (const pattern of intentional) {
    for (const entryIdStr of pattern.entryIds) {
      if (entryIdStr in entryWordCounts) continue;
      const entry = await entryStore.get(entryId(entryIdStr));
      entryWordCounts[entryIdStr] = entry ? countWords(entry.body) : 0;
    }
  }

  const proposals: PatternProposal[] = [];
  for (const pattern of intentional) {
    const sightings = sightingsForPattern(pattern.id, allObservations);
    const proposal = proposalFor(pattern, sightings, entryWordCounts, config);
    if (!proposal) continue;

    proposals.push({
      patternId: proposal.patternId,
      statement: pattern.statement,
      dimension: pattern.dimension,
      sightingCount: proposal.sightingCount,
      distinctEntryCount: proposal.distinctEntryCount,
      totalWordCount: proposal.totalWordCount,
    });

    if (!pattern.proposalSurfacedAt) {
      await patternStore.markProposalSurfaced(pattern.id);
      eventBus?.emit("pattern:proposal", {
        patternId: pattern.id,
        statement: pattern.statement,
        dimension: pattern.dimension,
      });
    }
  }

  return proposals;
}

// This function is long (~550 lines) because it registers every pattern-grain
// endpoint (REQ-LPC-28) as one `app.<method>` call each, matching this
// project's existing route-factory convention (routes/entries.ts,
// routes/observations.ts): one factory returns one Hono app plus its
// OperationDefinitions, with each handler inline rather than extracted, so
// route + CLI-discovery metadata stay next to each other. Splitting handlers
// into standalone functions would break from that convention project-wide,
// not just here — worth revisiting as a cross-cutting refactor if route
// files keep growing, not as a one-off change to this file alone.
export function createPatternRoutes(deps: PatternsDeps): RouteModule {
  const app = new Hono();
  const { patternStore, observationStore, entryStore, snapshotStore, profileStore, config, eventBus } = deps;
  const now = deps.now ?? (() => new Date().toISOString());

  app.get("/patterns/session", async (c) => {
    const rawPatterns = await patternStore.list();
    const allObservations = await observationStore.list();
    const snapshots = await snapshotStore.listAll();
    const profile = await profileStore.get();

    const patterns = await resolveWatchesAndEmit(rawPatterns, allObservations, snapshots, patternStore, eventBus, config, now);

    const getEntryText = async (id: string) => (await entryStore.get(entryId(id)))?.body;
    const session = await assembleCurationSession(patterns, allObservations, snapshots, getEntryText, profile.rules, config);
    const proposals = await computeProposals(patterns, allObservations, entryStore, patternStore, eventBus, config);

    return c.json({ ...session, proposals });
  });

  app.get("/patterns/watch", async (c) => {
    const rawPatterns = await patternStore.list();
    const allObservations = await observationStore.list();
    const snapshots = await snapshotStore.listAll();
    const profile = await profileStore.get();

    const patterns = await resolveWatchesAndEmit(rawPatterns, allObservations, snapshots, patternStore, eventBus, config, now);

    const getEntryText = async (id: string) => (await entryStore.get(entryId(id)))?.body;
    const session = await assembleCurationSession(patterns, allObservations, snapshots, getEntryText, profile.rules, config);

    return c.json({ watchList: session.watchList });
  });

  app.get("/patterns", async (c) => {
    const statusParam = c.req.query("status");
    if (statusParam) {
      const parsed = PatternStatusSchema.safeParse(statusParam);
      if (!parsed.success) {
        return c.json({ error: `Invalid status filter: "${statusParam}"` }, 400);
      }
      return c.json(await patternStore.list({ status: parsed.data }));
    }
    return c.json(await patternStore.list());
  });

  app.get("/patterns/:id", async (c) => {
    const id = c.req.param("id");
    if (!isValidPatternId(id)) return c.json({ error: "Invalid pattern ID" }, 400);

    const pattern = await patternStore.get(id);
    if (!pattern) return c.json({ error: "Pattern not found" }, 404);

    const allObservations = await observationStore.list();
    const snapshots = await snapshotStore.listAll();
    const resolveText = makeEntryTextResolver(entryStore);

    return c.json(await buildDossier(pattern, allObservations, snapshots, resolveText));
  });

  app.post("/patterns/:id/classify", async (c) => {
    const id = c.req.param("id");
    if (!isValidPatternId(id)) return c.json({ error: "Invalid pattern ID" }, 400);

    const body = await readJsonBody(c);
    if (!body.ok) return c.json({ error: "Invalid JSON body" }, 400);
    const parsed = ClassifyPatternRequestSchema.safeParse(body.data);
    if (!parsed.success) {
      return c.json({ error: "Invalid request", details: parsed.error.message }, 400);
    }

    const existing = await patternStore.get(id);
    if (!existing) return c.json({ error: "Pattern not found" }, 404);

    let updated: Pattern;
    try {
      updated = await patternStore.updateStatus(id, parsed.data.status);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid transition";
      return c.json({ error: message }, 409);
    }

    if (parsed.data.status === "accidental") {
      const snapshots = await snapshotStore.listAll();
      const baseline =
        updated.metricLink && isLinkableMetricKey(updated.metricLink)
          ? rollingMean(snapshots, updated.metricLink, WATCH_BASELINE_WINDOW)
          : undefined;
      updated = await patternStore.setWatch(id, { classifiedAt: now(), baseline, resolved: false });
    }

    // Classify-and-promote in one action (REQ-LPC-16): bypasses the
    // promotion thresholds entirely (unlike proposal accept), since the
    // writer's judgment is the asymmetric standard here.
    let rule;
    if (parsed.data.promote && parsed.data.status === "intentional" && !updated.ruleId) {
      rule = await profileStore.addOrMergeRule(updated.statement, updated.dimension, {
        patternId: updated.id,
        provenance: "writer-asserted",
        distinctEntryCount: updated.entryIds.length,
      });
      updated = await patternStore.linkRule(id, rule.id);
    }

    return c.json({ ...updated, rule });
  });

  app.post("/patterns/:id/promote", async (c) => {
    const id = c.req.param("id");
    if (!isValidPatternId(id)) return c.json({ error: "Invalid pattern ID" }, 400);

    const body = await readJsonBody(c);
    if (!body.ok) return c.json({ error: "Invalid JSON body" }, 400);
    const parsed = PromotePatternRequestSchema.safeParse(body.data);
    if (!parsed.success) {
      return c.json({ error: "Invalid request", details: parsed.error.message }, 400);
    }

    const pattern = await patternStore.get(id);
    if (!pattern) return c.json({ error: "Pattern not found" }, 404);
    if (pattern.status !== "intentional") {
      return c.json({ error: "Only an intentional pattern can be promoted" }, 409);
    }
    if (pattern.ruleId) {
      return c.json({ error: "Pattern is already promoted" }, 409);
    }

    const rule = await profileStore.addOrMergeRule(pattern.statement, pattern.dimension, {
      patternId: pattern.id,
      provenance: "writer-asserted",
      distinctEntryCount: pattern.entryIds.length,
    });
    const updated = await patternStore.linkRule(id, rule.id);

    return c.json({ ...updated, rule });
  });

  app.post("/patterns/:id/proposal", async (c) => {
    const id = c.req.param("id");
    if (!isValidPatternId(id)) return c.json({ error: "Invalid pattern ID" }, 400);

    const body = await readJsonBody(c);
    if (!body.ok) return c.json({ error: "Invalid JSON body" }, 400);
    const parsed = PatternProposalActionRequestSchema.safeParse(body.data);
    if (!parsed.success) {
      return c.json({ error: "Invalid request", details: parsed.error.message }, 400);
    }

    const pattern = await patternStore.get(id);
    if (!pattern) return c.json({ error: "Pattern not found" }, 404);

    if (parsed.data.action === "decline") {
      const updated = await patternStore.declineProposal(id);
      return c.json(updated);
    }

    if (pattern.ruleId) {
      return c.json({ error: "Pattern is already promoted" }, 409);
    }

    // Accept re-checks the gate at accept time (REQ-LPC-14/15): a proposal
    // is derived state, not a stored commitment, so evidence could in
    // principle have moved (e.g. a sighting was detached) between when the
    // writer saw it at session-assembly time and when they act on it.
    const allObservations = await observationStore.list();
    const sightings = sightingsForPattern(id, allObservations);
    const entryWordCounts: EntryWordCounts = {};
    for (const entryIdStr of pattern.entryIds) {
      const entry = await entryStore.get(entryId(entryIdStr));
      entryWordCounts[entryIdStr] = entry ? countWords(entry.body) : 0;
    }
    const proposal = proposalFor(pattern, sightings, entryWordCounts, config);
    if (!proposal) {
      return c.json({ error: "Pattern no longer meets the promotion thresholds" }, 409);
    }

    const rule = await profileStore.addOrMergeRule(pattern.statement, pattern.dimension, {
      patternId: pattern.id,
      provenance: "evidence-confirmed",
      distinctEntryCount: pattern.entryIds.length,
    });
    const updated = await patternStore.linkRule(id, rule.id);

    return c.json({ ...updated, rule });
  });

  app.post("/patterns/:id/detach", async (c) => {
    const id = c.req.param("id");
    if (!isValidPatternId(id)) return c.json({ error: "Invalid pattern ID" }, 400);

    const body = await readJsonBody(c);
    if (!body.ok) return c.json({ error: "Invalid JSON body" }, 400);
    const parsed = DetachSightingRequestSchema.safeParse(body.data);
    if (!parsed.success) {
      return c.json({ error: "Invalid request", details: parsed.error.message }, 400);
    }

    const source = await patternStore.get(id);
    if (!source) return c.json({ error: "Pattern not found" }, 404);

    const allObservations = await observationStore.list();
    const target = allObservations.find((o) => o.id === parsed.data.sightingId && o.patternId === id);
    if (!target) return c.json({ error: "Sighting not found on this pattern" }, 404);

    // Detach uses the observation's own free-text pattern description for
    // the new candidate's statement, not the source pattern's canonical
    // statement — the whole point of detach is that this sighting was
    // mis-attributed, so its evidence names a different habit than the
    // pattern it's leaving (REQ-LPC-6).
    const newPattern = await patternStore.create({
      statement: target.pattern,
      dimension: target.dimension,
    });

    await observationStore.reassignPattern(observationId(target.id), newPattern.id);

    const sighting: Sighting = {
      id: target.id,
      patternId: newPattern.id,
      entryId: target.entryId,
      evidence: target.evidence,
      dimension: target.dimension,
      createdAt: target.createdAt,
    };
    const recordedPattern = await patternStore.recordSighting(newPattern.id, sighting);

    const remaining = allObservations
      .filter((o) => o.patternId === id && o.id !== target.id)
      .map(toSighting);
    const updatedSource = await patternStore.detachSighting(id, remaining);

    eventBus?.emit("pattern:discovered", { pattern: recordedPattern });

    return c.json({ source: updatedSource, newPattern: recordedPattern });
  });

  app.post("/patterns/:id/merge", async (c) => {
    const id = c.req.param("id");
    if (!isValidPatternId(id)) return c.json({ error: "Invalid pattern ID" }, 400);

    const body = await readJsonBody(c);
    if (!body.ok) return c.json({ error: "Invalid JSON body" }, 400);
    const parsed = MergePatternsRequestSchema.safeParse(body.data);
    if (!parsed.success) {
      return c.json({ error: "Invalid request", details: parsed.error.message }, 400);
    }
    const { duplicateId } = parsed.data;
    // duplicateId arrives in the request body, not a path param, but still
    // flows into a file-path join inside pattern-store.ts (get/merge) — the
    // same path-traversal exposure the F-01 fix addressed for URL path IDs
    // (entries.ts/observations.ts), just reached through the body instead.
    if (!isValidPatternId(duplicateId)) {
      return c.json({ error: "Invalid duplicate pattern ID" }, 400);
    }
    if (duplicateId === id) {
      return c.json({ error: "Cannot merge a pattern into itself" }, 400);
    }

    const survivor = await patternStore.get(id);
    if (!survivor) return c.json({ error: "Pattern not found" }, 404);
    const duplicate = await patternStore.get(duplicateId);
    if (!duplicate) return c.json({ error: "Duplicate pattern not found" }, 404);

    let merged: Pattern;
    try {
      merged = await patternStore.merge(id, duplicateId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Merge failed";
      return c.json({ error: message }, 409);
    }

    // pattern-store.ts's merge() only updates pattern-level counters; the
    // moved sightings' own patternId field is this route's job (it has the
    // observation store access pattern-store.ts deliberately doesn't).
    const allObservations = await observationStore.list();
    for (const obs of allObservations) {
      if (obs.patternId === duplicateId) {
        await observationStore.reassignPattern(observationId(obs.id), id);
      }
    }

    // Same as retire/dismiss (REQ-LPC-22): the duplicate is now retired, so
    // any rule it had linked no longer has a legitimate backing pattern and
    // must not survive as an orphan in the profile.
    if (duplicate.ruleId) {
      await profileStore.deleteRule(duplicate.ruleId);
    }

    return c.json(merged);
  });

  app.post("/patterns/:id/dismiss", async (c) => {
    const id = c.req.param("id");
    if (!isValidPatternId(id)) return c.json({ error: "Invalid pattern ID" }, 400);

    const body = await readJsonBody(c);
    if (!body.ok) return c.json({ error: "Invalid JSON body" }, 400);
    const parsed = DismissPatternRequestSchema.safeParse(body.data);
    if (!parsed.success) {
      return c.json({ error: "Invalid request", details: parsed.error.message }, 400);
    }

    const pattern = await patternStore.get(id);
    if (!pattern) return c.json({ error: "Pattern not found" }, 404);

    let updated: Pattern;
    try {
      // dismissedAsWrong distinguishes this from a plain retire (planning
      // decision 1): dismiss never sets a watch item, unlike classify-accidental.
      updated = await patternStore.updateStatus(id, "retired", { dismissedAsWrong: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid transition";
      return c.json({ error: message }, 409);
    }

    // Same as retire (REQ-LPC-22): a dismissed pattern's linked rule, if any,
    // no longer has a legitimate backing pattern and must not survive as an
    // orphan in the profile.
    if (pattern.ruleId) {
      await profileStore.deleteRule(pattern.ruleId);
    }

    return c.json(updated);
  });

  // Doubles as the "retire" action for a resurfaced rule (Phase 5 rule
  // health, REQ-LPC-19/20/21/22): whether the writer reaches a pattern via a
  // fresh dossier or a resurfaced-rule prompt, retiring is the same action
  // on the same pattern ID — no separate resurfaced-rule endpoint needed.
  app.post("/patterns/:id/retire", async (c) => {
    const id = c.req.param("id");
    if (!isValidPatternId(id)) return c.json({ error: "Invalid pattern ID" }, 400);

    const body = await readJsonBody(c);
    if (!body.ok) return c.json({ error: "Invalid JSON body" }, 400);
    const parsed = RetirePatternRequestSchema.safeParse(body.data);
    if (!parsed.success) {
      return c.json({ error: "Invalid request", details: parsed.error.message }, 400);
    }

    const pattern = await patternStore.get(id);
    if (!pattern) return c.json({ error: "Pattern not found" }, 404);

    let updated: Pattern;
    try {
      updated = await patternStore.updateStatus(id, "retired");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid transition";
      return c.json({ error: message }, 409);
    }

    // REQ-LPC-22: retiring a pattern with a linked rule also removes the
    // rule from the profile.
    if (pattern.ruleId) {
      await profileStore.deleteRule(pattern.ruleId);
    }

    return c.json(updated);
  });

  /**
   * Reaffirms the rule linked to this pattern (REQ-LPC-19/20/21): the writer's
   * counterpart to retire on a rule resurfaced for staleness or drift. Stamps
   * `lastSupportedAt` to now; nothing about classification or evidence
   * changes. Addressed by pattern ID (not rule ID) for the same reason retire
   * is: the writer is acting from the pattern's dossier/resurfaced-rule
   * entry, which already has the pattern ID at hand.
   */
  app.post("/patterns/:id/reaffirm", async (c) => {
    const id = c.req.param("id");
    if (!isValidPatternId(id)) return c.json({ error: "Invalid pattern ID" }, 400);

    const body = await readJsonBody(c);
    if (!body.ok) return c.json({ error: "Invalid JSON body" }, 400);
    const parsed = ReaffirmRuleRequestSchema.safeParse(body.data);
    if (!parsed.success) {
      return c.json({ error: "Invalid request", details: parsed.error.message }, 400);
    }

    const pattern = await patternStore.get(id);
    if (!pattern) return c.json({ error: "Pattern not found" }, 404);
    if (!pattern.ruleId) {
      return c.json({ error: "Pattern has no linked rule to reaffirm" }, 409);
    }

    const rule = await profileStore.reaffirmRule(pattern.ruleId);
    if (!rule) return c.json({ error: "Linked rule not found" }, 404);

    return c.json(rule);
  });

  app.post("/patterns/:id/reactivate", async (c) => {
    const id = c.req.param("id");
    if (!isValidPatternId(id)) return c.json({ error: "Invalid pattern ID" }, 400);

    const body = await readJsonBody(c);
    if (!body.ok) return c.json({ error: "Invalid JSON body" }, 400);
    const parsed = ReactivatePatternRequestSchema.safeParse(body.data);
    if (!parsed.success) {
      return c.json({ error: "Invalid request", details: parsed.error.message }, 400);
    }

    const pattern = await patternStore.get(id);
    if (!pattern) return c.json({ error: "Pattern not found" }, 404);
    if (pattern.status !== "retired") {
      return c.json({ error: "Only a retired pattern can be reactivated" }, 409);
    }

    // updateStatus clears `retirement` whenever the target status isn't
    // "retired" (planning decision 1: reactivate clears the marker).
    const updated = await patternStore.updateStatus(id, "undecided");
    return c.json(updated);
  });

  return {
    routes: app,
    operations: [
      {
        operationId: "patterns.session",
        name: "curate",
        description: "Get the pattern curation session (dossiers, contradictions, watch list, proposals)",
        invocation: { method: "GET", path: "/patterns/session" },
        hierarchy: { root: "patterns", feature: "curate" },
        idempotent: true,
      },
      {
        operationId: "patterns.list",
        name: "list",
        description: "List all patterns in the ledger (optional --status filter)",
        invocation: { method: "GET", path: "/patterns" },
        hierarchy: { root: "patterns", feature: "list" },
        parameters: [
          {
            name: "status",
            description: "Filter by status: candidate, intentional, accidental, undecided, retired",
            required: false,
            type: "string" as const,
          },
        ],
        idempotent: true,
      },
      {
        operationId: "patterns.show",
        name: "show",
        description: "Show a single pattern's dossier",
        invocation: { method: "GET", path: "/patterns/:id" },
        hierarchy: { root: "patterns", feature: "show" },
        parameters: [{ name: "id", description: "Pattern ID", required: true, type: "string" as const }],
        idempotent: true,
      },
      {
        operationId: "patterns.watch",
        name: "watch",
        description: "List patterns currently on the accidental watch list",
        invocation: { method: "GET", path: "/patterns/watch" },
        hierarchy: { root: "patterns", feature: "watch" },
        idempotent: true,
      },
      {
        operationId: "patterns.classify",
        name: "classify",
        description: "Classify a pattern as intentional, accidental, or undecided (optionally promote in the same action)",
        invocation: { method: "POST", path: "/patterns/:id/classify" },
        hierarchy: { root: "patterns", feature: "classify" },
        parameters: [
          { name: "id", description: "Pattern ID", required: true, type: "string" as const },
          { name: "status", description: "Classification: intentional, accidental, or undecided", required: true, type: "string" as const },
          { name: "promote", description: "Promote to a profile rule in the same action", required: false, type: "string" as const },
        ],
        idempotent: false,
      },
      {
        operationId: "patterns.promote",
        name: "promote",
        description: "Promote an intentional pattern directly to a writer-asserted profile rule",
        invocation: { method: "POST", path: "/patterns/:id/promote" },
        hierarchy: { root: "patterns", feature: "promote" },
        parameters: [{ name: "id", description: "Pattern ID", required: true, type: "string" as const }],
        idempotent: false,
      },
      {
        operationId: "patterns.proposal",
        name: "proposal",
        description: "Accept or decline a pending promotion proposal",
        invocation: { method: "POST", path: "/patterns/:id/proposal" },
        hierarchy: { root: "patterns", feature: "proposal" },
        parameters: [
          { name: "id", description: "Pattern ID", required: true, type: "string" as const },
          { name: "action", description: "accept or decline", required: true, type: "string" as const },
        ],
        idempotent: false,
      },
      {
        operationId: "patterns.detach",
        name: "detach",
        description: "Detach a mis-attributed sighting into its own new candidate pattern",
        invocation: { method: "POST", path: "/patterns/:id/detach" },
        hierarchy: { root: "patterns", feature: "detach" },
        parameters: [
          { name: "id", description: "Pattern ID", required: true, type: "string" as const },
          { name: "sightingId", description: "Sighting (observation) ID to detach", required: true, type: "string" as const },
        ],
        idempotent: false,
      },
      {
        operationId: "patterns.merge",
        name: "merge",
        description: "Merge a duplicate pattern's sightings into this survivor pattern",
        invocation: { method: "POST", path: "/patterns/:id/merge" },
        hierarchy: { root: "patterns", feature: "merge" },
        parameters: [
          { name: "id", description: "Survivor pattern ID", required: true, type: "string" as const },
          { name: "duplicateId", description: "Duplicate pattern ID to merge in", required: true, type: "string" as const },
        ],
        idempotent: false,
      },
      {
        operationId: "patterns.dismiss",
        name: "dismiss",
        description: "Dismiss a pattern as a wrong observation (retires it, never enters the watch list)",
        invocation: { method: "POST", path: "/patterns/:id/dismiss" },
        hierarchy: { root: "patterns", feature: "dismiss" },
        parameters: [{ name: "id", description: "Pattern ID", required: true, type: "string" as const }],
        idempotent: false,
      },
      {
        operationId: "patterns.retire",
        name: "retire",
        description: "Retire a pattern (and remove its linked rule from the profile, if any)",
        invocation: { method: "POST", path: "/patterns/:id/retire" },
        hierarchy: { root: "patterns", feature: "retire" },
        parameters: [{ name: "id", description: "Pattern ID", required: true, type: "string" as const }],
        idempotent: false,
      },
      {
        operationId: "patterns.reactivate",
        name: "reactivate",
        description: "Reactivate a retired pattern back to undecided",
        invocation: { method: "POST", path: "/patterns/:id/reactivate" },
        hierarchy: { root: "patterns", feature: "reactivate" },
        parameters: [{ name: "id", description: "Pattern ID", required: true, type: "string" as const }],
        idempotent: false,
      },
      {
        operationId: "patterns.reaffirm",
        name: "reaffirm",
        description: "Reaffirm the rule linked to this pattern, clearing a stale/drift resurfacing",
        invocation: { method: "POST", path: "/patterns/:id/reaffirm" },
        hierarchy: { root: "patterns", feature: "reaffirm" },
        parameters: [{ name: "id", description: "Pattern ID", required: true, type: "string" as const }],
        idempotent: false,
      },
    ],
  };
}
