---
title: "Implementation notes: observer JSON prompt-role contract"
date: 2026-09-19
status: complete
tags: [implementation, observer, json, prompt-roles]
source: .lore/work/design/observer-json-prompt-role-contract.md
modules: [daemon, observer, session-runner]
related: [.lore/work/design/observer-json-prompt-role-contract.md]
---

# Implementation notes: observer JSON prompt-role contract

## Obligation-to-validation mapping

| Obligation | Phase | Validation |
| --- | --- | --- |
| Stable behavioral rails remain in the system prompt only | 1 | `buildSystemPrompt` role-boundary test |
| Complete task, ledger, JSON, empty-result, and example contract reaches the sole user message | 1 | `buildUserMessage` and captured `SessionRequest` tests |
| Worked example satisfies `ObserverOutputSchema` and its maximum of three observations | 1 | Example extraction and `ObserverOutputSchema.safeParse` test |
| Runner behavior, validation, ledger semantics, and current-entry-last ordering remain unchanged | 1 | Existing observer focused suite and daemon type check |
| Pi adapter gives `request.system` to `DefaultResourceLoader` and sends the sole user content exactly once to `session.prompt()` | 2 | Isolated `production-query-fn.test.ts` exercising the real production adapter through narrowed injected Pi bindings |

## Phase checklist

- [x] Phase 1: Move observer task/output contract to the sole user message and retain system rails.
- [x] Phase 2: Add the production Pi adapter boundary test.

## Phase 1 log

- Claimed `ink-mirror-8t0`.
- Split the observer prompt into stable system rails and a user-owned task/output contract.
- Kept the existing single user message, runner request shape, token limit, parsing, semantic validation, ledger construction, and current-entry-last layout unchanged.
- Added role-placement and schema-valid worked-example coverage. The Pi adapter test is intentionally deferred as requested.
- Targeted validation passed: `bun test packages/daemon/tests/observer.test.ts packages/daemon/tests/observer-tier2.test.ts packages/daemon/tests/observer-integration.test.ts` (68 pass) and `bunx tsc --noEmit -p packages/daemon`.

## Phase 2 log

- Exposed a narrowed Pi-binding seam beneath the production adapter. The production binding creates the real `DefaultResourceLoader`, agent session, model registry lookup, extension binding, and model selection; the adapter owns prompt-role placement.
- Added an isolated no-network test with a fake `DefaultResourceLoader`, `createAgentSession`, model registry, and session bindings. It exercises the real production adapter and verifies that loader construction receives the exact system text and `session.prompt()` receives the sole user content once.
- Focused validation is recorded with the implementation run; it does not establish broader Pi or network behavior.

## Correction log

- Restored two task-contract rules that were inadvertently omitted during the prompt-role migration: the explicit sentence-structure versus paragraph-structure classification boundary, and the empty-result rule for candidate patterns the writer has already declined.
- Both rules remain in the sole user message. Observer tests now assert their presence there and their absence from the stable system prompt.

## Final acceptance record

Both phases are accepted. The targeted correction was verified with the focused
observer and production-adapter suite plus the daemon type check:

```text
bun test packages/daemon/tests/observer.test.ts packages/daemon/tests/observer-tier2.test.ts packages/daemon/tests/observer-integration.test.ts packages/daemon/tests/production-query-fn.test.ts
# 70 pass, 0 fail, 239 assertions

bunx tsc --noEmit -p packages/daemon
# exit 0
```

The correction verification confirms the two restored rules are in the user
message and absent from the stable system prompt. The production adapter test
also confirms the exact system guidance reaches `DefaultResourceLoader` and
the sole user content is sent to `session.prompt()` once.

### Accepted manifest

Captured after the accepted validation above. Status uses Git porcelain v1;
`absent` denotes an untracked path absent from the index, and `deletion`
denotes a working-tree deletion.

| Path | Status | Index blob | Working-tree content |
| --- | --- | --- | --- |
| `.serena/.gitignore` | ` D` | `2e510aff5855ba46f96cbcd10991d9d588f77e6c` | `deletion` |
| `.serena/project.yml` | ` D` | `1afa7498ad4a717ee0ccb00ef5ee48579a147024` | `deletion` |
| `package.json` | ` M` | `1764a2d4e376dce80e59c4d283644dcd69a9c6ba` | `sha256:6ac0b94efc3f35e536865bb7dece2a90c7dc3d72be7cbbb2f78b59a3713db888` |
| `packages/daemon/package.json` | ` M` | `9ccfb54e73942de7f4baf8c0737e60fe5245f36d` | `sha256:fe52e9d988336d61e8637eb420598ece88718a362a99e83c159e09ec9d3b640c` |
| `packages/daemon/src/index.ts` | ` M` | `7019467ffd965bd3ed995cb21fa24ea8c996215e` | `sha256:e33464932ec9c285e1b789aaf4e870a5aad2c009ed4f3f54a517a4bcbd6181f3` |
| `packages/daemon/src/observer.ts` | ` M` | `498414660794959d4acf52d255c41e0cfa3fa23f` | `sha256:90b3ebbf9d5cec7ac26083d203ddf82ec0833c43488d5b2aedab6e0af052d6ae` |
| `packages/daemon/tests/observer.test.ts` | ` M` | `d9fcd0d0ced378996a1e7af2ebfc24aba318b52c` | `sha256:cf9bc8d2eb8ec99ffdbd54f6444f073bb264f8390594959ccd22ad9b68d08362` |
| `packages/daemon/tsconfig.json` | ` M` | `5114d39c35ee44b8093789efb0708a5d9c21d020` | `sha256:011bb4524fffe2b22c7c80816ecd8b95bbbc1bf83e093ed6ecc5459f2363694d` |
| `.lore/work/design/observer-json-prompt-role-contract.md` | `??` | `absent` | `sha256:28c6163b9004f82946dbf544e8110e2b32b24f804f1596618b1e12544bcf892b` |
| `.lore/work/notes/observer-json-prompt-role-contract.md` | `??` | `absent` | `sha256:6a899220d88bb410a487367ea96be5ad24b714b45ef07665ac7d26c9b0b6de21` |
| `packages/daemon/scripts/ollama-smoke.ts` | `??` | `absent` | `sha256:ac0ecafd38e6978b05be257094bb11be6d6f33e220a1d0161a6e06071b4f82fd` |
| `packages/daemon/tests/production-query-fn.test.ts` | `??` | `absent` | `sha256:8b3f60683c8bec27f5c41e5f2c92ee9dab1ab788ed2df9f2747a89e3e502c410` |

Closing `ink-mirror-8t0` then updated the tracker interaction log, which is
outside the implementation surface: `.beads/interactions.jsonl` is ` M`, has
index blob `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`, and working-tree hash
`sha256:7e413c35e89c0b6398868f4372c8d58086ec42d8b90ac60523a351edfd7a8231`.
