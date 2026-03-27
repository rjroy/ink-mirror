---
title: ink-mirror Vision
status: draft
date: 2026-03-26
review_trigger: "After first working prototype delivers the write-observe-curate loop"
tags: [vision, project-identity]
---

# ink-mirror

## What It Is

A journal where you write first and the AI reads second. You put something down, rough or short, whatever you have. The AI reflects back what it noticed about your choices: sentence rhythm, word habits, structural patterns. Not corrections, not rewrites, not suggestions. Observations.

You review those observations and mark which patterns are intentional and which are accidents. The intentional ones accumulate into a style profile. That profile is descriptive, extracted from what you actually do, not prescriptive, not what sounds good in theory.

The end state is two things: a writing practice built on doing the work yourself, and a set of style rules grounded in your real voice. When you eventually hand text to an AI for generation, it writes like you instead of like everyone.

## Why It Matters

Most AI writing tools start with generation. You describe what you want, the AI produces it, you edit the result. The problem is that this trains you to edit, not to write. Your voice becomes a correction layer on top of someone else's defaults.

The people who write well have internalized patterns they can't always articulate. They know what "sounds like them" but couldn't write a style guide from scratch. And the people who want to write better often don't know which of their habits are strengths and which are noise.

ink-mirror makes the implicit visible. It watches what you do (not what you say you do) and names the patterns. You decide which ones matter. Over time, the profile becomes a mirror that's more honest than self-assessment and more grounded than aspiration.

The audience is anyone who writes regularly and wants their voice to sharpen rather than flatten. Journalists, engineers writing docs, people who journal, anyone whose writing matters to them but who doesn't have an editor reading over their shoulder.

## Principles

**Frictionless.** Writing is the only action the user must take. Everything else (observation, profile updates, contradiction detection) happens without being asked. Every interaction should require the minimum number of steps. The system does work automatically when it can and stays out of the way when it should.

**Clients are views.** The daemon is the authority. Web and CLI are rendering surfaces over the same data and the same API. Neither is primary. A terminal-native writer and a browser-native writer get the same experience through different glass.

## How It Works

Four phases. The user initiates the first one. The rest follow automatically.

### Write

You open the journal and write. No prompts, no templates, no structure requirements. The entry can be a paragraph, a page, a single sentence. The interface stays out of the way. This is a text editor, not a wizard.

Entries are stored as plain markdown files with date-based frontmatter. You own the files. They're readable without ink-mirror running.

### Observe

After you submit an entry, the Observer reads it and produces observations. Each observation names a specific pattern, cites evidence from the text, and categorizes it.

Observations sit at the **pattern level**, between broad categories and raw counts. "You used three consecutive short sentences to build tension in the closing paragraph" is an observation. "Your mean sentence length is 12.4 words" is not. The pattern level is where three fields (computational stylistics, writing pedagogy, and tool design) converge on the same answer: specific enough to curate, general enough to accumulate into a profile.

Every observation must pass the curation test: the writer can meaningfully answer "is this intentional?" If not, the observation is at the wrong grain. Evidence comes as cited text, not just statistics. A count is supporting data; the cited text is the observation.

**MVP observation dimensions.** The first version observes three dimensions:

1. **Sentence rhythm** (structural). Length patterns within an entry, consecutive short or long sentences, pace changes between sections. This is the strongest candidate: unambiguous to measure, visible from entry one, produces clear curation questions. "You wrote four consecutive sentences under 8 words in the closing paragraph. Rhythmic emphasis or running out of steam?"

2. **Word-level habits** (lexical). Repeated words or phrases, hedging language ("just," "actually," "probably"), intensifiers, filler patterns. This is the dimension most likely to surprise writers. People don't notice their verbal tics in written form. The surprise is what makes the curation moment land.

3. **Sentence structure** (structural, secondary). Active vs. passive voice ratio, paragraph opener patterns, fragment use. This shares parsing infrastructure with rhythm and adds depth within the structural category.

These three cover the structural-to-lexical spectrum and all produce observations from a single entry with no history required.

**What's excluded from v1:** Vocabulary register (requires evaluative judgment about "formal" vs. "casual"), paragraph-level structure (needs longer entries to be meaningful), tonal markers (the observation/evaluation boundary is too thin). These become viable as the system matures.

**Observation volume.** Writing pedagogy consistently recommends 2-3 focus areas per review. The Observer surfaces the most distinctive patterns per entry, not every measurable feature. A wall of observations is friction.

**Comparison against history, not norms.** "More passive than your last ten entries" is useful context. "More passive than Hemingway" is not. The Observer compares against the writer's own baseline when enough data exists, never against external standards.

### Curate

You review observations and classify each one: intentional (this is my voice), accidental (I didn't mean to do that), or undecided (I'm not sure yet). This is the step where your judgment shapes the profile.

The curation interface presents observations alongside the original text so you can see what the Observer saw in context. Undecided items resurface in future sessions until you resolve them.

