import { createHash } from "node:crypto";
import { describe, expect, test } from "bun:test";
import type { SavedNudge } from "@ink-mirror/shared";
import { createNudgeRoutes } from "../../src/routes/nudge.js";
import { createSessionRunner } from "../../src/session-runner.js";
import { computeEntryMetrics } from "../../src/metrics/index.js";
import type { NudgeDeps } from "../../src/routes/nudge.js";
import type { NudgeStore } from "../../src/nudge-store.js";

// --- Fixtures ---

const SAMPLE_TEXT =
  "The project was started in January. The requirements were gathered over two weeks. I think it might possibly work.";

const ALT_TEXT =
  "We shipped the feature on Friday. The team celebrated afterward. Everyone agreed it went smoothly.";

const VALID_NUDGE_JSON = JSON.stringify({
  nudges: [
    {
      craftPrinciple: "passive-voice-clustering",
      evidence: "The project was started in January.",
      observation: "Passive construction removes the actor.",
      question: "Was the passive voice here intentional?",
    },
    {
      craftPrinciple: "hedging-accumulation",
      evidence: "I think it might possibly work",
      observation: "Three hedging markers in one sentence.",
      question: "Were you signaling genuine uncertainty?",
    },
  ],
});

const FIXED_NOW = "2026-04-22T16:00:00.000Z";

function sha(text: string): string {
  return "sha256:" + createHash("sha256").update(text).digest("hex");
}

interface MemoryStore extends NudgeStore {
  records: Map<string, SavedNudge>;
  saveCalls: number;
  getCalls: number;
  saveShouldThrow: boolean;
}

function memoryStore(): MemoryStore {
  const records = new Map<string, SavedNudge>();
  const self: MemoryStore = {
    records,
    saveCalls: 0,
    getCalls: 0,
    saveShouldThrow: false,
    async get(entryId) {
      self.getCalls++;
      return records.get(entryId);
    },
    async save(entryId, record) {
      self.saveCalls++;
      if (self.saveShouldThrow) throw new Error("disk full");
      records.set(entryId, record);
    },
  };
  return self;
}

interface SpySessionRunner {
  runner: ReturnType<typeof createSessionRunner>;
  calls: number;
}

function spySessionRunner(content: string = VALID_NUDGE_JSON): SpySessionRunner {
  const spy: SpySessionRunner = {
    calls: 0,
    runner: createSessionRunner({
      queryFn: async () => {
        spy.calls++;
        return { content };
      },
    }),
  };
  return spy;
}

function makeDeps(overrides: Partial<NudgeDeps> = {}): NudgeDeps {
  return {
    sessionRunner: createSessionRunner({
      queryFn: async () => ({ content: VALID_NUDGE_JSON }),
    }),
    computeMetrics: computeEntryMetrics,
    readEntry: async () => undefined,
    nudgeStore: memoryStore(),
    now: () => FIXED_NOW,
    ...overrides,
  };
}

function makeApp(overrides: Partial<NudgeDeps> = {}) {
  return createNudgeRoutes(makeDeps(overrides)).routes;
}

