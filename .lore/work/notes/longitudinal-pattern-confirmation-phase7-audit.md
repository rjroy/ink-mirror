# Phase 7 final-validation audit: longitudinal pattern confirmation layer

Read-only audit against `.lore/work/specs/longitudinal-pattern-confirmation.md` (REQ-LPC-1..30, Success Criteria, AI Validation) and `.lore/work/plans/longitudinal-pattern-confirmation.md` (Phase 7). Covers the uncommitted working tree on branch `feat/fable-improvement` as of the audit date. No source files were modified to produce this report.

Per the task's explicit scope: the manual spot-check protocol (real-LLM identity-match convergence test) and the real-traffic cost re-check are **not** attempted here — both require a live model call and are being handled separately by the user's decision.

---

## Requirement coverage (REQ-LPC-1..30)

Tally: **26 met, 4 partially met, 0 not met.**

### Pattern ledger

**REQ-LPC-1** — Patterns are first-class stored entities (stable ID, canonical statement, dimension, lifecycle status, creation date), stored as human-readable files.
Implementation: `packages/shared/src/patterns.ts:77-131` (`PatternSchema`); `packages/daemon/src/pattern-store.ts` `toYaml`/`fromYaml` (118-137), one YAML file per pattern under `patterns/`.
Verdict: **met**. Tests: `packages/shared/tests/patterns.test.ts` (`PatternSchema (REQ-LPC-1)`), `packages/daemon/tests/pattern-store.test.ts` (YAML serialization, sequential-ID creation).

**REQ-LPC-2** — Every stored observation is a sighting of an existing pattern or a discovery creating a new candidate pattern with its first sighting; no orphans.
Implementation: `ObservationStore.save(entryId, raw, patternId)` requires `patternId` (`packages/daemon/src/observation-store.ts:29,209`); the only call site is `resolveAndStoreObservation` in `packages/daemon/src/observer.ts:153-208`, which either matches an existing ledger ID or calls `patternStore.create()` first.
Verdict: **met**, though the "no orphans" guarantee is structural/type-level (single call site + required parameter) rather than defended by a runtime test that tries to force an orphan and asserts a throw. Tests: `packages/daemon/tests/observer.test.ts` (`pattern ledger integrity`).

**REQ-LPC-3** — A sighting records entry ID, verbatim evidence, date; evidence validated as exact text (REQ-V1-7 continuation).
Implementation: `SightingSchema` (`packages/shared/src/patterns.ts:135-142`); substring check in `validateObservations` (`packages/daemon/src/observer.ts:542-546`) runs before any sighting is created.
Verdict: **met**. Tests: `packages/shared/tests/patterns.test.ts` (`SightingSchema (REQ-LPC-3)`), `packages/daemon/tests/observer.test.ts` (evidence-substring rejection tests).

**REQ-LPC-4** — Observer prompt includes the ledger (ID, statement, dimension); output references an existing ID or declares new; validation rejects unknown IDs.
Implementation: `buildLedger`/`formatLedger` (`observer.ts:231-273`); rejection in `validateObservations` (`observer.ts:549-553`) checks against `ledgerIds` built from the same ledger passed to the prompt.
Verdict: **met**. Tests: `observer.test.ts` (`Pattern Ledger block`, `pattern ledger integrity` — "rejects a patternId not present in the supplied ledger").

**REQ-LPC-5** — Ledger bounded to active (non-retired) patterns, capped at 50 (configurable via env var), prioritized by recency of last sighting when capped.
Implementation: `buildLedger` (`observer.ts:231-255`) filters retired, sorts by `lastSightingAt` descending, then truncates; default cap in `packages/daemon/src/config.ts:40` (`INK_MIRROR_LEDGER_CAP` override, lines 49-68); wired through `packages/daemon/src/index.ts:249`.
Verdict: **met**. Tests: `observer.test.ts` (`buildLedger` — excludes retired, orders by recency, caps at 60→50 dropping the 10 oldest specifically), `packages/daemon/tests/config.test.ts` (env override + fallback cases).

