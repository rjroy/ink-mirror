import { describe, expect, test } from "bun:test";
import { analyzeWordFrequency } from "../../src/metrics/word-frequency.js";

describe("analyzeWordFrequency", () => {
  test("counts total and unique tokens", () => {
    const result = analyzeWordFrequency("the cat sat on the mat");
    expect(result.totalTokens).toBe(6);
    expect(result.uniqueTokens).toBe(5); // "the" appears twice
  });

  test("builds token frequency map", () => {
    const result = analyzeWordFrequency("go go go stop");
    expect(result.tokenFrequencies["go"]).toBe(3);
    expect(result.tokenFrequencies["stop"]).toBe(1);
  });

  test("normalizes tokens to lowercase", () => {
    const result = analyzeWordFrequency("Hello HELLO hello");
    expect(result.tokenFrequencies["hello"]).toBe(3);
    expect(result.uniqueTokens).toBe(1);
  });

  test("strips punctuation from tokens", () => {
    const result = analyzeWordFrequency("hello, world! test.");
    expect(result.tokenFrequencies["hello"]).toBe(1);
    expect(result.tokenFrequencies["world"]).toBe(1);
    expect(result.tokenFrequencies["test"]).toBe(1);
  });

  test("handles empty input", () => {
    const result = analyzeWordFrequency("");
    expect(result.totalTokens).toBe(0);
    expect(result.uniqueTokens).toBe(0);
    expect(result.tokenFrequencies).toEqual({});
  });

  describe("hedging words", () => {
    test("detects single hedging words", () => {
      const result = analyzeWordFrequency(
        "I just wanted to say it was probably fine.",
      );
      expect(result.hedgingWords["just"]).toBe(1);
      expect(result.hedgingWords["probably"]).toBe(1);
    });

    test("detects multi-word hedging phrases", () => {
      const result = analyzeWordFrequency(
        "I think this is good. I think we should go.",
      );
      expect(result.hedgingWords["i think"]).toBe(2);
    });

    test("detects 'sort of' and 'kind of'", () => {
      const result = analyzeWordFrequency(
        "It was kind of nice. Sort of like a dream.",
      );
      expect(result.hedgingWords["kind of"]).toBe(1);
      expect(result.hedgingWords["sort of"]).toBe(1);
    });

    test("returns empty map when no hedging found", () => {
      const result = analyzeWordFrequency("The cat sat on the mat.");
      expect(Object.keys(result.hedgingWords).length).toBe(0);
    });

    test("does not match hedging phrases across word boundaries", () => {
      const result = analyzeWordFrequency(
        "The mankind of old sailed across the resort of kings.",
      );
      // "kind of" should not match inside "mankind of"
      expect(result.hedgingWords["kind of"]).toBeUndefined();
      // "sort of" should not match inside "resort of"
      expect(result.hedgingWords["sort of"]).toBeUndefined();
    });

    test("does not match 'a bit' inside longer words", () => {
      const result = analyzeWordFrequency("That was a bitter pill.");
      expect(result.hedgingWords["a bit"]).toBeUndefined();
    });
  });

  describe("intensifiers", () => {
    test("detects intensifier words", () => {
      const result = analyzeWordFrequency(
        "It was very good and really quite amazing.",
      );
      expect(result.intensifiers["very"]).toBe(1);
      expect(result.intensifiers["really"]).toBe(1);
      expect(result.intensifiers["quite"]).toBe(1);
    });

    test("counts repeated intensifiers", () => {
      const result = analyzeWordFrequency(
        "Very very very important.",
      );
      expect(result.intensifiers["very"]).toBe(3);
    });

    test("returns empty map when no intensifiers found", () => {
      const result = analyzeWordFrequency("The cat sat on the mat.");
      expect(Object.keys(result.intensifiers).length).toBe(0);
    });
  });

  describe("repeated phrases", () => {
    test("detects 2-word repeated phrases", () => {
      const result = analyzeWordFrequency(
        "on the other hand it was on the other hand quite clear",
      );
      expect(result.repeatedPhrases["on the"]).toBeGreaterThanOrEqual(2);
      expect(result.repeatedPhrases["the other"]).toBe(2);
      expect(result.repeatedPhrases["other hand"]).toBe(2);
    });

    test("detects 3-word repeated phrases", () => {
      const result = analyzeWordFrequency(
        "in the end we saw in the end that it worked",
      );
      expect(result.repeatedPhrases["in the end"]).toBe(2);
    });

    test("detects 4-word repeated phrases", () => {
      const result = analyzeWordFrequency(
        "at the end of the day it was at the end of the day clear",
      );
      expect(result.repeatedPhrases["at the end of"]).toBe(2);
      expect(result.repeatedPhrases["the end of the"]).toBe(2);
    });

    test("excludes phrases appearing only once", () => {
      const result = analyzeWordFrequency("a unique phrase here");
      expect(Object.keys(result.repeatedPhrases).length).toBe(0);
    });

    test("handles short text with no repeated phrases", () => {
      const result = analyzeWordFrequency("hello world");
      expect(Object.keys(result.repeatedPhrases).length).toBe(0);
    });
  });
});
