import { observationId, type ObservationId } from "@ink-mirror/shared";
import type {
  Observation,
  RawObservation,
  CurationStatus,
} from "@ink-mirror/shared";

/**
 * Filesystem operations needed by ObservationStore.
 * Same interface pattern as EntryStore for consistency.
 */
export interface ObservationStoreFs {
  readdir(path: string): Promise<string[]>;
  readFile(path: string, encoding: "utf-8"): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  mkdir(path: string, opts: { recursive: true }): Promise<void>;
}

export interface ObservationStore {
  save(entryId: string, raw: RawObservation): Promise<Observation>;
  list(): Promise<Observation[]>;
  get(id: ObservationId): Promise<Observation | undefined>;
  updateStatus(id: ObservationId, status: CurationStatus): Promise<Observation | undefined>;
}

export interface ObservationStoreDeps {
  observationsDir: string;
  fs?: ObservationStoreFs;
  now?: () => string;
}

/**
 * Serialize an observation to YAML.
 * Hand-rolled to avoid a YAML library dependency for a simple flat structure.
 */
export function toYaml(obs: Observation): string {
  const lines = [
    `id: ${obs.id}`,
    `entryId: ${obs.entryId}`,
    `dimension: ${obs.dimension}`,
    `status: ${obs.status}`,
    `createdAt: ${obs.createdAt}`,
    `updatedAt: ${obs.updatedAt}`,
    `pattern: |`,
    ...obs.pattern.split("\n").map((l) => `  ${l}`),
    `evidence: |`,
    ...obs.evidence.split("\n").map((l) => `  ${l}`),
    "",
  ];
  return lines.join("\n");
}

/**
 * Parse a YAML observation file back into an Observation.
 */
export function fromYaml(content: string): Observation | undefined {
  const scalar = (key: string): string | undefined => {
    const m = content.match(new RegExp(`^${key}:\\s+(.+)$`, "m"));
    return m?.[1]?.trim();
  };

  const block = (key: string): string | undefined => {
    const m = content.match(new RegExp(`^${key}:\\s*\\|\\n((?:  .+\\n?)*)`, "m"));
    if (!m) return undefined;
    return m[1]
      .split("\n")
      .map((l) => l.replace(/^ {2}/, ""))
      .join("\n")
      .trimEnd();
  };

  const id = scalar("id");
  const entryId = scalar("entryId");
  const dimension = scalar("dimension");
  const status = scalar("status");
  const createdAt = scalar("createdAt");
  const updatedAt = scalar("updatedAt");
  const pattern = block("pattern");
  const evidence = block("evidence");

  if (!id || !entryId || !dimension || !status || !createdAt || !updatedAt || !pattern || !evidence) {
    return undefined;
  }

  return {
    id,
    entryId,
    dimension: dimension as Observation["dimension"],
    status: status as Observation["status"],
    createdAt,
    updatedAt,
    pattern,
    evidence,
  };
}

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const realFs: ObservationStoreFs = {
  readdir: (p) => readdir(p),
  readFile: (p, enc) => readFile(p, enc),
  writeFile: (p, c) => writeFile(p, c, "utf-8"),
  mkdir: (p, o) => mkdir(p, o).then(() => {}),
};

/**
 * Generates a sequential observation ID for the given date.
 */
async function nextObsId(
  dir: string,
  dateStr: string,
  fs: ObservationStoreFs,
): Promise<ObservationId> {
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    files = [];
  }

  const prefix = `obs-${dateStr}-`;
  let maxSeq = 0;
  for (const f of files) {
    if (f.startsWith(prefix) && f.endsWith(".yaml")) {
      const seqStr = f.slice(prefix.length, -5);
      const seq = parseInt(seqStr, 10);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  }

  return observationId(`obs-${dateStr}-${String(maxSeq + 1).padStart(3, "0")}`);
}

export function createObservationStore(deps: ObservationStoreDeps): ObservationStore {
  const { observationsDir } = deps;
  const fs = deps.fs ?? realFs;
  const now = deps.now ?? (() => new Date().toISOString());

  return {
    async save(entryId: string, raw: RawObservation): Promise<Observation> {
      await fs.mkdir(observationsDir, { recursive: true });

      const dateStr = now().slice(0, 10);
      const id = await nextObsId(observationsDir, dateStr, fs);
      const timestamp = now();

      const obs: Observation = {
        id: id as string,
        entryId,
        pattern: raw.pattern,
        evidence: raw.evidence,
        dimension: raw.dimension,
        status: "pending",
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await fs.writeFile(join(observationsDir, `${id}.yaml`), toYaml(obs));
      return obs;
    },

    async list(): Promise<Observation[]> {
      let files: string[];
      try {
        files = await fs.readdir(observationsDir);
      } catch {
        return [];
      }

      const yamlFiles = files.filter((f) => f.endsWith(".yaml")).sort();
      const observations: Observation[] = [];

      for (const file of yamlFiles) {
        const content = await fs.readFile(join(observationsDir, file), "utf-8");
        const obs = fromYaml(content);
        if (obs) observations.push(obs);
      }

      return observations;
    },

    async get(id: ObservationId): Promise<Observation | undefined> {
      try {
        const content = await fs.readFile(
          join(observationsDir, `${id}.yaml`),
          "utf-8",
        );
        return fromYaml(content);
      } catch {
        return undefined;
      }
    },

    async updateStatus(
      id: ObservationId,
      status: CurationStatus,
    ): Promise<Observation | undefined> {
      const obs = await this.get(id);
      if (!obs) return undefined;

      const updated: Observation = {
        ...obs,
        status,
        updatedAt: now(),
      };

      await fs.writeFile(
        join(observationsDir, `${id}.yaml`),
        toYaml(updated),
      );
      return updated;
    },
  };
}
