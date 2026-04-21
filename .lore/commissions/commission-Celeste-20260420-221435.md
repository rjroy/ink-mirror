---
title: "Commission: Brainstorm extending observer dimensions"
date: 2026-04-21
status: completed
tags: [commission]
worker: Celeste
workerDisplayTitle: "Guild Visionary"
prompt: "Brainstorm extending the observer's dimension set beyond the current three.\n\n## Context\n\nink-mirror's observer currently selects from three fixed dimensions when observing a writing session. The user believes extending the set is primarily a prompt update (observer system prompt + dimension list), not an architectural change. Validate or challenge that framing as part of your brainstorm.\n\n## Required reading\n\n1. `.lore/research/observation-granularity.md` — original exploration of candidate dimensions\n2. `.lore/research/minimum-viable-observation.md` — filter that reduced the set down to the current three\n3. The current observer system prompt and dimension definitions (find them in `packages/daemon/` — look for the observer operation and any dimension constants)\n4. Any relevant retros in `.lore/retros/` touching observer quality\n\n## Deliverables\n\nProduce a brainstorm artifact at `.lore/brainstorm/observer-dimension-extension-20260420.md` covering:\n\n1. **Inventory** — what dimensions are live today, what was considered but cut, why each was cut\n2. **Candidates to add** — which dimensions from the research files (or new ones) are worth promoting now, ranked with rationale\n3. **Selection pressure** — with more dimensions, how does the observer choose? Is the current \"pick N\" mechanism still sound, or does it need tuning (weighting, exclusivity, rotation)?\n4. **Prompt-only vs structural** — for each candidate, flag whether it's a pure prompt change or needs schema/storage/UI updates. The user's hypothesis is \"just prompt\" — pressure-test it.\n5. **Risks** — observer dilution (too many options = worse selection), prompt bloat, evaluation gaps\n6. **Recommended next move** — one concrete, minimal first expansion (e.g., \"add these 2 dimensions and nothing else\") framed as a spec-ready proposal\n\n## Posture\n\nThis is exploratory. Don't prescribe a full plan — surface options and tradeoffs so we can pick. Use the `/lore-development:brainstorm` skill if it helps structure the artifact.\n\nNo code changes. Artifact only."
dependencies: []
linked_artifacts:
  - /home/rjroy/.guild-hall/worktrees/ink-mirror/commission-Celeste-20260420-221435/.lore/brainstorm/observer-dimension-extension-20260420.md

activity_timeline:
  - timestamp: 2026-04-21T05:14:35.866Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-04-21T05:14:35.868Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
  - timestamp: 2026-04-21T05:14:35.898Z
    event: status_in_progress
    reason: "Execution started"
    from: "dispatched"
    to: "in_progress"
  - timestamp: 2026-04-21T05:14:52.117Z
    event: progress_report
    reason: "Loading context: research files, observer implementation, retros, recent brainstorms."
  - timestamp: 2026-04-21T05:18:06.934Z
    event: progress_report
    reason: "Context loaded. Mapped observer touch points: zod enum, prompt text, profile label maps (daemon + CLI duplicated), contradiction signals, metrics modules. Drafting brainstorm now."
  - timestamp: 2026-04-21T05:20:40.665Z
    event: result_submitted
    reason: "Brainstorm drafted at .lore/brainstorm/observer-dimension-extension-20260420.md. Five candidates ranked: punctuation habits (recommended first), tonal markers, paragraph structure, vocabulary register, discourse connectives. Pressure-test of \"prompt-only\" hypothesis: mostly true, but every dimension also touches the zod enum in shared, DIMENSION_LABELS in profile-store.ts, and a duplicated DIMENSION_LABELS in cli/src/profile.ts — three places hold the dimension list. Contradiction detection (OPPOSING_SIGNALS) silently degrades without new pairs per dimension. Hidden observation surfaced: the duplicated label map is an abstraction that wants to exist; promoting it to @ink-mirror/shared collapses the touch points before the next expansion. Selection pressure flagged: the 2-3 cap delivers reliable coverage at N=3 but becomes a rotating sample past N=5 — separable decision, binds later. Recommended minimal move: add punctuation-habits alone (Small scope, no selection-pressure change), which validates the expansion path and naturally reveals whether the DIMENSION_LABELS refactor is needed before the next dimension. Vision re-review trigger is noted as overdue (v1 loop + Craft Nudge shipped — trigger fired)."
  - timestamp: 2026-04-21T05:23:49.929Z
    event: result_submitted
    reason: "Brainstorm at .lore/brainstorm/observer-dimension-extension-20260420.md. Five candidates ranked: punctuation habits (recommended first), tonal markers, paragraph structure, vocabulary register, discourse connectives. Pressure-test of \"prompt-only\" hypothesis: mostly true, but three places hold the dimension list (zod enum in shared, DIMENSION_LABELS in profile-store.ts, duplicated DIMENSION_LABELS in cli/src/profile.ts), and contradiction detection (OPPOSING_SIGNALS) silently degrades without new pairs per dimension. Hidden observation: the duplicated label map is an abstraction that wants to exist; promoting it to @ink-mirror/shared collapses the touch points before the next expansion. Selection pressure noted: 2-3 cap delivers reliable coverage at N=3 but becomes a rotating sample past N=5. Separable decision, binds later. Recommended minimal move: add punctuation-habits alone (Small scope, no selection-pressure change), which validates the path and naturally reveals whether the DIMENSION_LABELS refactor is needed before the next dimension. Vision re-review trigger flagged as fired (v1 loop + Craft Nudge shipped on 2026-04-18) but vision not yet re-reviewed. Artifact re-emitted without em-dashes to match writing-style rules."
  - timestamp: 2026-04-21T05:24:01.491Z
    event: status_completed
    reason: "Execution completed"
    from: "in_progress"
    to: "completed"
current_progress: "Context loaded. Mapped observer touch points: zod enum, prompt text, profile label maps (daemon + CLI duplicated), contradiction signals, metrics modules. Drafting brainstorm now."
projectName: ink-mirror
---
Brainstorm at .lore/brainstorm/observer-dimension-extension-20260420.md. Five candidates ranked: punctuation habits (recommended first), tonal markers, paragraph structure, vocabulary register, discourse connectives. Pressure-test of "prompt-only" hypothesis: mostly true, but three places hold the dimension list (zod enum in shared, DIMENSION_LABELS in profile-store.ts, duplicated DIMENSION_LABELS in cli/src/profile.ts), and contradiction detection (OPPOSING_SIGNALS) silently degrades without new pairs per dimension. Hidden observation: the duplicated label map is an abstraction that wants to exist; promoting it to @ink-mirror/shared collapses the touch points before the next expansion. Selection pressure noted: 2-3 cap delivers reliable coverage at N=3 but becomes a rotating sample past N=5. Separable decision, binds later. Recommended minimal move: add punctuation-habits alone (Small scope, no selection-pressure change), which validates the path and naturally reveals whether the DIMENSION_LABELS refactor is needed before the next dimension. Vision re-review trigger flagged as fired (v1 loop + Craft Nudge shipped on 2026-04-18) but vision not yet re-reviewed. Artifact re-emitted without em-dashes to match writing-style rules.
