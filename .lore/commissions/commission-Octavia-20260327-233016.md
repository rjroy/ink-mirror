---
title: "Commission: Plan: Craft Nudge implementation"
date: 2026-03-28
status: dispatched
type: one-shot
tags: [commission]
worker: Octavia
workerDisplayTitle: "Guild Chronicler"
prompt: "Write an implementation plan for the Craft Nudge spec at `.lore/specs/craft-nudge.md`.\n\n**Read first:**\n- `.lore/specs/craft-nudge.md` — the spec you're planning against\n- `.lore/plans/observer-prompt-quality.md` — for plan format reference and to understand how plans work in this project\n- `.lore/plans/v1-core-loop.md` — the v1 plan, for broader format and delegation guide conventions\n- Key implementation files to understand current patterns:\n  - `packages/daemon/src/observer.ts` — existing prompt construction and observation pipeline\n  - `packages/daemon/src/routes/` — route factory patterns\n  - `packages/shared/src/` — schema patterns\n\n**Plan requirements:**\n- Break the work into sequenced implementation steps\n- Each step: files touched, requirements addressed, what to do, what to test\n- Include a delegation guide (which worker at which step, where review goes)\n- Include codebase context: reference actual files, functions, and line numbers so the implementer doesn't have to rediscover the architecture\n- Flag open questions or decisions that need resolution before implementation\n\n**Write to:** `.lore/plans/craft-nudge.md`"
dependencies: []
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-03-28T06:30:16.592Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-03-28T06:30:16.594Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
current_progress: ""
projectName: ink-mirror
---
