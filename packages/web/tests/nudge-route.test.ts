import { describe, test, expect } from "bun:test";
import { NudgeRequestSchema, NudgeResponseSchema } from "@ink-mirror/shared";

describe("nudge API route", () => {
  test("route module exports POST handler", async () => {
    const routeModule = await import("../app/api/nudge/route");
    expect(typeof routeModule.POST).toBe("function");
  });

  test("NudgeRequestSchema validates text-based request", () => {
    const result = NudgeRequestSchema.safeParse({ text: "Some writing sample" });
    expect(result.success).toBe(true);
  });

  test("NudgeRequestSchema validates entryId-based request", () => {
    const result = NudgeRequestSchema.safeParse({ entryId: "entry-123" });
    expect(result.success).toBe(true);
  });

  test("NudgeRequestSchema rejects empty request", () => {
    const result = NudgeRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  test("NudgeRequestSchema accepts optional context", () => {
    const result = NudgeRequestSchema.safeParse({
      text: "Some writing",
      context: "journal entry",
    });
    expect(result.success).toBe(true);
  });

  test("NudgeRequestSchema accepts refresh flag", () => {
    const result = NudgeRequestSchema.safeParse({
      entryId: "entry-1",
      refresh: true,
    });
    expect(result.success).toBe(true);
  });

  test("NudgeResponseSchema validates well-formed fresh response", () => {
    const result = NudgeResponseSchema.safeParse({
      nudges: [
        {
          craftPrinciple: "passive-voice-clustering",
          evidence: "The ball was thrown by the boy",
          observation: "Three passive constructions in sequence dilute agency.",
          question: "Who is acting in this passage?",
        },
      ],
      metrics: {
        passiveRatio: 0.3,
        totalSentences: 10,
        hedgingWordCount: 2,
        rhythmVariance: 0.5,
      },
      source: "fresh",
      generatedAt: "2026-04-22T12:00:00.000Z",
      contentHash: "sha256:abcdef",
    });
    expect(result.success).toBe(true);
  });

  test("NudgeResponseSchema validates cache+stale response", () => {
    const result = NudgeResponseSchema.safeParse({
      nudges: [],
      metrics: {
        passiveRatio: 0,
        totalSentences: 5,
        hedgingWordCount: 0,
        rhythmVariance: 0.8,
      },
      source: "cache",
      stale: true,
      generatedAt: "2026-04-22T12:00:00.000Z",
      contentHash: "sha256:abcdef",
    });
    expect(result.success).toBe(true);
  });

  test("NudgeResponseSchema accepts optional error field on fresh response", () => {
    const result = NudgeResponseSchema.safeParse({
      nudges: [],
      metrics: {
        passiveRatio: 0,
        totalSentences: 0,
        hedgingWordCount: 0,
        rhythmVariance: 0,
      },
      source: "fresh",
      generatedAt: "2026-04-22T12:00:00.000Z",
      error: "Text too short for meaningful analysis",
    });
    expect(result.success).toBe(true);
  });
});
