import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { showProfile, editProfile } from "../src/profile.js";
import type { DaemonClient } from "../src/client.js";
import type { PatternCurationSession } from "@ink-mirror/shared";

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

function emptySession(): PatternCurationSession {
  return { dossiers: [], contradictions: [], watchList: [], resurfacedRules: [], proposals: [] };
}

/**
 * Builds a mock DaemonClient whose fetchJson dispatches on exact path,
 * defaulting `/patterns/session` to an empty session (no resurfaced rules)
 * so tests that don't care about health don't need to supply one.
 */
function createMockClient(
  profileResponse: unknown,
  extra: Record<string, unknown> = {},
): DaemonClient {
  const responses: Record<string, unknown> = {
    "/patterns/session": emptySession(),
    ...extra,
  };

  return {
    fetch: async (path: string, _init?: RequestInit) => {
      if (path === "/profile") {
        return new Response(JSON.stringify(profileResponse), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("not found", { status: 404 });
    },
    fetchJson: async <T>(path: string): Promise<T> => {
      if (path === "/profile") return profileResponse as T;
      if (path in responses) return responses[path] as T;
      throw new Error(`Unexpected path: ${path}`);
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

  test("displays rules grouped by dimension with provenance and health", async () => {
    const client = createMockClient({
      version: 2,
      updatedAt: "2026-07-10T12:00:00.000Z",
      rules: [
        {
          id: "rule-sentence-rhythm-001",
          pattern: "Uses staccato rhythm",
          dimension: "sentence-rhythm",
          sourceCount: 3,
          sourceSummary: "Confirmed across 3 entries",
          provenance: "evidence-confirmed",
        },
        {
          id: "rule-word-level-habits-001",
          pattern: "Relies on hedging words",
          dimension: "word-level-habits",
          sourceCount: 1,
          sourceSummary: "Confirmed across 1 entry",
          provenance: "writer-asserted",
        },
      ],
      markdown: "...",
    });

    await showProfile(client);
    const output = consoleOutput.join("\n");
    expect(output).toContain("Sentence Rhythm");
    expect(output).toContain("Uses staccato rhythm");
    expect(output).toContain("evidence-confirmed");
    expect(output).toContain("Confirmed across 3 entries");
    expect(output).toContain("Word-Level Habits");
    expect(output).toContain("Relies on hedging words");
    expect(output).toContain("writer-asserted");
    // Neither rule is in resurfacedRules (empty session), so both read "fine".
    expect(output).toContain("fine");
  });

  test("shows unspecified provenance for legacy rules lacking the field", async () => {
    const client = createMockClient({
      version: 1,
      updatedAt: "2026-03-27T12:00:00.000Z",
      rules: [
        {
          id: "rule-001",
          pattern: "Legacy rule",
          dimension: "sentence-rhythm",
          sourceCount: 1,
          sourceSummary: "Confirmed across 1 entry",
        },
      ],
      markdown: "...",
    });

    await showProfile(client);
    const output = consoleOutput.join("\n");
    expect(output).toContain("unspecified");
  });

  test("shows stale/drifting health from the curation session's resurfaced rules", async () => {
    const client = createMockClient(
      {
        version: 2,
        updatedAt: "2026-07-10T12:00:00.000Z",
        rules: [
          {
            id: "rule-001",
            pattern: "Rarely uses hedging words",
            dimension: "word-level-habits",
            sourceCount: 4,
            sourceSummary: "Confirmed across 4 entries",
            provenance: "evidence-confirmed",
          },
        ],
        markdown: "...",
      },
      {
        "/patterns/session": {
          dossiers: [],
          contradictions: [],
          watchList: [],
          resurfacedRules: [
            {
              rule: {
                id: "rule-001",
                pattern: "Rarely uses hedging words",
                dimension: "word-level-habits",
                sourceCount: 4,
                sourceSummary: "Confirmed across 4 entries",
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
              },
              pattern: {
                id: "pat-001",
                statement: "Rarely uses hedging words",
                dimension: "word-level-habits",
                status: "intentional",
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
                sightingCount: 4,
                entryIds: ["e1", "e2", "e3", "e4"],
              },
              reasons: ["stale", "drift"],
              staleness: { windowSize: 10 },
              drift: { rollingMean: 4, baseline: 2, relativeDeviation: 1, margin: 0.5 },
            },
          ],
          proposals: [],
        },
      },
    );

    await showProfile(client);
    const output = consoleOutput.join("\n");
    expect(output).toContain("stale, drift");
  });

  test("reaches the linked pattern's dossier from a rule (REQ-LPC-18)", async () => {
    const client = createMockClient(
      {
        version: 2,
        updatedAt: "2026-07-10T12:00:00.000Z",
        rules: [
          {
            id: "rule-001",
            pattern: "Uses staccato rhythm",
            dimension: "sentence-rhythm",
            sourceCount: 3,
            sourceSummary: "Confirmed across 3 entries",
            provenance: "evidence-confirmed",
            patternId: "pat-001",
          },
        ],
        markdown: "...",
      },
      {
        "/patterns/pat-001": {
          pattern: {
            id: "pat-001",
            statement: "Uses staccato rhythm",
            dimension: "sentence-rhythm",
            status: "intentional",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            sightingCount: 3,
            entryIds: ["e1", "e2", "e3"],
          },
          sightings: [
            {
              id: "obs-001",
              patternId: "pat-001",
              entryId: "e1",
              evidence: "I stopped. I turned.",
              dimension: "sentence-rhythm",
              createdAt: "2026-01-01T00:00:00.000Z",
              entryText: "I stopped. I turned. The room was quiet.",
            },
          ],
          distinctEntryCount: 3,
          isProposal: false,
        },
      },
    );

    await showProfile(client);
    const output = consoleOutput.join("\n");
    expect(output).toContain("Why:");
    expect(output).toContain('"Uses staccato rhythm"');
    expect(output).toContain("1 sighting");
    expect(output).toContain("3 entries");
    expect(output).toContain("I stopped. I turned.");
  });

  test("shows the migrated/no-history state instead of implying evidence", async () => {
    const client = createMockClient(
      {
        version: 2,
        updatedAt: "2026-07-10T12:00:00.000Z",
        rules: [
          {
            id: "rule-001",
            pattern: "Prefers active voice",
            dimension: "sentence-rhythm",
            sourceCount: 1,
            sourceSummary: "Migrated from prior profile",
            provenance: "writer-asserted",
            patternId: "pat-001",
          },
        ],
        markdown: "...",
      },
      {
        "/patterns/pat-001": {
          pattern: {
            id: "pat-001",
            statement: "Prefers active voice",
            dimension: "sentence-rhythm",
            status: "intentional",
            createdAt: "2026-07-01T00:00:00.000Z",
            updatedAt: "2026-07-01T00:00:00.000Z",
            sightingCount: 0,
            entryIds: [],
            migratedNoHistory: true,
          },
          sightings: [],
          distinctEntryCount: 0,
          isProposal: false,
        },
      },
    );

    await showProfile(client);
    const output = consoleOutput.join("\n");
    expect(output).toContain("migrated, no historical sightings recorded");
  });

  test("still displays the profile if the dossier fetch fails", async () => {
    const client: DaemonClient = {
      fetch: async () => new Response("not found", { status: 404 }),
      fetchJson: async <T>(path: string): Promise<T> => {
        if (path === "/profile") {
          return {
            version: 2,
            updatedAt: "2026-07-10T12:00:00.000Z",
            rules: [
              {
                id: "rule-001",
                pattern: "Uses staccato rhythm",
                dimension: "sentence-rhythm",
                sourceCount: 3,
                sourceSummary: "Confirmed across 3 entries",
                patternId: "pat-001",
              },
            ],
            markdown: "...",
          } as T;
        }
        throw new Error(`Daemon error 500: boom (${path})`);
      },
      getHelpTree: async () => ({ name: "ink-mirror" }),
    };

    await showProfile(client);
    const output = consoleOutput.join("\n");
    expect(output).toContain("Uses staccato rhythm");
    expect(output).toContain("dossier unavailable");
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
