import { describe, expect, test } from "bun:test";
import type { Observation, Entry } from "@ink-mirror/shared";
import type { ObservationStore } from "../src/observation-store.js";
import type { EntryStore } from "../src/entry-store.js";
import { createObservationRoutes } from "../src/routes/observations.js";

function makeObs(overrides: Partial<Observation> & { id: string }): Observation {
  return {
    entryId: "entry-2026-03-27-001",
    pattern: "Uses short sentences",
    evidence: "I stopped. I turned.",
    dimension: "sentence-rhythm",
    status: "pending",
    createdAt: "2026-03-27T10:00:00.000Z",
    updatedAt: "2026-03-27T10:00:00.000Z",
    ...overrides,
  };
}

function makeEntry(id: string, body: string): Entry {
  return { id, date: "2026-03-27", body };
}

function mockStores(
  observations: Observation[] = [],
  entries: Entry[] = [],
): { observationStore: ObservationStore; entryStore: EntryStore } {
  const obsMap = new Map(observations.map((o) => [o.id, { ...o }]));
  const entryMap = new Map(entries.map((e) => [e.id, e]));

  return {
    observationStore: {
      async save() {
        throw new Error("not implemented in mock");
      },
      async list() {
        return [...obsMap.values()];
      },
      async get(id) {
        return obsMap.get(id as string);
      },
      async updateStatus(id, status) {
        const obs = obsMap.get(id as string);
        if (!obs) return undefined;
        const updated = { ...obs, status, updatedAt: "2026-03-27T11:00:00.000Z" };
        obsMap.set(id as string, updated);
        return updated;
      },
    },
    entryStore: {
      async create() {
        throw new Error("not implemented in mock");
      },
      async list() {
        return [];
      },
      async get(id) {
        return entryMap.get(id as string);
      },
    },
  };
}

function req(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

describe("GET /observations/pending", () => {
  test("returns empty session when no observations", async () => {
    const { observationStore, entryStore } = mockStores();
    const { routes } = createObservationRoutes({ observationStore, entryStore });

    const res = await routes.request(req("/observations/pending"));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.observations).toEqual([]);
    expect(json.contradictions).toEqual([]);
  });

  test("returns pending observations with entry text", async () => {
    const obs = [makeObs({ id: "obs-001" })];
    const entries = [makeEntry("entry-2026-03-27-001", "Entry body text")];
    const { observationStore, entryStore } = mockStores(obs, entries);
    const { routes } = createObservationRoutes({ observationStore, entryStore });

    const res = await routes.request(req("/observations/pending"));
    const json = await res.json();

    expect(json.observations).toHaveLength(1);
    expect(json.observations[0].id).toBe("obs-001");
    expect(json.observations[0].entryText).toBe("Entry body text");
  });

  test("returns contradictions when new obs conflicts with confirmed", async () => {
    const obs = [
      makeObs({ id: "obs-new", status: "pending", pattern: "Uses short sentences" }),
      makeObs({
        id: "obs-conf",
        status: "intentional",
        pattern: "Uses long compound sentences",
        entryId: "entry-2026-03-27-002",
      }),
    ];
    const entries = [
      makeEntry("entry-2026-03-27-001", "Short."),
      makeEntry("entry-2026-03-27-002", "Long and flowing."),
    ];
    const { observationStore, entryStore } = mockStores(obs, entries);
    const { routes } = createObservationRoutes({ observationStore, entryStore });

    const res = await routes.request(req("/observations/pending"));
    const json = await res.json();

    expect(json.contradictions).toHaveLength(1);
    expect(json.contradictions[0].dimension).toBe("sentence-rhythm");
  });
});

