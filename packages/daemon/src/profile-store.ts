import { type Profile, type ProfileRule, type ObservationDimension, type RuleProvenance, DIMENSION_LABELS } from "@ink-mirror/shared";
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
  /**
   * Finds the rule (if any) linked to a given pattern ID (REQ-LPC-18: the
   * profile can answer "why does it say this?" — this is the pattern ->
   * rule direction of that link, complementing Pattern.ruleId).
   */
  getRuleByPatternId(patternId: string): Promise<ProfileRule | undefined>;
  /**
   * `metadata` links the created rule back to the pattern it came from,
   * records how it entered the profile (REQ-LPC-16/18), and (via
   * `distinctEntryCount`) the pattern's real evidence count (REQ-LPC-17/19)
   * — the caller already has the Pattern object (from patternStore) at the
   * point it calls this, so it passes `pattern.entryIds.length` rather than
   * profile-store.ts taking a patternStore dependency of its own.
   *
   * Matching an existing rule to merge into is by `patternId` (same pattern,
   * same dimension), not text similarity: every call site now passes the
   * pattern that produced the rule, so structural identity is both simpler
   * and more correct than the old word-overlap heuristic.
   */
  addOrMergeRule(
    pattern: string,
    dimension: ObservationDimension,
    metadata?: { patternId?: string; provenance?: RuleProvenance; distinctEntryCount?: number },
  ): Promise<ProfileRule>;
  /**
   * Reaffirms a rule's evidence is still current (REQ-LPC-19/20/21's
   * writer-driven counterpart to resurfacing): stamps `lastSupportedAt` to
   * now. Never called automatically — only in response to an explicit
   * writer action on a resurfaced rule. Returns undefined if the rule
   * doesn't exist.
   */
  reaffirmRule(ruleId: string): Promise<ProfileRule | undefined>;
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
    `version: ${profile.version}`,
    `updatedAt: ${profile.updatedAt}`,
    "---",
    "",
    "# Writing Style Profile",
    "",
  ];

  // Group rules by dimension
  const byDimension = new Map<ObservationDimension, ProfileRule[]>();
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
    const label = DIMENSION_LABELS[dimension];
    lines.push(`## ${label}`);
    lines.push("");
    for (const rule of rules) {
      // patternId/provenance/baseline/lastSupportedAt are appended to the
      // same comment only when present, so files written before Phase 4/5
      // (or by addOrMergeRule calls that don't pass metadata) keep the
      // shorter comment shape.
      const metaParts = [`id:${rule.id}`, `created:${rule.createdAt}`];
      if (rule.patternId) metaParts.push(`patternId:${rule.patternId}`);
      if (rule.provenance) metaParts.push(`provenance:${rule.provenance}`);
      if (rule.baseline !== undefined) metaParts.push(`baseline:${rule.baseline}`);
      if (rule.lastSupportedAt) metaParts.push(`lastSupportedAt:${rule.lastSupportedAt}`);

      lines.push(`- **${rule.pattern}**`);
      lines.push(`  *${rule.sourceSummary}* <!-- ${metaParts.join(" ")} -->`);
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
  if (lower.includes("paragraph structure")) return "paragraph-structure";
  // Direct dimension key as header
  if (lower === "sentence-rhythm") return "sentence-rhythm";
  if (lower === "word-level-habits") return "word-level-habits";
  if (lower === "sentence-structure") return "sentence-structure";
  if (lower === "paragraph-structure") return "paragraph-structure";
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
  // version 2 adds patternId/provenance/baseline/lastSupportedAt to rules
  // (REQ-LPC-18/19); both are valid input during the migration window
  // (ProfileSchema.version: z.union([z.literal(1), z.literal(2)])). A
  // literal reading of that union alone would still leave this guard
  // rejecting every migrated (version: 2) profile if it only checked `!== 1`.
  if (version !== 1 && version !== 2) return undefined;

  const updatedAt = updatedAtMatch?.[1]?.trim() ?? new Date().toISOString();

  const rules: ProfileRule[] = [];

  // Parse rules from markdown bullet points with embedded metadata comments.
  // Format: - **pattern text**
  //           *source summary* <!-- id:rule-id created:timestamp [patternId:pat-id] [provenance:writer-asserted] -->
  // The comment body is captured whole and parsed as key:value pairs below
  // (rather than positional groups) so old files (id/created only) and new
  // ones (plus patternId/provenance) both parse with the same regex.
  const ruleRegex = /- \*\*(.+?)\*\*\n\s+\*(.+?)\*\s*<!-- (.+?) -->/g;

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
      const meta = Object.fromEntries(
        [...match[3].matchAll(/(\w+):(\S+)/g)].map((m) => [m[1], m[2]]),
      );

      const id = meta.id;
      if (!id) continue; // malformed comment (no id): not a rule we can round-trip

      const createdAt = meta.created ?? updatedAt;
      const provenance =
        meta.provenance === "writer-asserted" || meta.provenance === "evidence-confirmed"
          ? meta.provenance
          : undefined;
      // baseline/lastSupportedAt (REQ-LPC-19/21): only kept when present and,
      // for baseline, numeric — a malformed or missing value is dropped
      // rather than propagating NaN into the parsed rule.
      const baseline = meta.baseline !== undefined ? Number(meta.baseline) : undefined;
      const lastSupportedAt = meta.lastSupportedAt;

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
        ...(meta.patternId ? { patternId: meta.patternId } : {}),
        ...(provenance ? { provenance } : {}),
        ...(baseline !== undefined && Number.isFinite(baseline) ? { baseline } : {}),
        ...(lastSupportedAt ? { lastSupportedAt } : {}),
      });
    }
  }

  return { version, updatedAt, rules };
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

    async getRuleByPatternId(patternId: string): Promise<ProfileRule | undefined> {
      const profile = await read();
      return profile.rules.find((r) => r.patternId === patternId);
    },

    async addOrMergeRule(
      pattern: string,
      dimension: ObservationDimension,
      metadata?: { patternId?: string; provenance?: RuleProvenance; distinctEntryCount?: number },
    ): Promise<ProfileRule> {
      const profile = await read();

      // Identity for "is this the same rule" is the linked pattern's ID, not
      // fuzzy text overlap (REQ-LPC-17 removes the old patternsMatch
      // word-overlap heuristic): every call site (routes/patterns.ts) now
      // passes the pattern that produced this rule, so structural identity
      // is both simpler and more correct than approximate wording match.
      // Without a patternId, there is nothing reliable to match against, so
      // every such call creates a new rule.
      const existing = metadata?.patternId
        ? profile.rules.find((r) => r.dimension === dimension && r.patternId === metadata.patternId)
        : undefined;

      // sourceCount/sourceSummary derive from the pattern's own distinct-entry
      // counter (REQ-LPC-17/19), not a naive per-call increment: the caller
      // passes `pattern.entryIds.length` (already fetched from patternStore),
      // so this always reflects real accumulated evidence rather than "how
      // many times addOrMergeRule happened to be called". Falls back to
      // preserving the existing rule's count, then to 1, for callers that
      // don't have a pattern's counters at hand (e.g. direct unit tests).
      const sourceCount = metadata?.distinctEntryCount ?? existing?.sourceCount ?? 1;
      const sourceSummary = `Confirmed across ${sourceCount} ${sourceCount === 1 ? "entry" : "entries"}`;

      if (existing) {
        existing.sourceCount = sourceCount;
        existing.sourceSummary = sourceSummary;
        existing.updatedAt = now();
        if (metadata?.patternId) existing.patternId = metadata.patternId;
        if (metadata?.provenance) existing.provenance = metadata.provenance;
        profile.updatedAt = now();
        await write(profile);
        return existing;
      }

      // Rule text is the pattern's own canonical statement, editable
      // afterward (REQ-V1-22) but not transformed on the way in — the
      // regex-based transformToStablePattern promotion path is removed
      // (REQ-LPC-17): every caller now passes an already-stable statement
      // (a Pattern's `statement` field), not a raw per-entry observation.
      const id = nextRuleId(profile.rules, dimension);
      const timestamp = now();

      const rule: ProfileRule = {
        id,
        pattern,
        dimension,
        sourceCount,
        sourceSummary,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...(metadata?.patternId ? { patternId: metadata.patternId } : {}),
        ...(metadata?.provenance ? { provenance: metadata.provenance } : {}),
      };

      profile.rules.push(rule);
      profile.updatedAt = timestamp;
      await write(profile);
      return rule;
    },

    async reaffirmRule(ruleId: string): Promise<ProfileRule | undefined> {
      const profile = await read();
      const idx = profile.rules.findIndex((r) => r.id === ruleId);
      if (idx === -1) return undefined;

      const timestamp = now();
      const updated: ProfileRule = { ...profile.rules[idx], lastSupportedAt: timestamp, updatedAt: timestamp };
      profile.rules[idx] = updated;
      profile.updatedAt = timestamp;
      await write(profile);
      return updated;
    },

    async toPromptMarkdown(): Promise<string> {
      const profile = await read();
      if (profile.rules.length === 0) return "";

      // Format for LLM consumption: structured, no HTML comments
      const lines: string[] = [];

      const byDimension = new Map<ObservationDimension, ProfileRule[]>();
      for (const rule of profile.rules) {
        const existing = byDimension.get(rule.dimension) ?? [];
        existing.push(rule);
        byDimension.set(rule.dimension, existing);
      }

      for (const [dimension, rules] of byDimension) {
        const label = DIMENSION_LABELS[dimension];
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
