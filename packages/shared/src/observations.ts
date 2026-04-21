import { z } from "zod";

// --- Observation dimension ---

export const ObservationDimensionSchema = z.enum([
  "sentence-rhythm",
  "word-level-habits",
  "sentence-structure",
  "paragraph-structure",
]);

export type ObservationDimension = z.infer<typeof ObservationDimensionSchema>;

// --- Curation status ---

export const CurationStatusSchema = z.enum([
  "pending",
  "intentional",
  "accidental",
  "undecided",
]);

export type CurationStatus = z.infer<typeof CurationStatusSchema>;

// --- Single observation ---

export const ObservationSchema = z.object({
  id: z.string(),
  entryId: z.string(),
  pattern: z.string().min(1),
  evidence: z.string().min(1),
  dimension: ObservationDimensionSchema,
  status: CurationStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Observation = z.infer<typeof ObservationSchema>;

// --- LLM output shape (what the Observer returns before storage) ---

export const RawObservationSchema = z.object({
  pattern: z.string().min(1),
  evidence: z.string().min(1),
  dimension: ObservationDimensionSchema,
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

/**
 * Valid state transitions for observation curation.
 * pending -> intentional | accidental | undecided
 * undecided -> intentional | accidental
 * intentional and accidental are terminal states.
 */
export const VALID_TRANSITIONS: Record<CurationStatus, CurationStatus[]> = {
  pending: ["intentional", "accidental", "undecided"],
  undecided: ["intentional", "accidental"],
  intentional: [],
  accidental: [],
};

export function isValidTransition(
  from: CurationStatus,
  to: CurationStatus,
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export const ClassifyObservationRequestSchema = z.object({
  status: CurationStatusSchema.refine(
    (s) => s !== "pending",
    "Cannot classify as pending",
  ),
});

export type ClassifyObservationRequest = z.infer<
  typeof ClassifyObservationRequestSchema
>;

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
