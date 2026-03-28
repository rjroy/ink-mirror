# ink-mirror

A writing self-awareness tool. Write journal entries, receive observations about your writing patterns, and curate those observations over time.

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.2+
- Claude authentication (the daemon uses the [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk), which supports API keys, OAuth, and other auth methods)

### Development

```bash
bun install
bun run dev        # starts daemon + web dev server
```

The web UI is at http://localhost:3000. The daemon listens on a Unix socket at `~/.ink-mirror/ink-mirror.sock`.

## CLI

The CLI discovers its commands from the daemon at runtime. The daemon must be running first.

```bash
# In one terminal:
bun run dev

# In another terminal:
bun run --filter @ink-mirror/cli start           # show available commands
bun run --filter @ink-mirror/cli start -- write   # write a journal entry ($EDITOR)
bun run --filter @ink-mirror/cli start -- curate  # classify pending observations
bun run --filter @ink-mirror/cli start -- profile # view your style profile
```

The CLI connects to the daemon via Unix socket. If the daemon isn't running, the CLI prints a connection error with the expected socket path.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `INK_MIRROR_SOCKET` | `~/.ink-mirror/ink-mirror.sock` | Unix socket path for daemon |
| `INK_MIRROR_DATA` | `~/.ink-mirror` | Data directory for entries and observations |

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start daemon + web in development mode |
| `bun run start` | Start daemon + web in production mode |
| `bun run build` | Build the web package |
| `bun test` | Run all tests |
| `bun run lint` | Lint all packages |
| `bun run typecheck` | TypeScript type checking |
