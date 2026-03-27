import { entryId } from "@ink-mirror/shared";
import { readdir, readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
const PREVIEW_LENGTH = 120;
/**
 * Generates a sequential entry ID for the given date.
 * Scans existing files to find the next sequence number.
 */
async function nextId(entriesDir, dateStr, fs) {
    let files;
    try {
        files = await fs.readdir(entriesDir);
    }
    catch {
        files = [];
    }
    const prefix = `entry-${dateStr}-`;
    let maxSeq = 0;
    for (const f of files) {
        if (f.startsWith(prefix) && f.endsWith(".md")) {
            const seqStr = f.slice(prefix.length, -3);
            const seq = parseInt(seqStr, 10);
            if (!isNaN(seq) && seq > maxSeq)
                maxSeq = seq;
        }
    }
    return entryId(`entry-${dateStr}-${String(maxSeq + 1).padStart(3, "0")}`);
}
/**
 * Serializes an entry to markdown with YAML frontmatter.
 * Files are human-readable (REQ-V1-3, REQ-V1-26).
 */
function toMarkdown(entry) {
    const lines = ["---", `id: ${entry.id}`, `date: ${entry.date}`];
    if (entry.title) {
        const escaped = entry.title.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        lines.push(`title: "${escaped}"`);
    }
    lines.push("---", "", entry.body, "");
    return lines.join("\n");
}
/**
 * Parses a markdown file with YAML frontmatter into an Entry.
 */
function fromMarkdown(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
    if (!match)
        return undefined;
    const frontmatter = match[1];
    const body = match[2].trimEnd();
    const id = frontmatter.match(/^id:\s*(.+)$/m)?.[1]?.trim();
    const date = frontmatter.match(/^date:\s*(.+)$/m)?.[1]?.trim();
    const titleMatch = frontmatter.match(/^title:\s*"((?:[^"\\]|\\.)*)"/m);
    const title = titleMatch
        ? titleMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\")
        : undefined;
    if (!id || !date)
        return undefined;
    return { id, date, ...(title ? { title } : {}), body };
}
function preview(body) {
    const firstLine = body.split("\n")[0];
    if (firstLine.length <= PREVIEW_LENGTH)
        return firstLine;
    return firstLine.slice(0, PREVIEW_LENGTH) + "...";
}
const realFs = {
    readdir: (p) => readdir(p),
    readFile: (p, enc) => readFile(p, enc),
    writeFile: (p, c) => writeFile(p, c, "utf-8"),
    mkdir: (p, o) => mkdir(p, o).then(() => { }),
    exists: (p) => access(p)
        .then(() => true)
        .catch(() => false),
};
export function createEntryStore(deps) {
    const { entriesDir } = deps;
    const fs = deps.fs ?? realFs;
    const now = deps.now ?? (() => new Date().toISOString().slice(0, 10));
    return {
        async create(body, title) {
            await fs.mkdir(entriesDir, { recursive: true });
            const dateStr = now();
            let id = await nextId(entriesDir, dateStr, fs);
            let filepath = join(entriesDir, `${id}.md`);
            // Guard against race condition: if file already exists, increment (F-03)
            while (await fs.exists(filepath)) {
                const seqStr = id.slice(-3);
                const nextSeq = parseInt(seqStr, 10) + 1;
                id = entryId(`entry-${dateStr}-${String(nextSeq).padStart(3, "0")}`);
                filepath = join(entriesDir, `${id}.md`);
            }
            const entry = {
                id: id,
                date: dateStr,
                ...(title ? { title } : {}),
                body,
            };
            await fs.writeFile(filepath, toMarkdown(entry));
            return entry;
        },
        async list() {
            let files;
            try {
                files = await fs.readdir(entriesDir);
            }
            catch {
                return [];
            }
            const mdFiles = files.filter((f) => f.endsWith(".md")).sort().reverse();
            const items = [];
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
        async get(id) {
            const filepath = join(entriesDir, `${id}.md`);
            try {
                const content = await fs.readFile(filepath, "utf-8");
                return fromMarkdown(content);
            }
            catch {
                return undefined;
            }
        },
    };
}
// Export parse/serialize for testing
export { toMarkdown, fromMarkdown };
