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
export function createApp(deps: AppDeps = {}): App {
  const hono = new Hono();
  const registry = createOperationsRegistry();
  const eventBus = deps.eventBus ?? createEventBus();

  // Request logging middleware
  hono.use("*", async (c, next) => {
    const start = performance.now();
    const method = c.req.method;
    const path = c.req.path;
    console.log(`${method} ${path}`);
    await next();
    const ms = (performance.now() - start).toFixed(0);
    console.log(`${method} ${path} ${c.res.status} ${ms}ms`);
  });

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

  // Safety net: any route handler that throws without its own try/catch
  // (most routes already catch and translate their own errors — see
  // routes/*.ts) would otherwise fall through to Hono's default 500 with
  // no server-side log line at all. This is the last point that can name
  // the request and the actual error before responding.
  hono.onError((err, c) => {
    console.error(`[daemon] unhandled error on ${c.req.method} ${c.req.path}:`, err);
    return c.json({ error: "Internal server error" }, 500);
  });

  return { hono, registry, eventBus };
}
