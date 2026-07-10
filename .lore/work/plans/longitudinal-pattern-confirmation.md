---
title: "Implementation plan: longitudinal pattern confirmation layer"
date: 2026-07-09
status: draft
tags: [plan, observer, curation, profile, longitudinal, pattern-ledger, watch-list, metrics]
modules: [shared, daemon, cli, web, observer, curation, profile-store, metrics]
related:
  - .lore/work/specs/longitudinal-pattern-confirmation.md
  - .lore/work/brainstorm/longitudinal-gap.md
  - .lore/work/research/stylometry-and-feedback-for-longitudinal-design.md
  - .lore/specs/v1-core-loop.md
  - .lore/issues/observation-evaluation-methodology.md
  - .lore/issues/observer-selection-pressure-policy.md
---

# Implementation plan: longitudinal pattern confirmation layer

Source spec: `.lore/work/specs/longitudinal-pattern-confirmation.md` (REQ-LPC-1..30). Final validation checks the implementation against that spec's Requirements, Success Criteria, and AI Validation sections.

## Decisions resolved during planning

Confirmed with Ronald (2026-07-09):

1. **Explicit dismiss action.** The spec's `accidental` conflates "real habit I disown" with "wrong observation, I reject it" (`.lore/issues/observation-evaluation-methodology.md`). We add a distinct **dismiss** action on patterns: it sets status `retired` with a `dismissedAsWrong: true` marker. Dismissed patterns never enter the watch list, leave the Observer ledger, and are distinguishable from ordinary retirements (useful for the manual spot-check protocol). Reactivation works the same as any retired pattern (→ `undecided`, marker cleared).
2. **Merge ships now.** Curation offers a writer-ratified merge: writer picks a survivor and a duplicate; the duplicate's sightings move to the survivor; the duplicate becomes `retired` with `mergedInto: <survivorId>`. Reversal is via detach (any moved sighting can be detached back out into a new candidate, per REQ-LPC-6). Merge requires same dimension; classification of the survivor is unchanged.
3. **Sightings are separate files.** One file per sighting (evolving the current `obs-*.yaml` format with a `patternId` field). Pattern files hold lifecycle, watch metadata, and denormalized counters only — no embedded sighting list. Append-only writes per entry; light migration of existing observation files.

Planner decisions (flagged for review, not user-blocked):

- **Configurable constants** live in a new `packages/daemon/src/config.ts`: defaults from the spec (3 sightings / 3 entries / 2,000 words / 10-entry staleness / 5-entry computable watch / 10-entry qualitative watch / 50-pattern ledger cap / 50% drift margin), each overridable via `INK_MIRROR_*` env vars (precedent: `INK_MIRROR_MODEL`, `INK_MIRROR_DATA`).
- **Snapshot files** are keyed by entry: `snapshots/<entryId>.yaml` (precedent: `nudges/<entryId>.yaml`). Designed as a durable append-only time series with stable field names, because the future profile-versioning spec consumes it (`.lore/research/profile-versioning.md`).
- **Ledger recency cap** (REQ-LPC-5) needs "last sighting date" per pattern without reading every sighting file: patterns carry denormalized `lastSightingAt` and `sightingCount`/`entryIds` counters, updated on sighting save and detach/merge. Sighting files remain the source of truth; a rebuild function recomputes counters from sightings (used by migration and available for repair).
- **Pattern-level contradiction detection** (REQ-LPC-13) reuses the existing `OPPOSING_SIGNALS` regex-pair table, applied to pattern canonical statements (unclassified vs `intentional` patterns) instead of raw observation strings. The table's known false-positive/negative behavior (2026-03-27 retro) is unchanged in quality; grain moves, mechanism stays.
- **Migration runs at daemon startup**, idempotently: if `profile.md` is `version: 1` or any legacy observation file (has `status`, lacks `patternId`) exists, migrate (details in Phase 5). No separate script to remember.
- **Drift baseline** (REQ-LPC-21) is captured at rule creation: the rolling mean of the linked metric over the last 5 entries at that moment, stored on the rule.
- **Migration backup:** before rewriting anything, migration copies `profile.md` and the legacy observation files to `DATA_DIR/backup-<date>/`. Small scope addition (a directory and file-copy logic) justified by migration being the one irreversible step in the plan.

## Architecture at a glance

