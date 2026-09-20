import {
  observationId,
  ObservationDimensionSchema,
  type ObservationValidationDiagnostic,
  type ObservationValidationWarning,
  type ObservationId,
} from "@ink-mirror/shared";
import type {
  Observation,
  RawObservation,
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
  /**
   * `patternId` is required (REQ-LPC-2): every stored observation is a
   * sighting of a pattern, resolved by the caller (observer.ts) before
   * calling save — either matched against an existing ledger pattern or
   * assigned the ID of a pattern just created for it.
   */
  save(
    entryId: string,
    raw: RawObservation,
    patternId: string,
    validation?: ObservationValidation,
  ): Promise<Observation>;
  list(): Promise<Observation[]>;
  get(id: ObservationId): Promise<Observation | undefined>;
  /** Marks an entry's prior current observations as superseded, preserving
   * them as history while making exactly `currentObservationIds` current. */
  replaceCurrentForEntry?(entryId: string, currentObservationIds: string[]): Promise<void>;
  /**
   * Rewrites a stored observation's `patternId` (routes/patterns.ts detach
   * and merge, REQ-LPC-6 / planning decision 2). pattern-store.ts's
   * detachSighting/merge only update pattern-level counters; moving the
   * underlying sighting record's own patternId is this store's job, since
   * only it has file access to the sighting records themselves.
   */
  reassignPattern(id: ObservationId, patternId: string): Promise<Observation | undefined>;
}

export type ObservationValidation = Pick<
  Observation,
  "validationStatus" | "validationWarnings" | "validationDiagnostics"
>;

export interface ObservationStoreDeps {
  observationsDir: string;
  /**
   * Pre-Phase-3 directory (`observations/`, before the rename to
   * `sightings/`). Real user data already exists there with no `patternId`
   * field. `save()` never writes here; `get()`/`list()` fall back to it so
   * those files stay visible until Phase 5's migration moves them into
   * `observationsDir`. Omit for tests/fixtures that don't need legacy reads.
   */
  legacyObservationsDir?: string;
  fs?: ObservationStoreFs;
  now?: () => string;
}

/**
 * Serialize an observation to YAML.
 * Hand-rolled to avoid a YAML library dependency for a simple flat structure.
 */
export function toYaml(obs: Observation | (Omit<Observation, keyof ObservationValidation> & Partial<ObservationValidation>)): string {
  const validation: ObservationValidation = {
    validationStatus: obs.validationStatus ?? "verified",
    validationWarnings: obs.validationWarnings ?? [],
    validationDiagnostics: obs.validationDiagnostics ?? [],
  };
  const evidenceBlock = (fragment: string): string[] => {
    const endsWithNewline = fragment.endsWith("\n");
    const lines = fragment.split("\n");

    // The final empty segment represents the terminating newline itself. With
    // `|+`, that newline belongs to the scalar, so it must not be serialized
    // as an additional blank content line.
    if (endsWithNewline) lines.pop();

    return [
      `  - |${endsWithNewline ? "+" : "-"}`,
      ...lines.map((line) => `      ${line}`),
    ];
  };

  const lines = [
    `id: ${obs.id}`,
    `entryId: ${obs.entryId}`,
    `patternId: ${obs.patternId}`,
    `dimension: ${obs.dimension}`,
    `validationStatus: ${validation.validationStatus}`,
    `validationWarnings: ${JSON.stringify(validation.validationWarnings)}`,
    `validationDiagnostics: ${JSON.stringify(validation.validationDiagnostics)}`,
    ...(obs.supersededAt ? [`supersededAt: ${obs.supersededAt}`] : []),
    `createdAt: ${obs.createdAt}`,
    `updatedAt: ${obs.updatedAt}`,
    `pattern: |`,
    ...obs.pattern.split("\n").map((l) => `  ${l}`),
    `evidence:`,
    ...obs.evidence.flatMap(evidenceBlock),
    "",
  ];
  return lines.join("\n");
}

/** Sentinel `patternId` for a legacy file that predates the field entirely
 * (pre-Phase-3, no pattern-ledger link recorded). Not a real pattern ID —
 * Phase 5's migration is what gives these files genuine pattern linkage. */
const LEGACY_UNLINKED_PATTERN_ID = "";

