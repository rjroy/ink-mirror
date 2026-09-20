---
title: "Implementation notes: longitudinal pattern confirmation"
date: 2026-07-10
status: in_progress
tags: [implementation, notes, observer, curation, profile, longitudinal, pattern-ledger, watch-list, metrics]
source: .lore/work/plans/longitudinal-pattern-confirmation.md
modules: [shared, daemon, cli, web, observer, curation, profile-store, metrics]
---

# Implementation notes: longitudinal pattern confirmation

Orchestrated via `/lore-development:implement`. All implementation, testing, and review actions dispatched to sub-agents; this file tracks progress and decisions.

## Pre-implementation research (lore-researcher)

Dispatched before Phase 1. Findings:

- `.lore/research/profile-versioning.md` is load-bearing now (not just future): recommends "raw feature vectors per entry, diffs on demand" — matches the `snapshots/<entryId>.yaml` design. Should have been in the plan's `related` list.
- `.lore/research/observer-history-window.md` establishes the existing "5 recent entries" precedent the plan's watch-window constants echo.
- `.lore/retros/commission-cleanup-20260327.md` Loose Thread #1 ("Phase 2B Observer was never reviewed", OPEN) is relevant motivation for the P3 risk gate — not cited in the plan.
- `.lore/retros/web-tsc-build-artifacts.md` is referenced inline in the plan (P6 gate) but missing from frontmatter `related`.
- `.lore/issues/vision-re-review-overdue.md`: status `resolved`; checked `.lore/vision.md` directly — `reviewed_date: 2026-04-20`, after the trigger date. Re-review already happened. **Not a blocker.**
- Correction: `OPPOSING_SIGNALS` table in `curation.ts` now has **13 pairs** (lines 15-29), not the 10 pairs the 2026-03-27 retro cited. Plan's claim ("unchanged in quality") should be read against the current 13-pair set. Not blocking, noted for P3 review.
- Code-location claims in the plan confirmed accurate: `profile-store.ts:137-138` version guard, `observer.ts:42-51` `observe()`/`computeMetrics` call, `observation-store.ts`/`curation.ts` existing structure. No collisions with new files (`pattern-store.ts`, `snapshot-store.ts`, `substrate.ts`, `promotion.ts`, `migration.ts`, `config.ts` — none exist yet).
- `observer-label-map-consolidation.md` (open) is already partly resolved: `DIMENSION_LABELS` lives in shared and is used by daemon + CLI. Only the **web** package still has local duplicates (`app/entries/[id]/page.tsx:14`, `profile-editor.tsx:152`), matching the plan's P6 scoping.

No prior partial implementation found (`.lore/work/notes/` was empty before this file).

## Progress tracker

- [x] Phase 1 — Shared schemas and branded IDs
- [x] Phase 2 — Stats substrate: metrics, snapshots, deterministic math
- [x] Phase 3 — Pattern ledger, sighting store, Observer rework (risk gate + fresh review)
- [x] Phase 4 — Pattern-grain curation, promotion gate, watch list, new API
- [x] Phase 5 — Profile rule linkage, rule health, migration (fresh review)
- [x] Phase 6 — Web and CLI surfaces
- [ ] Phase 7 — Final validation against spec (steps 1/2/6 done; steps 3/4/5 need a real model — checkpoint with user)

## Log

### 2026-07-10 — Initialization

- lore-researcher dispatched, findings recorded above. No blockers found; vision re-review gate already cleared.
- Agent selection: no `.lore/lore-agents.md` registry exists in this repo, so all three mandatory roles (Implementation, Testing, Review) fall back to `general-purpose`.
- Beginning Phase 1.

### 2026-07-10 — Phase 1 complete

Implemented: `packages/shared/src/{branded,patterns,metrics,observations,profile,events,index}.ts` (new: `patterns.ts`, `events.ts`) plus matching test files. Full detail in the plan's Phase 1 section — all 7 steps done as specified.

