---
title: "No golden corpus for observation quality — name the gap, outline minimal infra"
date: 2026-04-21
status: parked
priority: low
type: research
origin: .lore/brainstorm/observer-dimension-extension-20260420.md
tags: [research, observer, evaluation, quality-signal]
related:
  - .lore/brainstorm/observer-dimension-extension-20260420.md
  - .lore/specs/v1-core-loop.md
  - .lore/research/observation-granularity.md
  - .lore/research/minimum-viable-observation.md
---

# Observation evaluation methodology gap

## The gap

There is no golden corpus for Observer output quality. The only signal today is the writer's own curation decisions — `intentional`, `accidental`, `undecided` — stored with each observation.

That signal is valuable but indirect. `accidental` conflates "the observation was right but I didn't mean to do the thing" with "the observation was wrong and I reject it." `undecided` conflates "I need time to think" with "the observation is too unclear to classify." Without disambiguating these cases, the project cannot answer questions like:

- Does adding a dimension improve or degrade output?
- Do prompt rewrites change observation quality, or just surface quality?
- Which dimensions produce the most rejected observations, and why?

The brainstorm's "Risks" section (fourth bullet, `.lore/brainstorm/observer-dimension-extension-20260420.md`) flagged this as a known risk and recommended treating "the first real-world week of observations as the validation" for the paragraph-structure expansion. That is fine for a single dimension added in a narrow spec. It is not durable as the dimension set grows and as prompt engineering becomes load-bearing.

## What this issue is, and what it is not

This issue is **naming the gap** and **outlining what minimal evaluation infrastructure would look like**. It is not a proposal to build a full observation-quality pipeline right now.

Minimal infrastructure, as a starting sketch:

- **A small labeled corpus.** 20-30 entries across varied lengths and subjects, with the writer (single-user tool) annotating each Observer output along two axes:
  - Is the observation *accurate* (the pattern exists in the text)?
  - Is the observation *useful* (the writer can curate it meaningfully)?
  
  Accuracy and usefulness are different questions. A correct observation about something trivial is accurate but not useful. A nearly-right observation about something the writer cares about is useful but fragile.
  
- **A replay harness.** Given the corpus and a version of the Observer prompt, run all entries, produce observations, compare against the labels. The harness does not need to be fast; it needs to be repeatable.

- **A single scalar or small-tuple quality metric.** Accuracy rate, usefulness rate, and maybe rejection rate (accidental + undecided) as a triple. Not a leaderboard — a sanity check for prompt changes.

Explicitly not in the minimal infrastructure: LLM-as-judge scoring, automated accuracy detection, inter-rater agreement (it is a single-user tool), or anything that requires multiple writers.

## Why low priority

- The product works for the single user today. The writer curates, patterns accumulate, the profile grows.
- The gap is invisible while the dimension set is small and the prompt is stable.
- Building this corpus takes writer time that would otherwise go into using the product.

Why file it at all: because the gap becomes a debate as soon as someone disagrees about whether a prompt change or dimension addition improved things. Filing now means the absence of evaluation infrastructure is a documented choice, not a surprise.

## Trigger to reconsider priority

- A second dimension addition lands (the fifth total) and the next one is under debate. The dimensions-without-metrics asymmetry named in the brainstorm (Section 5 "Risks" third bullet) is the kind of question only this infrastructure answers.
- A prompt rewrite is proposed that changes output shape enough that "does this feel better?" is not sufficient to approve it.
- The writer's own curation reveals a consistent failure mode (e.g., always-rejected dimension) that warrants a principled fix.

## Reference

- Brainstorm: `.lore/brainstorm/observer-dimension-extension-20260420.md` "Risks" fourth bullet and "Open Threads" fourth bullet.
- Curation status types: `packages/shared/src/observations.ts:15-20`.
- Prior retros on Observer prompt quality: `.lore/retros/commission-cleanup-20260328.md`.
