import { Hono } from "hono";
import { createOperationsRegistry, type OperationsRegistry } from "./registry.js";
import { createEventBus } from "./event-bus.js";
import { createHelpRoutes } from "./routes/help.js";
import type { RouteModule, EventBus } from "./types.js";

export interface AppDeps {
  /**
   * Route module factories to register.
   * Each factory receives its own deps slice and returns a RouteModule.
   */
  routeModules?: RouteModule[];
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
export function createApp(deps: AppDeps = {}): App {
  const hono = new Hono();
  const registry = createOperationsRegistry();
  const eventBus = createEventBus();

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
