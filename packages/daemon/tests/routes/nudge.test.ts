import { describe, expect, test } from "bun:test";
import { createNudgeRoutes } from "../../src/routes/nudge.js";
import { createSessionRunner } from "../../src/session-runner.js";
import { computeEntryMetrics } from "../../src/metrics/index.js";
import type { NudgeDeps } from "../../src/routes/nudge.js";

// --- Fixtures ---

const SAMPLE_TEXT =
  "The project was started in January. The requirements were gathered over two weeks. I think it might possibly work.";

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

function makeDeps(overrides: Partial<NudgeDeps> = {}): NudgeDeps {
  return {
    sessionRunner: createSessionRunner({
      queryFn: async () => ({ content: VALID_NUDGE_JSON }),
    }),
    computeMetrics: computeEntryMetrics,
    readEntry: async () => undefined,
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

// --- Tests ---

describe("POST /nudge", () => {
  test("with text: returns 200 with nudges and metrics", async () => {
    const app = makeApp();
    const res = await post(app, { text: SAMPLE_TEXT });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.nudges).toHaveLength(2);
    expect(json.nudges[0].craftPrinciple).toBe("passive-voice-clustering");
    expect(typeof json.metrics.passiveRatio).toBe("number");
    expect(typeof json.metrics.totalSentences).toBe("number");
    expect(typeof json.metrics.hedgingWordCount).toBe("number");
    expect(typeof json.metrics.rhythmVariance).toBe("number");
  });

  test("with entryId: resolves entry text and returns nudges", async () => {
    const app = makeApp({
      readEntry: async (id) =>
        id === "entry-001" ? SAMPLE_TEXT : undefined,
    });
    const res = await post(app, { entryId: "entry-001" });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.nudges).toHaveLength(2);
  });

  test("with entryId not found: returns 404", async () => {
    const app = makeApp({
      readEntry: async () => undefined,
    });
    const res = await post(app, { entryId: "entry-nonexistent" });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toContain("not found");
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
    expect(capturedMessage).toContain("Prefers passive voice in reflective sections.");
  });

  test("without profile: works fine, no profile section", async () => {
    let capturedMessage = "";
    const app = makeApp({
      sessionRunner: createSessionRunner({
        queryFn: async (req) => {
          capturedMessage = req.messages[0].content;
          return { content: VALID_NUDGE_JSON };
        },
      }),
    });

    const res = await post(app, { text: SAMPLE_TEXT });

    expect(res.status).toBe(200);
    expect(capturedMessage).not.toContain("Writer's Style Profile");
  });

  test("parse failure from LLM: returns 200 with empty nudges and error", async () => {
    const app = makeApp({
      sessionRunner: createSessionRunner({
        queryFn: async () => ({ content: "Sorry, I can't do that." }),
      }),
    });

    const res = await post(app, { text: SAMPLE_TEXT });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.nudges).toHaveLength(0);
    expect(json.error).toContain("Invalid JSON");
    expect(typeof json.metrics.passiveRatio).toBe("number");
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

describe("nudge route operations", () => {
  test("registers operation with correct hierarchy", () => {
    const module = createNudgeRoutes(makeDeps());

    expect(module.operations).toHaveLength(1);
    expect(module.operations[0].operationId).toBe("nudge.analyze");
    expect(module.operations[0].hierarchy).toEqual({
      root: "nudge",
      feature: "analyze",
    });
    expect(module.operations[0].invocation).toEqual({
      method: "POST",
      path: "/nudge",
    });
  });
});