**REQ-LPC-6** — Merges visible/reversible; curation shows source entries per dossier; detach produces a new candidate pattern; (plan addition) writer-ratified merge moves sightings and marks the duplicate `mergedInto`.
Implementation: detach — `POST /patterns/:id/detach` (`packages/daemon/src/routes/patterns.ts:373-421`); merge — `POST /patterns/:id/merge` (423-476) plus dimension guard and counter folding in `pattern-store.ts:342-392`; dossier entry visibility — `buildDossier` (`curation.ts:132-190`).
Verdict: **met**. Tests: `packages/daemon/tests/pattern-routes.test.ts` (`POST /patterns/:id/detach`, `POST /patterns/:id/merge` — including cross-dimension rejection and orphaned-rule cleanup), `packages/daemon/tests/pattern-store.test.ts` (`detachSighting`, `merge`).

### Stats substrate

**REQ-LPC-7** — Every entry's metrics persisted as a snapshot at submission time, human-readable, one per entry.
Implementation: `createOnEntryCreated` (`packages/daemon/src/index.ts:227-269`) computes metrics once, saves via `snapshotStore.save` before calling `observe()`, with a comment noting the ordering is deliberate (durable even if the LLM call fails).
Verdict: **met**. Tests: `packages/daemon/tests/snapshot-store.test.ts`, `packages/daemon/tests/entry-snapshot-wiring.test.ts` ("saves a snapshot before the Observer runs", "a snapshot-save failure surfaces as observeError without failing entry creation").

**REQ-LPC-8** — All cross-entry numeric claims trace to deterministic computation over snapshots/sightings, never LLM-generated.
Implementation: `packages/daemon/src/substrate.ts` is pure (no store/LLM access, NaN-guarded); `curation.ts`'s `buildDossier`/`computeResurfacedRules` and `promotion.ts`'s `proposalFor` source all numbers from it or from denormalized pattern counters; `RawObservationSchema` gives the LLM no structured numeric field to populate at all.
Verdict: **met**. One caveat carried forward from the spec itself: the LLM's free-text `pattern` description isn't stripped of narrated numbers in prose, but the spec explicitly treats that as acceptable and names REQ-LPC-8 as the authoritative guarantee for displayed numbers, which holds. Tests: `packages/daemon/tests/substrate.test.ts` (determinism + no-NaN sweep).

**REQ-LPC-9** — Snapshots include function-word frequencies and punctuation habits alongside existing metrics; both content- and function-word frequencies kept.
Implementation: `analyzeFunctionWordFrequency` (`packages/daemon/src/metrics/word-frequency.ts:225-239`, exact inverse of `STOP_WORDS`); new `packages/daemon/src/metrics/punctuation.ts` (8 per-1,000-word rates); wired in `metrics/index.ts:26-39`; schema in `packages/shared/src/metrics.ts`.
Verdict: **met**. Tests: `packages/daemon/tests/metrics/word-frequency.test.ts`, `packages/daemon/tests/metrics/punctuation.test.ts`, `packages/daemon/tests/metrics/pipeline.test.ts`, `packages/shared/tests/metrics.test.ts`.

### Observer changes

**REQ-LPC-10** — Observer prompt includes substrate trends + sighting counts for ledger patterns; system prompt instructs citing supplied numbers, never estimating.
Implementation: `formatLedger` (`observer.ts:257-273`) renders trend/count per pattern; system prompt section "Numbers are supplied, never estimated" (`observer.ts:318`).
Verdict: **met** (prompt-content level, which is exactly what the spec calls testable here). Tests: `observer.test.ts` ("instructs the model to cite supplied numbers, never estimate", `Pattern Ledger block`).

