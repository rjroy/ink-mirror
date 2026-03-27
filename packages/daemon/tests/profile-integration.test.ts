import { describe, test, expect } from "bun:test";
import { Hono } from "hono";
import { createObservationRoutes } from "../src/routes/observations.js";
import { createProfileStore } from "../src/profile-store.js";
import type { Observation, ObservationDimension } from "@ink-mirror/shared";

// --- In-memory stores ---

function createMockFs() {
  const files = new Map<string, string>();
  return {
    fs: {
      readFile: async (path: string, _encoding: "utf-8") => {
        const content = files.get(path);
        if (content === undefined) throw new Error(`ENOENT: ${path}`);
        return content;
      },
      writeFile: async (path: string, content: string) => {
        files.set(path, content);
      },
      mkdir: async (_path: string, _opts: { recursive: true }) => {},
    },
    files,
  };
}

function createMockObservationStore(observations: Observation[]) {
  const store = new Map<string, Observation>();
  for (const obs of observations) store.set(obs.id, obs);

  return {
    save: async () => observations[0],
    list: async () => [...store.values()],
    get: async (id: string) => store.get(id),
    updateStatus: async (id: string, status: string) => {
      const obs = store.get(id);
      if (!obs) return undefined;
      const updated = { ...obs, status: status as Observation["status"], updatedAt: "2026-03-27T12:01:00.000Z" };
      store.set(id, updated);
      return updated;
    },
  };
}

function createMockEntryStore() {
  return {
    create: async () => ({ id: "entry-1", date: "2026-03-27", body: "Test." }),
    list: async () => [],
    get: async (id: string) => id === "entry-1"
      ? { id: "entry-1", date: "2026-03-27", body: "Test entry body." }
      : undefined,
  };
}

const FIXED_TIME = "2026-03-27T12:00:00.000Z";

