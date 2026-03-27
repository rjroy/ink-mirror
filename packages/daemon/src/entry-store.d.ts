import { type EntryId } from "@ink-mirror/shared";
import type { Entry, EntryListItem } from "@ink-mirror/shared";
/**
 * Filesystem operations needed by EntryStore.
 * Tests provide mock implementations; production uses node:fs.
 */
export interface EntryStoreFs {
    readdir(path: string): Promise<string[]>;
    readFile(path: string, encoding: "utf-8"): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
    mkdir(path: string, opts: {
        recursive: true;
    }): Promise<void>;
    /** Returns true if the file exists. Used to guard against ID collisions. */
    exists(path: string): Promise<boolean>;
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
/**
 * Serializes an entry to markdown with YAML frontmatter.
 * Files are human-readable (REQ-V1-3, REQ-V1-26).
 */
declare function toMarkdown(entry: Entry): string;
/**
 * Parses a markdown file with YAML frontmatter into an Entry.
 */
declare function fromMarkdown(content: string): Entry | undefined;
export declare function createEntryStore(deps: EntryStoreDeps): EntryStore;
export { toMarkdown, fromMarkdown };
//# sourceMappingURL=entry-store.d.ts.map