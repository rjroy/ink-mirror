import { describe, expect, test } from "bun:test";
import {
  buildSystemPrompt,
  buildUserMessage,
  buildLedger,
  parseObserverOutput,
  validateObservations,
  observe,
  type LedgerEntry,
} from "../src/observer.js";
import { createSessionRunner } from "../src/session-runner.js";
import { createObservationStore, type ObservationStoreFs } from "../src/observation-store.js";
import { createPatternStore, type PatternStoreFs } from "../src/pattern-store.js";
import { computeEntryMetrics } from "../src/metrics/index.js";
import { DEFAULT_CONFIG } from "../src/config.js";
import type { RawObservation, Pattern, MetricSnapshot, LinkableMetricKey } from "@ink-mirror/shared";

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

/** Same fixture, but with a resolvable patternRef on every observation (both discoveries). */
const VALID_OBSERVER_JSON_WITH_REFS = JSON.stringify({
  observations: [
    {
      pattern: "Uses three consecutive short sentences for emphasis",
      evidence: "I stopped. I turned. I left.",
      dimension: "sentence-rhythm",
      patternRef: { newPattern: { statement: "Uses short sentences for emphasis", dimension: "sentence-rhythm" } },
    },
    {
      pattern: 'Hedging with "just" to soften direct statements',
      evidence: "I just couldn't take it anymore",
      dimension: "word-level-habits",
      patternRef: { newPattern: { statement: "Hedges with 'just' before admitting a reaction", dimension: "word-level-habits" } },
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

function mockPatternFs(): PatternStoreFs & { files: Record<string, string> } {
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

function makePattern(overrides: Partial<Pattern> = {}): Pattern {
  return {
    id: "pat-2026-01-01-001",
    statement: "Uses short declarative sentences for emphasis.",
    dimension: "sentence-rhythm",
    status: "intentional",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    sightingCount: 3,
    entryIds: ["entry-1", "entry-2", "entry-3"],
    ...overrides,
  };
}

const stubMetrics = computeEntryMetrics(SAMPLE_ENTRY);

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

  test("includes all four active dimensions", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("sentence-rhythm");
    expect(prompt).toContain("word-level-habits");
    expect(prompt).toContain("sentence-structure");
    expect(prompt).toContain("paragraph-structure");
  });

  test("includes paragraph-structure definition and not-this boundary", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("**paragraph-structure**");
    expect(prompt).toContain("Paragraph-length distribution");
    expect(prompt).toMatch(/sentence-structure[\s\S]*paragraph-structure/);
    expect(prompt).toContain("Not this");
  });

  test("specifies JSON output format with worked examples", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('"observations"');
    expect(prompt).toContain('"pattern"');
    expect(prompt).toContain('"evidence"');
    expect(prompt).toContain('"dimension"');
    expect(prompt).toContain('"dimension": "sentence-rhythm"');
    expect(prompt).toContain('"dimension": "word-level-habits"');
    expect(prompt).toContain('"dimension": "sentence-structure"');
    expect(prompt).toContain('"dimension": "paragraph-structure"');
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

  // --- Phase 3: pattern ledger / match-or-declare contract (REQ-LPC-4/10) ---

  test("describes the match-or-declare output contract", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Pattern Ledger and Identity Matching");
    expect(prompt).toContain("patternRef.patternId");
    expect(prompt).toContain("patternRef.newPattern");
    expect(prompt).toContain("rejected outright");
  });

  test("instructs the model to cite supplied numbers, never estimate", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("never estimate");
    expect(prompt).toContain("supplied");
  });

  test("includes a dismiss-aware note against re-declaring ledger patterns", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("genuinely new");
    expect(prompt).toContain("previously judged wrong");
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

  test("renders paragraph-structure metrics on a multi-paragraph entry", () => {
    const multiParagraph = [
      "I stopped.",
      "",
      "I walked outside. The air was cold. I saw nothing. Then I kept going.",
      "",
      "The road was empty. Cars passed slowly. Headlights blurred.",
      "",
      "Nothing moved.",
    ].join("\n");
    const metrics = computeEntryMetrics(multiParagraph);
    const message = buildUserMessage(multiParagraph, metrics, "");

    expect(message).toContain("### Paragraph Structure");
    expect(message).toContain("Paragraph sentence counts:");
    expect(message).toContain("Length distribution:");
    expect(message).toContain("Single-sentence paragraphs:");
    expect(message).toMatch(/Single-sentence paragraphs:\s*2/);
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

    expect(message).toContain("## Recent Entries");
    expect(message).toContain("## Writer's Style Profile");
    expect(message).toContain("## Pre-computed Metrics");
    expect(message).toContain("## Current Entry");

    const recentPos = message.indexOf("## Recent Entries");
    const profilePos = message.indexOf("## Writer's Style Profile");
    const metricsPos = message.indexOf("## Pre-computed Metrics");
    const entryPos = message.indexOf("## Current Entry");

    expect(recentPos).toBeLessThan(profilePos);
    expect(profilePos).toBeLessThan(metricsPos);
    expect(metricsPos).toBeLessThan(entryPos);

    expect(message).toContain("Yesterday I wrote about rain.");
    expect(message).toContain("The day before I wrote about sun.");

    expect(message.endsWith(SAMPLE_ENTRY)).toBe(true);
  });

  test("omits the Pattern Ledger section when the ledger is empty (default)", () => {
    const metrics = computeEntryMetrics(SAMPLE_ENTRY);
    const message = buildUserMessage(SAMPLE_ENTRY, metrics, "");
    expect(message).not.toContain("## Pattern Ledger");
  });

  // --- Phase 3: ledger block in the prompt (REQ-LPC-5/10) ---

  describe("Pattern Ledger block", () => {
    test("renders pattern IDs, dimensions, sighting counts, and statements", () => {
      const ledger: LedgerEntry[] = [
        { id: "pat-2026-01-01-001", statement: "Uses staccato rhythm", dimension: "sentence-rhythm", sightingCount: 4 },
      ];
      const message = buildUserMessage(SAMPLE_ENTRY, stubMetrics, "", [], ledger);

      expect(message).toContain("## Pattern Ledger");
      expect(message).toContain("pat-2026-01-01-001");
      expect(message).toContain("sentence-rhythm");
      expect(message).toContain("4 sightings");
      expect(message).toContain("Uses staccato rhythm");
    });

    test("renders the substrate trend block for a computable pattern", () => {
      const ledger: LedgerEntry[] = [
        {
          id: "pat-2026-01-01-001",
          statement: "Comma-heavy sentences",
          dimension: "sentence-structure",
          sightingCount: 5,
          trend: { metricKey: "commaRatePer1000", windowSize: 5, rollingMean: 12.345, direction: "up", magnitude: 2.5 },
        },
      ];
      const message = buildUserMessage(SAMPLE_ENTRY, stubMetrics, "", [], ledger);

      expect(message).toContain("Substrate trend");
      expect(message).toContain("commaRatePer1000");
      expect(message).toContain("12.345");
      expect(message).toContain("direction up");
    });

    test("omits the trend line for a qualitative pattern (no trend attached)", () => {
      const ledger: LedgerEntry[] = [
        { id: "pat-2026-01-01-001", statement: "Qualitative habit", dimension: "word-level-habits", sightingCount: 2 },
      ];
      const message = buildUserMessage(SAMPLE_ENTRY, stubMetrics, "", [], ledger);
      expect(message).not.toContain("Substrate trend");
    });

    test("ledger sits between the style profile and the metrics block", () => {
      const ledger: LedgerEntry[] = [
        { id: "pat-2026-01-01-001", statement: "X", dimension: "sentence-rhythm", sightingCount: 1 },
      ];
      const message = buildUserMessage(SAMPLE_ENTRY, stubMetrics, "Confirmed patterns.", [], ledger);

      const profilePos = message.indexOf("## Writer's Style Profile");
      const ledgerPos = message.indexOf("## Pattern Ledger");
      const metricsPos = message.indexOf("## Pre-computed Metrics");
      expect(profilePos).toBeLessThan(ledgerPos);
      expect(ledgerPos).toBeLessThan(metricsPos);
    });
  });
});

// --- buildLedger: recency cap and computable trend attachment (REQ-LPC-5/10) ---

describe("buildLedger", () => {
  test("excludes retired patterns", () => {
    const patterns = [
      makePattern({ id: "pat-1", status: "intentional" }),
      makePattern({ id: "pat-2", status: "retired" }),
    ];
    const ledger = buildLedger(patterns, [], 50);
    expect(ledger.map((e) => e.id)).toEqual(["pat-1"]);
  });

  test("orders active patterns by lastSightingAt, most recent first", () => {
    const patterns = [
      makePattern({ id: "pat-old", lastSightingAt: "2026-01-01T00:00:00.000Z" }),
      makePattern({ id: "pat-newest", lastSightingAt: "2026-01-03T00:00:00.000Z" }),
      makePattern({ id: "pat-mid", lastSightingAt: "2026-01-02T00:00:00.000Z" }),
    ];
    const ledger = buildLedger(patterns, [], 50);
    expect(ledger.map((e) => e.id)).toEqual(["pat-newest", "pat-mid", "pat-old"]);
  });

  test("caps the ledger at the configured size when more than the cap are active", () => {
    const patterns = Array.from({ length: 60 }, (_, i) =>
      makePattern({
        id: `pat-${String(i).padStart(3, "0")}`,
        lastSightingAt: new Date(2026, 0, i + 1).toISOString(),
      }),
    );

    const ledger = buildLedger(patterns, [], 50);
    expect(ledger).toHaveLength(50);

    // The 50 most recent by lastSightingAt survive; the 10 oldest are dropped.
    const survivingIds = new Set(ledger.map((e) => e.id));
    for (let i = 0; i < 10; i++) {
      expect(survivingIds.has(`pat-${String(i).padStart(3, "0")}`)).toBe(false);
    }
    expect(survivingIds.has(`pat-059`)).toBe(true);
  });

  test("attaches a substrate trend only for patterns with a valid metricLink", () => {
    const snapshot: MetricSnapshot = {
      entryId: "entry-1",
      date: "2026-01-01",
      metrics: computeEntryMetrics("Text, with, some, commas, here."),
      schemaVersion: 1,
    };
    const patterns = [
      makePattern({ id: "pat-computable", metricLink: "commaRatePer1000" }),
      makePattern({ id: "pat-qualitative" }),
      // Defensive fixture: a pattern that somehow got a corrupted/legacy
      // metricLink value that isn't a valid registry key. Cast past the
      // narrowed Pattern["metricLink"] type since production code guards
      // this at Zod-validation and observer-validation time, not here.
      makePattern({ id: "pat-bad-link", metricLink: "not-a-real-key" as Pattern["metricLink"] }),
    ];

    const ledger = buildLedger(patterns, [snapshot], 50);
    const byId = new Map(ledger.map((e) => [e.id, e]));

    expect(byId.get("pat-computable")?.trend).toBeDefined();
    expect(byId.get("pat-qualitative")?.trend).toBeUndefined();
    expect(byId.get("pat-bad-link")?.trend).toBeUndefined();
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

  test("accepts a patternRef citing an existing pattern", () => {
    const result = parseObserverOutput(
      JSON.stringify({
        observations: [
          {
            pattern: "test",
            evidence: "text",
            dimension: "sentence-rhythm",
            patternRef: { patternId: "pat-2026-01-01-001" },
          },
        ],
      }),
    );
    expect(result.success).toBe(true);
  });

  test("rejects a patternRef with both patternId and newPattern", () => {
    const result = parseObserverOutput(
      JSON.stringify({
        observations: [
          {
            pattern: "test",
            evidence: "text",
            dimension: "sentence-rhythm",
            patternRef: {
              patternId: "pat-2026-01-01-001",
              newPattern: { statement: "x", dimension: "sentence-rhythm" },
            },
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });
});

// --- Validation tests ---

describe("validateObservations", () => {
  const NEW_PATTERN_REF = {
    newPattern: { statement: "Some new pattern", dimension: "sentence-rhythm" as const },
  };

  test("accepts observations with evidence found in entry and a resolvable patternRef", () => {
    const observations: RawObservation[] = [
      {
        pattern: "Short sentence emphasis",
        evidence: "I stopped. I turned. I left.",
        dimension: "sentence-rhythm",
        patternRef: NEW_PATTERN_REF,
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
        patternRef: NEW_PATTERN_REF,
      },
    ];

    const result = validateObservations(observations, SAMPLE_ENTRY);
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("not found in entry text");
  });

  test("rejects observation with empty pattern (REQ-V1-5)", () => {
    const obs: RawObservation[] = [
      {
        pattern: "   ",
        evidence: "I stopped.",
        dimension: "sentence-rhythm",
        patternRef: NEW_PATTERN_REF,
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
        patternRef: NEW_PATTERN_REF,
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
        patternRef: NEW_PATTERN_REF,
      },
    ];

    const result = validateObservations(observations, SAMPLE_ENTRY);
    expect(result.valid).toHaveLength(1);
  });

  test("accepts paragraph-structure observation with evidence found in entry", () => {
    const observations: RawObservation[] = [
      {
        pattern: "Three single-sentence paragraphs isolate each action",
        evidence: "I stopped. I turned. I left.",
        dimension: "paragraph-structure",
        patternRef: { newPattern: { statement: "x", dimension: "paragraph-structure" } },
      },
    ];

    const result = validateObservations(observations, SAMPLE_ENTRY);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].dimension).toBe("paragraph-structure");
    expect(result.errors).toHaveLength(0);
  });

  test("rejects paragraph-structure observation with fabricated evidence", () => {
    const observations: RawObservation[] = [
      {
        pattern: "Long lead paragraph followed by shorter body",
        evidence: "This evidence text does not appear in the entry",
        dimension: "paragraph-structure",
        patternRef: { newPattern: { statement: "x", dimension: "paragraph-structure" } },
      },
    ];

    const result = validateObservations(observations, SAMPLE_ENTRY);
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("not found in entry text");
  });

  test("keeps valid observations and reports invalid ones separately", () => {
    const observations: RawObservation[] = [
      {
        pattern: "Valid pattern",
        evidence: "I stopped.",
        dimension: "sentence-rhythm",
        patternRef: NEW_PATTERN_REF,
      },
      {
        pattern: "Invalid pattern",
        evidence: "Not in the text at all",
        dimension: "word-level-habits",
        patternRef: NEW_PATTERN_REF,
      },
    ];

    const result = validateObservations(observations, SAMPLE_ENTRY);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.valid[0].pattern).toBe("Valid pattern");
  });

  // --- Phase 3: ledger integrity (REQ-LPC-2/4) ---

  describe("pattern ledger integrity", () => {
    const ledger: LedgerEntry[] = [
      { id: "pat-2026-01-01-001", statement: "Uses staccato rhythm", dimension: "sentence-rhythm", sightingCount: 3 },
    ];

    test("accepts a patternId present in the supplied ledger", () => {
      const observations: RawObservation[] = [
        {
          pattern: "Staccato rhythm again",
          evidence: "I stopped. I turned. I left.",
          dimension: "sentence-rhythm",
          patternRef: { patternId: "pat-2026-01-01-001" },
        },
      ];
      const result = validateObservations(observations, SAMPLE_ENTRY, ledger);
      expect(result.valid).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    test("rejects a patternId not present in the supplied ledger", () => {
      const observations: RawObservation[] = [
        {
          pattern: "Claims an unknown pattern",
          evidence: "I stopped. I turned. I left.",
          dimension: "sentence-rhythm",
          patternRef: { patternId: "pat-does-not-exist" },
        },
      ];
      const result = validateObservations(observations, SAMPLE_ENTRY, ledger);
      expect(result.valid).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("unknown pattern ID");
    });

    test("rejects an observation with no patternRef at all", () => {
      const observations: RawObservation[] = [
        {
          pattern: "No pattern reference supplied",
          evidence: "I stopped. I turned. I left.",
          dimension: "sentence-rhythm",
        },
      ];
      const result = validateObservations(observations, SAMPLE_ENTRY, ledger);
      expect(result.valid).toHaveLength(0);
      expect(result.errors[0]).toContain("Missing patternRef");
    });

    test("accepts a newPattern declaration regardless of ledger contents", () => {
      const observations: RawObservation[] = [
        {
          pattern: "A genuinely new habit",
          evidence: "I stopped. I turned. I left.",
          dimension: "sentence-rhythm",
          patternRef: { newPattern: { statement: "A brand new pattern", dimension: "sentence-rhythm" } },
        },
      ];
      const result = validateObservations(observations, SAMPLE_ENTRY, ledger);
      expect(result.valid).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    test("invalid metricLink on a new pattern downgrades to qualitative instead of rejecting", () => {
      const observations: RawObservation[] = [
        {
          pattern: "Claims a bogus metric link",
          evidence: "I stopped. I turned. I left.",
          dimension: "sentence-rhythm",
          patternRef: {
            newPattern: {
              statement: "A pattern with a bad metric link",
              dimension: "sentence-rhythm",
              metricLink: "not-a-real-metric-key",
            },
          },
        },
      ];
      const result = validateObservations(observations, SAMPLE_ENTRY, ledger);
      expect(result.errors).toHaveLength(0);
      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].patternRef?.newPattern?.metricLink).toBeUndefined();
    });

    test("a valid metricLink on a new pattern is preserved", () => {
      const observations: RawObservation[] = [
        {
          pattern: "Claims a real metric link",
          evidence: "I stopped. I turned. I left.",
          dimension: "sentence-rhythm",
          patternRef: {
            newPattern: {
              statement: "A pattern with a real metric link",
              dimension: "sentence-rhythm",
              metricLink: "commaRatePer1000",
            },
          },
        },
      ];
      const result = validateObservations(observations, SAMPLE_ENTRY, ledger);
      expect(result.errors).toHaveLength(0);
      expect(result.valid[0].patternRef?.newPattern?.metricLink).toBe("commaRatePer1000");
    });
  });
});

// --- Full observe pipeline test ---

describe("observe (pipeline)", () => {
  function makeStores(now: () => string) {
    const observationStore = createObservationStore({
      observationsDir: "/data/observations",
      fs: mockFs(),
      now,
    });
    const patternStore = createPatternStore({
      patternsDir: "/data/patterns",
      fs: mockPatternFs(),
      now,
    });
    return { observationStore, patternStore };
  }

  test("assembles prompt, calls runner, validates, resolves discoveries, and stores", async () => {
    const { observationStore, patternStore } = makeStores(() => "2026-03-27T10:00:00.000Z");

    const sessionRunner = createSessionRunner({
      queryFn: async (req) => {
        expect(req.system).toContain("pattern observer");
        expect(req.messages).toHaveLength(1);
        expect(req.messages[0].role).toBe("user");
        expect(req.messages[0].content).toContain("## Current Entry");
        expect(req.messages[0].content).toContain(SAMPLE_ENTRY);
        expect(req.messages[0].content).toContain("## Pre-computed Metrics");

        return { content: VALID_OBSERVER_JSON_WITH_REFS };
      },
    });

    const result = await observe(
      { sessionRunner, observationStore, patternStore, computeMetrics: computeEntryMetrics },
      "entry-2026-03-27-001",
      SAMPLE_ENTRY,
    );

    expect(result.observations).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(result.observations[0].id).toBe("obs-2026-03-27-001");
    expect(result.observations[0].entryId).toBe("entry-2026-03-27-001");
    expect(result.observations[0].patternId).toBeDefined();

    // Discovery created a candidate pattern with its first sighting.
    const patterns = await patternStore.list();
    expect(patterns).toHaveLength(2);
    for (const p of patterns) {
      expect(p.status).toBe("candidate");
      expect(p.sightingCount).toBe(1);
      expect(p.entryIds).toEqual(["entry-2026-03-27-001"]);
    }

    // result.discoveries is the exact field routes/entries.ts reads to emit
    // pattern:discovered — assert on it directly, not just via a follow-up
    // patternStore.list() read.
    expect(result.discoveries).toHaveLength(2);
    expect(result.discoveries.map((p) => p.id).sort()).toEqual(patterns.map((p) => p.id).sort());
    expect(result.discoveries.map((p) => p.statement).sort()).toEqual([
      "Hedges with 'just' before admitting a reaction",
      "Uses short sentences for emphasis",
    ]);
  });

  test("resolves an observation citing an existing pattern as a sighting, not a new pattern", async () => {
    const { observationStore, patternStore } = makeStores(() => "2026-03-27T10:00:00.000Z");
    const existing = await patternStore.create({
      statement: "Uses three consecutive short sentences for emphasis",
      dimension: "sentence-rhythm",
    });

    const output = JSON.stringify({
      observations: [
        {
          pattern: "Uses three consecutive short sentences for emphasis",
          evidence: "I stopped. I turned. I left.",
          dimension: "sentence-rhythm",
          patternRef: { patternId: existing.id },
        },
      ],
    });
    const sessionRunner = createSessionRunner({ queryFn: async () => ({ content: output }) });

    const result = await observe(
      { sessionRunner, observationStore, patternStore, computeMetrics: computeEntryMetrics },
      "entry-2026-03-27-002",
      SAMPLE_ENTRY,
    );

    expect(result.errors).toHaveLength(0);
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0].patternId).toBe(existing.id);

    // No new pattern created; the existing one gained a sighting.
    const patterns = await patternStore.list();
    expect(patterns).toHaveLength(1);
    expect(patterns[0].sightingCount).toBe(1);
    expect(patterns[0].entryIds).toEqual(["entry-2026-03-27-002"]);
  });

  test("rejects an observation citing a pattern ID not in the ledger passed to the prompt", async () => {
    const { observationStore, patternStore } = makeStores(() => "2026-03-27T10:00:00.000Z");

    const output = JSON.stringify({
      observations: [
        {
          pattern: "Claims a pattern the ledger never offered",
          evidence: "I stopped. I turned. I left.",
          dimension: "sentence-rhythm",
          patternRef: { patternId: "pat-does-not-exist" },
        },
      ],
    });
    const sessionRunner = createSessionRunner({ queryFn: async () => ({ content: output }) });

    const result = await observe(
      { sessionRunner, observationStore, patternStore, computeMetrics: computeEntryMetrics },
      "entry-2026-03-27-003",
      SAMPLE_ENTRY,
    );

    expect(result.observations).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("unknown pattern ID");
    expect(await patternStore.list()).toHaveLength(0);
  });

  test("stores a paragraph-structure observation from the LLM", async () => {
    const { observationStore, patternStore } = makeStores(() => "2026-04-21T10:00:00.000Z");

    const output = JSON.stringify({
      observations: [
        {
          pattern: "Three single-sentence paragraphs isolate each action",
          evidence: "I stopped. I turned. I left.",
          dimension: "paragraph-structure",
          patternRef: { newPattern: { statement: "Isolates actions with single-sentence paragraphs", dimension: "paragraph-structure" } },
        },
      ],
    });

    const sessionRunner = createSessionRunner({
      queryFn: async () => ({ content: output }),
    });

    const result = await observe(
      { sessionRunner, observationStore, patternStore, computeMetrics: computeEntryMetrics },
      "entry-2026-04-21-001",
      SAMPLE_ENTRY,
    );

    expect(result.errors).toHaveLength(0);
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0].dimension).toBe("paragraph-structure");
  });

  test("returns errors when LLM output has invalid evidence", async () => {
    const { observationStore, patternStore } = makeStores(() => "2026-03-27T10:00:00.000Z");

    const badOutput = JSON.stringify({
      observations: [
        {
          pattern: "Valid pattern",
          evidence: "I stopped.",
          dimension: "sentence-rhythm",
          patternRef: { newPattern: { statement: "x", dimension: "sentence-rhythm" } },
        },
        {
          pattern: "Fabricated evidence",
          evidence: "Text that doesn't exist in the entry",
          dimension: "word-level-habits",
          patternRef: { newPattern: { statement: "y", dimension: "word-level-habits" } },
        },
      ],
    });

    const sessionRunner = createSessionRunner({
      queryFn: async () => ({ content: badOutput }),
    });

    const result = await observe(
      { sessionRunner, observationStore, patternStore, computeMetrics: computeEntryMetrics },
      "entry-001",
      SAMPLE_ENTRY,
    );

    expect(result.observations).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("not found in entry text");
  });

  test("returns errors when LLM output is not valid JSON", async () => {
    const { observationStore, patternStore } = makeStores(() => "2026-03-27T10:00:00.000Z");

    const sessionRunner = createSessionRunner({
      queryFn: async () => ({ content: "Sorry, I can't help with that." }),
    });

    const result = await observe(
      { sessionRunner, observationStore, patternStore, computeMetrics: computeEntryMetrics },
      "entry-001",
      SAMPLE_ENTRY,
    );

    expect(result.observations).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Invalid JSON");
  });

  test("includes style profile when readStyleProfile is provided", async () => {
    const { observationStore, patternStore } = makeStores(() => "2026-03-27T10:00:00.000Z");

    let capturedMessage = "";
    const sessionRunner = createSessionRunner({
      queryFn: async (req) => {
        capturedMessage = req.messages[0].content;
        return { content: VALID_OBSERVER_JSON_WITH_REFS };
      },
    });

    await observe(
      {
        sessionRunner,
        observationStore,
        patternStore,
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

  test("includes the pattern ledger in the prompt when listSnapshots/patternStore have data", async () => {
    const { observationStore, patternStore } = makeStores(() => "2026-03-27T10:00:00.000Z");
    await patternStore.create({ statement: "Existing habit", dimension: "sentence-rhythm" });

    let capturedMessage = "";
    const sessionRunner = createSessionRunner({
      queryFn: async (req) => {
        capturedMessage = req.messages[0].content;
        return { content: VALID_OBSERVER_JSON_WITH_REFS };
      },
    });

    await observe(
      { sessionRunner, observationStore, patternStore, computeMetrics: computeEntryMetrics },
      "entry-002",
      SAMPLE_ENTRY,
    );

    expect(capturedMessage).toContain("## Pattern Ledger");
    expect(capturedMessage).toContain("Existing habit");
  });

  test("Tier 2 pipeline: activates when corpus >= 5 and includes recent entries", async () => {
    const { observationStore, patternStore } = makeStores(() => "2026-03-27T10:00:00.000Z");

    let capturedMessage = "";
    const sessionRunner = createSessionRunner({
      queryFn: async (req) => {
        capturedMessage = req.messages[0].content;
        return { content: VALID_OBSERVER_JSON_WITH_REFS };
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
        patternStore,
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

    expect(capturedMessage).toContain("## Recent Entries");
    expect(capturedMessage).toContain("First recent entry about morning routines.");
    expect(capturedMessage).toContain("Fifth recent entry about weekend plans.");

    const recentPos = capturedMessage.indexOf("## Recent Entries");
    const entryPos = capturedMessage.indexOf("## Current Entry");
    expect(recentPos).toBeLessThan(entryPos);

    expect(result.observations).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  test("Tier 2 pipeline: does NOT activate when corpus < 5", async () => {
    const { observationStore, patternStore } = makeStores(() => "2026-03-27T10:00:00.000Z");

    let capturedMessage = "";
    const sessionRunner = createSessionRunner({
      queryFn: async (req) => {
        capturedMessage = req.messages[0].content;
        return { content: VALID_OBSERVER_JSON_WITH_REFS };
      },
    });

    let recentEntriesCalled = false;
    const result = await observe(
      {
        sessionRunner,
        observationStore,
        patternStore,
        computeMetrics: computeEntryMetrics,
        corpusSize: async () => 3,
        recentEntries: async (_limit) => {
          recentEntriesCalled = true;
          return [{ id: "e1", body: "Should not appear" }];
        },
      },
      "entry-tier2-002",
      SAMPLE_ENTRY,
    );

    expect(capturedMessage).not.toContain("## Recent Entries");
    expect(recentEntriesCalled).toBe(false);

    expect(result.observations).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  test("uses precomputedMetrics instead of calling deps.computeMetrics (Phase 2 wiring)", async () => {
    const { observationStore, patternStore } = makeStores(() => "2026-07-10T10:00:00.000Z");

    let computeMetricsCalls = 0;
    const spyComputeMetrics = (text: string) => {
      computeMetricsCalls += 1;
      return computeEntryMetrics(text);
    };

    // A deliberately distinguishable precomputed value: if observe() ever
    // recomputed metrics from entryText instead of using this, the prompt
    // would show 0, not this marker value.
    const precomputed = computeEntryMetrics(SAMPLE_ENTRY);
    precomputed.rhythm.mean = 999;

    let capturedMessage = "";
    const runnerWithCapture = createSessionRunner({
      queryFn: async (req) => {
        capturedMessage = req.messages[0].content;
        return { content: VALID_OBSERVER_JSON_WITH_REFS };
      },
    });
    const sessionRunner = createSessionRunner({
      queryFn: async () => ({ content: VALID_OBSERVER_JSON_WITH_REFS }),
    });

    const result = await observe(
      { sessionRunner: runnerWithCapture, observationStore, patternStore, computeMetrics: spyComputeMetrics },
      "entry-precomputed-001",
      SAMPLE_ENTRY,
      precomputed,
    );

    expect(computeMetricsCalls).toBe(0);
    expect(capturedMessage).toContain("999");
    expect(result.errors).toHaveLength(0);

    // Sanity: omitting precomputedMetrics falls back to deps.computeMetrics,
    // so existing callers/tests that don't pass it are unaffected.
    const fallbackResult = await observe(
      { sessionRunner, observationStore, patternStore, computeMetrics: spyComputeMetrics },
      "entry-fallback-001",
      SAMPLE_ENTRY,
    );
    expect(computeMetricsCalls).toBe(1);
    expect(fallbackResult.errors).toHaveLength(0);
  });
});

// --- Phase 3 cost check regression guard (REQ-LPC-5/10) ---
//
// The plan's Phase 3 risk gate ("Cost check now, not at the end") required
// token-counting a full capped-ledger prompt against the spec's budget
// constraint (v1-core-loop.md: "Cost at daily journaling frequency must
// stay under $1.50/month on Sonnet"). That check was originally a one-off
// manual calculation (~4,594 tokens) with no committed test behind it. An
// independent re-derivation using a *true* worst case -- 50 patterns, all
// at the ledger cap, ALL with a valid metricLink so every one renders a
// substrate trend line (the maximally verbose ledger shape, not a mix of
// computable/qualitative) -- measured ~6,100-6,200 tokens (chars/4
// heuristic), about 33% higher than the original estimate. This test locks
// that worst-case construction in as a regression guard so a future change
// to buildSystemPrompt/buildUserMessage/buildLedger can't silently balloon
// the per-entry cost without a test failing first.
describe("Observer prompt cost budget (worst-case ledger)", () => {
  const LINKABLE_KEYS: LinkableMetricKey[] = [
    "avgSentenceLength",
    "sentenceLengthVariance",
    "passiveVoiceRatio",
    "fragmentCount",
    "singleSentenceParagraphCount",
    "commaRatePer1000",
    "semicolonRatePer1000",
    "colonRatePer1000",
    "dashRatePer1000",
    "parenthesisRatePer1000",
    "questionRatePer1000",
    "exclamationRatePer1000",
    "ellipsisRatePer1000",
  ];

  const DIMENSIONS: Pattern["dimension"][] = [
    "sentence-rhythm",
    "word-level-habits",
    "sentence-structure",
    "paragraph-structure",
  ];

  // Representative of the longer end of what the Observer's system prompt
  // asks the LLM to produce (see the "canonical statement" examples in
  // buildSystemPrompt) -- long enough to stress the token count without
  // being an artificially unbounded string. There is no schema-enforced
  // max length on Pattern.statement (packages/shared/src/patterns.ts only
  // requires non-empty), so this is a realistic upper bound, not the
  // theoretical one.
  const LONG_STATEMENT =
    "Opens paragraphs with a subordinate clause before naming the subject, deferring the topic sentence until the second or third sentence of the paragraph";

  function worstCaseLedgerPatterns(): Pattern[] {
    return Array.from({ length: DEFAULT_CONFIG.ledgerCap }, (_, i): Pattern => ({
      id: `pat-2026-01-${String((i % 28) + 1).padStart(2, "0")}-${String(i + 1).padStart(3, "0")}`,
      statement: LONG_STATEMENT,
      dimension: DIMENSIONS[i % DIMENSIONS.length],
      status: "intentional",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      sightingCount: 12,
      entryIds: ["entry-1", "entry-2", "entry-3", "entry-4", "entry-5", "entry-6"],
      lastSightingAt: new Date(2026, 0, i + 1).toISOString(),
      metricLink: LINKABLE_KEYS[i % LINKABLE_KEYS.length],
    }));
  }

  test("full worst-case ledger (50 capped patterns, all computable) has every entry rendered", () => {
    const patterns = worstCaseLedgerPatterns();
    const snapshot: MetricSnapshot = {
      entryId: "entry-1",
      date: "2026-01-01",
      metrics: computeEntryMetrics(SAMPLE_ENTRY),
      schemaVersion: 1,
    };

    const ledger = buildLedger(patterns, [snapshot], DEFAULT_CONFIG.ledgerCap);

    // Confirms this is the maximally verbose case the cost check assumes:
    // the cap binds (50 entries) and every entry has a rendered substrate
    // trend line (all computable, none qualitative).
    expect(ledger).toHaveLength(50);
    expect(ledger.every((entry) => entry.trend !== undefined)).toBe(true);
  });

  test("full worst-case prompt (system + user message) stays under the token budget", () => {
    const patterns = worstCaseLedgerPatterns();
    const snapshot: MetricSnapshot = {
      entryId: "entry-1",
      date: "2026-01-01",
      metrics: computeEntryMetrics(SAMPLE_ENTRY),
      schemaVersion: 1,
    };
    const ledger = buildLedger(patterns, [snapshot], DEFAULT_CONFIG.ledgerCap);

    const system = buildSystemPrompt();
    const message = buildUserMessage(SAMPLE_ENTRY, computeEntryMetrics(SAMPLE_ENTRY), "", [], ledger);
    const fullPrompt = `${system}\n\n${message}`;

    // chars/4 heuristic -- the same one used for the original manual cost
    // estimate this test replaces.
    const estimatedTokens = Math.ceil(fullPrompt.length / 4);

    // Budget derivation (see the file-level comment above for the finding
    // this guards against):
    //   - Spec constraint: < $1.50/month at daily journaling (~30
    //     entries/month) => roughly $0.05/entry all-in (input + output).
    //   - Sonnet pricing used by the plan's cost modeling: $3/MTok input,
    //     $15/MTok output (.lore/research/observer-history-window.md).
    //   - observe() caps LLM output at maxTokens: 2048, which costs
    //     ~$0.031 at Sonnet output rates in the absolute worst case,
    //     leaving ~$0.019 of the $0.05/entry budget for input -- about
    //     6,300 input tokens at $3/MTok.
    //   - Threshold: 7,000 tokens gives ~15% headroom over the measured
    //     worst case (~6,100-6,200 tokens) so ordinary prose tweaks don't
    //     trip the test, while still catching a change that meaningfully
    //     grows the ledger block or system prompt before it erodes the
    //     cost budget.
    const MAX_WORST_CASE_PROMPT_TOKENS = 7000;
    expect(estimatedTokens).toBeLessThan(MAX_WORST_CASE_PROMPT_TOKENS);
  });
});
