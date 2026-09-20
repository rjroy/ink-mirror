import { describe, expect, test } from "bun:test";
import type { Observation } from "@ink-mirror/shared";
import type { ObservationStore } from "../src/observation-store.js";
import { createObservationRoutes } from "../src/routes/observations.js";

function makeObs(overrides: Partial<Observation> & { id: string }): Observation {
  return {
    entryId: "entry-2026-03-27-001",
    patternId: "pat-2026-03-27-001",
    pattern: "Uses short sentences",
    evidence: ["I stopped. I turned."],
    dimension: "sentence-rhythm",
    createdAt: "2026-03-27T10:00:00.000Z",
    updatedAt: "2026-03-27T10:00:00.000Z",
    ...overrides,
  };
}

function mockObservationStore(observations: Observation[] = []): ObservationStore {
  const obsMap = new Map(observations.map((o) => [o.id, { ...o }]));

  return {
    async save() {
      throw new Error("not implemented in mock");
    },
    async list() {
      return [...obsMap.values()];
    },
    async get(id) {
      return obsMap.get(id as string);
    },
    async reassignPattern() {
      throw new Error("not implemented in mock");
    },
  };
}

function req(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

describe("GET /observations", () => {
  test("returns empty list when no observations", async () => {
    const { routes } = createObservationRoutes({ observationStore: mockObservationStore() });

    const res = await routes.request(req("/observations"));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toEqual([]);
  });

  test("returns every stored observation (no per-observation status to filter on, REQ-LPC-30)", async () => {
    const obs = [
      makeObs({ id: "obs-001" }),
      makeObs({ id: "obs-002" }),
      makeObs({ id: "obs-003" }),
      makeObs({ id: "obs-004" }),
    ];
    const { routes } = createObservationRoutes({ observationStore: mockObservationStore(obs) });

    const res = await routes.request(req("/observations"));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveLength(4);
  });

  test("does not support a status filter (REQ-LPC-30): the query param is ignored", async () => {
    const obs = [
      makeObs({ id: "obs-001" }),
      makeObs({ id: "obs-002" }),
    ];
    const { routes } = createObservationRoutes({ observationStore: mockObservationStore(obs) });

    const res = await routes.request(req("/observations?status=pending"));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveLength(2);
  });
});

describe("PATCH /observations/:id (removed, REQ-LPC-28)", () => {
  test("no longer exists on the observation route surface", async () => {
    const obs = [makeObs({ id: "obs-001" })];
    const { routes } = createObservationRoutes({ observationStore: mockObservationStore(obs) });

    const res = await routes.request(
      req("/observations/obs-001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "intentional" }),
      }),
    );

    expect(res.status).toBe(404);
  });
});

describe("GET /observations/pending (removed, superseded by GET /patterns/session)", () => {
  test("no longer exists on the observation route surface", async () => {
    const { routes } = createObservationRoutes({ observationStore: mockObservationStore() });

    const res = await routes.request(req("/observations/pending"));
    expect(res.status).toBe(404);
  });
});

describe("operations registration", () => {
  test("registers only the read-only list operation", () => {
    const { operations } = createObservationRoutes({ observationStore: mockObservationStore() });

    expect(operations).toHaveLength(1);
    expect(operations[0].operationId).toBe("observations.list");
    expect(operations[0].invocation).toEqual({ method: "GET", path: "/observations" });
  });
});
