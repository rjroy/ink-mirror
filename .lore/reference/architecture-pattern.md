---
title: Guild Hall Architecture Pattern
status: active
tags: [architecture, reference, portable]
date: 2026-03-26
---

# Guild Hall Architecture Pattern

A daemon-centric multi-agent workspace. The daemon is the application boundary. Everything else is a client.

## Four Systems

| System | Stack | Role |
|--------|-------|------|
| **Daemon** | Hono on Unix socket via `Bun.serve()` | Authority. Owns all state, git, sessions, scheduling. |
| **Web** | Next.js App Router (server + client components) | Read-only UI. Calls daemon REST API for writes. |
| **CLI** | Plain bun scripts | Discovers operations from daemon at runtime. No built-in catalog. |
| **Workers** | Bun packages with metadata + `activate()` export | Specialists. Define identity, tools, behavior. Project-agnostic. |

The daemon runs on a Unix socket (or TCP for cross-platform). Web and CLI never touch the filesystem, git, or config directly. Workers interact through MCP tools provided by the toolbox system.

## Daemon Internals

### Route/Service Split with DI Factories

Every route file is a factory: `createXRoutes(deps) → RouteModule`. Each factory receives only the slice of dependencies it needs. Production wiring lives in one place (`createProductionApp()`), which builds real deps and passes them down.

```typescript
type RouteModule = {
  routes: Hono;
  operations: OperationDefinition[];
};
```

Tests provide mock deps. The app can start with a fallback if production setup fails.

### Five-Layer Service Architecture

Commissions (and by extension any autonomous activity) decompose into layers. Dependencies flow upward only.

| Layer | Responsibility | Boundary |
|-------|---------------|----------|
| 1. Records | YAML I/O for state files | Pure. No side effects beyond disk. |
| 2. Lifecycle | State machine transitions, event emission | No git, no SDK. Emits events on transitions. |
| 3. Workspace | Git operations (branch, worktree, merge) | No SDK, no artifacts. |
| 4. Session Prep | Tool resolution, memory injection, model selection | Composes SDK environment. Doesn't run it. |
| 5. Orchestrator | Coordinates layers 1-4, implements public interface | The only layer routes talk to. |

When code touches more than one layer, that's a signal to check whether a boundary is missing.

### Five Concerns (Cross-cutting)

| Concern | Responsibility | Never touches |
|---------|---------------|---------------|
| **Session** | SDK interaction (query, stream, abort) | Git, artifacts, activity types |
| **Activity** | Git isolation (branch, worktree, merge) | SDK, artifacts, activity types |
| **Artifact** | Structured document I/O (frontmatter, timeline) | Git, SDK |
| **Toolbox** | Tool composition and resolution | Direct artifact writes |
| **Worker** | Identity, posture, capability declaration | How it got activated |

Commissions and meetings are orchestrators that compose these concerns. They sequence steps; they don't implement infrastructure.

## Agent Integration (Claude Agent SDK)

All LLM calls go through the Claude Agent SDK. No direct API calls. The SDK provides the tool-use loop, error handling, and session management.

### SDK Runner

A unified session runner handles both commissions and meetings:

- `prepareSdkSession()`: Resolves toolbox, injects memory, selects model, builds system prompt
- `runSdkSession()`: Iterates the SDK stream, yields `SdkRunnerEvent` items

Orchestrators map `SdkRunnerEvent` to their domain event types. The runner is context-free (no activity IDs, no knowledge of commissions vs meetings).

### Event Translator

SDK message types are implementation details. The translator converts them to a stable event schema:

- SDK text delta → `{ type: "text_delta"; text }`
- SDK tool call → `{ type: "tool_use"; name; input; id }`
- SDK result → `{ type: "turn_end"; cost }`

Stateful: tracks `blockToolIds` to correlate chunked JSON deltas with tool IDs across content block events.

### Toolbox Composition (Five Tiers)

