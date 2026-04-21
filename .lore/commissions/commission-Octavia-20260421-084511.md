---
title: "Commission: Spec paragraph-structure + file open-thread issues"
date: 2026-04-21
status: completed
tags: [commission]
worker: Octavia
workerDisplayTitle: "Guild Chronicler"
prompt: "Two deliverables grounded in `.lore/brainstorm/observer-dimension-extension-20260420.md`.\n\n## Deliverable 1 — Spec: add `paragraph-structure` dimension\n\nWrite a spec at `.lore/specs/observer-paragraph-structure.md` that implements the recommendation in Section 6 of the brainstorm (\"Recommended Next Move\"). The spec must be implementation-ready for Dalton.\n\nRequired sections:\n\n1. **Frame.** One paragraph: what this adds, why, the hypothesis being validated (expansion path + \"primarily a prompt update\").\n2. **Scope.** In-scope: `paragraph-structure` only. Explicitly out-of-scope: vocabulary register, tonal markers, selection-pressure changes (cap stays 2-3), label-map deduplication, vision re-review.\n3. **Observation definition.** Exact dimension description covering: paragraph-length distribution, opening-vs-closing asymmetry, topic-sentence patterns, transition-vs-juxtaposition habits, single-sentence-paragraph use for emphasis. Include a \"not this\" boundary against `sentence-structure` (paragraph-level patterns here; sentence-level patterns stay there).\n4. **Touch points.** Every file that must change, with exact paths and approximate size. Use the brainstorm's Section 4 table as the source of truth. Specifically:\n   - Zod enum at `packages/shared/src/observations.ts`\n   - Observer system prompt: dimension list + definition + \"not this\" clause + worked example if needed at `packages/daemon/src/observer.ts`\n   - Daemon `DIMENSION_LABELS` at `packages/daemon/src/profile-store.ts`\n   - Both inline `labels` records in `packages/cli/src/profile.ts` (`showProfile` and `buildProfileMarkdown`)\n   - `OPPOSING_SIGNALS` additions in `packages/daemon/src/curation.ts` (2-3 pairs)\n   - Extension of the sentence-structure analyzer in `packages/daemon/src/metrics/sentence-structure.ts` to surface single-sentence-paragraph counts and paragraph-length distribution. Keep existing signals intact.\n   - `EntryMetrics` schema in `packages/shared/src/metrics.ts` for any new pre-computed fields.\n5. **Metrics additions.** Specify exactly which new numeric signals the sentence-structure analyzer produces. Don't invent — stay within what the brainstorm names.\n6. **Tests.** Which tests are required (observer unit test covering the new dimension, integration test for curation contradiction detection with the new dimension, analyzer tests for new paragraph signals). No \"tests can come later.\"\n7. **Acceptance criteria.** Numbered, testable. Example shape: \"A 6-paragraph entry with varied paragraph lengths produces at least one `paragraph-structure` observation when the Observer selects this dimension.\" Include at least one criterion that verifies no regression in existing dimensions.\n8. **Non-acceptance.** What this spec does NOT deliver (restate from scope for emphasis): no label-map refactor, no register/tonal additions, no cap change.\n9. **Open questions.** Anything that requires user decision before Dalton starts. Keep this tight — if the brainstorm already decided it, don't re-open it.\n\nDo NOT include vocabulary register or tonal markers. Do NOT pre-solve the label-map duplication (that becomes its own issue). Do NOT touch selection-pressure. This spec is deliberately narrow.\n\nUse `/lore-development:specify` if it helps structure the document. No emojis.\n\n## Deliverable 2 — File issues for the open threads\n\nThe brainstorm's \"Open Threads\" section surfaces four follow-ups. Use the `/lore-development:file-issue` skill to file each as a separate issue under `.lore/issues/`. For each issue:\n\n1. **Label-map duplication.** Three sites hold the dimension-to-label mapping (daemon `DIMENSION_LABELS` + two inline CLI copies). Issue is: consolidate into `@ink-mirror/shared` before the set grows past 4 dimensions. Tag as `refactor`, priority medium. Reference the brainstorm and the exact file:line locations.\n\n2. **Selection-pressure policy for N >= 5.** Issue is: decide between rotation state, expanded observation cap, or continued trust in LLM selection. Not actionable until the set approaches 5 dimensions. Tag as `design-decision`, priority low-until-triggered. Note the trigger: dimension set reaching 5.\n\n3. **Vision re-review overdue.** The `review_trigger` in `.lore/vision.md` fired when v1 core loop + Craft Nudge shipped (2026-04-18). Issue is: run the vision re-review before the next non-trivial expansion. Tag as `vision`, priority medium.\n\n4. **Observation evaluation methodology gap.** No golden corpus exists. Writer curation decisions are the only quality signal today. Issue is: name this as a known gap and outline what minimal evaluation infrastructure would look like. Tag as `research`, priority low.\n\nEach issue should be self-contained and link back to the brainstorm. Don't duplicate the brainstorm content into the issues — summarize and reference.\n\n## Reporting\n\nReport in the commission result:\n- Spec file path and section count\n- List of issue file paths created\n- Any decisions you had to make that the brainstorm didn't settle (if none, say so)"
dependencies: []
linked_artifacts:
  - .lore/specs/observer-paragraph-structure.md

  - .lore/issues/observer-label-map-consolidation.md
  - .lore/issues/observer-selection-pressure-policy.md
  - .lore/issues/vision-re-review-overdue.md
  - .lore/issues/observation-evaluation-methodology.md
  - .lore/issues/observer-label-map-consolidation.md
  - .lore/issues/observer-selection-pressure-policy.md
  - .lore/issues/vision-re-review-overdue.md
  - .lore/issues/observation-evaluation-methodology.md
