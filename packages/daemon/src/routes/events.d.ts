import type { EventBus, RouteModule } from "../types.js";
export interface EventsDeps {
    eventBus: EventBus;
}
/**
 * SSE route for streaming observation events to clients.
 *
 * GET /events/observations - SSE stream of observation events
 */
export declare function createEventsRoutes(deps: EventsDeps): RouteModule;
//# sourceMappingURL=events.d.ts.map