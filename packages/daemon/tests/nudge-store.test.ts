import { describe, expect, test } from "bun:test";
import type { SavedNudge } from "@ink-mirror/shared";
import {
  createNudgeStore,
  toYaml,
  fromYaml,
  type NudgeStoreFs,
} from "../src/nudge-store.js";

interface MockFs extends NudgeStoreFs {
  files: Record<string, string>;
  mkdirCalls: string[];
}

function mockFs(): MockFs {
  const files: Record<string, string> = {};
  const mkdirCalls: string[] = [];

  return {
    files,
    mkdirCalls,
    async readFile(path: string): Promise<string> {
      if (!(path in files)) throw new Error(`ENOENT: ${path}`);
      return files[path];
    },
    async writeFile(path: string, content: string): Promise<void> {
      files[path] = content;
    },
    async mkdir(path: string): Promise<void> {
      mkdirCalls.push(path);
    },
  };
}

const sampleRecord: SavedNudge = {
  entryId: "entry-2026-04-21-001",
  contentHash:
    "sha256:9af15f5c7b1e4d3a8c2e6f4a1b3d7e9c2f8a5b3c7d9e1f4a6b8c2d4e6f8a1b3c",
  context: "",
  generatedAt: "2026-04-21T18:03:12.447Z",
  metrics: {
    passiveRatio: 0.42,
    totalSentences: 12,
    hedgingWordCount: 3,
    rhythmVariance: 18.7,
  },
  nudges: [
    {
      craftPrinciple: "passive-voice-clustering",
      evidence:
        "The project was started in January.\nThe requirements were gathered over two weeks.",
      observation:
        "Two consecutive passive sentences remove the actors from the narrative.",
      question:
        "The passive voice here reads as institutional report register.\nWas that your intent?",
    },
    {
      craftPrinciple: "hedging-accumulation",
      evidence: "I think we might possibly want to consider perhaps revisiting this.",
      observation: "Four hedging markers in a single sentence.",
      question: "Is the uncertainty deliberate, or is it doing other work?",
    },
  ],
};

describe("YAML serialization", () => {
  test("round-trips a full record including multiline fields", () => {
    const yaml = toYaml(sampleRecord);
    const parsed = fromYaml(yaml);
    expect(parsed).toEqual(sampleRecord);
  });

  test("uses block literal for multiline evidence and observation", () => {
    const yaml = toYaml(sampleRecord);
    expect(yaml).toContain("evidence: |");
    expect(yaml).toContain("observation: |");
    expect(yaml).toContain("question: |");
    // Block content for nudges is indented six spaces (two for the list
    // marker, four for the field, plus the two-space block indent).
    expect(yaml).toContain("      The project was started in January.");
  });

  test("writes empty context as a quoted empty string and round-trips", () => {
    const yaml = toYaml({ ...sampleRecord, context: "" });
    expect(yaml).toContain(`context: ""`);
    const parsed = fromYaml(yaml);
    expect(parsed?.context).toBe("");
  });

  test("writes non-empty context as a block literal and round-trips", () => {
    const record: SavedNudge = {
      ...sampleRecord,
      context: "writing for myself, no audience",
    };
    const yaml = toYaml(record);
    expect(yaml).toContain("context: |");
    expect(yaml).toContain("  writing for myself, no audience");
    expect(fromYaml(yaml)?.context).toBe("writing for myself, no audience");
  });

  test("fromYaml returns undefined when a required field is missing", () => {
    const yaml = toYaml(sampleRecord).replace(/^contentHash:.+\n/m, "");
    expect(fromYaml(yaml)).toBeUndefined();
  });

  test("fromYaml returns undefined on malformed content", () => {
    expect(fromYaml("this is not yaml at all")).toBeUndefined();
    expect(fromYaml("")).toBeUndefined();
  });

  test("fromYaml returns undefined when nudge sub-fields are missing", () => {
    const broken = toYaml(sampleRecord).replace(
      / {4}question: \|\n( {6}.+\n)+/,
      "",
    );
    expect(fromYaml(broken)).toBeUndefined();
  });
});

describe("nudge store", () => {
  test("save then get round-trips a full record", async () => {
    const fs = mockFs();
    const store = createNudgeStore({ nudgesDir: "/data/nudges", fs });

    await store.save(sampleRecord.entryId, sampleRecord);
    const loaded = await store.get(sampleRecord.entryId);

    expect(loaded).toEqual(sampleRecord);
    expect(
      fs.files[`/data/nudges/${sampleRecord.entryId}.yaml`],
    ).toBeDefined();
  });

  test("get returns undefined when no file exists for the entry", async () => {
    const fs = mockFs();
    const store = createNudgeStore({ nudgesDir: "/data/nudges", fs });

    const loaded = await store.get("entry-does-not-exist");
    expect(loaded).toBeUndefined();
  });

  test("save creates the nudges directory if missing", async () => {
    const fs = mockFs();
    const store = createNudgeStore({ nudgesDir: "/data/nudges", fs });

    await store.save(sampleRecord.entryId, sampleRecord);

    expect(fs.mkdirCalls).toContain("/data/nudges");
  });

  test("multiple saves for the same entry overwrite without history", async () => {
    const fs = mockFs();
    const store = createNudgeStore({ nudgesDir: "/data/nudges", fs });

    await store.save(sampleRecord.entryId, sampleRecord);

    const updated: SavedNudge = {
      ...sampleRecord,
      contentHash: "sha256:" + "a".repeat(64),
      generatedAt: "2026-04-22T09:00:00.000Z",
      nudges: [sampleRecord.nudges[0]],
    };
    await store.save(updated.entryId, updated);

    const loaded = await store.get(updated.entryId);
    expect(loaded).toEqual(updated);

    const fileKeys = Object.keys(fs.files).filter((k) =>
      k.includes(updated.entryId),
    );
    expect(fileKeys).toHaveLength(1);
  });

  test("get returns undefined when the on-disk file is malformed", async () => {
    const fs = mockFs();
    fs.files[`/data/nudges/${sampleRecord.entryId}.yaml`] =
      "garbage: not a real record\n";
    const store = createNudgeStore({ nudgesDir: "/data/nudges", fs });

    const loaded = await store.get(sampleRecord.entryId);
    expect(loaded).toBeUndefined();
  });
});
