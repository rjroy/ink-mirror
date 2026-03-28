import { describe, expect, test } from "bun:test";
import {
  buildSystemPrompt,
  buildUserMessage,
  parseObserverOutput,
  validateObservations,
  observe,
} from "../src/observer.js";
import { createSessionRunner } from "../src/session-runner.js";
import { createObservationStore, type ObservationStoreFs } from "../src/observation-store.js";
import { computeEntryMetrics } from "../src/metrics/index.js";
import type { RawObservation } from "@ink-mirror/shared";

// --- Test fixtures ---

const SAMPLE_ENTRY =
  "I stopped. I turned. I left. The door closed behind me with a heavy thud that echoed through the empty hallway. I probably should have stayed longer, but I just couldn't take it anymore. It was just too much.";

const VALID_OBSERVER_JSON = JSON.stringify({
  observations: [
    {
      pattern: "Uses three consecutive short sentences for emphasis",
      evidence: "I stopped. I turned. I left.",
      dimension: "sentence-rhythm",
    },
    {
      pattern: 'Hedging with "just" to soften direct statements',
      evidence: "I just couldn't take it anymore",
      dimension: "word-level-habits",
    },
  ],
});

function mockFs(): ObservationStoreFs & { files: Record<string, string> } {
  const files: Record<string, string> = {};
  return {
    files,
    async readdir(path: string): Promise<string[]> {
      const prefix = path.endsWith("/") ? path : path + "/";
      return Object.keys(files)
        .filter((f) => f.startsWith(prefix))
        .map((f) => f.slice(prefix.length))
        .filter((f) => !f.includes("/"));
    },
    async readFile(path: string): Promise<string> {
      if (!(path in files)) throw new Error(`ENOENT: ${path}`);
      return files[path];
    },
    async writeFile(path: string, content: string): Promise<void> {
      files[path] = content;
    },
    async mkdir(): Promise<void> {},
  };
}

// --- System prompt tests ---

describe("buildSystemPrompt", () => {
  test("includes observation rules", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("2-3 observations per entry");
    expect(prompt).toContain("curation test");
  });

  test("includes no-generation constraint", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("NEVER");
    expect(prompt).toContain("Generate text for the writer");
  });

  test("includes no-external-comparison rule (REQ-V1-9)", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("external norms");
    expect(prompt).toContain("other writers");
  });

  test("includes all three active dimensions", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("sentence-rhythm");
    expect(prompt).toContain("word-level-habits");
    expect(prompt).toContain("sentence-structure");
  });

  test("specifies JSON output format with worked examples", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('"observations"');
    expect(prompt).toContain('"pattern"');
    expect(prompt).toContain('"evidence"');
    expect(prompt).toContain('"dimension"');
    // Three separate example observations, one per dimension
    expect(prompt).toContain('"dimension": "sentence-rhythm"');
    expect(prompt).toContain('"dimension": "word-level-habits"');
    expect(prompt).toContain('"dimension": "sentence-structure"');
  });

  test("includes context description section (REQ-V1-13)", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Context You Receive");
    expect(prompt).toContain("Pre-computed metrics");
    expect(prompt).toContain("Style Profile");
    expect(prompt).toContain("Recent Entries");
    expect(prompt).toContain("Current Entry");
  });

  test("includes evidence citation emphasis", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("character for character");
    expect(prompt).toContain("rejected by validation");
  });

  test("includes dimension diversity nudge", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("different dimensions");
  });
});

// --- User message / context assembly tests ---

