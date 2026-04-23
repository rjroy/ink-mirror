---
title: "Commission: Phase 4C: Fix CLI executor type coercion and help rendering"
date: 2026-04-23
status: dispatched
tags: [commission]
worker: Dalton
workerDisplayTitle: "Guild Artificer"
prompt: "Fix the CLI executor and help rendering bugs surfaced by Thorne's Phase 4B review (`.lore/commissions/commission-Thorne-20260422-165106.md`).\n\nBoth findings are pre-existing bugs, not scope expansion. Fixing them is a fix, not a spec deviation.\n\n## Finding 1 — Executor ignores declared parameter types\n\n**File:** `packages/cli/src/executor.ts` (primarily lines 19 and 47-51).\n\nThe executor declares `body: Record<string, string>` and assigns every positional arg as a string, regardless of the parameter's declared `type` in the operation metadata. The daemon's Zod schemas reject mismatches — e.g., `{ refresh: \"true\" }` fails `z.boolean()`.\n\nFix: use the parameter's declared `type` to coerce positional values before adding them to the body.\n- `type: \"boolean\"`: accept `\"true\"`/`\"false\"` (case-insensitive), coerce to real boolean. Anything else is a validation error returned to the user before sending.\n- `type: \"number\"`: parse as number, error on NaN.\n- `type: \"string\"`: pass through unchanged.\n- Unknown/missing type: pass through as string (preserves current behavior for unannotated ops).\n\nEmpty positional arg (`\"\"`) for an optional parameter should be treated as \"omit this parameter from the body,\" not as the literal empty string. This matches the spec's documented invocation pattern (`<entryId> \"\" \"\" true`) where skipped optional slots are empty strings.\n\nThe body type changes from `Record<string, string>` to `Record<string, string | number | boolean>`.\n\n## Finding 2 — `formatHelpTree` does not render parameters\n\n**File:** `packages/cli/src/discovery.ts` (lines 17-23).\n\nThe function only emits name/description/method/path. Parameters are never iterated. Fix: after the existing lines for each operation, render a block for its parameters — name, type, required/optional, description. Indent consistently with the rest of the tree. Keep output terminal-readable.\n\n## Tests\n\n- `packages/cli/tests/executor.test.ts` (new or extended): coerce `\"true\"`/`\"false\"` to boolean; coerce numeric string to number; reject `\"maybe\"` for a boolean param; reject `\"abc\"` for a number param; empty-string for optional param omits it from body; string-typed params pass through.\n- `packages/cli/tests/discovery.test.ts` (extend): `formatHelpTree` output includes each parameter's name, type, and required flag; the `refresh` parameter surfaces for `nudge.analyze`.\n\n## Out of scope\n\n- Named flags (`--refresh`). Still positional. The CLI named-flag exit point in the spec stays as an exit point.\n- Any other operation's behavior beyond confirming parameters now render.\n\n## Verify\n\n```\nbun test packages/cli\nbun run typecheck\nbun run lint\n```\n\nAll must pass."
dependencies: []
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-04-23T01:14:56.342Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-04-23T01:14:56.343Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
current_progress: ""
projectName: ink-mirror
---
