# ink-mirror

A writing self-awareness tool. Daemon-first architecture: the daemon is the application, CLI and web are rendering surfaces.

## Stack

- **Runtime:** Bun
- **Daemon:** Hono on Unix socket via `Bun.serve()`
- **CLI:** Plain bun scripts, discovers operations from daemon at runtime
- **Shared:** Zod schemas, TypeScript types, branded IDs
- **Web (future):** Next.js App Router

## Project Structure

```
packages/
  shared/   - Zod schemas, branded IDs, API contracts
  daemon/   - Hono routes, DI factories, operations registry, EventBus
  cli/      - Runtime discovery from daemon /help, command execution
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