**REQ-LPC-11** — Observations appear immediately after submission, presented as unconfirmed sightings until confirmation thresholds are crossed.
Implementation: daemon side is solid — `routes/entries.ts:30-80` returns observations synchronously in the creation response, and `journal-editor.tsx` also streams them via SSE. The "presented as unconfirmed" UI half was **not found**: a repo-wide grep for "unconfirmed" returns zero hits; the entry detail page and the journal editor's live stream show dimension + pattern text with no confirmation-state framing; the only place pattern status appears at all is the separate pattern dossier page, as raw text ("Status: candidate"), not framed as "unconfirmed" and not part of the immediate post-submission surface.
Verdict: **partially met**. No test or code comment anywhere references REQ-LPC-11 by ID — this looks overlooked rather than deliberately deferred.

**REQ-LPC-12** — Dossiers show sighting count, distinct-entry count, per-sighting evidence with entry context (REQ-V1-17), substrate trend where computable; intentionality asked of the pattern as a whole.
Implementation: `DossierSchema` (`patterns.ts:183-193`); `buildDossier` (`curation.ts:132-190`); classify acts on pattern ID (`routes/patterns.ts:247-292`), not an observation.
Verdict: **met**. Tests: `packages/daemon/tests/curation.test.ts` (`dossier assembly`), `packages/web/tests/curation-panel.test.tsx`, `patterns-page.test.tsx`.

**REQ-LPC-13** — Classification vocabulary (intentional/accidental/undecided) applied at pattern level; re-classification allowed anytime; contradiction detection compares pattern statements.
Implementation: `PatternStatusSchema`/`PATTERN_TRANSITIONS` (`patterns.ts:8-32`); sightings carry no status field; `detectContradiction(a: Pattern, b: Pattern)` (`curation.ts:61-77`) uses `OPPOSING_SIGNALS` (38-52) on canonical statements, gated by matching dimension.
Verdict: **met**. Tests: `curation.test.ts` (`detectContradiction`, `contradiction detection in session`).

### Promotion probation

**REQ-LPC-14** — Propose promotion only when: intentional, ≥3 sightings, ≥3 distinct entries, ≥2,000 supporting words.
Implementation: `proposalFor` (`packages/daemon/src/promotion.ts:41-76`) checks all four gates in sequence, no early exit skips any; thresholds in `config.ts:34-36` (`DEFAULT_CONFIG` = 3/3/2000, matching the spec exactly, configurable).
Verdict: **met**. Tests: `packages/daemon/tests/promotion.test.ts` (four isolated gate `describe` blocks with exact boundary values, e.g. 1999 vs 2000 words).

**REQ-LPC-15** — A proposal is a suggestion; rule created only on writer acceptance; classifying intentional alone must not create a rule.
Implementation: classify handler only creates a rule when `parsed.data.promote === true` (`routes/patterns.ts:282`); the old classify-writes-a-rule path is confirmed gone from `profile-store.ts` (compared against `git show HEAD:...`, which still had `patternsMatch`/`transformToStablePattern`).
Verdict: **met**, but flagged: there is no direct regression test asserting "classify intentional without promote creates zero rules" — `curation-integration.test.ts:120-127` classifies without `promote` but never asserts the rule list stays empty afterward. The guarantee is correct by code reading, not proven by an explicit negative-case test.

**REQ-LPC-16** — Writer can promote any intentional pattern anytime regardless of thresholds; writer-promoted → `writer-asserted`, proposal-accepted → `evidence-confirmed`.
Implementation: `POST /patterns/:id/promote` (`routes/patterns.ts:294-322`) has no threshold check, sets `writer-asserted`; proposal-accept path (365) re-checks `proposalFor` and sets `evidence-confirmed`.
Verdict: **met**. Tests: `pattern-routes.test.ts` (classify+promote below thresholds, proposal accept at threshold, decline creates no rule), `profile-integration.test.ts`.

**REQ-LPC-17** — Rule text derives from the pattern's canonical statement; `transformToStablePattern` removed.
Implementation: `addOrMergeRule` (`profile-store.ts:332-395`) stores `pattern` text verbatim; merge identity is now `patternId` equality, not word-overlap. A repo-wide grep for `transformToStablePattern`/`patternsMatch` finds zero live definitions or call sites (only historical presence confirmed via `git show HEAD`).
Verdict: **met**. Tests: `profile-store.test.ts` ("creates a new rule using the pattern text as-is (no regex transform)").

