import { describe, expect, test } from "bun:test";
import { computeEntryMetrics } from "../../src/metrics/index.js";

describe("computeEntryMetrics", () => {
  test("produces a complete metrics object for simple text", () => {
    const metrics = computeEntryMetrics(
      "The sun rose. Birds sang. A new day began.",
    );
    expect(metrics.sentences).toHaveLength(3);
    expect(metrics.rhythm.lengthSequence).toEqual([3, 2, 4]);
    expect(metrics.rhythm.mean).toBe(3);
    expect(metrics.wordFrequency.totalTokens).toBe(9);
  });

  test("output has the expected shape", () => {
    const metrics = computeEntryMetrics(
      "First sentence here. Second sentence there. Third one too.",
    );
    // Verify all top-level keys exist with correct types
    expect(Array.isArray(metrics.sentences)).toBe(true);
    expect(typeof metrics.rhythm.mean).toBe("number");
    expect(typeof metrics.rhythm.variance).toBe("number");
    expect(Array.isArray(metrics.rhythm.lengthSequence)).toBe(true);
    expect(typeof metrics.wordFrequency.totalTokens).toBe("number");
    expect(typeof metrics.wordFrequency.uniqueTokens).toBe("number");
    expect(typeof metrics.wordFrequency.tokenFrequencies).toBe("object");
  });

  test("output is JSON-serializable and round-trips cleanly", () => {
    const metrics = computeEntryMetrics("Hello. World.");
    const json = JSON.stringify(metrics);
    const parsed = JSON.parse(json);
    expect(parsed.sentences).toHaveLength(2);
    expect(parsed.rhythm.mean).toBeDefined();
    expect(parsed.wordFrequency.totalTokens).toBeDefined();
    // Verify deep equality survives serialization
    expect(parsed).toEqual(metrics);
  });

  test("handles markdown-heavy input", () => {
    const md = [
      "# My Journal Entry",
      "",
      "Today I went to the **store**. It was *quite* busy.",
      "",
      "## What I Bought",
      "",
      "- Apples and oranges.",
      "- Bread from the bakery.",
      "",
      "> Someone said: \"The bread is fresh.\"",
      "",
      "I really enjoyed the trip. It was very nice.",
    ].join("\n");

    const metrics = computeEntryMetrics(md);

    // Should have parsed multiple sentences from the prose
    expect(metrics.sentences.length).toBeGreaterThanOrEqual(5);

    // Should detect "very" as intensifier (from the prose)
    expect(metrics.wordFrequency.intensifiers["very"]).toBe(1);
  });

  test("handles entry with dialogue", () => {
    const text = [
      '"Where are you going?" she asked.',
      '"To the store," he replied. "Do you need anything?"',
      '"Just some milk," she said.',
    ].join(" ");

    const metrics = computeEntryMetrics(text);
    expect(metrics.sentences.length).toBeGreaterThanOrEqual(3);
    expect(metrics.wordFrequency.hedgingWords["just"]).toBe(1);
  });

  test("handles entry with code blocks", () => {
    const md = [
      "I was working on the code today.",
      "",
      "```typescript",
      'const x = "hello";',
      "console.log(x);",
      "```",
      "",
      "The refactor went well.",
    ].join("\n");

    const metrics = computeEntryMetrics(md);
    // Code block content should be excluded from sentence splitting
    expect(metrics.sentences.length).toBe(2);
    expect(metrics.wordFrequency.tokenFrequencies["const"]).toBeUndefined();
  });

  test("handles empty input", () => {
    const metrics = computeEntryMetrics("");
    expect(metrics.sentences).toEqual([]);
    expect(metrics.rhythm.lengthSequence).toEqual([]);
    expect(metrics.rhythm.mean).toBe(0);
    expect(metrics.wordFrequency.totalTokens).toBe(0);
  });

  test("detects hedging patterns across a realistic entry", () => {
    const entry = [
      "I think the project is going well.",
      "We probably need to revisit the timeline though.",
      "It's just that the estimates feel a bit off.",
      "I guess we should talk about it.",
      "Actually, maybe I should just bring it up in standup.",
    ].join(" ");

    const metrics = computeEntryMetrics(entry);
    expect(Object.keys(metrics.wordFrequency.hedgingWords).length).toBeGreaterThanOrEqual(4);
    expect(metrics.wordFrequency.hedgingWords["just"]).toBeGreaterThanOrEqual(1);
    expect(metrics.wordFrequency.hedgingWords["probably"]).toBe(1);
    expect(metrics.wordFrequency.hedgingWords["actually"]).toBe(1);
    expect(metrics.wordFrequency.hedgingWords["i think"]).toBe(1);
  });

  test("detects rhythm variation in a staccato-then-flowing entry", () => {
    const entry = [
      "Stop. Think. Wait.",
      "Now consider the full implications of what just happened in the meeting today,",
      "because the consequences are going to ripple through the entire organization",
      "for months to come.",
    ].join(" ");

    const metrics = computeEntryMetrics(entry);

    // Should see high variance (mix of very short and very long)
    expect(metrics.rhythm.variance).toBeGreaterThan(0);

    // Should detect consecutive short sentences at the start
    expect(metrics.rhythm.maxConsecutiveShort).toBeGreaterThanOrEqual(2);
  });
});
