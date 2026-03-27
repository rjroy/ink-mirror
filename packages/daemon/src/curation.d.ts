import type { Observation, CurationSession } from "@ink-mirror/shared";
/**
 * Detects whether two observations in the same dimension describe opposing patterns.
 * Structural comparison: same dimension, opposing pattern signals.
 */
export declare function detectContradiction(a: Observation, b: Observation): boolean;
interface EntryTextLookup {
    (entryId: string): Promise<string | undefined>;
}
/**
 * Assembles a curation session from all observations.
 *
 * Order:
 * 1. New observations (status = "pending"), ordered by creation time
 * 2. Up to UNDECIDED_CAP most-recent undecided observations
 *
 * Contradiction detection: compares new (pending) observations against
 * confirmed (intentional) observations. Same dimension + opposing pattern
 * signals = contradiction surfaced for user resolution. (REQ-V1-19)
 */
export declare function assembleCurationSession(allObservations: Observation[], getEntryText: EntryTextLookup): Promise<CurationSession>;
export {};
//# sourceMappingURL=curation.d.ts.map