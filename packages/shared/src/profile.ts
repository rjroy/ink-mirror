import { z } from "zod";
import { ObservationDimensionSchema } from "./observations.js";

// --- Rule provenance (REQ-LPC-16) ---

export const RuleProvenanceSchema = z.enum([
  "writer-asserted",
  "evidence-confirmed",
]);

export type RuleProvenance = z.infer<typeof RuleProvenanceSchema>;

// --- Profile rule: a stable characteristic derived from curated observations ---

export const ProfileRuleSchema = z.object({
  /** Unique rule ID, e.g. "rule-sentence-rhythm-001" */
  id: z.string(),
  /** Stable pattern description, no temporal references */
  pattern: z.string().min(1),
  /** Which observation dimension this rule belongs to */
  dimension: ObservationDimensionSchema,
  /** How many observations confirmed this pattern */
  sourceCount: z.number().int().positive(),
  /** Human-readable source summary */
  sourceSummary: z.string(),
  /** When the rule was first created */
  createdAt: z.string(),
  /** When the rule was last updated (source count bump, pattern edit) */
  updatedAt: z.string(),
  /**
   * Links to the pattern this rule was created from (REQ-LPC-18).
   * Optional until Phase 5 wires profile-store.ts's write path to always
   * populate it; profile-store.ts still creates rules without it today.
   */
  patternId: z.string().optional(),
  /**
   * How this rule entered the profile (REQ-LPC-16). Same optionality
   * caveat as patternId above.
   */
  provenance: RuleProvenanceSchema.optional(),
  /** Rolling-mean baseline at rule creation, for computable-pattern drift (REQ-LPC-21). */
  baseline: z.number().optional(),
  /** Last time a sighting supported this rule's pattern (REQ-LPC-19/20). */
  lastSupportedAt: z.string().optional(),
});

export type ProfileRule = z.infer<typeof ProfileRuleSchema>;

// --- Full profile ---

export const ProfileSchema = z.object({
  /**
   * Profile version. version: 2 adds patternId/provenance/health metadata to
   * rules (REQ-LPC-18/19). Both are valid during the migration window
   * (Phase 5); the write path will always emit 2 once migration lands.
   */
  version: z.union([z.literal(1), z.literal(2)]),
  /** When the profile was last modified */
  updatedAt: z.string(),
  /** All profile rules, keyed by dimension for structured access */
  rules: z.array(ProfileRuleSchema),
});

export type Profile = z.infer<typeof ProfileSchema>;

// --- API request schemas ---

export const UpdateProfileRuleRequestSchema = z.object({
  pattern: z.string().min(1).optional(),
  dimension: ObservationDimensionSchema.optional(),
});

export type UpdateProfileRuleRequest = z.infer<typeof UpdateProfileRuleRequestSchema>;

export const PutProfileRequestSchema = z.object({
  markdown: z.string(),
});

export type PutProfileRequest = z.infer<typeof PutProfileRequestSchema>;
