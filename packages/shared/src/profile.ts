import { z } from "zod";
import { ObservationDimensionSchema } from "./observations.js";

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
});

export type ProfileRule = z.infer<typeof ProfileRuleSchema>;

// --- Full profile ---

export const ProfileSchema = z.object({
  /** Profile version for future compatibility */
  version: z.literal(1),
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