**REQ-LPC-18** — Every rule links to its pattern ID; dossier reachable from the rule; migrated rules carry an explicit "migrated, no historical sightings" state.
Implementation: `ProfileRuleSchema.patternId` (`packages/shared/src/profile.ts:35`); web reachability via `profile-editor.tsx:221,260-264` → `/patterns/{id}` dossier page; `Pattern.migratedNoHistory` (`patterns.ts:109`) rendered explicitly in `patterns/[id]/page.tsx` and `curation-panel.tsx:224`.
Verdict: **met**. Minor observation: `ProfileStore.getRuleByPatternId` exists but is dead code — no route or client calls it (reachability is achieved via the forward link instead, which is sufficient). Tests: `migration.test.ts`, `packages/web/tests/profile-editor.test.tsx`.

### Rule health

**REQ-LPC-19** — Rules carry support metadata: total sightings, distinct entries, last-supported date, and (computable) a substrate support measure.
Implementation: `sourceCount` derives from `pattern.entryIds.length`; sighting count/substrate trend shown on the dossier page; `ProfileRule.lastSupportedAt` (`profile.ts:44`) written by `reaffirmRule` (`profile-store.ts:397-408`) and by migration.
Verdict: **partially met — a real gap, not cosmetic.** `lastSupportedAt` is write-only: `computeResurfacedRules` (`curation.ts:222-297`) never reads it, and no web UI surface displays it (`grep -rn "lastSupportedAt" packages/web/**/*.tsx` returns nothing). It exists in the schema and file format but has no downstream effect and is invisible to the writer.

**REQ-LPC-20** — A rule unsupported for the configured window (10 entries) resurfaces for reaffirm-or-retire; nothing ever auto-retires.
Implementation: `isStale` (`substrate.ts:160-166`), consumed by `computeResurfacedRules`; never-auto-retire confirmed by tracing every write path — retirement only happens from the writer-initiated `/retire`/`/dismiss` routes.
Verdict: **partially met — same underlying defect as REQ-LPC-19.** The never-auto-retire half is solid and tested (`pattern-routes.test.ts` "nothing auto-mutates: repeated session assembly never changes the stale rule or retires the pattern"). But the "reaffirm" half of "reaffirm-or-retire" does not functionally close the loop: reaffirming a stale rule sets `lastSupportedAt`, but staleness is computed purely from `pattern.entryIds` vs. the recent-snapshot window and never consults `lastSupportedAt` — so a reaffirmed rule resurfaces again at the very next session unless a fresh sighting happens to land in the meantime. This directly contradicts inline doc comments (`shared/src/patterns.ts:334`, `routes/patterns.ts:550-551`) that assert reaffirm "clears" the resurfacing. No test exercises "reaffirm, then re-check the session," which is why this wasn't caught.

**REQ-LPC-21** — Computable-pattern drift: rolling 5-entry mean deviates from baseline by ≥ configured margin (default 50%); resurfaces the rule same as staleness.
Implementation: `detectDrift` (`substrate.ts:132-149`); wired in `computeResurfacedRules` (272-284), independently or jointly with staleness.
Verdict: **met**. Tests: `curation.test.ts` (exactly-at-margin vs. just-past-margin, both-fire-at-once cases).

**REQ-LPC-22** — Retiring is writer-only; retiring a rule removes it and retires the linked pattern; retiring a ruleless pattern just sets status; retired patterns leave the ledger but keep sighting history; reactivate returns to `undecided`.
Implementation: `/retire` route (`routes/patterns.ts:516-545`); `ruleId` cleared on retire (`pattern-store.ts:274-303,298`, a fixed prior bug per plan notes); `observer.ts:236` excludes retired from the ledger; `PATTERN_TRANSITIONS.retired = ["undecided"]`.
Verdict: **met** — the most thoroughly tested requirement in the set (merge/dismiss/retire orphaned-rule cleanup, reactivate-then-repromote regression, invalid-reactivate rejection all separately covered in `pattern-routes.test.ts`/`pattern-store.test.ts`).

