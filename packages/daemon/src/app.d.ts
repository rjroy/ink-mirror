import { Hono } from "hono";
import { type OperationsRegistry } from "./registry.js";
import type { RouteModule, EventBus } from "./types.js";
export interface AppDeps {
    /**
     * Route module factories to register.
     * Each factory receives its own deps slice and returns a RouteModule.
     */
    routeModules?: RouteModule[];
    /** Provide an external EventBus. If omitted, a new one is created. */
    eventBus?: EventBus;
}
export interface App {
    hono: Hono;
    registry: OperationsRegistry;
    eventBus: EventBus;
}
/**
 * Assembles the Hono app from route modules.
 * Production wiring lives in index.ts; this function is testable with mock deps.
 */
export declare function createApp(deps?: AppDeps): App;
//# sourceMappingURL=app.d.ts.map