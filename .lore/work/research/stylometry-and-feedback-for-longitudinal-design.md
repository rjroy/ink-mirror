---
title: Stylometry and feedback research for the longitudinal design
date: 2026-07-03
status: active
tags: [stylometry, feedback, pedagogy, observer, longitudinal, style-profile, prior-art]
modules: [daemon, observer, curation, profile-store]
related: [.lore/vision.md]
---

# Stylometry and feedback research for the longitudinal design

Research gathered to ground the redesign of the observe→curate→profile pipeline. The motivating problem: observations are per-entry salience, but the product promise (a truthful style profile and skill-building feedback) requires longitudinal pattern confirmation, and no component aggregates across entries. The user is not a writing expert, so design thresholds and dimension choices need external grounding rather than intuition.

## Key Findings

1. **Function words and syntax are the stable style signal; content words are topic noise.** Decades of authorship-attribution work (back to Mosteller & Wallace on the Federalist Papers) show that unconscious habits (function-word frequencies, punctuation, sentence construction, phrase-level n-grams) persist across topics and time. Content vocabulary varies with topic and mood. Implication: ink-mirror's rhythm/structure dimensions are well-chosen; its word-frequency metrics should discount content words when making cross-entry claims (the metrics module already filters stop words the *wrong* direction for this: stop words ARE the signal for identity, content words are the noise).

2. **Reliable style claims need roughly 1,000–5,000 words of text; below that, claims are anecdote.** Attribution research converges on ~2,000 words as a reasonable lower bound, ~5,000 for confidence, with a hard floor of "several hundred words" for any signal at all. Accuracy rises with profile size (one study: 0.76 accuracy at 10k-word profiles vs 0.94 at 60k). Journal entries run a few hundred words, so **a single entry can never support a style claim**. This validates the skepticism that prompted this research and gives a concrete cold-start rule: the system should not assert "you do X" until the supporting corpus crosses a word-count threshold, roughly 5–10 entries.

3. **The profile-based paradigm is the established fix for short texts.** In attribution research, short samples are handled by treating all of an author's samples *cumulatively* (a "profile") rather than instance-by-instance. This directly endorses the ledger/dossier direction from the brainstorm: accumulate evidence per pattern across entries, make claims from the accumulation.

4. **Rolling stylometry exists and is the model for drift detection.** The `stylo` R package's `rolling.classify()` windows text sequentially to detect style change over a corpus. The technique (overlapping windows + per-window feature extraction) maps directly onto "trend over the last N entries" and is computable from ink-mirror's existing metrics without an LLM.

5. **Within-author variation is real and confounded by genre/topic/register.** Intra-author variability is high in informal writing (blogs are the studied analog closest to journals). Cross-genre comparisons perform worse than within-genre. Implication: recency weighting and context tagging (was this entry technical, emotional, narrative?) are not nice-to-haves; comparing a rant to a trip report will manufacture false drift.

