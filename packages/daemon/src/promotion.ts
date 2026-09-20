/**
 * Promotion gate (REQ-LPC-14/15): decides whether a pattern has earned a
 * *proposed* profile rule. A proposal is a suggestion only — no rule is ever
 * created here. Proposals are not persisted: the route layer (Phase 4's
 * other sub-task) calls proposalFor() fresh at session-assembly time for
 * every `intentional` pattern, so "proposed" is always derived from current
 * ledger state, never stale stored state.
 */
import type { Pattern, Sighting } from "@ink-mirror/shared";
import type { Config } from "./config.js";

/** entryId -> word count for that entry's body. Callers build this (e.g. via metrics/index.ts's countWords) once per session, not per pattern. */
export type EntryWordCounts = Record<string, number>;

export interface Proposal {
  patternId: string;
  sightingCount: number;
  distinctEntryCount: number;
  totalWordCount: number;
}

type PromotionConfig = Pick<
  Config,
  "sightingThreshold" | "distinctEntryThreshold" | "wordCountThreshold"
>;

/**
 * Proposes promoting `pattern` to a profile rule, or returns undefined when
 * any gate fails (REQ-LPC-14):
 *   (a) classified `intentional`
 *   (b) >= config.sightingThreshold sightings
 *   (c) spanning >= config.distinctEntryThreshold distinct entries
 *   (d) those entries' total word count >= config.wordCountThreshold
 *
 * Decline suppression (Phase 4 planning decision): if the writer previously
 * declined this pattern's proposal (`pattern.proposalDeclinedAt` set), the
 * proposal stays suppressed until a sighting newer than that timestamp
 * exists — evidence accumulated after the decline reopens the question,
 * evidence that predates it does not.
 */
export function proposalFor(
  pattern: Pattern,
  sightings: Sighting[],
  entryWordCounts: EntryWordCounts,
  config: PromotionConfig,
): Proposal | undefined {
  if (pattern.status !== "intentional") return undefined;

  const relevantSightings = sightings.filter((s) => s.patternId === pattern.id);

  if (pattern.proposalDeclinedAt) {
    const newestSightingAt = relevantSightings.reduce(
      (max, s) => (s.createdAt > max ? s.createdAt : max),
      "",
    );
    if (newestSightingAt <= pattern.proposalDeclinedAt) return undefined;
  }

  if (relevantSightings.length < config.sightingThreshold) return undefined;

  const distinctEntries = new Set(relevantSightings.map((s) => s.entryId));
  if (distinctEntries.size < config.distinctEntryThreshold) return undefined;

  let totalWordCount = 0;
  for (const entryId of distinctEntries) {
    totalWordCount += entryWordCounts[entryId] ?? 0;
  }
  if (totalWordCount < config.wordCountThreshold) return undefined;

  return {
    patternId: pattern.id,
    sightingCount: relevantSightings.length,
    distinctEntryCount: distinctEntries.size,
    totalWordCount,
  };
}
