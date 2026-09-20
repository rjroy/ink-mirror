---
title: Observer JSON prompt-role contract
date: 2026-09-19
status: draft
tags: [observer, json, prompt-roles, pi, reliability]
modules: [daemon, observer, session-runner]
related: []
---

# Observer JSON prompt-role contract

## Problem

The observer currently builds a large `system` string in `packages/daemon/src/observer.ts` and a context-only user message. The system string includes both durable observer behavior and the per-invocation task contract: observation rules, dimensions, pattern-ledger matching instructions, JSON-only instruction, empty-result behavior, and a worked JSON shape. `observe()` sends that system string with one user message to `SessionRunner`.

`productionQueryFn()` in `packages/daemon/src/index.ts` installs `request.system` as Pi's `DefaultResourceLoader.systemPrompt`, then selects the last user-role request message and passes only its content to `session.prompt()`. Consequently, the task-specific JSON contract is carried as system content while the data being processed is carried as user content. This division is the discovered reliability risk: the provider-facing system prompt has no explicit separation between stable policy and a request schema, and the actual prompt operation does not deliver the task/schema alongside the user-owned data.

## Current flow and failure mode

1. `observe()` derives metrics, optional history/profile context, and a pattern ledger.
2. `buildSystemPrompt()` returns role guidance **and** the observer's task/output schema; `buildUserMessage()` returns recent entries, profile, ledger, metrics, and current entry.
3. `SessionRunner.run()` forwards the request unchanged to its injected query function.
4. Production `productionQueryFn()` gives `request.system` to Pi's resource loader, finds the final `user` message, and calls `session.prompt(lastUserMsg.content)`.
5. On return, `parseObserverOutput()` strips optional code fences, parses JSON, and applies `ObserverOutputSchema`. `validateObservations()` then checks cited evidence and pattern references, preserves valid observations from mixed responses, and drops an invalid `metricLink` rather than rejecting its observation.

This is not a data-validation failure. Validation is local and explicit after generation. The risk is that task and schema instruction adherence depends on a role placement that is not aligned with the one-shot Pi prompt boundary and that makes stable system guidance harder to distinguish from request-specific content.

## Decision

Move the observer's complete task contract and JSON response contract into the single user prompt delivered to Pi. Keep the system prompt stable, concise, and limited to role/behavioral guardrails. Retain the existing post-response parsing and validation pipeline unchanged.

The user prompt is the authoritative contract for one observer run. The schema remains enforced by code, not trusted merely because it was requested in prose.

## Proposed message contract and ownership

| Layer | Owns | Must not own after migration |
| --- | --- | --- |
| Observer | Stable observer guidance; construction of run-specific task instructions, output contract, examples, and all journal context | Pi session setup or provider response extraction |
| Session runner | Transport of typed `system` and ordered role messages; retry behavior | Observer policy, schema validation, or role rewriting |
| Pi adapter (`productionQueryFn`) | Applying stable system guidance through `DefaultResourceLoader`; delivering the final user prompt through `session.prompt()`; extracting assistant text | Reconstructing observer instructions or validating observer JSON |
| Shared schema and observer validation | `ObserverOutputSchema` shape validation plus semantic evidence/ledger checks | Prompt assembly or provider behavior |

### System prompt after migration

`buildSystemPrompt()` becomes stable guidance only. It identifies the assistant as an ink-mirror writing-pattern observer and retains durable safety/behavior boundaries: observe rather than generate, do not suggest rewrites, do not compare against external norms, do not judge patterns good or bad. It must not contain:

- the requested observation count or curation procedure;
- dimension definitions and boundary examples;
- pattern-ledger match-or-discover protocol;
- JSON-only response instruction, response schema, or worked JSON examples;
- request-specific context descriptions or empty-array response rule.

### User prompt after migration

The sole `user` message includes, in this order:

1. **Task contract**: identify distinctive patterns, select observations appropriately, cite exact evidence, classify dimensions, and make only writer-internal comparisons.
2. **Pattern and output contract**: ledger matching/discovery rules, number-use constraints, JSON-only requirement, exact output shape, a worked full-response JSON example with no more than three observations, and the valid empty result (`{"observations": []}`).
3. **Run context**: recent entries, style profile, ledger, and deterministic metrics.
4. **Current entry** last, preserving the current attention placement.

The task/schema sections are static text owned by the observer, while the later context sections are run-specific. Explicit headings separate instructions from journal-derived material so entry text cannot be mistaken for authoritative instruction. No additional message roles are required: the existing `SessionMessage` union and one-user-message Pi bridge remain sufficient.

## Exact migration boundaries

