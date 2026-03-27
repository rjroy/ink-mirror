---
title: ink-mirror Vision
status: draft
date: 2026-03-26
review_trigger: "After first working prototype delivers the write-observe-curate loop"
tags: [vision, project-identity]
---

# ink-mirror

## What It Is

A journal where you write first and the AI reads second. You put something down, rough or short, whatever you have. The AI reflects back what it noticed about your choices: sentence length, word preferences, structural habits, tonal patterns. Not corrections, not rewrites, not suggestions. Observations.

You review those observations and mark which patterns are intentional and which are accidents. The intentional ones accumulate into a style profile. That profile is descriptive, extracted from what you actually do, not prescriptive, not what sounds good in theory.

The end state is two things: a writing practice built on doing the work yourself, and a set of style rules grounded in your real voice. When you eventually hand text to an AI for generation, it writes like you instead of like everyone.

## Why It Matters

Most AI writing tools start with generation. You describe what you want, the AI produces it, you edit the result. The problem is that this trains you to edit, not to write. Your voice becomes a correction layer on top of someone else's defaults.

The people who write well have internalized patterns they can't always articulate. They know what "sounds like them" but couldn't write a style guide from scratch. And the people who want to write better often don't know which of their habits are strengths and which are noise.

ink-mirror solves both problems by making the implicit visible. It watches what you do (not what you say you do) and names the patterns. You decide which ones matter. Over time, the profile becomes a mirror that's more honest than self-assessment and more grounded than aspiration.

The audience is anyone who writes regularly and wants their voice to sharpen rather than flatten. Journalists, engineers writing docs, people who journal, anyone whose writing matters to them but who doesn't have an editor reading over their shoulder.

## Principles

**Frictionless.** Every interaction should require the minimum number of steps. The system does work automatically when it can and stays out of the way when it should. Writing is the only action the user must take. Everything else (observation, profile updates, contradiction detection) happens without being asked.

**Clients are views.** The daemon is the authority. Web and CLI are rendering surfaces over the same data and the same API. Neither is primary. A terminal-native writer and a browser-native writer get the same experience through different glass.

## How It Works

Four phases. The user initiates the first one. The rest follow automatically.

### Write

You open the journal and write. No prompts, no templates, no structure requirements. The entry can be a paragraph, a page, a single sentence. The interface stays out of the way. This is a text editor, not a wizard.

Entries are stored as plain markdown files with date-based frontmatter. You own the files. They're readable without ink-mirror running.

### Observe

After you submit an entry (or on demand for older entries), the Observer reads it and produces observations. Each observation names a specific pattern, cites evidence from the text, and categorizes it (structural, tonal, lexical, rhythmic).

Observations are factual, not evaluative. "You used three consecutive short sentences to build tension" is an observation. "Your sentences are too short" is not. The Observer never suggests changes.

Observations compare against your history when enough entries exist. "This entry uses more passive voice than your last ten" is useful context. It's still not a correction.

### Curate

You review observations and classify each one: intentional (this is my voice), accidental (I didn't mean to do that), or undecided (I'm not sure yet). This is the step where your judgment shapes the profile.

The curation interface presents observations alongside the original text so you can see what the Observer saw in context. Undecided items resurface in future sessions until you resolve them.

Curation is the most important step. It's where writing awareness happens. The act of deciding "yes, I do that on purpose" or "no, that was lazy" builds the muscle that no amount of AI generation can replace.

### Apply

Confirmed patterns accumulate into a style profile: a structured document describing your voice in concrete terms. The profile is always editable. You can rephrase observations, add context, or remove patterns that no longer fit.

The profile is formatted for use as AI system prompt material. When you give it to a writing assistant (ink-mirror's or anyone else's), it constrains generation toward your voice. The profile is portable: it's a markdown file you can copy into any tool that accepts custom instructions.

## Architecture Direction

ink-mirror follows the Guild Hall daemon-centric pattern where it fits. The daemon is the authority boundary. Web and CLI are clients.

### What Maps Directly

**Daemon as sole authority.** The daemon owns journal entries, observation history, style profile state, and all LLM interactions. Clients never call the Claude API directly. This keeps the observation logic centralized and testable.

**Hono on Unix socket.** Same transport layer. REST API for writes, SSE for streaming observation results back to the web client.

**Next.js web client.** The journal editor, observation review interface, and style profile viewer are all web surfaces. Server components for reading journal history, client components for the editor and curation interactions.

**File-based state.** Journal entries as markdown. Observations as structured YAML or markdown with frontmatter. Style profile as a living markdown document. All human-readable, all inspectable without the app running.

**Claude Agent SDK for LLM calls.** The Observer uses the SDK to analyze entries. No direct API calls.

**DI factories for testing.** The observation pipeline needs test seams: mock the SDK to verify observation quality without burning tokens, mock the filesystem to test profile accumulation logic.

