import { describe, expect, test } from "bun:test";
import type { Pattern, Sighting } from "@ink-mirror/shared";
import {
  createPatternStore,
  toYaml,
  fromYaml,
  type PatternStoreFs,
} from "../src/pattern-store.js";

function mockFs(): PatternStoreFs & { files: Record<string, string> } {
  const files: Record<string, string> = {};

  return {
    files,
    async readdir(path: string): Promise<string[]> {
      const prefix = path.endsWith("/") ? path : path + "/";
      return Object.keys(files)
        .filter((f) => f.startsWith(prefix))
        .map((f) => f.slice(prefix.length))
        .filter((f) => !f.includes("/"));
    },
    async readFile(path: string): Promise<string> {
      if (!(path in files)) throw new Error(`ENOENT: ${path}`);
      return files[path];
    },
    async writeFile(path: string, content: string): Promise<void> {
      files[path] = content;
    },
    async mkdir(): Promise<void> {},
  };
}

function makePattern(overrides: Partial<Pattern> = {}): Pattern {
  return {
    id: "pat-2026-01-01-001",
    statement: "Uses short declarative sentences for emphasis.",
    dimension: "sentence-rhythm",
    status: "candidate",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    sightingCount: 0,
    entryIds: [],
    ...overrides,
  };
}

