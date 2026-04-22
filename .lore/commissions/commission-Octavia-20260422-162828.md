---
title: "Commission: Fix spec + plan: drop mount-fetch from nudge persistence"
date: 2026-04-22
status: completed
tags: [commission]
worker: Octavia
workerDisplayTitle: "Guild Chronicler"
prompt: "Correct the craft-nudge-persistence spec and plan. The mount-fetch design was a misread of the user's intent.\n\n## The correction\n\nThe Nudge button already means \"generate this nudge.\" Users don't want a second button just to retrieve a saved one. Clicking Nudge should do whichever of these is appropriate:\n\n- If a saved nudge exists for this entry (and hash/context match), daemon returns it from cache with `source: \"cache\"`. Instant, no LLM call.\n- If no saved nudge exists, daemon runs the LLM, saves, returns with `source: \"fresh\"`.\n- Same button, same action. Cache is a daemon-side optimization, not a UI concept.\n\nThere is no auto-fetch on mount. There is no GET endpoint. Everything flows through the existing POST /nudge on user click.\n\nAfter the first click, the UI shows the result with the `source` and `generatedAt` fields. When `source: \"cache\"`, display a \"Saved {relativeTime}\" label plus a \"Regenerate\" control (which POSTs with `refresh: true`). When `source: \"cache\"` and `stale: true`, add \"— entry edited since\" to the label. When `source: \"fresh\"`, it's the same as today's render plus the Saved label for subsequent visits.\n\n## What to change\n\n### Spec: `.lore/specs/craft-nudge-persistence.md`\n\n1. **Drop REQ-CNP-22 entirely.** There is no mount-fetch. The web client does not auto-GET. Do not replace it with a new requirement; just remove it. Renumber nothing — the missing number is fine, and renumbering invalidates every external reference.\n\n   Actually, since the req-prefix `CNP` is local to this spec and there are no inbound references from other specs yet, you MAY renumber if it makes the final doc cleaner. Use judgment. If you renumber, do so in a single pass and update every cross-reference in the spec (Requirements section, Success Criteria, AI Validation, plan references).\n\n2. **Revise REQ-CNP-21** to describe the button-click flow instead of the mount-render state machine:\n   - No saved nudge yet (first view): \"Nudge\" button, nothing else.\n   - After click, `source: \"fresh\"`: render nudges. Once rendered, show \"Saved {timestamp}\" label and \"Regenerate\" button replacing the \"Nudge\" button. This lets the user trigger a refresh without leaving the view.\n   - After click, `source: \"cache\"` with `stale: false`: render nudges + \"Saved {timestamp}\" label + \"Regenerate\" button.\n   - After click, `source: \"cache\"` with `stale: true`: render nudges + \"Saved {timestamp} — entry edited since\" label + \"Regenerate\" button.\n   - Click \"Regenerate\" → POST with `refresh: true` → re-render.\n\n3. **Revise the Proposed Design > Re-run Override > Web section** to match. Delete the \"auto-loads saved nudge on mount\" wording.\n\n4. **Revise the Test Plan > Web component section.** Drop the \"Mount with saved nudge\" cases (there is no mount behavior to test beyond \"Nudge button is present\"). Replace with:\n   - First click on entry with no saved nudge: POST fires, renders fresh, then shows Saved label + Regenerate button.\n   - Click on entry with existing saved nudge: POST fires, daemon returns cache, renders with Saved label + Regenerate button.\n   - Click Regenerate: POST fires with `refresh: true`, renders fresh result, Saved label updates.\n   - Unmount during in-flight fetch does not set state.\n\n5. **Revise Success Criteria.** Strike the bullet about \"web UI renders saved nudges on entry view load without a user click.\" The new bullet: \"Web UI serves saved nudges on click without calling the LLM; Regenerate control is present after any result is rendered.\"\n\n6. **Sanity-check for other residues** of the mount-fetch idea elsewhere in the spec. Delete.\n\n### Plan: `.lore/plans/craft-nudge-persistence.md`\n\n1. **Remove the Open Question section** entirely. The conflict is resolved by dropping REQ-CNP-22, not by adding a GET endpoint.\n\n2. **Phase 3 scope stays as-is** — no GET endpoint, no extra daemon work. Only POST /nudge exists.\n\n3. **Rewrite Phase 5 (web surface)**:\n   - No `getSavedNudge` helper. No mount-time POST. No loading state tied to mount.\n   - The component shape collapses: there is one interaction (button click → POST), and the render state is driven by the last response received. Before any click, render the \"Nudge\" button. After a click that produced a result, render nudges + Saved label + Regenerate button. Regenerate is the same POST with `refresh: true`.\n   - Tests mirror the revised spec Test Plan section.\n\n4. **Phase 3 test matrix and commission 3A scope** do not change. No GET tests.\n\n5. **Verification Criteria at end of plan**: strike the bullet about rendering saved nudges on view load without a click. Replace with the revised wording from the spec's Success Criteria.\n\n## Don't add ceremony\n\nKeep the spec and plan tight. This is a correction pass, not a rewrite. Do not add new sections, do not expand rationale. The only thing you are doing is removing the mount-fetch thread and making the button-click flow the only flow. If a paragraph doesn't need to change, don't touch it.\n\n## Verification\n\nAfter edits:\n- Grep the spec for \"mount\" — should only appear in the web component test case about unmount-during-fetch.\n- Grep the spec for \"auto\" — should not appear in the context of fetching or loading.\n- Grep the plan for \"GET /nudge\", \"getSavedNudge\", \"Option A\", \"Option B\" — should not appear.\n- Grep the plan for \"mount\" — same constraint as the spec.\n- Confirm the plan's Phase 3 scope is unchanged and Phase 5's revised scope reads like a clean single-button component.\n\nWrite the updated spec and plan in place. Do not create new files."
dependencies: []
linked_artifacts:
  - .lore/specs/craft-nudge-persistence.md

  - .lore/plans/craft-nudge-persistence.md
  - .lore/plans/craft-nudge-persistence.md