describe("PATCH /observations/:id", () => {
  test("classifies a pending observation as intentional", async () => {
    const obs = [makeObs({ id: "obs-001", status: "pending" })];
    const { observationStore, entryStore } = mockStores(obs);
    const { routes } = createObservationRoutes({ observationStore, entryStore });

    const res = await routes.request(
      req("/observations/obs-001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "intentional" }),
      }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("intentional");
  });

  test("rejects invalid observation ID format", async () => {
    const { observationStore, entryStore } = mockStores();
    const { routes } = createObservationRoutes({ observationStore, entryStore });

    const res = await routes.request(
      req("/observations/not-an-obs-id", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "intentional" }),
      }),
    );

    expect(res.status).toBe(400);
  });

  test("returns 404 for unknown observation", async () => {
    const { observationStore, entryStore } = mockStores();
    const { routes } = createObservationRoutes({ observationStore, entryStore });

    const res = await routes.request(
      req("/observations/obs-nonexistent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "intentional" }),
      }),
    );

    expect(res.status).toBe(404);
  });

  test("rejects invalid state transition (accidental -> intentional)", async () => {
    const obs = [makeObs({ id: "obs-001", status: "accidental" })];
    const { observationStore, entryStore } = mockStores(obs);
    const { routes } = createObservationRoutes({ observationStore, entryStore });

    const res = await routes.request(
      req("/observations/obs-001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "intentional" }),
      }),
    );

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toContain("Invalid transition");
  });

  test("rejects classification as pending", async () => {
    const obs = [makeObs({ id: "obs-001", status: "undecided" })];
    const { observationStore, entryStore } = mockStores(obs);
    const { routes } = createObservationRoutes({ observationStore, entryStore });

    const res = await routes.request(
      req("/observations/obs-001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      }),
    );

    expect(res.status).toBe(400);
  });

  test("allows undecided -> accidental", async () => {
    const obs = [makeObs({ id: "obs-001", status: "undecided" })];
    const { observationStore, entryStore } = mockStores(obs);
    const { routes } = createObservationRoutes({ observationStore, entryStore });

    const res = await routes.request(
      req("/observations/obs-001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "accidental" }),
      }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("accidental");
  });

  test("rejects invalid JSON body", async () => {
    const { observationStore, entryStore } = mockStores();
    const { routes } = createObservationRoutes({ observationStore, entryStore });

    const res = await routes.request(
      req("/observations/obs-001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      }),
    );

    expect(res.status).toBe(400);
  });
});

describe("GET /observations", () => {
  test("returns all observations", async () => {
    const obs = [
      makeObs({ id: "obs-001", status: "pending" }),
      makeObs({ id: "obs-002", status: "intentional" }),
    ];
    const { observationStore, entryStore } = mockStores(obs);
    const { routes } = createObservationRoutes({ observationStore, entryStore });

    const res = await routes.request(req("/observations"));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveLength(2);
  });

  test("filters by status", async () => {
    const obs = [
      makeObs({ id: "obs-001", status: "pending" }),
      makeObs({ id: "obs-002", status: "intentional" }),
      makeObs({ id: "obs-003", status: "pending" }),
    ];
    const { observationStore, entryStore } = mockStores(obs);
    const { routes } = createObservationRoutes({ observationStore, entryStore });

    const res = await routes.request(req("/observations?status=pending"));
    const json = await res.json();

    expect(json).toHaveLength(2);
    expect(json.every((o: Observation) => o.status === "pending")).toBe(true);
  });

  test("rejects invalid status filter", async () => {
    const { observationStore, entryStore } = mockStores();
    const { routes } = createObservationRoutes({ observationStore, entryStore });

    const res = await routes.request(req("/observations?status=bogus"));
    expect(res.status).toBe(400);
  });

  test("returns all observations in all states without filter", async () => {
    const obs = [
      makeObs({ id: "obs-001", status: "pending" }),
      makeObs({ id: "obs-002", status: "intentional" }),
      makeObs({ id: "obs-003", status: "accidental" }),
      makeObs({ id: "obs-004", status: "undecided" }),
    ];
    const { observationStore, entryStore } = mockStores(obs);
    const { routes } = createObservationRoutes({ observationStore, entryStore });

    const res = await routes.request(req("/observations"));
    const json = await res.json();

    expect(json).toHaveLength(4);
    const statuses = json.map((o: Observation) => o.status);
    expect(statuses).toContain("pending");
    expect(statuses).toContain("intentional");
    expect(statuses).toContain("accidental");
    expect(statuses).toContain("undecided");
  });

  test("returns empty array when no observations match filter", async () => {
    const obs = [makeObs({ id: "obs-001", status: "pending" })];
    const { observationStore, entryStore } = mockStores(obs);
    const { routes } = createObservationRoutes({ observationStore, entryStore });

    const res = await routes.request(req("/observations?status=intentional"));
    const json = await res.json();
    expect(json).toEqual([]);
  });
});