New durable state under `DATA_DIR` (all human-readable, REQ-V1-26):

```
patterns/    pat-YYYY-MM-DD-NNN.yaml   lifecycle, dimension, canonical statement,
                                       metric link, watch item, counters, rule link
sightings/   obs-YYYY-MM-DD-NNN.yaml   existing files + patternId (dir renamed from observations/)
snapshots/   <entryId>.yaml            full metric snapshot per entry
profile.md   version: 2                rules gain patternId, provenance, health metadata
```

New daemon modules: `pattern-store.ts`, `snapshot-store.ts`, `substrate.ts` (pure deterministic math), `promotion.ts` (threshold gate + proposals), `migration.ts`. `routes/patterns.ts` replaces the observation classify endpoint.

<div style="border:1px solid #999; border-radius:6px; padding:10px 14px; margin:8px 0; font-family:monospace; font-size:13px; line-height:1.9;">
<strong>Phase flow</strong> (⛩ = validation gate; phases joined by → depend on the previous one)<br/>
P1 shared schemas ⛩ → P2 substrate (metrics+snapshots) ⛩ → P3 pattern ledger + observer <span style="color:#b45309;">⛩ risk gate: identity pipeline + fresh review</span> → P4 curation API + promotion + watch ⛩ → P5 profile health + migration <span style="color:#b45309;">⛩ fresh review</span> → P6 web+CLI surfaces ⛩ → P7 final validation <span style="color:#b45309;">⛩ spec check + manual spot-check + cost check</span>
</div>

Ordering rationale: retros (`.lore/retros/commission-cleanup-20260327.md`) say front-load the riskiest pipeline. The pattern-ledger/LLM-identity-matching pipeline is this spec's bet, so it lands in P3, immediately after its two dependencies (schemas, substrate), and gets the first fresh-context review. Each phase leaves the **whole workspace** green (`bun test` + `bun run typecheck` at the root, not per-package): additions come first, removals happen in the phase that replaces the old path.

One consequence of "whole workspace green" that is easy to miss: `packages/web/tests/` exercises daemon internals directly. `full-loop.test.ts` and `sse-streaming.test.ts` call `observationStore.save()` with raw observations, construct `createObservationRoutes({ ..., onIntentional })` literals, call `profileStore.addOrMergeRule()`, and build `Observation` objects with a `status` field; `api-client.test.ts` asserts `api.classifyObservation` exists; `web-cli-parity.test.ts` asserts against the PATCH endpoint. Any phase that changes those surfaces updates those web test files **in the same phase** — they appear in the affected phases' steps and gates below, not deferred to P6.

---

## Phase 1 — Shared schemas and branded IDs

All in `packages/shared/src/`. Additive only; nothing removed yet.

1. `branded.ts`: add `PatternId`, `SightingId` brands + constructors (snapshots are keyed by `EntryId`; no new brand needed).
2. New `patterns.ts`:
   - `PatternStatusSchema`: `candidate | intentional | accidental | undecided | retired`.
   - `PATTERN_TRANSITIONS` + `isValidPatternTransition`: curation moves `candidate`/`undecided` to any classification; any classified status can be re-classified; `retired` only via retire/dismiss/merge actions; `retired → undecided` on reactivate (REQ-LPC-13/22, spec Concepts).
   - `PatternSchema`: `id, statement, dimension, status, createdAt, updatedAt, metricLink?` (must name a key in the linkable-metric registry), `lastSightingAt?`, `sightingCount`, `entryIds: string[]` (distinct entries, for threshold math), `retirement?: { dismissedAsWrong?: boolean, mergedInto?: PatternId }`, `watch?: WatchItemSchema`, `ruleId?`.
   - `WatchItemSchema`: `classifiedAt`, `baseline?` (computable only), `resolved: boolean`, `resolvedAt?` (REQ-LPC-23/25 — resolution mutates watch metadata only).
   - `SightingSchema`: `id, patternId, entryId, evidence, dimension, createdAt` (REQ-LPC-3).
   - `DossierSchema`: pattern + sightings with entry context + optional substrate trend + watch status + proposal flag (REQ-LPC-12).
   - Request schemas for the pattern-grain API: classify, detach, merge, dismiss, promote, proposal accept/decline, retire, reactivate.
