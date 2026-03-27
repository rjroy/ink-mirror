import type { EntryStore } from "../entry-store.js";
import type { EventBus, RouteModule } from "../types.js";
import type { ObserveResult } from "../observer.js";
/**
 * Observer function signature. When provided, runs automatically
 * after entry creation (REQ-V1-4).
 */
export type ObserveFn = (entryId: string, entryText: string) => Promise<ObserveResult>;
export interface EntriesDeps {
    entryStore: EntryStore;
    onEntryCreated?: ObserveFn;
    eventBus?: EventBus;
}
/**
 * Entry routes: create, list, read journal entries.
 *
 * POST /entries     - Create a new entry
 * GET  /entries     - List all entries
 * GET  /entries/:id - Read a single entry
 */
export declare function createEntryRoutes(deps: EntriesDeps): RouteModule;
//# sourceMappingURL=entries.d.ts.map