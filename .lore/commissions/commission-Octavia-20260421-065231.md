---
title: "Commission: Clean up observer dimension brainstorm"
date: 2026-04-21
status: completed
tags: [commission]
worker: Octavia
workerDisplayTitle: "Guild Chronicler"
prompt: "Clean up `.lore/brainstorm/observer-dimension-extension-20260420.md`. Two passes.\n\n## Pass 1 — Remove the invented dimension\n\nCeleste invented a `punctuation-habits` dimension that does not appear in either research file and then argued it was the best candidate *because it hadn't been discussed before*. That reasoning is junior-writer thinking and directly contradicts the project's posture: the research has already been done, and we constrain ourselves to what that research surfaced.\n\nWhat to do:\n- Remove `punctuation-habits` entirely from the brainstorm (from candidates, rankings, recommended next moves, anywhere it appears)\n- Remove any other dimension that does not trace back to `.lore/research/observation-granularity.md` or `.lore/research/minimum-viable-observation.md`\n- Remove any reasoning pattern that equates \"not previously discussed\" with \"better.\" Replace the affected ranking rationale with selection criteria grounded in the research (evidence availability, observer signal-to-noise, non-overlap with live dimensions, etc.)\n- Update the \"Recommended next move\" to reflect the constrained candidate set. If the recommendation rested on the invented dimension, pick a new concrete minimal first expansion using only research-backed candidates\n\n## Pass 2 — Audit \"Open Threads\" (and the rest) for factual errors\n\nThe user flagged the \"Open Threads\" section as containing factual mistakes. Example: `DIMENSION_LABELS` duplication is cited but is not actually a thing (or not actually duplicated). Grand speculation is fine in a brainstorm; false factual claims about the codebase are not.\n\nWhat to do:\n- For every concrete claim about the code in \"Open Threads\" AND anywhere else in the document (file paths, symbol names, \"X is duplicated / missing / hardcoded\", schema shapes, storage locations), verify it against the actual codebase in `packages/`\n- For each claim: either (a) confirm it and keep it, (b) correct it with the accurate statement, or (c) remove it if there's nothing true to replace it with\n- Be especially ruthless with statements of the form \"the code currently does X\" — those must be verifiable\n- Speculative or opinionated statements (\"this might be worth revisiting\", \"one option is...\") stay; factual assertions that are wrong do not\n\n## Posture\n\nYou are editing a brainstorm document, not rewriting it. Preserve the structure, the spirit, and any grand ideas that are clearly speculative. Only remove/correct:\n1. The invented dimension and the \"novelty = better\" reasoning\n2. False factual claims about the codebase\n\nAdd a short \"Editor's note\" at the top (2-3 lines) noting the cleanup pass and the date (2026-04-20). Do not add emojis.\n\nWhen done, report in the commission result:\n- List of dimensions removed and why\n- List of factual corrections made (old claim → corrected claim or removed)\n- New \"Recommended next move\" if it changed"
dependencies: []
linked_artifacts:
  - .lore/brainstorm/observer-dimension-extension-20260420.md

