import { describe, test, expect } from "bun:test";
import {
  createProfileStore,
  profileToMarkdown,
  profileFromMarkdown,
  transformToStablePattern,
  patternsMatch,
} from "../src/profile-store.js";
import type { Profile } from "@ink-mirror/shared";

// --- In-memory filesystem for testing ---

function createMockFs() {
  const files = new Map<string, string>();
  return {
    fs: {
      readFile: async (path: string, _encoding: "utf-8") => {
        const content = files.get(path);
        if (content === undefined) throw new Error(`ENOENT: ${path}`);
        return content;
      },
      writeFile: async (path: string, content: string) => {
        files.set(path, content);
      },
      mkdir: async (_path: string, _opts: { recursive: true }) => {},
    },
    files,
  };
}

const PROFILE_PATH = "/test/data/profile.md";
const FIXED_TIME = "2026-03-27T12:00:00.000Z";

function createTestStore(files?: Map<string, string>) {
  const mock = createMockFs();
  if (files) {
    for (const [k, v] of files) mock.files.set(k, v);
  }
  return {
    store: createProfileStore({
      profilePath: PROFILE_PATH,
      fs: mock.fs,
      now: () => FIXED_TIME,
    }),
    files: mock.files,
  };
}

// --- transformToStablePattern ---

describe("transformToStablePattern", () => {
  test("strips 'in this entry' references", () => {
    const result = transformToStablePattern("Used short sentences in this entry for emphasis");
    expect(result).toBe("Uses short sentences for emphasis");
  });

  test("strips 'in the March entry' references", () => {
    const result = transformToStablePattern("Employed staccato rhythm in the March entry");
    expect(result).toBe("Employs staccato rhythm");
  });

  test("strips 'today's entry' references", () => {
    const result = transformToStablePattern("Relied on hedging words in today's entry");
    expect(result).toBe("Relies on hedging words");
  });

  test("converts past tense to present tense", () => {
    expect(transformToStablePattern("Used staccato rhythm")).toBe("Uses staccato rhythm");
    expect(transformToStablePattern("Relied on short sentences")).toBe("Relies on short sentences");
    expect(transformToStablePattern("Favored active voice")).toBe("Favors active voice");
    expect(transformToStablePattern("Showed tendency to hedge")).toBe("Shows tendency to hedge");
    expect(transformToStablePattern("Demonstrated variety in pacing")).toBe("Demonstrates variety in pacing");
    expect(transformToStablePattern("Tended to use filler words")).toBe("Tends to use filler words");
  });

  test("preserves already-present tense patterns", () => {
    const result = transformToStablePattern("Uses staccato rhythm for emphasis at paragraph endings");
    expect(result).toBe("Uses staccato rhythm for emphasis at paragraph endings");
  });

  test("handles combined temporal reference and tense", () => {
    const result = transformToStablePattern("Used four short sentences in the March 26 entry for emphasis");
    expect(result).toBe("Uses four short sentences for emphasis");
  });

  test("capitalizes first letter", () => {
    const result = transformToStablePattern("relies on hedging words");
    expect(result).toBe("Relies on hedging words");
  });

  test("cleans up extra whitespace", () => {
    const result = transformToStablePattern("Used   staccato   rhythm");
    expect(result).toBe("Uses staccato rhythm");
  });
});

// --- profileToMarkdown / profileFromMarkdown ---