3. `metrics.ts`: add `functionWordFrequencies` and `punctuation` blocks to the entry metrics shape (REQ-LPC-9); define `MetricSnapshotSchema` (entryId, date, metrics, schema version) and the **linkable-metric registry** — an exhaustively-typed map of stable metric field names to accessor paths into a snapshot (spec Concepts: validation accepts a metric link only if the field is in this registry). Registry keys are the stable field contract the future profile-versioning spec will also consume.
4. `observations.ts`: add optional `patternRef` to `RawObservationSchema`/`ObserverOutputSchema` — each output observation either carries `patternId` (existing pattern) or `newPattern: { statement, dimension, metricLink? }` (REQ-LPC-4). **Do not remove** `status`/`VALID_TRANSITIONS` yet (removed in P4/P5 when the old path dies).
5. `profile.ts`: `ProfileRuleSchema` gains `patternId`, `provenance: "writer-asserted" | "evidence-confirmed"`, `baseline?`, `lastSupportedAt?` (REQ-LPC-16/18/19). `ProfileSchema` version becomes `z.union([z.literal(1), z.literal(2)])` during migration window; write path always emits 2.
6. `events.ts`/`schemas.ts` (wherever event payloads are typed): versioned event payload types — `observation:created` gains the resolved pattern reference; new `pattern:discovered`, `pattern:proposal`, `pattern:watch-resolved` payloads (REQ-LPC-29).
7. `index.ts` barrel exports.

**⛩ Gate:** `bun test packages/shared`, `bun run typecheck`, `bun run lint`. Schema unit tests cover: pattern transition table exhaustively, metric-link validation against the registry, observer-output patternRef XOR (existing-ID vs new-pattern, never both/neither).

## Phase 2 — Stats substrate: metrics, snapshots, deterministic math

1. `packages/daemon/src/metrics/word-frequency.ts`: keep content-word filtering as-is; **additionally** emit `functionWordFrequencies` built from the tokens currently discarded by `STOP_WORDS` filtering (REQ-LPC-9 — both signals kept). Hedging/intensifier logic untouched.
2. New `packages/daemon/src/metrics/punctuation.ts`: per-entry punctuation habits (at minimum: per-1,000-word rates for comma, semicolon, colon, dash, parenthesis, question, exclamation, ellipsis). Pure function.
3. `metrics/index.ts`: wire both into `computeEntryMetrics`.
4. New `packages/daemon/src/snapshot-store.ts` (model on `nudge-store.ts`): `save(entryId, snapshot)`, `get(entryId)`, `listAll()` (date-ordered), injectable fs/now. Files `snapshots/<entryId>.yaml` (REQ-LPC-7).
5. New `packages/daemon/src/substrate.ts`: pure deterministic functions over snapshots + sightings — no store access, no LLM (REQ-LPC-8):
   - `rollingMean(snapshots, metricKey, window)`
   - `recurrenceSince(sightings, entriesSince, date)` → "N of last M entries" (REQ-LPC-24)
   - `detectDrift(snapshots, metricKey, baseline, margin, window=5)` (REQ-LPC-21)
   - `isStale(pattern, lastNEntryIds, window=10)` (REQ-LPC-20)
   - `watchResolution(pattern, snapshots, sightings, config)` — computable branch (5 consecutive entries below baseline) vs qualitative branch (10 consecutive entries with no sighting) (REQ-LPC-25)
   - `trendSummary(snapshots, metricKey)` for dossier/prompt blocks (REQ-LPC-10/12)
6. `packages/daemon/src/index.ts` + `routes/entries.ts`: persist a snapshot at entry submission inside `onEntryCreated`, before the Observer runs. "Compute once, persist, pass along" requires a signature change: `observe()` currently always calls `deps.computeMetrics(entryText)` internally (`observer.ts:42-51`), so `observe` gains an optional `precomputedMetrics` parameter (falling back to `deps.computeMetrics` when absent, keeping existing tests valid); `onEntryCreated` computes metrics, saves the snapshot, and passes them in.

**⛩ Gate:** substrate determinism tests — fixed entry fixtures produce byte-identical snapshots and trend outputs across runs; property/edge tests for empty corpus, single entry, all-identical entries, divide-by-zero windows (spec AI Validation; also the NaN→null JSON hazard from lessons-learned — assert no NaN can reach a stored snapshot). New multi-entry corpus fixture convention established here in `packages/daemon/tests/fixtures/`.