1. **Base toolbox** (always): Memory, artifact reading, decisions
2. **Context toolbox** (auto): Registered per context type (meeting, commission, etc.)
3. **System toolboxes**: From `worker.systemToolboxes` (e.g., `["manager"]`)
4. **Domain toolboxes**: From discovered packages
5. **Built-in tools**: Allowed tool names for Claude Code (e.g., `["Read", "Write", "Bash"]`)

Resolver validates at activation time. If a declared toolbox doesn't exist, it throws.

## Worker Package Model

Each worker is a bun package with metadata in `package.json` and an `activate()` export.

### Package Metadata

```json
{
  "guildHall": {
    "type": "worker",
    "identity": {
      "name": "Developer",
      "description": "Code implementation",
      "guidance": "When to pick this worker"
    },
    "posture": "System prompt shaping behavior",
    "model": "sonnet",
    "systemToolboxes": [],
    "domainPlugins": ["plugin-name"],
    "builtInTools": ["Read", "Write", "Bash"],
    "checkoutScope": "sparse"
  }
}
```

### Activation Contract

```typescript
export async function activate(context: ActivationContext): Promise<ActivationResult> {
  return {
    systemPrompt: buildPrompt(context.identity, context.posture, context.injectedMemory),
    tools: context.resolvedTools,
  };
}
```

Workers declare what they need. They don't know how they got activated or what orchestrator is driving them.

## Git Isolation

### Three-Branch Model

- **`master`**: User's branch. Only receives PRs.
- **`claude/main`**: Integration branch. Receives squash-merges from activity branches.
- **Activity branches**: Short-lived (`claude/commission/<id>`, `claude/meeting/<id>`). Created from `claude/main`, squash-merged back on completion.

### Worktree Layout

```
~/.guild-hall/
  projects/<name>/              # Integration worktree (always on claude/main)
  worktrees/<name>/
    commission-<id>/            # Ephemeral, deleted after merge
    meeting-<id>/               # Ephemeral, deleted after merge
```

Each concurrent activity gets its own worktree on its own branch. No merge conflicts during execution.

### Environment Isolation

Every git subprocess strips `GIT_DIR`, `GIT_WORK_TREE`, and `GIT_INDEX_FILE`. Without this, operations spawned during hooks target the wrong repository.

## Two Activity Types

### Commissions (Autonomous)

Fire-and-forget. Worker runs to completion without human interaction.

```
pending → dispatched → in_progress → completed/failed/cancelled/abandoned
```

- Capacity-limited (configurable concurrent count)
- Queued commissions auto-dispatch when slots open
- Dependencies between commissions (blocked until deps complete)
- Scheduled commissions via cron (croner library)
- On failure: preserve worktree for debugging

### Meetings (Interactive)

Multi-turn conversation with streaming.

```
requested → open → (turns) → closed
```

- Async generator yields events as they arrive
- Client iterates via SSE streaming
- `sendMessage()` resumes generator with new user turn
- On close: generate notes, merge branch, clean up worktree

## EventBus and SSE

Simple set-based pub/sub. Lifecycle machines emit events on state transitions. SSE route streams events to browser.

Event types: `commission_status`, `commission_progress`, `commission_result`, `meeting_started`, `meeting_ended`, `schedule_spawned`, etc.

Socket idle timeout must be disabled (`idleTimeout: 0`) for long-lived SSE connections.

## Operations Registry and CLI Discovery

Routes export `OperationDefinition` objects with hierarchy metadata. The registry builds a navigation tree.

```typescript
interface OperationDefinition {
  operationId: string;          // "commission.run.dispatch"
  name: string;                 // "dispatch"
  description: string;
  invocation: { method: string; path: string };
  requestSchema?: ZodType;
  hierarchy: { root: string; feature: string };
  parameters?: OperationParameter[];
  idempotent: boolean;
}
```

