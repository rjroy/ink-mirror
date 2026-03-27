---
title: "Commission: Prepare v1 core loop implementation plan"
date: 2026-03-27
status: completed
type: one-shot
tags: [commission]
worker: Octavia
workerDisplayTitle: "Guild Chronicler"
prompt: "Prepare an implementation plan for the v1 core loop spec at `.lore/specs/v1-core-loop.md`. Save the plan to `.lore/plans/v1-core-loop.md`.\n\n## What to read first\n\n1. **`.lore/specs/v1-core-loop.md`** — the spec you're planning against (32 requirements, 4 open questions, success criteria)\n2. **`.lore/vision.md`** — project identity and direction\n3. **`.lore/reference/architecture-pattern.md`** — the daemon-first architecture pattern that constrains how this gets built\n4. **`.lore/research/observation-granularity.md`** — informs observation pipeline design\n5. **`.lore/research/minimum-viable-observation.md`** — informs which dimensions to implement\n6. **`.lore/research/observer-history-window.md`** — informs context assembly strategy\n7. **`.lore/research/profile-versioning.md`** — informs what's deferred (profile versioning is stubbed)\n\n## What the plan should cover\n\n**Phases.** Break the work into sequential implementation phases. Each phase should be independently testable and produce working functionality. Dependencies between phases should be explicit.\n\n**Per phase:**\n- What gets built (concrete deliverables, not vague descriptions)\n- Which requirements from the spec it satisfies (reference REQ-V1-XX numbers)\n- What tests verify the phase is complete\n- What the phase depends on from prior phases\n\n**Open question resolution.** The spec has four open questions (LLM-native vs. pre-computed, two vs. three dimensions, observation-to-rule transformation, undecided resurfacing scope). The plan should take a position on each or flag them as decisions needed before that phase starts.\n\n**Commission structure.** Each phase should map to one or more commissions that can be dispatched to Dalton. Size them so a single commission is a coherent unit of work (not too large to review, not so small it creates coordination overhead).\n\n**Risk and ordering.** If a phase carries technical risk (e.g., the observation pipeline depends on prompt engineering that might not work first try), call it out and consider whether it should be earlier in the sequence to fail fast.\n\n## What the plan should NOT cover\n\n- Profile versioning beyond what the spec stubs (that's a separate spec)\n- Tier 3 semantic retrieval (deferred past v1)\n- Deployment, hosting, or infrastructure decisions\n- UI/UX design details (the plan says what surfaces exist, not what they look like)\n\n## Writing rules\n\nFollow the writing voice rules in the project's CLAUDE.md and global rules. No em-dashes. Plain language. No performative tone. Structure for scannability: a reviewer should be able to read phase headers and deliverables without reading prose."
dependencies: []
linked_artifacts:
  - .lore/plans/v1-core-loop.md

activity_timeline:
  - timestamp: 2026-03-27T16:52:50.565Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-03-27T16:52:50.566Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
  - timestamp: 2026-03-27T16:52:50.581Z
    event: status_in_progress
    reason: "Execution started"
    from: "dispatched"
    to: "in_progress"
  - timestamp: 2026-03-27T16:52:57.092Z
    event: progress_report
    reason: "Reading spec, vision, architecture pattern, and research documents before drafting the plan."
  - timestamp: 2026-03-27T16:53:29.964Z
    event: progress_report
    reason: "All source documents read. Project is greenfield (no code yet). Drafting the implementation plan now."
  - timestamp: 2026-03-27T16:59:13.137Z
    event: result_submitted
    reason: "Implementation plan for v1 core loop written to `.lore/plans/v1-core-loop.md`.\n\n**Structure:** 5 phases, 8 commissions, fail-fast ordering (observation pipeline in Phase 2, immediately after foundation).\n\n**Phases:**\n1. Foundation (scaffold + entry storage) -- 2 commissions\n2. Observation Pipeline (metrics + LLM integration) -- 2 commissions, highest risk\n3. Curation Loop -- 1 commission\n4. Style Profile -- 1 commission\n5. Web Client + Third Dimension -- 2 commissions, parallelizable\n\n**Open questions resolved:**\n1. Hybrid metrics approach (pre-compute deterministic metrics, LLM interprets)\n2. Two dimensions first (rhythm + word habits), third (sentence structure) decision-gated in Phase 5\n3. Profile rule format: pattern description + dimension + source summary\n4. Undecided resurfacing capped at 3 per session, most recent first\n\n**Review addressed:** Fresh-context plan review caught 3 priority items (observation storage format, contradiction detection ownership, no-generation constraint check) and 2 minor items (REQ-V1-9 verification timing, 90% coverage standard). All five incorporated into the plan.\n\nAll 32 requirements mapped. Coverage matrix included."
  - timestamp: 2026-03-27T16:59:16.997Z
    event: status_completed
    reason: "Execution completed"
    from: "in_progress"
    to: "completed"
current_progress: "All source documents read. Project is greenfield (no code yet). Drafting the implementation plan now."
projectName: ink-mirror
---
Implementation plan for v1 core loop written to `.lore/plans/v1-core-loop.md`.

**Structure:** 5 phases, 8 commissions, fail-fast ordering (observation pipeline in Phase 2, immediately after foundation).

**Phases:**
1. Foundation (scaffold + entry storage) -- 2 commissions
2. Observation Pipeline (metrics + LLM integration) -- 2 commissions, highest risk
3. Curation Loop -- 1 commission
4. Style Profile -- 1 commission
5. Web Client + Third Dimension -- 2 commissions, parallelizable

**Open questions resolved:**
1. Hybrid metrics approach (pre-compute deterministic metrics, LLM interprets)
2. Two dimensions first (rhythm + word habits), third (sentence structure) decision-gated in Phase 5
3. Profile rule format: pattern description + dimension + source summary
4. Undecided resurfacing capped at 3 per session, most recent first

**Review addressed:** Fresh-context plan review caught 3 priority items (observation storage format, contradiction detection ownership, no-generation constraint check) and 2 minor items (REQ-V1-9 verification timing, 90% coverage standard). All five incorporated into the plan.

All 32 requirements mapped. Coverage matrix included.
