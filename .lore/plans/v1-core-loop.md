---
title: "Plan: ink-mirror v1 Core Loop"
date: 2026-03-27
status: draft
spec: .lore/specs/v1-core-loop.md
tags: [plan, v1, core-loop, implementation]
---

# Plan: ink-mirror v1 Core Loop

## Overview

Five phases, each independently testable, each producing working functionality. The ordering prioritizes fail-fast: the observation pipeline (Phase 2) is the highest-risk work and comes immediately after the minimum foundation needed to run it.

The project is greenfield. No code exists yet.

**Cross-cutting standard:** 90%+ unit test coverage on new code (from spec AI Validation defaults). Every commission includes tests alongside implementation. Fresh-context code review after each commission.

## Open Question Positions

Four questions from the spec need answers before or during implementation. Here are the positions this plan takes.

### 1. LLM-native vs. pre-computed metrics

**Position: Hybrid.** Pre-compute deterministic metrics (sentence lengths, word frequencies, structural markers). Feed them alongside the raw text in the Observer prompt. The LLM interprets metrics as patterns.

**Why:** Testability without sacrificing observation quality. The metrics pipeline is independently testable with unit tests (deterministic input/output). The Observer prompt can be tested with known metric inputs. Pure LLM-native parsing is simpler to build but impossible to test without running the LLM. The hybrid approach gives us test seams at the boundary between computation and interpretation.

**When this resolves:** Phase 2. The metrics pipeline ships in Commission 2A. The Observer integration in Commission 2B can validate whether the pre-computed metrics improve observation quality compared to raw text alone. If they don't, the pipeline stays (it's cheap) but the prompt can drop the metrics.

### 2. Two vs. three MVP dimensions

**Position: Start with two, add the third after the pipeline proves out.**

Sentence rhythm and word-level habits ship in Phase 2. These are the load-bearing pair from the research: one structural, one lexical, both produce observations from entry one, both generate clear curation questions.

Sentence structure (the third dimension) ships in Phase 5 after the full loop is working. The spec notes that sentence structure "shares analysis infrastructure with rhythm." Phase 2 will reveal whether that's true. If the metrics pipeline already produces the data sentence structure needs (sentence parsing, clause detection), adding it is low-cost. If it requires POS tagging or a separate analysis pass, the marginal cost is higher and worth evaluating against the working system.

**When this resolves:** The two-dimension pipeline ships in Phase 2. The decision to include the third dimension is confirmed or revised at the start of Phase 5, based on what Phase 2 actually built.

### 3. Observation-to-rule transformation format

**Position: Define the format convention as the first deliverable of Phase 4.**

A profile rule has three parts:
- **Pattern description** (stable characteristic, no temporal references): "Uses staccato rhythm for emphasis at paragraph endings"
- **Dimension** (which observation category): sentence-rhythm
- **Source summary** (how many observations confirmed it, without citing specific entries): "Confirmed across 3 entries"

The transformation strips dates and entry-specific references, generalizes the pattern from instance to characteristic, and preserves the dimension tag for the Observer to reference in future observations.

This format needs to satisfy two consumers: the human reader (portable style profile) and the Observer prompt (structured enough to inform future observations). Both are tested in Phase 4.

**When this resolves:** Phase 4, Commission 4A. The format is defined and validated before the profile storage is built.

### 4. Undecided resurfacing scope

**Position: Cap at 3 undecided items per curation session. Most recent first.**

New observations from the current entry appear first. Undecided items from prior sessions fill remaining slots up to 3. If the user has more than 3 undecided items, they see the 3 most recent. A separate "view all undecided" endpoint exists for users who want to clear the backlog, but the default curation session stays focused.

**Why 3:** The spec already limits new observations to 2-3 per entry (REQ-V1-8). A curation session with 2-3 new observations plus 3 resurfaced items is 5-6 items. That's a focused session. More than that becomes a task list, not a reflection exercise.

**When this resolves:** Phase 3, Commission 3A.

---

## Phase 1: Foundation

**Goal:** Working daemon with entry storage, CLI discovery, and the DI/testing infrastructure that every later phase builds on.

**Depends on:** Nothing. This is the starting point.

### Deliverables

**Commission 1A: Project Scaffold**

Monorepo structure (bun workspace) with three packages:

| Package | Stack | Contents |
|---------|-------|----------|
| `daemon` | Hono on Bun, Unix socket | Route factories, DI wiring, operations registry, `/help` endpoints |
| `cli` | Plain bun scripts | Runtime discovery from daemon `/help`, command execution |
| `shared` | Zod schemas, TypeScript types | Shared types, branded IDs, API contracts |

