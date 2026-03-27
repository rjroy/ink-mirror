import type { ObservationStore } from "../observation-store.js";
import type { EntryStore } from "../entry-store.js";
import type { RouteModule } from "../types.js";
/** Called when an observation is classified as "intentional" to update the profile. */
export type OnIntentionalFn = (pattern: string, dimension: string) => Promise<void>;
export interface ObservationsDeps {
    observationStore: ObservationStore;
    entryStore: EntryStore;
    onIntentional: OnIntentionalFn;
}
/**
 * Observation routes: curation session, classify, list with filters.
 *
 * GET  /observations/pending - Assemble curation session (pending + resurfaced undecided)
 * PATCH /observations/:id    - Classify an observation
 * GET  /observations         - List all observations (optional ?status= filter)
 */
export declare function createObservationRoutes(deps: ObservationsDeps): RouteModule;
//# sourceMappingURL=observations.d.ts.map