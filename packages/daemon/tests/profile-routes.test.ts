import { describe, test, expect } from "bun:test";
import { Hono } from "hono";
import { createProfileRoutes } from "../src/routes/profile.js";
import { createProfileStore, profileToMarkdown } from "../src/profile-store.js";
import type { Profile } from "@ink-mirror/shared";

// --- In-memory filesystem for test isolation ---

function createMockFs() {
  const files = new Map<string, string>();
  return {
    fs: {
      readFile: async (path: string, _encoding: "utf-8") => {
        const content = files.get(path);
        if (content === undefined) throw new Error(`ENOENT: ${path}`);
        return content;
      },
      writeFile: async (path: string, content: string) => {
        files.set(path, content);
      },
      mkdir: async (_path: string, _opts: { recursive: true }) => {},
    },
    files,
  };
}

const PROFILE_PATH = "/test/data/profile.md";
const FIXED_TIME = "2026-03-27T12:00:00.000Z";

function createTestApp(existingProfile?: Profile) {
  const mock = createMockFs();
  if (existingProfile) {
    mock.files.set(PROFILE_PATH, profileToMarkdown(existingProfile));
  }

  const profileStore = createProfileStore({
    profilePath: PROFILE_PATH,
    fs: mock.fs,
    now: () => FIXED_TIME,
  });

  const { routes } = createProfileRoutes({ profileStore });
  const app = new Hono();
  app.route("/", routes);

  return { app, profileStore, files: mock.files };
}

function profileWithRules(): Profile {
  return {
    version: 1,
    updatedAt: FIXED_TIME,
    rules: [
      {
        id: "rule-sentence-rhythm-001",
        pattern: "Uses staccato rhythm for emphasis",
        dimension: "sentence-rhythm",
        sourceCount: 3,
        sourceSummary: "Confirmed across 3 entries",
        createdAt: FIXED_TIME,
        updatedAt: FIXED_TIME,
      },
      {
        id: "rule-word-level-habits-001",
        pattern: "Relies on hedging words",
        dimension: "word-level-habits",
        sourceCount: 1,
        sourceSummary: "Confirmed across 1 entry",
        createdAt: FIXED_TIME,
        updatedAt: FIXED_TIME,
      },
    ],
  };
}

describe("GET /profile", () => {
  test("returns empty profile when none exists", async () => {
    const { app } = createTestApp();
    const res = await app.request("/profile");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rules).toHaveLength(0);
    expect(body.markdown).toBe("");
  });

  test("returns profile with rules and prompt markdown", async () => {
    const { app } = createTestApp(profileWithRules());
    const res = await app.request("/profile");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rules).toHaveLength(2);
    expect(body.markdown).toContain("Sentence Rhythm");
    expect(body.markdown).toContain("Uses staccato rhythm");
  });
});

describe("PATCH /profile/rules/:id", () => {
  test("updates rule pattern", async () => {
    const { app } = createTestApp(profileWithRules());
    const res = await app.request("/profile/rules/rule-sentence-rhythm-001", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pattern: "Uses dramatic rhythm shifts" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pattern).toBe("Uses dramatic rhythm shifts");
  });

  test("returns 404 for non-existent rule", async () => {
    const { app } = createTestApp(profileWithRules());
    const res = await app.request("/profile/rules/rule-nonexistent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pattern: "x" }),
    });
    expect(res.status).toBe(404);
  });

  test("returns 400 for invalid rule ID format", async () => {
    const { app } = createTestApp();
    const res = await app.request("/profile/rules/not-a-rule-id", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pattern: "x" }),
    });
    expect(res.status).toBe(400);
  });

  test("returns 400 when no fields provided", async () => {
    const { app } = createTestApp(profileWithRules());
    const res = await app.request("/profile/rules/rule-sentence-rhythm-001", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /profile/rules/:id", () => {
  test("deletes existing rule", async () => {
    const { app } = createTestApp(profileWithRules());
    const res = await app.request("/profile/rules/rule-sentence-rhythm-001", {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // Verify rule is gone
    const profile = await (await app.request("/profile")).json();
    expect(profile.rules).toHaveLength(1);
    expect(profile.rules[0].id).toBe("rule-word-level-habits-001");
  });

  test("returns 404 for non-existent rule", async () => {
    const { app } = createTestApp(profileWithRules());
    const res = await app.request("/profile/rules/rule-nonexistent", {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });
});

describe("PUT /profile", () => {
  test("replaces profile from valid markdown", async () => {
    const { app } = createTestApp(profileWithRules());

    const newMd = [
      "---",
      "version: 1",
      "updatedAt: 2026-01-01T00:00:00.000Z",
      "---",
      "",
      "# Writing Style Profile",
      "",
      "## Sentence Rhythm",
      "",
      "- **Completely new pattern**",
      "  *Confirmed across 1 entry* <!-- id:rule-sentence-rhythm-001 -->",
      "",
    ].join("\n");

    const res = await app.request("/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: newMd }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rules).toHaveLength(1);
    expect(body.rules[0].pattern).toBe("Completely new pattern");
  });

  test("returns 400 for invalid markdown", async () => {
    const { app } = createTestApp();
    const res = await app.request("/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: "not valid markdown" }),
    });
    expect(res.status).toBe(400);
  });

  test("returns 400 for missing markdown field", async () => {
    const { app } = createTestApp();
    const res = await app.request("/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});
