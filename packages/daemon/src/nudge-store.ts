import { SavedNudgeSchema, type SavedNudge } from "@ink-mirror/shared";

/**
 * Filesystem operations needed by NudgeStore.
 * Minimal surface: no readdir because the store has no list operation.
 */
export interface NudgeStoreFs {
  readFile(path: string, encoding: "utf-8"): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  mkdir(path: string, opts: { recursive: true }): Promise<void>;
}

export interface NudgeStore {
  get(entryId: string): Promise<SavedNudge | undefined>;
  save(entryId: string, record: SavedNudge): Promise<void>;
}

export interface NudgeStoreDeps {
  nudgesDir: string;
  fs?: NudgeStoreFs;
}

/**
 * Serialize a saved nudge to YAML.
 * Hand-rolled to avoid a YAML dependency, mirroring observation-store style.
 * Field order is stable: entryId, contentHash, context, generatedAt, metrics, nudges.
 */
export function toYaml(record: SavedNudge): string {
  const lines: string[] = [];
  lines.push(`entryId: ${record.entryId}`);
  lines.push(`contentHash: ${record.contentHash}`);

  if (record.context.length === 0) {
    lines.push(`context: ""`);
  } else {
    lines.push(`context: |`);
    for (const l of record.context.split("\n")) lines.push(`  ${l}`);
  }

  lines.push(`generatedAt: ${record.generatedAt}`);

  lines.push(`metrics:`);
  lines.push(`  passiveRatio: ${record.metrics.passiveRatio}`);
  lines.push(`  totalSentences: ${record.metrics.totalSentences}`);
  lines.push(`  hedgingWordCount: ${record.metrics.hedgingWordCount}`);
  lines.push(`  rhythmVariance: ${record.metrics.rhythmVariance}`);

  lines.push(`nudges:`);
  for (const n of record.nudges) {
    lines.push(`  - craftPrinciple: ${n.craftPrinciple}`);
    lines.push(`    evidence: |`);
    for (const l of n.evidence.split("\n")) lines.push(`      ${l}`);
    lines.push(`    observation: |`);
    for (const l of n.observation.split("\n")) lines.push(`      ${l}`);
    lines.push(`    question: |`);
    for (const l of n.question.split("\n")) lines.push(`      ${l}`);
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Read a string field as either a `|` block literal or a double-quoted scalar.
 * Block content is dedented by `indent` spaces.
 */
function readStringField(
  content: string,
  key: string,
  indent: number,
): string | undefined {
  const indentStr = " ".repeat(indent);
  const blockRe = new RegExp(
    `^${key}:\\s*\\|\\s*\\n((?:${indentStr}.+\\n?)*)`,
    "m",
  );
  const blockMatch = content.match(blockRe);
  if (blockMatch) {
    return blockMatch[1]
      .split("\n")
      .map((l) => l.replace(new RegExp(`^${indentStr}`), ""))
      .join("\n")
      .trimEnd();
  }

  const quotedRe = new RegExp(`^${key}:\\s*"((?:[^"\\\\]|\\\\.)*)"\\s*$`, "m");
  const quotedMatch = content.match(quotedRe);
  if (quotedMatch) {
    return quotedMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }

  const plainRe = new RegExp(`^${key}:\\s+(.+)$`, "m");
  const plainMatch = content.match(plainRe);
  if (plainMatch) return plainMatch[1].trim();

  return undefined;
}

function readScalar(content: string, key: string): string | undefined {
  const m = content.match(new RegExp(`^${key}:\\s+(.+)$`, "m"));
  return m?.[1]?.trim();
}

function readContext(content: string): string | undefined {
  // Empty context is written as `context: ""`. The block regex requires
  // at least one indented content line, so the empty case must be matched
  // first by the quoted-scalar branch.
  const emptyRe = /^context:\s*""\s*$/m;
  if (emptyRe.test(content)) return "";
  return readStringField(content, "context", 2);
}

function readMetrics(content: string): Record<string, number> | undefined {
  const m = content.match(/^metrics:\s*\n((?:[ ]{2}\w+:\s+.+\n?)+)/m);
  if (!m) return undefined;

  const result: Record<string, number> = {};
  for (const line of m[1].split("\n")) {
    const lm = line.match(/^[ ]{2}(\w+):\s+(.+)$/);
    if (!lm) continue;
    const num = Number(lm[2]);
    if (Number.isNaN(num)) return undefined;
    result[lm[1]] = num;
  }
  return result;
}

interface ParsedNudge {
  craftPrinciple: string;
  evidence: string;
  observation: string;
  question: string;
}

function readNudges(content: string): ParsedNudge[] | undefined {
  const m = content.match(/^nudges:\s*\n([\s\S]*)$/m);
  if (!m) return undefined;

  const lines = m[1].split("\n");
  const groups: string[][] = [];
  let current: string[] | null = null;

  for (const line of lines) {
    if (line.startsWith("  - ")) {
      if (current) groups.push(current);
      current = [line];
    } else if (line.startsWith("    ") || line === "") {
      if (current) current.push(line);
    } else {
      // A non-indented line ends the nudges block.
      break;
    }
  }
  if (current) groups.push(current);

  const items: ParsedNudge[] = [];
  for (const g of groups) {
    // Dedent: strip "  - " from the first line and "    " from the rest,
    // so per-item field regexes can use a 2-space block indent.
    const text = g
      .map((l, i) => {
        if (i === 0) return l.replace(/^ {2}- /, "");
        if (l.startsWith("    ")) return l.slice(4);
        return l;
      })
      .join("\n");

    const craftPrinciple = readScalar(text, "craftPrinciple");
    const evidence = readStringField(text, "evidence", 2);
    const observation = readStringField(text, "observation", 2);
    const question = readStringField(text, "question", 2);

    if (
      craftPrinciple === undefined ||
      evidence === undefined ||
      observation === undefined ||
      question === undefined
    ) {
      return undefined;
    }
    items.push({ craftPrinciple, evidence, observation, question });
  }
  return items;
}

/**
 * Parse a YAML saved-nudge file. Returns undefined on malformed content.
 * Never throws; the route layer treats malformed records as cache misses.
 */
export function fromYaml(content: string): SavedNudge | undefined {
  const entryId = readScalar(content, "entryId");
  const contentHash = readScalar(content, "contentHash");
  const context = readContext(content);
  const generatedAt = readScalar(content, "generatedAt");
  const metrics = readMetrics(content);
  const nudges = readNudges(content);

  if (
    entryId === undefined ||
    contentHash === undefined ||
    context === undefined ||
    generatedAt === undefined ||
    metrics === undefined ||
    nudges === undefined
  ) {
    return undefined;
  }

  const candidate = {
    entryId,
    contentHash,
    context,
    generatedAt,
    metrics,
    nudges,
  };

  const parsed = SavedNudgeSchema.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
}

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const realFs: NudgeStoreFs = {
  readFile: (p, enc) => readFile(p, enc),
  writeFile: (p, c) => writeFile(p, c, "utf-8"),
  mkdir: (p, o) => mkdir(p, o).then(() => {}),
};

export function createNudgeStore(deps: NudgeStoreDeps): NudgeStore {
  const { nudgesDir } = deps;
  const fs = deps.fs ?? realFs;

  return {
    async get(entryId: string): Promise<SavedNudge | undefined> {
      try {
        const content = await fs.readFile(
          join(nudgesDir, `${entryId}.yaml`),
          "utf-8",
        );
        return fromYaml(content);
      } catch {
        return undefined;
      }
    },

    async save(entryId: string, record: SavedNudge): Promise<void> {
      await fs.mkdir(nudgesDir, { recursive: true });
      await fs.writeFile(join(nudgesDir, `${entryId}.yaml`), toYaml(record));
    },
  };
}
