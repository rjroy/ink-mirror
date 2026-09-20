# ink-mirror

A writing self-awareness tool. Daemon-first architecture: the daemon is the application, CLI and web are rendering surfaces.

## Stack

- **Runtime:** Bun
- **Daemon:** Hono on Unix socket via `Bun.serve()`
- **CLI:** Plain bun scripts, discovers operations from daemon at runtime
- **Shared:** Zod schemas, TypeScript types, branded IDs
- **Web:** Next.js App Router

## Project Structure

```
packages/
  shared/   - Zod schemas, branded IDs, API contracts
  daemon/   - Hono routes, DI factories, operations registry, EventBus
  cli/      - Runtime discovery from daemon /help, command execution
  web/      - Next.js App Router frontend
```

## Testing

- Use `bun test` for all tests
- **Do not use `mock.module()`** - it causes infinite loops in bun and creates brittle tests
- Use dependency injection: pass dependencies as parameters, not imports
- Route factories receive mock deps in tests (Hono's `app.request()` test client)
- 90%+ coverage target on new code

## Architecture

- Route factories: `createXRoutes(deps) -> RouteModule` (routes + operations)
- Operations registry builds a help tree for CLI discovery
- Export interfaces, not concrete implementations
- All LLM interaction goes through a single session runner (not in this commission)
- All durable state is in human-readable files (markdown, YAML)
- Single-user tool, no auth

## Critical Lessons

- SSE connections should be scoped to when they're needed (e.g., open on submission, close on completion). Opening on mount and holding forever wastes resources and hits Bun's idle timeout.
- Bun.serve() has a 10-second default idle timeout. Any long-lived connection (SSE, WebSocket) needs a heartbeat to stay alive. A keepalive event every 5 seconds prevents Bun from killing the connection and also keeps intermediary proxies alive.

## Commands

```bash
bun install          # Install all workspace dependencies
bun test             # Run all tests recursively
bun run typecheck    # TypeScript project references build check
bun run lint         # ESLint across all packages
```


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:6cd5cc61 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->
