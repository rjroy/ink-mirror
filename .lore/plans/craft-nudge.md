---
title: "Plan: Craft Nudge"
date: 2026-03-27
status: executed 
tags: [plan, craft-nudge, review, craft-knowledge]
modules: [daemon, shared]
related:
  - .lore/specs/craft-nudge.md
  - .lore/plans/observer-prompt-quality.md
  - .lore/research/good-writing-principles.md
---

# Plan: Craft Nudge

## Spec Reference

**Spec**: `.lore/specs/craft-nudge.md`

Requirements addressed:
- REQ-CN-1: Explicit trigger only, never automatic -> Step 3 (route design)
- REQ-CN-2: No profile/history required -> Step 2 (prompt), Step 3 (route)
- REQ-CN-3: Accept entryId or text, at least one required -> Step 3 (route input handling)
- REQ-CN-4: Passive voice clustering with per-sentence evidence -> Step 2 (user message)
- REQ-CN-5: Sentence rhythm monotony -> Step 2 (prompt principles)
- REQ-CN-6: Hedging accumulation -> Step 2 (prompt principles)
- REQ-CN-7: Nominalization density (LLM-directed, no metrics) -> Step 2 (prompt principles)
- REQ-CN-8 through REQ-CN-15: Tier 2 and Tier 3 principles -> Step 2 (prompt principles)
- REQ-CN-16: Nudge output shape (4 fields) -> Step 1 (schema)
- REQ-CN-17: Question offers legitimate reading -> Step 2 (prompt constraints)
- REQ-CN-18: No corrections/rewrites/suggestions -> Step 2 (prompt constraints)
- REQ-CN-19: Observation context vs. lesson boundary -> Step 2 (prompt constraints)
- REQ-CN-20: 3-5 nudges, distinct across principles -> Step 2 (prompt), Step 1 (schema)
- REQ-CN-21: Selection priority (metrically strong first) -> Step 2 (prompt)
- REQ-CN-22: Short text produces fewer nudges -> Step 2 (prompt), Step 1 (schema)
- REQ-CN-23: POST /nudge endpoint -> Step 3 (route)
- REQ-CN-24: Request schema -> Step 1 (shared schema)
- REQ-CN-25: Response schema with metrics summary -> Step 1 (shared schema)
- REQ-CN-26: Route factory pattern with DI -> Step 3 (route)
- REQ-CN-27: Help tree operation -> Step 3 (route operations)
- REQ-CN-28: Profile calibration (optional) -> Step 2 (prompt), Step 3 (deps)
- REQ-CN-29: Works without profile -> Step 2 (prompt), Step 3 (route)
- REQ-CN-30: Separate prompt from Observer -> Step 2 (new file)
- REQ-CN-31: System prompt structure (6 sections) -> Step 2 (prompt)
- REQ-CN-32: Compressed craft knowledge from research -> Step 2 (prompt)
- REQ-CN-33: Text at end of message (U-shaped attention) -> Step 2 (user message)
- REQ-CN-34: JSON parse with graceful failure -> Step 2 (nudger output parsing)
- REQ-CN-35: Under $0.02 per request on Sonnet -> Step 2 (prompt budget check)
- REQ-CN-36: Schemas in shared package -> Step 1
- REQ-CN-37: Craft principle identifiers -> Step 1 (union type)

## Codebase Context

### Route Factory Pattern

Every route file exports a factory: `createXRoutes(deps): RouteModule`. The `RouteModule` interface (`daemon/src/types.ts:8-11`) bundles a Hono app fragment with an `operations` array. The daemon's `index.ts:92-94` mounts all route modules via `createApp()` and the operations feed the help tree for CLI discovery.

Reference route: `routes/entries.ts:26-149`. The `EntriesDeps` interface defines injectable dependencies. The factory creates a Hono app, defines handlers, and returns `{ routes, operations }`. Each operation has a `hierarchy` field (`{ root, feature }`) that positions it in the help tree.

### Observer Pipeline (Parallel, Not Upstream)

The Observer at `observer.ts:42-101` shows the flow: compute metrics, read optional profile, build system + user messages, call session runner, parse output, validate, store. The nudge follows the same flow minus storage (nudges are ephemeral per spec).

Key difference: the Observer's `buildSystemPrompt()` (`observer.ts:105-164`) is about pattern observation against the writer's own baseline. The nudge's system prompt is about craft principles against collective wisdom. They share no prompt text, but the architectural pattern (system prompt builder + user message builder + JSON output parsing) is identical.