## Phase 3 — Pattern ledger, sighting store, Observer rework ← the risk phase

1. New `packages/daemon/src/pattern-store.ts`: one YAML file per pattern (`patterns/pat-YYYY-MM-DD-NNN.yaml`, sequential IDs like observations today). Methods: `create`, `get`, `list` (with status filter), `updateStatus` (enforcing `isValidPatternTransition`), `recordSighting(patternId, sighting)` (bumps counters + `lastSightingAt`), `detachSighting`, `merge(survivorId, duplicateId)`, `setWatch`, `linkRule`, `rebuildCounters(sightings)`. Injectable fs/now (REQ-LPC-1).
2. `packages/daemon/src/observation-store.ts` → sighting semantics: records gain `patternId`; `save` requires it; directory constant becomes `sightings/` (migration in P5 renames/updates legacy files; store reads both shapes until then). `updateStatus` kept but deprecated until P4 removes the old endpoint. Since `save`'s signature breaks callers outside the daemon, update the web tests that construct raw observations in this phase: `packages/web/tests/full-loop.test.ts` and `sse-streaming.test.ts` fixtures gain `patternId`.
3. `packages/daemon/src/observer.ts`:
   - `buildSystemPrompt`: describe the ledger, the match-or-declare output contract, the rule that longitudinal statements must cite supplied numbers and never estimate frequencies (REQ-LPC-10), and the dismiss-aware note that new patterns should be genuinely new.
   - `buildUserMessage`: add a ledger block — active patterns capped at `config.ledgerCap` (50), prioritized by `lastSightingAt` recency, each with ID, canonical statement, dimension, sighting count, and substrate trend where computable (REQ-LPC-5/10).
   - `validateObservations`: keep evidence-substring check (REQ-V1-7); add — `patternId` must exist in the ledger passed to the prompt (reject unknown IDs, REQ-LPC-4); `newPattern.metricLink` must be in the linkable registry or the pattern is stored qualitative (spec Concepts: invalid link → qualitative, not rejected).
   - `observe`: for each valid observation, resolve to sighting-of-existing or create-candidate-with-first-sighting (REQ-LPC-2). Happy-path logging on match/discovery decisions from day one (dx retro lesson).
4. `packages/daemon/src/index.ts`: wire pattern store into observer deps; `observation:created` events now carry the pattern reference.

**⛩ Risk gate:**
- Ledger integrity tests: unknown pattern ID rejected; every stored observation resolves to exactly one pattern; discovery creates candidate + first sighting (spec AI Validation).
- Prompt contract tests: populated ledger → prompt contains pattern IDs, sighting counts, substrate block; cap binds at 50 by recency.
- **Cost check now, not at the end:** token-count a full capped-ledger prompt against the < $1.50/month constraint; if it busts, the cap/trend-block sizing gets fixed here before anything builds on it.
- Workspace-wide `bun test` + `bun run typecheck` (catches the `packages/web/tests` fixture breakage named in step 2).
- **Fresh-context sub-agent code review** of P1–P3 (delegation guide below), scope explicitly including `packages/web/tests/*` compile health, not just the daemon identity pipeline.

## Phase 4 — Pattern-grain curation, promotion gate, watch list, new API

1. `packages/daemon/src/curation.ts`:
   - `assembleCurationSession` moves to pattern grain: dossiers for `candidate` patterns (oldest-first) + up to 3 most-recent `undecided` (existing cap, unchanged scope per spec overview) + resurfaced rules (from P5 health checks — seam added now, wired in P5) + pending promotion proposals + watch-status block (REQ-LPC-12/24).
   - Dossier assembly: sightings with entry context (existing `getEntryText` caching pattern), substrate trend for computable patterns. Presentation order follows the research finding: evidence first, pattern claim second, curation question last.
   - `detectContradiction` compares pattern statements: unclassified vs `intentional` patterns, same dimension, `OPPOSING_SIGNALS` table (REQ-LPC-13).