### What Diverges

**Workers are simpler.** ink-mirror needs one or two specialists, not a full guild. The Observer reads entries and produces observations. A Profile Builder (possibly the same worker, possibly separate) synthesizes confirmed patterns into the style profile. There's no need for a Guild Master routing work to multiple workers. The domain is narrow enough that the daemon can route directly.

**No git isolation.** Journal entries aren't code. They don't need branches, worktrees, or merge strategies. Entries are append-only files in a directory. The three-branch model and worktree layout from Guild Hall don't apply here.

**No commissions.** ink-mirror's LLM interactions are triggered by user actions (submitting an entry triggers observation automatically), not dispatched as background work. The commission lifecycle (pending, dispatched, in_progress) is unnecessary machinery. Observations are synchronous with the submit action (streamed back), not fire-and-forget.

**Meetings don't map cleanly either.** The curation step is interactive, but it's closer to a form (classify each observation) than a multi-turn conversation. If curation ever becomes conversational ("tell me more about why you flagged this pattern"), a lightweight session model would suffice. The full meeting system with worktrees, note generation, and branch merging is more than needed.

**The five-layer service architecture is too deep.** ink-mirror's state model is simpler: entries in, observations out, profile updated. Two or three layers (storage, observation pipeline, API surface) are enough. Splitting into five layers would create abstraction without justification.

**The operations registry and CLI discovery are simpler.** The CLI is first-class but has a small surface: submit an entry, list entries, show profile, review observations. That's a handful of commands, not a discoverable tree. Build it simply.

### What's New

**The observation pipeline.** This has no analog in Guild Hall. It's a processing stage between "user wrote something" and "user sees results." The pipeline reads an entry, applies the Observer worker, structures the output into discrete observations, and stores them. This is ink-mirror's core domain logic.

**The style profile as a living document.** Guild Hall's memory system stores facts about workers and projects. ink-mirror's style profile is different: it's a curated, evolving description of a person's voice, built from evidence. It's closer to a specification that the user writes through their curation decisions. The profile needs its own storage model, versioning (so you can see how your voice has changed), and export format.

**Temporal awareness.** The Observer needs to compare entries over time. "You used to vary sentence length more" requires access to historical observations, not just the current entry. This means the observation store needs to be queryable by date range, pattern category, and resolution status.

## What It Is Not

**Not a grammar checker.** ink-mirror does not flag errors, suggest corrections, or enforce rules. Tools like Grammarly and LanguageTool already do this. ink-mirror observes patterns. Patterns are not errors.

**Not a ghostwriter.** ink-mirror does not generate text for you. The style profile can be fed to tools that do, but ink-mirror itself never writes on your behalf. The journal entry is always yours.

**Not a writing course.** ink-mirror does not teach writing principles, suggest exercises, or grade your work. It shows you what you do. Whether that's good or bad is your call, and ink-mirror will never make it for you.

**Not a social platform.** There are no shared journals, no public profiles, no community features. Your voice is yours. The style profile is portable so you can take it elsewhere, but ink-mirror itself is a single-user tool.

**Not an editor.** ink-mirror does not suggest rewrites, reorganizations, or structural improvements. The Observer names patterns. It does not propose alternatives.

## Resolved Questions

### Observer runs automatically on submit

The Observer analyzes every entry on submit without a second action from the user. This follows the frictionless principle: writing is the only step the user takes. Observations are produced automatically and available when the user is ready to review them.

### Contradictions are escalated to the user

When the Observer detects contradictory patterns (short declarative sentences in technical writing, long flowing sentences in journal entries), it surfaces the tension during curation. The user decides: both are intentional (the profile holds both), or one is drift (it gets trimmed). The system never auto-reconciles. The act of deciding is part of the learning process.

### CLI is first-class

The CLI is a view, not a secondary client. Same daemon, same API, same data. Terminal-native writers get `ink-mirror write` (opens $EDITOR, submits on save), observation review, and profile access. The "clients are views" principle means this isn't an afterthought; it's implied by the architecture.

## Open Questions (Research Required)

The following questions require research before they can be resolved. Each has a corresponding issue in `.lore/issues/`.

### How much history does the Observer need?

See `.lore/issues/research-observer-history-window.md`. Token window strategies, RAG approaches, cost modeling, and prior art in writing analysis tools.

### What's the right granularity for observations?

See `.lore/issues/research-observation-granularity.md`. Computational stylistics, writing pedagogy, and what level of abstraction supports curation decisions. Constrained by the frictionless principle.

### What's the minimum viable observation set?

See `.lore/issues/research-minimum-viable-observation.md`. Likely falls out of the granularity research. Which two or three dimensions prove the core loop?

### How should the profile version over time?

See `.lore/issues/research-profile-versioning.md`. Linguistics research on voice evolution, version models, and what a useful "voice diff" looks like.
