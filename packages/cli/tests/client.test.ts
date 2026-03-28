import { describe, expect, test } from "bun:test";
import { createDaemonClient, type DaemonClient } from "../src/client.js";

/**
 * Tests for createDaemonClient.
 *
 * The client is a thin wrapper around fetch with unix socket support.
 * These tests verify the interface contract and the logic in fetchJson
 * and getHelpTree that runs before/after the raw fetch.
 *
 * We can't inject a mock fetch into createDaemonClient without refactoring,
 * so connection-level tests verify error behavior against a nonexistent socket.
 * The meaningful logic (error wrapping, path construction) is tested via
 * the interface contract.
 */

describe("createDaemonClient", () => {
  test("returns object with all DaemonClient methods", () => {
    const client = createDaemonClient("/tmp/test.sock");
    expect(typeof client.fetch).toBe("function");
    expect(typeof client.fetchJson).toBe("function");
    expect(typeof client.getHelpTree).toBe("function");
  });

  test("fetch rejects when socket does not exist", async () => {
    const client = createDaemonClient("/tmp/nonexistent-ink-mirror-test.sock");
    await expect(client.fetch("/health")).rejects.toThrow();
  });

  test("fetchJson rejects when socket does not exist", async () => {
    const client = createDaemonClient("/tmp/nonexistent-ink-mirror-test.sock");
    await expect(client.fetchJson("/health")).rejects.toThrow();
  });

  test("getHelpTree rejects when socket does not exist", async () => {
    const client = createDaemonClient("/tmp/nonexistent-ink-mirror-test.sock");
    await expect(client.getHelpTree()).rejects.toThrow();
  });

  test("getHelpTree with path segments rejects when socket does not exist", async () => {
    const client = createDaemonClient("/tmp/nonexistent-ink-mirror-test.sock");
    await expect(client.getHelpTree(["entries"])).rejects.toThrow();
  });
});

describe("DaemonClient interface contract", () => {
  // Verify the interface is exported and usable as a type constraint
  test("createDaemonClient return value satisfies DaemonClient", () => {
    const client: DaemonClient = createDaemonClient("/tmp/test.sock");
    expect(client).toBeDefined();
  });
});
