import { describe, test, expect } from "bun:test";
import {
  createProfileStore,
  profileToMarkdown,
  profileFromMarkdown,
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

  // --- version 1/2 acceptance (REQ-LPC-18/19: migration produces version 2) ---

  test("accepts version 2 and reports it back on the parsed profile", () => {
    const md = [
      "---",
      "version: 2",
      "updatedAt: 2026-04-01T00:00:00.000Z",
      "---",
      "",
      "# Writing Style Profile",
      "",
      "## Sentence Rhythm",
      "",
      "- **Uses staccato rhythm**",
      "  *Confirmed across 1 entry* <!-- id:rule-sentence-rhythm-001 created:2026-04-01T00:00:00.000Z -->",
      "",
    ].join("\n");

    const parsed = profileFromMarkdown(md);
    expect(parsed).toBeDefined();
    expect(parsed!.version).toBe(2);
    expect(parsed!.rules).toHaveLength(1);
  });

  test("still accepts version 1 (pre-migration profiles keep parsing)", () => {
    const md = "---\nversion: 1\nupdatedAt: 2026-01-01T00:00:00.000Z\n---\n\n# Writing Style Profile\n";
    const parsed = profileFromMarkdown(md);
    expect(parsed).toBeDefined();
    expect(parsed!.version).toBe(1);
  });

  test("round-trip preserves version 2 rather than downgrading to 1", () => {
    const profile: Profile = { version: 2, updatedAt: FIXED_TIME, rules: [] };
    const md = profileToMarkdown(profile);
    expect(md).toContain("version: 2");
    const parsed = profileFromMarkdown(md);
    expect(parsed!.version).toBe(2);
  });

  // --- headerToDimension: paragraph-structure regression ---

  test("matches paragraph-structure when header uses the raw dimension key", () => {
    const md = [
      "---",
      "version: 1",
      "updatedAt: 2026-03-27T12:00:00.000Z",
      "---",
      "",
      "# Writing Style Profile",
      "",
      "## paragraph-structure",
      "",
      "- **Alternates short and long paragraphs**",
      "  *Confirmed across 1 entry* <!-- id:rule-paragraph-structure-001 -->",
      "",
    ].join("\n");

    const profile = profileFromMarkdown(md);
    expect(profile).toBeDefined();
    expect(profile!.rules).toHaveLength(1);
    expect(profile!.rules[0].dimension).toBe("paragraph-structure");
  });

  // --- baseline/lastSupportedAt round-trip (REQ-LPC-19/21) ---

  test("round-trips baseline and lastSupportedAt through the markdown comment", () => {
    const profile: Profile = {
      version: 2,
      updatedAt: FIXED_TIME,
      rules: [
        {
          id: "rule-sentence-rhythm-001",
          pattern: "Uses staccato rhythm for emphasis",
          dimension: "sentence-rhythm",
          sourceCount: 3,
          sourceSummary: "Confirmed across 3 entries",
          createdAt: FIXED_TIME,
          updatedAt: FIXED_TIME,
          patternId: "pat-2026-03-27-001",
          provenance: "evidence-confirmed",
          baseline: 12.5,
          lastSupportedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    };

    const md = profileToMarkdown(profile);
    expect(md).toContain("baseline:12.5");
    expect(md).toContain("lastSupportedAt:2026-04-01T00:00:00.000Z");

    const parsed = profileFromMarkdown(md);
    expect(parsed).toBeDefined();
    expect(parsed!.rules[0].baseline).toBe(12.5);
    expect(parsed!.rules[0].lastSupportedAt).toBe("2026-04-01T00:00:00.000Z");
  });

  test("baseline/lastSupportedAt are omitted from the comment when absent, and stay undefined on parse", () => {
    const profile: Profile = {
      version: 1,
      updatedAt: FIXED_TIME,
      rules: [
        {
          id: "rule-sentence-rhythm-001",
          pattern: "Uses staccato rhythm",
          dimension: "sentence-rhythm",
          sourceCount: 1,
          sourceSummary: "Confirmed across 1 entry",
          createdAt: FIXED_TIME,
          updatedAt: FIXED_TIME,
        },
      ],
    };

    const md = profileToMarkdown(profile);
    expect(md).not.toContain("baseline:");
    expect(md).not.toContain("lastSupportedAt:");

    const parsed = profileFromMarkdown(md);
    expect(parsed!.rules[0].baseline).toBeUndefined();
    expect(parsed!.rules[0].lastSupportedAt).toBeUndefined();
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
    test("creates a new rule using the pattern text as-is (no regex transform)", async () => {
      // REQ-LPC-17: the regex-based transformToStablePattern promotion path
      // is removed. Callers now always pass an already-canonical statement
      // (a Pattern's `statement` field), so addOrMergeRule stores it verbatim.
      const { store, files } = createTestStore();
      const rule = await store.addOrMergeRule(
        "Uses staccato rhythm for emphasis at paragraph endings",
        "sentence-rhythm",
      );
      expect(rule.id).toBe("rule-sentence-rhythm-001");
      expect(rule.pattern).toBe("Uses staccato rhythm for emphasis at paragraph endings");
      expect(rule.sourceCount).toBe(1);
      expect(rule.sourceSummary).toBe("Confirmed across 1 entry");
      expect(rule.dimension).toBe("sentence-rhythm");

      // Verify persisted
      const md = files.get(PROFILE_PATH);
      expect(md).toBeDefined();
      expect(md).toContain("Uses staccato rhythm for emphasis at paragraph endings");
    });

    test("without a patternId, two calls never merge even when the text is similar", async () => {
      // REQ-LPC-17: the old word-overlap heuristic (patternsMatch) is gone.
      // Identity is now structural (same patternId), so text similarity
      // alone no longer merges two calls into one rule.
      const { store } = createTestStore();
      await store.addOrMergeRule("Uses staccato rhythm", "sentence-rhythm");
      const second = await store.addOrMergeRule("Uses staccato rhythm for emphasis", "sentence-rhythm");

      expect(second.sourceCount).toBe(1);
      const profile = await store.get();
      expect(profile.rules).toHaveLength(2);
    });

    test("does not merge patterns from different dimensions", async () => {
      const { store } = createTestStore();
      await store.addOrMergeRule("Uses short patterns", "sentence-rhythm", { patternId: "pat-1" });
      const second = await store.addOrMergeRule(
        "Uses short patterns",
        "word-level-habits",
        { patternId: "pat-1" },
      );
      expect(second.id).toBe("rule-word-level-habits-001");
      expect(second.sourceCount).toBe(1);

      const profile = await store.get();
      expect(profile.rules).toHaveLength(2);
    });

    test("merges into the existing rule when called again with the same patternId", async () => {
      // Identity is by patternId + dimension, not text overlap: a second
      // call for the same pattern updates the existing rule in place,
      // taking sourceCount/sourceSummary from the caller's distinctEntryCount
      // (the pattern's real entryIds.length, REQ-LPC-17/19) rather than an
      // internal increment.
      const { store } = createTestStore();
      const first = await store.addOrMergeRule("Uses staccato rhythm", "sentence-rhythm", {
        patternId: "pat-2026-03-27-001",
        provenance: "writer-asserted",
        distinctEntryCount: 1,
      });
      expect(first.patternId).toBe("pat-2026-03-27-001");

      const merged = await store.addOrMergeRule(
        "Uses staccato rhythm for emphasis",
        "sentence-rhythm",
        { patternId: "pat-2026-03-27-001", provenance: "evidence-confirmed", distinctEntryCount: 4 },
      );

      // Same rule (merged, not a new one), sourceCount reflects the pattern's
      // real distinct-entry count, and provenance was updated.
      expect(merged.id).toBe(first.id);
      expect(merged.sourceCount).toBe(4);
      expect(merged.sourceSummary).toBe("Confirmed across 4 entries");
      expect(merged.patternId).toBe("pat-2026-03-27-001");
      expect(merged.provenance).toBe("evidence-confirmed");

      // Persisted, not just the in-memory return value.
      const profile = await store.get();
      expect(profile.rules).toHaveLength(1);
      expect(profile.rules[0].sourceCount).toBe(4);
      expect(profile.rules[0].provenance).toBe("evidence-confirmed");
    });

    test("generates sequential IDs per dimension", async () => {
      const { store } = createTestStore();
      const r1 = await store.addOrMergeRule("Uses staccato rhythm for emphasis", "sentence-rhythm");
      const r2 = await store.addOrMergeRule("Alternates between long flowing sentences and abrupt stops", "sentence-rhythm");
      expect(r1.id).toBe("rule-sentence-rhythm-001");
      expect(r2.id).toBe("rule-sentence-rhythm-002");
    });
  });

  describe("getRuleByPatternId", () => {
    test("finds the rule linked to a pattern", async () => {
      const { store } = createTestStore();
      await store.addOrMergeRule("Uses staccato rhythm", "sentence-rhythm", { patternId: "pat-1" });
      const found = await store.getRuleByPatternId("pat-1");
      expect(found).toBeDefined();
      expect(found!.patternId).toBe("pat-1");
    });

    test("returns undefined when no rule links to the pattern", async () => {
      const { store } = createTestStore();
      const found = await store.getRuleByPatternId("pat-nonexistent");
      expect(found).toBeUndefined();
    });
  });

  describe("reaffirmRule", () => {
    test("sets lastSupportedAt to now and persists it", async () => {
      const { store } = createTestStore();
      const rule = await store.addOrMergeRule("Uses staccato rhythm", "sentence-rhythm");
      expect(rule.lastSupportedAt).toBeUndefined();

      const reaffirmed = await store.reaffirmRule(rule.id);
      expect(reaffirmed).toBeDefined();
      expect(reaffirmed!.lastSupportedAt).toBe(FIXED_TIME);

      const profile = await store.get();
      expect(profile.rules[0].lastSupportedAt).toBe(FIXED_TIME);
    });

    test("returns undefined for a non-existent rule", async () => {
      const { store } = createTestStore();
      const result = await store.reaffirmRule("rule-nonexistent");
      expect(result).toBeUndefined();
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