CLI fetches the tree from `/help` endpoints. Progressive discovery:

```
guild-hall help                    → Full tree
guild-hall commission help         → Subtree
guild-hall commission run dispatch → Operation details
```

The CLI binary contains no operation catalog. The daemon is the source of truth.

## Memory System

Three scopes, all file-based:

| Scope | Path | Access |
|-------|------|--------|
| Global | `~/.guild-hall/memory/global/` | All workers, all projects |
| Project | `~/.guild-hall/memory/projects/<name>/` | All workers in one project |
| Worker | `~/.guild-hall/memory/workers/<name>/` | One worker only |

Workers read via `read_memory` and edit via `edit_memory` (upsert, append, or delete named sections). Memory is injected into system prompts during session prep.

## State Model

All durable state is in YAML/markdown files. No database.

- **Config**: `~/.guild-hall/config.yaml` (project registry, model config, settings)
- **Commission state**: `~/.guild-hall/state/commissions/<id>.yaml`
- **Meeting state**: `~/.guild-hall/state/meetings/<id>.yaml`
- **Schedule state**: `~/.guild-hall/state/schedules/<id>.yaml`
- **Artifacts**: `<project>/.lore/` (markdown with YAML frontmatter)

Humans can inspect and edit state files directly.

## Type Boundaries

- **`lib/types.ts`**: Shared types (ChatMessage, AppConfig, WorkerMetadata, ResolvedModel). Never imports from `daemon/` or `web/`.
- **`daemon/types.ts`**: Daemon-specific types (branded IDs: MeetingId, CommissionId, SdkSessionId; status types; event types).
- **Branded types** prevent mixing ID namespaces at compile time.

## Production Initialization Order

1. Load config from YAML
2. Verify/recreate integration worktrees
3. Smart sync (fetch, detect merged PRs, rebase)
4. Discover packages from scan paths
5. Prepend built-in Guild Master worker
6. Create lazy refs for circular dependencies
7. Assemble layers bottom-up (records → lifecycle → workspace → session prep → orchestrator)
8. Create meeting session, recover open meetings
9. Create commission orchestrator, recover failed commissions
10. Create scheduler, run catchup, start tick
11. Create briefing generator, start refresh
12. Load package-contributed operations
13. Create event router, notification service
14. Build app, mount routes, build registry
15. Return app + shutdown function

Lazy refs break circular dependencies: commission orchestrator is constructed before meeting session but needs a callback to create meeting requests for escalation. A mutable ref gets populated after meeting session construction.

## Testing Seams

- `queryFn`: Mock SDK (return test event generators)
- `gitOps`: Mock git subprocess calls
- `recordOps`: Mock YAML I/O
- `createLog`: Inject `collectingLog` or `nullLog`
- Hono's `app.request()` test client with injected deps
- `fs.mkdtemp()` for temp directories, `GUILD_HALL_HOME` env var for isolation
- Never `mock.module()` (causes infinite loops in bun)

Export interfaces, not concrete implementations. Concrete types are internal; public contracts are interfaces.

## Recreating This for a New Project

The agent's purpose changes per project. The infrastructure doesn't.

1. **Daemon core**: Hono + Unix socket + config loader + event bus + DI factories
2. **Define your workers**: Packages with identity, posture, tools. What specialists does your domain need?
3. **Route factories + operations registry**: REST surface with self-describing operations
4. **Layer your orchestrators**: Records → Lifecycle → Workspace → Session Prep → Orchestrator
5. **Git isolation**: Three-branch model + worktrees per activity
6. **CLI as client**: Discovers operations from daemon. No built-in catalog.
7. **Web as client**: Next.js reads from daemon API. Server components for static reads, client components for interactive elements.
8. **Testing from day one**: DI seams at every boundary. Mock the SDK, git, and I/O.

The key insight: the daemon is the sole authority boundary. Three client surfaces (web, CLI, agents) all flow through its REST API and event system.
