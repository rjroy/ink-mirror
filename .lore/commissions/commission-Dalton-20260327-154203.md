---
title: "Commission: DX cleanup: root scripts, daemon dev mode, and README"
date: 2026-03-27
status: dispatched
type: one-shot
tags: [commission]
worker: Dalton
workerDisplayTitle: "Guild Artificer"
prompt: "Implement Commissions 1 and 2 from `.lore/plans/dx-cleanup.md`.\n\n**Commission 1: Root Scripts and Daemon Dev Mode**\n\n1. Add `dev` script to `packages/daemon/package.json`: `\"dev\": \"bun --watch run src/index.ts\"`\n2. Add three scripts to root `package.json`:\n   - `\"dev\": \"trap 'kill 0' EXIT; bun run --filter '@ink-mirror/daemon' dev & bun run --filter '@ink-mirror/web' dev & wait\"`\n   - `\"start\": \"trap 'kill 0' EXIT; bun run --filter '@ink-mirror/daemon' start & bun run --filter '@ink-mirror/web' start & wait\"`\n   - `\"build\": \"bun run --filter '@ink-mirror/web' build\"`\n3. Keep existing scripts (test, lint, typecheck) unchanged.\n\n**Commission 2: CLI Documentation**\n\nCreate `README.md` at the repo root following the structure in the plan. Cover: quick start, CLI usage (daemon must be running first), environment variables, and the scripts table.\n\nCheck `packages/cli/` source to verify the actual CLI entry point and command names before documenting them. The README should match reality, not assumptions.\n\n**Verification:**\n- `bun run dev` starts both daemon and web\n- `bun run build` produces `.next/` output\n- Ctrl+C from `bun run dev` kills both child processes\n- README CLI commands match the actual CLI interface"
dependencies: []
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-03-27T22:42:03.751Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-03-27T22:42:03.753Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
current_progress: ""
projectName: ink-mirror
---