Two deliberate, documented deviations (both scoped to keep "whole workspace green" per phase, per the plan's own rule):
- `ProfileRuleSchema.patternId`/`provenance`/`baseline`/`lastSupportedAt` are optional, not required — `profile-store.ts` (Phase 5's file) constructs `ProfileRule` literals without them today. Comment in code points to Phase 5.
- `EntryMetricsSchema.functionWordFrequencies`/`punctuation` are optional — `metrics/index.ts` (Phase 2's file) doesn't populate them yet. Comment in code points to Phase 2.

Review found and fixed: `PatternRetirementSchema` didn't enforce mutual exclusivity between `dismissedAsWrong` and `mergedInto`; added a `.refine()` matching the `PatternRefSchema` XOR precedent, plus 4-case test. Fixed and reverified.

Review also flagged (not fixed, recorded as a known scope decision): `LINKABLE_METRIC_REGISTRY` has no entry for `functionWordFrequencies` — REQ-LPC-9's named motivating signal can never be a *computable* pattern, only qualitative, since function-word rates are a per-word map rather than a single scalar field and don't fit the registry's key→dot-path shape without a parametrized scheme. Left as qualitative-only for this pass; worth a deliberate call if it matters later (registry additions are non-breaking).

Gate results: `bun test packages/shared` 290 pass / 0 fail, whole-workspace `bun test` 1301+ pass / 0 fail, `bun run typecheck` clean, `bun run lint` clean.

Beginning Phase 2.

### 2026-07-10 — Phase 2 complete

Implemented: `packages/daemon/src/{metrics/punctuation.ts, config.ts, snapshot-store.ts, substrate.ts}` (all new), plus modifications to `metrics/word-frequency.ts`, `metrics/index.ts`, `observer.ts` (`observe()` gains optional `precomputedMetrics`), `index.ts` (`onEntryCreated` computes+persists snapshot once, passes metrics through). New fixture convention: `packages/daemon/tests/fixtures/corpus.ts`, explicitly reusable by later phases per the plan.

**Divergence surfaced to user and resolved:** the nested `MetricSnapshot` shape (arrays/maps) doesn't fit the project's existing hand-rolled flat YAML writer (`nudge-store.ts`/`observation-store.ts` precedent). First pass wrote pretty-printed JSON into the `.yaml` file (valid YAML syntax, but inconsistent look vs. sibling `patterns/`/`sightings/` files coming in Phase 3). Asked the user; decision: **add the `yaml` npm package (v2.9.0, already present transitively) as a direct dependency of `packages/daemon`** and use genuine YAML serialization. Implemented, tests updated to assert real YAML shape (no JSON braces). `nudge-store.ts`/`observation-store.ts` deliberately left on the old hand-rolled format — migrating those is a separate, undecided question, noted here for awareness if Phase 3's `pattern-store.ts`/sighting store raises the same question again.

Review found and fixed:
- `config.ts`'s `envNumber` doc said "positive-finite" but didn't check positivity — fixed, added negative-override test.
- `index.ts`'s `onEntryCreated` stamped snapshot `date` with a bare `new Date()` instead of the injectable `now` convention used elsewhere (`observation-store.ts` precedent) — refactored into `createOnEntryCreated(deps)` with `now` injectable, defaulting to the real clock.
- `entry-snapshot-wiring.test.ts`'s "snapshot-save failure" test didn't actually exercise `snapshotStore` — fixed to use a real failing fs adapter through the actual store.
- `snapshot-store.ts` had `node:fs/promises`/`node:path` imports declared mid-file — moved to top.
- `substrate.ts`'s `watchResolution` silently falls back to qualitative if a computable pattern's watch is missing baseline — documented as deliberate defensive coding (REQ-LPC-23 says baseline should always be set, but the pure function doesn't trust its caller).

Gate results: `bun run test` (workspace) 919 pass / 0 fail (project's own script, avoids picking up stale gitignored `dist/` compiled test artifacts — confirmed `dist/` is gitignored, no real build-artifact hazard). `bun run typecheck` clean, `bun run lint` clean.

Beginning Phase 3 (risk phase — pattern ledger, sighting store, Observer rework).

### 2026-07-10 — Phase 3 complete (risk gate)

Implemented: `packages/daemon/src/pattern-store.ts` (new, uses `yaml` package for its nested `retirement`/`watch` fields, per the Phase 2 precedent — sighting files stayed on the existing hand-rolled flat writer since `SightingSchema` is flat). `packages/shared/src/observations.ts` (`ObservationSchema` gains required `patternId`). `packages/daemon/src/observation-store.ts` (directory renamed `observations/` → `sightings/`, `save()` requires `patternId`). `packages/daemon/src/observer.ts` fully reworked: match-or-declare ledger contract in the prompt, `buildLedger` (capped at `config.ledgerCap`, sorted by `lastSightingAt` recency), `validateObservations` rejects unknown pattern IDs but downgrades invalid `metricLink` to qualitative rather than rejecting. `packages/daemon/src/index.ts` wires `patternStore`/`config.ledgerCap` into observer deps. Wide test-fixture updates across daemon/web/cli/shared to add `patternId` (web files named explicitly by the plan: `full-loop.test.ts`, `sse-streaming.test.ts`).

**Real production-data risk found and fixed.** First pass renamed the observation directory to `sightings/` with no fallback, despite the plan explicitly specifying "store reads both shapes until [P5]." Checked `/home/rjroy/.local/state/ink-mirror/` (the data dir used by the actually-running deployed instance at `~/Applications/ink-mirror`, confirmed via `ps aux`) and found **22 real user journal observations** from 2026-03 through 2026-05 in the old `observations/` directory. Shipping the rename as-implemented would have made this real data invisible to the daemon on deployment, with nothing left pointing at the old path for Phase 5's migration to find. Fixed: `observation-store.ts` gained a `legacyObservationsDir?` option; `get()`/`list()` fall back to it (current dir wins on ID collision); `index.ts` now wires `LEGACY_OBSERVATIONS_DIR = join(DATA_DIR, "observations")` into the real store. Verified with injected-fs tests, not the real path.

Fresh-context review of P1–P3 (explicit plan gate) found three more issues, all fixed:
- `entry-snapshot-wiring.test.ts` reimplemented `onEntryCreated` by hand instead of exercising the real `createOnEntryCreated` (wasn't exported). Exporting it required first gating `index.ts`'s module-level daemon bootstrap (socket bind, `Bun.serve`, pi-agent warm-up) behind `if (import.meta.main)`, since a bare import would otherwise have started a real daemon with live network calls during tests. `start` script (`bun run src/index.ts`) is unaffected — `import.meta.main` is true there. Test now imports and calls the real factory.
- `observe()` was ~109 lines (over the ~100-line heuristic). Extracted the per-observation match-or-discover-and-persist branch into `resolveAndStoreObservation`; `observe()` is now ~72 lines.
- Cost-check regression: added a committed test (`observer.test.ts`) building a genuine worst-case 50-pattern, all-computable ledger and asserting the full prompt stays under a documented token budget. Corrected figure: **~6,167 tokens** worst-case (vs. the original one-off ~4,594 estimate, which undercounted by using a computable/qualitative mix instead of all-computable). At 30 entries/month this is ~$0.59/month on Sonnet-class pricing, within the $1.50/month budget — but budget-sensitive to model choice, worth re-confirming at the Phase 7 real-traffic cost check (already scheduled there).

Not fixed, explicitly deferred: the plan's delegation guide says the P3 cost check should use a real model; this pass used the chars/4 heuristic only (no API key/model configured in this environment). Phase 7 already re-runs the cost check "with real prompt traffic from the spot-check," so the real-model verification is on schedule there, not skipped.

Gate results: `bun run test` 974 pass / 0 fail, `bun run typecheck` clean, `bun run lint` clean.

Beginning Phase 4 (pattern-grain curation, promotion gate, watch list, new API).

### 2026-07-10 — Phase 4 complete

Split into two implementation dispatches to keep agent scope manageable (Phase 3's fix agent hit a session limit mid-task; splitting reduced blast radius):
- 4a: `curation.ts` moved to pattern grain (dossiers for candidate oldest-first + up to 3 recent undecided + watch-status block via `substrate.recurrenceSince`; `resurfacedRules: []` seam left for Phase 5), `promotion.ts` (new: `proposalFor` threshold gate + decline-suppression that clears on a new sighting), `pattern-store.ts` gains `declineProposal`. Left the workspace in a known-broken intermediate state (`routes/observations.ts` still called the old 2-arg `assembleCurationSession` signature) — expected, closed by 4b.
- 4b: `routes/patterns.ts` (new, full pattern-grain API + `OperationDefinition`s), `routes/observations.ts` reduced to pure read-only sighting listing (PATCH/onIntentional/`?status=` all removed per REQ-LPC-28/30), `routes/events.ts` wires `pattern:discovered`/`pattern:proposal`/`pattern:watch-resolved` (5s keepalive untouched), `packages/shared/src/observations.ts` drops `ClassifyObservationRequestSchema`/`VALID_TRANSITIONS`/`isValidTransition`, `profile-store.ts`'s `addOrMergeRule` gains `patternId`/`provenance` metadata (used now via the existing rule-creation path rather than waiting on Phase 5, since Phase 5 only adds health/migration on top).

Testing pass found 5 real gaps, all fixed:
- `profile-store.ts`'s `addOrMergeRule` dedup-merge branch (existing-rule-by-text-match path) never propagated `patternId`/`provenance` onto the matched rule — a real bug that would have broken Phase 5's rule-health lookups (which key off `patternId`). Fixed.
- Zero test coverage of `pattern:discovered`/`pattern:watch-resolved` actually firing (only `pattern:proposal` had one). Added end-to-end tests for entry-triggered discovery, detach-triggered discovery, and a full watch-to-resolution cycle through `GET /patterns/session` (the one REQ-LPC-25 code path that had no integration coverage at all).
- `ObserveResult.discoveries`, `observation-store.ts`'s `reassignPattern`, and `declineProposal`'s `proposalSurfacedAt` clearing were all implemented but unasserted. Added direct tests for each.

Fresh-context review found one more real bug, fixed: `pattern-store.ts`'s `merge()` folded the duplicate's counters into the survivor but never zeroed the duplicate's own `sightingCount`/`entryIds`/`lastSightingAt`. Since a merged-away duplicate can be reactivated (the transition table doesn't special-case merge-retirement), this meant reactivating a merged duplicate brought back stale nonzero counts with zero real sightings — false numbers re-entering the ledger/curation session. Fixed: duplicate's counters now zero on merge; added a merge-then-reactivate regression test.

Security note: the review also checked for other body/query-sourced IDs reaching file-path joins unchecked across the new routes (following up on 4b's own proactive `duplicateId` path-traversal fix) — found none outstanding.

Gate results: `bun run test` 1014 pass / 0 fail, `bun run typecheck` clean, `bun run lint` clean.

Beginning Phase 5 (profile rule linkage, rule health, migration — fresh review + destructive/irreversible step).

### 2026-07-11 — Phase 5 complete (destructive/irreversible step)

Split into two dispatches, same reasoning as Phase 4. Both sub-agents were warned explicitly never to read/write `/home/rjroy/.local/state/ink-mirror/` (the real data dir for the currently-running deployed instance found during Phase 3) and to use only temp dirs/injected fs for migration tests — confirmed clean, no references to the real path anywhere in the diff.

- 5a: `profile-store.ts` cleanup (`transformToStablePattern`/`patternsMatch` removed as dead code once rule identity moved to `patternId` equality; `profileFromMarkdown` now accepts v1 or v2 and returns the real parsed version instead of hardcoding 1 — this itself was a latent bug, since it would have silently downgraded every migrated v2 profile on read; `baseline`/`lastSupportedAt` round-trip through markdown; `headerToDimension`'s missing `paragraph-structure` case fixed). Rule health wiring: `curation.ts`'s `computeResurfacedRules` now flags staleness (`isStale`, `stalenessWindow`) and drift (`detectDrift`, computable patterns only) per rule, populating the `resurfacedRules` seam Phase 4 left empty. Nothing auto-retires — reaffirm/retire are explicit writer actions (`POST /patterns/:id/reaffirm` new; `/retire` reused from Phase 4).
- 5b: new `migration.ts` — backs up `profile.md` and legacy observation files to `DATA_DIR/backup-<date>/` before any write; migrates v1 profiles to v2 (rules → `writer-asserted`, linked to a new `intentional` pattern with `migratedNoHistory: true`); migrates legacy `observations/*.yaml` (no `patternId`) into candidate patterns + first sightings, mapping old `status` 1:1 (`pending`→`candidate`); idempotent (safe no-op on a second run); `rebuildCounters` runs last. `Observation.status`/`CurationStatusSchema` removed from shared schema (REQ-LPC-30 stored-file half); `observation-store.updateStatus` removed (dead since Phase 4). Caught and fixed its own real bug along the way: legacy filenames could collide with the independent post-Phase-3 sighting ID sequence — added collision detection with a `-legacy-N` rename rather than silently overwriting.

**Real gap found and fixed:** the 5b implementer flagged, rather than silently patched, a genuine contradiction between the two sub-tasks: REQ-LPC-27 requires a migrated pattern's "staleness clock starts at migration" (no immediate false-stale flag), but 5a's `isStale` has no concept of pattern creation time — a `migratedNoHistory` pattern (zero `entryIds` by construction) would be flagged stale the instant any recent entry exists, not after a real staleness window had elapsed. Fixed directly in `curation.ts`'s `computeResurfacedRules`: added a grace period that only applies when a pattern has zero `entryIds` (i.e. only migrated patterns — normally-created patterns always get an immediate first sighting, so they're never affected), gated on whether `stalenessWindow` entries have elapsed since `pattern.createdAt`. Caught a real bug in the fix itself before landing it: `MetricSnapshot.date` is a plain `"YYYY-MM-DD"` string while `pattern.createdAt` is a full ISO timestamp, so a naive `>=` string comparison was always false (lexicographic: shorter string always sorts below a same-prefixed longer one) — fixed by comparing on the date portion only (`pattern.createdAt.slice(0, 10)`). Added 3 tests: grace period holds, grace period expires into genuine staleness, and a non-migrated pattern with real sighting history is entirely unaffected by the new code path.

Both Phase 5 fix/implementation agents hit the platform's session-limit mid-task this phase (twice total across the whole implementation) — recovered each time by inspecting `git diff` for partial progress and either dispatching a fresh continuation agent or, for the small grace-period fix, completing it directly.

Gate results: `bun run test` 1035 pass / 0 fail, `bun run typecheck` clean, `bun run lint` clean.

Beginning Phase 6 (web and CLI surfaces).

### 2026-07-11 — P4-P5 fresh-context review (explicit plan gate)

Confirmed correct (no action needed): migration idempotency/backup ordering/exhaustive legacy-status mapping, the REQ-LPC-27 grace-period gate, full removal of `Observation.status`/`CurationStatusSchema`/`updateStatus`, no references anywhere to the real deployed data path.

Two real bugs found in how retirement paths maintain the `Pattern.ruleId` ↔ profile-rule link, both fixed directly (not delegated, given repeated session-limit interruptions this phase — these were small, well-scoped changes):
- `/patterns/:id/merge` and `/patterns/:id/dismiss` retired a pattern without ever deleting its linked rule (only `/retire` did this) — an orphaned, permanently-un-resurfaceable rule would be left in `profile.md` with no backing pattern. Fixed: both routes now check the pre-transition pattern's `ruleId` and call `profileStore.deleteRule`, mirroring `/retire`'s existing logic.
- `pattern-store.ts`'s `updateStatus` never cleared `ruleId` when transitioning to `retired` (and `merge()`'s duplicate-retirement path had the same gap), so a reactivated pattern still carried a `ruleId` pointing at a deleted rule — silently blocking all three re-promotion paths (classify+promote, direct promote, proposal accept) forever, since they all guard on `!pattern.ruleId`. Fixed: `updateStatus` and `merge()` now clear `ruleId` whenever a pattern reaches `retired`, for the same reason `retirement` itself already gets cleared/set there.
- Added regression tests: merge/dismiss of a ruled pattern removes the orphaned rule; retire clears `ruleId` on the returned pattern; a full retire→reactivate→classify-and-promote-again cycle succeeds and creates a fresh rule.

Lower-severity note (addressed with a comment, not a restructure): `routes/patterns.ts`'s `createPatternRoutes` is a single ~550-line function in a 730-line file, past the ~100-line/~800-line heuristics. This matches every other route file's established one-factory-with-inline-handlers convention in this codebase (routes/entries.ts, routes/observations.ts) — not a one-off regression introduced this phase. Added a comment explaining why, and noted it as a cross-cutting refactor candidate if route files keep growing, rather than restructuring this one file out of step with its siblings.

Gate results: `bun run test` 1038 pass / 0 fail, `bun run typecheck` clean, `bun run lint` clean.

### 2026-07-11 — Phase 6 complete (web + CLI, dispatched in parallel per the plan's delegation guide)

Web and CLI tracks ran as two simultaneous background agents (explicitly sanctioned — "within P6 the web and CLI tracks are independent and can go to parallel sub-agents"). Web: 13 new proxy routes under `app/api/patterns/**`, `app/patterns/[id]/page.tsx` (read-only dossier page), `lib/api.ts` pattern-grain client, `curation-panel.tsx`/`profile-editor.tsx` reworked to dossier-grain UI with provenance/health badges, dimension-label consolidation onto shared `DIMENSION_LABELS`. CLI: `curate.ts`/`profile.ts` reworked to pattern-grain interactive sessions; verified (not assumed) that the CLI's runtime-discovery-from-daemon-`/help` mechanism surfaces all 13 new pattern operations correctly, via a throwaway script wiring the real route registry through the real discovery/help-tree code.

**Process error, disclosed in full:** while bisecting an unrelated production-build regression (below), I ran `git checkout HEAD -- packages/web/components/{curation-panel,profile-editor,journal-editor}.tsx` without stashing first, discarding the web agent's uncommitted rework of those three files. Recovered by resuming — though due to my own error, as a *fresh* agent rather than a proper `SendMessage`-resumed one, since I called Agent instead of SendMessage — grounded in the surviving intact files (`lib/api.ts`, `app/patterns/[id]/page.tsx`, the untouched test files, and the CLI's already-migrated `curate.ts`) as source of truth. Recovery verified clean: 18/18 component tests passed immediately, full workspace green. Lesson for future sessions: stash before any `git checkout` during bisection, even single-file, even mid-verification — see `[[git-recovery-lessons]]` if that memory exists, or the global lessons-learned file's "Git Recovery" section.

**Real production-build regression found, root-caused, and fixed (not pre-existing, despite the web agent's own verification claiming otherwise):** `bun run build` failed with Turbopack "Module not found: Can't resolve './branded.js'" (and 7 sibling errors) from `packages/shared/src/index.ts`. The web agent had checked this via `git stash` and reported it as pre-existing — that check was wrong; a careful clean-cache `git stash` re-verification confirmed the baseline (pre-Phase-6, in fact pre-this-whole-plan) builds cleanly. Root cause, after extensive bisection: `@ink-mirror/shared`'s relative imports use explicit `.js` extensions (Node16/NodeNext style, required for `bun`/daemon/CLI to run the `.ts` sources directly), and neither Turbopack nor plain webpack resolve `.js` specifiers to `.ts` files when transpiling a workspace package's source by default — a documented, tracked class of upstream Next.js/Turbopack limitation (confirmed via web search against vercel/next.js issues, e.g. #73360). The old (smaller) shared barrel apparently stayed under whatever threshold kept this latent; Phase 1-5's two new files (`patterns.ts`, `events.ts`) plus Phase 6's web code actually importing symbols from them was what tipped it over. Fixed: `packages/web/next.config.ts` gained a `webpack.resolve.extensionAlias` config (`.js` -> try `.ts`/`.tsx` first, fall back to real `.js`), and `packages/web/package.json`'s `build` script now runs `next build --webpack` (forcing the classic bundler for production builds only — `dev` already used `--turbopack` separately and is unaffected, since Turbopack has no equivalent alias mechanism per the search results). Verified: `bun run build` now succeeds end-to-end, all routes generated including the 13 new `/api/patterns/**` proxies; confirmed no other script path (root `package.json`, CI workflow) invokes bare `next build` that would silently reintroduce the bug.

Testing pass found one real coverage gap, fixed: six curation-panel actions (merge, detach, dismiss, proposal decline, "promote now anyway", retire) had no component-level interaction tests (only classify/promote-on-keep/proposal-accept/reaffirm did) — added all six, following the existing fetch-mock convention.

Fresh review found and fixed four more issues:
- `app/patterns/[id]/page.tsx` never rendered `sighting.entryText` — a real REQ-V1-17 regression on this one surface (every other dossier view showed entry context correctly). Fixed, new test added.
- Dead CSS (`.im-stamp`/`.kept`/`.released`/`.set-aside`/`.awaiting`) left over from the removed observation-status UI — removed.
- Zero tests exercised the 13 new proxy route handlers directly (only that `lib/api.ts` exported functions). Added representative coverage (one GET, one POST-with-body, one error-passthrough case) against a real fake-daemon-over-temp-socket, which required making `lib/daemon.ts`'s socket path resolution call-time instead of module-load-time (behavior-identical in production, now test-injectable).
- `curation-panel.tsx`'s main component was ~223 lines with no size-exception comment. Extracted `ContradictionsSection`/`ResurfacedRulesSection`/`ProposalsSection`/`WatchListSection`/`EmptyReadingRoom`/`CurrentDossierReview`/`AccumulatingSection`; down to ~122 lines with a comment explaining the remainder is genuine orchestration. All 17 pre-existing component tests still passed unchanged, confirming no behavior change.

Gate results: `bun run test` 1116 pass / 0 fail (70 files), `bun run typecheck` clean, `bun run lint` clean, `bun run build` succeeds end-to-end.

### 2026-07-11 — Phase 7, steps 1/2/6 (requirement mapping, AI Validation sweep, coverage check)

Dispatched a read-only audit agent (full report: `.lore/work/notes/longitudinal-pattern-confirmation-phase7-audit.md`) against REQ-LPC-1..30, the spec's Success Criteria, and AI Validation lists — explicitly scoped to exclude anything needing a real LLM call (spot-check, real-traffic cost check), which are handled separately below.

**Initial tally: 26/30 requirements fully met, 4 partially met, 0 not met.** All 12 Success Criteria and all in-scope AI Validation items were at least code-inspection-verified. Three of the four partial findings were real gaps, not nitpicks, and have since been fixed:

- **REQ-LPC-19/20 (real bug, most serious):** `ProfileRule.lastSupportedAt` was write-only — `reaffirmRule` stamped it, but `computeResurfacedRules`/`isStale` never read it, so a reaffirmed stale rule resurfaced again at the very next session, directly contradicting inline doc comments claiming reaffirm "clears" the resurfacing. This undercut Success Criterion #7's "reaffirm-or-retire" loop. Fixed: added a reaffirm grace period in `curation.ts`'s `computeResurfacedRules`, alongside the existing migration grace period, keyed on whichever is more recent between `lastSightingAt` and `lastSupportedAt`. 3 new regression tests (suppression, correct expiry, a genuinely-fresher sighting taking priority over an older reaffirm).
- **REQ-LPC-11:** nothing in the web UI labeled freshly-streamed sightings "unconfirmed" (a repo-wide grep for the word found zero hits) — overlooked, not deliberately deferred. Fixed: `journal-editor.tsx`'s live-stream display now shows an "Unconfirmed" badge on each freshly-submitted observation, reusing the existing badge/tone conventions from REQ-LPC-26's "evidence still accumulating" language. New test file `journal-editor.test.tsx` (this component had zero tests before this fix).
- **REQ-LPC-29:** three of four new SSE event types were dead capability — `lib/api.ts` exposed `onPatternDiscovered`/`onPatternProposal`/`onPatternWatchResolved` handler slots but `journal-editor.tsx` (the only caller) wired none of them. Fixed for the one case that genuinely fits the existing submission-scoped SSE window: `onPatternDiscovered` now renders "New pattern noticed: ..." during entry submission. `onPatternProposal`/`onPatternWatchResolved` fire only during curation-session assembly, which has no open SSE connection today (curation-panel polls via fetch) — wiring a live subscription there for the panel's whole open-ended review session would itself violate the project's "SSE scoped to when needed, not held open forever" rule. Left intentionally unwired with a documented comment in `lib/api.ts` (reserved for a possible future live-curation-panel feature), rather than silently dead with no explanation.
- **REQ-LPC-18** dead code noted, not fixed (cosmetic): `ProfileStore.getRuleByPatternId` has no caller — dossier reachability is achieved via the forward `patternId` link instead, which is sufficient. Low priority, noted for retro.

Also closed: 10 of 13 new web proxy routes under `app/api/patterns/**` had zero test coverage (only `session`/`[id]`/`classify` were tested). Added coverage for all 10 remaining, matching the existing fake-Unix-socket-daemon test convention.

**Coverage:** overall 93.53% functions / 91.11% lines post-fixes (up from the audit's initial 92.96%/93.11% — note lines dipped slightly since the reaffirm/discovered-pattern fixes added more branch surface than pure line count). The plan's own risk-phase logic (`substrate.ts`, `pattern-store.ts`, `promotion.ts`, `curation.ts`) remains at ~97-100%. Remaining gaps are concentrated in UI presentation code with many prop-permutation branches (`profile-editor.tsx` 58%, `lib/api.ts` 57% — largely the now-intentionally-unwired SSE handlers, `migration.ts` 77% functions on defensive branches, `journal-editor.tsx`'s pre-existing submit/SSE-lifecycle glue that had zero tests before this plan touched the file at all). Judgment call: did not chase these to 100%, since the plan's own bar is 90%+ on *new code*, and much of the remaining gap is either pre-existing code this plan happened to touch (not code the plan introduced) or defensive/permutation branches with low real risk. Noted for the retro rather than further fix rounds.

Gate results after all Phase 7 fixes: `bun run test` 1146 pass / 0 fail, `bun run typecheck` clean, `bun run lint` clean, `bun run build` succeeds end-to-end.

**Remaining for Phase 7:** steps 3 (manual spot-check with a real model), 4 (real-traffic cost re-check), and 5 (runtime verification through web/CLI) all require a live model and/or starting the daemon — checkpointing with the user before proceeding, since this has real-world footprint (network calls, credentials, possible cost) beyond what an orchestrator should decide unilaterally.

### 2026-07-11 — Session paused: real-model steps deferred by user decision

Asked the user how to handle Phase 7's remaining real-model-dependent steps (spot-check, cost re-check, runtime verification). Decision: **skip for now, mark needs-manual-followup** — not run in this session.

**Status left as-is deliberately:** spec (`longitudinal-pattern-confirmation.md`) and plan remain `status: draft`, NOT flipped to `implemented`/`executed`. The plan's own Phase 7 gate ("all success criteria checked; spec status flipped to implemented; plan status to executed") is conditioned on the full validation sweep including the real-model spot-check, which hasn't run. Flipping status now would overstate completion.

**What's done, verifiable right now without a real model:**
- All 7 phases implemented, workspace green throughout (`bun run test`/`typecheck`/`lint`/`build` all passing as of this note).
- 30/30 REQ-LPC requirements met after fixes (26 met on first pass, 4 partial findings all addressed except one cosmetic dead-code note on REQ-LPC-18, `getRuleByPatternId`, left as-is — harmless, dossier reachability works via the forward link).
- All 12 Success Criteria and all in-scope AI Validation items test- or code-inspection-verified.
- Coverage: 93.53% functions / 91.11% lines overall; risk-phase logic (substrate/pattern-store/promotion/curation) at ~97-100%.

**What's NOT done — for whoever resumes this (a future `/implement` invocation on this same plan, or manual work):**
1. **Manual spot-check protocol** (plan Phase 7 step 3, spec's "AI Validation" identity-match item): submit a scripted series of entries with deliberately recurring habits against a real model (`INK_MIRROR_MODEL` configured); verify the ledger converges to one pattern per habit; exercise merge/dismiss on any near-duplicates. This has no automated oracle — it's the one check nothing in this session could substitute for.
2. **Real-traffic cost re-check** (step 4): re-measure actual token usage from the spot-check's real prompts against the $1.50/month budget constraint. The existing `observer.test.ts` "cost budget" test is a heuristic (chars/4) proxy, not this.
3. **Runtime verification of the full loop through web and CLI** (step 5): write → observe → curate → promote → resurface, actually driven through the running app (not just route-level tests), per the lessons-learned principle that spec compliance in isolation misses "never actually connected."
4. Re-run all of Phase 7's mechanical checks one more time after 1-3 land, in case the spot-check surfaces anything (e.g., poor identity-match convergence would be a real finding requiring rework, per the plan's own "Risks and watch items" section calling this "the unproven bet").
5. Only after all of the above: flip spec status to `implemented`, plan status to `executed`, and run `/lore-development:retro`.

A machine (~/.pi` credential store) suggests a real model call is feasible without new secrets when someone picks this up — worth checking that's still true and pointed at a scratch data directory, not the real `~/.local/state/ink-mirror/` (which holds 22 real user journal entries from an actually-running deployed instance — see the Phase 3 log entry above).
