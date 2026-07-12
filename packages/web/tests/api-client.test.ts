import { describe, test, expect } from "bun:test";
import * as api from "../lib/api";

/**
 * Verifies the client-side API module exports the correct functions.
 * These functions call Next.js API routes which proxy to the daemon.
 *
 * classifyObservation is gone (REQ-LPC-28/30): the endpoint it called was
 * removed from the daemon in Phase 4. Curation is pattern-grain now, so this
 * suite asserts the pattern-grain client surface instead.
 */
describe("api client module", () => {
  test("exports createEntry", () => {
    expect(typeof api.createEntry).toBe("function");
  });

  test("exports listEntries", () => {
    expect(typeof api.listEntries).toBe("function");
  });

  test("does not export the removed observation-grain classifyObservation", () => {
    expect((api as Record<string, unknown>).classifyObservation).toBeUndefined();
  });

  test("does not export the removed observation-grain getCurationSession", () => {
    expect((api as Record<string, unknown>).getCurationSession).toBeUndefined();
  });

  test("exports getPatternSession", () => {
    expect(typeof api.getPatternSession).toBe("function");
  });

  test("exports listPatterns", () => {
    expect(typeof api.listPatterns).toBe("function");
  });

  test("exports getPattern", () => {
    expect(typeof api.getPattern).toBe("function");
  });

  test("exports classifyPattern", () => {
    expect(typeof api.classifyPattern).toBe("function");
  });

  test("exports promotePattern", () => {
    expect(typeof api.promotePattern).toBe("function");
  });

  test("exports respondToProposal", () => {
    expect(typeof api.respondToProposal).toBe("function");
  });

  test("exports detachSighting", () => {
    expect(typeof api.detachSighting).toBe("function");
  });

  test("exports mergePatterns", () => {
    expect(typeof api.mergePatterns).toBe("function");
  });

  test("exports dismissPattern", () => {
    expect(typeof api.dismissPattern).toBe("function");
  });

  test("exports retirePattern", () => {
    expect(typeof api.retirePattern).toBe("function");
  });

  test("exports reactivatePattern", () => {
    expect(typeof api.reactivatePattern).toBe("function");
  });

  test("exports reaffirmRule", () => {
    expect(typeof api.reaffirmRule).toBe("function");
  });

  test("exports getWatchList", () => {
    expect(typeof api.getWatchList).toBe("function");
  });

  test("exports getProfile", () => {
    expect(typeof api.getProfile).toBe("function");
  });

  test("exports updateProfileRule", () => {
    expect(typeof api.updateProfileRule).toBe("function");
  });

  test("exports deleteProfileRule", () => {
    expect(typeof api.deleteProfileRule).toBe("function");
  });

  test("exports replaceProfile", () => {
    expect(typeof api.replaceProfile).toBe("function");
  });

  test("exports subscribeObservations", () => {
    expect(typeof api.subscribeObservations).toBe("function");
  });
});

describe("classifyPattern request body", () => {
  test("omits promote field when not requested", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: "pat-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof globalThis.fetch;

    try {
      await api.classifyPattern("pat-1", "intentional");
      const body = JSON.parse(calls[0].init?.body as string) as Record<string, unknown>;
      expect(body).toEqual({ status: "intentional" });
      expect("promote" in body).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("includes promote: true for classify-and-promote (REQ-LPC-16)", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: "pat-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof globalThis.fetch;

    try {
      await api.classifyPattern("pat-1", "intentional", true);
      const body = JSON.parse(calls[0].init?.body as string) as Record<string, unknown>;
      expect(body).toEqual({ status: "intentional", promote: true });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
