---
title: "Commission: Brainstorm extending observer dimensions"
date: 2026-04-21
status: dispatched
tags: [commission]
worker: Celeste
workerDisplayTitle: "Guild Visionary"
prompt: "Brainstorm extending the observer's dimension set beyond the current three.\n\n## Context\n\nink-mirror's observer currently selects from three fixed dimensions when observing a writing session. The user believes extending the set is primarily a prompt update (observer system prompt + dimension list), not an architectural change. Validate or challenge that framing as part of your brainstorm.\n\n## Required reading\n\n1. `.lore/research/observation-granularity.md` — original exploration of candidate dimensions\n2. `.lore/research/minimum-viable-observation.md` — filter that reduced the set down to the current three\n3. The current observer system prompt and dimension definitions (find them in `packages/daemon/` — look for the observer operation and any dimension constants)\n4. Any relevant retros in `.lore/retros/` touching observer quality\n\n## Deliverables\n\nProduce a brainstorm artifact at `.lore/brainstorm/observer-dimension-extension-20260420.md` covering:\n\n1. **Inventory** — what dimensions are live today, what was considered but cut, why each was cut\n2. **Candidates to add** — which dimensions from the research files (or new ones) are worth promoting now, ranked with rationale\n3. **Selection pressure** — with more dimensions, how does the observer choose? Is the current \"pick N\" mechanism still sound, or does it need tuning (weighting, exclusivity, rotation)?\n4. **Prompt-only vs structural** — for each candidate, flag whether it's a pure prompt change or needs schema/storage/UI updates. The user's hypothesis is \"just prompt\" — pressure-test it.\n5. **Risks** — observer dilution (too many options = worse selection), prompt bloat, evaluation gaps\n6. **Recommended next move** — one concrete, minimal first expansion (e.g., \"add these 2 dimensions and nothing else\") framed as a spec-ready proposal\n\n## Posture\n\nThis is exploratory. Don't prescribe a full plan — surface options and tradeoffs so we can pick. Use the `/lore-development:brainstorm` skill if it helps structure the artifact.\n\nNo code changes. Artifact only."
dependencies: []
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-04-21T05:14:35.866Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-04-21T05:14:35.868Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
current_progress: ""
projectName: ink-mirror
---
