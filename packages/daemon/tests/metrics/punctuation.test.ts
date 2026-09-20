import { describe, expect, test } from "bun:test";
import { analyzePunctuation } from "../../src/metrics/punctuation.js";

describe("analyzePunctuation (REQ-LPC-9)", () => {
  test("handles empty input without NaN (zero-word guard)", () => {
    const result = analyzePunctuation("");
    expect(result.commaRatePer1000).toBe(0);
    expect(result.semicolonRatePer1000).toBe(0);
    expect(result.colonRatePer1000).toBe(0);
    expect(result.dashRatePer1000).toBe(0);
    expect(result.parenthesisRatePer1000).toBe(0);
    expect(result.questionRatePer1000).toBe(0);
    expect(result.exclamationRatePer1000).toBe(0);
    expect(result.ellipsisRatePer1000).toBe(0);
    for (const value of Object.values(result)) {
      expect(Number.isNaN(value)).toBe(false);
    }
  });

  test("counts commas relative to word count", () => {
    // 10 words, 2 commas => 200 per 1000 words
    const text = "one two, three four, five six seven eight nine ten";
    const result = analyzePunctuation(text);
    expect(result.commaRatePer1000).toBeCloseTo(200, 5);
  });

  test("counts semicolons and colons independently", () => {
    const text = "one two; three: four five six seven eight nine ten";
    const result = analyzePunctuation(text);
    expect(result.semicolonRatePer1000).toBeCloseTo(100, 5);
    expect(result.colonRatePer1000).toBeCloseTo(100, 5);
  });

  test("counts em/en dashes and spaced hyphens as dashes", () => {
    // The dash character sits between spaces, so it's its own whitespace
    // token: 11 words (not 10), one dash => 1000/11 per 1000 words.
    const expectedRate = 1000 / 11;

    const emDash = analyzePunctuation("one two — three four five six seven eight nine ten");
    expect(emDash.dashRatePer1000).toBeCloseTo(expectedRate, 5);

    const enDash = analyzePunctuation("one two – three four five six seven eight nine ten");
    expect(enDash.dashRatePer1000).toBeCloseTo(expectedRate, 5);

    const spacedHyphen = analyzePunctuation("one two - three four five six seven eight nine ten");
    expect(spacedHyphen.dashRatePer1000).toBeCloseTo(expectedRate, 5);
  });

  test("does not count a hyphen inside a compound word as a dash", () => {
    const result = analyzePunctuation("well-known cat sat on the mat here now today");
    expect(result.dashRatePer1000).toBe(0);
  });

  test("counts parenthetical asides once per opening paren", () => {
    const text = "one (two) three (four) five six seven eight nine ten";
    const result = analyzePunctuation(text);
    expect(result.parenthesisRatePer1000).toBeCloseTo(200, 5);
  });

  test("counts question and exclamation marks", () => {
    const text = "one two? three four! five six seven eight nine ten";
    const result = analyzePunctuation(text);
    expect(result.questionRatePer1000).toBeCloseTo(100, 5);
    expect(result.exclamationRatePer1000).toBeCloseTo(100, 5);
  });

  test("counts an ellipsis run as one occurrence, not three dots", () => {
    const text = "one two... three four five six seven eight nine ten";
    const result = analyzePunctuation(text);
    expect(result.ellipsisRatePer1000).toBeCloseTo(100, 5);
  });

  test("counts the unicode ellipsis character", () => {
    const text = "one two… three four five six seven eight nine ten";
    const result = analyzePunctuation(text);
    expect(result.ellipsisRatePer1000).toBeCloseTo(100, 5);
  });

  test("all rates are non-negative and finite for a punctuation-dense entry", () => {
    const text = "Was it really that bad? I wondered, half-laughing, half-serious (though I never said so out loud).";
    const result = analyzePunctuation(text);
    for (const value of Object.values(result)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  test("running the same text twice produces byte-identical results", () => {
    const text = "The room was quiet - too quiet - and I noticed everything: the clock, the draft, the silence.";
    const first = JSON.stringify(analyzePunctuation(text));
    const second = JSON.stringify(analyzePunctuation(text));
    expect(first).toBe(second);
  });
});
