import { z } from "zod";
import { ObservationDimensionSchema } from "./observations.js";
import { isLinkableMetricKey } from "./metrics.js";
import { ProfileRuleSchema } from "./profile.js";

// --- Pattern lifecycle ---

export const PatternStatusSchema = z.enum([
  "candidate",
  "intentional",
  "accidental",
  "undecided",
  "retired",
]);

export type PatternStatus = z.infer<typeof PatternStatusSchema>;

/**
 * Valid lifecycle transitions for patterns (REQ-LPC-13/22, spec Concepts).
 * candidate/undecided -> any classification (intentional/accidental/undecided).
 * Any classified status can be re-classified into another classified status.
 * retired is reached only via a retire/dismiss/merge action (modeled here as
 * a transition into "retired" from any non-retired status).
 * retired -> undecided only, via reactivate.
 */
export const PATTERN_TRANSITIONS: Record<PatternStatus, PatternStatus[]> = {
  candidate: ["intentional", "accidental", "undecided", "retired"],
  undecided: ["intentional", "accidental", "retired"],
  intentional: ["accidental", "undecided", "retired"],
  accidental: ["intentional", "undecided", "retired"],
  retired: ["undecided"],
};

export function isValidPatternTransition(
  from: PatternStatus,
  to: PatternStatus,
): boolean {
  return PATTERN_TRANSITIONS[from].includes(to);
}

// --- Watch item: tracking metadata for accidental patterns (REQ-LPC-23/25) ---

export const WatchItemSchema = z.object({
  /** When the pattern was classified accidental (start of the watch window). */
  classifiedAt: z.string(),
  /** Pre-classification baseline rate. Computable patterns only. */
  baseline: z.number().optional(),
  resolved: z.boolean(),
  resolvedAt: z.string().optional(),
});

export type WatchItem = z.infer<typeof WatchItemSchema>;

// --- Pattern retirement metadata ---

/**
 * dismissedAsWrong and mergedInto are mutually exclusive retirement reasons:
 * a pattern is either dismissed as wrong or merged into a survivor, never
 * both (planning decisions 1 and 2). Both absent is a plain retirement.
 */
export const PatternRetirementSchema = z
  .object({
    /** Distinguishes an explicit dismiss (wrong observation) from an ordinary retire. */
    dismissedAsWrong: z.boolean().optional(),
    /** Set when this pattern was retired as the losing side of a merge. */
    mergedInto: z.string().optional(),
  })
  .refine((r) => !(r.dismissedAsWrong && r.mergedInto), {
    message:
      "retirement must not set both dismissedAsWrong and mergedInto",
  });

export type PatternRetirement = z.infer<typeof PatternRetirementSchema>;

// --- Pattern: a first-class, named, dimension-tagged writing habit (REQ-LPC-1) ---

export const PatternSchema = z.object({
  id: z.string(),
  /** Canonical statement phrased as a stable characteristic. */
  statement: z.string().min(1),
  dimension: ObservationDimensionSchema,
  status: PatternStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  /** Must name a key in the linkable-metric registry (metrics.ts); absent means qualitative. */
  metricLink: z
    .string()
    .refine(isLinkableMetricKey, {
      message: "metricLink must reference a key in the linkable-metric registry",
    })
    .optional(),
  lastSightingAt: z.string().optional(),
  /** Denormalized counter, kept in sync by pattern-store.ts on sighting/detach/merge. */
  sightingCount: z.number().int().nonnegative(),
  /** Distinct entry IDs this pattern has been sighted in, for threshold math (REQ-LPC-14). */
  entryIds: z.array(z.string()),
  retirement: PatternRetirementSchema.optional(),
  watch: WatchItemSchema.optional(),
  /** Linked profile rule, once promoted. */
  ruleId: z.string().optional(),
  /**
   * Set by Phase 5's migration (REQ-LPC-27) on patterns created from a
   * pre-existing v1 profile rule's text: the rule format stored no curation
   * history or evidence, so there is nothing richer to recover. Lets the
   * dossier show an explicit "migrated, no historical sightings recorded"
   * state (REQ-LPC-18 exception) instead of implying the pattern has real
   * sighting evidence when sightingCount is simply 0.
   */
  migratedNoHistory: z.boolean().optional(),
  /**
   * Set when the writer declines a promotion proposal (REQ-LPC-15/Phase 4
   * planning decision): promotion.ts's proposalFor() suppresses re-proposing
   * this pattern until a sighting newer than this timestamp arrives, so a
   * decline doesn't resurface every curation session but new evidence still
   * reopens the question.
   */
  proposalDeclinedAt: z.string().optional(),
  /**
   * Set the first time a proposal for this pattern is computed and emitted
   * as a `pattern:proposal` event (route layer, session-assembly time).
   * Session assembly recomputes proposals from ledger state on every call
   * (no proposal store), so this is the only durable marker of "already
   * notified" — without it every GET /patterns/session would re-emit the
   * same proposal event. Cleared by declineProposal so a decline-then-new-
   * evidence reopening surfaces (and emits) again, matching how
   * proposalDeclinedAt already reopens proposalFor() itself.
   */
  proposalSurfacedAt: z.string().optional(),
});

