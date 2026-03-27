import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApp } from "../src/app.js";
import { createEntryStore } from "../src/entry-store.js";
import { createEntryRoutes } from "../src/routes/entries.js";

function req(path: string, opts?: { method?: string; body?: unknown }): Request {
  const method = opts?.method ?? "GET";
  const init: RequestInit = { method };
  if (opts?.body) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(opts.body);
  }
  return new Request(`http://localhost${path}`, init);
}

describe("entry round-trip integration", () => {
  let entriesDir: string;
  let hono: ReturnType<typeof createApp>["hono"];

  beforeEach(() => {
    entriesDir = mkdtempSync(join(tmpdir(), "ink-mirror-test-"));
    const entryStore = createEntryStore({ entriesDir });
    const entryRoutes = createEntryRoutes({ entryStore });
    const app = createApp({ routeModules: [entryRoutes] });
    hono = app.hono;
  });

  afterEach(() => {
    rmSync(entriesDir, { recursive: true, force: true });
  });

  test("create then list shows the entry", async () => {
    const createRes = await hono.request(
      req("/entries", { method: "POST", body: { body: "Integration test entry." } }),
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    const listRes = await hono.request(req("/entries"));
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(created.id);
  });

  test("create then read returns the same entry", async () => {
    const createRes = await hono.request(
      req("/entries", {
        method: "POST",
        body: { body: "Content for reading.", title: "Read Test" },
      }),
    );
    const created = await createRes.json();

    const readRes = await hono.request(req(`/entries/${created.id}`));
    expect(readRes.status).toBe(200);
    const entry = await readRes.json();
    expect(entry.id).toBe(created.id);
    expect(entry.body).toBe("Content for reading.");
    expect(entry.title).toBe("Read Test");
  });

  test("created file is valid human-readable markdown", async () => {
    await hono.request(
      req("/entries", {
        method: "POST",
        body: { body: "Human readable content.\n\nWith paragraphs." },
      }),
    );

    // Read the file directly from disk (REQ-V1-3, REQ-V1-26)
    const files = readdirSync(entriesDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/\.md$/);

    const content = readFileSync(join(entriesDir, files[0]), "utf-8");

    // Valid YAML frontmatter
    expect(content.startsWith("---\n")).toBe(true);
    expect(content).toContain("id:");
    expect(content).toContain("date:");

    // Body content after frontmatter
    expect(content).toContain("Human readable content.");
    expect(content).toContain("With paragraphs.");
  });

  test("multiple entries get sequential IDs", async () => {
    const res1 = await hono.request(
      req("/entries", { method: "POST", body: { body: "First." } }),
    );
    const res2 = await hono.request(
      req("/entries", { method: "POST", body: { body: "Second." } }),
    );
    const e1 = await res1.json();
    const e2 = await res2.json();

    expect(e1.id).toMatch(/-001$/);
    expect(e2.id).toMatch(/-002$/);
  });

  test("CLI discovery sees entry operations", async () => {
    const helpRes = await hono.request(req("/help"));
    expect(helpRes.status).toBe(200);
    const tree = await helpRes.json();

    // The entries operations should be in the help tree
    expect(tree.children).toBeDefined();
    expect(tree.children.entries).toBeDefined();
  });
});