activity_timeline:
  - timestamp: 2026-04-21T15:45:11.359Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-04-21T15:45:11.360Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
  - timestamp: 2026-04-21T15:45:11.379Z
    event: status_in_progress
    reason: "Execution started"
    from: "dispatched"
    to: "in_progress"
  - timestamp: 2026-04-21T15:46:43.219Z
    event: progress_report
    reason: "Read brainstorm and grounded every code reference against the working tree. Ready to draft spec and four issues."
  - timestamp: 2026-04-21T15:49:08.802Z
    event: progress_report
    reason: "Spec drafted at .lore/specs/observer-paragraph-structure.md (9 sections). Filing four issues next."
  - timestamp: 2026-04-21T15:50:53.017Z
    event: progress_report
    reason: "Spec and four issues written. Verifying final artifacts before submitting."
  - timestamp: 2026-04-21T15:51:20.976Z
    event: result_submitted
    reason: "Delivered both artifacts, fully grounded in the brainstorm and verified against the codebase.\n\n**Deliverable 1 — Spec**\n\n- Path: `.lore/specs/observer-paragraph-structure.md`\n- Sections: 9 numbered sections (Frame, Scope, Observation Definition, Touch Points, Metrics Additions, Tests, Acceptance Criteria, Non-Acceptance, Open Questions).\n- Req-prefix: `OPS`. Status: `draft`.\n- Every file path, line range, and function name in Section 4 (Touch Points) was verified against the working tree — `ObservationDimensionSchema` at `packages/shared/src/observations.ts:5-9`, system prompt and `formatMetrics` in `packages/daemon/src/observer.ts`, `DIMENSION_LABELS` at `packages/daemon/src/profile-store.ts:45-49`, inline `labels` in `packages/cli/src/profile.ts:40-44` and `:147-151`, `OPPOSING_SIGNALS` at `packages/daemon/src/curation.ts:15-26`, `analyzeSentenceStructure` at `packages/daemon/src/metrics/sentence-structure.ts:276-338`, `SentenceStructureAnalysisSchema` at `packages/shared/src/metrics.ts:53-73`.\n- 11 numbered acceptance criteria, including an explicit no-regression criterion for existing dimensions and a cap-unchanged criterion.\n- Non-Acceptance section explicitly lists the four filed issues by path so deferrals don't float.\n\n**Deliverable 2 — Four issues filed under `.lore/issues/`**\n\n- `.lore/issues/observer-label-map-consolidation.md` — type: refactor, priority: medium. Consolidate into `@ink-mirror/shared` before dimension 5.\n- `.lore/issues/observer-selection-pressure-policy.md` — type: design-decision, priority: low-until-triggered. Trigger: dimension set approaching 5.\n- `.lore/issues/vision-re-review-overdue.md` — type: vision, priority: medium. Run before next non-trivial expansion.\n- `.lore/issues/observation-evaluation-methodology.md` — type: research, priority: low. Names the gap, outlines minimal corpus + replay harness.\n\nEach issue is self-contained, links back to the brainstorm, and names a concrete trigger for when it becomes actionable. The `.lore/issues/` directory did not exist in this worktree — created it.\n\n**Decisions I made that the brainstorm did not settle**\n\n1. Bucket thresholds for `paragraphLengthDistribution`: `short` = 1-2 sentences, `medium` = 3-5, `long` = 6+. Called out in Open Questions as adjustable if real-entry data shows the medium bucket swallowing everything; the spec requires updating the spec and fixtures together rather than letting them drift.\n2. Suggested opposing-signal regex pairs (short/long paragraphs, uniform/varied, transitions/juxtaposition). Implementer may adjust wording; the dimension-scoped contradiction logic already prevents overlap with the existing sentence-rhythm `short`/`long` pair.\n3. Required one worked example in the Observer prompt's output-format JSON, not a full dimension-specific worked-example block. Paragraph patterns are descriptive enough that the non-evaluation rail is not at its thinnest here — only tonal and register would need the heavier worked example.\n4. Kept the label-map updates in all three places in this spec rather than consolidating, to preserve the separation-of-concerns between the spec and the refactor issue. This matches the brainstorm's recommendation to let the expansion test whether the refactor is needed."
  - timestamp: 2026-04-21T15:51:26.663Z
    event: status_completed
    reason: "Execution completed"
    from: "in_progress"
    to: "completed"