What gets built:
- `Bun.serve()` with Hono on Unix socket (REQ-V1-30)
- Route/service factory pattern with DI (REQ-V1-28)
- `OperationDefinition` type and operations registry
- `/help` endpoint tree for CLI discovery (REQ-V1-29)
- CLI binary that discovers operations from daemon and executes them
- EventBus (simple set-based pub/sub for later SSE use)
- Shared Zod schemas for API contracts
- Branded ID types (`EntryId`, `ObservationId`)

**Commission 1B: Journal Entry Storage**

What gets built:
- Daemon routes: `POST /entries` (create), `GET /entries` (list), `GET /entries/:id` (read)
- Entry storage as markdown files with date-based YAML frontmatter (REQ-V1-2, REQ-V1-26)
- Entries directory configurable via DI (test seam for filesystem)
- CLI command: `ink-mirror write` (opens `$EDITOR`, submits to daemon on save)
- CLI command: `ink-mirror entries` (lists entries)
- CLI command: `ink-mirror entries show <id>` (reads single entry)
- Entry model: free-form markdown body, frontmatter with date, id, optional title (REQ-V1-1)

### Requirements Satisfied

REQ-V1-1 (free-form entries), REQ-V1-2 (markdown with frontmatter), REQ-V1-3 (readable without app), REQ-V1-24 (daemon authority), REQ-V1-25 (CLI first-class), REQ-V1-26 (human-readable files), REQ-V1-28 (DI factories), REQ-V1-29 (CLI discovery), REQ-V1-30 (Hono/Unix socket), REQ-V1-32 (single-user)

### Verification

- Unit tests: route factories with mocked filesystem, operations registry builds correct tree
- Integration tests: daemon starts, CLI discovers operations, entry round-trips (create then read)
- File inspection: created entries are valid markdown readable with any text editor
- CLI discovery: `ink-mirror help` shows available commands from running daemon

---

## Phase 2: Observation Pipeline

**Goal:** Submit an entry, get 2-3 pattern-level observations back automatically. This is the highest-risk phase because it depends on prompt engineering and LLM output quality. It ships early to fail fast.

**Depends on:** Phase 1 (entry storage, DI infrastructure, daemon skeleton)

### Deliverables

**Commission 2A: Metrics Preprocessing**

The deterministic half of the observation pipeline. No LLM calls. All outputs are testable with unit tests.

What gets built:
- Sentence splitter (handles abbreviations, dialogue, markdown formatting)
- Per-sentence metrics: word count, character count
- Entry-level rhythm analysis: length sequence, variance, consecutive-short/long runs, pace changes between sections
- Word frequency analysis: token frequencies, hedging word detection ("just", "actually", "probably", "I think"), intensifier detection, repeated phrase detection
- Metrics output as a structured object (typed, serializable) that the Observer prompt will consume
- All analysis functions are pure: text in, metrics out. No side effects.

**Commission 2B: Observer Integration**

The LLM half. Connects the metrics pipeline to the Claude API through a session runner.

What gets built:
- Session runner: single entry point for all LLM calls (REQ-V1-27). Handles prompt assembly, streaming, error recovery. Callers pass a session description; the runner manages the SDK interaction.
- Observer prompt: system instructions, observation format requirements, the "curation test" constraint (REQ-V1-6), the "2-3 observations" limit (REQ-V1-8), the "no external comparison" rule (REQ-V1-9)
- Tier 1 context assembly: system prompt + style profile (empty at first) + pre-computed metrics + current entry text (REQ-V1-13)
- Prompt layout: current entry at the end for highest attention (REQ-V1-15)
- Observation storage format: one YAML file per observation in an `observations/` directory, named by ID (e.g., `observations/obs-2026-03-27-001.yaml`). Each file contains: pattern name, cited evidence, dimension, entry reference, curation status (pending/intentional/accidental/undecided), timestamps. YAML for queryability by status (Phase 3 needs to filter by curation state). One file per observation rather than a single file because observations accumulate over time and individual updates (status changes during curation) should not require rewriting the entire collection. (REQ-V1-26: inspectable without the app running)
- Auto-trigger: observation runs when an entry is submitted via POST (REQ-V1-4). The create-entry route calls the Observer after storing the entry.
- Two dimensions active: sentence rhythm and word-level habits (REQ-V1-10 partial, REQ-V1-11 partial)
- Observation output validation: each observation must have cited text from the entry (REQ-V1-7) and a named pattern (REQ-V1-5)

### Requirements Satisfied

