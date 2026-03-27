---
title: "Commission: Document Claude Agent SDK as sole AI library in architecture pattern"
date: 2026-03-27
status: completed
type: one-shot
tags: [commission]
worker: Octavia
workerDisplayTitle: "Guild Chronicler"
prompt: "Update `.lore/reference/architecture-pattern.md` to make it clear that `@anthropic-ai/claude-agent-sdk` is the only AI library the project should use.\n\n**Rationale to include:** Using the Claude Agent SDK lets us leverage Claude Code and OAuth without paying per-token via the raw API. This is a hard constraint, not a preference.\n\nAdd this as a clear, prominent section or constraint in the document. Make sure it's unambiguous: no raw `@anthropic-ai/sdk`, no other LLM libraries. Only `@anthropic-ai/claude-agent-sdk`."
dependencies: []
linked_artifacts:
  - .lore/reference/architecture-pattern.md

activity_timeline:
  - timestamp: 2026-03-27T20:35:33.911Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-03-27T20:35:33.915Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
  - timestamp: 2026-03-27T20:35:33.930Z
    event: status_in_progress
    reason: "Execution started"
    from: "dispatched"
    to: "in_progress"
  - timestamp: 2026-03-27T20:35:49.844Z
    event: progress_report
    reason: "Read architecture-pattern.md. Adding a hard constraint section for the Claude Agent SDK requirement."
  - timestamp: 2026-03-27T20:36:25.880Z
    event: result_submitted
    reason: "Updated `.lore/reference/architecture-pattern.md` with two changes:\n\n1. **Added \"Hard Constraint: Claude Agent SDK Only\" section** (lines 14-23) immediately after the document introduction. Lists `@anthropic-ai/claude-agent-sdk` as the only permitted AI library, explicitly prohibits `@anthropic-ai/sdk` and all other LLM libraries, and states the rationale (Claude Code OAuth integration, no per-token cost).\n\n2. **Updated \"One Entry Point for SDK Calls\" section** to name the package explicitly (`@anthropic-ai/claude-agent-sdk`) and cross-reference the hard constraint section."
  - timestamp: 2026-03-27T20:36:32.860Z
    event: status_completed
    reason: "Execution completed"
    from: "in_progress"
    to: "completed"
current_progress: "Read architecture-pattern.md. Adding a hard constraint section for the Claude Agent SDK requirement."
projectName: ink-mirror
---
Updated `.lore/reference/architecture-pattern.md` with two changes:

1. **Added "Hard Constraint: Claude Agent SDK Only" section** (lines 14-23) immediately after the document introduction. Lists `@anthropic-ai/claude-agent-sdk` as the only permitted AI library, explicitly prohibits `@anthropic-ai/sdk` and all other LLM libraries, and states the rationale (Claude Code OAuth integration, no per-token cost).

2. **Updated "One Entry Point for SDK Calls" section** to name the package explicitly (`@anthropic-ai/claude-agent-sdk`) and cross-reference the hard constraint section.
