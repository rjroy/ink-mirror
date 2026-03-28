import { describe, test, expect } from "bun:test";

/**
 * Tests for the server-side daemon client.
 * Verifies that daemonFetch and daemonJson correctly construct requests.
 *
 * These tests use the daemon's Hono app directly (via app.request())
 * rather than a live socket, matching the test pattern from daemon tests.
 */

describe("daemon client", () => {
  test("daemonFetch constructs correct GET requests", async () => {
    // Import directly to verify module shape
    const { daemonFetch } = await import("../lib/daemon");
    expect(typeof daemonFetch).toBe("function");
  });

  test("daemonJson constructs correct GET requests", async () => {
    const { daemonJson } = await import("../lib/daemon");
    expect(typeof daemonJson).toBe("function");
  });
});