/**
 * Parse a YAML observation file back into an Observation.
 *
 * `patternId` is optional in the source file: pre-Phase-3 legacy files (in
 * `legacyObservationsDir`) predate the field and never had one. Missing
 * `patternId` is a best-effort read, not a parse failure, so those files stay
 * visible via get()/list() until Phase 5 migrates them (see
 * ObservationStoreDeps.legacyObservationsDir).
 *
 * A stray `status:` line (every pre-migration legacy file has one; REQ-LPC-30
 * removed the field from the schema) is simply not looked for — it isn't
 * required and isn't returned. This keeps both fully-migrated files and any
 * legacy file migration.ts hasn't gotten to yet parseable through the same
 * code path.
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

  const blockList = (key: string): string[] | undefined => {
    const start = content.match(new RegExp(`^${key}:\\s*\\n`, "m"));
    if (!start || start.index === undefined) return undefined;

    const rest = content.slice(start.index + start[0].length);
    const lines = rest.split("\n");
    const values: string[] = [];
    let current: string[] | undefined;
    let chomping: "+" | "-" | undefined;

    const finishCurrent = () => {
      if (!current) return;
      const value = current.join("\n");
      // Existing files used the default clip mode and were historically
      // parsed with trimEnd(). Keep that behavior while recognizing the
      // explicit chomping modes written by current versions.
      values.push(chomping === "+" ? `${value}\n` : chomping === "-" ? value : value.trimEnd());
    };

    for (const line of lines) {
      const header = line.match(/^ {2}- \|([+-])?$/);
      if (header) {
        finishCurrent();
        current = [];
        chomping = header[1] as "+" | "-" | undefined;
      } else if (current && line.startsWith("      ")) {
        current.push(line.slice(6));
      } else if (line === "" && current) {
        // This is the document's line terminator, not scalar content. Blank
        // scalar lines emitted by toYaml retain their indentation above.
        continue;
      } else {
        break;
      }
    }
    finishCurrent();
    return values.length > 0 && values.every((value) => value.length > 0) ? values : undefined;
  };

  const id = scalar("id");
  const entryId = scalar("entryId");
  const patternId = scalar("patternId");
  const dimension = scalar("dimension");
  const validationStatus = scalar("validationStatus") ?? "verified";
  const validationWarnings = parseValidationWarnings(scalar("validationWarnings"));
  const validationDiagnostics = parseValidationDiagnostics(scalar("validationDiagnostics"));
  const createdAt = scalar("createdAt");
  const updatedAt = scalar("updatedAt");
  const supersededAt = scalar("supersededAt");
  const pattern = block("pattern");
  // Current files store an ordered YAML block-scalar list. Older files used
  // one block scalar, which remains readable as a single fragment.
  const legacyEvidence = block("evidence");
  const evidence = blockList("evidence") ?? (legacyEvidence ? [legacyEvidence] : undefined);

  if (!id || !entryId || !dimension || !createdAt || !updatedAt || !pattern || !evidence) {
    return undefined;
  }

  const parsedDimension = ObservationDimensionSchema.safeParse(dimension);

  if (!parsedDimension.success) {
    return undefined;
  }

  if (!validationWarnings || !validationDiagnostics || (validationStatus !== "verified" && validationStatus !== "unverified")) {
    return undefined;
  }

  return {
    id,
    entryId,
    patternId: patternId ?? LEGACY_UNLINKED_PATTERN_ID,
    dimension: parsedDimension.data,
    validationStatus,
    validationWarnings,
    validationDiagnostics,
    ...(supersededAt ? { supersededAt } : {}),
    createdAt,
    updatedAt,
    pattern,
    evidence,
  };
}

function parseValidationWarnings(content: string | undefined): ObservationValidationWarning[] | undefined {
  if (!content) return [];
  try {
    const parsed: unknown = JSON.parse(content);
    return Array.isArray(parsed) && parsed.every((warning) => warning === "evidence-not-found-in-entry")
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

function parseValidationDiagnostics(content: string | undefined): ObservationValidationDiagnostic[] | undefined {
  if (!content) return [];
  try {
    const parsed: unknown = JSON.parse(content);
    if (!Array.isArray(parsed)) return undefined;
    return parsed.every(
      (diagnostic): diagnostic is ObservationValidationDiagnostic =>
        typeof diagnostic === "object" &&
        diagnostic !== null &&
        diagnostic.code === "evidence-not-found-in-entry" &&
        typeof diagnostic.fragment === "string" && diagnostic.fragment.length > 0 &&
        typeof diagnostic.message === "string" && diagnostic.message.length > 0,
    ) ? parsed : undefined;
  } catch {
    return undefined;
  }
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

/** Reads and parses every `.yaml` file in `dir`, sorted by filename. Missing
 * directory yields an empty list rather than throwing (mirrors the previous
 * single-directory behavior). */
