import { describe, expect, test } from "bun:test";
import { createOperationsRegistry } from "../src/registry.js";
import type { OperationDefinition } from "@ink-mirror/shared";

function makeOp(overrides: Partial<OperationDefinition> = {}): OperationDefinition {
  return {
    operationId: "test.op",
    name: "op",
    description: "Test operation",
    invocation: { method: "GET", path: "/test" },
    hierarchy: { root: "test", feature: "op" },
    idempotent: true,
    ...overrides,
  };
}

describe("OperationsRegistry", () => {
  test("registers and retrieves operations", () => {
    const registry = createOperationsRegistry();
    const op = makeOp();

    registry.register([op]);

    const all = registry.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].operationId).toBe("test.op");
  });

  test("getAll returns a copy, not the internal array", () => {
    const registry = createOperationsRegistry();
    registry.register([makeOp()]);

    const all = registry.getAll();
    all.push(makeOp({ operationId: "extra" }));

    expect(registry.getAll()).toHaveLength(1);
  });

  test("builds a help tree from operations", () => {
    const registry = createOperationsRegistry();
    registry.register([
      makeOp({
        operationId: "entries.list",
        name: "list",
        description: "List entries",
        invocation: { method: "GET", path: "/entries" },
        hierarchy: { root: "entries", feature: "list" },
      }),
      makeOp({
        operationId: "entries.create",
        name: "create",
        description: "Create entry",
        invocation: { method: "POST", path: "/entries" },
        hierarchy: { root: "entries", feature: "create" },
      }),
      makeOp({
        operationId: "profile.get",
        name: "get",
        description: "Get profile",
        invocation: { method: "GET", path: "/profile" },
        hierarchy: { root: "profile", feature: "get" },
      }),
    ]);

    const tree = registry.getTree();

    expect(tree.name).toBe("ink-mirror");
    expect(tree.children).toBeDefined();
    expect(Object.keys(tree.children!)).toEqual(
      expect.arrayContaining(["entries", "profile"]),
    );

    const entries = tree.children!.entries;
    expect(entries.children).toBeDefined();
    expect(Object.keys(entries.children!)).toEqual(
      expect.arrayContaining(["list", "create"]),
    );
    expect(entries.children!.list.operations).toHaveLength(1);
    expect(entries.children!.list.operations![0].operationId).toBe("entries.list");
    expect(entries.children!.create.operations).toHaveLength(1);
    expect(entries.children!.create.operations![0].operationId).toBe("entries.create");

    const profile = tree.children!.profile;
    expect(profile.children!.get.operations).toHaveLength(1);
    expect(profile.children!.get.operations![0].operationId).toBe("profile.get");
  });

  test("findByPath navigates the tree", () => {
    const registry = createOperationsRegistry();
    registry.register([
      makeOp({
        operationId: "entries.list",
        hierarchy: { root: "entries", feature: "list" },
      }),
    ]);

    const node = registry.findByPath(["entries"]);
    expect(node).toBeDefined();
    expect(node!.name).toBe("entries");
    expect(node!.children!.list.operations).toHaveLength(1);
  });

  test("findByPath returns undefined for invalid path", () => {
    const registry = createOperationsRegistry();
    registry.register([
      makeOp({ hierarchy: { root: "entries", feature: "list" } }),
    ]);

    expect(registry.findByPath(["nonexistent"])).toBeUndefined();
    expect(registry.findByPath(["entries", "nonexistent"])).toBeUndefined();
  });

  test("findByPath navigates to feature level", () => {
    const registry = createOperationsRegistry();
    registry.register([
      makeOp({
        operationId: "entries.list",
        name: "list",
        hierarchy: { root: "entries", feature: "list" },
      }),
    ]);

    const node = registry.findByPath(["entries", "list"]);
    expect(node).toBeDefined();
    expect(node!.operations).toHaveLength(1);
    expect(node!.operations![0].name).toBe("list");
  });

  test("accumulates operations from multiple register calls", () => {
    const registry = createOperationsRegistry();

    registry.register([
      makeOp({ operationId: "a.b", hierarchy: { root: "a", feature: "b" } }),
    ]);
    registry.register([
      makeOp({ operationId: "c.d", hierarchy: { root: "c", feature: "d" } }),
    ]);

    expect(registry.getAll()).toHaveLength(2);

    const tree = registry.getTree();
    expect(Object.keys(tree.children!)).toEqual(
      expect.arrayContaining(["a", "c"]),
    );
  });
});
