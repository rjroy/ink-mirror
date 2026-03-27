import { Hono } from "hono";
import { createOperationsRegistry } from "./registry.js";
import { createEventBus } from "./event-bus.js";
import { createHelpRoutes } from "./routes/help.js";
/**
 * Assembles the Hono app from route modules.
 * Production wiring lives in index.ts; this function is testable with mock deps.
 */
export function createApp(deps = {}) {
    const hono = new Hono();
    const registry = createOperationsRegistry();
    const eventBus = deps.eventBus ?? createEventBus();
    // Register any provided route modules
    const routeModules = deps.routeModules ?? [];
    for (const mod of routeModules) {
        registry.register(mod.operations);
    }
    // Help routes use the registry after all other modules are registered
    const helpModule = createHelpRoutes({ registry });
    // Mount help routes
    hono.route("/help", helpModule.routes);
    // Mount all other route modules on the root
    for (const mod of routeModules) {
        hono.route("/", mod.routes);
    }
    // Health check
    hono.get("/health", (c) => c.json({ status: "ok" }));
    return { hono, registry, eventBus };
}