Curation is the most important step. It's where writing awareness happens. The act of deciding "yes, I do that on purpose" or "no, that was lazy" builds the muscle that no amount of AI generation can replace.

### Apply

Confirmed patterns accumulate into a style profile: a structured document describing your voice in concrete terms. The profile is always editable. You can rephrase observations, add context, or remove patterns that no longer fit.

When a curated observation becomes a profile entry, it transforms from a one-time finding to a stable characteristic. "Uses staccato rhythm for emphasis at paragraph endings" (stable) rather than "Used four short sentences in the March 26 entry" (one-time).

The profile is formatted for use as AI system prompt material. When you give it to a writing assistant (ink-mirror's or anyone else's), it constrains generation toward your voice. The profile is portable: it's a markdown file you can copy into any tool that accepts custom instructions.

## Observer Context Strategy

The Observer needs historical context to produce useful comparisons, but sending the full corpus is both expensive and counterproductive. Research on long-context LLM performance shows a U-shaped attention curve: models attend best to the start and end of their input, worst to the middle. Selective retrieval of relevant context outperforms brute-force inclusion.

The strategy uses three tiers, activated as data accumulates:

**Tier 1 (always included):** System prompt, style profile, and the current entry. The style profile is the key insight here: it IS the compressed history. Every confirmed pattern represents information extracted from dozens of past entries. Sending the profile instead of the entries it was built from gives the Observer the same analytical power at a fraction of the token cost. Total: roughly 2,300-3,700 tokens.

**Tier 2 (corpus >= 5 entries):** Add the last 5 entries for drift detection. "This entry uses shorter sentences than your recent work." Five is enough to establish a local baseline without pushing relevant context into the low-attention middle zone. Total: roughly 5,000-6,500 tokens.

**Tier 3 (corpus >= 20 entries, deferred past v1):** Semantic retrieval of the 3 most similar past entries via embedding search. This surfaces cross-temporal patterns ("you tend to use passive voice when writing about work topics") that recency alone misses. Total: roughly 6,500-8,500 tokens.

**Prompt layout matters.** The current entry goes at the end (highest attention zone). Recent entries go at the start (second highest). Retrieved entries go in the middle (supplementary, acceptable to be lower attention).

v1 ships with Tiers 1 and 2. No embedding infrastructure needed. The style profile and recency window handle the common case. Retrieval comes later as a separate milestone, once the core loop is validated.

At daily journaling frequency with the hybrid strategy, observation costs run under $0.40/month on Haiku, under $1.10/month on Sonnet. Prompt caching and batch processing can reduce this further. Cost is not a blocking concern.

## Profile Versioning

Voice change is predominantly gradual. Research across computational stylistics, composition pedagogy, and corpus linguistics converges on this: writers drift over time, with occasional deliberate shifts. Henry James showed identifiable periods (early, intermediate, late), but those phases emerged from gradual accumulation, not sudden breaks. The changes are visible only in retrospect.

This shapes how the profile captures evolution:

**The live profile is always current.** It reflects the writer's voice as the most recent curation decisions define it. There are no "versions" the user has to manage.

**Periodic snapshots anchor comparison.** The system automatically saves timestamped copies of the profile at low frequency (quarterly or biannually). These enable self-reflection: "How has my voice changed this year?" Low storage cost; profiles are small documents.

**Change detection annotates the timeline.** When the system detects a statistically significant shift in writing patterns (using concept drift detection techniques), it marks the moment on the timeline. This captures both gradual drift (accumulated small changes crossing a threshold) and punctuated shifts (detected quickly). The annotation is informational, not interventional.

**Contextual vs. temporal variation.** Writers have multiple registers. Short declarative sentences in technical writing and long flowing ones in journal entries can both be "their voice." The profile needs to distinguish "I write differently in different contexts" from "my voice is changing over time." The contradiction escalation mechanism (see Resolved Questions) handles this at curation time; the versioning model needs to stay aware of it.

**Store distributions, generate diffs on demand.** The system stores compact numerical data (sentence length distributions, vocabulary metrics, structural pattern frequencies). Human-readable diffs ("you've shifted from compound sentences to shorter declarative patterns") are generated by the Observer when the user asks for a comparison.

## Architecture Direction

ink-mirror follows the daemon-first architecture pattern where it fits. The daemon is the authority boundary. Web and CLI are clients.

### What Maps Directly

**Daemon as sole authority.** The daemon owns journal entries, observation history, style profile state, and all LLM interactions. Clients never call the Claude API directly. This keeps the observation logic centralized and testable.

**Hono on Unix socket.** Same transport layer. REST API for writes, SSE for streaming observation results back to clients.

**Next.js web client.** The journal editor, observation review interface, and style profile viewer are web surfaces. Server components for reading journal history, client components for the editor and curation interactions.

**File-based state.** Journal entries as markdown. Observations as structured YAML or markdown with frontmatter. Style profile as a living markdown document. Feature distributions as compact YAML for versioning. All human-readable, all inspectable without the app running.

