import { describe, expect, test } from "bun:test";
import {
  OperationDefinitionSchema,
  HelpTreeNodeSchema,
  ApiErrorSchema,
  ApiSuccessSchema,
} from "../src/schemas.js";

describe("OperationDefinitionSchema", () => {
  const validOp = {
    operationId: "entries.list",
    name: "list",
    description: "List all journal entries",
    invocation: { method: "GET", path: "/entries" },
    hierarchy: { root: "entries", feature: "list" },
    idempotent: true,
  };

  test("accepts a valid operation definition", () => {
    const result = OperationDefinitionSchema.parse(validOp);
    expect(result.operationId).toBe("entries.list");
    expect(result.invocation.method).toBe("GET");
  });

  test("accepts operation with parameters", () => {
    const withParams = {
      ...validOp,
      parameters: [
        {
          name: "id",
          description: "Entry ID",
          required: true,
          type: "string" as const,
        },
      ],
    };
    const result = OperationDefinitionSchema.parse(withParams);
    expect(result.parameters).toHaveLength(1);
    expect(result.parameters![0].name).toBe("id");
  });

  test("rejects missing required fields", () => {
    expect(() =>
      OperationDefinitionSchema.parse({ name: "incomplete" }),
    ).toThrow();
  });

  test("rejects invalid parameter type", () => {
    const badParams = {
      ...validOp,
      parameters: [
        {
          name: "id",
          description: "Entry ID",
          required: true,
          type: "invalid",
        },
      ],
    };
    expect(() => OperationDefinitionSchema.parse(badParams)).toThrow();
  });
});

describe("HelpTreeNodeSchema", () => {
  test("accepts a leaf node", () => {
    const result = HelpTreeNodeSchema.parse({ name: "root" });
    expect(result.name).toBe("root");
  });

  test("accepts a nested tree", () => {
    const tree = {
      name: "ink-mirror",
      children: {
        entries: {
          name: "entries",
          operations: [
            {
              operationId: "entries.list",
              name: "list",
              description: "List entries",
              invocation: { method: "GET", path: "/entries" },
              hierarchy: { root: "entries", feature: "list" },
              idempotent: true,
            },
          ],
        },
      },
    };
    const result = HelpTreeNodeSchema.parse(tree);
    expect(result.children?.entries.operations).toHaveLength(1);
  });

  test("accepts deeply nested children", () => {
    const deep = {
      name: "root",
      children: {
        level1: {
          name: "level1",
          children: {
            level2: {
              name: "level2",
              children: {
                level3: { name: "level3" },
              },
            },
          },
        },
      },
    };
    const result = HelpTreeNodeSchema.parse(deep);
    expect(result.children?.level1.children?.level2.children?.level3.name).toBe(
      "level3",
    );
  });
});

describe("ApiErrorSchema", () => {
  test("accepts error with details", () => {
    const result = ApiErrorSchema.parse({
      error: "Not found",
      details: "Entry does not exist",
    });
    expect(result.error).toBe("Not found");
    expect(result.details).toBe("Entry does not exist");
  });

  test("accepts error without details", () => {
    const result = ApiErrorSchema.parse({ error: "Server error" });
    expect(result.error).toBe("Server error");
    expect(result.details).toBeUndefined();
  });
});

describe("ApiSuccessSchema", () => {
  test("accepts ok response", () => {
    const result = ApiSuccessSchema.parse({ ok: true });
    expect(result.ok).toBe(true);
  });

  test("rejects non-true value", () => {
    expect(() => ApiSuccessSchema.parse({ ok: false })).toThrow();
  });
});