export type Pattern = z.infer<typeof PatternSchema>;

// --- Sighting: one occurrence of a pattern in one entry (REQ-LPC-3) ---

export const SightingSchema = z.object({
  id: z.string(),
  patternId: z.string(),
  entryId: z.string(),
  evidence: z.array(z.string().min(1)).min(1),
  dimension: ObservationDimensionSchema,
  createdAt: z.string(),
});

export type Sighting = z.infer<typeof SightingSchema>;

/** Sighting with the source entry's text included for curation context (REQ-V1-17). */
export const SightingWithContextSchema = SightingSchema.extend({
  entryText: z.string(),
});

export type SightingWithContext = z.infer<typeof SightingWithContextSchema>;

// --- Dossier: a pattern plus its sightings, as presented at curation (REQ-LPC-12) ---

export const DossierTrendSchema = z.object({
  metricLink: z.string().refine(isLinkableMetricKey, {
    message: "metricLink must reference a key in the linkable-metric registry",
  }),
  rollingMean: z.number(),
  windowSize: z.number().int().positive(),
  baseline: z.number().optional(),
});

export type DossierTrend = z.infer<typeof DossierTrendSchema>;

export const DossierWatchStatusSchema = z.object({
  classifiedAt: z.string(),
  /** Deterministic recurrence text, e.g. "seen in 2 of 5 entries since you marked this accidental". */
  recurrenceText: z.string(),
  resolved: z.boolean(),
  resolvedAt: z.string().optional(),
});

export type DossierWatchStatus = z.infer<typeof DossierWatchStatusSchema>;

/**
 * Field order follows the research-grounded presentation order (Phase 4
 * plan): evidence first, pattern claim second, curation question
 * (classification/watch state) last. Object key order is preserved through
 * JSON.stringify, so this ordering is meaningful for API consumers that
 * render dossiers key-by-key, not just documentation.
 */
export const DossierSchema = z.object({
  sightings: z.array(SightingWithContextSchema),
  distinctEntryCount: z.number().int().nonnegative(),
  /** Present only for computable patterns. */
  trend: DossierTrendSchema.optional(),
  pattern: PatternSchema,
  /** Present only while the pattern is on the watch list. */
  watchStatus: DossierWatchStatusSchema.optional(),
  /** True when this dossier is currently surfaced as a promotion proposal. */
  isProposal: z.boolean(),
});

export type Dossier = z.infer<typeof DossierSchema>;

// --- Pattern-grain contradiction + curation session (REQ-LPC-12/13/24) ---

/** A detected contradiction between an unclassified pattern and an intentional one (REQ-LPC-13). */
export const PatternContradictionSchema = z.object({
  /** The candidate/undecided pattern raising the question. */
  pattern: PatternSchema,
  /** The already-confirmed intentional pattern it appears to oppose. */
  contradicts: PatternSchema,
  dimension: ObservationDimensionSchema,
});

export type PatternContradiction = z.infer<typeof PatternContradictionSchema>;

/** A pattern that has crossed the promotion thresholds and awaits writer accept/decline (REQ-LPC-14/15). */
export const PatternProposalSchema = z.object({
  patternId: z.string(),
  statement: z.string(),
  dimension: ObservationDimensionSchema,
  sightingCount: z.number().int().nonnegative(),
  distinctEntryCount: z.number().int().nonnegative(),
  totalWordCount: z.number().int().nonnegative(),
});

export type PatternProposal = z.infer<typeof PatternProposalSchema>;

// --- Resurfaced rule: rule health flag (REQ-LPC-19/20/21) ---

/** Why a rule resurfaced: staleness (no recent sighting) and/or drift (computable metric moved past its baseline margin). Either or both may fire at once. */
export const ResurfacedRuleReasonSchema = z.enum(["stale", "drift"]);

export type ResurfacedRuleReason = z.infer<typeof ResurfacedRuleReasonSchema>;

export const ResurfacedRuleDriftSchema = z.object({
  rollingMean: z.number(),
  baseline: z.number(),
  relativeDeviation: z.number(),
  /** The configured margin the deviation crossed (config.driftMargin at evaluation time). */
  margin: z.number(),
});

