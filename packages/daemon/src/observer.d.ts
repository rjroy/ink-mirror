/**
 * Observer: produces pattern-level observations from journal entries.
 *
 * Assembles context (Tier 1: system prompt + style profile + metrics + entry),
 * calls the session runner, validates output, and stores observations.
 *
 * Critical constraint: the Observer NEVER generates text for the user.
 * Observations describe patterns. No alternatives, corrections, or rewrites.
 * No comparisons to external norms or other writers (REQ-V1-9).
 */
import type { EntryMetrics, RawObservation, Observation } from "@ink-mirror/shared";
import type { SessionRunner } from "./session-runner.js";
import type { ObservationStore } from "./observation-store.js";
/** Returns the N most recent entry texts, newest first. */
export type RecentEntriesFn = (limit: number) => Promise<Array<{
    id: string;
    body: string;
}>>;
/** Returns the total number of entries in the corpus. */
export type CorpusSizeFn = () => Promise<number>;
export interface ObserverDeps {
    sessionRunner: SessionRunner;
    observationStore: ObservationStore;
    computeMetrics: (text: string) => EntryMetrics;
    readStyleProfile?: () => Promise<string>;
    /** Tier 2: supply recent entries for drift detection (REQ-V1-13) */
    recentEntries?: RecentEntriesFn;
    /** Tier 2: total corpus size to decide if Tier 2 activates */
    corpusSize?: CorpusSizeFn;
}
export interface ObserveResult {
    observations: Observation[];
    errors: string[];
}
/**
 * Run the Observer on a submitted entry.
 * Returns stored observations and any validation errors.
 */
export declare function observe(deps: ObserverDeps, entryId: string, entryText: string): Promise<ObserveResult>;
export declare function buildSystemPrompt(): string;
export declare function buildUserMessage(entryText: string, metrics: EntryMetrics, styleProfile: string, recentEntries?: string[]): string;
interface ParseSuccess {
    success: true;
    data: RawObservation[];
}
interface ParseFailure {
    success: false;
    error: string;
}
export declare function parseObserverOutput(content: string): ParseSuccess | ParseFailure;
interface ValidationResult {
    valid: RawObservation[];
    errors: string[];
}
/**
 * Validates each observation against the entry text.
 * REQ-V1-7: evidence must be cited text from the entry.
 * REQ-V1-5: each observation must have a named pattern.
 */
export declare function validateObservations(observations: RawObservation[], entryText: string): ValidationResult;
export {};
//# sourceMappingURL=observer.d.ts.map