activity_timeline:
  - timestamp: 2026-04-21T13:52:31.466Z
    event: created
    reason: "Commission created"
  - timestamp: 2026-04-21T13:52:31.468Z
    event: status_dispatched
    reason: "Dispatched to worker"
    from: "pending"
    to: "dispatched"
  - timestamp: 2026-04-21T13:52:31.486Z
    event: status_in_progress
    reason: "Execution started"
    from: "dispatched"
    to: "in_progress"
  - timestamp: 2026-04-21T13:54:45.072Z
    event: progress_report
    reason: "Verified research-backed dimensions (6 categories) and audited codebase claims. Removing invented `punctuation-habits` and `discourse-connectives` (not in research). Correcting `DIMENSION_LABELS` claim (CLI uses local `labels`, not DIMENSION_LABELS). Now rewriting the brainstorm."
  - timestamp: 2026-04-21T13:59:19.744Z
    event: result_submitted
    reason: "\nCleanup pass completed on `.lore/brainstorm/observer-dimension-extension-20260420.md`. Added an Editor's note at the top (dated 2026-04-20) summarizing the pass.\n\n## Pass 1 — Dimensions removed (not research-backed)\n\n**Removed: `punctuation-habits` (was Proposal A, \"recommended first expansion\").** Not listed in either `observation-granularity.md` or `minimum-viable-observation.md`. The brainstorm itself admitted this openly (\"Not in the original six-category research\") and then treated that novelty as a reason to rank it first. Removed entirely from candidates, rankings, the Recommended Next Move, the Deferred list, and the selection-pressure math.\n\n**Removed: `discourse-connectives` (was Proposal E).** Also self-admittedly outside the six research-backed categories (\"Not in the original six categories\"). Removed entirely.\n\n**Replaced the \"novelty = better\" reasoning.** Added a §2 preamble establishing four research-grounded ranking criteria (evidence availability, observer signal-to-noise, non-overlap with live dimensions, vision alignment risk). The remaining three proposals are reordered under these criteria: Paragraph (A), Vocabulary Register (B), Tonal Markers (C). Tonal moved from the top spot to the bottom because the granularity research explicitly flagged it as the dimension with the thinnest observation/evaluation boundary — which is a research-backed reason to rank it last among the candidates, not first.\n\n## Pass 2 — Factual corrections against the codebase\n\n| Claim (original) | Correction / status |\n|---|---|\n| `DIMENSION_LABELS` duplicated in the CLI at `packages/cli/src/profile.ts:41-43,148-150` | **Corrected.** The CLI does not define or import `DIMENSION_LABELS`; it declares a local `labels` record inline, twice (in `showProfile` at :40-44 and `buildProfileMarkdown` at :147-151). Verified via Grep: `DIMENSION_LABELS` occurs only in `packages/daemon/src/profile-store.ts`. Updated in §Context scanned, §\"What the architecture encodes\" item 5, §4 table row, §4 Verdict bullet, §4 hidden-observation paragraph, Open Threads. |\n| System prompt dimension definitions at `observer.ts:126-131` | Minor correction — the `## Dimensions` block starts at line 125. Updated both references (lines 44 and 66) for consistency. |\n| Zod enum at `observations.ts:5-9` | Confirmed accurate (`ObservationDimensionSchema` is declared on lines 5-9). Kept. |\n| `DIMENSION_LABELS` constant at `profile-store.ts:45-49` | Confirmed accurate. Kept. |\n| `OPPOSING_SIGNALS` at `curation.ts:15-26` | Confirmed accurate. Kept. |\n| Web UI at `web/app/entries/[id]/page.tsx:60` renders `obs.dimension` as a raw string | Confirmed. Kept. |\n| `paragraphCount` / `paragraphOpeners` exist in metrics and reach the prompt | Confirmed (`packages/shared/src/metrics.ts:61-68`, `observer.ts:249-253`). Added to Proposal A's Evidence section with file:line citations. |\n\nAlso removed a stray claim from §5 Risks about \"Discourse connectives overlaps word-level-habits\" now that proposal E is gone. Tightened §3 selection-pressure math to reflect the reduced candidate ceiling (N=5 or N=6 instead of past speculation).\n\n## New Recommended Next Move\n\nChanged from `punctuation-habits` to **`paragraph-structure`**. Rationale, grounded in the new criteria: highest evidence availability of the research-backed candidates (paragraph metrics already computed and surfaced in the prompt); lowest evaluation-boundary risk (pure description, no stance or register judgment); overlap is with `sentence-structure` and the boundary is cleanly drawable; still leaves N=4, so selection-pressure policy can be deferred. Spec-ready framing updated accordingly, including the corrected label-map language (daemon `DIMENSION_LABELS` plus both CLI local `labels` maps).\n\n## Artifact\n\n- `.lore/brainstorm/observer-dimension-extension-20260420.md` — edited in place.\n"
  - timestamp: 2026-04-21T13:59:27.495Z
    event: status_completed
    reason: "Execution completed"
    from: "in_progress"
    to: "completed"