export type ResurfacedRuleDrift = z.infer<typeof ResurfacedRuleDriftSchema>;

/**
 * A profile rule flagged for reaffirm-or-retire (REQ-LPC-19/20/21): the rule
 * and its linked pattern, why it resurfaced, and the deterministic substrate
 * numbers backing the flag (REQ-LPC-8 — never LLM-narrated). Producing one of
 * these never mutates the rule or pattern (REQ-LPC-20's never-auto-retire);
 * it only reports for the writer to act on via reaffirm/retire.
 */
export const ResurfacedRuleSchema = z.object({
  rule: ProfileRuleSchema,
  pattern: PatternSchema,
  reasons: z.array(ResurfacedRuleReasonSchema).min(1),
  /** Present when staleness is one of the reasons. */
  staleness: z.object({ windowSize: z.number().int().positive() }).optional(),
  /** Present when drift is one of the reasons (computable patterns only). */
  drift: ResurfacedRuleDriftSchema.optional(),
});

export type ResurfacedRule = z.infer<typeof ResurfacedRuleSchema>;

/**
 * The pattern-grain curation session (REQ-LPC-12): dossiers to judge, any
 * contradictions to resolve, watched patterns' recurrence status, and rules
 * resurfaced by Phase 5's rule-health check (REQ-LPC-19/20/21).
 *
 * `proposals` is optional here because curation.ts's assembleCurationSession
 * deliberately never computes it (see that module's doc comment) — the
 * route layer (routes/patterns.ts) composes proposals in per intentional
 * pattern via promotion.ts's proposalFor() and always includes the field on
 * the actual GET /patterns/session response.
 */
export const PatternCurationSessionSchema = z.object({
  dossiers: z.array(DossierSchema),
  contradictions: z.array(PatternContradictionSchema),
  /** Dossiers for patterns currently on the accidental watch list (REQ-LPC-24). */
  watchList: z.array(DossierSchema),
  /** Rules resurfaced for reaffirm-or-retire this session (REQ-LPC-19/20/21). */
  resurfacedRules: z.array(ResurfacedRuleSchema),
  /** Pending promotion proposals, composed in at the route layer (REQ-LPC-15). */
  proposals: z.array(PatternProposalSchema).optional(),
});

export type PatternCurationSession = z.infer<typeof PatternCurationSessionSchema>;

// --- Pattern-grain curation API request schemas (REQ-LPC-28) ---

export const ClassifyPatternRequestSchema = z.object({
  status: z.enum(["intentional", "accidental", "undecided"]),
  /** Classify-and-promote in one action (REQ-LPC-16). */
  promote: z.boolean().optional(),
});

export type ClassifyPatternRequest = z.infer<typeof ClassifyPatternRequestSchema>;

export const DetachSightingRequestSchema = z.object({
  sightingId: z.string(),
});

export type DetachSightingRequest = z.infer<typeof DetachSightingRequestSchema>;

export const MergePatternsRequestSchema = z.object({
  duplicateId: z.string(),
});

export type MergePatternsRequest = z.infer<typeof MergePatternsRequestSchema>;

/** Retire with a `dismissedAsWrong` marker (planning decision 1). No body fields. */
export const DismissPatternRequestSchema = z.object({}).strict();

export type DismissPatternRequest = z.infer<typeof DismissPatternRequestSchema>;

/** Writer-direct promotion of an intentional pattern (REQ-LPC-16). No body fields. */
export const PromotePatternRequestSchema = z.object({}).strict();

export type PromotePatternRequest = z.infer<typeof PromotePatternRequestSchema>;

export const PatternProposalActionRequestSchema = z.object({
  action: z.enum(["accept", "decline"]),
});

export type PatternProposalActionRequest = z.infer<
  typeof PatternProposalActionRequestSchema
>;

/** No body fields; retiring a rule vs. a pattern is decided by the route, not the request. */
export const RetirePatternRequestSchema = z.object({}).strict();

export type RetirePatternRequest = z.infer<typeof RetirePatternRequestSchema>;

/** Reactivate a retired pattern back to undecided (REQ-LPC-22). No body fields. */
export const ReactivatePatternRequestSchema = z.object({}).strict();

export type ReactivatePatternRequest = z.infer<typeof ReactivatePatternRequestSchema>;

/**
 * Reaffirms the profile rule linked to this pattern (REQ-LPC-19/20/21): sets
 * the rule's `lastSupportedAt` to now, clearing a stale/drift resurfacing
 * without touching classification or evidence. No body fields.
 */
export const ReaffirmRuleRequestSchema = z.object({}).strict();

export type ReaffirmRuleRequest = z.infer<typeof ReaffirmRuleRequestSchema>;