The Observer's `buildUserMessage()` (`observer.ts:167-195`) assembles sections separated by horizontal rules, with the current entry last (U-shaped attention, REQ-V1-15). The nudge user message follows the same layout principle.

### Metrics Pipeline

`metrics/index.ts:19-30` exports `computeEntryMetrics(text)`, which returns `EntryMetrics` containing `sentences`, `rhythm`, `wordFrequency`, and `sentenceStructure`. The nudge uses this same function for its quantitative scaffolding.

The nudge also needs per-sentence passive voice flags (REQ-CN-4). `isPassiveVoice()` is exported from `metrics/sentence-structure.ts:35` and re-exported from `metrics/index.ts:10`. The nudge's user message builder calls this on each sentence from `metrics.sentences` to produce a per-sentence passive/active annotation alongside the aggregate `sentenceStructure.passiveRatio`.

### Session Runner

`session-runner.ts:35-37` defines the `SessionRunner` interface with a single `run(request)` method. Both the Observer and the nudge use it. The nudge route receives it as a dependency, same as the Observer receives it via `ObserverDeps`.

### Shared Schema Patterns

`shared/src/observations.ts` defines Zod schemas for Observer output. The nudge needs an equivalent file for its own output shape. The barrel export at `shared/src/index.ts` re-exports all public types.

### Daemon Wiring

`daemon/src/index.ts:87-94` creates route modules and passes them to `createApp()`. Adding the nudge route follows the same pattern: create deps, call factory, add to the `routeModules` array.

The entry store at `daemon/src/index.ts:24` (`createEntryStore`) is already instantiated. The nudge route's `readEntry` dependency can wrap `entryStore.get()`, matching how the observations route accesses entries at `routes/observations.ts:38-41`.

### Craft Principles Source

`.lore/research/good-writing-principles.md` contains the twelve principles with source backing, observable markers, and legitimacy guidance. The nudge prompt compresses each principle to: name, markers to watch for, when the pattern is a legitimate choice. The full research document stays as authoritative reference; the prompt carries a working summary.

## Implementation Steps

### Step 1: Shared Schemas

**Files**: `packages/shared/src/nudge.ts` (new), `packages/shared/src/index.ts`
**Addresses**: REQ-CN-16, REQ-CN-20, REQ-CN-22, REQ-CN-24, REQ-CN-25, REQ-CN-36, REQ-CN-37

Define the API contract types that both daemon and future clients share.

**CraftPrinciple type**: A union of the twelve string identifiers from REQ-CN-37. Use `z.enum()` consistent with how `ObservationDimensionSchema` is defined in `observations.ts:5-9`.

```
"characters-as-subjects" | "nominalization-density" | "passive-voice-clustering" |
"unnecessary-words" | "concrete-over-abstract" | "sentence-monotony" |
"buried-lead" | "old-before-new" | "hedging-accumulation" |
"unclear-antecedent" | "curse-of-knowledge" | "dangling-modifier"
```

**CraftNudge schema**: Four fields per REQ-CN-16. `craftPrinciple` is the enum above. `evidence`, `observation`, and `question` are non-empty strings.

**NudgeOutput schema**: The LLM output shape, analogous to `ObserverOutputSchema` in `observations.ts:49-54`. An array of `CraftNudge` objects. Min 0 (short texts may produce none, REQ-CN-22), max 5 (REQ-CN-20). Wrapped in `{ nudges: CraftNudge[] }`.

**NudgeRequest schema**: `entryId` (optional string), `text` (optional string), `context` (optional string). Add a Zod refinement that at least one of `entryId` or `text` is present.

**NudgeResponse schema**: `nudges` array plus `metrics` object with four fields from REQ-CN-25: `passiveRatio`, `totalSentences`, `hedgingWordCount`, `rhythmVariance`. Plus optional `error` string for parse failures (REQ-CN-34). Note: `error` is an intentional extension beyond REQ-CN-25's definition. The spec defines the parse failure behavior in REQ-CN-34 but doesn't update the response schema to include the error field. The Observer follows the same pattern (returning errors in-band at `observer.ts:81-84`). The Step 5 validator should treat this as spec-aligned, not scope creep.

Add barrel exports from `shared/src/index.ts` following the existing pattern.

**Test**: Schema validation tests in `packages/shared/tests/nudge.test.ts`. Verify: valid nudge parses, invalid principle rejected, empty evidence rejected, at least one of entryId/text required.

