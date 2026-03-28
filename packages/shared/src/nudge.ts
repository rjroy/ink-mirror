import { z } from "zod";

// --- Craft principle identifiers (REQ-CN-37) ---

export const CraftPrincipleSchema = z.enum([
  "characters-as-subjects",
  "nominalization-density",
  "passive-voice-clustering",
  "unnecessary-words",
  "concrete-over-abstract",
  "sentence-monotony",
  "buried-lead",
  "old-before-new",
  "hedging-accumulation",
  "unclear-antecedent",
  "curse-of-knowledge",
  "dangling-modifier",
]);

export type CraftPrinciple = z.infer<typeof CraftPrincipleSchema>;

// --- Single nudge (REQ-CN-16) ---

export const CraftNudgeSchema = z.object({
  craftPrinciple: CraftPrincipleSchema,
  evidence: z.string().min(1),
  observation: z.string().min(1),
  question: z.string().min(1),
});

export type CraftNudge = z.infer<typeof CraftNudgeSchema>;

// --- LLM output shape (REQ-CN-20, REQ-CN-22) ---

export const NudgeOutputSchema = z.object({
  nudges: z.array(CraftNudgeSchema).min(0).max(5),
});

export type NudgeOutput = z.infer<typeof NudgeOutputSchema>;

// --- Request schema (REQ-CN-24) ---

export const NudgeRequestSchema = z
  .object({
    entryId: z.string().optional(),
    text: z.string().optional(),
    context: z.string().optional(),
  })
  .refine((data) => data.entryId || data.text, {
    message: "At least one of entryId or text is required",
  });

export type NudgeRequest = z.infer<typeof NudgeRequestSchema>;

// --- Response schema (REQ-CN-25) ---

export const NudgeResponseSchema = z.object({
  nudges: z.array(CraftNudgeSchema),
  metrics: z.object({
    passiveRatio: z.number(),
    totalSentences: z.number(),
    hedgingWordCount: z.number(),
    rhythmVariance: z.number(),
  }),
  error: z.string().optional(),
});

export type NudgeResponse = z.infer<typeof NudgeResponseSchema>;
