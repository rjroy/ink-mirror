import { join } from "node:path";
import { entryId } from "@ink-mirror/shared";
import { createApp } from "./app.js";
import { createEventBus } from "./event-bus.js";
import { createEntryStore } from "./entry-store.js";
import type { EntryStore } from "./entry-store.js";
import { createObservationStore } from "./observation-store.js";
import type { ObservationStore } from "./observation-store.js";
import { createNudgeStore } from "./nudge-store.js";
import { createSnapshotStore } from "./snapshot-store.js";
import type { SnapshotStore } from "./snapshot-store.js";
import { createPatternStore } from "./pattern-store.js";
import type { PatternStore } from "./pattern-store.js";
import { createProfileStore } from "./profile-store.js";
import type { ProfileStore } from "./profile-store.js";
import { runMigration } from "./migration.js";
import { createSessionRunner } from "./session-runner.js";
import type { SessionRequest, SessionRunner } from "./session-runner.js";
import { observe } from "./observer.js";
import { computeEntryMetrics } from "./metrics/index.js";
import { config } from "./config.js";
import { createEntryRoutes } from "./routes/entries.js";
import { createObservationRoutes } from "./routes/observations.js";
import { createPatternRoutes } from "./routes/patterns.js";
import { createProfileRoutes } from "./routes/profile.js";
import { createEventsRoutes } from "./routes/events.js";
import { createNudgeRoutes } from "./routes/nudge.js";

const DATA_DIR =
  process.env.INK_MIRROR_DATA ?? join(process.env.HOME ?? ".", ".ink-mirror");
const SOCKET_PATH =
  process.env.INK_MIRROR_SOCKET ?? join(DATA_DIR, "ink-mirror.sock");
// INK_MIRROR_MODEL format: "provider:modelId" — e.g. "anthropic:claude-opus-4-7",
// "openrouter:openrouter/free". The modelId may contain slashes; we split on the
// first colon only. Pi resolves credentials via AuthStorage when prompt() runs.
const MODEL_SPEC = process.env.INK_MIRROR_MODEL ?? "openrouter:openrouter/free";
const ENTRIES_DIR = join(DATA_DIR, "entries");
// Directory renamed from "observations" to "sightings" (REQ-LPC-2/Phase 3
// plan): every stored observation is now a sighting of a pattern. No
// migration of pre-existing files here — that's Phase 5's job.
const SIGHTINGS_DIR = join(DATA_DIR, "sightings");
// Pre-rename directory. Real deployed instances have observation files here
// from before the sightings/ rename, with no `patternId` field. Passed to
// observation-store.ts as `legacyObservationsDir` so get()/list() keep
// reading them until Phase 5's migration moves them into SIGHTINGS_DIR.
const LEGACY_OBSERVATIONS_DIR = join(DATA_DIR, "observations");
const NUDGES_DIR = join(DATA_DIR, "nudges");
const SNAPSHOTS_DIR = join(DATA_DIR, "snapshots");
const PATTERNS_DIR = join(DATA_DIR, "patterns");
const PROFILE_PATH = join(DATA_DIR, "profile.md");

const entryStore = createEntryStore({ entriesDir: ENTRIES_DIR });
const observationStore = createObservationStore({
  observationsDir: SIGHTINGS_DIR,
  legacyObservationsDir: LEGACY_OBSERVATIONS_DIR,
});
const nudgeStore = createNudgeStore({ nudgesDir: NUDGES_DIR });
const snapshotStore = createSnapshotStore({ snapshotsDir: SNAPSHOTS_DIR });
const patternStore = createPatternStore({ patternsDir: PATTERNS_DIR });
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

type ProductionResourceLoader = {
  reload(): Promise<void>;
};

type ProductionAssistantMessage = {
  role: "assistant";
  content: Array<{ type: string; text?: string }>;
  provider: string;
  model: string;
  responseModel?: string;
  stopReason: string;
  usage: unknown;
  diagnostics?: Array<{
    type: string;
    error?: { name?: string; message: string; code?: string | number };
    details?: unknown;
  }>;
  errorMessage?: string;
};

