---
title: "Commission: Phase 1A: Project Scaffold"
date: 2026-03-27
status: dispatched
type: one-shot
tags: [commission]
worker: Dalton
workerDisplayTitle: "Guild Artificer"
prompt: "Implement Commission 1A from `.lore/plans/v1-core-loop.md`: Project Scaffold.\n\nRead the full plan and spec (`.lore/specs/v1-core-loop.md`) before starting. Read `.lore/reference/architecture-pattern.md` for the daemon-first architecture pattern.\n\n## What to build\n\nMonorepo structure (bun workspace) with three packages:\n\n| Package | Stack | Contents |\n|---------|-------|----------|\n| `daemon` | Hono on Bun, Unix socket | Route factories, DI wiring, operations registry, `/help` endpoints |\n| `cli` | Plain bun scripts | Runtime discovery from daemon `/help`, command execution |\n| `shared` | Zod schemas, TypeScript types | Shared types, branded IDs, API contracts |\n\nSpecific deliverables:\n- `Bun.serve()` with Hono on Unix socket (REQ-V1-30)\n- Route/service factory pattern with DI (REQ-V1-28)\n- `OperationDefinition` type and operations registry\n- `/help` endpoint tree for CLI discovery (REQ-V1-29)\n- CLI binary that discovers operations from daemon and executes them\n- EventBus (simple set-based pub/sub for later SSE use)\n- Shared Zod schemas for API contracts\n- Branded ID types (`EntryId`, `ObservationId`)\n\n## Testing\n\n- Unit tests: route factories with mocked dependencies, operations registry builds correct tree\n- CLI discovery: verify CLI can parse `/help` output\n- 90%+ coverage on new code\n\n## Constraints\n\n- Never `mock.module()` (causes infinite loops in bun). Use dependency injection.\n- Export interfaces, not concrete implementations.\n- This is greenfield. Set up proper `.gitignore`, `tsconfig.json`, `eslint.config.js` for the monorepo."
dependencies: []
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-03-27T17:37:38.263Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-03-27T17:41:28.654Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
current_progress: ""
projectName: ink-mirror
---