### Accidental watch list

**REQ-LPC-23** — Classifying accidental starts a watch: records classification date and, for computable patterns, the pre-classification baseline.
Implementation: `routes/patterns.ts:269-276` computes `rollingMean` for computable patterns, else leaves baseline undefined; `patternStore.setWatch`.
Verdict: **met**, with a test gap: no test classifies a pattern that actually has a `metricLink` as accidental through the route and asserts the resulting `watch.baseline` — only the qualitative (no-`metricLink`, baseline-undefined) branch is exercised anywhere in the suite.

**REQ-LPC-24** — Watch feedback reports deterministic recurrence since disowning; visible during curation.
Implementation: `recurrenceSince` (`substrate.ts:100-113`); `formatRecurrenceText` (`curation.ts:111-117`); surfaced via `GET /patterns/watch` and inside `GET /patterns/session`; rendered in both web and CLI.
Verdict: **met**. Tests: `curation.test.ts`, `packages/web/tests/full-loop.test.ts`, `curation-panel.test.tsx` ("watch list renders recurrence text verbatim from the API, never recomputed client-side").

**REQ-LPC-25** — Asymmetric resolution: computable resolves at 5 consecutive below-baseline entries; qualitative resolves at 10 consecutive no-sighting entries, worded as observation not verdict; resolution touches only watch metadata; affirmatively reported.
Implementation: `watchResolution` (`substrate.ts:195-241`); `resolveWatchesAndEmit` (`routes/patterns.ts:90-123`) only calls `setWatch`, never touches `pattern.status`, and emits `pattern:watch-resolved`. A grep for the word "fixed" across all rendering code returns zero hits.
Verdict: **met**. Tests: `substrate.test.ts` (both branches at window boundaries), `pattern-routes.test.ts` (qualitative resolution end-to-end), `sse-streaming.test.ts` (event emission). Minor gap: the end-to-end route test doesn't separately assert `pattern.status` is untouched at that specific integration point (verified instead by code inspection of `setWatch`'s narrow contract), and the computable branch is unit- but not route-integration-tested.

### Cold start and migration

**REQ-LPC-26** — Below thresholds, the full observe/curate/manual-promote loop still works; only system proposals are gated; UI labels the state honestly.
Implementation: `proposalFor` gates only proposal computation, never dossier assembly or direct promote; web `AccumulatingSection` (`curation-panel.tsx:540-571`, "Evidence still accumulating" + "Promote now anyway"); CLI `printAccumulatingEvidence` (`curate.ts:318-341`) matches.
Verdict: **met**. Tests: `curation-panel.test.tsx` (asserts the honest copy is present AND that no dishonest "not intentional enough" phrasing appears), `pattern-routes.test.ts`.

**REQ-LPC-27** — Existing rules migrate `writer-asserted`, text unchanged; each gets an `intentional` pattern with "migrated, no historical sightings"; staleness clock starts at migration, not original rule creation date.
Implementation: `migrateProfile` (`migration.ts:286-315`) calls `patternStore.create(...)`, whose `NewPatternInput` has no `createdAt` override — the new pattern's `createdAt` is structurally always the migration timestamp, not the rule's original date. Grace period logic keys off this in `computeResurfacedRules` (`curation.ts:250-268`).
Verdict: **met** — correct by construction. Flagged gap: no single test runs `migration.ts` end-to-end and then feeds the resulting pattern into `computeResurfacedRules` to prove the seam; each half is well-tested in isolation (`migration.test.ts`, `curation.test.ts`) but the connection between them is untested, even though the code has no path that could break it.

### Surface and contract changes

