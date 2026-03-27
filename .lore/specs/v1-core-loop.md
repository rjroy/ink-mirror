---
title: "ink-mirror v1: Core Loop"
date: 2026-03-26
status: implemented
tags: [spec, v1, core-loop, observer, curation, profile]
req-prefix: V1
related:
  - .lore/vision.md
  - .lore/reference/architecture-pattern.md
  - .lore/issues/research-observation-granularity.md
  - .lore/issues/research-minimum-viable-observation.md
  - .lore/issues/research-observer-history-window.md
  - .lore/issues/research-profile-versioning.md
---

# Spec: ink-mirror v1 Core Loop

## Overview

The first working version of ink-mirror delivers the write-observe-curate-apply loop. The user writes a journal entry. The Observer produces pattern-level observations with cited evidence. The user curates observations as intentional, accidental, or undecided. Confirmed patterns accumulate into a portable style profile.

v1 proves the concept: that observation and curation build writing awareness better than generation and editing.

## Entry Points

- **Write**: User opens the journal and writes an entry (web editor or CLI via `$EDITOR`)
- **Review**: User opens the curation interface to classify pending observations
- **Profile**: User views or edits their style profile

## Requirements

### Write

- REQ-V1-1: Entries are free-form. No prompts, templates, or structure requirements.
- REQ-V1-2: Entries are stored as plain markdown files with date-based frontmatter.
- REQ-V1-3: Entries are readable without ink-mirror running. The user owns the files.

### Observe

- REQ-V1-4: The Observer runs automatically when an entry is submitted. No second action from the user.
- REQ-V1-5: Each observation names a specific pattern, cites evidence from the text, and categorizes it by dimension.
- REQ-V1-6: Observations sit at the pattern level. Every observation must pass the curation test: the writer can meaningfully answer "is this intentional?" If not, the observation is at the wrong grain.
- REQ-V1-7: Evidence comes as cited text from the entry, not just statistics. A count is supporting data; the cited text is the observation.
- REQ-V1-8: The Observer surfaces 2-3 observations per entry, selecting the most distinctive patterns. A wall of observations is friction.
- REQ-V1-9: When the corpus reaches Tier 2 (5+ entries, see REQ-V1-13), comparisons are against the writer's own baseline, never against external norms or other writers.

### MVP Observation Dimensions

- REQ-V1-10: v1 observes three dimensions:
  1. **Sentence rhythm** (structural). Length patterns within an entry: consecutive short or long sentences, pace changes between sections. Unambiguous to measure, visible from entry one, produces clear curation questions.
  2. **Word-level habits** (lexical). Repeated words or phrases, hedging language ("just," "actually," "probably"), intensifiers, filler patterns. The dimension most likely to surprise writers.
  3. **Sentence structure** (structural, secondary). Active vs. passive voice ratio, paragraph opener patterns, fragment use. Shares analysis infrastructure with rhythm.
- REQ-V1-11: These three cover the structural-to-lexical spectrum and all produce observations from a single entry with no history required.
- REQ-V1-12: Excluded from v1: vocabulary register (requires evaluative judgment), paragraph-level structure (needs longer entries), tonal markers (observation/evaluation boundary too thin).

### Observer Context Strategy

- REQ-V1-13: The Observer assembles context in tiers, activated as data accumulates:
  - **Tier 1 (always):** System prompt, style profile, current entry. The style profile is the compressed history: every confirmed pattern represents information extracted from prior entries. Roughly 2,300-3,700 tokens.
  - **Tier 2 (corpus >= 5 entries):** Add the last 5 entries for drift detection. Five entries establish a local baseline without pushing context into the low-attention middle zone. Roughly 5,000-6,500 tokens total.
- REQ-V1-14: Tier 3 (semantic retrieval via embeddings, corpus >= 20 entries) is deferred past v1. No embedding infrastructure needed for v1.
- REQ-V1-15: Prompt layout: current entry at the end (highest attention zone), recent entries at the start (second highest). This follows the U-shaped attention curve in long-context LLM performance.

### Curate