describe("profileToMarkdown / profileFromMarkdown", () => {
  const sampleProfile: Profile = {
    version: 1,
    updatedAt: FIXED_TIME,
    rules: [
      {
        id: "rule-sentence-rhythm-001",
        pattern: "Uses staccato rhythm for emphasis at paragraph endings",
        dimension: "sentence-rhythm",
        sourceCount: 3,
        sourceSummary: "Confirmed across 3 entries",
        createdAt: FIXED_TIME,
        updatedAt: FIXED_TIME,
      },
      {
        id: "rule-word-level-habits-001",
        pattern: "Relies on hedging words ('just', 'probably') in technical writing",
        dimension: "word-level-habits",
        sourceCount: 2,
        sourceSummary: "Confirmed across 2 entries",
        createdAt: FIXED_TIME,
        updatedAt: FIXED_TIME,
      },
    ],
  };

  test("produces valid markdown with frontmatter", () => {
    const md = profileToMarkdown(sampleProfile);
    expect(md).toContain("---\nversion: 1");
    expect(md).toContain(`updatedAt: ${FIXED_TIME}`);
    expect(md).toContain("# Writing Style Profile");
  });

  test("groups rules by dimension section", () => {
    const md = profileToMarkdown(sampleProfile);
    expect(md).toContain("## Sentence Rhythm");
    expect(md).toContain("## Word-Level Habits");
  });

  test("renders paragraph-structure rule under 'Paragraph Structure' heading", () => {
    const profile: Profile = {
      version: 1,
      updatedAt: FIXED_TIME,
      rules: [
        {
          id: "rule-paragraph-structure-001",
          pattern: "Alternates short and long paragraphs across the entry",
          dimension: "paragraph-structure",
          sourceCount: 1,
          sourceSummary: "Confirmed across 1 entry",
          createdAt: FIXED_TIME,
          updatedAt: FIXED_TIME,
        },
      ],
    };
    const md = profileToMarkdown(profile);
    expect(md).toContain("## Paragraph Structure");
    // No raw-key fallback
    expect(md).not.toContain("## paragraph-structure");

    const parsed = profileFromMarkdown(md);
    expect(parsed).toBeDefined();
    expect(parsed!.rules).toHaveLength(1);
    expect(parsed!.rules[0].dimension).toBe("paragraph-structure");
  });

  test("includes rule patterns and source summaries", () => {
    const md = profileToMarkdown(sampleProfile);
    expect(md).toContain("**Uses staccato rhythm for emphasis at paragraph endings**");
    expect(md).toContain("*Confirmed across 3 entries*");
    expect(md).toContain(`<!-- id:rule-sentence-rhythm-001 created:${FIXED_TIME} -->`);

  });

  test("round-trips: serialize then parse preserves rules", () => {
    const md = profileToMarkdown(sampleProfile);
    const parsed = profileFromMarkdown(md);
    expect(parsed).toBeDefined();
    expect(parsed!.version).toBe(1);
    expect(parsed!.rules).toHaveLength(2);
    expect(parsed!.rules[0].pattern).toBe("Uses staccato rhythm for emphasis at paragraph endings");
    expect(parsed!.rules[0].dimension).toBe("sentence-rhythm");
    expect(parsed!.rules[0].sourceCount).toBe(3);
    expect(parsed!.rules[0].id).toBe("rule-sentence-rhythm-001");
    expect(parsed!.rules[1].pattern).toBe("Relies on hedging words ('just', 'probably') in technical writing");
    expect(parsed!.rules[1].dimension).toBe("word-level-habits");
  });

  test("empty profile produces placeholder text", () => {
    const empty: Profile = { version: 1, updatedAt: FIXED_TIME, rules: [] };
    const md = profileToMarkdown(empty);
    expect(md).toContain("No patterns confirmed yet");
  });

  test("returns undefined for non-markdown content", () => {
    expect(profileFromMarkdown("just some text")).toBeUndefined();
  });

  test("returns undefined for unsupported version", () => {
    const md = "---\nversion: 99\nupdatedAt: 2026-01-01\n---\n\n# Profile\n";
    expect(profileFromMarkdown(md)).toBeUndefined();
  });
});

// --- ProfileStore ---

