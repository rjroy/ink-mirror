import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { showProfile, editProfile } from "../src/profile.js";
import type { DaemonClient } from "../src/client.js";

// Capture console output
let consoleOutput: string[] = [];
const originalLog = console.log;
const originalError = console.error;

beforeEach(() => {
  consoleOutput = [];
  console.log = (...args: unknown[]) => consoleOutput.push(args.join(" "));
  console.error = (...args: unknown[]) => consoleOutput.push(args.join(" "));
});

afterEach(() => {
  console.log = originalLog;
  console.error = originalError;
});

function createMockClient(profileResponse: unknown): DaemonClient {
  return {
    fetch: async (path: string, _init?: RequestInit) => {
      if (path === "/profile") {
        return new Response(JSON.stringify(profileResponse), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("not found", { status: 404 });
    },
    fetchJson: async <T>(_path: string): Promise<T> => {
      return profileResponse as T;
    },
    getHelpTree: async () => ({ name: "ink-mirror" }),
  };
}

describe("showProfile", () => {
  test("shows empty profile message", async () => {
    const client = createMockClient({
      version: 1,
      updatedAt: "2026-03-27T12:00:00.000Z",
      rules: [],
      markdown: "",
    });

    await showProfile(client);
    const output = consoleOutput.join("\n");
    expect(output).toContain("No patterns confirmed yet");
  });

  test("displays rules grouped by dimension", async () => {
    const client = createMockClient({
      version: 1,
      updatedAt: "2026-03-27T12:00:00.000Z",
      rules: [
        {
          id: "rule-sentence-rhythm-001",
          pattern: "Uses staccato rhythm",
          dimension: "sentence-rhythm",
          sourceCount: 3,
          sourceSummary: "Confirmed across 3 entries",
        },
        {
          id: "rule-word-level-habits-001",
          pattern: "Relies on hedging words",
          dimension: "word-level-habits",
          sourceCount: 1,
          sourceSummary: "Confirmed across 1 entry",
        },
      ],
      markdown: "...",
    });

    await showProfile(client);
    const output = consoleOutput.join("\n");
    expect(output).toContain("Sentence Rhythm");
    expect(output).toContain("Uses staccato rhythm");
    expect(output).toContain("Confirmed across 3 entries");
    expect(output).toContain("Word-Level Habits");
    expect(output).toContain("Relies on hedging words");
  });
});

describe("editProfile", () => {
  test("opens editor with current profile and submits changes", async () => {
    let putBody: string | undefined;
    const client: DaemonClient = {
      fetch: async (path: string, init?: RequestInit) => {
        if (path === "/profile" && (!init || init.method === undefined || init.method === "GET")) {
          return new Response(JSON.stringify({
            version: 1,
            updatedAt: "2026-03-27T12:00:00.000Z",
            rules: [{
              id: "rule-sentence-rhythm-001",
              pattern: "Uses staccato rhythm",
              dimension: "sentence-rhythm",
              sourceCount: 1,
              sourceSummary: "Confirmed across 1 entry",
            }],
            markdown: "...",
          }), { headers: { "Content-Type": "application/json" } });
        }
        if (path === "/profile" && init?.method === "PUT") {
          putBody = init.body as string;
          return new Response(JSON.stringify({ version: 1, updatedAt: "now", rules: [] }), {
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("not found", { status: 404 });
      },
      fetchJson: async () => ({}) as never,
      getHelpTree: async () => ({ name: "ink-mirror" }),
    };

    // Mock editor that modifies the file
    const { writeFileSync, readFileSync } = await import("node:fs");
    const editorSpawn = async (file: string): Promise<number> => {
      // Read current content and modify it
      const content = readFileSync(file, "utf-8");
      const modified = content.replace("Uses staccato rhythm", "Uses dramatic rhythm shifts");
      writeFileSync(file, modified, "utf-8");
      return 0;
    };

    // Set EDITOR so the function doesn't exit
    const oldEditor = process.env.EDITOR;
    process.env.EDITOR = "test-editor";

    try {
      await editProfile(client, editorSpawn);
      expect(putBody).toBeDefined();
      const parsed = JSON.parse(putBody!);
      expect(parsed.markdown).toContain("Uses dramatic rhythm shifts");
    } finally {
      if (oldEditor) process.env.EDITOR = oldEditor;
      else delete process.env.EDITOR;
    }
  });
});