describe("Profile generation on intentional classification", () => {
  test("classifying as intentional creates a profile rule", async () => {
    const mock = createMockFs();
    const profileStore = createProfileStore({
      profilePath: "/test/profile.md",
      fs: mock.fs,
      now: () => FIXED_TIME,
    });

    const observation: Observation = {
      id: "obs-2026-03-27-001",
      entryId: "entry-1",
      pattern: "Used staccato rhythm in this entry for emphasis",
      evidence: "Short. Sharp. Done.",
      dimension: "sentence-rhythm",
      status: "pending",
      createdAt: FIXED_TIME,
      updatedAt: FIXED_TIME,
    };

    const observationStore = createMockObservationStore([observation]);
    const entryStore = createMockEntryStore();

    const onIntentional = async (pattern: string, dimension: string) => {
      await profileStore.addOrMergeRule(pattern, dimension as ObservationDimension);
    };

    const { routes } = createObservationRoutes({
      observationStore,
      entryStore,
      onIntentional,
    });

    const app = new Hono();
    app.route("/", routes);

    const res = await app.request("/observations/obs-2026-03-27-001", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "intentional" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("intentional");
    expect(body.profileUpdated).toBe(true);

    // Profile should now have a rule
    const profile = await profileStore.get();
    expect(profile.rules).toHaveLength(1);
    // Pattern should be transformed to stable characteristic
    expect(profile.rules[0].pattern).toContain("staccato rhythm");
    expect(profile.rules[0].pattern).not.toContain("this entry");
    expect(profile.rules[0].dimension).toBe("sentence-rhythm");
  });

  test("classifying as accidental does not create a profile rule", async () => {
    const observation: Observation = {
      id: "obs-2026-03-27-001",
      entryId: "entry-1",
      pattern: "Hedging words in this entry",
      evidence: "just probably actually",
      dimension: "word-level-habits",
      status: "pending",
      createdAt: FIXED_TIME,
      updatedAt: FIXED_TIME,
    };

    const observationStore = createMockObservationStore([observation]);
    const entryStore = createMockEntryStore();

    let profileUpdated = false;
    const onIntentional = async () => {
      profileUpdated = true;
    };

    const { routes } = createObservationRoutes({
      observationStore,
      entryStore,
      onIntentional,
    });

    const app = new Hono();
    app.route("/", routes);

    const res = await app.request("/observations/obs-2026-03-27-001", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "accidental" }),
    });

    expect(res.status).toBe(200);
    expect(profileUpdated).toBe(false);
  });

  test("returns profileUpdated: true when profile update succeeds", async () => {
    const mock = createMockFs();
    const profileStore = createProfileStore({
      profilePath: "/test/profile.md",
      fs: mock.fs,
      now: () => FIXED_TIME,
    });

    const observation: Observation = {
      id: "obs-2026-03-27-001",
      entryId: "entry-1",
      pattern: "Uses staccato rhythm",
      evidence: "Short.",
      dimension: "sentence-rhythm",
      status: "pending",
      createdAt: FIXED_TIME,
      updatedAt: FIXED_TIME,
    };

    const observationStore = createMockObservationStore([observation]);
    const entryStore = createMockEntryStore();
    const onIntentional = async (pattern: string, dimension: string) => {
      await profileStore.addOrMergeRule(pattern, dimension as ObservationDimension);
    };

    const { routes } = createObservationRoutes({ observationStore, entryStore, onIntentional });
    const app = new Hono();
    app.route("/", routes);

    const res = await app.request("/observations/obs-2026-03-27-001", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "intentional" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profileUpdated).toBe(true);
  });

  test("returns profileUpdated: false when profile update fails", async () => {
    const observation: Observation = {
      id: "obs-2026-03-27-001",
      entryId: "entry-1",
      pattern: "Uses staccato rhythm",
      evidence: "Short.",
      dimension: "sentence-rhythm",
      status: "pending",
      createdAt: FIXED_TIME,
      updatedAt: FIXED_TIME,
    };

    const observationStore = createMockObservationStore([observation]);
    const entryStore = createMockEntryStore();
    const onIntentional = async () => {
      throw new Error("Filesystem write failed");
    };

    const { routes } = createObservationRoutes({ observationStore, entryStore, onIntentional });
    const app = new Hono();
    app.route("/", routes);

    const res = await app.request("/observations/obs-2026-03-27-001", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "intentional" }),
    });

    // Classification still succeeds (200), but profileUpdated is false
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("intentional");
    expect(body.profileUpdated).toBe(false);
  });

  test("repeated intentional patterns merge into single rule", async () => {
    const mock = createMockFs();
    const profileStore = createProfileStore({
      profilePath: "/test/profile.md",
      fs: mock.fs,
      now: () => FIXED_TIME,
    });

    const obs1: Observation = {
      id: "obs-2026-03-27-001",
      entryId: "entry-1",
      pattern: "Uses staccato rhythm for emphasis",
      evidence: "Short. Sharp.",
      dimension: "sentence-rhythm",
      status: "pending",
      createdAt: FIXED_TIME,
      updatedAt: FIXED_TIME,
    };
    const obs2: Observation = {
      id: "obs-2026-03-27-002",
      entryId: "entry-2",
      pattern: "Uses staccato rhythm for dramatic effect",
      evidence: "Bang. Done.",
      dimension: "sentence-rhythm",
      status: "pending",
      createdAt: FIXED_TIME,
      updatedAt: FIXED_TIME,
    };

    const onIntentional = async (pattern: string, dimension: string) => {
      await profileStore.addOrMergeRule(pattern, dimension as ObservationDimension);
    };

    // Simulate two intentional classifications
    await onIntentional(obs1.pattern, obs1.dimension);
    await onIntentional(obs2.pattern, obs2.dimension);

    const profile = await profileStore.get();
    // Should merge because "Uses staccato rhythm for emphasis" contains "Uses staccato rhythm"
    expect(profile.rules).toHaveLength(1);
    expect(profile.rules[0].sourceCount).toBe(2);
    expect(profile.rules[0].sourceSummary).toBe("Confirmed across 2 entries");
  });
});
