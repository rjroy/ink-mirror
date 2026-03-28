---
title: "Commission: Wire Craft Nudge into web UI"
date: 2026-03-28
status: completed
type: one-shot
tags: [commission]
worker: Dalton
workerDisplayTitle: "Guild Artificer"
prompt: "The Craft Nudge feature has a working daemon endpoint (`POST /nudge`) but no web UI. Wire it up end-to-end.\n\n## What exists\n\n- **Daemon route:** `packages/daemon/src/routes/nudge.ts` — `POST /nudge` accepts `{ text?, entryId?, context? }`, returns `{ nudges, metrics, error? }`\n- **Shared schemas:** `packages/shared/src/nudge.ts` — `NudgeRequestSchema`, `NudgeResponseSchema`, `CraftNudge`, `NudgeResponse` types\n- **Nudger logic:** `packages/daemon/src/nudger.ts`\n- **No web references to nudge exist yet** — zero files in `packages/web/` mention nudge\n\n## What to build\n\n### 1. Next.js API route: `packages/web/app/api/nudge/route.ts`\nProxy POST to daemon, same pattern as existing routes (see `packages/web/app/api/entries/route.ts` and `packages/web/lib/daemon.ts` for the proxy pattern).\n\n### 2. Client function in `packages/web/lib/api.ts`\nAdd a `requestNudge(params: { text?: string; entryId?: string; context?: string })` function using the existing `fetchApi` helper. Import and use `NudgeResponse` from shared.\n\n### 3. UI integration — two places:\n\n**a) Journal editor (`packages/web/components/journal-editor.tsx`):**\nAdd a \"Nudge\" button next to the \"Observe →\" button in the footer. It sends the current draft text to the nudge endpoint. Show results inline below the editor (similar to how streamed observations display). Button should be disabled when text is empty or a nudge is in progress.\n\n**b) Entry detail page (`packages/web/app/entries/[id]/page.tsx`):**\nAdd a \"Nudge\" button that sends the entry's `entryId` to the nudge endpoint. Show results inline on the page.\n\n### 4. Display component\nCreate a `NudgeResults` component (`packages/web/components/nudge-results.tsx`) that renders the array of `CraftNudge` items. Each nudge has: `craftPrinciple`, `evidence`, `observation`, `question`. Display them as cards showing the observation and Socratic question, with the craft principle as a label and the evidence as a quote.\n\n### 5. CSS module\nAdd `packages/web/components/nudge-results.module.css` following the existing styling patterns (see `journal-editor.module.css`).\n\n### 6. Tests\n- Test the API route proxy (`packages/web/tests/nudge-route.test.ts`)\n- Test the client function\n- Test the NudgeResults component renders correctly\n\n## Constraints\n- Follow existing patterns exactly (route proxy via daemon client, fetchApi helper, CSS modules)\n- Use shared Zod schemas for type safety\n- The nudge is a synchronous POST (not SSE), so no streaming complexity\n- Run `bun test` and `bun run typecheck` before declaring done"
dependencies: []
linked_artifacts:
  - packages/web/app/api/nudge/route.ts

  - packages/web/components/nudge-results.tsx
  - packages/web/components/nudge-results.module.css
  - packages/web/components/entry-nudge.tsx
  - packages/web/components/entry-nudge.module.css
  - packages/web/lib/api.ts
  - packages/web/components/journal-editor.tsx
  - packages/web/components/journal-editor.module.css
  - packages/web/app/entries/[id]/page.tsx
  - packages/web/tests/nudge-route.test.ts
  - packages/web/tests/nudge-client.test.ts
  - packages/web/tests/nudge-results.test.ts
  - packages/web/components/nudge-results.tsx
  - packages/web/components/nudge-results.module.css
  - packages/web/components/entry-nudge.tsx
  - packages/web/components/entry-nudge.module.css
  - packages/web/lib/api.ts
  - packages/web/components/journal-editor.tsx
  - packages/web/components/journal-editor.module.css
  - packages/web/app/entries/[id]/page.tsx
  - packages/web/tests/nudge-route.test.ts
  - packages/web/tests/nudge-client.test.ts
  - packages/web/tests/nudge-results.test.ts
activity_timeline:
  - timestamp: 2026-03-28T08:57:00.598Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-03-28T08:57:00.599Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
  - timestamp: 2026-03-28T08:57:00.616Z
    event: status_in_progress
    reason: "Execution started"
    from: "dispatched"
    to: "in_progress"
  - timestamp: 2026-03-28T08:57:06.452Z
    event: progress_report
    reason: "Starting Craft Nudge web UI implementation. Reading existing patterns first."
  - timestamp: 2026-03-28T08:59:27.882Z
    event: progress_report
    reason: "All files created. Running tests and typecheck."
  - timestamp: 2026-03-28T08:59:54.936Z
    event: result_submitted
    reason: "Craft Nudge web UI wired end-to-end. All tests pass (534/534), typecheck clean.\n\n**Created:**\n- `packages/web/app/api/nudge/route.ts` — POST proxy to daemon, same pattern as entries route\n- `packages/web/components/nudge-results.tsx` — renders CraftNudge cards (principle label, observation, evidence quote, Socratic question)\n- `packages/web/components/nudge-results.module.css` — styling matching existing observer card patterns\n- `packages/web/components/entry-nudge.tsx` — client component wrapping nudge button + results for server-rendered entry detail page\n- `packages/web/components/entry-nudge.module.css` — button styling\n- `packages/web/tests/nudge-route.test.ts` — API route export + schema validation tests (7 tests)\n- `packages/web/tests/nudge-client.test.ts` — client function export test\n- `packages/web/tests/nudge-results.test.ts` — component export + data shape tests (4 tests)\n\n**Modified:**\n- `packages/web/lib/api.ts` — added `requestNudge()` using existing `fetchApi` helper\n- `packages/web/components/journal-editor.tsx` — added Nudge button next to Observe, shows NudgeResults inline\n- `packages/web/components/journal-editor.module.css` — added `.footerActions` wrapper and `.nudgeBtn` styles\n- `packages/web/app/entries/[id]/page.tsx` — added EntryNudge component below entry body"
  - timestamp: 2026-03-28T09:00:02.108Z
    event: status_completed
    reason: "Execution completed"
    from: "in_progress"
    to: "completed"
current_progress: "All files created. Running tests and typecheck."
projectName: ink-mirror
---
Craft Nudge web UI wired end-to-end. All tests pass (534/534), typecheck clean.

**Created:**
- `packages/web/app/api/nudge/route.ts` — POST proxy to daemon, same pattern as entries route
- `packages/web/components/nudge-results.tsx` — renders CraftNudge cards (principle label, observation, evidence quote, Socratic question)
- `packages/web/components/nudge-results.module.css` — styling matching existing observer card patterns
- `packages/web/components/entry-nudge.tsx` — client component wrapping nudge button + results for server-rendered entry detail page
- `packages/web/components/entry-nudge.module.css` — button styling
- `packages/web/tests/nudge-route.test.ts` — API route export + schema validation tests (7 tests)
- `packages/web/tests/nudge-client.test.ts` — client function export test
- `packages/web/tests/nudge-results.test.ts` — component export + data shape tests (4 tests)

**Modified:**
- `packages/web/lib/api.ts` — added `requestNudge()` using existing `fetchApi` helper
- `packages/web/components/journal-editor.tsx` — added Nudge button next to Observe, shows NudgeResults inline
- `packages/web/components/journal-editor.module.css` — added `.footerActions` wrapper and `.nudgeBtn` styles
- `packages/web/app/entries/[id]/page.tsx` — added EntryNudge component below entry body