current_progress: "Spec and four issues written. Verifying final artifacts before submitting."
projectName: ink-mirror
---
Delivered both artifacts, fully grounded in the brainstorm and verified against the codebase.

**Deliverable 1 — Spec**

- Path: `.lore/specs/observer-paragraph-structure.md`
- Sections: 9 numbered sections (Frame, Scope, Observation Definition, Touch Points, Metrics Additions, Tests, Acceptance Criteria, Non-Acceptance, Open Questions).
- Req-prefix: `OPS`. Status: `draft`.
- Every file path, line range, and function name in Section 4 (Touch Points) was verified against the working tree — `ObservationDimensionSchema` at `packages/shared/src/observations.ts:5-9`, system prompt and `formatMetrics` in `packages/daemon/src/observer.ts`, `DIMENSION_LABELS` at `packages/daemon/src/profile-store.ts:45-49`, inline `labels` in `packages/cli/src/profile.ts:40-44` and `:147-151`, `OPPOSING_SIGNALS` at `packages/daemon/src/curation.ts:15-26`, `analyzeSentenceStructure` at `packages/daemon/src/metrics/sentence-structure.ts:276-338`, `SentenceStructureAnalysisSchema` at `packages/shared/src/metrics.ts:53-73`.
- 11 numbered acceptance criteria, including an explicit no-regression criterion for existing dimensions and a cap-unchanged criterion.
- Non-Acceptance section explicitly lists the four filed issues by path so deferrals don't float.

**Deliverable 2 — Four issues filed under `.lore/issues/`**

- `.lore/issues/observer-label-map-consolidation.md` — type: refactor, priority: medium. Consolidate into `@ink-mirror/shared` before dimension 5.
- `.lore/issues/observer-selection-pressure-policy.md` — type: design-decision, priority: low-until-triggered. Trigger: dimension set approaching 5.
- `.lore/issues/vision-re-review-overdue.md` — type: vision, priority: medium. Run before next non-trivial expansion.
- `.lore/issues/observation-evaluation-methodology.md` — type: research, priority: low. Names the gap, outlines minimal corpus + replay harness.

Each issue is self-contained, links back to the brainstorm, and names a concrete trigger for when it becomes actionable. The `.lore/issues/` directory did not exist in this worktree — created it.

**Decisions I made that the brainstorm did not settle**

1. Bucket thresholds for `paragraphLengthDistribution`: `short` = 1-2 sentences, `medium` = 3-5, `long` = 6+. Called out in Open Questions as adjustable if real-entry data shows the medium bucket swallowing everything; the spec requires updating the spec and fixtures together rather than letting them drift.
2. Suggested opposing-signal regex pairs (short/long paragraphs, uniform/varied, transitions/juxtaposition). Implementer may adjust wording; the dimension-scoped contradiction logic already prevents overlap with the existing sentence-rhythm `short`/`long` pair.
3. Required one worked example in the Observer prompt's output-format JSON, not a full dimension-specific worked-example block. Paragraph patterns are descriptive enough that the non-evaluation rail is not at its thinnest here — only tonal and register would need the heavier worked example.
4. Kept the label-map updates in all three places in this spec rather than consolidating, to preserve the separation-of-concerns between the spec and the refactor issue. This matches the brainstorm's recommendation to let the expansion test whether the refactor is needed.