6. **Pedagogy: process-level and self-regulation-level feedback are the most powerful for learning** (Hattie & Timperley's feedback-levels model). Self-level feedback (praise/judgment of the person) is least effective. ink-mirror's design is accidentally well-aligned: pattern observations are process-level, and curation ("is this intentional?") is self-regulation-level. The research says the *sequence* matters too: effective feedback moves task → process → self-regulation, which supports surfacing concrete evidence (task) before the pattern claim (process) before the curation question (self-regulation).

7. **Pedagogy: content-level feedback beats surface-level.** Meta-analyses of written corrective feedback find surface-level feedback has a small *negative* effect on writing quality. This cautions against letting the Observer drift toward mechanical/surface observations (the current computable-metrics bias) and supports expanding dimensions toward meaning-bearing patterns.

8. **Pedagogy: monitoring and self-regulation predict writing quality; deliberate practice requires feedback loops.** Kellogg & Whiteford's deliberate-practice argument: advanced writing skill comes from sustained practice with feedback, and the bottleneck is feedback cost. Self-regulated-learning research finds writers who explicitly monitor their own strategies produce better-structured text. The curate step is the monitoring mechanism; the missing longitudinal loop (did the accidental pattern decline?) is exactly the "knowledge of results" that deliberate practice requires. Research on expressive journaling (LIWC tradition) also found the benefit signature is *change over time* in word categories, meaning longitudinal trend is where the value is, not the snapshot.

9. **Prior art does snapshots, not longitude.** ProWritingAid reports are per-document with no cross-document aggregation model surfaced. LIWC is per-text category counting; longitudinal use is a research technique, not a product feature. 750words.com is the closest journaling analog (daily writing + per-entry stats + streaks) but its analysis is per-entry mood/topic categorization, not style-pattern confirmation. Authorship tools (stylo, JGAAP) have the right aggregation math but are researcher tools with no feedback loop. **The longitudinal confirmation + curation loop appears to be genuinely unoccupied territory.**

## What this settles from the brainstorm

- **The stats-first substrate is correct and research-endorsed.** Function-word frequencies, punctuation habits, sentence-length distributions tracked as a per-entry time series is exactly the feature set attribution research trusts. The LLM should narrate verified statistics, not generate counts.
- **Sighting thresholds have a principled basis.** Word count, not entry count, is the unit: a pattern claim needs support drawn from ≥ ~2,000 words of corpus. For typical entries that's roughly 5–10 entries, which happens to match the existing Tier-2 activation (corpus ≥ 5), so the wiring is half-there.
- **Probation for profile rules (option D) is endorsed** by the profile-based attribution paradigm: claims come from cumulative evidence, never single instances.
- **Rule health / decay (option E) is endorsed** by within-author drift findings and by rolling stylometry as the mechanism.
- **Frequency-gating worry is resolved asymmetrically.** Attribution research gates *system* claims on volume. Nothing in pedagogy research says the *writer's* deliberate one-off choices need statistical support; self-regulation feedback is about the writer's own judgment. So: the system can't promote without recurrence, the writer can bless anything. The asymmetric standard from the brainstorm holds.
- **The "accidental watch list with trend" is the highest-pedagogical-value feature.** It closes the deliberate-practice loop (knowledge of results) and matches the LIWC finding that change-over-time is the meaningful signal.

## Open questions the research did not settle

- Pattern identity matching (is observation A the same habit as observation B?) has no off-the-shelf answer; attribution works in feature space, not named-pattern space. The LLM-matches-against-known-patterns approach remains a design bet needing its own validation.
- Genre/context tagging of entries: worth the friction? Research says context confounds comparisons, but auto-tagging by the Observer may suffice.
- Exact within-author stability numbers for journal-sized informal text don't exist in the literature found; the 2,000-word threshold comes from formal attribution settings and should be treated as an order-of-magnitude guide, not a constant.

## Sources

**Stylometry features and thresholds**
- [Authorship Attribution through Function Word Adjacency Networks](https://arxiv.org/pdf/1406.4469)
- [Stylometric Features for Multiple Authorship Attribution (Harvard DASH)](https://dash.harvard.edu/bitstreams/134f7996-6b3b-4d93-a9cc-f45669ab351c/download)
- [Does size matter? Authorship attribution, small samples, big problem](https://www.researchgate.net/publication/274151528_Does_size_matter_Authorship_attribution_small_samples_big_problem)
- [Stylometry and forensic science: A literature review (NIH/PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11707938/)
- [Survey of Methods in Computational Literary Studies: Corpus Building for Authorship Attribution](https://methods.clsinfra.io/corpus-author.html)
- [A Profile-Based Method for Authorship Verification (Springer)](https://link.springer.com/chapter/10.1007/978-3-319-07064-3_25)
- [Combining style and semantics for robust authorship verification (ScienceDirect)](https://www.sciencedirect.com/science/article/pii/S266682702500115X)

**Rolling stylometry / drift**
- [Computational Stylistics Group: Testing rolling stylometry](https://computationalstylistics.github.io/blog/rolling_stylometry/)
- [stylo rolling.classify documentation](https://rdrr.io/cran/stylo/man/rolling.classify.html)

**Feedback and pedagogy**
- [Hattie & Timperley feedback levels, BERA summary](https://www.bera.ac.uk/blog/how-to-optimise-the-use-of-hattie-and-timperleys-feedback-levels-for-student-learning)
- [An Exploration of Feedback Using Hattie and Timperley's Feedback Levels (PubMed)](https://pubmed.ncbi.nlm.nih.gov/40526854/)
- [Efficacy of Written Corrective Feedback in Writing Instruction: A Meta-Analysis (TESL-EJ)](https://tesl-ej.org/wordpress/issues/volume24/ej95/ej95a3/)
- [How effective is feedback for L1, L2, and FL learners' writing? A meta-analysis (ScienceDirect)](https://www.sciencedirect.com/science/article/pii/S0959475224000884)
- [Kellogg & Whiteford, Training Advanced Writing Skills: The Case for Deliberate Practice](https://www.tandfonline.com/doi/abs/10.1080/00461520903213600)
- [Impacts of Self-Regulated Strategy Development-Based Revision Instruction (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8321093/)

**Prior art**
- [ProWritingAid Writing Style Report](https://help.prowritingaid.com/article/353-how-to-use-the-writing-style-report)
- [LIWC manual (psychometrics of word-count analysis)](https://www.liwc.app/static/documents/LIWC1999%20Manual%20-%20Operation,%20Development,%20and%20Psychometrics.pdf)
- [750words.com analysis example (GitHub)](https://github.com/Swizec/750words-analysis)