describe("ProfileStore", () => {
  describe("get", () => {
    test("returns empty profile when file doesn't exist", async () => {
      const { store } = createTestStore();
      const profile = await store.get();
      expect(profile.version).toBe(1);
      expect(profile.rules).toHaveLength(0);
    });

    test("reads existing profile", async () => {
      const existing: Profile = {
        version: 1,
        updatedAt: FIXED_TIME,
        rules: [{
          id: "rule-sentence-rhythm-001",
          pattern: "Uses short sentences",
          dimension: "sentence-rhythm",
          sourceCount: 1,
          sourceSummary: "Confirmed across 1 entry",
          createdAt: FIXED_TIME,
          updatedAt: FIXED_TIME,
        }],
      };
      const files = new Map([[PROFILE_PATH, profileToMarkdown(existing)]]);
      const { store } = createTestStore(files);
      const profile = await store.get();
      expect(profile.rules).toHaveLength(1);
      expect(profile.rules[0].pattern).toBe("Uses short sentences");
    });
  });

  describe("addOrMergeRule", () => {
    test("creates new rule from observation pattern", async () => {
      const { store, files } = createTestStore();
      const rule = await store.addOrMergeRule(
        "Used staccato rhythm in this entry",
        "sentence-rhythm",
      );
      expect(rule.id).toBe("rule-sentence-rhythm-001");
      expect(rule.pattern).toBe("Uses staccato rhythm");
      expect(rule.sourceCount).toBe(1);
      expect(rule.sourceSummary).toBe("Confirmed across 1 entry");
      expect(rule.dimension).toBe("sentence-rhythm");

      // Verify persisted
      const md = files.get(PROFILE_PATH);
      expect(md).toBeDefined();
      expect(md).toContain("Uses staccato rhythm");
    });

    test("merges duplicate patterns by incrementing source count", async () => {
      const { store } = createTestStore();
      await store.addOrMergeRule("Uses staccato rhythm", "sentence-rhythm");
      const merged = await store.addOrMergeRule(
        "Uses staccato rhythm for emphasis",
        "sentence-rhythm",
      );
      expect(merged.sourceCount).toBe(2);
      expect(merged.sourceSummary).toBe("Confirmed across 2 entries");
    });

    test("does not merge patterns from different dimensions", async () => {
      const { store } = createTestStore();
      await store.addOrMergeRule("Uses short patterns", "sentence-rhythm");
      const second = await store.addOrMergeRule(
        "Uses short patterns",
        "word-level-habits",
      );
      expect(second.id).toBe("rule-word-level-habits-001");
      expect(second.sourceCount).toBe(1);

      const profile = await store.get();
      expect(profile.rules).toHaveLength(2);
    });

    test("generates sequential IDs per dimension", async () => {
      const { store } = createTestStore();
      const r1 = await store.addOrMergeRule("Uses staccato rhythm for emphasis", "sentence-rhythm");
      const r2 = await store.addOrMergeRule("Alternates between long flowing sentences and abrupt stops", "sentence-rhythm");
      expect(r1.id).toBe("rule-sentence-rhythm-001");
      expect(r2.id).toBe("rule-sentence-rhythm-002");
    });
  });

  describe("updateRule", () => {
    test("updates pattern text", async () => {
      const { store } = createTestStore();
      await store.addOrMergeRule("Uses staccato rhythm", "sentence-rhythm");
      const updated = await store.updateRule("rule-sentence-rhythm-001", {
        pattern: "Uses staccato rhythm for dramatic effect",
      });
      expect(updated).toBeDefined();
      expect(updated!.pattern).toBe("Uses staccato rhythm for dramatic effect");
    });

    test("returns undefined for non-existent rule", async () => {
      const { store } = createTestStore();
      const result = await store.updateRule("rule-nonexistent", { pattern: "x" });
      expect(result).toBeUndefined();
    });
  });

  describe("deleteRule", () => {
    test("removes existing rule", async () => {
      const { store } = createTestStore();
      await store.addOrMergeRule("Uses staccato rhythm", "sentence-rhythm");
      const deleted = await store.deleteRule("rule-sentence-rhythm-001");
      expect(deleted).toBe(true);

      const profile = await store.get();
      expect(profile.rules).toHaveLength(0);
    });

    test("returns false for non-existent rule", async () => {
      const { store } = createTestStore();
      const deleted = await store.deleteRule("rule-nonexistent");
      expect(deleted).toBe(false);
    });
  });

  describe("toPromptMarkdown", () => {
    test("returns empty string for empty profile", async () => {
      const { store } = createTestStore();
      const md = await store.toPromptMarkdown();
      expect(md).toBe("");
    });

    test("returns structured prompt material without HTML comments", async () => {
      const { store } = createTestStore();
      await store.addOrMergeRule("Uses staccato rhythm", "sentence-rhythm");
      await store.addOrMergeRule("Relies on hedging words", "word-level-habits");

      const md = await store.toPromptMarkdown();
      expect(md).toContain("### Sentence Rhythm");
      expect(md).toContain("- Uses staccato rhythm");
      expect(md).toContain("### Word-Level Habits");
      expect(md).toContain("- Relies on hedging words");
      // No HTML comments in prompt material
      expect(md).not.toContain("<!--");
    });
  });

  describe("replaceFromMarkdown", () => {
    test("replaces profile from valid markdown", async () => {
      const { store } = createTestStore();
      await store.addOrMergeRule("Old pattern", "sentence-rhythm");

      const newMd = [
        "---",
        "version: 1",
        "updatedAt: 2026-01-01T00:00:00.000Z",
        "---",
        "",
        "# Writing Style Profile",
        "",
        "## Sentence Rhythm",
        "",
        "- **New pattern from editor**",
        "  *Confirmed across 5 entries* <!-- id:rule-sentence-rhythm-001 -->",
        "",
      ].join("\n");

      const profile = await store.replaceFromMarkdown(newMd);
      expect(profile.rules).toHaveLength(1);
      expect(profile.rules[0].pattern).toBe("New pattern from editor");
      expect(profile.rules[0].sourceCount).toBe(5);
    });

    test("throws on invalid markdown", async () => {
      const { store } = createTestStore();
      await expect(store.replaceFromMarkdown("not markdown")).rejects.toThrow();
    });
  });
});

