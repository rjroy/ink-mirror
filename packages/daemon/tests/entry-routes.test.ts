import { describe, expect, test } from "bun:test";
import type { Entry, EntryListItem } from "@ink-mirror/shared";
import type { EntryId } from "@ink-mirror/shared";
import { createEntryRoutes } from "../src/routes/entries.js";
import type { EntryStore } from "../src/entry-store.js";

/**
 * In-memory entry store for route tests.
 * Routes are tested against the store interface, not the filesystem.
 */
function mockEntryStore(
  initial: Entry[] = [],
): EntryStore & { entries: Entry[] } {
  const entries = [...initial];
  let seq = entries.length;

  return {
    entries,
    async create(body: string, title?: string): Promise<Entry> {
      seq++;
      const entry: Entry = {
        id: `entry-2026-03-27-${String(seq).padStart(3, "0")}`,
        date: "2026-03-27",
        ...(title ? { title } : {}),
        body,
      };
      entries.push(entry);
      return entry;
    },
    async list(): Promise<EntryListItem[]> {
      return entries.map((e) => ({
        id: e.id,
        date: e.date,
        ...(e.title ? { title: e.title } : {}),
        preview: e.body.slice(0, 120),
      }));
    },
    async get(id: EntryId): Promise<Entry | undefined> {
      return entries.find((e) => e.id === (id as string));
    },
  };
}

function req(
  path: string,
  opts?: { method?: string; body?: unknown },
): Request {
  const method = opts?.method ?? "GET";
  const init: RequestInit = { method };
  if (opts?.body) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(opts.body);
  }
  return new Request(`http://localhost${path}`, init);
}

describe("POST /entries", () => {
  test("creates entry and returns 201", async () => {
    const store = mockEntryStore();
    const { routes } = createEntryRoutes({ entryStore: store });

    const res = await routes.request(
      req("/entries", { method: "POST", body: { body: "My journal entry." } }),
    );
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.id).toMatch(/^entry-/);
    expect(json.body).toBe("My journal entry.");
    expect(json.date).toBe("2026-03-27");
  });

  test("creates entry with title", async () => {
    const store = mockEntryStore();
    const { routes } = createEntryRoutes({ entryStore: store });

    const res = await routes.request(
      req("/entries", {
        method: "POST",
        body: { body: "Content", title: "My Title" },
      }),
    );
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.title).toBe("My Title");
  });

  test("rejects empty body with 400", async () => {
    const store = mockEntryStore();
    const { routes } = createEntryRoutes({ entryStore: store });

    const res = await routes.request(
      req("/entries", { method: "POST", body: { body: "" } }),
    );
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe("Invalid request");
  });

  test("rejects missing body with 400", async () => {
    const store = mockEntryStore();
    const { routes } = createEntryRoutes({ entryStore: store });

    const res = await routes.request(
      req("/entries", { method: "POST", body: {} }),
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /entries", () => {
  test("returns empty list when no entries", async () => {
    const store = mockEntryStore();
    const { routes } = createEntryRoutes({ entryStore: store });

    const res = await routes.request(req("/entries"));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toEqual([]);
  });

  test("returns list of entries", async () => {
    const store = mockEntryStore([
      { id: "entry-001", date: "2026-03-27", body: "First entry." },
      {
        id: "entry-002",
        date: "2026-03-27",
        title: "Second",
        body: "Second entry.",
      },
    ]);
    const { routes } = createEntryRoutes({ entryStore: store });

    const res = await routes.request(req("/entries"));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveLength(2);
    expect(json[0].preview).toBeDefined();
  });
});

describe("GET /entries/:id", () => {
  test("returns entry by id", async () => {
    const store = mockEntryStore([
      {
        id: "entry-2026-03-27-001",
        date: "2026-03-27",
        body: "Found this.",
      },
    ]);
    const { routes } = createEntryRoutes({ entryStore: store });

    const res = await routes.request(req("/entries/entry-2026-03-27-001"));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.id).toBe("entry-2026-03-27-001");
    expect(json.body).toBe("Found this.");
  });

  test("returns 404 for unknown id", async () => {
    const store = mockEntryStore();
    const { routes } = createEntryRoutes({ entryStore: store });

    const res = await routes.request(req("/entries/entry-nonexistent"));
    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.error).toBe("Entry not found");
  });

  test("rejects path traversal attempt with 400 (F-01)", async () => {
    const store = mockEntryStore();
    const { routes } = createEntryRoutes({ entryStore: store });

    const res = await routes.request(req("/entries/..%2F..%2Fetc%2Fpasswd"));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe("Invalid entry ID");
  });

  test("rejects ID with special characters", async () => {
    const store = mockEntryStore();
    const { routes } = createEntryRoutes({ entryStore: store });

    const res = await routes.request(req("/entries/entry-foo;rm -rf"));
    expect(res.status).toBe(400);
  });
});

describe("operations registration", () => {
  test("registers create, list, and read operations", () => {
    const store = mockEntryStore();
    const { operations } = createEntryRoutes({ entryStore: store });

    expect(operations).toHaveLength(3);

    const ids = operations.map((o) => o.operationId);
    expect(ids).toContain("entries.create");
    expect(ids).toContain("entries.list");
    expect(ids).toContain("entries.read");
  });

  test("create operation has body and title parameters (F-07)", () => {
    const store = mockEntryStore();
    const { operations } = createEntryRoutes({ entryStore: store });

    const create = operations.find((o) => o.operationId === "entries.create");
    expect(create!.parameters).toHaveLength(2);
    expect(create!.parameters![0].name).toBe("body");
    expect(create!.parameters![0].required).toBe(true);
    expect(create!.parameters![1].name).toBe("title");
    expect(create!.parameters![1].required).toBe(false);
  });

  test("read operation has id parameter", () => {
    const store = mockEntryStore();
    const { operations } = createEntryRoutes({ entryStore: store });

    const read = operations.find((o) => o.operationId === "entries.read");
    expect(read!.parameters).toHaveLength(1);
    expect(read!.parameters![0].name).toBe("id");
  });
});
