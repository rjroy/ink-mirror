import { describe, expect, test } from "bun:test";
import { entryId } from "@ink-mirror/shared";
import {
  createEntryStore,
  toMarkdown,
  fromMarkdown,
  type EntryStoreFs,
} from "../src/entry-store.js";

function mockFs(
  files: Record<string, string> = {},
): EntryStoreFs & { written: Record<string, string> } {
  const store: Record<string, string> = { ...files };
  const written: Record<string, string> = {};

  return {
    written,
    async readdir(path: string): Promise<string[]> {
      return Object.keys(store)
        .filter((k) => k.startsWith(path + "/"))
        .map((k) => k.slice(path.length + 1))
        .filter((k) => !k.includes("/"));
    },
    async readFile(path: string): Promise<string> {
      const content = store[path];
      if (content === undefined) throw new Error(`ENOENT: ${path}`);
      return content;
    },
    async writeFile(path: string, content: string): Promise<void> {
      store[path] = content;
      written[path] = content;
    },
    async mkdir(): Promise<void> {},
    async exists(path: string): Promise<boolean> {
      return path in store;
    },
  };
}

describe("toMarkdown", () => {
  test("serializes entry with title", () => {
    const md = toMarkdown({
      id: "entry-2026-03-27-001",
      date: "2026-03-27",
      title: "My Entry",
      body: "Some content here.",
    });
    expect(md).toContain("---");
    expect(md).toContain("id: entry-2026-03-27-001");
    expect(md).toContain("date: 2026-03-27");
    expect(md).toContain('title: "My Entry"');
    expect(md).toContain("Some content here.");
  });

  test("serializes entry without title", () => {
    const md = toMarkdown({
      id: "entry-2026-03-27-001",
      date: "2026-03-27",
      body: "Content",
    });
    expect(md).not.toContain("title:");
  });

  test("output is valid markdown readable by any text editor", () => {
    const md = toMarkdown({
      id: "entry-2026-03-27-001",
      date: "2026-03-27",
      title: "Test",
      body: "Line one.\n\nLine two.\n\n## Heading\n\nMore text.",
    });
    // Starts with YAML frontmatter
    expect(md.startsWith("---\n")).toBe(true);
    // Body follows frontmatter
    expect(md).toContain("---\n\nLine one.");
  });
});

describe("fromMarkdown", () => {
  test("parses entry with title", () => {
    const md = [
      "---",
      "id: entry-2026-03-27-001",
      "date: 2026-03-27",
      'title: "My Title"',
      "---",
      "",
      "Body text here.",
    ].join("\n");

    const entry = fromMarkdown(md);
    expect(entry).toBeDefined();
    expect(entry!.id).toBe("entry-2026-03-27-001");
    expect(entry!.date).toBe("2026-03-27");
    expect(entry!.title).toBe("My Title");
    expect(entry!.body).toBe("Body text here.");
  });

  test("parses entry without title", () => {
    const md = ["---", "id: entry-001", "date: 2026-03-27", "---", "", "Body."].join("\n");
    const entry = fromMarkdown(md);
    expect(entry).toBeDefined();
    expect(entry!.title).toBeUndefined();
  });

  test("returns undefined for invalid content", () => {
    expect(fromMarkdown("no frontmatter")).toBeUndefined();
  });

  test("returns undefined for missing id", () => {
    const md = ["---", "date: 2026-03-27", "---", "", "Body."].join("\n");
    expect(fromMarkdown(md)).toBeUndefined();
  });

  test("round-trips through toMarkdown and fromMarkdown", () => {
    const original = {
      id: "entry-2026-03-27-001",
      date: "2026-03-27",
      title: "Round Trip",
      body: "Multi-line\n\ncontent here.",
    };
    const parsed = fromMarkdown(toMarkdown(original));
    expect(parsed).toEqual(original);
  });

  test("handles title with double quotes (F-04)", () => {
    const original = {
      id: "entry-2026-03-27-001",
      date: "2026-03-27",
      title: 'She said "hello"',
      body: "Content.",
    };
    const md = toMarkdown(original);
    expect(md).toContain('title: "She said \\"hello\\""');

    const parsed = fromMarkdown(md);
    expect(parsed).toBeDefined();
    expect(parsed!.title).toBe('She said "hello"');
  });

  test("handles title with backslashes", () => {
    const original = {
      id: "entry-2026-03-27-001",
      date: "2026-03-27",
      title: "path\\to\\file",
      body: "Content.",
    };
    const md = toMarkdown(original);
    const parsed = fromMarkdown(md);
    expect(parsed).toBeDefined();
    expect(parsed!.title).toBe("path\\to\\file");
  });
});