// --- patternsMatch (F6: direct unit tests for the merge heuristic) ---

describe("patternsMatch", () => {
  test("matches exact patterns after normalization", () => {
    expect(patternsMatch("Uses staccato rhythm", "uses staccato rhythm")).toBe(true);
  });

  test("matches when one contains the other", () => {
    expect(patternsMatch("Uses staccato rhythm", "Uses staccato rhythm for emphasis")).toBe(true);
  });

  test("matches patterns with high word overlap (>=60%)", () => {
    // "staccato rhythm paragraph endings" vs "staccato rhythm sentence endings"
    // shared: staccato, rhythm, endings (3/4 = 75%)
    expect(patternsMatch(
      "Uses staccato rhythm at paragraph endings",
      "Uses staccato rhythm at sentence endings",
    )).toBe(true);
  });

  test("does not match patterns with low word overlap (<60%)", () => {
    expect(patternsMatch(
      "Uses short sentences for emphasis",
      "Relies on hedging words in technical writing",
    )).toBe(false);
  });

  test("does not match when one pattern has only short words", () => {
    // After normalization and filtering words <3 chars, if nothing remains
    expect(patternsMatch("is a", "at on")).toBe(false);
  });

  test("handles filler word stripping ('uses', 'tends to', etc.)", () => {
    // After stripping "uses" and "tends to", core content should still compare
    expect(patternsMatch(
      "Uses hedging words in technical prose",
      "Tends to use hedging words in technical prose",
    )).toBe(true);
  });

  test("does not false-merge unrelated patterns with some shared words", () => {
    // Only 1 shared word out of 3+ = below threshold
    expect(patternsMatch(
      "Short sentences at paragraph breaks",
      "Long compound sentences with subordinate clauses",
    )).toBe(false);
  });
});

