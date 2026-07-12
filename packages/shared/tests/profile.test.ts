import { describe, test, expect } from "bun:test";
import {
  ProfileRuleSchema,
  ProfileSchema,
  UpdateProfileRuleRequestSchema,
  PutProfileRequestSchema,
  RuleProvenanceSchema,
} from "../src/profile.js";

describe("ProfileRuleSchema", () => {
  const validRule = {
    id: "rule-sentence-rhythm-001",
    pattern: "Uses staccato rhythm for emphasis",
    dimension: "sentence-rhythm",
    sourceCount: 3,
    sourceSummary: "Confirmed across 3 entries",
    createdAt: "2026-03-27T12:00:00.000Z",
    updatedAt: "2026-03-27T12:00:00.000Z",
  };

  test("accepts valid rule", () => {
    const result = ProfileRuleSchema.safeParse(validRule);
    expect(result.success).toBe(true);
  });

  test("rejects empty pattern", () => {
    const result = ProfileRuleSchema.safeParse({ ...validRule, pattern: "" });
    expect(result.success).toBe(false);
  });

  test("rejects zero sourceCount", () => {
    const result = ProfileRuleSchema.safeParse({ ...validRule, sourceCount: 0 });
    expect(result.success).toBe(false);
  });

  test("rejects invalid dimension", () => {
    const result = ProfileRuleSchema.safeParse({ ...validRule, dimension: "invalid" });
    expect(result.success).toBe(false);
  });

  test("accepts word-level-habits dimension", () => {
    const result = ProfileRuleSchema.safeParse({ ...validRule, dimension: "word-level-habits" });
    expect(result.success).toBe(true);
  });

  test("accepts a rule without patternId/provenance/baseline/lastSupportedAt (pre-migration shape)", () => {
    const result = ProfileRuleSchema.safeParse(validRule);
    expect(result.success).toBe(true);
  });

  test("accepts a rule with patternId, provenance, baseline, and lastSupportedAt (REQ-LPC-16/18/19)", () => {
    const result = ProfileRuleSchema.safeParse({
      ...validRule,
      patternId: "pat-2026-07-01-001",
      provenance: "evidence-confirmed",
      baseline: 12.5,
      lastSupportedAt: "2026-07-05T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  test("rejects an invalid provenance value", () => {
    const result = ProfileRuleSchema.safeParse({
      ...validRule,
      provenance: "writer-decided",
    });
    expect(result.success).toBe(false);
  });
});

describe("RuleProvenanceSchema", () => {
  test("accepts writer-asserted and evidence-confirmed", () => {
    expect(RuleProvenanceSchema.parse("writer-asserted")).toBe("writer-asserted");
    expect(RuleProvenanceSchema.parse("evidence-confirmed")).toBe("evidence-confirmed");
  });

  test("rejects anything else", () => {
    expect(() => RuleProvenanceSchema.parse("system-generated")).toThrow();
  });
});

describe("ProfileSchema", () => {
  test("accepts version 1 (pre-migration)", () => {
    const result = ProfileSchema.safeParse({
      version: 1,
      updatedAt: "2026-03-27T12:00:00.000Z",
      rules: [],
    });
    expect(result.success).toBe(true);
  });

  test("accepts version 2 (patternId/provenance/health metadata)", () => {
    const result = ProfileSchema.safeParse({
      version: 2,
      updatedAt: "2026-03-27T12:00:00.000Z",
      rules: [],
    });
    expect(result.success).toBe(true);
  });

  test("rejects version outside 1|2", () => {
    const result = ProfileSchema.safeParse({
      version: 3,
      updatedAt: "2026-03-27T12:00:00.000Z",
      rules: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("UpdateProfileRuleRequestSchema", () => {
  test("accepts pattern only", () => {
    const result = UpdateProfileRuleRequestSchema.safeParse({ pattern: "New pattern" });
    expect(result.success).toBe(true);
  });

  test("accepts dimension only", () => {
    const result = UpdateProfileRuleRequestSchema.safeParse({ dimension: "word-level-habits" });
    expect(result.success).toBe(true);
  });

  test("accepts both", () => {
    const result = UpdateProfileRuleRequestSchema.safeParse({
      pattern: "New pattern",
      dimension: "sentence-rhythm",
    });
    expect(result.success).toBe(true);
  });

  test("rejects empty pattern", () => {
    const result = UpdateProfileRuleRequestSchema.safeParse({ pattern: "" });
    expect(result.success).toBe(false);
  });
});

describe("PutProfileRequestSchema", () => {
  test("accepts markdown string", () => {
    const result = PutProfileRequestSchema.safeParse({ markdown: "---\nversion: 1\n---\n" });
    expect(result.success).toBe(true);
  });

  test("rejects missing markdown", () => {
    const result = PutProfileRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
