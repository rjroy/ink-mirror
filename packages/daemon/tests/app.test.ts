import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { createApp } from "../src/app.js";
import type { RouteModule } from "../src/types.js";
import type { OperationDefinition } from "@ink-mirror/shared";

function makeRouteModule(
  operations: OperationDefinition[],
  setupRoutes?: (app: Hono) => void,
): RouteModule {
  const app = new Hono();
  if (setupRoutes) setupRoutes(app);
  return { routes: app, operations };
}

describe("createApp", () => {
  test("health endpoint returns ok", async () => {
    const { hono } = createApp();
    const res = await hono.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });

  test("/help returns empty tree when no routes registered", async () => {
    const { hono } = createApp();
    const res = await hono.request("/help");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("ink-mirror");
  });

  test("/help includes registered operations", async () => {
    const mod = makeRouteModule([
      {
        operationId: "entries.list",
        name: "list",
        description: "List all entries",
        invocation: { method: "GET", path: "/entries" },
        hierarchy: { root: "entries", feature: "list" },
        idempotent: true,
      },
    ]);

    const { hono } = createApp({ routeModules: [mod] });
    const res = await hono.request("/help");
    const body = await res.json();

    expect(body.children.entries).toBeDefined();
    expect(body.children.entries.children.list.operations).toHaveLength(1);
  });

  test("/help/:path returns subtree", async () => {
    const mod = makeRouteModule([
      {
        operationId: "entries.list",
        name: "list",
        description: "List all entries",
        invocation: { method: "GET", path: "/entries" },
        hierarchy: { root: "entries", feature: "list" },
        idempotent: true,
      },
    ]);

    const { hono } = createApp({ routeModules: [mod] });
    const res = await hono.request("/help/entries");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("entries");
  });

  test("/help/:path returns 404 for unknown path", async () => {
    const { hono } = createApp();
    const res = await hono.request("/help/nonexistent");
    expect(res.status).toBe(404);
  });

  test("route module routes are mounted", async () => {
    const mod = makeRouteModule([], (app) => {
      app.get("/ping", (c) => c.text("pong"));
    });

    const { hono } = createApp({ routeModules: [mod] });
    const res = await hono.request("/ping");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("pong");
  });

  test("multiple route modules are all registered", async () => {
    const modA = makeRouteModule([
      {
        operationId: "a.get",
        name: "get",
        description: "Get A",
        invocation: { method: "GET", path: "/a" },
        hierarchy: { root: "a", feature: "get" },
        idempotent: true,
      },
    ]);

    const modB = makeRouteModule([
      {
        operationId: "b.get",
        name: "get",
        description: "Get B",
        invocation: { method: "GET", path: "/b" },
        hierarchy: { root: "b", feature: "get" },
        idempotent: true,
      },
    ]);

    const { hono } = createApp({ routeModules: [modA, modB] });
    const res = await hono.request("/help");
    const body = await res.json();

    expect(body.children.a).toBeDefined();
    expect(body.children.b).toBeDefined();
  });

  test("eventBus is available on the app", () => {
    const { eventBus } = createApp();
    expect(eventBus).toBeDefined();
    expect(typeof eventBus.emit).toBe("function");
    expect(typeof eventBus.subscribe).toBe("function");
  });
});