current_progress: "Verified research-backed dimensions (6 categories) and audited codebase claims. Removing invented `punctuation-habits` and `discourse-connectives` (not in research). Correcting `DIMENSION_LABELS` claim (CLI uses local `labels`, not DIMENSION_LABELS). Now rewriting the brainstorm."
projectName: ink-mirror
---

Cleanup pass completed on `.lore/brainstorm/observer-dimension-extension-20260420.md`. Added an Editor's note at the top (dated 2026-04-20) summarizing the pass.

## Pass 1 — Dimensions removed (not research-backed)

**Removed: `punctuation-habits` (was Proposal A, "recommended first expansion").** Not listed in either `observation-granularity.md` or `minimum-viable-observation.md`. The brainstorm itself admitted this openly ("Not in the original six-category research") and then treated that novelty as a reason to rank it first. Removed entirely from candidates, rankings, the Recommended Next Move, the Deferred list, and the selection-pressure math.

**Removed: `discourse-connectives` (was Proposal E).** Also self-admittedly outside the six research-backed categories ("Not in the original six categories"). Removed entirely.

**Replaced the "novelty = better" reasoning.** Added a §2 preamble establishing four research-grounded ranking criteria (evidence availability, observer signal-to-noise, non-overlap with live dimensions, vision alignment risk). The remaining three proposals are reordered under these criteria: Paragraph (A), Vocabulary Register (B), Tonal Markers (C). Tonal moved from the top spot to the bottom because the granularity research explicitly flagged it as the dimension with the thinnest observation/evaluation boundary — which is a research-backed reason to rank it last among the candidates, not first.

## Pass 2 — Factual corrections against the codebase

| Claim (original) | Correction / status |
|---|---|
| `DIMENSION_LABELS` duplicated in the CLI at `packages/cli/src/profile.ts:41-43,148-150` | **Corrected.** The CLI does not define or import `DIMENSION_LABELS`; it declares a local `labels` record inline, twice (in `showProfile` at :40-44 and `buildProfileMarkdown` at :147-151). Verified via Grep: `DIMENSION_LABELS` occurs only in `packages/daemon/src/profile-store.ts`. Updated in §Context scanned, §"What the architecture encodes" item 5, §4 table row, §4 Verdict bullet, §4 hidden-observation paragraph, Open Threads. |
| System prompt dimension definitions at `observer.ts:126-131` | Minor correction — the `## Dimensions` block starts at line 125. Updated both references (lines 44 and 66) for consistency. |
| Zod enum at `observations.ts:5-9` | Confirmed accurate (`ObservationDimensionSchema` is declared on lines 5-9). Kept. |
| `DIMENSION_LABELS` constant at `profile-store.ts:45-49` | Confirmed accurate. Kept. |
| `OPPOSING_SIGNALS` at `curation.ts:15-26` | Confirmed accurate. Kept. |
| Web UI at `web/app/entries/[id]/page.tsx:60` renders `obs.dimension` as a raw string | Confirmed. Kept. |
| `paragraphCount` / `paragraphOpeners` exist in metrics and reach the prompt | Confirmed (`packages/shared/src/metrics.ts:61-68`, `observer.ts:249-253`). Added to Proposal A's Evidence section with file:line citations. |

Also removed a stray claim from §5 Risks about "Discourse connectives overlaps word-level-habits" now that proposal E is gone. Tightened §3 selection-pressure math to reflect the reduced candidate ceiling (N=5 or N=6 instead of past speculation).

## New Recommended Next Move

Changed from `punctuation-habits` to **`paragraph-structure`**. Rationale, grounded in the new criteria: highest evidence availability of the research-backed candidates (paragraph metrics already computed and surfaced in the prompt); lowest evaluation-boundary risk (pure description, no stance or register judgment); overlap is with `sentence-structure` and the boundary is cleanly drawable; still leaves N=4, so selection-pressure policy can be deferred. Spec-ready framing updated accordingly, including the corrected label-map language (daemon `DIMENSION_LABELS` plus both CLI local `labels` maps).

## Artifact

- `.lore/brainstorm/observer-dimension-extension-20260420.md` — edited in place.

