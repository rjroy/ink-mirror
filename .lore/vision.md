---
title: ink-mirror Vision
status: active
date: 2026-03-26
reviewed_by: Ronald Roy
reviewed_date: 2026-04-20
tags: [vision, project-identity]
---

# ink-mirror

A journal where you write first and the AI reads second. You put something down, rough or short, whatever you have. The AI reflects back what it noticed about your choices: sentence rhythm, word habits, structural patterns. Not corrections, not rewrites, not suggestions. Observations.

You review those observations and mark which patterns are intentional and which are accidents. The intentional ones accumulate into a style profile. That profile is descriptive, extracted from what you actually do, not prescriptive, not what sounds good in theory.

The end state is two things: a writing practice built on doing the work yourself, and a set of style rules grounded in your real voice. When you eventually hand text to an AI for generation, it writes like you instead of like everyone.

## Why It Matters

Most AI writing tools start with generation. You describe what you want, the AI produces it, you edit the result. The problem is that this trains you to edit, not to write. Your voice becomes a correction layer on top of someone else's defaults.

The people who write well have internalized patterns they can't always articulate. They know what "sounds like them" but couldn't write a style guide from scratch. And the people who want to write better often don't know which of their habits are strengths and which are noise.

ink-mirror makes the implicit visible. It watches what you do (not what you say you do) and names the patterns. You decide which ones matter. Over time, the profile becomes a mirror that's more honest than self-assessment and more grounded than aspiration.

The audience is anyone who writes regularly and wants their voice to sharpen rather than flatten. Journalists, engineers writing docs, people who journal, anyone whose writing matters to them but who doesn't have an editor reading over their shoulder.

## Principles

### 1. Writing Takes Practice

You learn to write by writing, not by editing what someone else produced. ink-mirror never generates text for you. The journal entry is always yours, rough or short or half-formed. The skill lives in the act of putting words down, and no amount of AI observation substitutes for that. Everything the system does downstream (observing, profiling, comparing) depends on you having done the work first.

### 2. Feedback Accelerates Skill

Writers have internalized patterns they can't always name. ink-mirror makes those patterns visible: not corrections, not grades, but observations with cited evidence. The writer decides which patterns are intentional and which are noise. That act of deciding ("yes, I do that on purpose" or "no, that was lazy") builds awareness that unassisted practice alone doesn't. The feedback is descriptive, never prescriptive. The system tells you what you do. Whether it's good is your call.

### 3. Practice Should Be Frictionless

Writing is the only action the user must take. Everything else (observation, profile updates, contradiction detection) happens without being asked. Every interaction should require the minimum number of steps. The system does work automatically when it can and stays out of the way when it should.

### 4. Clients are Views

The daemon is the authority. Web and CLI are rendering surfaces over the same data and the same API. Neither is primary. A terminal-native writer and a browser-native writer get the same experience through different glass.

## How It Works

Four phases. The user initiates the first one. The rest follow automatically.

### Write

You open the journal and write. No prompts, no templates, no structure requirements. The entry can be a paragraph, a page, a single sentence. The interface stays out of the way. This is a text editor, not a wizard.

Entries are stored as plain markdown files with date-based frontmatter. You own the files. They're readable without ink-mirror running.

### Observe

After you submit an entry, the Observer reads it and produces observations. Each observation names a specific pattern, cites evidence from the text, and categorizes it.

Observations sit at the **pattern level**, between broad categories and raw counts. "You used three consecutive short sentences to build tension in the closing paragraph" is an observation. "Your mean sentence length is 12.4 words" is not. Every observation must pass the curation test: the writer can meaningfully answer "is this intentional?" If not, the observation is at the wrong grain.

### Curate

You review observations and classify each one: intentional (this is my voice), accidental (I didn't mean to do that), or undecided (I'm not sure yet). This is the step where your judgment shapes the profile.

The curation interface presents observations alongside the original text so you can see what the Observer saw in context. Undecided items resurface in future sessions until you resolve them.

Curation is the most important step. It's where writing awareness happens. The act of deciding "yes, I do that on purpose" or "no, that was lazy" builds the muscle that no amount of AI generation can replace.

### Apply

Confirmed patterns accumulate into a style profile: a structured document describing your voice in concrete terms. The profile is always editable. You can rephrase observations, add context, or remove patterns that no longer fit.

When a curated observation becomes a profile entry, it transforms from a one-time finding to a stable characteristic. "Uses staccato rhythm for emphasis at paragraph endings" (stable) rather than "Used four short sentences in the March 26 entry" (one-time).

The profile is formatted for use as AI system prompt material. When you give it to a writing assistant (ink-mirror's or anyone else's), it constrains generation toward your voice. The profile is portable: it's a markdown file you can copy into any tool that accepts custom instructions.

## What It Is Not

**Not a grammar checker.** ink-mirror does not flag errors, suggest corrections, or enforce rules. Tools like Grammarly and LanguageTool already do this. ink-mirror observes patterns. Patterns are not errors.

**Not a ghostwriter.** ink-mirror does not generate text for you. The style profile can be fed to tools that do, but ink-mirror itself never writes on your behalf. The journal entry is always yours.

**Not a writing course.** ink-mirror does not teach writing principles, suggest exercises, or grade your work. It shows you what you do. Whether that's good or bad is your call, and ink-mirror will never make it for you.

**Not a social platform.** There are no shared journals, no public profiles, no community features. Your voice is yours. The style profile is portable so you can take it elsewhere, but ink-mirror itself is a single-user tool.

**Not an editor.** ink-mirror does not suggest rewrites, reorganizations, or structural improvements. The Observer names patterns. It does not propose alternatives.