**REQ-LPC-28** — Pattern-grain curation API (session/classify/detach/proposal/promote/retire/reactivate/watch); old observation-level classify endpoint and its rule-writing side effect removed, not deprecated.
Implementation: full route set in `routes/patterns.ts`; `routes/observations.ts` is read-only, with an explicit comment documenting the removal; the corresponding web proxy routes (`app/api/observations/[id]/route.ts`, `.../pending/route.ts`) are deleted per `git status`.
Verdict: **met**. Tests: `observation-routes.test.ts` has explicit regression `describe` blocks ("PATCH /observations/:id (removed, REQ-LPC-28)", "GET /observations/pending (removed...)").

**REQ-LPC-29** — SSE contract versioned: pattern IDs on `observation:created`; new discovery/proposal/watch-resolved events; web and CLI clients updated to actually handle them.
Implementation: `packages/shared/src/events.ts` defines all four event schemas; `routes/events.ts` forwards all four topics; `lib/api.ts`'s `subscribeObservations` exposes handlers for all four.
Verdict: **partially met.** The daemon-side contract and plumbing are complete and tested (`sse-streaming.test.ts`). But client wiring doesn't follow through: `journal-editor.tsx` — the only caller of `subscribeObservations` — passes only `onObservation`; `onPatternDiscovered`/`onPatternProposal`/`onPatternWatchResolved` have zero call sites anywhere in `packages/web` outside the interface definition itself (confirmed by repo-wide grep). The web client silently ignores the three new event types at runtime; the capability exists in the API client library but nothing consumes it. The CLI has no SSE consumer at all (it polls `GET /patterns/session` instead) — not a regression since it never consumed SSE before, but it means the requirement's claim that clients are "updated to handle these new event types" is not true for the CLI (zero events handled, old or new) and only trivially true for web (types exist, nothing wired).

**REQ-LPC-30** — Per-observation `status` field and its transition table removed from the schema; classification is pattern-level only; legacy observations migrate their status onto a newly-created pattern.
Implementation: `ObservationSchema` (`observations.ts:23-39`) has no `status` field; repo-wide grep for `VALID_TRANSITIONS|isValidTransition|ClassifyObservationRequestSchema|transformToStablePattern` finds matches only in stale `dist/` build output and comments documenting the removal — never a live export/import in any `src/` file. `migrateLegacyObservations` (`migration.ts:323-395`) maps old status values onto new pattern status via `LEGACY_STATUS_MAP`.
Verdict: **met**. Tests: `observations.test.ts` ("no status field, REQ-LPC-30"), `observation-routes.test.ts`, `migration.test.ts` (all four legacy status values).

---

## Success Criteria and AI Validation

All 12 Success Criteria items and all in-scope AI Validation items are either test-verified or code-inspection-verified. No item was found completely unverified. Two items are explicitly deferred per this audit's scope (real-LLM spot-check, real-traffic cost check).

### Success Criteria

1. **Submitted entries produce sightings (extend existing / create candidate)** — test-verified. `observer.test.ts` ("observe (pipeline)": discovery path and match path).
2. **A repeated habit accumulates in one dossier with all evidence** — test-verified. `pattern-store.test.ts` (`recordSighting`), `curation.test.ts` (`dossier assembly`).
3. **A mis-merged sighting can be detached into its own candidate** — test-verified. `pattern-routes.test.ts` (`POST /patterns/:id/detach`).
4. **No promotion proposed below thresholds or without intentional classification; proposed at/above; rule only on writer acceptance** — test-verified. `promotion.test.ts`, `pattern-routes.test.ts` (proposal accept/decline).
5. **Writer can classify-and-promote in one action, marked writer-asserted** — test-verified. `pattern-routes.test.ts` (REQ-LPC-16 test).
6. **Every post-migration rule shows its dossier; migrated rules show migrated/no-history state** — test-verified for daemon and CLI (`migration.test.ts`, `packages/cli/tests/profile.test.ts`); code-inspection-verified (not directly test-covered) for the web pattern-dossier page's rendering of this specific state — low risk, straightforward conditional.
7. **A rule unsupported for the window resurfaces for reaffirm-or-retire; nothing auto-deleted** — test-verified, including a negative-mutation test. `curation.test.ts`, `pattern-routes.test.ts`. Note: see REQ-LPC-20 above — the "reaffirm" side of this loop does not actually clear the resurfacing, which undercuts this criterion's letter even though "nothing auto-deleted" holds.
8. **A computable rule whose metric drifts past the margin resurfaces, distinctly from staleness** — test-verified. `curation.test.ts` (drift-exactly-at-margin vs. just-past, both-at-once).
9. **Marking accidental starts watch tracking; recurrence/resolution reported deterministically; qualitative resolution worded as observation not verdict** — test-verified, with the same minor caveat as REQ-LPC-25 (metadata-only mutation confirmed by code inspection at one specific integration point rather than by a direct assertion there).
10. **All numeric cross-entry claims trace to snapshots/sighting counts, reproducible without an LLM** — test-verified. `substrate.test.ts` (determinism, no-NaN sweep).
11. **Pre-existing rules survive migration unchanged in text, marked writer-asserted** — test-verified. `migration.test.ts`.
12. **Entries, patterns, sightings, snapshots, and profile remain human-readable files** — code-inspection-verified and indirectly test-verified via round-trip tests (`snapshot-store.test.ts` explicitly checks output is genuine YAML, not JSON-in-a-.yaml-file).

