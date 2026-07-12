import { z } from "zod";
import { ObservationSchema, ObservationDimensionSchema } from "./observations.js";
import { PatternSchema } from "./patterns.js";

/**
 * Versioned SSE/EventBus payload types (REQ-LPC-29). Emission is wired in
 * later phases (observation:created in Phase 3, the pattern:* events in
 * Phase 4); this module defines the contract ahead of that wiring so the
 * daemon and clients can build against a stable shape.
 */

// --- observation:created (v2): existing observation payload + resolved pattern ---

export const ObservationCreatedEventSchema = ObservationSchema.extend({
  /** The pattern this observation resolved to as a sighting (REQ-LPC-2). */
  patternId: z.string(),
});

export type ObservationCreatedEvent = z.infer<typeof ObservationCreatedEventSchema>;

// --- pattern:discovered: a new candidate pattern was created ---

export const PatternDiscoveredEventSchema = z.object({
  pattern: PatternSchema,
});

export type PatternDiscoveredEvent = z.infer<typeof PatternDiscoveredEventSchema>;

// --- pattern:proposal: a pattern first crossed the promotion thresholds ---

export const PatternProposalEventSchema = z.object({
  patternId: z.string(),
  statement: z.string(),
  dimension: ObservationDimensionSchema,
});

export type PatternProposalEvent = z.infer<typeof PatternProposalEventSchema>;

// --- pattern:watch-resolved: a watch item resolved (REQ-LPC-25) ---

export const PatternWatchResolvedEventSchema = z.object({
  patternId: z.string(),
  resolvedAt: z.string(),
  kind: z.enum(["computable", "qualitative"]),
});

export type PatternWatchResolvedEvent = z.infer<typeof PatternWatchResolvedEventSchema>;

/** Topic name constants, kept in sync with daemon emit sites. */
export const EVENT_TOPICS = {
  observationCreated: "observation:created",
  patternDiscovered: "pattern:discovered",
  patternProposal: "pattern:proposal",
  patternWatchResolved: "pattern:watch-resolved",
} as const;

export type EventTopic = (typeof EVENT_TOPICS)[keyof typeof EVENT_TOPICS];
