import { describe, expect, test, spyOn, beforeEach, afterEach } from "bun:test";
import { writeFileSync } from "node:fs";
import type { DaemonClient } from "../src/client.js";
import { writeEntry } from "../src/write.js";

function mockClient(
  responses: Record<string, { status: number; body: unknown }> = {},
): DaemonClient {
  return {
    async fetch(path: string, init?: RequestInit): Promise<Response> {
      const key = `${init?.method ?? "GET"} ${path}`;
      const resp = responses[key] ?? { status: 200, body: { ok: true } };
      return new Response(JSON.stringify(resp.body), {
        status: resp.status,
        headers: { "Content-Type": "application/json" },
      });
    },
    async fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
      const res = await this.fetch(path, init);
      return (await res.json()) as T;
    },
    async getHelpTree() {
      return { name: "ink-mirror" };
    },
  };
}

describe("writeEntry", () => {
  let exitSpy: ReturnType<typeof spyOn>;
  let logSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;
  const origEditor = process.env.EDITOR;

  beforeEach(() => {
    exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
    logSpy = spyOn(console, "log").mockImplementation(() => {});
    errorSpy = spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    logSpy.mockRestore();
    errorSpy.mockRestore();
    if (origEditor) {
      process.env.EDITOR = origEditor;
    } else {
      delete process.env.EDITOR;
    }
  });

  test("exits if EDITOR not set", async () => {
    delete process.env.EDITOR;
    const client = mockClient();

    await expect(writeEntry(client)).rejects.toThrow("process.exit");
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("No $EDITOR set"),
    );
  });

  test("submits editor content to daemon", async () => {
    process.env.EDITOR = "cat";
    let postedBody: string | null = null;

    const client: DaemonClient = {
      async fetch(path: string, init?: RequestInit): Promise<Response> {
        if (init?.method === "POST" && path === "/entries") {
          postedBody = init.body as string;
          return new Response(
            JSON.stringify({ id: "entry-2026-03-27-001" }),
            { status: 201 },
          );
        }
        return new Response("not found", { status: 404 });
      },
      async fetchJson() {
        return {} as never;
      },
      async getHelpTree() {
        return { name: "ink-mirror" };
      },
    };

    // Mock editor: writes content to the temp file
    const editorSpawn = async (file: string) => {
      writeFileSync(file, "My journal entry content.", "utf-8");
      return 0;
    };

    await writeEntry(client, editorSpawn);

    expect(postedBody).not.toBeNull();
    const parsed = JSON.parse(postedBody!);
    expect(parsed.body).toBe("My journal entry content.");
    expect(logSpy).toHaveBeenCalledWith("Entry saved: entry-2026-03-27-001");
  });

  test("does nothing on empty content", async () => {
    process.env.EDITOR = "cat";
    let fetchCalled = false;

    const client: DaemonClient = {
      async fetch(): Promise<Response> {
        fetchCalled = true;
        return new Response("", { status: 200 });
      },
      async fetchJson() {
        return {} as never;
      },
      async getHelpTree() {
        return { name: "ink-mirror" };
      },
    };

    const editorSpawn = async (_file: string) => {
      // Leave file empty
      return 0;
    };

    await writeEntry(client, editorSpawn);

    expect(fetchCalled).toBe(false);
    expect(logSpy).toHaveBeenCalledWith("Empty entry, nothing saved.");
  });

  test("exits on non-zero editor exit code", async () => {
    process.env.EDITOR = "false";
    const client = mockClient();

    const editorSpawn = async () => 1;

    await expect(writeEntry(client, editorSpawn)).rejects.toThrow(
      "process.exit",
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Editor exited with code 1"),
    );
  });
});