### AI Validation

- **Defaults (90%+ coverage on new code; fresh-context sub-agent review; no `mock.module()`)** — see Coverage check section below for the numeric verdict. Fresh-context review process-verified: `.lore/work/notes/longitudinal-pattern-confirmation.md` documents review passes at the P3 risk gate, P4-P5 gate, and P6, each with specific named bugs found and fixed (merge counter-zeroing, `ruleId` retire-clearing, `isStale` grace-period date comparison). No `mock.module()` usage found in any inspected test file.
- **Substrate determinism** — test-verified. `substrate.test.ts` covers empty corpus, single entry, all-identical entries for every function.
- **Ledger integrity** — test-verified. `observer.test.ts` (unknown-ID rejection, no-patternRef rejection, end-to-end rejection through `observe()`).
- **Promotion gate** — test-verified. `promotion.test.ts`, boundary values on all four gates.
- **Rule health** — test-verified for the staleness/drift boundary math itself; see REQ-LPC-19/20 above for the reaffirm-doesn't-clear-resurfacing gap this doesn't catch.
- **Watch loop** — test-verified for both pattern kinds at `substrate.ts` level; qualitative resolution additionally route-integration-tested; computable resolution is not separately route-integration-tested (unit-tested only) — a minor asymmetry.
- **Prompt contract** — test-verified. `observer.test.ts` (`Pattern Ledger block`, end-to-end through `observe()`).
- **Migration** — test-verified, the most heavily fixture-tested file in the diff (round-trip, idempotency, backup-before-write, all four legacy status mappings, filename-collision handling).
- **Identity-match quality manual spot-check** — deferred, out of scope for this audit per instructions (requires a real LLM call). Not attempted.
- **Cost check with real prompt traffic** — deferred, out of scope for this audit per instructions (requires real model traffic). Not attempted. Noted for the record: `observer.test.ts` contains a heuristic proxy ("Observer prompt cost budget (worst-case ledger)") asserting a full 50-pattern all-computable ledger prompt stays under a documented token estimate — this is a mocked-cost stand-in, not the real-traffic check the plan calls for at Phase 7 step 4.

---

## Coverage check

