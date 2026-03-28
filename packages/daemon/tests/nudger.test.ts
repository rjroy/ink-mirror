import { describe, expect, test } from "bun:test";
import {
  buildNudgeSystemPrompt,
  buildNudgeUserMessage,
  parseNudgeOutput,
  nudge,
} from "../src/nudger.js";
import { createSessionRunner } from "../src/session-runner.js";
import { computeEntryMetrics } from "../src/metrics/index.js";

// --- Test fixtures ---

const SAMPLE_TEXT =
  "The project was started in January. The requirements were gathered over two weeks. The design was approved by the committee. Implementation was begun immediately. I think it might possibly be somewhat relevant to perhaps consider whether this approach could potentially work. The situation involved a number of challenges that impacted various stakeholders across multiple domains.";

const VALID_NUDGE_JSON = JSON.stringify({
  nudges: [
    {
      craftPrinciple: "passive-voice-clustering",
      evidence: "The project was started in January. The requirements were gathered over two weeks.",
      observation: "Four consecutive passive sentences remove the actors from the narrative.",
      question: "The passive voice here reads as institutional report register. Was that your intent, or did specific people start the project and gather requirements?",
    },
    {
      craftPrinciple: "hedging-accumulation",
      evidence: "I think it might possibly be somewhat relevant to perhaps consider whether this approach could potentially work",
      observation: "Seven hedging markers in a single sentence.",
      question: "This sentence carries a lot of qualifiers. Were you signaling genuine uncertainty, or did the hedges accumulate without intent?",
    },
  ],
});

// --- System prompt tests ---

describe("buildNudgeSystemPrompt", () => {
  const prompt = buildNudgeSystemPrompt();

  test("includes all twelve principle IDs", () => {
    const principles = [
      "passive-voice-clustering",
      "sentence-monotony",
      "hedging-accumulation",
      "nominalization-density",
      "unnecessary-words",
      "concrete-over-abstract",
      "buried-lead",
      "old-before-new",
      "unclear-antecedent",
      "curse-of-knowledge",
      "dangling-modifier",
      "characters-as-subjects",
    ];
    for (const p of principles) {
      expect(prompt).toContain(p);
    }
  });

  test("includes non-prescription constraints", () => {
    expect(prompt).toContain("never correct");
    expect(prompt).toContain("never answer the questions");
    expect(prompt).toContain("No imperative verbs");
    expect(prompt).toContain('"consider,"');
    expect(prompt).toContain('"rewrite,"');
  });

  test("includes output format section with JSON structure", () => {
    expect(prompt).toContain('"craftPrinciple"');
    expect(prompt).toContain('"evidence"');
    expect(prompt).toContain('"observation"');
    expect(prompt).toContain('"question"');
    expect(prompt).toContain('"nudges"');
  });

  test("includes legitimate-use guidance for each principle", () => {
    expect(prompt).toContain("Legitimate when:");
  });

  test("includes selection rules", () => {
    expect(prompt).toContain("3-5 nudges");
    expect(prompt).toContain("different craft principle");
    expect(prompt).toContain("Short texts");
  });

  test("includes context description section", () => {
    expect(prompt).toContain("Context You Receive");
    expect(prompt).toContain("Pre-computed metrics");
    expect(prompt).toContain("Style Profile");
    expect(prompt).toContain("Text to Analyze");
  });

  test("stays under ~2,500 tokens (approx char/4 regression check)", () => {
    const estimatedTokens = prompt.length / 4;
    expect(estimatedTokens).toBeLessThan(2500);
  });
});

// --- User message tests ---

