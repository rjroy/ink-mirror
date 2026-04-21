import type { Profile, ProfileRule, ObservationDimension } from "@ink-mirror/shared";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Filesystem operations needed by ProfileStore.
 * Same DI pattern as EntryStore and ObservationStore.
 */
export interface ProfileStoreFs {
  readFile(path: string, encoding: "utf-8"): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  mkdir(path: string, opts: { recursive: true }): Promise<void>;
}

export interface ProfileStore {
  get(): Promise<Profile>;
  save(profile: Profile): Promise<void>;
  getRule(ruleId: string): Promise<ProfileRule | undefined>;
  updateRule(ruleId: string, updates: { pattern?: string; dimension?: ObservationDimension }): Promise<ProfileRule | undefined>;
  deleteRule(ruleId: string): Promise<boolean>;
  addOrMergeRule(pattern: string, dimension: ObservationDimension): Promise<ProfileRule>;
  /** Render the profile as AI system prompt material (REQ-V1-23) */
  toPromptMarkdown(): Promise<string>;
  /** Replace the full profile from raw markdown (for PUT /profile) */
  replaceFromMarkdown(markdown: string): Promise<Profile>;
}

export interface ProfileStoreDeps {
  profilePath: string;
  fs?: ProfileStoreFs;
  now?: () => string;
}

const realFs: ProfileStoreFs = {
  readFile: (p, enc) => readFile(p, enc),
  writeFile: (p, c) => writeFile(p, c, "utf-8"),
  mkdir: (p, o) => mkdir(p, o).then(() => {}),
};

function emptyProfile(now: string): Profile {
  return { version: 1, updatedAt: now, rules: [] };
}

/** Shared dimension-to-label map used by both human markdown and LLM prompt rendering. */
const DIMENSION_LABELS: Record<string, string> = {
  "sentence-rhythm": "Sentence Rhythm",
  "word-level-habits": "Word-Level Habits",
  "sentence-structure": "Sentence Structure",
  "paragraph-structure": "Paragraph Structure",
};

/**
 * Generates a rule ID from the dimension and a sequence number.
 */