**One entry point for SDK calls.** All LLM interaction flows through a single session runner. The Observer, profile diffing, and any future LLM-backed features go through the same path. One place to handle error recovery, streaming, and tool resolution.

**DI factories for testing.** The observation pipeline needs test seams: mock the SDK to verify observation quality without burning tokens, mock the filesystem to test profile accumulation logic. Route factories receive their dependencies; tests provide mock ones.

**Operations registry.** The CLI discovers available operations from the daemon at runtime. The daemon is the source of truth for what commands exist.

### What Diverges

**Workers are simpler.** ink-mirror needs one or two specialists, not a full guild. The Observer reads entries and produces observations. A Profile Builder (possibly the same worker, possibly separate) synthesizes confirmed patterns into the style profile. The domain is narrow enough that the daemon can route directly.

**No git isolation.** Journal entries aren't code. They don't need branches, worktrees, or merge strategies. Entries are append-only files in a directory. The three-branch model and worktree layout don't apply.

**No commissions.** Observations are triggered by user actions (submitting an entry), not dispatched as background work. The commission lifecycle is unnecessary machinery. Observations stream back to the client as they're produced.

**Fewer service layers.** ink-mirror's state model is simpler: entries in, observations out, profile updated. Two or three layers (storage, observation pipeline, API surface) are enough. Splitting deeper would create abstraction without justification.

**Smaller CLI surface.** Submit an entry, list entries, show profile, review observations. That's a handful of commands, not a discoverable tree. Build it simply. The operations registry still applies (CLI discovers from daemon), but the surface area is small.

### What's New

**The observation pipeline.** This has no analog in the architecture pattern. It's a processing stage between "user wrote something" and "user sees results." The pipeline reads an entry, assembles historical context (profile + recency window), runs the Observer, structures the output into discrete observations, and stores them. This is ink-mirror's core domain logic.

**The style profile as a living document.** It's a curated, evolving description of a person's voice, built from evidence. The profile is closer to a specification that the user writes through their curation decisions. It needs its own storage model, snapshot mechanism, and export format.

**Temporal awareness.** The Observer compares entries over time. "You used to vary sentence length more" requires access to historical observations and the recency window, not just the current entry. The observation store needs to be queryable by date range, pattern category, and resolution status.

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

This mechanism also serves the versioning model. Contradictions may reflect contextual variation (the writer uses different registers for different purposes) rather than voice change. The user's curation decision is what distinguishes the two.

### CLI is first-class

The CLI is a view, not a secondary client. Same daemon, same API, same data. Terminal-native writers get `ink-mirror write` (opens $EDITOR, submits on save), observation review, and profile access. The "clients are views" principle means this isn't an afterthought; it's implied by the architecture.

### Observation granularity is pattern-level

Three fields (computational stylistics, writing pedagogy, existing tool analysis) converge: observations are most useful when they name specific, recurring behaviors with cited evidence. Not broad categories ("your writing is informal"), not raw counts ("47 semicolons"). The pattern level supports curation decisions and accumulates into profile rules.

### MVP observes three dimensions

Sentence rhythm, word-level habits, and sentence structure. These cover the structural-to-lexical spectrum, all work from a single entry with no history, and all produce clear curation questions. Additional dimensions (vocabulary register, tonal markers, paragraph structure) join later as the observation pipeline matures.

### The style profile is the compressed history

The Observer doesn't need the full corpus. The style profile carries confirmed patterns extracted from all prior entries. Combined with a recency window of the last 5 entries, this gives the Observer enough context for meaningful comparison at roughly 5,000-6,500 input tokens. Semantic retrieval (embedding-based search for similar past entries) is deferred past v1.

### Profile versioning is automatic

The live profile is always current. Periodic snapshots anchor comparison. Change detection annotates significant shifts. The user never manages versions manually. Raw feature distributions are stored compactly; human-readable diffs are generated on demand.

## Open Threads

These are implementation-level questions that don't need research. They'll resolve during design and build.

- **LLM-native vs. pre-computed metrics.** The Observer can let the LLM handle all parsing internally (simpler to build, harder to test deterministically) or pre-compute sentence lengths, word frequencies, and structural markers and include them in the prompt (more testable, adds a pipeline stage). This is a testability vs. simplicity tradeoff.

- **Two vs. three MVP dimensions.** If sentence structure shares enough parsing infrastructure with sentence rhythm, the marginal cost is low and it's worth including. If it requires a separate analysis pass (POS tagging), it may not be worth the MVP investment.

- **Observation-to-rule transformation.** When a curated observation becomes a profile entry, it needs a consistent format convention. The Apply phase needs this defined before it works.

- **Snapshot frequency.** Quarterly vs. biannual profile snapshots. Depends on how quickly voice actually shifts in journal-length entries. Empirical question.

- **Change detection sensitivity.** The concept drift literature offers methods (ADWIN, DDM, KSWIN), but the right threshold for voice change in journal entries needs tuning against real data.