REQ-V1-4 (auto-trigger), REQ-V1-5 (pattern + evidence + dimension), REQ-V1-6 (curation test grain), REQ-V1-7 (cited text), REQ-V1-8 (2-3 per entry), REQ-V1-9 (no external comparison), REQ-V1-10 (partial: 2 of 3 dimensions), REQ-V1-11 (partial), REQ-V1-13 (Tier 1), REQ-V1-15 (prompt layout), REQ-V1-27 (session runner)

### Risk

**This is the riskiest phase.** The Observer prompt needs to produce observations that pass the curation test (REQ-V1-6) consistently. Prompt engineering is iterative. Budget time for 2-3 prompt revision cycles.

Mitigation: The metrics pipeline (Commission 2A) is risk-free and ships first. Commission 2B can iterate on prompt design with real metrics data. The session runner's test seam (mockable `queryFn`) allows testing prompt structure without API calls. But validating observation quality requires running the actual LLM and spot-checking output against the curation test.

**Acceptance check:** Run the Observer against 5 hand-written test entries. Every observation must:
1. Cite text from the entry and be answerable with "intentional / accidental / undecided" (curation test)
2. Describe a pattern only, never suggest alternative wording, corrections, or rewrites (no-generation constraint from spec)
3. Make no comparisons to external norms or other writers (REQ-V1-9, even though Tier 2 isn't active yet, the prompt must not default to external baselines)

If more than 1 in 5 fails any of these three checks, the prompt needs revision before moving to Phase 3.

### Verification

- Unit tests: metrics pipeline produces correct output for known inputs (sentence lengths, word frequencies, rhythm patterns)
- Unit tests: session runner with mocked queryFn verifies prompt assembly structure
- Unit tests: observation output validation rejects observations missing cited evidence or pattern name
- Integration test: submit entry via API, receive observations (mocked LLM returns known observations)
- Manual validation: Observer output against 5 test entries passes curation test (spot-check, not automatable)

---

## Phase 3: Curation Loop

**Goal:** The user can classify observations and the system tracks curation state. Undecided items resurface. Contradictions surface for resolution.

**Depends on:** Phase 2 (observations exist to curate)

### Deliverables

**Commission 3A: Curation API and CLI**

What gets built:
- Daemon routes: `GET /observations/pending` (pending observations for curation, includes resurfaced undecided items), `PATCH /observations/:id` (classify as intentional/accidental/undecided), `GET /observations` (all observations with filters)
- Curation session assembly: new observations first, then up to 3 most-recent undecided items (REQ-V1-18, open question #4 resolution)
- Each observation response includes the original entry text so the curation interface shows context (REQ-V1-17)
- Contradiction detection: implemented as curation assembly logic, not as an Observer prompt change. When the curation session is assembled, it compares new observations against previously confirmed observations (those with status "intentional"). If a new observation describes a pattern that conflicts with a confirmed one (e.g., "uses short declarative sentences" vs. "uses long compound sentences"), the curation session flags the tension and presents both for the user to resolve (REQ-V1-19). The comparison is structural: same dimension, opposing pattern. No auto-reconciliation. The Observer prompt is not modified in Phase 3; the Observer continues to produce observations without knowledge of prior confirmations (the profile, which provides that knowledge, arrives in Phase 4).
- CLI command: `ink-mirror curate` (presents pending observations one at a time, prompts for classification)
- CLI command: `ink-mirror observations` (lists all observations with status filter)
- Observation state transitions: pending -> intentional/accidental/undecided. Undecided -> intentional/accidental (on re-curation). Accidental observations are retained but excluded from profile generation.

### Requirements Satisfied

REQ-V1-16 (three classification states), REQ-V1-17 (observations with original text), REQ-V1-18 (undecided resurfacing), REQ-V1-19 (contradiction surfacing)

### Verification

- Unit tests: curation session assembly selects correct observations (new + resurfaced, respects cap)
- Unit tests: contradiction detection identifies conflicting patterns
- Unit tests: state transitions are valid (no invalid transitions like accidental -> pending)
- Integration test: create entry, observe, curate via CLI, verify observation state persists
- Integration test: create two entries with contradictory patterns, verify contradiction surfaces during curation

---

## Phase 4: Style Profile

**Goal:** Confirmed observations accumulate into a portable, editable style profile. The Observer uses the profile as context for future observations.

**Depends on:** Phase 3 (curated observations exist to transform into profile entries)

### Deliverables

**Commission 4A: Profile Format and Transformation**

What gets built:
- Profile rule format convention (open question #3 resolution): stable pattern description, dimension tag, source summary
- Observation-to-rule transformation logic: strips temporal references, generalizes from instance to characteristic, merges repeated confirmations of the same pattern into a single rule with updated source count
- Profile storage as a single markdown file with YAML frontmatter and structured sections per dimension (REQ-V1-26)
- Profile generation: when an observation is classified as "intentional," the system checks if an existing profile rule covers the same pattern. If yes, updates the rule's source count. If no, creates a new rule via the transformation.
- Daemon routes: `GET /profile` (read current profile), `PATCH /profile/rules/:id` (edit a rule), `DELETE /profile/rules/:id` (remove a rule), `PUT /profile` (full profile edit for direct markdown editing)
- CLI command: `ink-mirror profile` (display current profile)
- CLI command: `ink-mirror profile edit` (open profile in `$EDITOR`)
- Profile is formatted as AI system prompt material (REQ-V1-23): structured markdown that an LLM can consume as custom instructions
- Tier 2 context activation: when corpus reaches 5+ entries, the Observer includes the last 5 entries in context assembly (REQ-V1-13 Tier 2). Prompt layout places recent entries at the start, current entry at the end (REQ-V1-15).

### Requirements Satisfied

REQ-V1-13 (Tier 2 context), REQ-V1-20 (profile accumulation), REQ-V1-21 (stable characteristics), REQ-V1-22 (profile editable), REQ-V1-23 (portable markdown for AI prompts)

### Verification

- Unit tests: observation-to-rule transformation produces stable characteristics (no dates, no entry-specific references)
- Unit tests: duplicate pattern detection merges correctly
- Unit tests: profile markdown output is valid, structured, and parseable
- Unit tests: Tier 2 context assembly includes last 5 entries when corpus >= 5, omits them when < 5
- Integration test: write 5 entries, observe, curate as intentional, verify profile contains expected rules
- Integration test: edit profile via CLI, verify changes persist and Observer sees updated profile
- Validation: profile markdown is usable as a Claude system prompt (paste into claude.ai, verify it constrains generation toward described patterns)
- Manual spot-check (REQ-V1-9): with 5+ entries in the corpus (Tier 2 active), run the Observer and verify all comparisons reference the writer's own prior entries, never external norms or other writers

---

## Phase 5: Web Client and Third Dimension

**Goal:** The web client proves "clients are views" (REQ-V1-25). The third observation dimension completes the MVP set. The full loop works end-to-end through both interfaces.

**Depends on:** Phase 4 (complete loop exists via CLI and daemon API)

### Deliverables

**Commission 5A: Next.js Web Client**

What gets built:
- Next.js app with App Router (REQ-V1-31)
- Server components for read operations: entry list, entry detail, profile view
- Client components for interactive operations: journal editor (write + submit), curation interface (classify observations with original text visible), profile editor
- SSE connection for streaming observation results (real-time feedback when Observer is running)
- All data flows through daemon API. Web client makes no direct file or LLM calls (REQ-V1-24).
- Navigation between write, curate, and profile views

**Commission 5B: Third Observation Dimension**

Decision gate: Before this commission starts, review what the Phase 2 metrics pipeline actually built. If sentence parsing already produces clause-level data, sentence structure observations are low-cost to add. If clause detection or POS tagging is needed, evaluate the cost against the benefit.

What gets built (assuming the dimension is confirmed):
- Sentence structure metrics: active/passive voice detection, paragraph opener patterns, fragment identification
- Observer prompt update: add sentence structure as third dimension
- Observation storage: new dimension tag
- Completes REQ-V1-10 (all three dimensions) and REQ-V1-11

### Requirements Satisfied

REQ-V1-10 (complete: all three dimensions, pending decision gate), REQ-V1-11 (complete), REQ-V1-12 (excluded dimensions confirmed), REQ-V1-25 (web as equal client), REQ-V1-31 (Next.js)

### Verification

- Unit tests: web API calls match CLI behavior for identical operations
- Integration test: create entry via CLI, view in web. Create entry via web, view in CLI. (REQ-V1-25 proof)
- Integration test: full loop through web: write entry, view observations stream in, curate, verify profile updates
- Integration test: SSE streaming delivers observation events to web client
- Unit tests (if 5B ships): sentence structure metrics produce correct output for known inputs
- Manual validation: web curation interface shows observations alongside original text (REQ-V1-17)

---

## Requirement Coverage Matrix

| Requirement | Phase | Commission |
|------------|-------|------------|
| REQ-V1-1 (free-form entries) | 1 | 1B |
| REQ-V1-2 (markdown with frontmatter) | 1 | 1B |
| REQ-V1-3 (readable without app) | 1 | 1B |
| REQ-V1-4 (auto-trigger observation) | 2 | 2B |
| REQ-V1-5 (pattern + evidence + dimension) | 2 | 2B |
| REQ-V1-6 (curation test grain) | 2 | 2B |
| REQ-V1-7 (cited text evidence) | 2 | 2B |
| REQ-V1-8 (2-3 observations per entry) | 2 | 2B |
| REQ-V1-9 (no external comparison) | 2 | 2B |
| REQ-V1-10 (three dimensions) | 2 + 5 | 2B (two), 5B (third) |
| REQ-V1-11 (single-entry capable) | 2 + 5 | 2B, 5B |
| REQ-V1-12 (excluded dimensions) | 5 | 5B (confirmed) |
| REQ-V1-13 (tiered context) | 2 + 4 | 2B (Tier 1), 4A (Tier 2) |
| REQ-V1-14 (Tier 3 deferred) | N/A | Not in scope |
| REQ-V1-15 (prompt layout) | 2 | 2B |
| REQ-V1-16 (three classification states) | 3 | 3A |
| REQ-V1-17 (observations with original text) | 3 | 3A |
| REQ-V1-18 (undecided resurfacing) | 3 | 3A |
| REQ-V1-19 (contradiction surfacing) | 3 | 3A |
| REQ-V1-20 (profile accumulation) | 4 | 4A |
| REQ-V1-21 (stable characteristics) | 4 | 4A |
| REQ-V1-22 (profile editable) | 4 | 4A |
| REQ-V1-23 (portable markdown) | 4 | 4A |
| REQ-V1-24 (daemon authority) | 1 + 5 | 1A, 5A |
| REQ-V1-25 (CLI first-class) | 1 + 5 | 1A/1B, 5A |
| REQ-V1-26 (human-readable files) | 1 + 4 | 1B, 4A |
| REQ-V1-27 (single session runner) | 2 | 2B |
| REQ-V1-28 (DI factories) | 1 | 1A |
| REQ-V1-29 (CLI discovery) | 1 | 1A |
| REQ-V1-30 (Hono/Unix socket) | 1 | 1A |
| REQ-V1-31 (Next.js web) | 5 | 5A |
| REQ-V1-32 (single-user) | 1 | 1A |

## Commission Summary

| Commission | Phase | Description | Risk |
|-----------|-------|-------------|------|
| 1A | 1 | Project scaffold, daemon skeleton, DI, operations registry, CLI discovery | Low |
| 1B | 1 | Journal entry storage, markdown files, CLI write/list/show | Low |
| 2A | 2 | Metrics preprocessing (sentence splitting, word frequency, rhythm analysis) | Low |
| 2B | 2 | Observer integration (session runner, prompt assembly, observation storage) | **High** |
| 3A | 3 | Curation API, CLI, undecided resurfacing, contradiction detection | Medium |
| 4A | 4 | Profile format, observation-to-rule transformation, Tier 2 context | Medium |
| 5A | 5 | Next.js web client (editor, curation, profile views, SSE) | Low |
| 5B | 5 | Third observation dimension (sentence structure), decision-gated | Low |

Eight commissions total. The critical path runs 1A -> 1B -> 2A -> 2B -> 3A -> 4A. Commissions 5A and 5B can run in parallel after 4A completes (5A needs the full API surface; 5B needs the metrics pipeline from 2A).

## Review Strategy

- **After Commission 2B:** Fresh-context review of Observer output quality. This is the make-or-break validation. A reviewer who hasn't seen the prompt engineering process reads 5 observation outputs and applies the curation test independently. If observations fail the test, the prompt needs revision before Phase 3 starts.
- **After Commission 4A:** Review the profile format against the two consumers (human reader, Observer prompt). A reviewer pastes the profile into Claude as a system prompt and verifies it constrains generation.
- **After Commission 5A:** End-to-end review. Write entries via both CLI and web, curate, verify profile, inspect files directly. This covers the full success criteria list from the spec.

## Out of Scope

Per the spec and commission instructions, the following are explicitly excluded:

- Profile versioning beyond "the live profile is always current" (separate spec, research complete)
- Tier 3 semantic retrieval (deferred past v1, REQ-V1-14)
- Deployment, hosting, or infrastructure decisions
- UI/UX design details (the plan names what surfaces exist, not what they look like)
- Observation dimensions beyond the three in REQ-V1-10 (vocabulary register, paragraph structure, tonal markers per REQ-V1-12)
