---
title: "Research: Observation Granularity"
status: complete
date: 2026-03-26
related:
  - .lore/issues/research-observation-granularity.md
tags: [observer, research, observation-model]
---

# Research: Observation Granularity

## The Question

What level of abstraction makes an observation useful for ink-mirror's write-observe-curate loop? The Observer needs specificity that supports curation decisions ("is this intentional?") and generality that accumulates into profile patterns.

## Summary of Findings

Three fields converge on the same answer: observations are most useful at the **pattern level**, sitting between broad categories and raw counts. A useful observation names a specific, recurring behavior, cites evidence from the text, and is phrased so the writer can decide whether it's intentional. The fields disagree on taxonomy (linguists, writing instructors, and tool designers slice style differently), but they agree on the grain size.

---

## 1. Computational Stylistics: How Linguists Categorize Style

### Feature Hierarchy (verified across multiple sources)

Computational stylistics organizes features in a hierarchy of increasing abstraction:

| Level | What It Measures | Examples |
|-------|-----------------|----------|
| **Character** | Raw character patterns | n-gram frequencies, punctuation mark distributions |
| **Word/Lexical** | Vocabulary choices | function word frequencies, type-token ratio, vocabulary richness (Yule's K, Herdan's C), mean word length |
| **Sentence/Syntactic** | Grammatical structure | mean sentence length, POS tag distributions, passive voice ratio, clause depth |
| **Discourse/Document** | Text-level organization | paragraph length distribution, coherence measures, topic shifts |