- REQ-V1-16: Each observation can be classified: **intentional** (this is my voice), **accidental** (I didn't mean to do that), or **undecided** (not sure yet).
- REQ-V1-17: The curation interface presents observations alongside the original text so the writer sees what the Observer saw in context.
- REQ-V1-18: Undecided items resurface in future curation sessions until resolved.
- REQ-V1-19: When the Observer detects contradictory patterns (e.g., short declarative sentences in one entry, long flowing sentences in another), it surfaces the tension during curation. The user decides: both are intentional (the profile holds both), or one is drift (it gets trimmed). The system never auto-reconciles.

### Apply

- REQ-V1-20: Confirmed patterns accumulate into a style profile: a structured document describing the writer's voice in concrete terms.
- REQ-V1-21: When a curated observation becomes a profile entry, it transforms from a one-time finding to a stable characteristic. "Uses staccato rhythm for emphasis at paragraph endings" (stable), not "Used four short sentences in the March 26 entry" (one-time).
- REQ-V1-22: The profile is always editable. The writer can rephrase observations, add context, or remove patterns that no longer fit.
- REQ-V1-23: The profile is formatted for use as AI system prompt material. It's a portable markdown file the writer can copy into any tool that accepts custom instructions.

### Profile Versioning

[STUB: profile-versioning]

v1 scope: the live profile is always current and reflects the most recent curation decisions. The writer does not manage versions manually.

Deferred to its own spec: periodic snapshots for comparison, change detection annotations, distribution storage, and on-demand diff generation. Research completed in `.lore/issues/research-profile-versioning.md` provides the foundation. The detail exists; this stub marks where it gets expanded.

## Architecture Constraints

These are project-level constraints drawn from the daemon-first architecture pattern (`.lore/reference/architecture-pattern.md`). They constrain how v1 is built.

### Verifiable Constraints

These produce observable outcomes that acceptance testing can verify.

- REQ-V1-24: The daemon is the sole authority. It owns journal entries, observation history, style profile state, and all LLM interactions. Clients never call the Claude API directly.
- REQ-V1-25: Web and CLI are rendering surfaces over the same API. Neither is primary. The "clients are views" principle means the CLI is first-class, not an afterthought.
- REQ-V1-26: All durable state is in human-readable files (markdown, YAML). Entries, observations, and profiles are inspectable without the app running.
- REQ-V1-27: All LLM interaction flows through a single session runner. One entry point for error recovery, streaming, and tool resolution.
- REQ-V1-32: ink-mirror is a single-user tool. No shared journals, no public profiles, no community features.

### Implementation Mandates

These are construction choices from a known-good architecture pattern. They constrain implementation but don't appear as acceptance tests.

- REQ-V1-28: Route factories receive dependencies via injection. Tests provide mock dependencies. The observation pipeline needs test seams for the SDK and filesystem.
- REQ-V1-29: The CLI discovers available operations from the daemon at runtime. The daemon is the source of truth for what commands exist.
- REQ-V1-30: Transport: Hono on Unix socket. REST API for writes, SSE for streaming observation results.
- REQ-V1-31: Web client: Next.js. Server components for reading journal history, client components for the editor and curation interactions.

## Exit Points

| Exit | Triggers When | Target |
|------|---------------|--------|
| Profile export | User copies profile markdown | External tools (any AI writing assistant) |
| Profile versioning | Profile accumulates enough history | [STUB: profile-versioning] |
| New dimensions | v1 loop is validated, more observation types needed | [STUB: observation-expansion] |
| Semantic retrieval | Corpus reaches 20+ entries, cross-temporal patterns needed | [STUB: tier-3-retrieval] |

## Success Criteria

- [ ] A user can write a journal entry (web or CLI) and it persists as a readable markdown file
- [ ] The Observer produces 2-3 pattern-level observations automatically on submit
- [ ] Observations cite evidence from the text and are classifiable as intentional or not (the curation test)
- [ ] The user can classify observations as intentional, accidental, or undecided
- [ ] Undecided observations resurface in future sessions
- [ ] When contradictory patterns are detected, the curation session surfaces the conflict and the user decides resolution
- [ ] Confirmed patterns appear in the style profile as stable characteristics
- [ ] The style profile is a portable markdown file usable as AI system prompt material
- [ ] The profile is editable by the user
- [ ] Web and CLI clients access the same data through the same daemon API
- [ ] All state is inspectable as files without the app running

## AI Validation

**Defaults apply:**
- Unit tests with mocked LLM/filesystem dependencies
- 90%+ coverage on new code
- Code review by fresh-context sub-agent

**Custom:**
- Observer output passes the curation test: each observation must contain cited text and a classifiable pattern. This cannot be verified by static analysis; acceptance requires manual spot-check or a validation prompt applied to Observer output.
- Profile entries are stable characteristics, not timestamped one-time findings
- CLI and web produce identical results for the same operations against the daemon API
- Entries created via CLI are visible in web, and vice versa

## Constraints

- The Observer must not generate text for the user. Observations describe patterns. They do not suggest alternatives, corrections, or rewrites.
- The system must not compare against external norms or other writers. All comparison is against the writer's own history.
- Cost at daily journaling frequency must stay under $1.50/month on Sonnet (Tier 1+2 context strategy keeps this well under budget).

## Open Questions

These are implementation-level questions that resolve during design and build:

- **LLM-native vs. pre-computed metrics.** The Observer can let the LLM handle all parsing internally (simpler, harder to test deterministically) or pre-compute sentence lengths, word frequencies, and structural markers in the prompt (more testable, adds a pipeline stage). Testability vs. simplicity tradeoff.
- **Two vs. three MVP dimensions.** If sentence structure shares enough parsing infrastructure with sentence rhythm, include it. If it requires a separate analysis pass (POS tagging), it may not justify the MVP investment.
- **Observation-to-rule transformation.** When a curated observation becomes a profile entry, it needs a consistent format convention. The Apply phase needs this defined before it works. Blocks verification of REQ-V1-21 and REQ-V1-23.
- **Undecided resurfacing scope.** REQ-V1-18 says undecided items resurface until resolved, but doesn't bound how many appear per session. At scale (20+ entries, many undecided items), this becomes a UX decision. All pending items? Most recent N? One per session?

## Context

This spec extracts requirements from the vision document (`.lore/vision.md`), which was carrying both project identity and implementation detail. The vision retains the "what" and "why." This spec captures the "what, specifically" for v1.

Four research threads informed the requirements:
- Observation granularity (`.lore/issues/research-observation-granularity.md`): pattern-level, with curation test
- Minimum viable observation set (`.lore/issues/research-minimum-viable-observation.md`): three dimensions covering structural-to-lexical spectrum
- Observer history window (`.lore/issues/research-observer-history-window.md`): tiered context strategy, style profile as compressed history
- Profile versioning (`.lore/issues/research-profile-versioning.md`): gradual drift model, snapshots, change detection (stubbed for separate spec)

Architecture pattern reference: `.lore/reference/architecture-pattern.md`
