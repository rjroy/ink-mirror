import { observationId } from "@ink-mirror/shared";
/**
 * Serialize an observation to YAML.
 * Hand-rolled to avoid a YAML library dependency for a simple flat structure.
 */
export function toYaml(obs) {
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
export function fromYaml(content) {
    const scalar = (key) => {
        const m = content.match(new RegExp(`^${key}:\\s+(.+)$`, "m"));
        return m?.[1]?.trim();
    };
    const block = (key) => {
        const m = content.match(new RegExp(`^${key}:\\s*\\|\\n((?:  .+\\n?)*)`, "m"));
        if (!m)
            return undefined;
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
        dimension: dimension,
        status: status,
        createdAt,
        updatedAt,
        pattern,
        evidence,
    };
}
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
const realFs = {
    readdir: (p) => readdir(p),
    readFile: (p, enc) => readFile(p, enc),
    writeFile: (p, c) => writeFile(p, c, "utf-8"),
    mkdir: (p, o) => mkdir(p, o).then(() => { }),
};
/**
 * Generates a sequential observation ID for the given date.
 */
async function nextObsId(dir, dateStr, fs) {
    let files;
    try {
        files = await fs.readdir(dir);
    }
    catch {
        files = [];
    }
    const prefix = `obs-${dateStr}-`;
    let maxSeq = 0;
    for (const f of files) {
        if (f.startsWith(prefix) && f.endsWith(".yaml")) {
            const seqStr = f.slice(prefix.length, -5);
            const seq = parseInt(seqStr, 10);
            if (!isNaN(seq) && seq > maxSeq)
                maxSeq = seq;
        }
    }
    return observationId(`obs-${dateStr}-${String(maxSeq + 1).padStart(3, "0")}`);
}
export function createObservationStore(deps) {
    const { observationsDir } = deps;
    const fs = deps.fs ?? realFs;
    const now = deps.now ?? (() => new Date().toISOString());
    return {
        async save(entryId, raw) {
            await fs.mkdir(observationsDir, { recursive: true });
            const dateStr = now().slice(0, 10);
            const id = await nextObsId(observationsDir, dateStr, fs);
            const timestamp = now();
            const obs = {
                id: id,
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
        async list() {
            let files;
            try {
                files = await fs.readdir(observationsDir);
            }
            catch {
                return [];
            }
            const yamlFiles = files.filter((f) => f.endsWith(".yaml")).sort();
            const observations = [];
            for (const file of yamlFiles) {
                const content = await fs.readFile(join(observationsDir, file), "utf-8");
                const obs = fromYaml(content);
                if (obs)
                    observations.push(obs);
            }
            return observations;
        },
        async get(id) {
            try {
                const content = await fs.readFile(join(observationsDir, `${id}.yaml`), "utf-8");
                return fromYaml(content);
            }
            catch {
                return undefined;
            }
        },
        async updateStatus(id, status) {
            const obs = await this.get(id);
            if (!obs)
                return undefined;
            const updated = {
                ...obs,
                status,
                updatedAt: now(),
            };
            await fs.writeFile(join(observationsDir, `${id}.yaml`), toYaml(updated));
            return updated;
        },
    };
}
