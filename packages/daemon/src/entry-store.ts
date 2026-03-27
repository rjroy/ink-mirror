import { entryId, type EntryId } from "@ink-mirror/shared";
import type { Entry, EntryListItem } from "@ink-mirror/shared";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Filesystem operations needed by EntryStore.
 * Tests provide mock implementations; production uses node:fs.
 */
export interface EntryStoreFs {
  readdir(path: string): Promise<string[]>;
  readFile(path: string, encoding: "utf-8"): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  mkdir(path: string, opts: { recursive: true }): Promise<void>;
}

export interface EntryStore {
  create(body: string, title?: string): Promise<Entry>;
  list(): Promise<EntryListItem[]>;
  get(id: EntryId): Promise<Entry | undefined>;
}

export interface EntryStoreDeps {
  entriesDir: string;
  fs?: EntryStoreFs;
  /** Override for deterministic testing. Returns ISO date string (YYYY-MM-DD). */
  now?: () => string;
}

const PREVIEW_LENGTH = 120;

/**
 * Generates a sequential entry ID for the given date.
 * Scans existing files to find the next sequence number.
 */
async function nextId(
  entriesDir: string,
  dateStr: string,
  fs: EntryStoreFs,
): Promise<EntryId> {
  let files: string[];
  try {
    files = await fs.readdir(entriesDir);
  } catch {
    files = [];
  }

  const prefix = `entry-${dateStr}-`;
  let maxSeq = 0;
  for (const f of files) {
    if (f.startsWith(prefix) && f.endsWith(".md")) {
      const seqStr = f.slice(prefix.length, -3);
      const seq = parseInt(seqStr, 10);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  }

  return entryId(`entry-${dateStr}-${String(maxSeq + 1).padStart(3, "0")}`);
}

/**
 * Serializes an entry to markdown with YAML frontmatter.
 * Files are human-readable (REQ-V1-3, REQ-V1-26).
 */
function toMarkdown(entry: Entry): string {
  const lines = ["---", `id: ${entry.id}`, `date: ${entry.date}`];
  if (entry.title) lines.push(`title: "${entry.title}"`);
  lines.push("---", "", entry.body, "");
  return lines.join("\n");
}

/**
 * Parses a markdown file with YAML frontmatter into an Entry.
 */
function fromMarkdown(content: string): Entry | undefined {
  const match = content.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
  if (!match) return undefined;

  const frontmatter = match[1];
  const body = match[2].trimEnd();

  const id = frontmatter.match(/^id:\s*(.+)$/m)?.[1]?.trim();
  const date = frontmatter.match(/^date:\s*(.+)$/m)?.[1]?.trim();
  const titleMatch = frontmatter.match(/^title:\s*"?([^"]*)"?$/m);
  const title = titleMatch?.[1]?.trim();

  if (!id || !date) return undefined;

  return { id, date, ...(title ? { title } : {}), body };
}

function preview(body: string): string {
  const firstLine = body.split("\n")[0];
  if (firstLine.length <= PREVIEW_LENGTH) return firstLine;
  return firstLine.slice(0, PREVIEW_LENGTH) + "...";
}

const realFs: EntryStoreFs = {
  readdir: (p) => readdir(p),
  readFile: (p, enc) => readFile(p, enc),
  writeFile: (p, c) => writeFile(p, c, "utf-8"),
  mkdir: (p, o) => mkdir(p, o).then(() => {}),
};

export function createEntryStore(deps: EntryStoreDeps): EntryStore {
  const { entriesDir } = deps;
  const fs = deps.fs ?? realFs;
  const now = deps.now ?? (() => new Date().toISOString().slice(0, 10));

  return {
    async create(body: string, title?: string): Promise<Entry> {
      await fs.mkdir(entriesDir, { recursive: true });

      const dateStr = now();
      const id = await nextId(entriesDir, dateStr, fs);

      const entry: Entry = {
        id: id as string,
        date: dateStr,
        ...(title ? { title } : {}),
        body,
      };

      const filepath = join(entriesDir, `${id}.md`);
      await fs.writeFile(filepath, toMarkdown(entry));

      return entry;
    },

    async list(): Promise<EntryListItem[]> {
      let files: string[];
      try {
        files = await fs.readdir(entriesDir);
      } catch {
        return [];
      }

      const mdFiles = files.filter((f) => f.endsWith(".md")).sort().reverse();
      const items: EntryListItem[] = [];

      for (const file of mdFiles) {
        const content = await fs.readFile(join(entriesDir, file), "utf-8");
        const entry = fromMarkdown(content);
        if (entry) {
          items.push({
            id: entry.id,
            date: entry.date,
            ...(entry.title ? { title: entry.title } : {}),
            preview: preview(entry.body),
          });
        }
      }

      return items;
    },

    async get(id: EntryId): Promise<Entry | undefined> {
      const filepath = join(entriesDir, `${id}.md`);
      try {
        const content = await fs.readFile(filepath, "utf-8");
        return fromMarkdown(content);
      } catch {
        return undefined;
      }
    },
  };
}

// Export parse/serialize for testing
export { toMarkdown, fromMarkdown };
