import { describe, expect, test } from "bun:test";
import {
  splitSentences,
  stripMarkdown,
  countWords,
  computeSentenceMetrics,
} from "../../src/metrics/sentences.js";

describe("stripMarkdown", () => {
  test("removes heading markers", () => {
    expect(stripMarkdown("# Title")).toBe("Title");
    expect(stripMarkdown("## Subtitle")).toBe("Subtitle");
    expect(stripMarkdown("### Deep")).toBe("Deep");
  });

  test("removes emphasis markers", () => {
    expect(stripMarkdown("**bold** text")).toBe("bold text");
    expect(stripMarkdown("*italic* word")).toBe("italic word");
    expect(stripMarkdown("***both***")).toBe("both");
    expect(stripMarkdown("__bold__ text")).toBe("bold text");
  });

  test("removes fenced code blocks", () => {
    const input = "Before.\n```js\nconst x = 1;\n```\nAfter.";
    expect(stripMarkdown(input)).toBe("Before.\n\nAfter.");
  });

  test("removes inline code", () => {
    expect(stripMarkdown("Use `foo()` here")).toBe("Use  here");
  });

  test("converts links to text", () => {
    expect(stripMarkdown("[click here](http://example.com)")).toBe("click here");
  });

  test("removes images entirely", () => {
    expect(stripMarkdown("![alt text](image.png)")).toBe("");
  });

  test("removes list markers", () => {
    expect(stripMarkdown("- item one\n- item two")).toBe("item one\nitem two");
    expect(stripMarkdown("* item")).toBe("item");
    expect(stripMarkdown("+ item")).toBe("item");
    expect(stripMarkdown("1. first\n2. second")).toBe("first\nsecond");
  });

  test("removes blockquote markers", () => {
    expect(stripMarkdown("> quoted text")).toBe("quoted text");
    expect(stripMarkdown("> line one\n> line two")).toBe("line one\nline two");
  });

  test("removes horizontal rules", () => {
    expect(stripMarkdown("Before\n---\nAfter")).toBe("Before\n\nAfter");
    expect(stripMarkdown("Before\n***\nAfter")).toBe("Before\n\nAfter");
  });
});

describe("splitSentences", () => {
  test("splits on periods", () => {
    expect(splitSentences("Hello world. Goodbye world.")).toEqual([
      "Hello world.",
      "Goodbye world.",
    ]);
  });

  test("splits on exclamation marks", () => {
    expect(splitSentences("Wow! Amazing!")).toEqual(["Wow!", "Amazing!"]);
  });

  test("splits on question marks", () => {
    expect(splitSentences("What? Why?")).toEqual(["What?", "Why?"]);
  });

  test("handles abbreviations without splitting", () => {
    expect(splitSentences("Dr. Smith went home.")).toEqual([
      "Dr. Smith went home.",
    ]);
    expect(splitSentences("She has a Ph.D. in physics.")).toEqual([
      "She has a Ph.D. in physics.",
    ]);
  });

  test("handles Mr., Mrs., Ms.", () => {
    expect(splitSentences("Mr. Jones met Mrs. Smith.")).toEqual([
      "Mr. Jones met Mrs. Smith.",
    ]);
  });

  test("handles e.g. and i.e.", () => {
    expect(
      splitSentences("Use a tool, e.g. a hammer. Then proceed."),
    ).toEqual(["Use a tool, e.g. a hammer.", "Then proceed."]);
  });

  test("handles etc.", () => {
    expect(
      splitSentences("Bring food, drinks, etc. for the party."),
    ).toEqual(["Bring food, drinks, etc. for the party."]);
  });

  test("handles ellipses", () => {
    expect(splitSentences("Well... I don't know.")).toEqual([
      "Well... I don't know.",
    ]);
  });

  test("handles dialogue with closing quotes", () => {
    expect(splitSentences('"Hello." She waved.')).toEqual([
      '"Hello."',
      "She waved.",
    ]);
  });

  test("handles multiple punctuation marks", () => {
    expect(splitSentences("Really?! Yes!!")).toEqual(["Really?!", "Yes!!"]);
  });

  test("handles text without terminal punctuation", () => {
    expect(splitSentences("No period here")).toEqual(["No period here"]);
  });

  test("handles empty input", () => {
    expect(splitSentences("")).toEqual([]);
  });

  test("handles whitespace-only input", () => {
    expect(splitSentences("   \n\n  ")).toEqual([]);
  });

  test("strips markdown before splitting", () => {
    const md = "# Title\n\nFirst sentence. **Bold** sentence.";
    expect(splitSentences(md)).toEqual([
      "Title First sentence.",
      "Bold sentence.",
    ]);
  });

  test("handles code blocks by removing them", () => {
    const md = "Before code.\n```\ncode here\n```\nAfter code.";
    expect(splitSentences(md)).toEqual(["Before code.", "After code."]);
  });

  test("handles list items as continuous text", () => {
    const md = "- First item. Second part.\n- Another item.";
    expect(splitSentences(md)).toEqual([
      "First item.",
      "Second part.",
      "Another item.",
    ]);
  });

  test("handles mixed markdown with dialogue", () => {
    const md = '> "Where are you?" she asked. "Over here."';
    expect(splitSentences(md)).toEqual([
      '"Where are you?"',
      "she asked.",
      '"Over here."',
    ]);
  });

  test("handles initials without splitting", () => {
    expect(splitSentences("J. K. Rowling wrote books.")).toEqual([
      "J. K. Rowling wrote books.",
    ]);
  });

  test("handles Unicode ellipsis", () => {
    expect(splitSentences("Well\u2026 I don't know.")).toEqual([
      "Well... I don't know.",
    ]);
  });

  test("handles Unicode ellipsis at end of text", () => {
    expect(splitSentences("And then\u2026")).toEqual(["And then..."]);
  });

  test("splits after single-letter word 'I' at end of sentence", () => {
    expect(splitSentences("The answer is I. She agreed.")).toEqual([
      "The answer is I.",
      "She agreed.",
    ]);
  });
});

describe("countWords", () => {
  test("counts words separated by spaces", () => {
    expect(countWords("one two three")).toBe(3);
  });

  test("handles multiple spaces", () => {
    expect(countWords("one  two   three")).toBe(3);
  });

  test("handles leading/trailing whitespace", () => {
    expect(countWords("  hello world  ")).toBe(2);
  });

  test("returns 0 for empty string", () => {
    expect(countWords("")).toBe(0);
  });

  test("returns 0 for whitespace-only string", () => {
    expect(countWords("   ")).toBe(0);
  });

  test("counts single word", () => {
    expect(countWords("hello")).toBe(1);
  });
});

describe("computeSentenceMetrics", () => {
  test("computes metrics for each sentence", () => {
    const result = computeSentenceMetrics(["Hello world.", "A test."]);
    expect(result).toEqual([
      { text: "Hello world.", wordCount: 2, charCount: 12 },
      { text: "A test.", wordCount: 2, charCount: 7 },
    ]);
  });

  test("returns empty array for empty input", () => {
    expect(computeSentenceMetrics([])).toEqual([]);
  });
});