// --- profileFromMarkdown: unrecognized section handling (F5) ---

describe("profileFromMarkdown unrecognized sections", () => {
  test("preserves rules in sections with known headers", () => {
    const md = [
      "---",
      "version: 1",
      "updatedAt: 2026-03-27T12:00:00.000Z",
      "---",
      "",
      "# Writing Style Profile",
      "",
      "## Sentence Rhythm",
      "",
      "- **Uses staccato rhythm**",
      `  *Confirmed across 3 entries* <!-- id:rule-sentence-rhythm-001 created:2026-03-20T00:00:00.000Z -->`,
      "",
    ].join("\n");

    const profile = profileFromMarkdown(md);
    expect(profile).toBeDefined();
    expect(profile!.rules).toHaveLength(1);
  });

  test("skips rules in sections with unrecognized headers", () => {
    const md = [
      "---",
      "version: 1",
      "updatedAt: 2026-03-27T12:00:00.000Z",
      "---",
      "",
      "# Writing Style Profile",
      "",
      "## My Custom Section",
      "",
      "- **Some pattern**",
      "  *Confirmed across 1 entry* <!-- id:rule-custom-001 -->",
      "",
    ].join("\n");

    const profile = profileFromMarkdown(md);
    expect(profile).toBeDefined();
    expect(profile!.rules).toHaveLength(0);
  });

  test("matches dimension when header uses raw dimension key", () => {
    const md = [
      "---",
      "version: 1",
      "updatedAt: 2026-03-27T12:00:00.000Z",
      "---",
      "",
      "# Writing Style Profile",
      "",
      "## sentence-rhythm",
      "",
      "- **Uses staccato rhythm**",
      `  *Confirmed across 1 entry* <!-- id:rule-sentence-rhythm-001 -->`,
      "",
    ].join("\n");

    const profile = profileFromMarkdown(md);
    expect(profile).toBeDefined();
    expect(profile!.rules).toHaveLength(1);
    expect(profile!.rules[0].dimension).toBe("sentence-rhythm");
  });
});

// --- createdAt round-trip (F8) ---

describe("profileToMarkdown / profileFromMarkdown createdAt preservation", () => {
  test("preserves createdAt through markdown round-trip", () => {
    const profile: Profile = {
      version: 1,
      updatedAt: "2026-03-27T12:00:00.000Z",
      rules: [{
        id: "rule-sentence-rhythm-001",
        pattern: "Uses staccato rhythm",
        dimension: "sentence-rhythm",
        sourceCount: 1,
        sourceSummary: "Confirmed across 1 entry",
        createdAt: "2026-03-20T00:00:00.000Z",
        updatedAt: "2026-03-27T12:00:00.000Z",
      }],
    };

    const md = profileToMarkdown(profile);
    expect(md).toContain("created:2026-03-20T00:00:00.000Z");

    const parsed = profileFromMarkdown(md);
    expect(parsed).toBeDefined();
    expect(parsed!.rules[0].createdAt).toBe("2026-03-20T00:00:00.000Z");
    expect(parsed!.rules[0].updatedAt).toBe("2026-03-27T12:00:00.000Z");
  });

  test("falls back to updatedAt when createdAt not in comment (old format)", () => {
    const md = [
      "---",
      "version: 1",
      "updatedAt: 2026-03-27T12:00:00.000Z",
      "---",
      "",
      "# Writing Style Profile",
      "",
      "## Sentence Rhythm",
      "",
      "- **Uses staccato rhythm**",
      "  *Confirmed across 1 entry* <!-- id:rule-sentence-rhythm-001 -->",
      "",
    ].join("\n");

    const parsed = profileFromMarkdown(md);
    expect(parsed).toBeDefined();
    expect(parsed!.rules[0].createdAt).toBe("2026-03-27T12:00:00.000Z");
  });
});