function post(app: ReturnType<typeof makeApp>, body: unknown) {
  return app.request("/nudge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// --- Basic request-handling tests (preserved from pre-persistence) ---

describe("POST /nudge basic handling", () => {
  test("with text: returns 200 with nudges and metrics", async () => {
    const app = makeApp();
    const res = await post(app, { text: SAMPLE_TEXT });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.nudges).toHaveLength(2);
    expect(json.nudges[0].craftPrinciple).toBe("passive-voice-clustering");
    expect(typeof json.metrics.passiveRatio).toBe("number");
  });

  test("with neither field: returns 400", async () => {
    const app = makeApp();
    const res = await post(app, {});
    expect(res.status).toBe(400);
  });

  test("with both fields: uses text, ignores entry resolution", async () => {
    let entryResolverCalled = false;
    const app = makeApp({
      readEntry: async () => {
        entryResolverCalled = true;
        return "Should not use this";
      },
    });

    const res = await post(app, { entryId: "entry-001", text: SAMPLE_TEXT });
    expect(res.status).toBe(200);
    expect(entryResolverCalled).toBe(false);
  });

  test("with context: context appears in LLM call", async () => {
    let capturedMessage = "";
    const app = makeApp({
      sessionRunner: createSessionRunner({
        queryFn: async (req) => {
          capturedMessage = req.messages[0].content;
          return { content: VALID_NUDGE_JSON };
        },
      }),
    });

    const res = await post(app, {
      text: SAMPLE_TEXT,
      context: "formal report for stakeholders",
    });

    expect(res.status).toBe(200);
    expect(capturedMessage).toContain("formal report for stakeholders");
  });

  test("with profile available: profile included in prompt", async () => {
    let capturedMessage = "";
    const app = makeApp({
      sessionRunner: createSessionRunner({
        queryFn: async (req) => {
          capturedMessage = req.messages[0].content;
          return { content: VALID_NUDGE_JSON };
        },
      }),
      readStyleProfile: async () => "Prefers passive voice in reflective sections.",
    });

    const res = await post(app, { text: SAMPLE_TEXT });
    expect(res.status).toBe(200);
    expect(capturedMessage).toContain("Writer's Style Profile");
  });

  test("invalid JSON body: returns 400", async () => {
    const app = makeApp();
    const res = await app.request("/nudge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
  });
});

// --- REQ-CNP persistence test plan (14 cases) ---

describe("POST /nudge persistence", () => {
  // Case 1: First call on an entry → fresh, sessionRunner called, save called, contentHash present.
  test("1: first call on entry -> fresh, sessionRunner called, store.save called with expected record", async () => {
    const store = memoryStore();
    const spy = spySessionRunner();
    const app = makeApp({
      sessionRunner: spy.runner,
      readEntry: async (id) => (id === "entry-001" ? SAMPLE_TEXT : undefined),
      nudgeStore: store,
    });

    const res = await post(app, { entryId: "entry-001" });
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.source).toBe("fresh");
    expect(json.contentHash).toBe(sha(SAMPLE_TEXT));
    expect(json.generatedAt).toBe(FIXED_NOW);
    expect(json.stale).toBeUndefined();
    expect(spy.calls).toBe(1);
    expect(store.saveCalls).toBe(1);

    const saved = store.records.get("entry-001");
    expect(saved).toBeDefined();
    expect(saved!.entryId).toBe("entry-001");
    expect(saved!.contentHash).toBe(sha(SAMPLE_TEXT));
    expect(saved!.context).toBe("");
    expect(saved!.generatedAt).toBe(FIXED_NOW);
    expect(saved!.nudges).toHaveLength(2);
  });

  // Case 2: Second call, unchanged body/context → cache, no LLM, no stale.
  test("2: second call with unchanged body and context -> cache, no LLM, no stale", async () => {
    const store = memoryStore();
    store.records.set("entry-001", {
      entryId: "entry-001",
      contentHash: sha(SAMPLE_TEXT),
      context: "",
      generatedAt: "2026-04-21T10:00:00.000Z",
      metrics: {
        passiveRatio: 0.1,
        totalSentences: 3,
        hedgingWordCount: 1,
        rhythmVariance: 4.5,
      },
      nudges: [
        {
          craftPrinciple: "passive-voice-clustering",
          evidence: "x",
          observation: "y",
          question: "z?",
        },
      ],
    });
    const spy = spySessionRunner();
    const app = makeApp({
      sessionRunner: spy.runner,
      readEntry: async () => SAMPLE_TEXT,
      nudgeStore: store,
    });

    const res = await post(app, { entryId: "entry-001" });
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.source).toBe("cache");
    expect(json.stale).toBeUndefined();
    expect(json.generatedAt).toBe("2026-04-21T10:00:00.000Z");
    expect(json.contentHash).toBe(sha(SAMPLE_TEXT));
    expect(spy.calls).toBe(0);
    expect(store.saveCalls).toBe(0);
  });

  // Case 3: Second call, changed body → cache + stale, no LLM, record unchanged.
  test("3: second call with changed body -> cache + stale, saved record unchanged", async () => {
    const savedGeneratedAt = "2026-04-21T10:00:00.000Z";
    const store = memoryStore();
    const originalRecord: SavedNudge = {
      entryId: "entry-001",
      contentHash: sha(SAMPLE_TEXT),
      context: "",
      generatedAt: savedGeneratedAt,
      metrics: {
        passiveRatio: 0.1,
        totalSentences: 3,
        hedgingWordCount: 1,
        rhythmVariance: 4.5,
      },
      nudges: [
        {
          craftPrinciple: "sentence-monotony",
          evidence: "a",
          observation: "b",
          question: "c?",
        },
      ],
    };
    store.records.set("entry-001", originalRecord);
    const spy = spySessionRunner();
    const app = makeApp({
      sessionRunner: spy.runner,
      readEntry: async () => ALT_TEXT,
      nudgeStore: store,
    });

    const res = await post(app, { entryId: "entry-001" });
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.source).toBe("cache");
    expect(json.stale).toBe(true);
    expect(json.contentHash).toBe(sha(SAMPLE_TEXT));
    expect(json.generatedAt).toBe(savedGeneratedAt);
    expect(spy.calls).toBe(0);
    expect(store.saveCalls).toBe(0);
    expect(store.records.get("entry-001")).toEqual(originalRecord);
  });

  // Case 4: Second call, same body, different context → cache + stale, no LLM.
  test("4: second call with different context -> cache + stale, no LLM", async () => {
    const store = memoryStore();
    store.records.set("entry-001", {
      entryId: "entry-001",
      contentHash: sha(SAMPLE_TEXT),
      context: "formal",
      generatedAt: "2026-04-21T10:00:00.000Z",
      metrics: {
        passiveRatio: 0.1,
        totalSentences: 3,
        hedgingWordCount: 1,
        rhythmVariance: 4.5,
      },
      nudges: [
        {
          craftPrinciple: "buried-lead",
          evidence: "a",
          observation: "b",
          question: "c?",
        },
      ],
    });
    const spy = spySessionRunner();
    const app = makeApp({
      sessionRunner: spy.runner,
      readEntry: async () => SAMPLE_TEXT,
      nudgeStore: store,
    });

    const res = await post(app, { entryId: "entry-001", context: "casual" });
    const json = await res.json();

    expect(json.source).toBe("cache");
    expect(json.stale).toBe(true);
    expect(spy.calls).toBe(0);
  });

  // Case 5: Empty-context normalization (saved "" vs request undefined, and saved "" vs request "").
  test("5: saved empty context matches omitted request context (no phantom stale)", async () => {
    const store = memoryStore();
    store.records.set("entry-001", {
      entryId: "entry-001",
      contentHash: sha(SAMPLE_TEXT),
      context: "",
      generatedAt: "2026-04-21T10:00:00.000Z",
      metrics: {
        passiveRatio: 0.1,
        totalSentences: 3,
        hedgingWordCount: 1,
        rhythmVariance: 4.5,
      },
      nudges: [
        {
          craftPrinciple: "curse-of-knowledge",
          evidence: "a",
          observation: "b",
          question: "c?",
        },
      ],
    });
    const spy = spySessionRunner();
    const app = makeApp({
      sessionRunner: spy.runner,
      readEntry: async () => SAMPLE_TEXT,
      nudgeStore: store,
    });

    // Request omits context entirely; saved record has "" -> normalized match.
    const res = await post(app, { entryId: "entry-001" });
    const json = await res.json();

    expect(json.source).toBe("cache");
    expect(json.stale).toBeUndefined();
    expect(spy.calls).toBe(0);

    // And: saved "" vs request with non-empty context -> stale.
    const res2 = await post(app, { entryId: "entry-001", context: "formal" });
    const json2 = await res2.json();
    expect(json2.source).toBe("cache");
    expect(json2.stale).toBe(true);
  });

  // Case 6: Third call with refresh:true → fresh, record overwritten.
  test("6: refresh:true -> fresh, sessionRunner called, record overwritten", async () => {
    const oldHash = sha("OLD");
    const store = memoryStore();
    store.records.set("entry-001", {
      entryId: "entry-001",
      contentHash: oldHash,
      context: "",
      generatedAt: "2026-04-20T00:00:00.000Z",
      metrics: {
        passiveRatio: 0,
        totalSentences: 1,
        hedgingWordCount: 0,
        rhythmVariance: 0,
      },
      nudges: [
        {
          craftPrinciple: "dangling-modifier",
          evidence: "old",
          observation: "old",
          question: "old?",
        },
      ],
    });
    const spy = spySessionRunner();
    const app = makeApp({
      sessionRunner: spy.runner,
      readEntry: async () => SAMPLE_TEXT,
      nudgeStore: store,
    });

    const res = await post(app, { entryId: "entry-001", refresh: true });
    const json = await res.json();

    expect(json.source).toBe("fresh");
    expect(json.contentHash).toBe(sha(SAMPLE_TEXT));
    expect(json.generatedAt).toBe(FIXED_NOW);
    expect(spy.calls).toBe(1);
    expect(store.saveCalls).toBe(1);

    const saved = store.records.get("entry-001")!;
    expect(saved.contentHash).toBe(sha(SAMPLE_TEXT));
    expect(saved.generatedAt).toBe(FIXED_NOW);
    expect(saved.nudges[0].craftPrinciple).toBe("passive-voice-clustering");
  });

  // Case 6b: refresh:true bypasses cache even when saved record's hash matches the current body.
  // Guards the primary "Regenerate" gesture: user wants a new nudge from unchanged text.
  test("6b: refresh:true with hash-matching saved record -> fresh, overwrites, bypasses cache", async () => {
    const savedGeneratedAt = "2026-04-20T00:00:00.000Z";
    const store = memoryStore();
    store.records.set("entry-001", {
      entryId: "entry-001",
      contentHash: sha(SAMPLE_TEXT),
      context: "",
      generatedAt: savedGeneratedAt,
      metrics: {
        passiveRatio: 0,
        totalSentences: 1,
        hedgingWordCount: 0,
        rhythmVariance: 0,
      },
      nudges: [
        {
          craftPrinciple: "dangling-modifier",
          evidence: "old",
          observation: "old",
          question: "old?",
        },
      ],
    });
    const spy = spySessionRunner();
    const app = makeApp({
      sessionRunner: spy.runner,
      readEntry: async () => SAMPLE_TEXT,
      nudgeStore: store,
    });

    const res = await post(app, { entryId: "entry-001", refresh: true });
    const json = await res.json();

    expect(json.source).toBe("fresh");
    expect(json.stale).toBeUndefined();
    expect(json.contentHash).toBe(sha(SAMPLE_TEXT));
    expect(json.generatedAt).toBe(FIXED_NOW);
    expect(spy.calls).toBe(1);
    expect(store.saveCalls).toBe(1);
    expect(store.getCalls).toBe(0);

    const saved = store.records.get("entry-001")!;
    expect(saved.generatedAt).toBe(FIXED_NOW);
    expect(saved.generatedAt).not.toBe(savedGeneratedAt);
    expect(saved.nudges[0].craftPrinciple).toBe("passive-voice-clustering");
  });

  // Case 7: Direct text (no entryId) → fresh, no contentHash, store untouched.
  test("7: direct text -> fresh, no contentHash, store.get/save untouched", async () => {
    const store = memoryStore();
    const spy = spySessionRunner();
    const app = makeApp({
      sessionRunner: spy.runner,
      nudgeStore: store,
    });

    const res = await post(app, { text: SAMPLE_TEXT });
    const json = await res.json();

    expect(json.source).toBe("fresh");
    expect(json.contentHash).toBeUndefined();
    expect(json.stale).toBeUndefined();
    expect(json.generatedAt).toBe(FIXED_NOW);
    expect(store.getCalls).toBe(0);
    expect(store.saveCalls).toBe(0);
    expect(spy.calls).toBe(1);
  });

  // Case 8: Direct text with refresh:true → fresh, no store side effect, no error.
  test("8: direct text with refresh:true -> fresh, no store side effect, no error", async () => {
    const store = memoryStore();
    const spy = spySessionRunner();
    const app = makeApp({
      sessionRunner: spy.runner,
      nudgeStore: store,
    });

    const res = await post(app, { text: SAMPLE_TEXT, refresh: true });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.source).toBe("fresh");
    expect(json.error).toBeUndefined();
    expect(json.contentHash).toBeUndefined();
    expect(store.getCalls).toBe(0);
    expect(store.saveCalls).toBe(0);
  });

  // Case 9: LLM parse failure on entry-scoped path → error present, save NOT called, next call retries.
  test("9: parse failure on entry-scoped path -> error, no persist, next call retries fresh", async () => {
    const store = memoryStore();
    let calls = 0;
    const runner = createSessionRunner({
      queryFn: async () => {
        calls++;
        return { content: "Sorry, I can't do that." };
      },
    });
    const app = makeApp({
      sessionRunner: runner,
      readEntry: async () => SAMPLE_TEXT,
      nudgeStore: store,
    });

    const res = await post(app, { entryId: "entry-001" });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.source).toBe("fresh");
    expect(json.error).toContain("Invalid JSON");
    expect(json.nudges).toHaveLength(0);
    expect(json.contentHash).toBe(sha(SAMPLE_TEXT));
    expect(store.saveCalls).toBe(0);
    expect(store.records.has("entry-001")).toBe(false);

    // Next call with unchanged text runs fresh again (no stale cache of the bad result).
    const res2 = await post(app, { entryId: "entry-001" });
    const json2 = await res2.json();
    expect(json2.source).toBe("fresh");
    expect(calls).toBe(2);
  });

  // Case 10: Invalid entry ID format → 400, store untouched.
  test("10: invalid entry ID format -> 400, store untouched", async () => {
    const store = memoryStore();
    const spy = spySessionRunner();
    const app = makeApp({
      sessionRunner: spy.runner,
      readEntry: async () => SAMPLE_TEXT,
      nudgeStore: store,
    });

    const res = await post(app, { entryId: "../etc/passwd" });
    expect(res.status).toBe(400);
    expect(store.getCalls).toBe(0);
    expect(store.saveCalls).toBe(0);
    expect(spy.calls).toBe(0);
  });

  // Case 11: Entry not found → 404, store untouched.
  test("11: entry not found -> 404, store untouched", async () => {
    const store = memoryStore();
    const spy = spySessionRunner();
    const app = makeApp({
      sessionRunner: spy.runner,
      readEntry: async () => undefined,
      nudgeStore: store,
    });

    const res = await post(app, { entryId: "entry-missing" });
    expect(res.status).toBe(404);
    expect(store.getCalls).toBe(0);
    expect(store.saveCalls).toBe(0);
    expect(spy.calls).toBe(0);
  });

  // Case 12: Store save throws on entry-scoped fresh path → request still 200 with fresh payload.
  test("12: store.save throws on entry-scoped fresh -> 200 with source:fresh and nudges", async () => {
    const store = memoryStore();
    store.saveShouldThrow = true;
    const spy = spySessionRunner();
    const app = makeApp({
      sessionRunner: spy.runner,
      readEntry: async () => SAMPLE_TEXT,
      nudgeStore: store,
    });

    const res = await post(app, { entryId: "entry-001" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.source).toBe("fresh");
    expect(json.nudges).toHaveLength(2);
    expect(json.contentHash).toBe(sha(SAMPLE_TEXT));
    expect(json.error).toBeUndefined();
  });

  // Case 13: Store save throws cannot trigger on direct-text path; assert save not called.
  test("13: direct-text path never calls store.save even when save would throw", async () => {
    const store = memoryStore();
    store.saveShouldThrow = true;
    const spy = spySessionRunner();
    const app = makeApp({
      sessionRunner: spy.runner,
      nudgeStore: store,
    });

    const res = await post(app, { text: SAMPLE_TEXT });
    expect(res.status).toBe(200);
    expect(store.saveCalls).toBe(0);
  });

  // Case 14: Hash determinism -- SHA-256 of the same string is stable.
  test("14: hash determinism: SHA-256 of same text is stable across calls", () => {
    expect(sha(SAMPLE_TEXT)).toBe(sha(SAMPLE_TEXT));
    expect(sha(SAMPLE_TEXT)).not.toBe(sha(ALT_TEXT));
    expect(sha(SAMPLE_TEXT)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

// --- Operation metadata ---

describe("nudge route operations", () => {
  test("registers operation with correct hierarchy", () => {
    const module = createNudgeRoutes(makeDeps());
    expect(module.operations).toHaveLength(1);
    expect(module.operations[0].operationId).toBe("nudge.analyze");
    expect(module.operations[0].hierarchy).toEqual({
      root: "nudge",
      feature: "analyze",
    });
  });

  test("exposes refresh parameter as boolean", () => {
    const module = createNudgeRoutes(makeDeps());
    const params = module.operations[0].parameters ?? [];
    const refresh = params.find((p) => p.name === "refresh");
    expect(refresh).toBeDefined();
    expect(refresh?.type).toBe("boolean");
    expect(refresh?.required).toBe(false);
  });
});