Sources: Lagutina & Lagutina, "A Survey on Stylometric Text Features" ([PDF](https://fruct.org/publications/volume-25/fruct25/files/Lag.pdf)); stylometry overview at [Authorship Attribution 101](https://thedynamiter.llc.ed.ac.uk/?page_id=140); [Burrows' Delta literature](https://academic.oup.com/dsh/article/32/suppl_2/ii4/3865676).

### Biber's Multi-Dimensional Analysis

Douglas Biber's framework (1988) identified six functional dimensions of English by clustering co-occurring linguistic features:

1. Involved vs. Informational Production
2. Narrative vs. Non-Narrative Concerns
3. Explicit vs. Situation-Dependent Reference
4. Overt Expression of Persuasion
5. Abstract vs. Non-Abstract Information
6. On-Line Informational Elaboration

Source: [Multi-Dimensional Analysis overview](https://link.springer.com/article/10.1007/BF00136979); [Biber Redux: Reconsidering Dimensions](https://aclanthology.org/C14-1054.pdf).

### What This Means for ink-mirror

The character-level and raw-count features (bottom of the hierarchy) are too narrow for curation. "You used 47 semicolons" is data, not an observation. The Biber dimensions (top of the hierarchy) are too abstract for a single entry. "Your writing is more involved than informational" requires corpus-scale comparison and doesn't help the writer decide anything about a specific choice.

The useful grain sits at the **word and sentence levels, interpreted as behavioral patterns**. Not "your mean sentence length is 12.4 words" but "you used three consecutive short sentences to create a staccato rhythm in the closing paragraph." The measurement comes from the lower levels; the observation is phrased at the pattern level.

---

## 2. Writing Pedagogy: What Feedback Granularity Works

### Hattie and Timperley's Feedback Framework

The most cited feedback model in education research (Hattie & Timperley, 2007) identifies four levels:

| Level | Focus | Example in Writing Context |
|-------|-------|---------------------------|
| **Task** | Correctness of specific output | "This sentence is a fragment" |
| **Process** | Strategy or approach used | "You tend to front-load qualifications before stating your position" |
| **Self-Regulation** | Monitoring and self-assessment | "Compare this draft to your previous one: where did you make different choices?" |
| **Self** | Personal attributes | "You're a good writer" |

The research finds that **process-level feedback** improves writing quality by ~0.75 standard deviations (equivalent to nearly two years of academic growth). Task-level feedback helps novices but plateaus quickly. Self-level feedback ("you're a good writer") has no measurable effect on learning.

Sources: [Hattie & Timperley (2007)](https://journals.sagepub.com/doi/abs/10.3102/003465430298487); [BERA optimization guide](https://www.bera.ac.uk/blog/how-to-optimise-the-use-of-hattie-and-timperleys-feedback-levels-for-student-learning); [Exploration using Hattie/Timperley levels](https://pmc.ncbi.nlm.nih.gov/articles/PMC12306611/).

### Actionable Feedback Characteristics

Writing instruction research converges on feedback being most useful when it is:

- **Pattern-directed** (targets recurring behaviors, not isolated instances)
- **Evidence-cited** (points to specific text as example)
- **Limited in scope** (2-3 focus areas per review, not everything at once)
- **Non-evaluative** (describes what happened, not whether it's good or bad)

Source: [Super Specific Feedback](https://newsletter.weskao.com/p/super-specific-feedback); [Indiana University formative feedback guide](https://citl.indiana.edu/teaching-resources/evidence-based/targeted-feedback.html).

### What This Means for ink-mirror

ink-mirror's Observer maps cleanly to the **process level** in this framework. It's not correcting task-level errors (grammar checkers do that), not coaching self-regulation (writing courses do that), and not offering self-level praise. It names patterns in the writer's approach. That's the level with the strongest evidence for building awareness.

The "2-3 areas per review" finding is worth noting: the Observer should probably surface a limited number of observations per entry rather than exhaustively cataloging every pattern. This connects to the frictionless principle. A wall of observations is friction.

---

## 3. Existing Style Analysis Tools: What Dimensions They Report

### Hemingway Editor

Reports on five dimensions via color-coded highlights:

| Dimension | What It Catches |
|-----------|----------------|
| Sentence complexity (yellow) | Long, hard-to-read sentences |
| Sentence confusion (red) | Very complex sentences needing rewrite |
| Vocabulary complexity (purple) | Words with simpler alternatives |
| Adverb density (blue) | Weak adverbs that could be cut |
| Voice (green) | Passive voice constructions |

Also reports readability grade level. Source: [Hemingway Editor](https://hemingwayapp.com/).

### ProWritingAid

Reports on 25+ dimensions organized into reports. The three most impactful for new users:

1. **Style Report**: passive voice, adverbs, hidden verbs, weasel words, emotion tells, sentence-initial repetition
2. **Sentence Length Report**: variation in sentence length across the document
3. **Overused Words Report**: categories include wishy-washy language, telling-not-showing, weak intensifier-dependent words, nonspecific words, awkward constructions

Also includes readability scoring (Flesch-Kincaid, Coleman-Liau) and pacing analysis. Source: [ProWritingAid Style Report](https://help.prowritingaid.com/article/31-what-does-the-writing-style-report-do); [Summary Report](https://help.prowritingaid.com/article/352-how-to-use-the-summary-report).

### Nielsen Norman Group: Tone of Voice Dimensions

Four continuous dimensions for characterizing writing voice:

1. **Formal vs. Casual**
2. **Serious vs. Funny**
3. **Respectful vs. Irreverent**
4. **Enthusiastic vs. Matter-of-Fact**

Source: [NN/g Four Dimensions of Tone](https://www.nngroup.com/articles/tone-of-voice-dimensions/).

### What This Means for ink-mirror

The existing tools cluster around **correctness and clarity** (Hemingway, ProWritingAid). They flag problems. ink-mirror is doing something different: naming patterns without judgment. This distinction matters for choosing dimensions.

Hemingway's dimensions (sentence complexity, passive voice, adverb density) are measurable and pattern-forming, making them candidates for ink-mirror. But they'd need to be stripped of their evaluative framing. "You used passive voice in 40% of sentences in this entry" is a pattern observation. "You used too much passive voice" is a correction.

The NN/g tone dimensions are interesting as profile-level descriptors (the style profile could eventually position the writer on these spectra) but too coarse for per-entry observation.

---

## 4. Fixed vs. Adaptive Granularity

### Evidence for Adaptive Approaches

The Hattie/Timperley framework explicitly recommends different feedback levels for different learner stages: novices benefit from task-level feedback; proficient learners benefit from process and self-regulation feedback. This suggests granularity should shift as the system accumulates data about the writer.

Progressive disclosure in UX follows the same principle: present simple information first, reveal complexity as the user develops proficiency. The key insight from the UX literature is that the system should synchronize revealed complexity with user involvement, not hide it permanently.

Sources: [NN/g Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/); [Progressive Disclosure of Complexity](https://jason.energy/progressive-disclosure-of-complexity/).

### How This Applies to ink-mirror

There are two axes of adaptation:

**Data-driven adaptation** (how much history exists): With one entry, the Observer can only report within-entry patterns (sentence length variation, vocabulary choices, structural habits). With twenty entries, it can report trends and deviations ("this entry is more formal than your baseline"). This adaptation is natural and doesn't require configuration. The Observer reports what the data supports.

**User-driven adaptation** (what the writer has curated): As the writer classifies patterns as intentional, the Observer can become more specific within confirmed dimensions. If the writer has confirmed "I use short declarative sentences intentionally," the Observer can distinguish *types* of short sentences (fragments vs. simple sentences vs. compound with short clauses) rather than treating them as one category. This is progressive disclosure driven by the writer's own curation, not by system configuration.

Neither axis requires the user to configure what gets observed. The frictionless principle holds.

---

## Synthesis: The Right Grain for ink-mirror Observations

### The Observation Template

A useful observation has three components:

1. **Pattern name**: A specific, named behavior (not a category, not a raw count)
2. **Evidence**: Cited text from the entry showing the pattern
3. **Category**: Which dimension of style this belongs to (structural, lexical, tonal, rhythmic)

Example of too broad: "You write short sentences."
Example of too narrow: "You used the word 'just' 47 times."
Example of right grain: "You used four consecutive sentences under 8 words in the second paragraph, creating a clipped, declarative rhythm. The surrounding paragraphs average 18 words per sentence."

The right-grain example names a pattern (consecutive short sentences), cites location and evidence (second paragraph, specific count), categorizes it (rhythm/structural), and provides comparison context (surrounding paragraphs). The writer can decide: "Yes, I do that for emphasis" or "No, I was being lazy."

### Proposed Observation Categories

Drawing from all four research directions, here are the categories that satisfy the constraints (measurable, pattern-forming, curation-ready, no configuration needed):

| Category | What It Captures | Example Observation |
|----------|-----------------|---------------------|
| **Sentence rhythm** | Length variation, consecutive patterns, pace changes | "Three paragraphs of uniform 15-word sentences, then a 4-word closer." |
| **Sentence structure** | Active/passive, clause complexity, fragment use, opener variety | "You opened 5 of 8 paragraphs with a dependent clause." |
| **Word-level habits** | Repeated words, hedging language, intensifiers, formality markers | "The word 'actually' appears in 6 of 12 sentences." |
| **Vocabulary register** | Formal/casual mixing, jargon density, concrete vs. abstract nouns | "Technical terms cluster in paragraphs 2-3; the rest reads conversationally." |
| **Paragraph/structural** | Length distribution, topic sentence patterns, transition habits | "Each paragraph follows a claim-evidence-restatement pattern." |
| **Tonal markers** | Directness, hedging patterns, emotional intensity, rhetorical questions | "You qualified every assertion with 'probably' or 'might.'" |

### What's Excluded and Why

- **Grammar and spelling**: These are errors, not style. Grammar checkers handle this. ink-mirror observes patterns, not mistakes.
- **Content/topic analysis**: What the writer says is not the Observer's domain. How they say it is.
- **Readability scores**: Composite metrics (Flesch-Kincaid, etc.) are useful as internal computation but too abstract for curation. The writer can't curate a number. They can curate the underlying behaviors that produce the number.
- **Biber-style dimensions**: Too corpus-dependent for per-entry observation. May become relevant as profile-level descriptors once enough entries accumulate.

### Granularity Rules

1. **Every observation must be curatable.** If the writer can't meaningfully answer "is this intentional?", the observation is at the wrong grain.
2. **Evidence over counts.** Cite text, not just statistics. A count is supporting data; the cited text is the observation.
3. **Patterns over instances.** A single unusual word is noise. Three entries with the same unusual word is a pattern worth naming.
4. **Comparison when available.** Against the writer's own history, not against external norms. "More passive than your average" is useful. "More passive than Hemingway" is not.
5. **Limit per entry.** Writing pedagogy consistently recommends 2-3 focus areas. The Observer should surface the most distinctive patterns, not every measurable feature.

### On Adaptive Granularity

Start coarse, refine with data. This happens naturally without configuration:

- **Entry 1-5**: Within-entry patterns only. Sentence rhythm, word habits, structural choices. No historical comparison possible.
- **Entry 6-20**: Baseline emerging. Can compare current entry against prior entries. "This is more/less X than your average."
- **Entry 20+**: Profile patterns solidifying. Can observe deviations from confirmed patterns. "You normally do X, but this entry does Y." Can offer finer distinctions within curated dimensions.

The system never asks the writer what to observe. It observes what the data supports and gets more precise as data accumulates.

---

## Confidence Assessment

| Claim | Confidence | Basis |
|-------|-----------|-------|
| Pattern-level is the right grain (not counts, not categories) | High | Converging evidence from three independent fields |
| Process-level feedback is most effective for building awareness | High | Hattie/Timperley meta-analysis, widely replicated |
| 2-3 observations per entry is the right volume | Medium | Pedagogy research, but ink-mirror's context differs (no instructor-student dynamic) |
| The six proposed categories cover the space | Medium | Synthesized from stylometry + tool analysis, but untested for curation usefulness |
| Adaptive granularity works without configuration | Medium | Follows from progressive disclosure principles, but needs validation in practice |
| Content/topic analysis should be excluded | High | Directly follows from vision: the Observer watches *how* you write, not *what* you write |

## Open Threads

- The proposed categories need validation against real journal entries. Do they produce observations that are actually curatable?
- The "2-3 per entry" guideline may be wrong for ink-mirror. Writing pedagogy assumes an instructor reviewing a student's work. ink-mirror is a mirror, not a teacher. The writer may want to see more, or the system may surface fewer when patterns are stable.
- The boundary between "word-level habits" and "tonal markers" is fuzzy. Both involve word choice. The distinction is whether the pattern is about specific word repetition (lexical) or about the attitude those words convey (tonal). This may collapse into a single category in practice.
- This research directly feeds into the minimum viable observation set (`.lore/issues/research-minimum-viable-observation.md`). The MVP should pick one structural dimension (sentence rhythm is the strongest candidate: measurable, visible, curatable) and one lexical/tonal dimension (word-level habits: specific, surprising to writers, easy to verify).
