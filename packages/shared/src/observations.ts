import { z } from "zod";

// --- Observation dimension ---

export const ObservationDimensionSchema = z.enum([
  "sentence-rhythm",
  "word-level-habits",
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
