import { describe, expect, test, spyOn, beforeEach, afterEach } from "bun:test";
import { executeOperation } from "../src/executor.js";
import type { DaemonClient } from "../src/client.js";
import type { OperationDefinition } from "@ink-mirror/shared";

function mockClient(
  response: Response | (() => Response),
): DaemonClient {
  return {
    async fetch(_path: string, _init?: RequestInit): Promise<Response> {
      return typeof response === "function" ? response() : response;
    },
    async fetchJson<T>(): Promise<T> {
      throw new Error("not used in executor tests");
    },
    async getHelpTree() {
      throw new Error("not used in executor tests");
    },
  };
}

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

describe("executeOperation", () => {
  let logSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    logSpy = spyOn(console, "log").mockImplementation(() => {});
    errorSpy = spyOn(console, "error").mockImplementation(() => {});
    exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });

  // --- Arg-to-parameter mapping ---

  test("GET request sends no body even with args", async () => {
    let capturedInit: RequestInit | undefined;
    const client: DaemonClient = {
      async fetch(_path: string, init?: RequestInit) {
        capturedInit = init;
        return new Response("{}");
      },
      async fetchJson<T>() { return {} as T; },
      async getHelpTree() { throw new Error("unused"); },
    };

    const op = makeOp({
      parameters: [{ name: "id", description: "ID", required: true, type: "string" as const }],
    });

    await executeOperation(client, op, ["123"]);
    expect(capturedInit?.body).toBeUndefined();
  });

  test("POST request maps positional args to parameter names in body", async () => {
    let capturedInit: RequestInit | undefined;
    const client: DaemonClient = {
      async fetch(_path: string, init?: RequestInit) {
        capturedInit = init;
        return new Response("{}");
      },
      async fetchJson<T>() { return {} as T; },
      async getHelpTree() { throw new Error("unused"); },
    };

    const op = makeOp({
      invocation: { method: "POST", path: "/entries" },
      parameters: [
        { name: "title", description: "Title", required: true, type: "string" as const },
        { name: "body", description: "Body", required: false, type: "string" as const },
      ],
      idempotent: false,
    });

    await executeOperation(client, op, ["My Title", "My Body"]);
    expect(capturedInit?.method).toBe("POST");
    expect(capturedInit?.headers).toEqual({ "Content-Type": "application/json" });
    const body = JSON.parse(capturedInit?.body as string);
    expect(body).toEqual({ title: "My Title", body: "My Body" });
  });

  test("extra args beyond parameter count are ignored", async () => {
    let capturedBody: string | undefined;
    const client: DaemonClient = {
      async fetch(_path: string, init?: RequestInit) {
        capturedBody = init?.body as string | undefined;
        return new Response("{}");
      },
      async fetchJson<T>() { return {} as T; },
      async getHelpTree() { throw new Error("unused"); },
    };

    const op = makeOp({
      invocation: { method: "POST", path: "/test" },
      parameters: [{ name: "name", description: "Name", required: true, type: "string" as const }],
      idempotent: false,
    });

    await executeOperation(client, op, ["value", "extra", "ignored"]);
    const body = JSON.parse(capturedBody!);
    expect(body).toEqual({ name: "value" });
  });

  test("no parameters and no args sends no body", async () => {
    let capturedInit: RequestInit | undefined;
    const client: DaemonClient = {
      async fetch(_path: string, init?: RequestInit) {
        capturedInit = init;
        return new Response("{}");
      },
      async fetchJson<T>() { return {} as T; },
      async getHelpTree() { throw new Error("unused"); },
    };

    await executeOperation(client, makeOp(), []);
    expect(capturedInit?.body).toBeUndefined();
  });

  // --- Output formatting ---

  test("pretty-prints JSON response", async () => {
    const data = { id: 1, name: "test" };
    const client = mockClient(new Response(JSON.stringify(data)));

    await executeOperation(client, makeOp(), []);
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
  });

  test("prints raw text for non-JSON response", async () => {
    const client = mockClient(new Response("plain text output"));

    await executeOperation(client, makeOp(), []);
    expect(logSpy).toHaveBeenCalledWith("plain text output");
  });

  test("empty response body prints nothing", async () => {
    const client = mockClient(new Response(""));

    await executeOperation(client, makeOp(), []);
    expect(logSpy).not.toHaveBeenCalled();
  });

  test("whitespace-only response prints nothing", async () => {
    const client = mockClient(new Response("   \n  "));

    await executeOperation(client, makeOp(), []);
    expect(logSpy).not.toHaveBeenCalled();
  });

  // --- Error handling ---

  test("non-ok response logs error and exits", async () => {
    const client = mockClient(
      new Response("Not Found", { status: 404, statusText: "Not Found" }),
    );

    await expect(
      executeOperation(client, makeOp(), []),
    ).rejects.toThrow("process.exit called");

    expect(errorSpy).toHaveBeenCalledWith("Error (404): Not Found");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  test("500 error shows server error text", async () => {
    const client = mockClient(
      new Response("Internal Server Error", { status: 500 }),
    );

    await expect(
      executeOperation(client, makeOp(), []),
    ).rejects.toThrow("process.exit called");

    expect(errorSpy).toHaveBeenCalledWith("Error (500): Internal Server Error");
  });

  // --- PUT/PATCH also send body ---

  test("PUT request sends JSON body", async () => {
    let capturedInit: RequestInit | undefined;
    const client: DaemonClient = {
      async fetch(_path: string, init?: RequestInit) {
        capturedInit = init;
        return new Response("{}");
      },
      async fetchJson<T>() { return {} as T; },
      async getHelpTree() { throw new Error("unused"); },
    };

    const op = makeOp({
      invocation: { method: "PUT", path: "/test/1" },
      parameters: [{ name: "value", description: "Value", required: true, type: "string" as const }],
      idempotent: true,
    });

    await executeOperation(client, op, ["updated"]);
    expect(capturedInit?.method).toBe("PUT");
    const body = JSON.parse(capturedInit?.body as string);
    expect(body).toEqual({ value: "updated" });
  });

  test("PATCH request sends JSON body", async () => {
    let capturedInit: RequestInit | undefined;
    const client: DaemonClient = {
      async fetch(_path: string, init?: RequestInit) {
        capturedInit = init;
        return new Response("{}");
      },
      async fetchJson<T>() { return {} as T; },
      async getHelpTree() { throw new Error("unused"); },
    };

    const op = makeOp({
      invocation: { method: "PATCH", path: "/test/1" },
      parameters: [{ name: "value", description: "Value", required: true, type: "string" as const }],
      idempotent: true,
    });

    await executeOperation(client, op, ["patched"]);
    expect(capturedInit?.method).toBe("PATCH");
    const body = JSON.parse(capturedInit?.body as string);
    expect(body).toEqual({ value: "patched" });
  });

  // --- Path parameter substitution ---

  test("substitutes path parameters from args for GET", async () => {
    let capturedPath: string | undefined;
    const client: DaemonClient = {
      async fetch(path: string) {
        capturedPath = path;
        return new Response("{}");
      },
      async fetchJson<T>() { return {} as T; },
      async getHelpTree() { throw new Error("unused"); },
    };

    const op = makeOp({
      invocation: { method: "GET", path: "/entries/:id" },
      parameters: [{ name: "id", description: "Entry ID", required: true, type: "string" as const }],
    });

    await executeOperation(client, op, ["entry-2026-03-27-001"]);
    expect(capturedPath).toBe("/entries/entry-2026-03-27-001");
  });

  // --- Invocation path ---

  test("fetches the correct operation path", async () => {
    let capturedPath: string | undefined;
    const client: DaemonClient = {
      async fetch(path: string) {
        capturedPath = path;
        return new Response("{}");
      },
      async fetchJson<T>() { return {} as T; },
      async getHelpTree() { throw new Error("unused"); },
    };

    const op = makeOp({ invocation: { method: "GET", path: "/entries/list" } });
    await executeOperation(client, op, []);
    expect(capturedPath).toBe("/entries/list");
  });
});
