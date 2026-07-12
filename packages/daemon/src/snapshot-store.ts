import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import * as YAML from "yaml";
import { MetricSnapshotSchema, type MetricSnapshot } from "@ink-mirror/shared";

/**
 * Filesystem operations needed by SnapshotStore.
 * Same interface pattern as NudgeStore/ObservationStore for consistency.
 */
export interface SnapshotStoreFs {
  readdir(path: string): Promise<string[]>;
  readFile(path: string, encoding: "utf-8"): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  mkdir(path: string, opts: { recursive: true }): Promise<void>;
}

export interface SnapshotStore {
  save(entryId: string, snapshot: MetricSnapshot): Promise<void>;
  get(entryId: string): Promise<MetricSnapshot | undefined>;
  /** All snapshots, ordered oldest-to-newest by `date`. */
  listAll(): Promise<MetricSnapshot[]>;
}

export interface SnapshotStoreDeps {
  snapshotsDir: string;
  fs?: SnapshotStoreFs;
}

/**
 * Serialize a metric snapshot to a `.yaml` file using the `yaml` package.
 *
 * MetricSnapshot nests arrays of objects and dynamic-key word-frequency
 * maps several levels deep (sentences, rhythm.paceChanges, wordFrequency's
 * token maps, sentenceStructure.paragraphOpeners, ...), which is beyond
 * what nudge-store/observation-store's hand-rolled block-literal grammar
 * supports. `YAML.stringify` is deterministic for plain objects with
 * stable key insertion order, so the byte-identical-output determinism
 * gate still holds.
 */
export function toYaml(snapshot: MetricSnapshot): string {
  return YAML.stringify(snapshot);
}

/**
 * Parse a snapshot `.yaml` file back into a MetricSnapshot.
 * Never throws; malformed or schema-invalid content is treated as absent,
 * matching the other stores' contract.
 */
export function fromYaml(content: string): MetricSnapshot | undefined {
  let parsed: unknown;
  try {
    parsed = YAML.parse(content);
  } catch {
    return undefined;
  }

  const result = MetricSnapshotSchema.safeParse(parsed);
  return result.success ? result.data : undefined;
}

const realFs: SnapshotStoreFs = {
  readdir: (p) => readdir(p),
  readFile: (p, enc) => readFile(p, enc),
  writeFile: (p, c) => writeFile(p, c, "utf-8"),
  mkdir: (p, o) => mkdir(p, o).then(() => {}),
};

export function createSnapshotStore(deps: SnapshotStoreDeps): SnapshotStore {
  const { snapshotsDir } = deps;
  const fs = deps.fs ?? realFs;

  return {
    async save(entryId: string, snapshot: MetricSnapshot): Promise<void> {
      await fs.mkdir(snapshotsDir, { recursive: true });
      await fs.writeFile(join(snapshotsDir, `${entryId}.yaml`), toYaml(snapshot));
    },

    async get(entryId: string): Promise<MetricSnapshot | undefined> {
      try {
        const content = await fs.readFile(
          join(snapshotsDir, `${entryId}.yaml`),
          "utf-8",
        );
        return fromYaml(content);
      } catch {
        return undefined;
      }
    },

    async listAll(): Promise<MetricSnapshot[]> {
      let files: string[];
      try {
        files = await fs.readdir(snapshotsDir);
      } catch {
        return [];
      }

      const yamlFiles = files.filter((f) => f.endsWith(".yaml"));
      const snapshots: MetricSnapshot[] = [];

      for (const file of yamlFiles) {
        const content = await fs.readFile(join(snapshotsDir, file), "utf-8");
        const snapshot = fromYaml(content);
        if (snapshot) snapshots.push(snapshot);
      }

      snapshots.sort((a, b) => a.date.localeCompare(b.date));
      return snapshots;
    },
  };
}