async function readObservationsIn(dir: string, fs: ObservationStoreFs): Promise<Observation[]> {
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    return [];
  }

  const yamlFiles = files.filter((f) => f.endsWith(".yaml")).sort();
  const observations: Observation[] = [];
  for (const file of yamlFiles) {
    const content = await fs.readFile(join(dir, file), "utf-8");
    const obs = fromYaml(content);
    if (obs) observations.push(obs);
  }
  return observations;
}

export function createObservationStore(deps: ObservationStoreDeps): ObservationStore {
  const { observationsDir, legacyObservationsDir } = deps;
  const fs = deps.fs ?? realFs;
  const now = deps.now ?? (() => new Date().toISOString());
  // Reflections save their candidate observations before replacing the entry's
  // current set. Serialize just that replacement phase per entry so two
  // completed reflections cannot each supersede the other's accepted set.
  const replacementQueues = new Map<string, Promise<void>>();

  const replaceCurrentForEntry = async (
    entryId: string,
    currentObservationIds: string[],
  ): Promise<void> => {
    const previous = replacementQueues.get(entryId) ?? Promise.resolve();
    const replacement = previous.catch(() => undefined).then(async () => {
      const currentIds = new Set(currentObservationIds);
      const observations = await store.list();
      const supersededAt = now();

      for (const observation of observations) {
        if (observation.entryId !== entryId) continue;

        const shouldBeCurrent = currentIds.has(observation.id);
        const isCurrent = !observation.supersededAt;
        if (shouldBeCurrent === isCurrent) continue;

        await fs.writeFile(
          join(observationsDir, `${observation.id}.yaml`),
          toYaml({
            ...observation,
            ...(shouldBeCurrent ? { supersededAt: undefined } : { supersededAt }),
          }),
        );
      }
    });

    replacementQueues.set(entryId, replacement);
    try {
      await replacement;
    } finally {
      if (replacementQueues.get(entryId) === replacement) {
        replacementQueues.delete(entryId);
      }
    }
  };

  const store: ObservationStore = {
    async save(
      entryId: string,
      raw: RawObservation,
      patternId: string,
      validation: ObservationValidation = {
        validationStatus: "verified",
        validationWarnings: [],
        validationDiagnostics: [],
      },
    ): Promise<Observation> {
      await fs.mkdir(observationsDir, { recursive: true });

      const dateStr = now().slice(0, 10);
      const id = await nextObsId(observationsDir, dateStr, fs);
      const timestamp = now();

      const obs: Observation = {
        id: id as string,
        entryId,
        patternId,
        pattern: raw.pattern,
        evidence: raw.evidence,
        dimension: raw.dimension,
        ...validation,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await fs.writeFile(join(observationsDir, `${id}.yaml`), toYaml(obs));
      return obs;
    },

    async list(): Promise<Observation[]> {
      // New dir first, so a file present in both wins over the stale legacy
      // copy when deduping by ID.
      const current = await readObservationsIn(observationsDir, fs);
      const seenIds = new Set(current.map((o) => o.id));

      if (!legacyObservationsDir) return current;

      const legacy = await readObservationsIn(legacyObservationsDir, fs);
      const legacyOnly = legacy.filter((o) => !seenIds.has(o.id));
      return [...current, ...legacyOnly];
    },

    async get(id: ObservationId): Promise<Observation | undefined> {
      try {
        const content = await fs.readFile(
          join(observationsDir, `${id}.yaml`),
          "utf-8",
        );
        return fromYaml(content);
      } catch {
        // Fall through to the legacy directory below.
      }

      if (!legacyObservationsDir) return undefined;

      try {
        const content = await fs.readFile(
          join(legacyObservationsDir, `${id}.yaml`),
          "utf-8",
        );
        return fromYaml(content);
      } catch {
        return undefined;
      }
    },

    async reassignPattern(id: ObservationId, patternId: string): Promise<Observation | undefined> {
      const obs = await this.get(id);
      if (!obs) return undefined;

      const updated: Observation = { ...obs, patternId, updatedAt: now() };

      await fs.writeFile(join(observationsDir, `${id}.yaml`), toYaml(updated));
      return updated;
    },

    replaceCurrentForEntry,
  };

  return store;
}