1. Split the current `buildSystemPrompt()` body in `observer.ts` into a small stable system builder and an observer-task/output-contract builder used by `buildUserMessage()`.
2. Keep `observe()`'s `sessionRunner.run({ system, messages: [{ role: "user", content }], maxTokens: 2048 })` shape. Its only behavioral change is what each constructed string contains.
3. Do not alter `SessionRequest`, `SessionMessage`, `SessionRunner`, retries, or `maxTokens`. The runner already forwards roles unchanged.
4. Do not alter `productionQueryFn()`'s last-user-message selection, `DefaultResourceLoader.systemPrompt` wiring, `session.prompt()` call, assistant-text extraction, or Pi setup. This design relies on those existing boundaries rather than adding an adapter-specific observer path.
5. Do not change `ObserverOutputSchema`, `parseObserverOutput()`, `validateObservations()`, persistence, or pattern resolution. Any prompt wording updates must still describe their existing observable behavior accurately.

## JSON enforcement and limits

Prompt text can improve adherence but is not enforcement. The implementation must preserve these layers:

1. `parseObserverOutput()` trims text and accepts an optional enclosing Markdown fence before `JSON.parse`.
2. `ObserverOutputSchema.safeParse()` requires an `observations` array with at most three `RawObservationSchema` values. Dimensions are constrained by `ObservationDimensionSchema`; `patternRef`, when present, must select exactly one existing ID or new-pattern declaration.
3. `validateObservations()` independently checks that evidence occurs in the current entry and that a referenced pattern ID exists in the ledger supplied to the same call. It returns valid observations and per-observation errors separately, allowing partial success.
4. Invalid new-pattern metric links remain a documented exception: they are downgraded to qualitative by deleting the link, not treated as an invalid observation.

Limits: this does not provide provider-native structured output, grammar-constrained decoding, or schema-mode guarantees. It does not make journal content untrusted in a security sense. The durable protection against malformed or semantically unsupported content remains the local parse/schema/semantic validation path.

## Test strategy

Update observer prompt-construction and pipeline tests to assert the role boundary, not merely the presence of words somewhere in the combined prompt:

- `buildSystemPrompt()` contains stable observer guardrails but excludes JSON-only wording, output examples, `patternRef` contract, and run-context headings.
- `buildUserMessage()` contains task instructions, JSON/schema contract, empty-array behavior, ledger instructions, context sections, and keeps the current entry last.
- Each authoritative worked full-response JSON example embedded in the user prompt has no more than three observations and parses successfully with `ObserverOutputSchema`; the test must fail if the prompt example and schema limits diverge.
- The `observe()` pipeline captures the `SessionRequest` and proves task/schema text is in `messages[0]` with `role: "user"`, while the same text is absent from `system`.
- Existing valid response coverage continues to prove a schema-valid result is parsed, semantically validated, persisted, and resolved.
- Existing invalid JSON, schema-invalid output, fabricated-evidence/unknown-ledger-ID, and mixed valid/invalid response tests remain or are made explicit, proving errors and partial-success behavior did not regress.
- Session-runner tests continue to prove it forwards `system`, `messages`, and `maxTokens` unchanged; no runner role conversion is introduced.
- An isolated production-adapter test seam or mock-Pi test is required. It must prove `productionQueryFn()` assigns `request.system` to `DefaultResourceLoader.systemPrompt` and calls `session.prompt()` once with the content of the sole observer `user` message. This test is the required evidence at the Pi boundary, not an optional integration test.

The implementation may expose a narrow test seam around the module-private production adapter, or mock Pi at its existing boundary, without changing production behavior.

## Backward compatibility and risks

The daemon's public routes, stored observation/pattern shapes, session-runner request types, and provider configuration stay compatible. Prompt bytes and model behavior intentionally change, so generated content may vary; validation and persistence semantics must not.

Main risk is accidental duplication or omission while splitting a long prompt. Counter it with content-placement tests and a concise source of truth for the task contract. A secondary risk is widening the stable system prompt later with another task-specific contract. The tests should name this boundary directly so such drift fails locally. Moving text between roles may slightly change token accounting, but it does not duplicate the text; retain the existing worst-case prompt budget test and update it only if measured composition requires it.

## Non-goals

- Do not add provider-native JSON/schema response mode or change providers.
- Do not redesign Pi session construction, retries, model selection, or assistant extraction.
- Do not change observation dimensions, ledger semantics, storage, curation, or metric-link behavior.
- Do not remove code-fence tolerance, local JSON parsing, Zod validation, semantic validation, or partial-success reporting.
- Do not turn user journal content into system instructions.

## Implementation acceptance evidence

The implementation bead is complete only when its tests demonstrate the new message-role boundary, prompt-example/schema alignment, the required Pi adapter boundary evidence, and the existing valid/invalid response behavior, and when a targeted daemon test run passes. The change should be reviewed as a prompt-boundary migration, not as a relaxation of the observer output contract.
