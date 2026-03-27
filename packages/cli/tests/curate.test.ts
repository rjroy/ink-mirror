import { describe, expect, test, spyOn, afterEach } from "bun:test";
import type { DaemonClient } from "../src/client.js";
import type { CurationSession } from "@ink-mirror/shared";
import { curateObservations } from "../src/curate.js";

function mockClient(session: CurationSession): DaemonClient & { patches: Array<{ path: string; body: string }> } {
  const patches: Array<{ path: string; body: string }> = [];

  return {
    patches,
    async fetch(path: string, init?: RequestInit) {
      if (init?.method === "PATCH") {
        patches.push({ path, body: init.body as string });
        return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
      }
      return new Response("", { status: 404 });
    },
    async fetchJson<T>(path: string) {
      if (path === "/observations/pending") {
        return session as T;
      }
      throw new Error(`Unexpected path: ${path}`);
    },
    async getHelpTree() {
      return { name: "root" };
    },
  };
}

const logSpy = spyOn(console, "log").mockImplementation(() => {});
const errorSpy = spyOn(console, "error").mockImplementation(() => {});

afterEach(() => {
  logSpy.mockClear();
  errorSpy.mockClear();
});

describe("curate command", () => {
  test("handles empty session", async () => {
    const client = mockClient({ observations: [], contradictions: [] });
    await curateObservations(client, async () => "i");
    expect(logSpy).toHaveBeenCalledWith("No observations pending curation.");
  });

  test("classifies an observation as intentional", async () => {
    const session: CurationSession = {
      observations: [
        {
          id: "obs-001",
          entryId: "entry-001",
          pattern: "Short sentences",
          evidence: "I stopped.",
          dimension: "sentence-rhythm",
          status: "pending",
          createdAt: "2026-03-27T10:00:00.000Z",
          updatedAt: "2026-03-27T10:00:00.000Z",
          entryText: "I stopped. I turned.",
        },
      ],
      contradictions: [],
    };

    const client = mockClient(session);
    await curateObservations(client, async () => "i");

    expect(client.patches).toHaveLength(1);
    expect(client.patches[0].path).toBe("/observations/obs-001");
    expect(JSON.parse(client.patches[0].body)).toEqual({ status: "intentional" });
  });

  test("classifies as accidental with shorthand 'a'", async () => {
    const session: CurationSession = {
      observations: [
        {
          id: "obs-001",
          entryId: "entry-001",
          pattern: "Pattern",
          evidence: "Evidence",
          dimension: "sentence-rhythm",
          status: "pending",
          createdAt: "2026-03-27T10:00:00.000Z",
          updatedAt: "2026-03-27T10:00:00.000Z",
          entryText: "Entry text",
        },
      ],
      contradictions: [],
    };

    const client = mockClient(session);
    await curateObservations(client, async () => "a");

    expect(client.patches).toHaveLength(1);
    expect(JSON.parse(client.patches[0].body)).toEqual({ status: "accidental" });
  });

  test("skips an observation", async () => {
    const session: CurationSession = {
      observations: [
        {
          id: "obs-001",
          entryId: "entry-001",
          pattern: "Pattern",
          evidence: "Evidence",
          dimension: "sentence-rhythm",
          status: "pending",
          createdAt: "2026-03-27T10:00:00.000Z",
          updatedAt: "2026-03-27T10:00:00.000Z",
          entryText: "Entry text",
        },
      ],
      contradictions: [],
    };

    const client = mockClient(session);
    await curateObservations(client, async () => "s");

    expect(client.patches).toHaveLength(0);
  });

  test("retries on invalid input", async () => {
    const session: CurationSession = {
      observations: [
        {
          id: "obs-001",
          entryId: "entry-001",
          pattern: "Pattern",
          evidence: "Evidence",
          dimension: "sentence-rhythm",
          status: "pending",
          createdAt: "2026-03-27T10:00:00.000Z",
          updatedAt: "2026-03-27T10:00:00.000Z",
          entryText: "Entry text",
        },
      ],
      contradictions: [],
    };

    const client = mockClient(session);
    let callCount = 0;
    await curateObservations(client, async () => {
      callCount++;
      if (callCount === 1) return "invalid";
      return "u";
    });

    expect(client.patches).toHaveLength(1);
    expect(JSON.parse(client.patches[0].body)).toEqual({ status: "undecided" });
  });

  test("shows contradictions before observations", async () => {
    const session: CurationSession = {
      observations: [
        {
          id: "obs-001",
          entryId: "entry-001",
          pattern: "Short sentences",
          evidence: "I stopped.",
          dimension: "sentence-rhythm",
          status: "pending",
          createdAt: "2026-03-27T10:00:00.000Z",
          updatedAt: "2026-03-27T10:00:00.000Z",
          entryText: "I stopped.",
        },
      ],
      contradictions: [
        {
          newObservation: {
            id: "obs-001",
            entryId: "entry-001",
            pattern: "Short sentences",
            evidence: "I stopped.",
            dimension: "sentence-rhythm",
            status: "pending",
            createdAt: "2026-03-27T10:00:00.000Z",
            updatedAt: "2026-03-27T10:00:00.000Z",
            entryText: "I stopped.",
          },
          confirmedObservation: {
            id: "obs-002",
            entryId: "entry-002",
            pattern: "Long flowing sentences",
            evidence: "The morning was long.",
            dimension: "sentence-rhythm",
            status: "intentional",
            createdAt: "2026-03-26T10:00:00.000Z",
            updatedAt: "2026-03-26T10:00:00.000Z",
            entryText: "The morning was long.",
          },
          dimension: "sentence-rhythm",
        },
      ],
    };

    const client = mockClient(session);
    await curateObservations(client, async () => "i");

    // The contradiction message should appear in the output
    const allCalls = logSpy.mock.calls.flat().join("\n");
    expect(allCalls).toContain("Contradiction Detected");
    expect(allCalls).toContain("sentence-rhythm");
  });

  test("shows full entry text without truncation", async () => {
    const longText = "A".repeat(500);
    const session: CurationSession = {
      observations: [
        {
          id: "obs-001",
          entryId: "entry-001",
          pattern: "Pattern",
          evidence: "Evidence",
          dimension: "sentence-rhythm",
          status: "pending",
          createdAt: "2026-03-27T10:00:00.000Z",
          updatedAt: "2026-03-27T10:00:00.000Z",
          entryText: longText,
        },
      ],
      contradictions: [],
    };

    const client = mockClient(session);
    await curateObservations(client, async () => "i");

    const allCalls = logSpy.mock.calls.flat().join("\n");
    expect(allCalls).toContain(longText);
    expect(allCalls).not.toContain("...");
  });

  test("reports summary at end", async () => {
    const session: CurationSession = {
      observations: [
        {
          id: "obs-001",
          entryId: "entry-001",
          pattern: "P1",
          evidence: "E1",
          dimension: "sentence-rhythm",
          status: "pending",
          createdAt: "2026-03-27T10:00:00.000Z",
          updatedAt: "2026-03-27T10:00:00.000Z",
          entryText: "Text",
        },
        {
          id: "obs-002",
          entryId: "entry-001",
          pattern: "P2",
          evidence: "E2",
          dimension: "word-level-habits",
          status: "pending",
          createdAt: "2026-03-27T10:00:00.000Z",
          updatedAt: "2026-03-27T10:00:00.000Z",
          entryText: "Text",
        },
      ],
      contradictions: [],
    };

    const client = mockClient(session);
    let callNum = 0;
    await curateObservations(client, async () => {
      callNum++;
      return callNum === 1 ? "i" : "s";
    });

    const allCalls = logSpy.mock.calls.flat().join("\n");
    expect(allCalls).toContain("1 classified, 1 skipped");
  });
});