function nextRuleId(rules: ProfileRule[], dimension: ObservationDimension): string {
  const prefix = `rule-${dimension}-`;
  let maxSeq = 0;
  for (const r of rules) {
    if (r.id.startsWith(prefix)) {
      const seq = parseInt(r.id.slice(prefix.length), 10);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;
}

/**
 * Serialize a profile to markdown with YAML frontmatter.
 * Structured by dimension so both humans and LLMs can parse it.
 */
export function profileToMarkdown(profile: Profile): string {
  const lines: string[] = [
    "---",
    "version: 1",
    `updatedAt: ${profile.updatedAt}`,
    "---",
    "",
    "# Writing Style Profile",
    "",
  ];

  // Group rules by dimension
  const byDimension = new Map<string, ProfileRule[]>();
  for (const rule of profile.rules) {
    const existing = byDimension.get(rule.dimension) ?? [];
    existing.push(rule);
    byDimension.set(rule.dimension, existing);
  }

  if (byDimension.size === 0) {
    lines.push("*No patterns confirmed yet. Write entries and curate observations to build your profile.*");
    lines.push("");
  }

  for (const [dimension, rules] of byDimension) {
    const label = DIMENSION_LABELS[dimension] ?? dimension;
    lines.push(`## ${label}`);
    lines.push("");
    for (const rule of rules) {
      lines.push(`- **${rule.pattern}**`);
      lines.push(`  *${rule.sourceSummary}* <!-- id:${rule.id} created:${rule.createdAt} -->`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Map a section header back to a dimension key.
 * Checks exact label matches first, then fuzzy substring matches,
 * then falls back to raw dimension key (e.g. user writes "sentence-rhythm" as header).
 */
function headerToDimension(header: string): ObservationDimension | undefined {
  const lower = header.toLowerCase();
  // Exact label match
  for (const [dim, label] of Object.entries(DIMENSION_LABELS)) {
    if (lower === label.toLowerCase()) return dim as ObservationDimension;
  }
  // Substring match (handles e.g. "My Sentence Rhythm Notes")
  if (lower.includes("sentence rhythm")) return "sentence-rhythm";
  if (lower.includes("word-level") || lower.includes("word level")) return "word-level-habits";
  if (lower.includes("sentence structure")) return "sentence-structure";
  // Direct dimension key as header
  if (lower === "sentence-rhythm") return "sentence-rhythm";
  if (lower === "word-level-habits") return "word-level-habits";
  if (lower === "sentence-structure") return "sentence-structure";
  return undefined;
}

/**
 * Parse a profile markdown file back into a Profile object.
 * Handles both the structured format we generate and hand-edited versions.
 */
export function profileFromMarkdown(content: string): Profile | undefined {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) return undefined;

  const frontmatter = fmMatch[1];
  const body = fmMatch[2];

  const versionMatch = frontmatter.match(/^version:\s*(\d+)$/m);
  const updatedAtMatch = frontmatter.match(/^updatedAt:\s*(.+)$/m);

  const version = versionMatch ? parseInt(versionMatch[1], 10) : 1;
  if (version !== 1) return undefined;

  const updatedAt = updatedAtMatch?.[1]?.trim() ?? new Date().toISOString();

  const rules: ProfileRule[] = [];

  // Parse rules from markdown bullet points with embedded ID comments.
  // Format: - **pattern text**
  //           *source summary* <!-- id:rule-id created:timestamp -->
  const ruleRegex = /- \*\*(.+?)\*\*\n\s+\*(.+?)\*\s*<!-- id:(\S+)(?:\s+created:(\S+))? -->/g;

  // Determine current dimension from section headers
  const sections = body.split(/^## /m).filter(Boolean);

  for (const section of sections) {
    const headerEnd = section.indexOf("\n");
    if (headerEnd === -1) continue;

    const header = section.slice(0, headerEnd).trim();
    const sectionBody = section.slice(headerEnd + 1);

    // Reverse-map header to dimension via label lookup and direct key match
    const dimension = headerToDimension(header);

    if (!dimension) {
      // Check if section contains rule-formatted content that would be lost
      ruleRegex.lastIndex = 0;
      if (ruleRegex.test(sectionBody)) {
        console.warn(`Profile section "${header}" contains rules but doesn't match a known dimension. Rules in this section will be skipped.`);
      }
      continue;
    }

    ruleRegex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = ruleRegex.exec(sectionBody)) !== null) {
      const pattern = match[1].trim();
      const sourceSummary = match[2].trim();
      const id = match[3].trim();
      const createdAt = match[4]?.trim() ?? updatedAt;

      // Extract source count from summary
      const countMatch = sourceSummary.match(/(\d+)\s+entr/);
      const sourceCount = countMatch ? parseInt(countMatch[1], 10) : 1;

      rules.push({
        id,
        pattern,
        dimension,
        sourceCount,
        sourceSummary,
        createdAt,
        updatedAt,
      });
    }
  }

  return { version: 1, updatedAt, rules };
}

/**
 * Checks if two patterns likely describe the same writing characteristic.
 * Extracts a "core" by removing filler words and modifiers, then checks
 * if the cores overlap significantly (60%+ word overlap).
 */
export function patternsMatch(a: string, b: string): boolean {
  const normalize = (s: string) =>
    s.toLowerCase()
      .replace(/\b(uses?|tends? to|often|frequently|consistently|typically|for\s+\w+(\s+\w+)?)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const na = normalize(a);
  const nb = normalize(b);
  // Exact match, or one contains the other
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;

  // Extract significant words (3+ chars) and check overlap
  const wordsA = new Set(na.split(" ").filter((w) => w.length >= 3));
  const wordsB = new Set(nb.split(" ").filter((w) => w.length >= 3));
  if (wordsA.size === 0 || wordsB.size === 0) return false;

  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  const minSize = Math.min(wordsA.size, wordsB.size);
  // If at least 60% of the smaller set's words appear in the larger set, merge
  return minSize > 0 && overlap / minSize >= 0.6;
}

export function createProfileStore(deps: ProfileStoreDeps): ProfileStore {
  const { profilePath } = deps;
  const fs = deps.fs ?? realFs;
  const now = deps.now ?? (() => new Date().toISOString());

  async function read(): Promise<Profile> {
    try {
      const content = await fs.readFile(profilePath, "utf-8");
      return profileFromMarkdown(content) ?? emptyProfile(now());
    } catch {
      return emptyProfile(now());
    }
  }

  async function write(profile: Profile): Promise<void> {
    await fs.mkdir(dirname(profilePath), { recursive: true });
    await fs.writeFile(profilePath, profileToMarkdown(profile));
  }

  return {
    get: read,
    save: write,

    async getRule(ruleId: string): Promise<ProfileRule | undefined> {
      const profile = await read();
      return profile.rules.find((r) => r.id === ruleId);
    },

    async updateRule(
      ruleId: string,
      updates: { pattern?: string; dimension?: ObservationDimension },
    ): Promise<ProfileRule | undefined> {
      const profile = await read();
      const idx = profile.rules.findIndex((r) => r.id === ruleId);
      if (idx === -1) return undefined;

      const rule = profile.rules[idx];
      const updated: ProfileRule = {
        ...rule,
        ...(updates.pattern !== undefined ? { pattern: updates.pattern } : {}),
        ...(updates.dimension !== undefined ? { dimension: updates.dimension } : {}),
        updatedAt: now(),
      };
      profile.rules[idx] = updated;
      profile.updatedAt = now();
      await write(profile);
      return updated;
    },

    async deleteRule(ruleId: string): Promise<boolean> {
      const profile = await read();
      const idx = profile.rules.findIndex((r) => r.id === ruleId);
      if (idx === -1) return false;
      profile.rules.splice(idx, 1);
      profile.updatedAt = now();
      await write(profile);
      return true;
    },

    async addOrMergeRule(
      pattern: string,
      dimension: ObservationDimension,
    ): Promise<ProfileRule> {
      const profile = await read();

      // Check for existing rule covering the same pattern in the same dimension
      const existing = profile.rules.find(
        (r) => r.dimension === dimension && patternsMatch(r.pattern, pattern),
      );

      if (existing) {
        existing.sourceCount += 1;
        existing.sourceSummary = `Confirmed across ${existing.sourceCount} entries`;
        existing.updatedAt = now();
        profile.updatedAt = now();
        await write(profile);
        return existing;
      }

      // Create new rule via transformation
      const transformed = transformToStablePattern(pattern);
      const id = nextRuleId(profile.rules, dimension);
      const timestamp = now();

      const rule: ProfileRule = {
        id,
        pattern: transformed,
        dimension,
        sourceCount: 1,
        sourceSummary: "Confirmed across 1 entry",
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      profile.rules.push(rule);
      profile.updatedAt = timestamp;
      await write(profile);
      return rule;
    },

    async toPromptMarkdown(): Promise<string> {
      const profile = await read();
      if (profile.rules.length === 0) return "";

      // Format for LLM consumption: structured, no HTML comments
      const lines: string[] = [];

      const byDimension = new Map<string, ProfileRule[]>();
      for (const rule of profile.rules) {
        const existing = byDimension.get(rule.dimension) ?? [];
        existing.push(rule);
        byDimension.set(rule.dimension, existing);
      }

      for (const [dimension, rules] of byDimension) {
        const label = DIMENSION_LABELS[dimension] ?? dimension;
        lines.push(`### ${label}`);
        for (const rule of rules) {
          lines.push(`- ${rule.pattern} (${rule.sourceSummary.toLowerCase()})`);
        }
        lines.push("");
      }

      return lines.join("\n");
    },

    async replaceFromMarkdown(markdown: string): Promise<Profile> {
      const parsed = profileFromMarkdown(markdown);
      if (!parsed) {
        throw new Error("Invalid profile markdown format");
      }
      parsed.updatedAt = now();
      await write(parsed);
      return parsed;
    },
  };
}

/**
 * Transform an observation pattern into a stable characteristic.
 * Strips temporal references and entry-specific language.
 * Generalizes from instance ("used X in this entry") to characteristic ("uses X").
 */
export function transformToStablePattern(pattern: string): string {
  let result = pattern;

  // Strip temporal references
  result = result.replace(
    /\bin\s+(this|the|today'?s?|yesterday'?s?)\s+(entry|entries|writing|piece|paragraph)\b/gi,
    "",
  );
  // "in the March entry", "in the March 26 entry"
  result = result.replace(
    /\bin\s+the\s+(January|February|March|April|May|June|July|August|September|October|November|December)(\s+\d+)?\s*(entry|entries|writing|piece|paragraph)?\b/gi,
    "",
  );
  result = result.replace(
    /\b(on \w+ \d+,?\s*\d*)\b/gi,
    "",
  );
  result = result.replace(
    /\b(this entry|the entry|today'?s? entry|this piece)\b/gi,
    "",
  );

  // Convert past tense instances to present tense characteristics
  result = result.replace(/\bused\b/gi, "Uses");
  result = result.replace(/\brelied on\b/gi, "Relies on");
  result = result.replace(/\bemployed\b/gi, "Employs");
  result = result.replace(/\bfavored\b/gi, "Favors");
  result = result.replace(/\bshowed\b/gi, "Shows");
  result = result.replace(/\bdemonstrated\b/gi, "Demonstrates");
  result = result.replace(/\btended to\b/gi, "Tends to");

  // Clean up double spaces and trailing punctuation artifacts
  result = result.replace(/\s{2,}/g, " ").trim();
  // Remove leading/trailing commas or periods from cleanup
  result = result.replace(/^[,.\s]+/, "").replace(/[,\s]+$/, "").trim();

  // Ensure first letter is capitalized
  if (result.length > 0) {
    result = result[0].toUpperCase() + result.slice(1);
  }

  return result;
}
