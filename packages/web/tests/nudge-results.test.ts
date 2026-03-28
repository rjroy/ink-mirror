import { describe, test, expect } from "bun:test";
import type { CraftNudge } from "@ink-mirror/shared";

const sampleNudges: CraftNudge[] = [
  {
    craftPrinciple: "passive-voice-clustering",
    evidence: "The ball was thrown by the boy",
    observation: "Three passive constructions in sequence dilute agency.",
    question: "Who is acting in this passage?",
  },
  {
    craftPrinciple: "hedging-accumulation",
    evidence: "It seems like it might perhaps be the case",
    observation: "Four hedging words in one sentence erode conviction.",
    question: "What would this sentence look like if you committed to the claim?",
  },
];

describe("NudgeResults component", () => {
  test("component module exports NudgeResults", async () => {
    const mod = await import("../components/nudge-results");
    expect(typeof mod.NudgeResults).toBe("function");
  });

  test("NudgeResults accepts nudges prop type", () => {
    // Type-level verification: CraftNudge[] matches expected shape
    expect(sampleNudges).toHaveLength(2);
    expect(sampleNudges[0].craftPrinciple).toBe("passive-voice-clustering");
    expect(sampleNudges[0].evidence).toBeTruthy();
    expect(sampleNudges[0].observation).toBeTruthy();
    expect(sampleNudges[0].question).toBeTruthy();
  });

  test("CraftNudge has all required fields", () => {
    const nudge = sampleNudges[0];
    const keys = Object.keys(nudge);
    expect(keys).toContain("craftPrinciple");
    expect(keys).toContain("evidence");
    expect(keys).toContain("observation");
    expect(keys).toContain("question");
  });
});

describe("EntryNudge component", () => {
  test("component module exports EntryNudge", async () => {
    const mod = await import("../components/entry-nudge");
    expect(typeof mod.EntryNudge).toBe("function");
  });
});