describe("buildNudgeUserMessage", () => {
  test("places text last (REQ-CN-33)", () => {
    const metrics = computeEntryMetrics(SAMPLE_TEXT);
    const message = buildNudgeUserMessage(SAMPLE_TEXT, metrics, "");

    const metricsPos = message.indexOf("## Pre-computed Metrics");
    const textPos = message.indexOf("## Text to Analyze");

    expect(metricsPos).toBeGreaterThan(-1);
    expect(textPos).toBeGreaterThan(metricsPos);
    expect(message.endsWith(SAMPLE_TEXT)).toBe(true);
  });

  test("section ordering: metrics, profile, context, text", () => {
    const metrics = computeEntryMetrics(SAMPLE_TEXT);
    const message = buildNudgeUserMessage(
      SAMPLE_TEXT,
      metrics,
      "Uses short sentences.",
      "Blog post for a technical audience",
    );

    const metricsPos = message.indexOf("## Pre-computed Metrics");
    const profilePos = message.indexOf("## Writer's Style Profile");
    const contextPos = message.indexOf("## Writer's Context");
    const textPos = message.indexOf("## Text to Analyze");

    expect(metricsPos).toBeLessThan(profilePos);
    expect(profilePos).toBeLessThan(contextPos);
    expect(contextPos).toBeLessThan(textPos);
  });

  test("includes per-sentence passive annotations when passive sentences exist", () => {
    const metrics = computeEntryMetrics(SAMPLE_TEXT);
    const message = buildNudgeUserMessage(SAMPLE_TEXT, metrics, "");

    expect(message).toContain("### Passive Voice Sentences");
    expect(message).toContain("Sentence ");
  });

  test("omits passive annotations section when no passive sentences", () => {
    const activeText = "I wrote the report. The team finished the project. We celebrated afterward.";
    const metrics = computeEntryMetrics(activeText);
    const message = buildNudgeUserMessage(activeText, metrics, "");

    expect(message).not.toContain("### Passive Voice Sentences");
  });

  test("omits profile section when no profile provided", () => {
    const metrics = computeEntryMetrics(SAMPLE_TEXT);
    const message = buildNudgeUserMessage(SAMPLE_TEXT, metrics, "");

    expect(message).not.toContain("## Writer's Style Profile");
  });

  test("omits context section when no context provided", () => {
    const metrics = computeEntryMetrics(SAMPLE_TEXT);
    const message = buildNudgeUserMessage(SAMPLE_TEXT, metrics, "");

    expect(message).not.toContain("## Writer's Context");
  });

  test("includes context when provided", () => {
    const metrics = computeEntryMetrics(SAMPLE_TEXT);
    const message = buildNudgeUserMessage(SAMPLE_TEXT, metrics, "", "formal report");

    expect(message).toContain("## Writer's Context");
    expect(message).toContain("formal report");
  });

  test("includes rhythm metrics", () => {
    const metrics = computeEntryMetrics(SAMPLE_TEXT);
    const message = buildNudgeUserMessage(SAMPLE_TEXT, metrics, "");

    expect(message).toContain("### Sentence Rhythm");
    expect(message).toContain("Variance:");
    expect(message).toContain("Length sequence");
  });
});

// --- Output parsing tests ---

describe("parseNudgeOutput", () => {
  test("parses valid JSON output", () => {
    const result = parseNudgeOutput(VALID_NUDGE_JSON);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0].craftPrinciple).toBe("passive-voice-clustering");
    }
  });

  test("strips markdown code fences", () => {
    const fenced = "```json\n" + VALID_NUDGE_JSON + "\n```";
    const result = parseNudgeOutput(fenced);
    expect(result.success).toBe(true);
  });

  test("rejects invalid JSON", () => {
    const result = parseNudgeOutput("not json at all");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Invalid JSON");
    }
  });

  test("rejects invalid craftPrinciple value", () => {
    const bad = JSON.stringify({
      nudges: [{
        craftPrinciple: "not-a-real-principle",
        evidence: "text",
        observation: "obs",
        question: "q?",
      }],
    });
    const result = parseNudgeOutput(bad);
    expect(result.success).toBe(false);
  });

  test("accepts empty nudges array (short text case)", () => {
    const result = parseNudgeOutput(JSON.stringify({ nudges: [] }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(0);
    }
  });

  test("rejects more than 5 nudges", () => {
    const makeNudge = (p: string) => ({
      craftPrinciple: p,
      evidence: "text",
      observation: "obs",
      question: "q?",
    });
    const result = parseNudgeOutput(JSON.stringify({
      nudges: [
        makeNudge("buried-lead"),
        makeNudge("passive-voice-clustering"),
        makeNudge("hedging-accumulation"),
        makeNudge("sentence-monotony"),
        makeNudge("unclear-antecedent"),
        makeNudge("dangling-modifier"),
      ],
    }));
    expect(result.success).toBe(false);
  });
});