activity_timeline:
  - timestamp: 2026-04-22T23:28:28.093Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-04-22T23:28:28.095Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
  - timestamp: 2026-04-22T23:28:28.113Z
    event: status_in_progress
    reason: "Execution started"
    from: "dispatched"
    to: "in_progress"
  - timestamp: 2026-04-22T23:28:48.350Z
    event: progress_report
    reason: "Read both spec and plan. Starting spec edits — removing REQ-CNP-22 (mount-fetch), revising REQ-CNP-21 to button-click flow, cleaning Proposed Design / Test Plan / Success Criteria."
  - timestamp: 2026-04-22T23:32:11.207Z
    event: result_submitted
    reason: "Spec and plan corrected. The mount-fetch thread is removed; the button-click flow is the only flow, with cache vs. fresh as a daemon-side optimization.\n\n**Spec changes (`.lore/specs/craft-nudge-persistence.md`):**\n- Deleted REQ-CNP-22 (no renumbering — REQ-CNP-22 was the last in its block; any future reference to numbers ≤21 is unaffected).\n- Rewrote REQ-CNP-21 as a click-driven render-state list (pre-click → Nudge button only; post-click → nudges + Saved label + Regenerate button; stale appends \" — entry edited since\"; Regenerate POSTs `refresh: true`).\n- Rewrote Proposed Design > Re-run Override > Web to state: no auto-fetch, daemon decides cache vs. fresh internally, UI shape is the same for both `source` values.\n- Replaced the Test Plan web component cases with click-driven cases plus the unmount-during-fetch guard test.\n- Replaced the Success Criteria bullet (\"renders on entry view load without a user click\") with: \"serves saved nudges on click without calling the LLM; Regenerate control is present after any result is rendered.\"\n- Updated the Integration test steps to press Nudge instead of relying on auto-render.\n\n**Plan changes (`.lore/plans/craft-nudge-persistence.md`):**\n- Phase 5 requirements line trimmed to REQ-CNP-20 and REQ-CNP-21.\n- Rewrote Commission 5A scope: no `useEffect` mount fetch, no `getSavedNudge` helper, no GET endpoint. State is the last response received. Pre-click renders only the \"Nudge\" button; post-click renders nudges + Saved label + Regenerate button; cache vs. fresh is invisible to the user. Test list updated to match the spec's revised Test Plan.\n- Updated Commission 5B review checklist to match (drops Option B / mount-path language).\n- Removed the \"Open Question for Curator Before Dispatch\" section entirely.\n- Replaced the verification bullet about \"renders without a user click\" with the same click-flow wording as the spec's Success Criteria.\n- Phase 3 scope, the Phase 3 test matrix, and Commission 3A are untouched. No GET route, no extra daemon work.\n\n**Verification (per commission brief):**\n- `Grep \"mount\" spec` → only the unmount-during-fetch test case remains.\n- `Grep \"auto\" spec` → only Observer/on-demand framing and \"no auto-fetch\" wording.\n- `Grep \"GET /nudge|getSavedNudge|Option A|Option B\" plan` → no matches except explicit negations in Phase 5 (\"no GET endpoint\", \"no GET helper\").\n- `Grep \"mount\" plan` → only abort-on-unmount guard and explicit negations.\n- `Grep \"CNP-22\" spec/plan` → no matches.\n\nFiles written in place. No new files created."
  - timestamp: 2026-04-22T23:32:14.917Z
    event: status_completed
    reason: "Execution completed"
    from: "in_progress"
    to: "completed"