### Step 2: Nudge Prompt and Core Function

**Files**: `packages/daemon/src/nudger.ts` (new), `packages/daemon/tests/nudger.test.ts` (new)
**Addresses**: REQ-CN-2, REQ-CN-4 through REQ-CN-15, REQ-CN-17 through REQ-CN-22, REQ-CN-28 through REQ-CN-35

This is the load-bearing step. The file structure mirrors `observer.ts`: a deps interface, a core function, prompt builders, and output parsing.

**NudgerDeps interface**:
- `sessionRunner: SessionRunner`
- `computeMetrics: (text: string) => EntryMetrics`
- `readStyleProfile?: () => Promise<string>` (optional, same pattern as `ObserverDeps.readStyleProfile` at `observer.ts:26`)

**`nudge(deps, text, context?)` function**: The orchestration entry point, analogous to `observe()` at `observer.ts:42`. Flow:
1. Compute metrics via `deps.computeMetrics(text)`
2. Read optional style profile
3. Build system prompt via `buildNudgeSystemPrompt()`
4. Build user message via `buildNudgeUserMessage(text, metrics, styleProfile, context)`
5. Call `deps.sessionRunner.run()`
6. Parse and validate output via `parseNudgeOutput()`
7. Return `{ nudges, metrics: { passiveRatio, totalSentences, hedgingWordCount, rhythmVariance } }`

**`buildNudgeSystemPrompt()` function**: The craft knowledge prompt. Six sections per REQ-CN-31:

Six sections, matching the REQ-CN-31 enumeration:

1. **Preamble** (REQ-CN-17, REQ-CN-18, REQ-CN-19): Role definition. "You surface craft patterns as questions. You never answer the questions. You never correct, rewrite, or suggest alternatives. Every question offers at least one reading where the pattern is a legitimate choice."

2. **Craft Knowledge** (REQ-CN-32): Twelve principles compressed from `.lore/research/good-writing-principles.md`. Each principle entry contains:
   - Machine-readable ID (matches `CraftPrinciple` enum)
   - What the pattern is (one sentence)
   - Observable markers (what to look for)
   - Legitimate use (when the pattern is intentional, not a mistake)

   Compression target: ~120-150 tokens per principle, ~1,500-1,800 tokens total for the craft knowledge section. This keeps the full system prompt under 2,500 tokens, leaving headroom for the ~3,000 token budget in REQ-CN-35.

   Organize by detection tier (Tier 1 first, then 2, then 3) so the LLM naturally prioritizes metrically-backed signals per REQ-CN-21.

3. **Output format** (REQ-CN-16): JSON schema with example, matching the `CraftNudge` shape. Include one worked example showing all four fields for a passive voice clustering nudge.

4. **Question constraints** (REQ-CN-17, REQ-CN-18): Explicit prohibitions. No imperative verbs directed at the writer. No "consider," "try," "change," "rewrite." Every question is open-ended.

