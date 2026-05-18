import { join } from "node:path";
import { entryId } from "@ink-mirror/shared";
import type { ObservationDimension } from "@ink-mirror/shared";
import { createApp } from "./app.js";
import { createEventBus } from "./event-bus.js";
import { createEntryStore } from "./entry-store.js";
import { createObservationStore } from "./observation-store.js";
import { createNudgeStore } from "./nudge-store.js";
import { createProfileStore } from "./profile-store.js";
import { createSessionRunner } from "./session-runner.js";
import type { SessionRequest } from "./session-runner.js";
import { observe } from "./observer.js";
import { computeEntryMetrics } from "./metrics/index.js";
import { createEntryRoutes } from "./routes/entries.js";
import { createObservationRoutes } from "./routes/observations.js";
import { createProfileRoutes } from "./routes/profile.js";
import { createEventsRoutes } from "./routes/events.js";
import { createNudgeRoutes } from "./routes/nudge.js";

const DATA_DIR = process.env.INK_MIRROR_DATA ?? join(process.env.HOME ?? ".", ".ink-mirror");
const SOCKET_PATH = process.env.INK_MIRROR_SOCKET ?? join(DATA_DIR, "ink-mirror.sock");
// INK_MIRROR_MODEL format: "provider:modelId" — e.g. "anthropic:claude-opus-4-7",
// "openrouter:openrouter/free". The modelId may contain slashes; we split on the
// first colon only. Pi resolves credentials via AuthStorage when prompt() runs.
const MODEL_SPEC = process.env.INK_MIRROR_MODEL ?? "openrouter:openrouter/free";
const ENTRIES_DIR = join(DATA_DIR, "entries");
const OBSERVATIONS_DIR = join(DATA_DIR, "observations");
const NUDGES_DIR = join(DATA_DIR, "nudges");
const PROFILE_PATH = join(DATA_DIR, "profile.md");

const entryStore = createEntryStore({ entriesDir: ENTRIES_DIR });
const observationStore = createObservationStore({ observationsDir: OBSERVATIONS_DIR });
const nudgeStore = createNudgeStore({ nudgesDir: NUDGES_DIR });
const profileStore = createProfileStore({ profilePath: PROFILE_PATH });

// Pi-agent integration. Each request spins up a one-shot AgentSession with
// no tools and no project context — the daemon supplies its own system
// prompt per call. The model is selected at startup via INK_MIRROR_MODEL;
// credentials come from pi's AuthStorage (~/.pi/agent/auth.json).
//
// Lazy initializer so tests that never call productionQueryFn don't pay the
// import cost.
type PiCodingAgent = typeof import("@earendil-works/pi-coding-agent");

type PiBindings = {
  createAgentSession: PiCodingAgent["createAgentSession"];
  DefaultResourceLoader: PiCodingAgent["DefaultResourceLoader"];
  SessionManager: PiCodingAgent["SessionManager"];
  authStorage: import("@earendil-works/pi-coding-agent").AuthStorage;
  modelRegistry: import("@earendil-works/pi-coding-agent").ModelRegistry;
  settingsManager: import("@earendil-works/pi-coding-agent").SettingsManager;
  agentDir: string;
  cwd: string;
  provider: string;
  modelId: string;
};

let piBindings: Promise<PiBindings> | undefined;

async function getPiBindings(): Promise<PiBindings> {
  if (piBindings) return piBindings;
  piBindings = (async () => {
    const {
      AuthStorage,
      DefaultResourceLoader,
      ModelRegistry,
      SessionManager,
      SettingsManager,
      createAgentSession,
      getAgentDir,
    } = await import("@earendil-works/pi-coding-agent");

    const cwd = process.cwd();
    const agentDir = getAgentDir();
    const authStorage = AuthStorage.create();
    const modelRegistry = ModelRegistry.create(authStorage);
    const settingsManager = SettingsManager.create(cwd, agentDir);

    const sep = MODEL_SPEC.indexOf(":");
    if (sep <= 0 || sep === MODEL_SPEC.length - 1) {
      throw new Error(
        `INK_MIRROR_MODEL must be "provider:modelId" (got ${JSON.stringify(MODEL_SPEC)}).`,
      );
    }
    const provider = MODEL_SPEC.slice(0, sep);
    const modelId = MODEL_SPEC.slice(sep + 1);

    return {
      createAgentSession,
      DefaultResourceLoader,
      SessionManager,
      authStorage,
      modelRegistry,
      settingsManager,
      agentDir,
      cwd,
      provider,
      modelId,
    };
  })();
  return piBindings;
}

