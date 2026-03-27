---
title: "Commission: Phase 5A: Next.js Web Client"
date: 2026-03-27
status: blocked
type: one-shot
tags: [commission]
worker: Dalton
workerDisplayTitle: "Guild Artificer"
prompt: "Implement Commission 5A from `.lore/plans/v1-core-loop.md`: Next.js Web Client.\n\nRead the full plan and spec (`.lore/specs/v1-core-loop.md`) before starting.\n\n## What to build\n\n- Next.js app with App Router (REQ-V1-31) as a new package in the monorepo\n- Server components for read operations: entry list, entry detail, profile view\n- Client components for interactive operations: journal editor (write + submit), curation interface (classify observations with original text visible), profile editor\n- SSE connection for streaming observation results (real-time feedback when Observer runs)\n- All data flows through daemon API. Web client makes no direct file or LLM calls (REQ-V1-24).\n- Navigation between write, curate, and profile views\n\n## Testing\n\n- Unit tests: web API calls match CLI behavior for identical operations\n- Integration test: create entry via CLI, view in web. Create entry via web, view in CLI. (REQ-V1-25)\n- Integration test: full loop through web: write, observe, curate, verify profile\n- Integration test: SSE streaming delivers observation events\n- 90%+ coverage on new code\n\n## Constraints\n\n- The web client is a view, not the application. It reads from and writes to the daemon API. No local state beyond what's needed for React rendering."
dependencies:
  - commission-Dalton-20260327-104043
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-03-27T17:40:56.646Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-03-27T17:48:48.113Z
    event: status_blocked
    reason: "Dependencies not satisfied"
    from: "pending"
    to: "blocked"
current_progress: ""
projectName: ink-mirror
---