5. **Pre-computed metrics** (REQ-CN-31 item 5): Described in the user message, but the system prompt tells the LLM what to expect. Include a "Context You Receive" section (same pattern as the Observer's at `observer.ts:133-140`) describing: pre-computed metrics as quantitative evidence, optional style profile for calibration, optional writer's context, and the text to analyze (always last).

6. **Selection rules** (REQ-CN-20, REQ-CN-21, REQ-CN-22): 3-5 nudges. Distinct principles (no two from the same ID). Metrically-backed signals take priority. Short texts may produce fewer.

**`buildNudgeUserMessage()` function**: Assembles sections with `---` separators, text last (REQ-CN-33). Sections in order:

1. **Pre-computed metrics**: Write `formatNudgeMetrics()` directly in `nudger.ts`. The formatting logic is similar to the Observer's `formatMetrics()` at `observer.ts:197-256` but independent (see Open Question 1 for rationale). Add a per-sentence passive voice annotation: for each sentence in `metrics.sentences`, call `isPassiveVoice(sentence.text)` and annotate sentences where it returns true. This gives the LLM per-sentence evidence for passive voice clustering (REQ-CN-4) beyond the aggregate `passiveRatio`.

2. **Style profile** (when present, REQ-CN-28): "Writer's confirmed style patterns. Use for calibration, not detection."

3. **Writer's context** (when provided, REQ-CN-24 `context` field): "The writer describes this text as: [context]"

4. **The text to analyze** (always last, highest attention position).

**`parseNudgeOutput()` function**: Strip markdown fences, JSON.parse, validate against `NudgeOutputSchema`. On failure, return `{ nudges: [], error: description }` per REQ-CN-34. Same pattern as `parseObserverOutput()` at `observer.ts:270-293`.

**Metrics formatting**: Write `formatNudgeMetrics()` independently in `nudger.ts`. The Observer's `formatMetrics()` at `observer.ts:197-256` produces similar output, but the two formatters serve different prompt pipelines and shouldn't be coupled. The nudge formatter adds per-sentence passive annotations and may diverge further as the prompt iterates. See Open Question 1 for the full rationale.

**Tests** (`packages/daemon/tests/nudger.test.ts`):

- `buildNudgeSystemPrompt()`: Verify all twelve principle IDs appear. Verify the non-prescription constraints appear ("never correct," "never rewrite," etc.). Verify output format section includes JSON structure. These are string-contains checks, not exact match.
- `buildNudgeUserMessage()`: Verify section ordering (metrics before profile before context before text). Verify text is last. Verify per-sentence passive annotations appear when passive sentences exist. Verify profile section absent when no profile provided. Verify context section absent when no context provided.
- `parseNudgeOutput()`: Valid JSON parses correctly. Malformed JSON returns error. Valid JSON with invalid `craftPrinciple` value rejected. Empty nudges array accepted (short text case).
- `nudge()` with mocked session runner: Verify metrics are computed and passed to prompt. Verify LLM is called once. Verify response metrics summary is correctly derived from `EntryMetrics`.
- Token budget sanity check: `buildNudgeSystemPrompt()` output stays under 2,500 tokens (approximate by character count / 4). This isn't a hard test, just a regression check against prompt bloat.

### Step 3: Nudge Route

**Files**: `packages/daemon/src/routes/nudge.ts` (new), `packages/daemon/tests/routes/nudge.test.ts` (new)
**Addresses**: REQ-CN-1, REQ-CN-2, REQ-CN-3, REQ-CN-23 through REQ-CN-27, REQ-CN-29, REQ-CN-34

**NudgeDeps interface**:
- `nudge: (text: string, context?: string, styleProfile?: string) => Promise<NudgeResult>` (the core function from Step 2, pre-wired with session runner and metrics)
- `readEntry: (id: string) => Promise<string | undefined>` (resolves entryId to text)
- `readStyleProfile?: () => Promise<string>` (optional, for profile calibration)

Wait: the spec at REQ-CN-26 defines the deps as: session runner, computeEntryMetrics, readEntry, and optionally readStyleProfile. The route itself should wire the nudge function, not receive the pre-composed function. This keeps the route testable at the HTTP layer while giving the implementer the option to test the nudge function independently.

**Revised NudgeDeps** (matching REQ-CN-26):
- `sessionRunner: SessionRunner`
- `computeMetrics: (text: string) => EntryMetrics`
- `readEntry: (id: string) => Promise<string | undefined>`
- `readStyleProfile?: () => Promise<string>`

The route handler:

1. Parse request body against `NudgeRequestSchema`.
2. Resolve text: if `text` is provided, use it. If only `entryId`, call `deps.readEntry(entryId)`. If entry not found, return 404.
3. Read optional style profile if `deps.readStyleProfile` is available.
4. Call `nudge()` (from Step 2) with the resolved deps, text, and optional context.
5. Return the `NudgeResponse` (nudges + metrics summary + optional error).

**Error handling** (REQ-CN-34):
- Request validation failure: 400 with error details.
- Entry not found: 404.
- LLM parse failure: 200 with empty `nudges` array and `error` field (consistent with Observer pattern at `observer.ts:81-84`).
- LLM call failure (transient/fatal): Let the session runner's retry logic handle transient errors. Fatal errors surface as 500.

**Operations registration** (REQ-CN-27):

```typescript
{
  operationId: "nudge.analyze",
  name: "analyze",
  description: "Get craft nudges for a piece of writing",
  invocation: { method: "POST", path: "/nudge" },
  hierarchy: { root: "nudge", feature: "analyze" },
  parameters: [
    { name: "entryId", description: "Entry to nudge (reads text from storage)", required: false, type: "string" },
    { name: "text", description: "Text to analyze directly", required: false, type: "string" },
    { name: "context", description: "Optional context about the text", required: false, type: "string" },
  ],
  idempotent: true,
}
```

**Tests** (`packages/daemon/tests/routes/nudge.test.ts`):

Using Hono's `app.request()` test client (same pattern as existing route tests):

- POST /nudge with `text`: Returns 200 with nudges array and metrics.
- POST /nudge with `entryId`: Resolves entry text, returns nudges.
- POST /nudge with `entryId` not found: Returns 404.
- POST /nudge with neither field: Returns 400.
- POST /nudge with both fields: Uses `text`, ignores entry resolution.
- POST /nudge with `context`: Context appears in LLM call.
- POST /nudge with profile available: Profile included in prompt.
- POST /nudge without profile: Works fine, no profile section in prompt.
- Parse failure from LLM: Returns 200 with empty nudges and error field.
- Operation appears in route module's operations array with correct hierarchy.

### Step 4: Daemon Wiring

**Files**: `packages/daemon/src/index.ts`
**Addresses**: REQ-CN-26 (dependency injection in production)

Add the nudge route to the daemon's startup wiring. Follow the existing pattern at `index.ts:87-94`:

1. Import `createNudgeRoutes` from `./routes/nudge.js`.
2. Create the nudge route module with production dependencies:
   - `sessionRunner`: The existing `sessionRunner` at `index.ts:54`.
   - `computeMetrics`: `computeEntryMetrics` from `./metrics/index.js` (already imported at `index.ts:12`).
   - `readEntry`: Wrap `entryStore.get()` to return the body string, handling the branded ID conversion. Follow the pattern at `routes/observations.ts:38-41`.
   - `readStyleProfile`: `() => profileStore.toPromptMarkdown()`, same as the Observer's dependency at `index.ts:62`.
3. Add the nudge route module to the `routeModules` array.

This is ~10 lines of code. No new dependencies, no new stores, no new infrastructure.

**Test**: The daemon wiring is tested indirectly via integration tests. No unit test needed for the wiring itself (it's pure composition).

### Step 5: Validate Against Spec

Launch a fresh-context sub-agent that reads the spec at `.lore/specs/craft-nudge.md`, reviews all implementation files from Steps 1-4, and verifies every REQ-CN requirement is addressed. This step is not optional.

Additionally, run the non-prescription validation from the spec's AI Validation section:
- Each `craftPrinciple` in test output maps to one of the twelve identifiers (mechanically verifiable via Zod).
- No nudge output contains imperative verbs directed at the writer ("change," "rewrite," "consider using," "try"). Spot-check against test inputs.

Manual spot-check (cannot be automated): Run the nudge against 2-3 hand-written test texts and verify:
1. Each nudge asks a question (open-ended, not rhetorical).
2. Each nudge offers at least one legitimate reading.
3. No nudge prescribes a fix.
4. When metrics warrant it (high passive ratio, low rhythm variance), metrically-grounded nudges appear.

If more than 1 in 3 nudges fails these checks, the prompt needs revision before the feature ships.

## Delegation Guide

**Step 1 (Shared Schemas)**: Dalton. Straightforward Zod schema work. No specialized expertise. Review: Thorne after completion (schema design affects all consumers).

**Step 2 (Nudge Prompt and Core Function)**: Dalton. This is the highest-risk step. The craft knowledge compression from the research document requires careful attention to the boundary between context and lesson (REQ-CN-19). The prompt engineering is iterative. Budget for 1-2 revision cycles after the initial draft.

Review: Thorne after initial implementation. Specifically check:
- Prompt stays under token budget (~2,500 tokens system prompt).
- Non-prescription constraints are mechanically enforceable (no "consider," "try," "change" in prompt output format).
- Craft knowledge compression preserves the "when this is legitimate" guidance for each principle.
- Per-sentence passive annotations don't bloat the user message for long texts.

**Step 3 (Nudge Route)**: Dalton. Standard route factory work following established patterns. Review: Thorne after completion.

**Step 4 (Daemon Wiring)**: Dalton. ~10 lines. Can be done as part of Step 3's commission.

**Step 5 (Validation)**: Thorne (fresh-context spec validation). The validator reads only the spec and the implementation, with no context from the planning or implementation conversations.

**Commission structure**: Steps 1-4 can be a single commission (the total scope is one new shared schema file, one new daemon module, one new route, and a wiring change). Step 5 is a separate review commission.

## Open Questions

### 1. Metrics formatter sharing

The Observer's `formatMetrics()` at `observer.ts:197-256` and the nudge's metrics formatter will produce similar output. Should they share code?

**Position**: No. Keep them independent. The Observer's formatter is tuned for its prompt context (observation of patterns against personal baseline). The nudge's formatter adds per-sentence passive annotations and may diverge further as the nudge prompt iterates. Coupling them means a prompt change in one breaks the other. The duplication is ~60 lines of straightforward string formatting. That's cheaper than a wrong abstraction.

**When this resolves**: Implementation. If the implementer finds the formatters are truly identical except for the passive annotations, they can extract a base formatter at that point. Premature extraction now would be designing for a hypothesis.

### 2. Per-sentence passive annotations for long texts

REQ-CN-4 says the route "may also call `isPassiveVoice()` directly on each sentence." For a 50-sentence entry, that's 50 annotations in the user message. This could push the user message token count higher than expected.

**Position**: Include annotations only for sentences where `isPassiveVoice()` returns true. Annotate the sentence index and the sentence text. Skip active sentences entirely. For a typical entry with 10-15% passive sentences, this adds 5-8 annotations, not 50.

**When this resolves**: Step 2 implementation. If passive-heavy texts push the budget, cap annotations at the first 10 passive sentences.

### 3. Entry ID validation pattern

The entries route at `routes/entries.ts:84` validates IDs with `/^entry-[\w-]+$/`. The nudge route needs the same validation when `entryId` is provided. Should this regex live in shared?

**Position**: Not yet. The regex appears in two places (entries route, observations route at `routes/observations.ts:51`). Adding a third consumer (nudge route) tips toward extraction, but only if the pattern is identical. The nudge route should use the same regex inline for now. If a fourth consumer appears, extract to shared.

**When this resolves**: Step 3 implementation.

### 4. Should Steps 1-4 be one commission or two?

The total scope is modest: one schema file, one core module, one route, and a wiring change. The Observer equivalent (Commission 2B in the v1 plan) was larger because it included the session runner, observation storage, and auto-trigger wiring.

**Position**: One commission for Steps 1-4, a separate commission for Step 5 (review). The implementer can work through the steps sequentially without hand-off overhead.

## Requirement Coverage Matrix

| Requirement | Step |
|------------|------|
| REQ-CN-1 (explicit trigger) | 3 |
| REQ-CN-2 (no profile required) | 2, 3 |
| REQ-CN-3 (entryId or text) | 3 |
| REQ-CN-4 (passive clustering) | 2 |
| REQ-CN-5 (rhythm monotony) | 2 |
| REQ-CN-6 (hedging accumulation) | 2 |
| REQ-CN-7 (nominalization density) | 2 |
| REQ-CN-8 (unnecessary words) | 2 |
| REQ-CN-9 (abstract over concrete) | 2 |
| REQ-CN-10 (buried leads) | 2 |
| REQ-CN-11 (old-before-new) | 2 |
| REQ-CN-12 (unclear antecedents) | 2 |
| REQ-CN-13 (curse of knowledge) | 2 |
| REQ-CN-14 (dangling modifiers) | 2 |
| REQ-CN-15 (characters as subjects) | 2 |
| REQ-CN-16 (nudge output shape) | 1 |
| REQ-CN-17 (legitimate reading) | 2 |
| REQ-CN-18 (no corrections) | 2 |
| REQ-CN-19 (context vs lesson) | 2 |
| REQ-CN-20 (3-5 distinct nudges) | 1, 2 |
| REQ-CN-21 (selection priority) | 2 |
| REQ-CN-22 (short text handling) | 1, 2 |
| REQ-CN-23 (POST /nudge) | 3 |
| REQ-CN-24 (request schema) | 1 |
| REQ-CN-25 (response schema) | 1 |
| REQ-CN-26 (factory pattern + DI) | 3 |
| REQ-CN-27 (help tree operation) | 3 |
| REQ-CN-28 (profile calibration) | 2, 3 |
| REQ-CN-29 (works without profile) | 2, 3 |
| REQ-CN-30 (separate prompt) | 2 |
| REQ-CN-31 (prompt structure) | 2 |
| REQ-CN-32 (compressed craft knowledge) | 2 |
| REQ-CN-33 (text last in message) | 2 |
| REQ-CN-34 (graceful parse failure) | 2, 3 |
| REQ-CN-35 (cost budget) | 2 |
| REQ-CN-36 (schemas in shared) | 1 |
| REQ-CN-37 (principle identifiers) | 1 |
