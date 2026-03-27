---
title: "Commission: Plan: Developer experience cleanup (root scripts, CLI docs, web styling)"
date: 2026-03-27
status: dispatched
type: one-shot
tags: [commission]
worker: Octavia
workerDisplayTitle: "Guild Chronicler"
prompt: "## Context\n\nink-mirror is a bun workspace monorepo with packages: `shared`, `daemon`, `cli`, `web`. The root `package.json` currently has `test`, `lint`, and `typecheck` scripts but no `dev`, `start`, or `build`.\n\nCurrent state:\n- `packages/daemon/package.json` has `start` (bun run src/index.ts) but no `dev`\n- `packages/web/package.json` has `dev` (next dev --turbopack), `build` (next build), `start` (next start)\n- `packages/cli/` exists but there's no clear documentation on how to run it\n- The web layer has no styling aligned with Sienna's visual direction (`.lore/art/visual-direction.md`)\n\n## What needs to happen\n\nWrite a plan for Dalton covering these cleanup tasks:\n\n### 1. Root-level scripts\n\nAdd to root `package.json`:\n- `bun run dev` — concurrently runs daemon and web dev servers\n- `bun run start` — concurrently runs daemon and web in production mode\n- `bun run build` — builds the web package (the daemon runs directly via bun, no build step needed)\n\nFor concurrent execution, evaluate options (bun's built-in capabilities, `concurrently` package, or simple shell `&` with trap). Pick the simplest reliable approach.\n\n### 2. CLI documentation\n\nMake it clear in the README (or create one if needed) how to run the CLI. The CLI discovers operations from the daemon at runtime, so the daemon must be running first. Document that flow.\n\n### 3. Web layer visual alignment\n\nSienna produced a complete visual direction in `.lore/art/visual-direction.md` with:\n- Palette (warm cream backgrounds, near-black ink, slate blue observer accent)\n- Typography (Georgia serif for writing, system sans for chrome, specific sizes/weights)\n- Layout direction (journal entry screen wireframe)\n- Texture rules (no shadows, hairline borders, generous spacing)\n\nThe plan should cover applying this visual direction to the web layer's global styles, layout components, and any existing pages. Read the full visual direction doc for specifics. The HTML mockup at `.lore/art/journal-screen-mockup.html` may also be useful reference.\n\n### 4. Daemon dev mode\n\nThe daemon needs a `dev` script that watches for changes (bun --watch or similar). Currently only has `start`.\n\n## Output\n\nWrite the plan to `.lore/plans/dx-cleanup.md`. Structure it as discrete commissions Dalton can execute. Keep it concrete: what files change, what the scripts look like, what CSS/styling approach to use."
dependencies: []
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-03-27T22:31:44.905Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-03-27T22:31:44.907Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
current_progress: ""
projectName: ink-mirror
---