describe("createEntryStore", () => {
  const entriesDir = "/test/entries";

  test("create writes a markdown file", async () => {
    const fs = mockFs();
    const store = createEntryStore({
      entriesDir,
      fs,
      now: () => "2026-03-27",
    });

    const entry = await store.create("Hello world.");
    expect(entry.id).toBe("entry-2026-03-27-001");
    expect(entry.date).toBe("2026-03-27");
    expect(entry.body).toBe("Hello world.");

    const writtenPath = `${entriesDir}/entry-2026-03-27-001.md`;
    expect(fs.written[writtenPath]).toBeDefined();
    expect(fs.written[writtenPath]).toContain("Hello world.");
  });

  test("create with title includes title in frontmatter", async () => {
    const fs = mockFs();
    const store = createEntryStore({
      entriesDir,
      fs,
      now: () => "2026-03-27",
    });

    const entry = await store.create("Content", "My Title");
    expect(entry.title).toBe("My Title");
    expect(fs.written[`${entriesDir}/entry-2026-03-27-001.md`]).toContain(
      'title: "My Title"',
    );
  });

  test("create increments sequence number", async () => {
    const fs = mockFs({
      [`${entriesDir}/entry-2026-03-27-001.md`]: "existing",
      [`${entriesDir}/entry-2026-03-27-002.md`]: "existing",
    });
    const store = createEntryStore({
      entriesDir,
      fs,
      now: () => "2026-03-27",
    });

    const entry = await store.create("Third entry");
    expect(entry.id).toBe("entry-2026-03-27-003");
  });

  test("list returns entries in reverse filename order", async () => {
    const mkEntry = (id: string, date: string, body: string) =>
      toMarkdown({ id, date, body });

    const fs = mockFs({
      [`${entriesDir}/entry-2026-03-26-001.md`]: mkEntry(
        "entry-2026-03-26-001",
        "2026-03-26",
        "First entry content.",
      ),
      [`${entriesDir}/entry-2026-03-27-001.md`]: mkEntry(
        "entry-2026-03-27-001",
        "2026-03-27",
        "Second entry content.",
      ),
    });
    const store = createEntryStore({ entriesDir, fs });

    const items = await store.list();
    expect(items).toHaveLength(2);
    // Reverse order: newest first
    expect(items[0].id).toBe("entry-2026-03-27-001");
    expect(items[1].id).toBe("entry-2026-03-26-001");
  });

  test("list returns empty array when directory missing", async () => {
    const fs = mockFs();
    // readdir will throw ENOENT for non-existent directory
    fs.readdir = async () => {
      throw new Error("ENOENT");
    };
    const store = createEntryStore({ entriesDir, fs });

    const items = await store.list();
    expect(items).toEqual([]);
  });

  test("list preview truncates long content", async () => {
    const longBody = "A".repeat(200);
    const fs = mockFs({
      [`${entriesDir}/entry-2026-03-27-001.md`]: toMarkdown({
        id: "entry-2026-03-27-001",
        date: "2026-03-27",
        body: longBody,
      }),
    });
    const store = createEntryStore({ entriesDir, fs });

    const items = await store.list();
    expect(items[0].preview.length).toBeLessThanOrEqual(123); // 120 + "..."
    expect(items[0].preview.endsWith("...")).toBe(true);
  });

  test("get returns entry by id", async () => {
    const fs = mockFs({
      [`${entriesDir}/entry-2026-03-27-001.md`]: toMarkdown({
        id: "entry-2026-03-27-001",
        date: "2026-03-27",
        title: "Found",
        body: "The content.",
      }),
    });
    const store = createEntryStore({ entriesDir, fs });

    const entry = await store.get(entryId("entry-2026-03-27-001"));
    expect(entry).toBeDefined();
    expect(entry!.id).toBe("entry-2026-03-27-001");
    expect(entry!.body).toBe("The content.");
  });

  test("get returns undefined for missing entry", async () => {
    const fs = mockFs();
    const store = createEntryStore({ entriesDir, fs });

    const entry = await store.get(entryId("entry-nonexistent"));
    expect(entry).toBeUndefined();
  });

  test("create then get round-trips", async () => {
    const fs = mockFs();
    const store = createEntryStore({
      entriesDir,
      fs,
      now: () => "2026-03-27",
    });

    const created = await store.create("Round trip content.", "Trip Title");
    const fetched = await store.get(entryId(created.id));

    expect(fetched).toEqual(created);
  });
});