current_progress: "Read both spec and plan. Starting spec edits — removing REQ-CNP-22 (mount-fetch), revising REQ-CNP-21 to button-click flow, cleaning Proposed Design / Test Plan / Success Criteria."
projectName: ink-mirror
---
Spec and plan corrected. The mount-fetch thread is removed; the button-click flow is the only flow, with cache vs. fresh as a daemon-side optimization.

**Spec changes (`.lore/specs/craft-nudge-persistence.md`):**
- Deleted REQ-CNP-22 (no renumbering — REQ-CNP-22 was the last in its block; any future reference to numbers ≤21 is unaffected).
- Rewrote REQ-CNP-21 as a click-driven render-state list (pre-click → Nudge button only; post-click → nudges + Saved label + Regenerate button; stale appends " — entry edited since"; Regenerate POSTs `refresh: true`).
- Rewrote Proposed Design > Re-run Override > Web to state: no auto-fetch, daemon decides cache vs. fresh internally, UI shape is the same for both `source` values.
- Replaced the Test Plan web component cases with click-driven cases plus the unmount-during-fetch guard test.
- Replaced the Success Criteria bullet ("renders on entry view load without a user click") with: "serves saved nudges on click without calling the LLM; Regenerate control is present after any result is rendered."
- Updated the Integration test steps to press Nudge instead of relying on auto-render.

**Plan changes (`.lore/plans/craft-nudge-persistence.md`):**
- Phase 5 requirements line trimmed to REQ-CNP-20 and REQ-CNP-21.
- Rewrote Commission 5A scope: no `useEffect` mount fetch, no `getSavedNudge` helper, no GET endpoint. State is the last response received. Pre-click renders only the "Nudge" button; post-click renders nudges + Saved label + Regenerate button; cache vs. fresh is invisible to the user. Test list updated to match the spec's revised Test Plan.
- Updated Commission 5B review checklist to match (drops Option B / mount-path language).
- Removed the "Open Question for Curator Before Dispatch" section entirely.
- Replaced the verification bullet about "renders without a user click" with the same click-flow wording as the spec's Success Criteria.
- Phase 3 scope, the Phase 3 test matrix, and Commission 3A are untouched. No GET route, no extra daemon work.

**Verification (per commission brief):**
- `Grep "mount" spec` → only the unmount-during-fetch test case remains.
- `Grep "auto" spec` → only Observer/on-demand framing and "no auto-fetch" wording.
- `Grep "GET /nudge|getSavedNudge|Option A|Option B" plan` → no matches except explicit negations in Phase 5 ("no GET endpoint", "no GET helper").
- `Grep "mount" plan` → only abort-on-unmount guard and explicit negations.
- `Grep "CNP-22" spec/plan` → no matches.

Files written in place. No new files created.
