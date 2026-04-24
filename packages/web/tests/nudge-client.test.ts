import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import * as api from "../lib/api";

type FetchCall = { url: string; init: RequestInit | undefined };

const successResponse = {
  nudges: [],
  metrics: {
    passiveRatio: 0,
    totalSentences: 0,
    hedgingWordCount: 0,
    rhythmVariance: 0,
  },
  source: "fresh" as const,
  generatedAt: "2026-04-22T12:00:00.000Z",
};

describe("nudge client function", () => {
  test("exports requestNudge", () => {
    expect(typeof api.requestNudge).toBe("function");
  });
});

describe("requestNudge body construction", () => {
  let originalFetch: typeof globalThis.fetch;
  let calls: FetchCall[];

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    calls = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      calls.push({ url, init });
      return new Response(JSON.stringify(successResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("omits refresh by default", async () => {
    await api.requestNudge({ entryId: "entry-2026-04-22-001" });
    expect(calls).toHaveLength(1);
    const body = JSON.parse(calls[0].init?.body as string) as Record<string, unknown>;
    expect(body).toEqual({ entryId: "entry-2026-04-22-001" });
    expect("refresh" in body).toBe(false);
  });

  test("forwards refresh: true when supplied", async () => {
    await api.requestNudge({ entryId: "entry-2026-04-22-001", refresh: true });
    const body = JSON.parse(calls[0].init?.body as string) as Record<string, unknown>;
    expect(body.refresh).toBe(true);
    expect(body.entryId).toBe("entry-2026-04-22-001");
  });

  test("forwards context alongside refresh", async () => {
    await api.requestNudge({
      entryId: "entry-x",
      context: "journal",
      refresh: true,
    });
    const body = JSON.parse(calls[0].init?.body as string) as Record<string, unknown>;
    expect(body).toEqual({
      entryId: "entry-x",
      context: "journal",
      refresh: true,
    });
  });

  test("passes AbortSignal through to fetch", async () => {
    const controller = new AbortController();
    await api.requestNudge(
      { entryId: "entry-x" },
      { signal: controller.signal },
    );
    expect(calls[0].init?.signal).toBe(controller.signal);
  });

  test("aborted fetch surfaces an error", async () => {
    globalThis.fetch = (async (_input, init?: RequestInit) => {
      const signal = init?.signal;
      if (signal?.aborted) {
        throw new DOMException("aborted", "AbortError");
      }
      return new Response("{}", { status: 200 });
    }) as typeof globalThis.fetch;

    const controller = new AbortController();
    controller.abort();
    await expect(
      api.requestNudge({ entryId: "entry-x" }, { signal: controller.signal }),
    ).rejects.toThrow();
  });
});