type ProductionAgentSession = {
  bindExtensions(extensions: Record<string, never>): Promise<void>;
  modelRegistry: { find(provider: string, modelId: string): unknown };
  setModel(model: unknown): Promise<void>;
  subscribe: ProductionSession["subscribe"];
  prompt(content: string): Promise<void>;
  messages: Array<
    | ProductionAssistantMessage
    | { role: string }
  >;
};

function isProductionAssistantMessage(
  message: ProductionAgentSession["messages"][number],
): message is ProductionAssistantMessage {
  return message.role === "assistant" && "content" in message;
}

export type ProductionPiBindings = {
  cwd: string;
  agentDir: string;
  provider: string;
  modelId: string;
  createDefaultResourceLoader(options: {
    cwd: string;
    agentDir: string;
    systemPrompt: string;
    noContextFiles: boolean;
    noSkills: boolean;
    noPromptTemplates: boolean;
    noThemes: boolean;
    noExtensions: boolean;
  }): ProductionResourceLoader;
  createAgentSession(): Promise<{
    session: ProductionAgentSession;
    modelFallbackMessage?: string;
  }>;
};

let piBindings: Promise<PiBindings> | undefined;

async function getPiBindings(): Promise<PiBindings> {
  if (piBindings) return piBindings;
  const bindingsStart = performance.now();
  console.log(
    "[pi-agent] resolving bindings (first call only — cached after this)...",
  );
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
    console.log(
      `[pi-agent] pi-coding-agent module loaded (${(performance.now() - bindingsStart).toFixed(0)}ms)`,
    );

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
    console.log(
      `[pi-agent] bindings ready (${(performance.now() - bindingsStart).toFixed(0)}ms): provider=${provider} modelId=${modelId}`,
    );

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

type ProductionSession = {
  subscribe(callback: (event: {
    type: string;
    assistantMessageEvent?: { type: string };
  }) => void): () => void;
  prompt(content: string): Promise<void>;
  getLastAssistant(): {
    content: Array<{ type: string; text?: string }>;
    provider: string;
    model: string;
    responseModel?: string;
    stopReason: string;
    usage: unknown;
    diagnostics?: Array<{
      type: string;
      error?: { name?: string; message: string; code?: string | number };
      details?: unknown;
    }>;
    errorMessage?: string;
  } | undefined;
};

export type ProductionPiAdapter = {
  createResourceLoader(systemPrompt: string): void;
  createReadySession(): Promise<{
    session: ProductionSession;
    modelFallbackMessage?: string;
  }>;
};

async function getProductionPiAdapter(): Promise<ProductionPiAdapter> {
  const pi = await getPiBindings();
  let resourceLoader: InstanceType<PiCodingAgent["DefaultResourceLoader"]> | undefined;
  return createProductionPiAdapter({
    cwd: pi.cwd,
    agentDir: pi.agentDir,
    provider: pi.provider,
    modelId: pi.modelId,
    createDefaultResourceLoader: (options) => {
      resourceLoader = new pi.DefaultResourceLoader({
        ...options,
        settingsManager: pi.settingsManager,
      });
      return resourceLoader;
    },
    createAgentSession: () => {
      if (!resourceLoader) {
        throw new Error("session-runner: resource loader was not created");
      }
      return pi.createAgentSession({
        cwd: pi.cwd,
        agentDir: pi.agentDir,
        authStorage: pi.authStorage,
        modelRegistry: pi.modelRegistry,
        settingsManager: pi.settingsManager,
        resourceLoader,
        sessionManager: pi.SessionManager.inMemory(pi.cwd),
        noTools: "all",
      });
    },
  });
}

export function createProductionPiAdapter(
  pi: ProductionPiBindings,
): ProductionPiAdapter {
  let loader: ProductionResourceLoader | undefined;
  return {
    createResourceLoader(systemPrompt) {
      loader = pi.createDefaultResourceLoader({
        cwd: pi.cwd,
        agentDir: pi.agentDir,
        systemPrompt,
        noContextFiles: true,
        noSkills: true,
        noPromptTemplates: true,
        noThemes: true,
        noExtensions: true,
      });
    },
    async createReadySession() {
      if (!loader) {
        throw new Error("session-runner: resource loader was not created");
      }
      await loader.reload();
      const { session, modelFallbackMessage } = await pi.createAgentSession();
      await session.bindExtensions({});
      const model = session.modelRegistry.find(pi.provider, pi.modelId);
      if (!model) {
        throw new Error(
          `Model ${pi.provider}/${pi.modelId} not found in session registry. ` +
            `Check that the providing extension is enabled, or override with INK_MIRROR_MODEL=provider:modelId.`,
        );
      }
      await session.setModel(model);
      return {
        session: {
          subscribe: (callback) => session.subscribe(callback),
          prompt: (content) => session.prompt(content),
          getLastAssistant: () => {
            return [...session.messages]
              .reverse()
              .find(isProductionAssistantMessage);
          },
        },
        modelFallbackMessage,
      };
    },
  };
}

export function createProductionQueryFn(
  getAdapter: () => Promise<ProductionPiAdapter> = getProductionPiAdapter,
): (request: SessionRequest) => Promise<{ content: string }> {
  return async function productionQueryFn(
  request: SessionRequest,
): Promise<{ content: string }> {
  // Every stage below is logged with its own elapsed time. Before this, the
  // entire function was one opaque `await` chain from the session-runner's
  // "calling LLM..." log to either the final response or a fatal-error log
  // — if it hung partway through, there was no way to tell which stage
  // never returned. Each stage timestamp answers that directly.
  const callStart = performance.now();
  const elapsed = () => (performance.now() - callStart).toFixed(0);

  const pi = await getAdapter();
  console.log(`[pi-agent] bindings resolved (${elapsed()}ms total)`);

  const lastUserMsg = [...request.messages]
    .reverse()
    .find((m) => m.role === "user");
  if (!lastUserMsg) {
    throw new Error("session-runner: request has no user message");
  }

  // Fresh loader + in-memory session per request. Extensions stay enabled so
  // user-installed providers (e.g. fallback) can register themselves and wire
  // their streamSimple hooks. Other resource categories are suppressed to keep
  // the system prompt under daemon control.
  pi.createResourceLoader(request.system);
  const { session, modelFallbackMessage } = await pi.createReadySession();
  console.log(`[pi-agent] resource loader reloaded (${elapsed()}ms total)`);

  console.log(`[pi-agent] agent session created (${elapsed()}ms total)`);
  if (modelFallbackMessage) {
    console.warn(`[pi-agent] ${modelFallbackMessage}`);
  }

  console.log(`[pi-agent] extensions bound and model set (${elapsed()}ms total)`);

  // Subscribed before prompt() so the first-token timestamp is visible even
  // if the overall call is still in flight — the only way to tell "no
  // response yet because generation hasn't started" apart from "no response
  // yet because it's mid-generation" without waiting for the whole thing to
  // finish or time out.
  let firstTokenAt: number | undefined;
  const unsubscribe = session.subscribe((event) => {
    if (
      firstTokenAt === undefined &&
      event.type === "message_update" &&
      event.assistantMessageEvent?.type === "text_delta"
    ) {
      firstTokenAt = performance.now();
      console.log(`[pi-agent] first token received (${elapsed()}ms total)`);
    }
  });
  console.log("[pi-agent] prompt() starting...");
  try {
    await session.prompt(lastUserMsg.content);
  } finally {
    unsubscribe();
  }
  console.log(
    `[pi-agent] prompt() resolved (${elapsed()}ms total` +
      (firstTokenAt === undefined ? ", no text_delta ever observed" : "") +
      ")",
  );

  const lastAssistant = session.getLastAssistant();
  if (!lastAssistant) {
    throw new Error("session-runner: agent produced no assistant message");
  }

  // Logged unconditionally (not just on the empty-text failure path below):
  // provider/model/usage prove which model actually answered, and a
  // non-empty diagnostics array means the SDK caught and recovered from an
  // internal failure — e.g. a provider error that got silently retried —
  // even though this message otherwise looks like a normal success. Without
  // this, that recovery is invisible: the caller only ever sees the final
  // text, never that the requested model wasn't the one that produced it.
  console.log(
    `[pi-agent] responded via ${lastAssistant.provider}/${lastAssistant.model}` +
      (lastAssistant.responseModel &&
      lastAssistant.responseModel !== lastAssistant.model
        ? ` (responseModel=${lastAssistant.responseModel})`
        : "") +
      ` stopReason=${lastAssistant.stopReason} usage=${JSON.stringify(lastAssistant.usage)}`,
  );
  if (lastAssistant.diagnostics && lastAssistant.diagnostics.length > 0) {
    for (const d of lastAssistant.diagnostics) {
      console.warn(
        `[pi-agent] diagnostic on this response: type=${d.type}` +
          (d.error
            ? ` error=${d.error.name ?? ""} ${d.error.message} (code=${d.error.code ?? "n/a"})`
            : "") +
          (d.details ? ` details=${JSON.stringify(d.details)}` : ""),
      );
    }
  }

  const text = lastAssistant.content
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text)
    .join("");

  if (!text) {
    throw new Error(
      `session-runner: assistant produced no text (provider=${lastAssistant.provider}/${lastAssistant.model}, ` +
        `stopReason=${lastAssistant.stopReason}` +
        (lastAssistant.errorMessage
          ? `, error=${lastAssistant.errorMessage}`
          : "") +
        ")",
    );
  }

  return { content: text };
  };
}

