import { describe, expect, test } from "bun:test";
import {
  formatHelpTree,
  resolveCommand,
  type Resolution,
} from "../src/discovery.js";
import type { DaemonClient } from "../src/client.js";
import type { HelpTreeNode } from "@ink-mirror/shared";

/**
 * Creates a mock DaemonClient that returns a fixed help tree.
 * No network calls, no daemon required.
 */
function mockClient(tree: HelpTreeNode): DaemonClient {
  return {
    async fetch(): Promise<Response> {
      return new Response(JSON.stringify(tree));
    },
    async fetchJson<T>(): Promise<T> {
      return tree as T;
    },
    async getHelpTree(path?: string[]): Promise<HelpTreeNode> {
      if (!path?.length) return tree;
      let current: HelpTreeNode = tree;
      for (const segment of path) {
        if (!current.children?.[segment]) {
          throw new Error(`Not found: ${segment}`);
        }
        current = current.children[segment];
      }
      return current;
    },
  };
}

const sampleTree: HelpTreeNode = {
  name: "ink-mirror",
  children: {
    entries: {
      name: "entries",
      children: {
        list: {
          name: "list",
          operations: [
            {
              operationId: "entries.list",
              name: "list",
              description: "List all entries",
              invocation: { method: "GET", path: "/entries" },
              hierarchy: { root: "entries", feature: "list" },
              idempotent: true,
            },
          ],
        },
        create: {
          name: "create",
          operations: [
            {
              operationId: "entries.create",
              name: "create",
              description: "Create entry",
              invocation: { method: "POST", path: "/entries" },
              hierarchy: { root: "entries", feature: "create" },
              parameters: [
                {
                  name: "body",
                  description: "Entry body",
                  required: true,
                  type: "string" as const,
                },
              ],
              idempotent: false,
            },
          ],
        },
      },
    },
  },
};

describe("formatHelpTree", () => {
  test("formats root node with name", () => {
    const output = formatHelpTree({ name: "ink-mirror" });
    expect(output).toContain("ink-mirror");
  });

  test("formats tree with children and operations", () => {
    const output = formatHelpTree(sampleTree);
    expect(output).toContain("ink-mirror");
    expect(output).toContain("entries");
    expect(output).toContain("list");
    expect(output).toContain("GET /entries");
  });
});

describe("resolveCommand", () => {
  const client = mockClient(sampleTree);

  test("no args returns full help tree", async () => {
    const result = await resolveCommand(client, []);
    expect(result.type).toBe("help");
    if (result.type === "help") {
      expect(result.tree.name).toBe("ink-mirror");
    }
  });

  test("'help' as first arg returns full tree", async () => {
    const result = await resolveCommand(client, ["help"]);
    expect(result.type).toBe("help");
  });

  test("'help entries' returns entries subtree", async () => {
    const result = await resolveCommand(client, ["help", "entries"]);
    expect(result.type).toBe("help");
    if (result.type === "help") {
      expect(result.tree.name).toBe("entries");
    }
  });

  test("'entries help' returns entries subtree", async () => {
    const result = await resolveCommand(client, ["entries", "help"]);
    expect(result.type).toBe("help");
    if (result.type === "help") {
      expect(result.tree.name).toBe("entries");
    }
  });

  test("'entries list' resolves to the list operation", async () => {
    const result = await resolveCommand(client, ["entries", "list"]);
    // The tree node 'list' has exactly one operation, so it resolves
    expect(result.type).toBe("operation");
    if (result.type === "operation") {
      expect(result.operation.operationId).toBe("entries.list");
      expect(result.args).toEqual([]);
    }
  });

  test("'entries create body-text' resolves operation with args", async () => {
    const result = await resolveCommand(client, [
      "entries",
      "create",
      "body-text",
    ]);
    expect(result.type).toBe("operation");
    if (result.type === "operation") {
      expect(result.operation.operationId).toBe("entries.create");
      expect(result.args).toEqual(["body-text"]);
    }
  });

  test("unknown path returns help for deepest resolved node", async () => {
    const result = await resolveCommand(client, ["entries", "unknown"]);
    expect(result.type).toBe("help");
    if (result.type === "help") {
      expect(result.tree.name).toBe("entries");
    }
  });
});