function makeSighting(overrides: Partial<Sighting> = {}): Sighting {
  return {
    id: "sight-001",
    patternId: "pat-2026-01-01-001",
    entryId: "entry-1",
    evidence: ["some evidence"],
    dimension: "sentence-rhythm",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("YAML serialization", () => {
  test("round-trips a pattern with nested watch/retirement through toYaml/fromYaml", () => {
    const pattern = makePattern({
      metricLink: "commaRatePer1000",
      lastSightingAt: "2026-01-02T00:00:00.000Z",
      sightingCount: 3,
      entryIds: ["entry-1", "entry-2"],
      watch: { classifiedAt: "2026-01-03T00:00:00.000Z", baseline: 1.5, resolved: false },
      retirement: { dismissedAsWrong: true },
      ruleId: "rule-001",
    });

    const yaml = toYaml(pattern);
    const parsed = fromYaml(yaml);
    expect(parsed).toEqual(pattern);
  });

  test("returns undefined for invalid YAML", () => {
    expect(fromYaml("not: [valid, pattern, shape")).toBeUndefined();
  });

  test("returns undefined when parsed content fails schema validation", () => {
    expect(fromYaml("id: pat-1\nstatement: x\n")).toBeUndefined();
  });
});

describe("pattern store: create", () => {
  test("creates a candidate pattern with sequential ID", async () => {
    const fs = mockFs();
    const store = createPatternStore({
      patternsDir: "/data/patterns",
      fs,
      now: () => "2026-03-27T10:00:00.000Z",
    });

    const pattern = await store.create({
      statement: "Uses staccato rhythm at paragraph endings",
      dimension: "sentence-rhythm",
    });

    expect(pattern.id).toBe("pat-2026-03-27-001");
    expect(pattern.status).toBe("candidate");
    expect(pattern.sightingCount).toBe(0);
    expect(pattern.entryIds).toEqual([]);
    expect(pattern.createdAt).toBe("2026-03-27T10:00:00.000Z");
    expect(fs.files["/data/patterns/pat-2026-03-27-001.yaml"]).toBeDefined();
    // migratedNoHistory is only ever set explicitly (REQ-LPC-27); an
    // ordinary discovery must not carry it.
    expect(pattern.migratedNoHistory).toBeUndefined();
  });

  test("stamps migratedNoHistory when requested (REQ-LPC-27 migration path)", async () => {
    const fs = mockFs();
    const store = createPatternStore({
      patternsDir: "/data/patterns",
      fs,
      now: () => "2026-03-27T10:00:00.000Z",
    });

    const pattern = await store.create({
      statement: "Uses staccato rhythm at paragraph endings",
      dimension: "sentence-rhythm",
      migratedNoHistory: true,
    });

    expect(pattern.migratedNoHistory).toBe(true);

    const reread = await store.get(pattern.id);
    expect(reread?.migratedNoHistory).toBe(true);
  });

  test("increments sequence for same date", async () => {
    const fs = mockFs();
    const store = createPatternStore({
      patternsDir: "/data/patterns",
      fs,
      now: () => "2026-03-27T10:00:00.000Z",
    });

    const p1 = await store.create({ statement: "First", dimension: "sentence-rhythm" });
    const p2 = await store.create({ statement: "Second", dimension: "word-level-habits" });

    expect(p1.id).toBe("pat-2026-03-27-001");
    expect(p2.id).toBe("pat-2026-03-27-002");
  });

  test("carries a valid metricLink through to the stored pattern", async () => {
    const fs = mockFs();
    const store = createPatternStore({
      patternsDir: "/data/patterns",
      fs,
      now: () => "2026-03-27T10:00:00.000Z",
    });

    const pattern = await store.create({
      statement: "Comma-heavy sentences",
      dimension: "sentence-structure",
      metricLink: "commaRatePer1000",
    });

    expect(pattern.metricLink).toBe("commaRatePer1000");
  });
});

describe("pattern store: get/list", () => {
  test("get returns undefined for unknown ID", async () => {
    const store = createPatternStore({ patternsDir: "/data/patterns", fs: mockFs() });
    expect(await store.get("pat-nonexistent")).toBeUndefined();
  });

  test("list returns empty array when directory doesn't exist", async () => {
    const store = createPatternStore({ patternsDir: "/nonexistent", fs: mockFs() });
    expect(await store.list()).toEqual([]);
  });

  test("list filters by status", async () => {
    const fs = mockFs();
    const store = createPatternStore({
      patternsDir: "/data/patterns",
      fs,
      now: () => "2026-03-27T10:00:00.000Z",
    });

    const p1 = await store.create({ statement: "First", dimension: "sentence-rhythm" });
    await store.create({ statement: "Second", dimension: "word-level-habits" });
    await store.updateStatus(p1.id, "intentional");

    const intentional = await store.list({ status: "intentional" });
    expect(intentional).toHaveLength(1);
    expect(intentional[0].id).toBe(p1.id);

    const candidates = await store.list({ status: "candidate" });
    expect(candidates).toHaveLength(1);

    const all = await store.list();
    expect(all).toHaveLength(2);
  });
});

describe("pattern store: updateStatus", () => {
  test("allows candidate -> intentional", async () => {
    const fs = mockFs();
    const store = createPatternStore({ patternsDir: "/data/patterns", fs, now: () => "2026-03-27T10:00:00.000Z" });
    const p = await store.create({ statement: "X", dimension: "sentence-rhythm" });

    const updated = await store.updateStatus(p.id, "intentional");
    expect(updated.status).toBe("intentional");
  });

  test("rejects retired -> intentional (invalid transition)", async () => {
    const fs = mockFs();
    const store = createPatternStore({ patternsDir: "/data/patterns", fs, now: () => "2026-03-27T10:00:00.000Z" });
    const p = await store.create({ statement: "X", dimension: "sentence-rhythm" });
    await store.updateStatus(p.id, "retired");

    await expect(store.updateStatus(p.id, "intentional")).rejects.toThrow(/Invalid pattern transition/);
  });

  test("allows retired -> undecided (reactivate)", async () => {
    const fs = mockFs();
    const store = createPatternStore({ patternsDir: "/data/patterns", fs, now: () => "2026-03-27T10:00:00.000Z" });
    const p = await store.create({ statement: "X", dimension: "sentence-rhythm" });
    await store.updateStatus(p.id, "retired");

    const reactivated = await store.updateStatus(p.id, "undecided");
    expect(reactivated.status).toBe("undecided");
  });

  test("throws for unknown pattern ID", async () => {
    const store = createPatternStore({ patternsDir: "/data/patterns", fs: mockFs() });
    await expect(store.updateStatus("pat-nonexistent", "intentional")).rejects.toThrow(/not found/);
  });
});

describe("pattern store: recordSighting", () => {
  test("increments sightingCount and adds a new entryId", async () => {
    const fs = mockFs();
    const store = createPatternStore({ patternsDir: "/data/patterns", fs, now: () => "2026-03-27T10:00:00.000Z" });
    const p = await store.create({ statement: "X", dimension: "sentence-rhythm" });

    const updated = await store.recordSighting(
      p.id,
      makeSighting({ patternId: p.id, entryId: "entry-1", createdAt: "2026-03-27T10:00:00.000Z" }),
    );

    expect(updated.sightingCount).toBe(1);
    expect(updated.entryIds).toEqual(["entry-1"]);
    expect(updated.lastSightingAt).toBe("2026-03-27T10:00:00.000Z");
  });

  test("does not duplicate entryIds for a repeat sighting in the same entry", async () => {
    const fs = mockFs();
    const store = createPatternStore({ patternsDir: "/data/patterns", fs, now: () => "2026-03-27T10:00:00.000Z" });
    const p = await store.create({ statement: "X", dimension: "sentence-rhythm" });

    await store.recordSighting(p.id, makeSighting({ patternId: p.id, entryId: "entry-1", createdAt: "2026-03-27T10:00:00.000Z" }));
    const updated = await store.recordSighting(
      p.id,
      makeSighting({ id: "sight-002", patternId: p.id, entryId: "entry-1", createdAt: "2026-03-27T11:00:00.000Z" }),
    );

    // Two sightings, but only one distinct entry.
    expect(updated.sightingCount).toBe(2);
    expect(updated.entryIds).toEqual(["entry-1"]);
    expect(updated.lastSightingAt).toBe("2026-03-27T11:00:00.000Z");
  });

  test("throws for unknown pattern ID", async () => {
    const store = createPatternStore({ patternsDir: "/data/patterns", fs: mockFs() });
    await expect(store.recordSighting("pat-nonexistent", makeSighting())).rejects.toThrow(/not found/);
  });
});

describe("pattern store: detachSighting", () => {
  test("recomputes counters from the remaining sightings", async () => {
    const fs = mockFs();
    const store = createPatternStore({ patternsDir: "/data/patterns", fs, now: () => "2026-03-27T10:00:00.000Z" });
    const p = await store.create({ statement: "X", dimension: "sentence-rhythm" });

    await store.recordSighting(p.id, makeSighting({ id: "sight-001", patternId: p.id, entryId: "entry-1", createdAt: "2026-03-27T09:00:00.000Z" }));
    await store.recordSighting(p.id, makeSighting({ id: "sight-002", patternId: p.id, entryId: "entry-2", createdAt: "2026-03-27T10:00:00.000Z" }));

    // Detach sight-002: remaining sightings passed in are what's left after removal.
    const remaining = [makeSighting({ id: "sight-001", patternId: p.id, entryId: "entry-1", createdAt: "2026-03-27T09:00:00.000Z" })];
    const updated = await store.detachSighting(p.id, remaining);

    expect(updated.sightingCount).toBe(1);
    expect(updated.entryIds).toEqual(["entry-1"]);
    expect(updated.lastSightingAt).toBe("2026-03-27T09:00:00.000Z");
  });

  test("preserves entryId when another sighting from the same entry survives", async () => {
    const fs = mockFs();
    const store = createPatternStore({ patternsDir: "/data/patterns", fs, now: () => "2026-03-27T10:00:00.000Z" });
    const p = await store.create({ statement: "X", dimension: "sentence-rhythm" });

    // Two sightings in the same entry; detach one, the entryId should remain.
    const remaining = [makeSighting({ id: "sight-002", patternId: p.id, entryId: "entry-1", createdAt: "2026-03-27T10:00:00.000Z" })];
    const updated = await store.detachSighting(p.id, remaining);

    expect(updated.sightingCount).toBe(1);
    expect(updated.entryIds).toEqual(["entry-1"]);
  });

  test("clears counters to zero when no sightings remain", async () => {
    const fs = mockFs();
    const store = createPatternStore({ patternsDir: "/data/patterns", fs, now: () => "2026-03-27T10:00:00.000Z" });
    const p = await store.create({ statement: "X", dimension: "sentence-rhythm" });

    const updated = await store.detachSighting(p.id, []);
    expect(updated.sightingCount).toBe(0);
    expect(updated.entryIds).toEqual([]);
    expect(updated.lastSightingAt).toBeUndefined();
  });
});

describe("pattern store: merge", () => {
  test("folds duplicate's counters into the survivor and retires the duplicate", async () => {
    const fs = mockFs();
    const store = createPatternStore({ patternsDir: "/data/patterns", fs, now: () => "2026-03-27T10:00:00.000Z" });
    const survivor = await store.create({ statement: "Survivor", dimension: "sentence-rhythm" });
    const duplicate = await store.create({ statement: "Duplicate", dimension: "sentence-rhythm" });

    await store.recordSighting(survivor.id, makeSighting({ patternId: survivor.id, entryId: "entry-1", createdAt: "2026-03-27T09:00:00.000Z" }));
    await store.recordSighting(duplicate.id, makeSighting({ patternId: duplicate.id, entryId: "entry-2", createdAt: "2026-03-27T11:00:00.000Z" }));

    const merged = await store.merge(survivor.id, duplicate.id);

    expect(merged.id).toBe(survivor.id);
    expect(merged.sightingCount).toBe(2);
    expect(merged.entryIds.sort()).toEqual(["entry-1", "entry-2"]);
    expect(merged.lastSightingAt).toBe("2026-03-27T11:00:00.000Z");

    const retiredDuplicate = await store.get(duplicate.id);
    expect(retiredDuplicate?.status).toBe("retired");
    expect(retiredDuplicate?.retirement?.mergedInto).toBe(survivor.id);
  });

  test("rejects merging patterns from different dimensions", async () => {
    const fs = mockFs();
    const store = createPatternStore({ patternsDir: "/data/patterns", fs, now: () => "2026-03-27T10:00:00.000Z" });
    const survivor = await store.create({ statement: "Survivor", dimension: "sentence-rhythm" });
    const duplicate = await store.create({ statement: "Duplicate", dimension: "word-level-habits" });

    await expect(store.merge(survivor.id, duplicate.id)).rejects.toThrow(/different dimensions/);
  });

  test("zeroes out the retired duplicate's own counters after folding them into the survivor", async () => {
    const fs = mockFs();
    const store = createPatternStore({ patternsDir: "/data/patterns", fs, now: () => "2026-03-27T10:00:00.000Z" });
    const survivor = await store.create({ statement: "Survivor", dimension: "sentence-rhythm" });
    const duplicate = await store.create({ statement: "Duplicate", dimension: "sentence-rhythm" });

    await store.recordSighting(survivor.id, makeSighting({ patternId: survivor.id, entryId: "entry-1", createdAt: "2026-03-27T09:00:00.000Z" }));
    await store.recordSighting(duplicate.id, makeSighting({ patternId: duplicate.id, entryId: "entry-2", createdAt: "2026-03-27T11:00:00.000Z" }));

    await store.merge(survivor.id, duplicate.id);

    // The duplicate's sightings were folded into the survivor above and get
    // reassigned away by the route layer immediately after merge, so the
    // retired duplicate itself must not keep showing those sightings.
    const retiredDuplicate = await store.get(duplicate.id);
    expect(retiredDuplicate?.sightingCount).toBe(0);
    expect(retiredDuplicate?.entryIds).toEqual([]);
    expect(retiredDuplicate?.lastSightingAt).toBeUndefined();
  });

  test("reactivating a merged-away duplicate comes back with zeroed counters, not stale pre-merge values", async () => {
    const fs = mockFs();
    const store = createPatternStore({ patternsDir: "/data/patterns", fs, now: () => "2026-03-27T10:00:00.000Z" });
    const survivor = await store.create({ statement: "Survivor", dimension: "sentence-rhythm" });
    const duplicate = await store.create({ statement: "Duplicate", dimension: "sentence-rhythm" });

    await store.recordSighting(survivor.id, makeSighting({ patternId: survivor.id, entryId: "entry-1", createdAt: "2026-03-27T09:00:00.000Z" }));
    await store.recordSighting(duplicate.id, makeSighting({ patternId: duplicate.id, entryId: "entry-2", createdAt: "2026-03-27T11:00:00.000Z" }));

    await store.merge(survivor.id, duplicate.id);
    const reactivated = await store.updateStatus(duplicate.id, "undecided");

    expect(reactivated.status).toBe("undecided");
    expect(reactivated.sightingCount).toBe(0);
    expect(reactivated.entryIds).toEqual([]);
    expect(reactivated.lastSightingAt).toBeUndefined();
  });
});

describe("pattern store: setWatch / linkRule", () => {
  test("setWatch attaches a watch item", async () => {
    const fs = mockFs();
    const store = createPatternStore({ patternsDir: "/data/patterns", fs, now: () => "2026-03-27T10:00:00.000Z" });
    const p = await store.create({ statement: "X", dimension: "sentence-rhythm" });

    const updated = await store.setWatch(p.id, { classifiedAt: "2026-03-27T10:00:00.000Z", resolved: false });
    expect(updated.watch).toEqual({ classifiedAt: "2026-03-27T10:00:00.000Z", resolved: false });
  });

  test("setWatch(undefined) clears the watch item", async () => {
    const fs = mockFs();
    const store = createPatternStore({ patternsDir: "/data/patterns", fs, now: () => "2026-03-27T10:00:00.000Z" });
    const p = await store.create({ statement: "X", dimension: "sentence-rhythm" });
    await store.setWatch(p.id, { classifiedAt: "2026-03-27T10:00:00.000Z", resolved: false });

    const cleared = await store.setWatch(p.id, undefined);
    expect(cleared.watch).toBeUndefined();
  });

  test("linkRule sets ruleId", async () => {
    const fs = mockFs();
    const store = createPatternStore({ patternsDir: "/data/patterns", fs, now: () => "2026-03-27T10:00:00.000Z" });
    const p = await store.create({ statement: "X", dimension: "sentence-rhythm" });

    const updated = await store.linkRule(p.id, "rule-001");
    expect(updated.ruleId).toBe("rule-001");
  });
});

describe("pattern store: rebuildCounters", () => {
  test("recomputes counters from a sighting list, ignoring sightings for other patterns", async () => {
    const fs = mockFs();
    const store = createPatternStore({ patternsDir: "/data/patterns", fs, now: () => "2026-03-27T10:00:00.000Z" });
    const p = await store.create({ statement: "X", dimension: "sentence-rhythm" });
    const other = await store.create({ statement: "Y", dimension: "word-level-habits" });

    const sightings: Sighting[] = [
      makeSighting({ id: "s1", patternId: p.id, entryId: "entry-1", createdAt: "2026-03-27T08:00:00.000Z" }),
      makeSighting({ id: "s2", patternId: p.id, entryId: "entry-2", createdAt: "2026-03-27T09:00:00.000Z" }),
      makeSighting({ id: "s3", patternId: other.id, entryId: "entry-3", createdAt: "2026-03-27T12:00:00.000Z" }),
    ];

    const rebuilt = await store.rebuildCounters(p.id, sightings);
    expect(rebuilt.sightingCount).toBe(2);
    expect(rebuilt.entryIds).toEqual(["entry-1", "entry-2"]);
    expect(rebuilt.lastSightingAt).toBe("2026-03-27T09:00:00.000Z");
  });

  test("throws for unknown pattern ID", async () => {
    const store = createPatternStore({ patternsDir: "/data/patterns", fs: mockFs() });
    await expect(store.rebuildCounters("pat-nonexistent", [])).rejects.toThrow(/not found/);
  });
});

describe("pattern store: declineProposal", () => {
  test("stamps proposalDeclinedAt with the current time", async () => {
    const fs = mockFs();
    const store = createPatternStore({ patternsDir: "/data/patterns", fs, now: () => "2026-03-27T10:00:00.000Z" });
    const p = await store.create({ statement: "X", dimension: "sentence-rhythm" });

    const declined = await store.declineProposal(p.id);
    expect(declined.proposalDeclinedAt).toBe("2026-03-27T10:00:00.000Z");
  });

  test("persists proposalDeclinedAt across a re-read", async () => {
    const fs = mockFs();
    const store = createPatternStore({ patternsDir: "/data/patterns", fs, now: () => "2026-03-27T10:00:00.000Z" });
    const p = await store.create({ statement: "X", dimension: "sentence-rhythm" });
    await store.declineProposal(p.id);

    const reread = await store.get(p.id);
    expect(reread?.proposalDeclinedAt).toBe("2026-03-27T10:00:00.000Z");
  });

  test("throws for unknown pattern ID", async () => {
    const store = createPatternStore({ patternsDir: "/data/patterns", fs: mockFs() });
    await expect(store.declineProposal("pat-nonexistent")).rejects.toThrow(/not found/);
  });

  test("clears proposalSurfacedAt when declining a pattern that previously had it set", async () => {
    const fs = mockFs();
    const store = createPatternStore({ patternsDir: "/data/patterns", fs, now: () => "2026-03-27T10:00:00.000Z" });
    const p = await store.create({ statement: "X", dimension: "sentence-rhythm" });
    const surfaced = await store.markProposalSurfaced(p.id);
    expect(surfaced.proposalSurfacedAt).toBe("2026-03-27T10:00:00.000Z");

    const declined = await store.declineProposal(p.id);
    expect(declined.proposalSurfacedAt).toBeUndefined();

    // Persisted, not just the in-memory return value.
    const reread = await store.get(p.id);
    expect(reread?.proposalSurfacedAt).toBeUndefined();
  });
});