describe("buildUserMessage", () => {
  test("places current entry at the end (REQ-V1-15)", () => {
    const metrics = computeEntryMetrics(SAMPLE_ENTRY);
    const message = buildUserMessage(SAMPLE_ENTRY, metrics, "");

    const metricsPos = message.indexOf("## Pre-computed Metrics");
    const entryPos = message.indexOf("## Current Entry");

    expect(metricsPos).toBeGreaterThan(-1);
    expect(entryPos).toBeGreaterThan(metricsPos);
    expect(message.endsWith(SAMPLE_ENTRY)).toBe(true);
  });

  test("includes style profile when provided", () => {
    const metrics = computeEntryMetrics(SAMPLE_ENTRY);
    const message = buildUserMessage(SAMPLE_ENTRY, metrics, "Uses short sentences.");

    expect(message).toContain("## Writer's Style Profile");
    expect(message).toContain("Uses short sentences.");

    // Profile before metrics before entry
    const profilePos = message.indexOf("## Writer's Style Profile");
    const metricsPos = message.indexOf("## Pre-computed Metrics");
    const entryPos = message.indexOf("## Current Entry");
    expect(profilePos).toBeLessThan(metricsPos);
    expect(metricsPos).toBeLessThan(entryPos);
  });

  test("omits style profile section when empty", () => {
    const metrics = computeEntryMetrics(SAMPLE_ENTRY);
    const message = buildUserMessage(SAMPLE_ENTRY, metrics, "");

    expect(message).not.toContain("## Writer's Style Profile");
  });

  test("includes rhythm metrics", () => {
    const metrics = computeEntryMetrics(SAMPLE_ENTRY);
    const message = buildUserMessage(SAMPLE_ENTRY, metrics, "");

    expect(message).toContain("Sentence Rhythm");
    expect(message).toContain("Length sequence");
    expect(message).toContain("Mean sentence length");
  });

  test("includes word-level metrics", () => {
    const metrics = computeEntryMetrics(SAMPLE_ENTRY);
    const message = buildUserMessage(SAMPLE_ENTRY, metrics, "");

    expect(message).toContain("Word-Level Habits");
    expect(message).toContain("Total tokens");
  });

  test("includes sentence structure metrics", () => {
    const metrics = computeEntryMetrics(SAMPLE_ENTRY);
    const message = buildUserMessage(SAMPLE_ENTRY, metrics, "");

    expect(message).toContain("### Sentence Structure");
    expect(message).toContain("Active voice:");
    expect(message).toContain("Passive voice:");
    expect(message).toContain("Fragments:");
    expect(message).toContain("Paragraphs:");
  });

  test("Tier 2 assembly: recent entries + style profile in correct order", () => {
    const metrics = computeEntryMetrics(SAMPLE_ENTRY);
    const recentEntries = [
      "Yesterday I wrote about rain.",
      "The day before I wrote about sun.",
    ];
    const message = buildUserMessage(
      SAMPLE_ENTRY,
      metrics,
      "Favors short declarative sentences.",
      recentEntries,
    );

    // All four sections present
    expect(message).toContain("## Recent Entries");
    expect(message).toContain("## Writer's Style Profile");
    expect(message).toContain("## Pre-computed Metrics");
    expect(message).toContain("## Current Entry");

    // Correct order: recent entries, style profile, metrics, current entry
    const recentPos = message.indexOf("## Recent Entries");
    const profilePos = message.indexOf("## Writer's Style Profile");
    const metricsPos = message.indexOf("## Pre-computed Metrics");
    const entryPos = message.indexOf("## Current Entry");

    expect(recentPos).toBeLessThan(profilePos);
    expect(profilePos).toBeLessThan(metricsPos);
    expect(metricsPos).toBeLessThan(entryPos);

    // Recent entry content is present
    expect(message).toContain("Yesterday I wrote about rain.");
    expect(message).toContain("The day before I wrote about sun.");

    // Current entry is last
    expect(message.endsWith(SAMPLE_ENTRY)).toBe(true);
  });
});

// --- Output parsing tests ---

