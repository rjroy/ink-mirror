import { describe, expect, test } from "bun:test";
import {
  isPassiveVoice,
  isFragment,
  classifyOpener,
  splitParagraphs,
  analyzeSentenceStructure,
} from "../../src/metrics/sentence-structure.js";

// --- Passive voice detection ---

describe("isPassiveVoice", () => {
  test("detects regular passive with 'was + -ed'", () => {
    expect(isPassiveVoice("The ball was kicked by the player.")).toBe(true);
  });

  test("detects passive with 'were + -ed'", () => {
    expect(isPassiveVoice("The documents were reviewed yesterday.")).toBe(true);
  });

  test("detects passive with irregular past participle", () => {
    expect(isPassiveVoice("The letter was written by hand.")).toBe(true);
  });

  test("detects passive with 'is being + -ed'", () => {
    expect(isPassiveVoice("The house is being painted.")).toBe(true);
  });

  test("detects passive with adverb between auxiliary and participle", () => {
    expect(isPassiveVoice("The report was quickly reviewed.")).toBe(true);
  });

  test("detects passive with 'get/got + -ed'", () => {
    expect(isPassiveVoice("I got promoted last week.")).toBe(true);
  });

  test("rejects active voice sentence", () => {
    expect(isPassiveVoice("I kicked the ball.")).toBe(false);
  });

  test("rejects active voice with 'was' as linking verb", () => {
    expect(isPassiveVoice("She was happy about the news.")).toBe(false);
  });

  test("rejects simple active sentence", () => {
    expect(isPassiveVoice("The dog ran across the yard.")).toBe(false);
  });

  test("rejects sentence with 'was' followed by adjective", () => {
    expect(isPassiveVoice("The day was long and tiring.")).toBe(false);
  });

  test("rejects 'was + -ed adjective' (linking verb, not passive)", () => {
    expect(isPassiveVoice("She was tired.")).toBe(false);
    expect(isPassiveVoice("I was excited about the trip.")).toBe(false);
    expect(isPassiveVoice("They were bored.")).toBe(false);
    expect(isPassiveVoice("He was confused.")).toBe(false);
    expect(isPassiveVoice("I was worried about the results.")).toBe(false);
  });
});

// --- Fragment detection ---

describe("isFragment", () => {
  test("detects noun-only fragment", () => {
    expect(isFragment("Just silence.")).toBe(true);
  });

  test("detects prepositional phrase fragment", () => {
    expect(isFragment("Nothing but rain.")).toBe(true);
  });

  test("detects single-word fragment", () => {
    expect(isFragment("Silence.")).toBe(true);
  });

  test("rejects sentence with common verb", () => {
    expect(isFragment("I walked to the store.")).toBe(false);
  });

  test("rejects sentence with -ed verb", () => {
    expect(isFragment("The door slammed shut.")).toBe(false);
  });

  test("rejects sentence with -ing verb", () => {
    expect(isFragment("She was running late.")).toBe(false);
  });

  test("rejects sentence with modal verb", () => {
    expect(isFragment("You should try harder.")).toBe(false);
  });

  test("detects adjective-only fragment", () => {
    expect(isFragment("So quiet.")).toBe(true);
  });
});

// --- Paragraph opener classification ---

describe("classifyOpener", () => {
  test("classifies 'I + verb' opener", () => {
    expect(classifyOpener("I walked to the store.")).toBe("I + verb");
  });

  test("classifies pronoun opener", () => {
    expect(classifyOpener("She decided to leave.")).toBe("pronoun + verb");
    expect(classifyOpener("They arrived early.")).toBe("pronoun + verb");
  });

  test("classifies temporal marker opener", () => {
    expect(classifyOpener("Yesterday I went to the park.")).toBe("temporal marker");
    expect(classifyOpener("Later that night everything changed.")).toBe("temporal marker");
    expect(classifyOpener("Eventually we found the way.")).toBe("temporal marker");
  });

  test("classifies conjunction opener", () => {
    expect(classifyOpener("But that changed everything.")).toBe("conjunction");
    expect(classifyOpener("And then it happened.")).toBe("conjunction");
  });

  test("classifies article/determiner opener", () => {
    expect(classifyOpener("The morning was cold.")).toBe("article/determiner");
    expect(classifyOpener("My thoughts drifted.")).toBe("article/determiner");
  });

  test("classifies 'other' for unrecognized openers", () => {
    expect(classifyOpener("Underneath the bridge stood a figure.")).toBe("other");
  });

  test("handles empty input", () => {
    expect(classifyOpener("")).toBe("other");
  });
});

