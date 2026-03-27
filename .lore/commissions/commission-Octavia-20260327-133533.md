---
title: "Commission: Document Claude Agent SDK as sole AI library in architecture pattern"
date: 2026-03-27
status: dispatched
type: one-shot
tags: [commission]
worker: Octavia
workerDisplayTitle: "Guild Chronicler"
prompt: "Update `.lore/reference/architecture-pattern.md` to make it clear that `@anthropic-ai/claude-agent-sdk` is the only AI library the project should use.\n\n**Rationale to include:** Using the Claude Agent SDK lets us leverage Claude Code and OAuth without paying per-token via the raw API. This is a hard constraint, not a preference.\n\nAdd this as a clear, prominent section or constraint in the document. Make sure it's unambiguous: no raw `@anthropic-ai/sdk`, no other LLM libraries. Only `@anthropic-ai/claude-agent-sdk`."
dependencies: []
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-03-27T20:35:33.911Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-03-27T20:35:33.915Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
current_progress: ""
projectName: ink-mirror
---