describe("parseObserverOutput", () => {
  test("parses valid JSON output", () => {
    const result = parseObserverOutput(VALID_OBSERVER_JSON);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0].pattern).toBe(
        "Uses three consecutive short sentences for emphasis",
      );
    }
  });

  test("strips markdown code fences", () => {
    const fenced = "```json\n" + VALID_OBSERVER_JSON + "\n```";
    const result = parseObserverOutput(fenced);
    expect(result.success).toBe(true);
  });

  test("rejects invalid JSON", () => {
    const result = parseObserverOutput("not json at all");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Invalid JSON");
    }
  });

  test("rejects empty observations array", () => {
    const result = parseObserverOutput(
      JSON.stringify({ observations: [] }),
    );
    expect(result.success).toBe(false);
  });

  test("rejects observation with missing pattern", () => {
    const result = parseObserverOutput(
      JSON.stringify({
        observations: [
          { pattern: "", evidence: "some text", dimension: "sentence-rhythm" },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  test("rejects observation with invalid dimension", () => {
    const result = parseObserverOutput(
      JSON.stringify({
        observations: [
          { pattern: "test", evidence: "text", dimension: "invalid-dimension" },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  test("rejects more than 3 observations", () => {
    const result = parseObserverOutput(
      JSON.stringify({
        observations: [
          { pattern: "a", evidence: "x", dimension: "sentence-rhythm" },
          { pattern: "b", evidence: "y", dimension: "sentence-rhythm" },
          { pattern: "c", evidence: "z", dimension: "sentence-rhythm" },
          { pattern: "d", evidence: "w", dimension: "sentence-rhythm" },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });
});

// --- Validation tests ---

describe("validateObservations", () => {
  test("accepts observations with evidence found in entry", () => {
    const observations: RawObservation[] = [
      {
        pattern: "Short sentence emphasis",
        evidence: "I stopped. I turned. I left.",
        dimension: "sentence-rhythm",
      },
    ];

    const result = validateObservations(observations, SAMPLE_ENTRY);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  test("rejects observation with evidence not in entry (REQ-V1-7)", () => {
    const observations: RawObservation[] = [
      {
        pattern: "Some pattern",
        evidence: "This text is not in the entry at all",
        dimension: "sentence-rhythm",
      },
    ];

    const result = validateObservations(observations, SAMPLE_ENTRY);
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("not found in entry text");
  });

  test("rejects observation with empty pattern (REQ-V1-5)", () => {
    // Will fail at Zod level (min 1), but let's test the validateObservations
    // function directly with a technically valid but empty-after-trim pattern
    const obs: RawObservation[] = [
      {
        pattern: "   ",
        evidence: "I stopped.",
        dimension: "sentence-rhythm",
      },
    ];

    const result = validateObservations(obs, SAMPLE_ENTRY);
    expect(result.valid).toHaveLength(0);
    expect(result.errors[0]).toContain("Missing pattern name");
  });

  test("rejects observation with empty evidence", () => {
    const observations: RawObservation[] = [
      {
        pattern: "Some pattern",
        evidence: "   ",
        dimension: "sentence-rhythm",
      },
    ];

    const result = validateObservations(observations, SAMPLE_ENTRY);
    expect(result.valid).toHaveLength(0);
    expect(result.errors[0]).toContain("Missing cited evidence");
  });

  test("case-insensitive evidence matching", () => {
    const observations: RawObservation[] = [
      {
        pattern: "Short sentences",
        evidence: "i stopped. i turned. i left.",
        dimension: "sentence-rhythm",
      },
    ];

    const result = validateObservations(observations, SAMPLE_ENTRY);
    expect(result.valid).toHaveLength(1);
  });

  test("keeps valid observations and reports invalid ones separately", () => {
    const observations: RawObservation[] = [
      {
        pattern: "Valid pattern",
        evidence: "I stopped.",
        dimension: "sentence-rhythm",
      },
      {
        pattern: "Invalid pattern",
        evidence: "Not in the text at all",
        dimension: "word-level-habits",
      },
    ];

    const result = validateObservations(observations, SAMPLE_ENTRY);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.valid[0].pattern).toBe("Valid pattern");
  });
});

// --- Full observe pipeline test ---

describe("observe (pipeline)", () => {
  test("assembles prompt, calls runner, validates, and stores", async () => {
    const fs = mockFs();
    const observationStore = createObservationStore({
      observationsDir: "/data/observations",
      fs,
      now: () => "2026-03-27T10:00:00.000Z",
    });

    const sessionRunner = createSessionRunner({
      queryFn: async (req) => {
        // Verify the prompt structure
        expect(req.system).toContain("pattern observer");
        expect(req.messages).toHaveLength(1);
        expect(req.messages[0].role).toBe("user");
        expect(req.messages[0].content).toContain("## Current Entry");
        expect(req.messages[0].content).toContain(SAMPLE_ENTRY);
        expect(req.messages[0].content).toContain("## Pre-computed Metrics");

        return { content: VALID_OBSERVER_JSON };
      },
    });

    const result = await observe(
      {
        sessionRunner,
        observationStore,
        computeMetrics: computeEntryMetrics,
      },
      "entry-2026-03-27-001",
      SAMPLE_ENTRY,
    );

    expect(result.observations).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(result.observations[0].id).toBe("obs-2026-03-27-001");
    expect(result.observations[0].status).toBe("pending");
    expect(result.observations[0].entryId).toBe("entry-2026-03-27-001");

    // Verify files were written
    expect(fs.files["/data/observations/obs-2026-03-27-001.yaml"]).toBeDefined();
    expect(fs.files["/data/observations/obs-2026-03-27-002.yaml"]).toBeDefined();
  });

  test("returns errors when LLM output has invalid evidence", async () => {
    const fs = mockFs();
    const observationStore = createObservationStore({
      observationsDir: "/data/observations",
      fs,
      now: () => "2026-03-27T10:00:00.000Z",
    });

    const badOutput = JSON.stringify({
      observations: [
        {
          pattern: "Valid pattern",
          evidence: "I stopped.",
          dimension: "sentence-rhythm",
        },
        {
          pattern: "Fabricated evidence",
          evidence: "Text that doesn't exist in the entry",
          dimension: "word-level-habits",
        },
      ],
    });

    const sessionRunner = createSessionRunner({
      queryFn: async () => ({ content: badOutput }),
    });

    const result = await observe(
      {
        sessionRunner,
        observationStore,
        computeMetrics: computeEntryMetrics,
      },
      "entry-001",
      SAMPLE_ENTRY,
    );

    expect(result.observations).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("not found in entry text");
  });

  test("returns errors when LLM output is not valid JSON", async () => {
    const fs = mockFs();
    const observationStore = createObservationStore({
      observationsDir: "/data/observations",
      fs,
      now: () => "2026-03-27T10:00:00.000Z",
    });

    const sessionRunner = createSessionRunner({
      queryFn: async () => ({ content: "Sorry, I can't help with that." }),
    });

    const result = await observe(
      {
        sessionRunner,
        observationStore,
        computeMetrics: computeEntryMetrics,
      },
      "entry-001",
      SAMPLE_ENTRY,
    );

    expect(result.observations).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Invalid JSON");
  });

  test("includes style profile when readStyleProfile is provided", async () => {
    const fs = mockFs();
    const observationStore = createObservationStore({
      observationsDir: "/data/observations",
      fs,
      now: () => "2026-03-27T10:00:00.000Z",
    });

    let capturedMessage = "";
    const sessionRunner = createSessionRunner({
      queryFn: async (req) => {
        capturedMessage = req.messages[0].content;
        return { content: VALID_OBSERVER_JSON };
      },
    });

    await observe(
      {
        sessionRunner,
        observationStore,
        computeMetrics: computeEntryMetrics,
        readStyleProfile: async () =>
          "Uses short declarative sentences for emphasis.",
      },
      "entry-001",
      SAMPLE_ENTRY,
    );

    expect(capturedMessage).toContain("## Writer's Style Profile");
    expect(capturedMessage).toContain("Uses short declarative sentences");
  });

  test("Tier 2 pipeline: activates when corpus >= 5 and includes recent entries", async () => {
    const fs = mockFs();
    const observationStore = createObservationStore({
      observationsDir: "/data/observations",
      fs,
      now: () => "2026-03-27T10:00:00.000Z",
    });

    let capturedMessage = "";
    const sessionRunner = createSessionRunner({
      queryFn: async (req) => {
        capturedMessage = req.messages[0].content;
        return { content: VALID_OBSERVER_JSON };
      },
    });

    const recentTexts = [
      "First recent entry about morning routines.",
      "Second recent entry about evening walks.",
      "Third recent entry about writing habits.",
      "Fourth recent entry about reading lists.",
      "Fifth recent entry about weekend plans.",
    ];

    const result = await observe(
      {
        sessionRunner,
        observationStore,
        computeMetrics: computeEntryMetrics,
        corpusSize: async () => 7,
        recentEntries: async (limit) => {
          return recentTexts.slice(0, limit).map((body, i) => ({
            id: `entry-recent-${i}`,
            body,
          }));
        },
      },
      "entry-tier2-001",
      SAMPLE_ENTRY,
    );

    // Tier 2 section present in the assembled prompt
    expect(capturedMessage).toContain("## Recent Entries");
    expect(capturedMessage).toContain("First recent entry about morning routines.");
    expect(capturedMessage).toContain("Fifth recent entry about weekend plans.");

    // Recent entries appear before current entry (REQ-V1-15 ordering)
    const recentPos = capturedMessage.indexOf("## Recent Entries");
    const entryPos = capturedMessage.indexOf("## Current Entry");
    expect(recentPos).toBeLessThan(entryPos);

    // Pipeline still completes: observations stored
    expect(result.observations).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  test("Tier 2 pipeline: does NOT activate when corpus < 5", async () => {
    const fs = mockFs();
    const observationStore = createObservationStore({
      observationsDir: "/data/observations",
      fs,
      now: () => "2026-03-27T10:00:00.000Z",
    });

    let capturedMessage = "";
    const sessionRunner = createSessionRunner({
      queryFn: async (req) => {
        capturedMessage = req.messages[0].content;
        return { content: VALID_OBSERVER_JSON };
      },
    });

    let recentEntriesCalled = false;
    const result = await observe(
      {
        sessionRunner,
        observationStore,
        computeMetrics: computeEntryMetrics,
        corpusSize: async () => 3,
        recentEntries: async (limit) => {
          recentEntriesCalled = true;
          return [{ id: "e1", body: "Should not appear" }];
        },
      },
      "entry-tier2-002",
      SAMPLE_ENTRY,
    );

    // Tier 2 should not activate: corpus too small
    expect(capturedMessage).not.toContain("## Recent Entries");
    expect(recentEntriesCalled).toBe(false);

    // Pipeline still works at Tier 1
    expect(result.observations).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });
});
