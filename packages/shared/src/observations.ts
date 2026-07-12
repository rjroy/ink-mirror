import { z } from "zod";

// --- Observation dimension ---

export const ObservationDimensionSchema = z.enum([
  "sentence-rhythm",
  "word-level-habits",
  "sentence-structure",
  "paragraph-structure",
]);

export type ObservationDimension = z.infer<typeof ObservationDimensionSchema>;

export const DIMENSION_LABELS: Record<ObservationDimension, string> = {
  "sentence-rhythm": "Sentence Rhythm",
  "word-level-habits": "Word-Level Habits",
  "sentence-structure": "Sentence Structure",
  "paragraph-structure": "Paragraph Structure",
};

// --- Single observation ---

export const ObservationSchema = z.object({
  id: z.string(),
  entryId: z.string(),
  /**
   * Every stored observation is a sighting of a pattern (REQ-LPC-2): the
   * pattern-ledger ID it resolved to, whether matched against an existing
   * pattern or freshly created (Phase 3). Full sighting-file semantics
   * (SightingSchema in patterns.ts) land in a later migration; this field is
   * the transitional bridge on today's observation file shape.
   */
  patternId: z.string(),
  pattern: z.string().min(1),
  evidence: z.string().min(1),
  dimension: ObservationDimensionSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Observation = z.infer<typeof ObservationSchema>;

// --- LLM output shape (what the Observer returns before storage) ---

/** Declares a brand new pattern for the ledger (REQ-LPC-4). */
export const NewPatternDeclarationSchema = z.object({
  statement: z.string().min(1),
  dimension: ObservationDimensionSchema,
  /**
   * Not validated against the linkable-metric registry here: an invalid link
   * downgrades the pattern to qualitative at Observer validation time
   * (spec Concepts), it is not a rejection. Registry validation only applies
   * once a link is stored on a Pattern (see patterns.ts, metrics.ts).
   */
  metricLink: z.string().optional(),
});

export type NewPatternDeclaration = z.infer<typeof NewPatternDeclarationSchema>;

/**
 * Resolves an output observation to exactly one pattern: a sighting of an
 * existing pattern (patternId) or the discovery of a new one (newPattern).
 * Never both, never neither (REQ-LPC-4, REQ-LPC-2).
 */
export const PatternRefSchema = z
  .object({
    patternId: z.string().optional(),
    newPattern: NewPatternDeclarationSchema.optional(),
  })
  .refine((ref) => Boolean(ref.patternId) !== Boolean(ref.newPattern), {
    message: "patternRef must include exactly one of patternId or newPattern",
  });

export type PatternRef = z.infer<typeof PatternRefSchema>;

export const RawObservationSchema = z.object({
  pattern: z.string().min(1),
  evidence: z.string().min(1),
  dimension: ObservationDimensionSchema,
  /**
   * Optional until the Observer rework (Phase 3) starts emitting it; existing
   * callers that construct a RawObservation without patternRef stay valid.
   */
  patternRef: PatternRefSchema.optional(),
});

export type RawObservation = z.infer<typeof RawObservationSchema>;

export const ObserverOutputSchema = z.object({
  observations: z
    .array(RawObservationSchema)
    .min(1)
    .max(3),
});

export type ObserverOutput = z.infer<typeof ObserverOutputSchema>;

// --- Curation API schemas ---
//
// Observation-grain classification (ClassifyObservationRequestSchema,
// VALID_TRANSITIONS, isValidTransition, CurationStatusSchema) is removed
// (REQ-LPC-30): the per-observation `status` field and its transition table
// don't apply anymore now that classification is a pattern-level concept
// only (REQ-LPC-13), enforced by patterns.ts's
// PATTERN_TRANSITIONS/isValidPatternTransition. Phase 5's migration.ts moves
// any stored `status` value on a legacy file to the pattern created for it,
// then rewrites the file without the field.

/** Observation with the original entry text included for curation context (REQ-V1-17). */
export const ObservationWithContextSchema = ObservationSchema.extend({
  entryText: z.string(),
});

export type ObservationWithContext = z.infer<typeof ObservationWithContextSchema>;

/** A detected contradiction between a new observation and a confirmed one (REQ-V1-19). */
export const ContradictionSchema = z.object({
  newObservation: ObservationWithContextSchema,
  confirmedObservation: ObservationWithContextSchema,
  dimension: ObservationDimensionSchema,
});

export type Contradiction = z.infer<typeof ContradictionSchema>;

/** The curation session: observations to classify, plus any contradictions to resolve. */
export const CurationSessionSchema = z.object({
  observations: z.array(ObservationWithContextSchema),
  contradictions: z.array(ContradictionSchema),
});

export type CurationSession = z.infer<typeof CurationSessionSchema>;