2. New `packages/daemon/src/promotion.ts`: `proposalFor(pattern, sightings, entryWordCounts, config)` — proposes only when `intentional` ∧ ≥3 sightings ∧ ≥3 distinct entries ∧ supporting entries total ≥2,000 words (REQ-LPC-14). Proposals are computed at session-assembly time from the ledger (no separate proposal store — they're derivable state); accepted → rule creation (P5 wiring); declined → recorded on the pattern (`proposalDeclinedAt`) so it doesn't re-surface every session until evidence grows (new sighting clears it).
3. Watch behavior (in `pattern-store.ts` + `curation.ts` + `substrate.ts`, already built): classify-accidental sets `watch` with `classifiedAt` + baseline for computable patterns (REQ-LPC-23); session assembly computes recurrence text deterministically (REQ-LPC-24); `watchResolution` firing sets `resolved`/`resolvedAt` only and emits `pattern:watch-resolved` (REQ-LPC-25 — affirmative report, observation-not-verdict wording for qualitative).
4. New `packages/daemon/src/routes/patterns.ts` (`createPatternRoutes(deps)`), each with an `OperationDefinition` (REQ-V1-29):
   - `GET /patterns/session` — curation session of dossiers
   - `GET /patterns` / `GET /patterns/:id` — ledger + single dossier
   - `POST /patterns/:id/classify` — body `{ status }`, may include `{ promote: true }` for classify-and-promote in one action (REQ-LPC-16)
   - `POST /patterns/:id/promote` — writer-direct promotion, marks `writer-asserted`
   - `POST /patterns/:id/proposal` — body `{ action: "accept" | "decline" }`; accept creates the rule, `evidence-confirmed` (REQ-LPC-15)
   - `POST /patterns/:id/detach` — body `{ sightingId }`; detached sighting becomes a new candidate pattern (REQ-LPC-6)
   - `POST /patterns/:id/merge` — body `{ duplicateId }` (planning decision 2)
   - `POST /patterns/:id/dismiss` — retire with `dismissedAsWrong` (planning decision 1)
   - `POST /patterns/:id/retire` / `POST /patterns/:id/reactivate` (REQ-LPC-22)
   - `GET /patterns/watch` — watch list (REQ-LPC-24)
5. `routes/observations.ts`: **remove** `PATCH /observations/:id` and the `onIntentional` side effect (REQ-LPC-28); keep read-only listing (now sightings), dropping the `?status=` query filter since the field it filters on is being deleted (REQ-LPC-30). `packages/shared/src/observations.ts`: remove `ClassifyObservationRequestSchema`, `VALID_TRANSITIONS`, `isValidTransition` (REQ-LPC-30 schema half; stored-file migration is P5). Update the web tests that build the old surface in this phase: `full-loop.test.ts`, `sse-streaming.test.ts` (both construct `createObservationRoutes({ ..., onIntentional })` literals), and `web-cli-parity.test.ts` (asserts against the PATCH endpoint).
6. `routes/events.ts` + emit sites: versioned contract per P1 types — `pattern:discovered` on candidate creation, `pattern:proposal` when a proposal first surfaces, `pattern:watch-resolved` on resolution (REQ-LPC-29). Existing 5s keepalive untouched.
7. `packages/daemon/src/index.ts`: wire `createPatternRoutes`, remove `onIntentional`.

**⛩ Gate:** promotion-gate tests with corpora just below/above each threshold (classification, sightings, distinct entries, word count) verifying suppression and emission; proposal-without-acceptance creates no rule; classify-and-promote single action works below thresholds and marks `writer-asserted`; detach produces a new candidate and removes the sighting from the source dossier; merge moves sightings and marks `mergedInto`; dismiss never creates a watch item; watch-loop scripted sequences per pattern kind (spec AI Validation); route tests via Hono test client with mock deps. Workspace-wide `bun test` + `bun run typecheck` (the P4 web-test updates in step 5 must land in the same phase).

## Phase 5 — Profile rule linkage, rule health, migration

1. `packages/daemon/src/profile-store.ts`:
   - **Remove `transformToStablePattern` and the `addOrMergeRule` classify path** (REQ-LPC-17). Rule creation happens only via promotion accept / writer promote: rule text = pattern's canonical statement, editable as before (REQ-V1-22). Web tests calling `addOrMergeRule` directly (`full-loop.test.ts`, `sse-streaming.test.ts`) update in this phase.
   - Rules serialize/parse with `patternId`, `provenance`, `baseline?`, `lastSupportedAt?` in the markdown comment metadata; profile `version: 2` (REQ-LPC-18/19). Explicitly update `profileFromMarkdown`'s hardcoded version guard (`if (version !== 1) return undefined;`, `profile-store.ts:137-138`) to accept version 2 — a literal reading of the P1 schema union alone would leave the parser rejecting every migrated profile.
   - Fix `headerToDimension`: add the missing `paragraph-structure` mapping (latent bug, found during exploration).
   - `sourceCount`/`sourceSummary` derive from the pattern's counters, not the old merge heuristic; `patternsMatch` word-overlap heuristic removed with its caller.
2. Rule health wiring (`substrate.ts` from P2 + curation seam from P4): at session assembly, for each rule — staleness if its pattern has no sighting in the last 10 entries; drift if computable and rolling 5-entry mean deviates from stored baseline by ≥50% (both from `config.ts`). Either resurfaces the rule as a reaffirm-or-retire dossier item; **nothing auto-retires** (REQ-LPC-19/20/21). Reaffirm updates `lastSupportedAt`; retire removes the rule and retires its pattern (REQ-LPC-22).
3. New `packages/daemon/src/migration.ts`, run from `index.ts` at startup before `Bun.serve`, idempotent:
   - Profile v1 → v2: each rule becomes `writer-asserted`, text unchanged; create an `intentional` pattern from the rule text with the explicit `migrated, no historical sightings recorded` dossier state (a `migratedNoHistory: true` flag on the pattern); staleness clock starts at migration (REQ-LPC-27, REQ-LPC-18 exception).
   - Legacy observations → sightings: each observation file lacking `patternId` becomes its own candidate pattern with first sighting; its old `status` migrates to the pattern (`pending`→`candidate`, others map 1:1); migrated-`accidental` patterns start a watch at migration date with no baseline. Remove the per-file `status` field on rewrite; move files `observations/` → `sightings/` (REQ-LPC-30).
   - `pattern-store.rebuildCounters` runs last.
4. Remove the now-dead `Observation.status` remnants from shared (`CurationStatusSchema` where unused) and `observation-store.updateStatus`. Web tests constructing `Observation` objects with a `status` field (`full-loop.test.ts`, `sse-streaming.test.ts`) update in this phase.

**⛩ Gate:** migration round-trip test — a fixture `profile.md` in the current format migrates with rule text unchanged, `writer-asserted` set, intentional patterns created, migrated/no-history state set; legacy observation fixtures become candidate patterns with mapped status; migration is idempotent (second run is a no-op). Rule-health fixtures verify staleness at the window boundary and drift just past / just under the margin as separate cases (spec AI Validation). Workspace-wide `bun test` + `bun run typecheck`. **Fresh-context sub-agent code review** of P4–P5.

## Phase 6 — Web and CLI surfaces

Web (`packages/web/`):
1. Proxy routes under `app/api/patterns/**` mirroring the P4 endpoints; retire the `observations/[id]` PATCH proxy.
2. `lib/api.ts`: pattern-grain client calls, `classifyObservation` removed; SSE subscription handles the versioned payloads and new `pattern:*` events (SSE stays scoped to need per CLAUDE.md lesson). `packages/web/tests/api-client.test.ts` (asserts `classifyObservation` exists) updates here.
3. `components/curation-panel.tsx`: dossier-at-a-time UI — evidence quotes with entry context first, sighting/entry counts and trend line (deterministic numbers from the API, REQ-LPC-8), then classify (intentional / accidental / undecided) + dismiss + detach + merge + promote/proposal accept-decline + retire on resurfaced rules; below-threshold state labeled honestly ("evidence still accumulating", REQ-LPC-26); watch status block with recurrence text (REQ-LPC-24).
4. `components/profile-editor.tsx`: rules show provenance badge, health state, and link through to the pattern's dossier ("why does it say this?", REQ-LPC-18); migrated/no-history state rendered explicitly.
5. Consolidate the divergent web dimension labels onto shared `DIMENSION_LABELS` (`app/entries/[id]/page.tsx` local map; `profile-editor.tsx` ad-hoc `replace`), and update `app/entries/[id]/page.tsx` to show pattern reference instead of per-observation status. Mark `.lore/issues/observer-label-map-consolidation.md` resolved.

CLI (`packages/cli/src/`):
6. `curate.ts`: interactive session over dossiers — keys for intentional/accidental/undecided/skip plus dismiss, detach, merge, promote, proposal accept/decline, retire/reaffirm; renders evidence-first dossier, counts, trend, watch text.
7. `profile.ts`: show provenance/health per rule; dossier reachable (print pattern statement + sighting summary).
8. Everything else (watch list, ledger reads) arrives free via runtime discovery of the new `OperationDefinition`s — verify, don't rebuild.

**⛩ Gate:** all four web integration/parity test files (`full-loop`, `web-cli-parity`, `sse-streaming`, `api-client`) exercising the **new** surface end-to-end (earlier phases kept them compiling; this phase makes them cover the new UX paths); component/CLI tests for the new actions; `bun test` + `bun run typecheck` + `bun run lint` across the workspace. Check for stale `.js` emit beside `.tsx` (web-tsc-build-artifacts retro).

## Phase 7 — Final validation against the spec

1. Walk REQ-LPC-1..30 and every Success Criteria checkbox against the implementation; record the mapping in implementation notes.
2. Run the spec's AI Validation list end-to-end (most items became phase gates; re-verify they all still pass together).
3. **Manual spot-check protocol** (identity-match quality has no automated oracle): submit a scripted series of entries with deliberately recurring habits against a real model; verify the ledger converges to one pattern per habit; exercise merge/dismiss on any near-duplicates it produces. Document the script and results in `.lore/work/notes/`.
4. Re-run the cost check with real prompt traffic from the spot-check.
5. Runtime verification of the full loop (write → observe → curate → promote → resurface) through web and CLI — spec compliance in isolation misses "never actually connected" (lessons-learned).
6. Coverage check: 90%+ on new code.

**⛩ Gate:** all success criteria checked; spec status flipped to `implemented`; plan status to `executed`; retro captured via `/lore-development:retro`.

---

## Requirement coverage map

| Phase | Requirements |
|-------|--------------|
| P1 | schema halves of LPC-1, 3, 4, 9, 13, 16, 18, 19, 22, 29, 30 |
| P2 | LPC-7, 8, 9; math for 20, 21, 24, 25 |
| P3 | LPC-1, 2, 3, 4, 5, 10, 11 |
| P4 | LPC-6, 12, 13, 14, 15, 16, 22 (actions), 23, 24, 25, 26 (gating), 28, 29, 30 (endpoint/schema) |
| P5 | LPC-17, 18, 19, 20, 21, 22 (rule side), 27, 30 (stored files) |
| P6 | LPC-11, 24, 26 (surfaces); REQ-V1-17 preserved in dossier UI |
| P7 | Success Criteria + AI Validation sweep |

Beyond-spec items carried by planning decisions: dismiss action (P4), merge action (P4), web label consolidation + `headerToDimension` fix (P5/P6).

## Delegation and review guide

- Implementation phases run sequentially (each depends on the last), but **within** P6 the web and CLI tracks are independent and can go to parallel sub-agents.
- Fresh-context code review checkpoints: after P3 (identity pipeline — the bet; review scope includes `packages/web/tests/*` compile health since P3 changes shared surfaces), after P5 (migration + old-path removal — the destructive part), and at P7 (whole-diff review). Reviewer prompt should include the spec path and the phase's gate list.
- The P3 cost check and P7 spot-check need a real model (`INK_MIRROR_MODEL`); everything else runs with mocked `queryFn`.

## Risks and watch items

- **Identity matching is the unproven bet** (brainstorm option B). Mitigations are structural: visible/reversible merges, detach, dismiss, the P7 spot-check. If convergence is poor, the fallback posture is "more candidates than ideal," which curation tooling (merge) can absorb.
- **Surface-metric bias:** feeding substrate numbers into the prompt may pull the Observer further toward metric-rich dimensions (`.lore/issues/observer-selection-pressure-policy.md`; research finding on surface feedback's negative effect). Prompt wording in P3 should instruct that trends are context, not selection criteria; the P7 spot-check should count dimension distribution.
- **Migration is the irreversible step.** It rewrites observation files and `profile.md`. Migration backs up originals to `DATA_DIR/backup-<date>/` before writing, and the idempotency test is mandatory before it ever runs on real data.
- **Contradiction-table quality** is a known weak point moved to a new grain, not fixed. Out of scope here; note it in the retro if it gets noisier at pattern grain.