const productionQueryFn = createProductionQueryFn();
const sessionRunner = createSessionRunner({ queryFn: productionQueryFn });

export interface OnEntryCreatedDeps {
  snapshotStore: SnapshotStore;
  sessionRunner: SessionRunner;
  observationStore: ObservationStore;
  patternStore: PatternStore;
  entryStore: EntryStore;
  profileStore: ProfileStore;
  /** Injectable clock, defaulting to the real one. Matches the DI-for-time
   * convention used by observation-store.ts's `now` dependency, so the
   * snapshot's `date` field can be pinned in tests. */
  now?: () => string;
}

/**
 * Computes metrics once, persists them as a durable snapshot (REQ-LPC-7),
 * then hands the same computed metrics to observe() via precomputedMetrics
 * so the Observer doesn't recompute them. Snapshot save happens before the
 * Observer call so the entry's time-series record is durable even if the
 * LLM call fails.
 */
export function createOnEntryCreated(deps: OnEntryCreatedDeps) {
  const now = deps.now ?? (() => new Date().toISOString());
  const {
    snapshotStore,
    sessionRunner,
    observationStore,
    patternStore,
    entryStore,
    profileStore,
  } = deps;

  return async (entryIdStr: string, entryText: string) => {
    const metrics = computeEntryMetrics(entryText);

    await snapshotStore.save(entryIdStr, {
      entryId: entryIdStr,
      date: now(),
      metrics,
      schemaVersion: 1,
    });

    return observe(
      {
        sessionRunner,
        observationStore,
        patternStore,
        computeMetrics: computeEntryMetrics,
        readStyleProfile: () => profileStore.toPromptMarkdown(),
        listSnapshots: () => snapshotStore.listAll(),
        ledgerCap: config.ledgerCap,
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
      metrics,
    );
  };
}

/**
 * Re-observes an existing entry without changing its historical metrics
 * snapshot. The original snapshot is reused for prompt consistency; entries
 * created before snapshots existed use transiently computed metrics instead.
 */
export function createOnEntryReflection(deps: OnEntryCreatedDeps) {
  const {
    snapshotStore,
    sessionRunner,
    observationStore,
    patternStore,
    entryStore,
    profileStore,
  } = deps;

  return async (entryIdStr: string, entryText: string) => {
    const metrics = (await snapshotStore.get(entryIdStr))?.metrics ?? computeEntryMetrics(entryText);
    return observe(
      {
        sessionRunner,
        observationStore,
        patternStore,
        computeMetrics: computeEntryMetrics,
        readStyleProfile: () => profileStore.toPromptMarkdown(),
        listSnapshots: () => snapshotStore.listAll(),
        ledgerCap: config.ledgerCap,
        corpusSize: async () => (await entryStore.list()).length,
        recentEntries: async (limit: number) => {
          const items = await entryStore.list();
          const recent = items.filter((item) => item.id !== entryIdStr).slice(0, limit);
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
      metrics,
      {
        replaceCurrentObservations: async (entryId, observationIds) => {
          if (!observationStore.replaceCurrentForEntry) {
            throw new Error("observation store does not support reflection replacement");
          }
          await observationStore.replaceCurrentForEntry(entryId, observationIds);
        },
      },
    );
  };
}

const onEntryCreated = createOnEntryCreated({
  snapshotStore,
  sessionRunner,
  observationStore,
  patternStore,
  entryStore,
  profileStore,
});
const onEntryReflected = createOnEntryReflection({
  snapshotStore,
  sessionRunner,
  observationStore,
  patternStore,
  entryStore,
  profileStore,
});

// `server` is only assigned when this module is the process entry point (see
// the `import.meta.main` guard below). Tests import this file to reach
// `createOnEntryCreated` and other factories without triggering the real
// daemon bootstrap (socket bind, Bun.serve, pi-agent warm-up network call) —
// none of that is safe or deterministic to run as a module-import side
// effect (testing-review.md: mock/avoid non-deterministic external
// resources). `bun run src/index.ts` (the actual entry point) still runs it,
// because Bun sets `import.meta.main` true only for the module executed
// directly.
export let server: ReturnType<typeof Bun.serve> | undefined;

if (import.meta.main) {
  // Resolved once at import time from process.env — logged here so a
  // daemon started from a shell where INK_MIRROR_DATA differs from what the
  // CLI/web expect is visible immediately instead of discovered later as a
  // silent "wrong directory" mismatch.
  console.log(`[daemon] DATA_DIR=${DATA_DIR} SOCKET_PATH=${SOCKET_PATH}`);

  // Migration (REQ-LPC-27/30) must finish before any route can serve a
  // request: it's what brings profile.md and any pre-Phase-3 observation
  // files up to the shape every store/route below assumes. Idempotent — a
  // no-op after the first successful run.
  const migrationResult = await runMigration({
    patternStore,
    profileStore,
    observationStore,
    profilePath: PROFILE_PATH,
    legacyObservationsDir: LEGACY_OBSERVATIONS_DIR,
    sightingsDir: SIGHTINGS_DIR,
    dataDir: DATA_DIR,
  });
  if (migrationResult.migrated) {
    console.log(
      `[migration] ran: profile=${migrationResult.profileMigrated} ` +
        `legacyObservations=${migrationResult.legacyObservationsMigrated} ` +
        `patternsCreated=${migrationResult.patternsCreated} backup=${migrationResult.backupDir}`,
    );
  } else {
    console.log("[migration] nothing to migrate");
  }

  const eventBus = createEventBus();

  const entryRoutes = createEntryRoutes({
    entryStore,
    onEntryCreated,
    onEntryReflected,
    eventBus,
  });
  const observationRoutes = createObservationRoutes({ observationStore });
  const patternRoutes = createPatternRoutes({
    patternStore,
    observationStore,
    entryStore,
    snapshotStore,
    profileStore,
    config,
    eventBus,
  });
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
    routeModules: [
      entryRoutes,
      observationRoutes,
      patternRoutes,
      profileRoutes,
      eventsRoutes,
      nudgeRoutes,
    ],
    eventBus,
  });

  // Clean up stale socket file
  try {
    const { unlinkSync } = await import("node:fs");
    unlinkSync(SOCKET_PATH);
  } catch {
    // Socket doesn't exist yet, that's fine
  }

  server = Bun.serve({
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
      noExtensions: true,
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
    console.error(
      `[pi-agent] startup check failed: ${err instanceof Error ? err.message : err}`,
    );
  });
}
