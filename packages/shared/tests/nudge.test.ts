import { describe, expect, test } from "bun:test";
import {
  CraftPrincipleSchema,
  CraftNudgeSchema,
  NudgeOutputSchema,
  NudgeRequestSchema,
  NudgeResponseSchema,
  SavedNudgeSchema,
} from "../src/nudge.js";

describe("CraftPrincipleSchema", () => {
  test("accepts all twelve principle identifiers", () => {
    const principles = [
      "characters-as-subjects",
      "nominalization-density",
      "passive-voice-clustering",
      "unnecessary-words",
      "concrete-over-abstract",
      "sentence-monotony",
      "buried-lead",
      "old-before-new",
      "hedging-accumulation",
      "unclear-antecedent",
      "curse-of-knowledge",
      "dangling-modifier",
    ] as const;
    for (const p of principles) {
      expect(CraftPrincipleSchema.parse(p)).toBe(p);
    }
  });

  test("rejects invalid principle", () => {
    expect(() => CraftPrincipleSchema.parse("grammar-error")).toThrow();
    expect(() => CraftPrincipleSchema.parse("")).toThrow();
  });
});

describe("CraftNudgeSchema", () => {
  test("accepts valid nudge with all four fields", () => {
    const result = CraftNudgeSchema.safeParse({
      craftPrinciple: "passive-voice-clustering",
      evidence: "The report was written. The data was analyzed.",
      observation: "Two consecutive passive sentences remove the actors.",
      question: "Did you intend to obscure who wrote the report and analyzed the data?",
    });
    expect(result.success).toBe(true);
  });

  test("rejects empty evidence", () => {
    const result = CraftNudgeSchema.safeParse({
      craftPrinciple: "passive-voice-clustering",
      evidence: "",
      observation: "Something",
      question: "Something?",
    });
    expect(result.success).toBe(false);
  });

  test("rejects empty observation", () => {
    const result = CraftNudgeSchema.safeParse({
      craftPrinciple: "buried-lead",
      evidence: "some text",
      observation: "",
      question: "Something?",
    });
    expect(result.success).toBe(false);
  });

  test("rejects empty question", () => {
    const result = CraftNudgeSchema.safeParse({
      craftPrinciple: "buried-lead",
      evidence: "some text",
      observation: "Something",
      question: "",
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid craft principle", () => {
    const result = CraftNudgeSchema.safeParse({
      craftPrinciple: "invalid-principle",
      evidence: "text",
      observation: "obs",
      question: "q?",
    });
    expect(result.success).toBe(false);
  });
});

describe("NudgeOutputSchema", () => {
  test("accepts 0 nudges (short text case)", () => {
    const result = NudgeOutputSchema.safeParse({ nudges: [] });
    expect(result.success).toBe(true);
  });

  test("accepts 1-5 nudges", () => {
    const makeNudge = (principle: string) => ({
      craftPrinciple: principle,
      evidence: "text",
      observation: "obs",
      question: "q?",
    });

    const one = NudgeOutputSchema.safeParse({
      nudges: [makeNudge("buried-lead")],
    });
    expect(one.success).toBe(true);

    const five = NudgeOutputSchema.safeParse({
      nudges: [
        makeNudge("buried-lead"),
        makeNudge("passive-voice-clustering"),
        makeNudge("hedging-accumulation"),
        makeNudge("sentence-monotony"),
        makeNudge("unclear-antecedent"),
      ],
    });
    expect(five.success).toBe(true);
  });

  test("rejects more than 5 nudges", () => {
    const makeNudge = (principle: string) => ({
      craftPrinciple: principle,
      evidence: "text",
      observation: "obs",
      question: "q?",
    });

    const result = NudgeOutputSchema.safeParse({
      nudges: [
        makeNudge("buried-lead"),
        makeNudge("passive-voice-clustering"),
        makeNudge("hedging-accumulation"),
        makeNudge("sentence-monotony"),
        makeNudge("unclear-antecedent"),
        makeNudge("dangling-modifier"),
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("NudgeRequestSchema", () => {
  test("accepts entryId only", () => {
    const result = NudgeRequestSchema.safeParse({ entryId: "entry-001" });
    expect(result.success).toBe(true);
  });

  test("accepts text only", () => {
    const result = NudgeRequestSchema.safeParse({ text: "Some writing." });
    expect(result.success).toBe(true);
  });

  test("accepts both entryId and text", () => {
    const result = NudgeRequestSchema.safeParse({
      entryId: "entry-001",
      text: "Some writing.",
    });
    expect(result.success).toBe(true);
  });

  test("accepts with optional context", () => {
    const result = NudgeRequestSchema.safeParse({
      text: "Some writing.",
      context: "Blog post for a technical audience",
    });
    expect(result.success).toBe(true);
  });

  test("rejects when neither entryId nor text provided", () => {
    const result = NudgeRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  test("rejects when only context provided", () => {
    const result = NudgeRequestSchema.safeParse({ context: "some context" });
    expect(result.success).toBe(false);
  });

  test("accepts refresh: true, refresh: false, and omitted refresh", () => {
    const refreshTrue = NudgeRequestSchema.safeParse({
      entryId: "entry-001",
      refresh: true,
    });
    expect(refreshTrue.success).toBe(true);

    const refreshFalse = NudgeRequestSchema.safeParse({
      entryId: "entry-001",
      refresh: false,
    });
    expect(refreshFalse.success).toBe(true);

    const refreshOmitted = NudgeRequestSchema.safeParse({
      entryId: "entry-001",
    });
    expect(refreshOmitted.success).toBe(true);
    if (refreshOmitted.success) {
      expect(refreshOmitted.data.refresh).toBeUndefined();
    }
  });
});

describe("NudgeResponseSchema", () => {
  test("accepts valid response with metrics", () => {
    const result = NudgeResponseSchema.safeParse({
      nudges: [],
      metrics: {
        passiveRatio: 0.25,
        totalSentences: 12,
        hedgingWordCount: 3,
        rhythmVariance: 45.2,
      },
      source: "fresh",
      generatedAt: "2026-04-22T16:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  test("accepts response with optional error field", () => {
    const result = NudgeResponseSchema.safeParse({
      nudges: [],
      metrics: {
        passiveRatio: 0,
        totalSentences: 0,
        hedgingWordCount: 0,
        rhythmVariance: 0,
      },
      source: "fresh",
      generatedAt: "2026-04-22T16:00:00.000Z",
      contentHash: "sha256:abc",
      error: "Failed to parse LLM output",
    });
    expect(result.success).toBe(true);
  });

  test("accepts response without error field", () => {
    const result = NudgeResponseSchema.safeParse({
      nudges: [],
      metrics: {
        passiveRatio: 0,
        totalSentences: 0,
        hedgingWordCount: 0,
        rhythmVariance: 0,
      },
      source: "fresh",
      generatedAt: "2026-04-22T16:00:00.000Z",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.error).toBeUndefined();
    }
  });

  test("accepts a cache response with stale and contentHash", () => {
    const result = NudgeResponseSchema.safeParse({
      nudges: [],
      metrics: {
        passiveRatio: 0.1,
        totalSentences: 5,
        hedgingWordCount: 1,
        rhythmVariance: 12.3,
      },
      source: "cache",
      stale: true,
      generatedAt: "2026-04-22T15:59:00.000Z",
      contentHash: "sha256:deadbeef",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source).toBe("cache");
      expect(result.data.stale).toBe(true);
      expect(result.data.contentHash).toBe("sha256:deadbeef");
    }
  });

  test("accepts a fresh response without stale or contentHash (direct-text case)", () => {
    const result = NudgeResponseSchema.safeParse({
      nudges: [],
      metrics: {
        passiveRatio: 0,
        totalSentences: 0,
        hedgingWordCount: 0,
        rhythmVariance: 0,
      },
      source: "fresh",
      generatedAt: "2026-04-22T16:00:00.000Z",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stale).toBeUndefined();
      expect(result.data.contentHash).toBeUndefined();
    }
  });

  test("rejects source outside the enum", () => {
    const result = NudgeResponseSchema.safeParse({
      nudges: [],
      metrics: {
        passiveRatio: 0,
        totalSentences: 0,
        hedgingWordCount: 0,
        rhythmVariance: 0,
      },
      source: "stale",
      generatedAt: "2026-04-22T16:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("SavedNudgeSchema", () => {
  test("round-trips a full record", () => {
    const record = {
      entryId: "entry-001",
      contentHash:
        "sha256:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      context: "Blog post for a technical audience",
      generatedAt: "2026-04-22T16:00:00.000Z",
      nudges: [
        {
          craftPrinciple: "passive-voice-clustering" as const,
          evidence: "The report was written.\nThe data was analyzed.",
          observation: "Two consecutive passive sentences remove the actors.",
          question: "Did you intend to obscure who wrote the report?",
        },
      ],
      metrics: {
        passiveRatio: 0.5,
        totalSentences: 2,
        hedgingWordCount: 0,
        rhythmVariance: 3.2,
      },
    };
    const result = SavedNudgeSchema.safeParse(record);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(record);
    }
  });

  test("accepts empty context", () => {
    const result = SavedNudgeSchema.safeParse({
      entryId: "entry-002",
      contentHash:
        "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      context: "",
      generatedAt: "2026-04-22T16:00:00.000Z",
      nudges: [],
      metrics: {
        passiveRatio: 0,
        totalSentences: 0,
        hedgingWordCount: 0,
        rhythmVariance: 0,
      },
    });
    expect(result.success).toBe(true);
  });

  test("rejects record missing required fields", () => {
    const result = SavedNudgeSchema.safeParse({
      entryId: "entry-001",
      contentHash: "sha256:abc",
      // missing context, generatedAt, nudges, metrics
    });
    expect(result.success).toBe(false);
  });
});
