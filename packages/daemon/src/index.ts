import { join } from "node:path";
import { entryId } from "@ink-mirror/shared";
import type { ObservationDimension } from "@ink-mirror/shared";
import { createApp } from "./app.js";
import { createEntryStore } from "./entry-store.js";
import { createObservationStore } from "./observation-store.js";
import { createProfileStore } from "./profile-store.js";
import { createSessionRunner } from "./session-runner.js";
import type { SessionRequest } from "./session-runner.js";
import { observe } from "./observer.js";
import { computeEntryMetrics } from "./metrics/index.js";
import { createEntryRoutes } from "./routes/entries.js";
import { createObservationRoutes } from "./routes/observations.js";
import { createProfileRoutes } from "./routes/profile.js";

const SOCKET_PATH = process.env.INK_MIRROR_SOCKET ?? "/tmp/ink-mirror.sock";
const DATA_DIR = process.env.INK_MIRROR_DATA ?? join(process.env.HOME ?? ".", ".ink-mirror");
const ENTRIES_DIR = join(DATA_DIR, "entries");
const OBSERVATIONS_DIR = join(DATA_DIR, "observations");
const PROFILE_PATH = join(DATA_DIR, "profile.md");

const entryStore = createEntryStore({ entriesDir: ENTRIES_DIR });
const observationStore = createObservationStore({ observationsDir: OBSERVATIONS_DIR });
const profileStore = createProfileStore({ profilePath: PROFILE_PATH });

// Production queryFn using the Claude Agent SDK.
// Lazily imports to avoid hard dependency when running tests.
async function productionQueryFn(request: SessionRequest) {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  // Build the prompt from the last user message
  const lastUserMsg = [...request.messages].reverse().find((m) => m.role === "user");
  const prompt = lastUserMsg?.content ?? "";

  let result = "";
  for await (const message of query({
    prompt,
    options: {
      systemPrompt: request.system,
      maxTurns: 1,
      model: "claude-opus-4-6",
    },
  })) {
    if ("result" in message) {
      result = message.result;
    }
  }

  return { content: result };
}

const sessionRunner = createSessionRunner({ queryFn: productionQueryFn });

const onEntryCreated = (entryIdStr: string, entryText: string) =>
  observe(
    {
      sessionRunner,
      observationStore,
      computeMetrics: computeEntryMetrics,
      readStyleProfile: () => profileStore.toPromptMarkdown(),
      corpusSize: async () => (await entryStore.list()).length,
      recentEntries: async (limit: number) => {
        const items = await entryStore.list();
        const recent = items.slice(0, limit);
        const entries = [];
        for (const item of recent) {
          const entry = await entryStore.get(entryId(item.id));
          if (entry) entries.push({ id: entry.id, body: entry.body });
        }
        return entries;
      },
    },
    entryIdStr,
    entryText,
  );

const onIntentional = async (pattern: string, dimension: string) => {
  await profileStore.addOrMergeRule(pattern, dimension as ObservationDimension);
};

const entryRoutes = createEntryRoutes({ entryStore, onEntryCreated });
const observationRoutes = createObservationRoutes({ observationStore, entryStore, onIntentional });
const profileRoutes = createProfileRoutes({ profileStore });

const { hono } = createApp({ routeModules: [entryRoutes, observationRoutes, profileRoutes] });

// Clean up stale socket file
try {
  const { unlinkSync } = await import("node:fs");
  unlinkSync(SOCKET_PATH);
} catch {
  // Socket doesn't exist yet, that's fine
}

const server = Bun.serve({
  unix: SOCKET_PATH,
  fetch: hono.fetch,
});

console.log(`ink-mirror daemon listening on ${server.url}`);

export { server };