async function productionQueryFn(request: SessionRequest): Promise<{ content: string }> {
  const pi = await getPiBindings();

  const lastUserMsg = [...request.messages].reverse().find((m) => m.role === "user");
  if (!lastUserMsg) {
    throw new Error("session-runner: request has no user message");
  }

  // Fresh loader + in-memory session per request. Extensions stay enabled so
  // user-installed providers (e.g. fallback) can register themselves and wire
  // their streamSimple hooks. Other resource categories are suppressed to keep
  // the system prompt under daemon control.
  const loader = new pi.DefaultResourceLoader({
    cwd: pi.cwd,
    agentDir: pi.agentDir,
    settingsManager: pi.settingsManager,
    systemPrompt: request.system,
    noContextFiles: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
  });
  await loader.reload();

  const { session, modelFallbackMessage } = await pi.createAgentSession({
    cwd: pi.cwd,
    agentDir: pi.agentDir,
    authStorage: pi.authStorage,
    modelRegistry: pi.modelRegistry,
    settingsManager: pi.settingsManager,
    resourceLoader: loader,
    sessionManager: pi.SessionManager.inMemory(pi.cwd),
    // Observer/nudger generate text, not tool calls.
    noTools: "all",
  });
  if (modelFallbackMessage) {
    console.warn(`[pi-agent] ${modelFallbackMessage}`);
  }

  // bindExtensions runs the queued registerProvider() calls from extensions,
  // so the session's modelRegistry is the only place dynamic models exist.
  // Look up + setModel must happen after this; the constructor-time `model`
  // option on createAgentSession does not actually wire the model in.
  await session.bindExtensions({});

  const model = session.modelRegistry.find(pi.provider, pi.modelId);
  if (!model) {
    throw new Error(
      `Model ${pi.provider}/${pi.modelId} not found in session registry. ` +
        `Check that the providing extension is enabled, or override with INK_MIRROR_MODEL=provider:modelId.`,
    );
  }
  await session.setModel(model);

  await session.prompt(lastUserMsg.content);

  const lastAssistant = [...session.messages].reverse().find((m) => m.role === "assistant");
  if (!lastAssistant || lastAssistant.role !== "assistant") {
    throw new Error("session-runner: agent produced no assistant message");
  }

  const text = lastAssistant.content
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text)
    .join("");

  if (!text) {
    throw new Error(
      `session-runner: assistant produced no text (stopReason=${lastAssistant.stopReason}` +
        (lastAssistant.errorMessage ? `, error=${lastAssistant.errorMessage}` : "") +
        ")",
    );
  }

  return { content: text };
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
        // Filter out the current entry to avoid duplication (it appears as "Current Entry" in the prompt)
        const filtered = items.filter((item) => item.id !== entryIdStr);
        const recent = filtered.slice(0, limit);
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

const eventBus = createEventBus();

const entryRoutes = createEntryRoutes({ entryStore, onEntryCreated, eventBus });
const observationRoutes = createObservationRoutes({ observationStore, entryStore, onIntentional });
const profileRoutes = createProfileRoutes({ profileStore });
const eventsRoutes = createEventsRoutes({ eventBus });
const nudgeRoutes = createNudgeRoutes({
  sessionRunner,
  computeMetrics: computeEntryMetrics,
  readEntry: async (id) => {
    const entry = await entryStore.get(entryId(id));
    return entry?.body;
  },
  readStyleProfile: () => profileStore.toPromptMarkdown(),
  nudgeStore,
});

const { hono } = createApp({
  routeModules: [entryRoutes, observationRoutes, profileRoutes, eventsRoutes, nudgeRoutes],
  eventBus,
});

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

// Warm-up: spin up a throwaway session so extensions get loaded and the model
// lookup runs against the dynamic registry. Surfaces bad INK_MIRROR_MODEL or
// missing-extension errors at boot instead of on the first observer call.
(async () => {
  const pi = await getPiBindings();
  const loader = new pi.DefaultResourceLoader({
    cwd: pi.cwd,
    agentDir: pi.agentDir,
    settingsManager: pi.settingsManager,
    systemPrompt: "warmup",
    noContextFiles: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
  });
  await loader.reload();
  const { session } = await pi.createAgentSession({
    cwd: pi.cwd,
    agentDir: pi.agentDir,
    authStorage: pi.authStorage,
    modelRegistry: pi.modelRegistry,
    settingsManager: pi.settingsManager,
    resourceLoader: loader,
    sessionManager: pi.SessionManager.inMemory(pi.cwd),
    noTools: "all",
  });
  await session.bindExtensions({});
  const model = session.modelRegistry.find(pi.provider, pi.modelId);
  if (!model) {
    throw new Error(
      `Model ${pi.provider}/${pi.modelId} not found in session registry. ` +
        `Check that the providing extension is enabled, or override with INK_MIRROR_MODEL=provider:modelId.`,
    );
  }
  console.log(`[pi-agent] using model ${pi.provider}/${pi.modelId}`);
  session.dispose();
})().catch((err) => {
  console.error(`[pi-agent] startup check failed: ${err instanceof Error ? err.message : err}`);
});

export { server };