// --- Full nudge pipeline test ---

describe("nudge (pipeline)", () => {
  test("computes metrics, calls LLM, returns response with metrics summary", async () => {
    let capturedSystem = "";
    let capturedMessage = "";

    const sessionRunner = createSessionRunner({
      queryFn: async (req) => {
        capturedSystem = req.system;
        capturedMessage = req.messages[0].content;
        return { content: VALID_NUDGE_JSON };
      },
    });

    const result = await nudge(
      {
        sessionRunner,
        computeMetrics: computeEntryMetrics,
      },
      SAMPLE_TEXT,
    );

    // Nudges returned
    expect(result.nudges).toHaveLength(2);
    expect(result.nudges[0].craftPrinciple).toBe("passive-voice-clustering");

    // Metrics summary derived from EntryMetrics
    expect(result.metrics.totalSentences).toBeGreaterThan(0);
    expect(typeof result.metrics.passiveRatio).toBe("number");
    expect(typeof result.metrics.hedgingWordCount).toBe("number");
    expect(typeof result.metrics.rhythmVariance).toBe("number");

    // No error
    expect(result.error).toBeUndefined();

    // Verify prompt was assembled
    expect(capturedSystem).toContain("craft pattern analyst");
    expect(capturedMessage).toContain("## Text to Analyze");
    expect(capturedMessage).toContain(SAMPLE_TEXT);
  });

  test("returns error on parse failure without throwing", async () => {
    const sessionRunner = createSessionRunner({
      queryFn: async () => ({ content: "I cannot help with that." }),
    });

    const result = await nudge(
      {
        sessionRunner,
        computeMetrics: computeEntryMetrics,
      },
      SAMPLE_TEXT,
    );

    expect(result.nudges).toHaveLength(0);
    expect(result.error).toContain("Invalid JSON");
    expect(result.metrics.totalSentences).toBeGreaterThan(0);
  });

  test("includes style profile when provided", async () => {
    let capturedMessage = "";
    const sessionRunner = createSessionRunner({
      queryFn: async (req) => {
        capturedMessage = req.messages[0].content;
        return { content: VALID_NUDGE_JSON };
      },
    });

    await nudge(
      {
        sessionRunner,
        computeMetrics: computeEntryMetrics,
        readStyleProfile: async () => "Uses passive voice deliberately for distance.",
      },
      SAMPLE_TEXT,
    );

    expect(capturedMessage).toContain("## Writer's Style Profile");
    expect(capturedMessage).toContain("Uses passive voice deliberately for distance.");
  });

  test("survives readStyleProfile failure without throwing", async () => {
    const sessionRunner = createSessionRunner({
      queryFn: async () => ({ content: VALID_NUDGE_JSON }),
    });

    const result = await nudge(
      {
        sessionRunner,
        computeMetrics: computeEntryMetrics,
        readStyleProfile: async () => { throw new Error("disk on fire"); },
      },
      SAMPLE_TEXT,
    );

    // Should succeed with nudges, not propagate the error
    expect(result.nudges).toHaveLength(2);
    expect(result.error).toBeUndefined();
  });

  test("passes context through to user message", async () => {
    let capturedMessage = "";
    const sessionRunner = createSessionRunner({
      queryFn: async (req) => {
        capturedMessage = req.messages[0].content;
        return { content: VALID_NUDGE_JSON };
      },
    });

    await nudge(
      {
        sessionRunner,
        computeMetrics: computeEntryMetrics,
      },
      SAMPLE_TEXT,
      "formal report for stakeholders",
    );

    expect(capturedMessage).toContain("## Writer's Context");
    expect(capturedMessage).toContain("formal report for stakeholders");
  });
});
