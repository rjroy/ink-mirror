import { describe, expect, test, spyOn, afterEach } from "bun:test";
import type { DaemonClient } from "../src/client.js";
import type { Dossier, Pattern, PatternCurationSession } from "@ink-mirror/shared";
import { curatePatterns } from "../src/curate.js";

interface MockClient extends DaemonClient {
  posts: Array<{ path: string; body: unknown }>;
}

/**
 * Builds a mock DaemonClient. `getJson` resolves GET paths (exact match);
 * POST actions are recorded (and always return 200 ok) unless the path is
 * present in `failPaths`, which returns a 409 with the given message.
 */
function mockClient(
  getJson: Record<string, unknown>,
  failPaths: Record<string, string> = {},
): MockClient {
  const posts: Array<{ path: string; body: unknown }> = [];

  return {
    posts,
    async fetch(path: string, init?: RequestInit) {
      if (init?.method === "POST") {
        posts.push({ path, body: init.body ? JSON.parse(init.body as string) : undefined });
        if (path in failPaths) {
          return new Response(failPaths[path], { status: 409 });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response("", { status: 404 });
    },
    async fetchJson<T>(path: string) {
      if (path in getJson) return getJson[path] as T;
      throw new Error(`Unexpected path: ${path}`);
    },
    async getHelpTree() {
      return { name: "root" };
    },
  };
}

function makeDossier(overrides: Partial<Dossier> = {}): Dossier {
  return {
    pattern: {
      id: "pat-001",
      statement: "Uses short declarative sentences",
      dimension: "sentence-rhythm",
      status: "candidate",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
      sightingCount: 1,
      entryIds: ["entry-001"],
    },
    sightings: [
      {
        id: "obs-001",
        patternId: "pat-001",
        entryId: "entry-001",
        evidence: ["I stopped."],
        dimension: "sentence-rhythm",
        createdAt: "2026-07-01T00:00:00.000Z",
        entryText: "I stopped. I turned around.",
      },
    ],
    distinctEntryCount: 1,
    isProposal: false,
    ...overrides,
  };
}

function emptySession(overrides: Partial<PatternCurationSession> = {}): PatternCurationSession {
  return {
    dossiers: [],
    contradictions: [],
    watchList: [],
    resurfacedRules: [],
    proposals: [],
    ...overrides,
  };
}

const logSpy = spyOn(console, "log").mockImplementation(() => {});
const errorSpy = spyOn(console, "error").mockImplementation(() => {});

afterEach(() => {
  logSpy.mockClear();
  errorSpy.mockClear();
});

describe("curatePatterns", () => {
  test("handles an empty session", async () => {
    const client = mockClient({
      "/patterns/session": emptySession(),
      "/patterns?status=intentional": [],
    });
    await curatePatterns(client, async () => "i");
    const output = logSpy.mock.calls.flat().join("\n");
    expect(output).toContain("No patterns pending curation.");
  });

  test("classifies a dossier as intentional without promoting", async () => {
    const session = emptySession({ dossiers: [makeDossier()] });
    const client = mockClient({
      "/patterns/session": session,
      "/patterns?status=intentional": [],
    });

    const answers = ["i", "n"]; // classify intentional, decline promote-now
    let i = 0;
    await curatePatterns(client, async () => answers[i++]);

    expect(client.posts).toHaveLength(1);
    expect(client.posts[0].path).toBe("/patterns/pat-001/classify");
    expect(client.posts[0].body).toEqual({ status: "intentional", promote: false });
  });

  test("classifies intentional and promotes in one action", async () => {
    const session = emptySession({ dossiers: [makeDossier()] });
    const client = mockClient({
      "/patterns/session": session,
      "/patterns?status=intentional": [],
    });

    const answers = ["i", "y"];
    let i = 0;
    await curatePatterns(client, async () => answers[i++]);

    expect(client.posts[0].body).toEqual({ status: "intentional", promote: true });
  });

  test("classifies accidental with shorthand 'a'", async () => {
    const session = emptySession({ dossiers: [makeDossier()] });
    const client = mockClient({
      "/patterns/session": session,
      "/patterns?status=intentional": [],
    });

    await curatePatterns(client, async () => "a");

    expect(client.posts).toHaveLength(1);
    expect(client.posts[0].body).toEqual({ status: "accidental", promote: false });
  });

  test("skips a dossier", async () => {
    const session = emptySession({ dossiers: [makeDossier()] });
    const client = mockClient({
      "/patterns/session": session,
      "/patterns?status=intentional": [],
    });

    await curatePatterns(client, async () => "s");

    expect(client.posts).toHaveLength(0);
    const output = logSpy.mock.calls.flat().join("\n");
    expect(output).toContain("0 classified, 1 skipped");
  });

  test("retries on invalid input", async () => {
    const session = emptySession({ dossiers: [makeDossier()] });
    const client = mockClient({
      "/patterns/session": session,
      "/patterns?status=intentional": [],
    });

    let callCount = 0;
    await curatePatterns(client, async () => {
      callCount++;
      if (callCount === 1) return "bogus";
      return "u";
    });

    expect(client.posts).toHaveLength(1);
    expect(client.posts[0].body).toEqual({ status: "undecided", promote: false });
  });

  test("dismisses a dossier", async () => {
    const session = emptySession({ dossiers: [makeDossier()] });
    const client = mockClient({
      "/patterns/session": session,
      "/patterns?status=intentional": [],
    });

    await curatePatterns(client, async () => "d");

    expect(client.posts).toHaveLength(1);
    expect(client.posts[0].path).toBe("/patterns/pat-001/dismiss");
    const output = logSpy.mock.calls.flat().join("\n");
    expect(output).toContain("1 dismissed");
  });

  test("detaches a sighting by index", async () => {
    const session = emptySession({ dossiers: [makeDossier()] });
    const client = mockClient({
      "/patterns/session": session,
      "/patterns?status=intentional": [],
    });

    const answers = ["t", "1"];
    let i = 0;
    await curatePatterns(client, async () => answers[i++]);

    expect(client.posts).toHaveLength(1);
    expect(client.posts[0].path).toBe("/patterns/pat-001/detach");
    expect(client.posts[0].body).toEqual({ sightingId: "obs-001" });
  });

  test("re-prompts on an out-of-range detach index", async () => {
    const session = emptySession({ dossiers: [makeDossier()] });
    const client = mockClient({
      "/patterns/session": session,
      "/patterns?status=intentional": [],
    });

    const answers = ["t", "99", "1"];
    let i = 0;
    await curatePatterns(client, async () => answers[i++]);

    expect(client.posts).toHaveLength(1);
    expect(client.posts[0].body).toEqual({ sightingId: "obs-001" });
  });

  test("merges a duplicate pattern into the current one", async () => {
    const session = emptySession({ dossiers: [makeDossier()] });
    const client = mockClient({
      "/patterns/session": session,
      "/patterns?status=intentional": [],
    });

    const answers = ["m", "pat-002"];
    let i = 0;
    await curatePatterns(client, async () => answers[i++]);

    expect(client.posts).toHaveLength(1);
    expect(client.posts[0].path).toBe("/patterns/pat-001/merge");
    expect(client.posts[0].body).toEqual({ duplicateId: "pat-002" });
  });

  test("shows contradictions before dossiers", async () => {
    const session = emptySession({
      dossiers: [makeDossier()],
      contradictions: [
        {
          pattern: {
            id: "pat-001",
            statement: "Uses short declarative sentences",
            dimension: "sentence-rhythm",
            status: "candidate",
            createdAt: "2026-07-01T00:00:00.000Z",
            updatedAt: "2026-07-01T00:00:00.000Z",
            sightingCount: 1,
            entryIds: ["entry-001"],
          },
          contradicts: {
            id: "pat-002",
            statement: "Uses long flowing sentences",
            dimension: "sentence-rhythm",
            status: "intentional",
            createdAt: "2026-06-01T00:00:00.000Z",
            updatedAt: "2026-06-01T00:00:00.000Z",
            sightingCount: 3,
            entryIds: ["entry-002", "entry-003", "entry-004"],
          },
          dimension: "sentence-rhythm",
        },
      ],
    });
    const client = mockClient({
      "/patterns/session": session,
      "/patterns?status=intentional": [],
    });

    await curatePatterns(client, async () => "s");

    const output = logSpy.mock.calls.flat().join("\n");
    expect(output).toContain("Contradiction Detected");
    expect(output).toContain("Uses long flowing sentences");
  });

  test("shows full entry text without truncation", async () => {
    const longText = "A".repeat(500);
    const session = emptySession({
      dossiers: [
        makeDossier({
          sightings: [
            {
              id: "obs-001",
              patternId: "pat-001",
              entryId: "entry-001",
              evidence: ["Evidence"],
              dimension: "sentence-rhythm",
              createdAt: "2026-07-01T00:00:00.000Z",
              entryText: longText,
            },
          ],
        }),
      ],
    });
    const client = mockClient({
      "/patterns/session": session,
      "/patterns?status=intentional": [],
    });

    await curatePatterns(client, async () => "s");

    const output = logSpy.mock.calls.flat().join("\n");
    expect(output).toContain(longText);
    expect(output).not.toContain("...");
  });

  test("renders a computable trend line from the API's precomputed numbers", async () => {
    const session = emptySession({
      dossiers: [
        makeDossier({
          trend: { metricLink: "commaRatePer1000", rollingMean: 12.5, windowSize: 5, baseline: 9 },
        }),
      ],
    });
    const client = mockClient({
      "/patterns/session": session,
      "/patterns?status=intentional": [],
    });

    await curatePatterns(client, async () => "s");

    const output = logSpy.mock.calls.flat().join("\n");
    expect(output).toContain("Trend (commaRatePer1000): rolling mean 12.5 over last 5 entries, baseline 9.");
  });

  test("renders the watch list with recurrence text, read-only", async () => {
    const session = emptySession({
      watchList: [
        makeDossier({
          pattern: {
            id: "pat-003",
            statement: "Overuses semicolons",
            dimension: "sentence-structure",
            status: "accidental",
            createdAt: "2026-06-01T00:00:00.000Z",
            updatedAt: "2026-06-15T00:00:00.000Z",
            sightingCount: 2,
            entryIds: ["entry-005", "entry-006"],
            watch: { classifiedAt: "2026-06-15T00:00:00.000Z", resolved: false },
          },
          watchStatus: {
            classifiedAt: "2026-06-15T00:00:00.000Z",
            recurrenceText: "Seen in 2 of 5 entries since you marked this accidental.",
            resolved: false,
          },
        }),
      ],
    });
    const client = mockClient({
      "/patterns/session": session,
      "/patterns?status=intentional": [],
    });

    await curatePatterns(client, async () => "s");

    const output = logSpy.mock.calls.flat().join("\n");
    expect(output).toContain("Watch list");
    expect(output).toContain("Seen in 2 of 5 entries since you marked this accidental.");
    // No action prompt was issued for the watch item (only for the dossier's own skip)
    expect(client.posts).toHaveLength(0);
  });

  test("reaffirms a resurfaced rule", async () => {
    const session = emptySession({
      resurfacedRules: [
        {
          rule: {
            id: "rule-001",
            pattern: "Uses staccato rhythm",
            dimension: "sentence-rhythm",
            sourceCount: 3,
            sourceSummary: "Confirmed across 3 entries",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
          pattern: {
            id: "pat-004",
            statement: "Uses staccato rhythm",
            dimension: "sentence-rhythm",
            status: "intentional",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            sightingCount: 3,
            entryIds: ["entry-007", "entry-008", "entry-009"],
          },
          reasons: ["stale"],
          staleness: { windowSize: 10 },
        },
      ],
    });
    const client = mockClient({
      "/patterns/session": session,
      "/patterns?status=intentional": [],
    });

    await curatePatterns(client, async () => "r");

    expect(client.posts).toHaveLength(1);
    expect(client.posts[0].path).toBe("/patterns/pat-004/reaffirm");
    const output = logSpy.mock.calls.flat().join("\n");
    expect(output).toContain("Rule resurfaced: stale");
    expect(output).toContain("1 reaffirmed, 0 retired");
  });

  test("retires a resurfaced (drifting) rule", async () => {
    const session = emptySession({
      resurfacedRules: [
        {
          rule: {
            id: "rule-002",
            pattern: "Rarely uses hedging words",
            dimension: "word-level-habits",
            sourceCount: 4,
            sourceSummary: "Confirmed across 4 entries",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
          pattern: {
            id: "pat-005",
            statement: "Rarely uses hedging words",
            dimension: "word-level-habits",
            status: "intentional",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            sightingCount: 4,
            entryIds: ["e1", "e2", "e3", "e4"],
          },
          reasons: ["drift"],
          drift: { rollingMean: 4.2, baseline: 2, relativeDeviation: 1.1, margin: 0.5 },
        },
      ],
    });
    const client = mockClient({
      "/patterns/session": session,
      "/patterns?status=intentional": [],
    });

    await curatePatterns(client, async () => "x");

    expect(client.posts).toHaveLength(1);
    expect(client.posts[0].path).toBe("/patterns/pat-005/retire");
    const output = logSpy.mock.calls.flat().join("\n");
    expect(output).toContain("110% deviation, margin 50%");
  });

  test("accepts a promotion proposal", async () => {
    const session = emptySession({
      proposals: [
        {
          patternId: "pat-006",
          statement: "Uses em-dashes for asides",
          dimension: "sentence-structure",
          sightingCount: 3,
          distinctEntryCount: 3,
          totalWordCount: 2200,
        },
      ],
    });
    const client = mockClient({
      "/patterns/session": session,
      "/patterns?status=intentional": [],
    });

    await curatePatterns(client, async () => "a");

    expect(client.posts).toHaveLength(1);
    expect(client.posts[0].path).toBe("/patterns/pat-006/proposal");
    expect(client.posts[0].body).toEqual({ action: "accept" });
    const output = logSpy.mock.calls.flat().join("\n");
    expect(output).toContain("1 proposals accepted, 0 declined");
  });

  test("declines a promotion proposal", async () => {
    const session = emptySession({
      proposals: [
        {
          patternId: "pat-006",
          statement: "Uses em-dashes for asides",
          dimension: "sentence-structure",
          sightingCount: 3,
          distinctEntryCount: 3,
          totalWordCount: 2200,
        },
      ],
    });
    const client = mockClient({
      "/patterns/session": session,
      "/patterns?status=intentional": [],
    });

    await curatePatterns(client, async () => "d");

    expect(client.posts[0].body).toEqual({ action: "decline" });
  });

  test("reports below-threshold intentional patterns as evidence still accumulating", async () => {
    const session = emptySession();
    const belowThreshold: Pattern = {
      id: "pat-007",
      statement: "Ends paragraphs on a one-word sentence",
      dimension: "paragraph-structure",
      status: "intentional",
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
      sightingCount: 1,
      entryIds: ["entry-010"],
    };
    const client = mockClient({
      "/patterns/session": session,
      "/patterns?status=intentional": [belowThreshold],
    });

    await curatePatterns(client, async () => "s");

    const output = logSpy.mock.calls.flat().join("\n");
    expect(output).toContain("Evidence still accumulating");
    expect(output).toContain("Ends paragraphs on a one-word sentence");
    expect(output).toContain("not yet eligible for a promotion proposal");
  });

  test("excludes already-proposed or already-promoted patterns from the accumulating list", async () => {
    const session = emptySession({
      proposals: [
        {
          patternId: "pat-008",
          statement: "Proposed pattern",
          dimension: "sentence-rhythm",
          sightingCount: 3,
          distinctEntryCount: 3,
          totalWordCount: 2200,
        },
      ],
    });
    const proposed: Pattern = {
      id: "pat-008",
      statement: "Proposed pattern",
      dimension: "sentence-rhythm",
      status: "intentional",
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
      sightingCount: 3,
      entryIds: ["e1", "e2", "e3"],
    };
    const promoted: Pattern = {
      id: "pat-009",
      statement: "Already promoted pattern",
      dimension: "sentence-rhythm",
      status: "intentional",
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
      sightingCount: 5,
      entryIds: ["e4", "e5", "e6"],
      ruleId: "rule-010",
    };
    const client = mockClient({
      "/patterns/session": session,
      "/patterns?status=intentional": [proposed, promoted],
    });

    await curatePatterns(client, async () => "d");

    const output = logSpy.mock.calls.flat().join("\n");
    expect(output).not.toContain("Evidence still accumulating");
  });

  test("logs an error but continues when an action is rejected by the daemon", async () => {
    const session = emptySession({ dossiers: [makeDossier()] });
    const client = mockClient(
      { "/patterns/session": session, "/patterns?status=intentional": [] },
      { "/patterns/pat-001/dismiss": "Invalid transition" },
    );

    await curatePatterns(client, async () => "d");

    expect(errorSpy).toHaveBeenCalled();
    const errOutput = errorSpy.mock.calls.flat().join("\n");
    expect(errOutput).toContain("Invalid transition");
    // A rejected action must not be miscounted as a successful dismiss.
    const output = logSpy.mock.calls.flat().join("\n");
    expect(output).toContain("0 dismissed");
  });
});