// --- Paragraph splitting ---

describe("splitParagraphs", () => {
  test("splits on blank lines", () => {
    const text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.";
    expect(splitParagraphs(text)).toEqual([
      "First paragraph.",
      "Second paragraph.",
      "Third paragraph.",
    ]);
  });

  test("handles multiple blank lines between paragraphs", () => {
    const text = "First.\n\n\n\nSecond.";
    expect(splitParagraphs(text)).toEqual(["First.", "Second."]);
  });

  test("handles single paragraph", () => {
    expect(splitParagraphs("Just one paragraph here.")).toEqual([
      "Just one paragraph here.",
    ]);
  });

  test("returns empty array for empty input", () => {
    expect(splitParagraphs("")).toEqual([]);
    expect(splitParagraphs("   \n\n   ")).toEqual([]);
  });
});

// --- Full analysis ---

describe("analyzeSentenceStructure", () => {
  test("produces correct analysis for mixed voice text", () => {
    const sentences = [
      "I wrote the report.",
      "The report was reviewed by my manager.",
      "She approved it immediately.",
    ];
    const prose = sentences.join(" ");

    const result = analyzeSentenceStructure(sentences, prose);
    expect(result.totalSentences).toBe(3);
    expect(result.passiveCount).toBe(1);
    expect(result.activeCount).toBe(2);
    expect(result.passiveRatio).toBeCloseTo(0.33, 1);
    expect(result.fragmentCount).toBe(0);
  });

  test("detects fragments", () => {
    const sentences = [
      "I stopped.",
      "Just silence.",
      "Nothing but rain.",
      "I turned around.",
    ];
    const prose = sentences.join(" ");

    const result = analyzeSentenceStructure(sentences, prose);
    expect(result.fragmentCount).toBe(2);
    expect(result.totalSentences).toBe(4);
    // Fragments are not counted as active or passive
    expect(result.activeCount + result.passiveCount).toBe(2);
  });

  test("analyzes paragraph openers", () => {
    const prose = [
      "I went to the store. It was busy.",
      "",
      "Yesterday the weather changed. Rain poured down.",
      "",
      "I decided to stay home. The couch was comfortable.",
    ].join("\n");
    const sentences = [
      "I went to the store.",
      "It was busy.",
      "Yesterday the weather changed.",
      "Rain poured down.",
      "I decided to stay home.",
      "The couch was comfortable.",
    ];

    const result = analyzeSentenceStructure(sentences, prose);
    expect(result.paragraphCount).toBe(3);

    // Two paragraphs start with "I + verb", one with "temporal marker"
    const iOpener = result.paragraphOpeners.find((o) => o.pattern === "I + verb");
    expect(iOpener?.count).toBe(2);
    const temporal = result.paragraphOpeners.find((o) => o.pattern === "temporal marker");
    expect(temporal?.count).toBe(1);
  });

  test("handles empty input", () => {
    const result = analyzeSentenceStructure([], "");
    expect(result.totalSentences).toBe(0);
    expect(result.passiveCount).toBe(0);
    expect(result.activeCount).toBe(0);
    expect(result.passiveRatio).toBe(0);
    expect(result.paragraphOpeners).toEqual([]);
    expect(result.paragraphCount).toBe(0);
    expect(result.fragmentCount).toBe(0);
  });

  test("passive ratio is 0 when all sentences are fragments", () => {
    const sentences = ["Just silence.", "Nothing more."];
    const result = analyzeSentenceStructure(sentences, sentences.join(" "));
    expect(result.passiveRatio).toBe(0);
    expect(result.fragmentCount).toBe(2);
  });

  test("openers sorted by frequency descending", () => {
    const prose = [
      "I walked outside.",
      "",
      "I sat down.",
      "",
      "I looked around.",
      "",
      "The sky was gray.",
    ].join("\n");
    const sentences = [
      "I walked outside.",
      "I sat down.",
      "I looked around.",
      "The sky was gray.",
    ];

    const result = analyzeSentenceStructure(sentences, prose);
    expect(result.paragraphOpeners[0].pattern).toBe("I + verb");
    expect(result.paragraphOpeners[0].count).toBe(3);
  });
});