Command run (matches `package.json`'s `test` script with `--coverage` added): `bun test --coverage packages/shared packages/daemon/tests packages/cli/tests packages/web/tests`.

Result: **1116 pass, 0 fail, 2638 expect() calls** across 70 files. **Overall: 92.96% functions / 93.11% lines** — this clears the 90%+ bar in aggregate, but several individual new/heavily-modified files fall below it and are named below rather than hidden behind the aggregate number.

### New files below 90%

| File | % Funcs | % Lines | Note |
|---|---|---|---|
| `packages/daemon/src/migration.ts` | 76.92 | 97.14 | Lines mostly fine; a few uncovered function branches (180, 204-205, 348-350) |
| `packages/daemon/src/snapshot-store.ts` | 80.00 | 98.08 | Lines fine; one uncovered function |
| `packages/web/app/api/patterns/session/route.ts` | 100.00 | 77.78 | Error-path lines (9-10) uncovered |
| `packages/web/app/api/patterns/[id]/route.ts` | 100.00 | 84.62 | Error-path lines (13-14) uncovered |
| `packages/web/app/api/patterns/[id]/classify/route.ts` | 100.00 | 85.71 | Error-path lines (14-15) uncovered |
| `packages/web/app/patterns/[id]/page.tsx` | 100.00 | 84.06 | Lines 24, 65, 70-78 uncovered |

### New files with ZERO test coverage (not merely below 90% — not exercised by any test at all)

Bun's coverage tool only reports files actually loaded during the test run; the following new proxy route files never appear in the coverage table at all, confirming no test imports them:

- `packages/web/app/api/patterns/[id]/detach/route.ts`
- `packages/web/app/api/patterns/[id]/dismiss/route.ts`
- `packages/web/app/api/patterns/[id]/merge/route.ts`
- `packages/web/app/api/patterns/[id]/promote/route.ts`
- `packages/web/app/api/patterns/[id]/proposal/route.ts`
- `packages/web/app/api/patterns/[id]/reactivate/route.ts`
- `packages/web/app/api/patterns/[id]/reaffirm/route.ts`
- `packages/web/app/api/patterns/[id]/retire/route.ts`
- `packages/web/app/api/patterns/route.ts` (list)
- `packages/web/app/api/patterns/watch/route.ts`

Verified by reading `detach/route.ts` and comparing against the tested `classify/route.ts`: both are structurally identical 17-line thin proxies (`daemonFetch` call + try/catch → 502). So the risk these ten files carry individually is low (they're boilerplate, not novel logic), but as a class they are genuinely untested, not just under-tested. `packages/web/tests/patterns-proxy-routes.test.ts` — the file that exists specifically to cover this surface — only imports `session/route`, `[id]/route`, and `[id]/classify/route`; it does not touch the other ten.

### Heavily modified files below 90% (pre-existing files touched substantially by this plan)

| File | % Funcs | % Lines | Note |
|---|---|---|---|
| `packages/web/components/profile-editor.tsx` | 58.33 | 66.96 | Rewritten in Phase 6 for provenance/health/dossier-link rendering; large uncovered blocks (83-178 in ranges) |
| `packages/web/lib/api.ts` | 56.52 | 58.82 | Pattern-grain client calls added in Phase 6; substantial uncovered ranges including most of the new `subscribeObservations` SSE handler wiring (223-257) — consistent with the REQ-LPC-29 finding that three of the four new SSE handler types are never actually invoked anywhere, including in tests |
| `packages/daemon/src/index.ts` | 46.67 | 28.07 | DI wiring for the new stores/routes; largely gated behind `import.meta.main` bootstrap code, but this file was substantially rewritten (310 lines changed) to wire pattern-store/promotion/migration — worth a second look even though bootstrap code is traditionally lower-priority for unit coverage |
| `packages/cli/src/write.ts` | 66.67 | 81.13 | Smaller file, modest gap |
| `packages/cli/src/profile.ts` | 88.89 | 82.52 | Close to the bar |
| `packages/web/lib/daemon.ts` | 91.67 | 74.42 | Funcs clear the bar; line coverage lags |

### Files at or near 100% (for contrast — most new core logic is fully covered)

`config.ts`, `curation.ts`, `metrics/punctuation.ts`, `pattern-store.ts` (99.59% lines), `profile-store.ts`, `promotion.ts`, `routes/patterns.ts` (96.99% lines), `substrate.ts`, `shared/src/events.ts`, `shared/src/patterns.ts` — all 100% functions, ≥97% lines. The core pattern-ledger/substrate/promotion logic that the plan called "the risk phase" is the best-covered part of the diff; the coverage shortfall is concentrated in web-layer proxy/wiring code and daemon bootstrap wiring, not in the risky domain logic.
