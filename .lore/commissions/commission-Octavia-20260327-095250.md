---
title: "Commission: Prepare v1 core loop implementation plan"
date: 2026-03-27
status: dispatched
type: one-shot
tags: [commission]
worker: Octavia
workerDisplayTitle: "Guild Chronicler"
prompt: "Prepare an implementation plan for the v1 core loop spec at `.lore/specs/v1-core-loop.md`. Save the plan to `.lore/plans/v1-core-loop.md`.\n\n## What to read first\n\n1. **`.lore/specs/v1-core-loop.md`** — the spec you're planning against (32 requirements, 4 open questions, success criteria)\n2. **`.lore/vision.md`** — project identity and direction\n3. **`.lore/reference/architecture-pattern.md`** — the daemon-first architecture pattern that constrains how this gets built\n4. **`.lore/research/observation-granularity.md`** — informs observation pipeline design\n5. **`.lore/research/minimum-viable-observation.md`** — informs which dimensions to implement\n6. **`.lore/research/observer-history-window.md`** — informs context assembly strategy\n7. **`.lore/research/profile-versioning.md`** — informs what's deferred (profile versioning is stubbed)\n\n## What the plan should cover\n\n**Phases.** Break the work into sequential implementation phases. Each phase should be independently testable and produce working functionality. Dependencies between phases should be explicit.\n\n**Per phase:**\n- What gets built (concrete deliverables, not vague descriptions)\n- Which requirements from the spec it satisfies (reference REQ-V1-XX numbers)\n- What tests verify the phase is complete\n- What the phase depends on from prior phases\n\n**Open question resolution.** The spec has four open questions (LLM-native vs. pre-computed, two vs. three dimensions, observation-to-rule transformation, undecided resurfacing scope). The plan should take a position on each or flag them as decisions needed before that phase starts.\n\n**Commission structure.** Each phase should map to one or more commissions that can be dispatched to Dalton. Size them so a single commission is a coherent unit of work (not too large to review, not so small it creates coordination overhead).\n\n**Risk and ordering.** If a phase carries technical risk (e.g., the observation pipeline depends on prompt engineering that might not work first try), call it out and consider whether it should be earlier in the sequence to fail fast.\n\n## What the plan should NOT cover\n\n- Profile versioning beyond what the spec stubs (that's a separate spec)\n- Tier 3 semantic retrieval (deferred past v1)\n- Deployment, hosting, or infrastructure decisions\n- UI/UX design details (the plan says what surfaces exist, not what they look like)\n\n## Writing rules\n\nFollow the writing voice rules in the project's CLAUDE.md and global rules. No em-dashes. Plain language. No performative tone. Structure for scannability: a reviewer should be able to read phase headers and deliverables without reading prose."
dependencies: []
linked_artifacts: []

activity_timeline:
  - timestamp: 2026-03-27T16:52:50.565Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-03-27T16:52:50.566Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
current_progress: ""
projectName: ink-mirror
---
