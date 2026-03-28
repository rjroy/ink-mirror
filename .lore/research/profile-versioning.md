---
title: "Research: Style Profile Versioning Over Time"
status: complete
date: 2026-03-26
related:
  - .lore/issues/research-profile-versioning.md
tags: [style-profile, versioning, research, voice-evolution]
---

# Style Profile Versioning Over Time

## The Question

How should ink-mirror capture voice evolution? Should old profile versions be preserved? What does a useful "voice diff" look like?

## How Writing Voice Actually Changes

### Evidence: Both Gradual Drift and Punctuated Shifts

The evidence points to voice change being predominantly gradual, with occasional deliberate shifts.

**Gradual drift is the default mode.** A 2022 PLOS ONE study (Hernandez-Castaneda et al.) analyzed eleven authors' complete careers using n-gram features and supervised classification. The key finding: "The way of structuring sentences and the frequency of use of syntactic structures by some authors changed gradually." All eleven authors showed statistically significant style change, but none showed evidence of sudden switches. Style evolution was continuous rather than discrete. [Source: [PLOS ONE](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0267590)]

**Diachronic corpus studies confirm this.** Klaussner and Vogel (2018) built a diachronic corpus of 22 American literary authors. Henry James showed identifiable periods (early 1877-1881, intermediate 1886-1890, late 1897-1917), but these phases emerged from gradual accumulation, not sudden breaks. James progressively increased his use of adverbs and abstract diction over decades. The phases are visible only in retrospect; at any given moment, the change was incremental. [Source: [ACL Anthology](https://aclanthology.org/L18-1552/)]

**Composition studies describe voice development as gradual and context-dependent.** Researchers describe achieving style as "a gradual thing...becoming more versed" in one's own patterns. Voice is not found in a single moment but through sustained practice over time. [Source: [Composition Forum](https://compositionforum.com/issue/43/voice.php)]

**However, deliberate reinventions do happen.** Writers change genres, adopt new registers, or consciously reshape their approach. These are punctuated events against a background of steady drift. The biological metaphor of punctuated equilibrium applies: long periods of stasis interrupted by brief rapid change, with both modes coexisting.

**Confidence level: Verified against multiple sources.** The gradual-as-default pattern is consistent across computational stylistics, composition pedagogy, and corpus linguistics. The existence of punctuated shifts is inferred from literary history (genre changes, career pivots) rather than measured computationally, but is consistent with the concept drift literature in ML.

### What Changes

The PLOS ONE study found four categories of features that shift over time, ordered by discriminative power:

1. **Syntactic structures** (how sentences are built) - most discriminative
2. **POS tag distributions** (grammatical patterns) - highly discriminative
3. **Word n-grams** (vocabulary and phrasing) - moderately discriminative
4. **Character n-grams** (punctuation, capitalization habits) - moderately discriminative

This maps reasonably well to ink-mirror's observation categories (structural, tonal, lexical, rhythmic). Structural patterns change the most; individual word choices change the least.

### Contextual Voice vs. Temporal Voice

An important nuance from composition research: voice is not a single fixed thing that drifts over time. Writers have multiple registers that activate in different contexts. A writer might use short declarative sentences in technical writing and long flowing ones in journal entries, and both are "their voice."

ink-mirror's vision already accounts for this (the contradiction escalation pattern in the vision doc). But it matters for versioning: a style profile change might reflect the writer exploring a new context, not their voice actually evolving. The versioning model needs to distinguish temporal evolution from contextual variation.

**Confidence level: Verified.** Composition Forum research explicitly describes writers having "an endless array of identity positions." The vision doc's contradiction-handling mechanism addresses this, but the versioning model needs to be aware of it.

## Detection Methods from Computational Stylistics

### Rolling Stylometry

The Computational Stylistics Group developed "Rolling Stylometry" (Eder, 2016): a method that moves a sliding window through text, performing style classification on each overlapping chunk. Key parameters:

- **Window size**: 5,000 words with 4,500-word overlap in published examples
- **Feature set**: Most Frequent Words (MFWs), with different counts revealing different patterns (100 MFWs catches patterns invisible at 1,000 MFWs)
- **Classification**: SVM, Nearest Shrunken Centroids, or Delta measures

[Source: [Computational Stylistics Group](https://computationalstylistics.github.io/projects/rolling-stylometry/)]

**Relevance to ink-mirror:** The sliding window concept is directly applicable. Rather than comparing "today's entry vs. profile," ink-mirror could compare rolling windows of entries (last 10, last 30, last 100) against the accumulated profile. This naturally captures drift without requiring explicit snapshots.

### Feature-Based Change Detection

The PLOS ONE study's approach: characterize time periods by n-gram frequency distributions, then classify whether a text belongs to "early" or "late" style. Accuracy above 70% for most authors means the signal is real and detectable.

**Relevance to ink-mirror:** The Observer already extracts features from entries. Tracking feature distributions over time (sentence length distribution, vocabulary diversity, structural pattern frequencies) and detecting when distributions shift significantly is a natural extension.

## Version Models: Options for ink-mirror

Three models emerge from the evidence. They are not mutually exclusive.

### Option A: Rolling Window (No Explicit Versions)

**How it works:** The profile is always "current." It's computed from the most recent N entries (or N months of entries), weighted toward the present. Older entries contribute less. There are no snapshots to manage.

**What comparison looks like:** "Your average sentence length has shifted from 14 words (3 months ago) to 18 words (recent entries)." The system computes diffs on demand by comparing the current window against a historical window.

**Pros:**
- Frictionless (no snapshots to create or manage)
- Naturally captures gradual drift
- No storage overhead for version history
- Aligns with how computational stylistics actually measures change (sliding windows)

**Cons:**
- No stable reference points for "this was my voice in January"
- Diffs are computed, not stored, so comparison queries have compute cost
- If the user wants to preserve a specific voice state (before a deliberate shift), there's no mechanism for it
- Continuous decay means old patterns eventually disappear entirely

### Option B: Periodic Automatic Snapshots

**How it works:** The system automatically saves a timestamped copy of the profile at regular intervals (monthly, quarterly, or triggered by detected significant change). The "current" profile is always live and evolving.

**What comparison looks like:** "Comparing your March 2026 profile to your September 2025 profile: you've shifted from predominantly compound sentences to shorter declarative patterns. Your vocabulary diversity score increased 12%."

**Pros:**
- Stable reference points for comparison
- Frictionless (automatic, not user-triggered)
- Meaningful for self-reflection ("how has my voice changed this year?")
- Low storage cost (profiles are small documents)

**Cons:**
- Arbitrary timing (monthly snapshots miss the actual moment of change)
- Can accumulate noise if the profile hasn't meaningfully changed between snapshots
- Requires a strategy for snapshot pruning over long time horizons

### Option C: Change-Triggered Snapshots

**How it works:** The system monitors for statistically significant shifts in the profile. When a shift is detected (using techniques from concept drift detection), it automatically saves a snapshot of the pre-shift state. Between shifts, no snapshots are created.

**What comparison looks like:** "Your voice shifted significantly around October 2025. Before that shift, your writing favored passive constructions and longer sentences. After, you moved toward active voice and shorter structures."

**Pros:**
- Snapshots align with actual voice changes, not arbitrary dates
- Naturally captures both gradual drift (detected as accumulated small changes cross a threshold) and punctuated shifts (detected immediately)
- No noise from unchanged periods
- Aligns with concept drift detection literature (proven techniques exist)

**Cons:**
- Threshold tuning: too sensitive creates noise, too conservative misses subtle change
- Requires enough data to detect change reliably (cold start problem)
- More complex to implement than periodic snapshots
- The user might disagree with when the system decided a "significant" change occurred

### Hybrid Recommendation

**Not a recommendation in the prescriptive sense, but the evidence points toward a specific combination.** The concept drift literature (Evidently AI, various ML surveys) consistently finds that combining periodic baselines with change-triggered alerts outperforms either alone. Applied to ink-mirror:

- **Rolling window as the live profile** (Option A as the foundation)
- **Periodic snapshots as anchors** (Option B at low frequency, quarterly or biannually)
- **Change-triggered annotations on the timeline** (Option C's detection logic, but annotating rather than snapshotting)

This gives the user: a profile that's always current, stable comparison points for self-reflection, and alerts when something significant shifts.

## What a Useful "Voice Diff" Looks Like

### What the Research Suggests

The PLOS ONE study's most discriminative features were syntactic structures, not individual words. A useful diff should emphasize structural and pattern-level changes over lexical ones.

Rolling stylometry's window-based approach suggests diffs should compare distributions, not individual data points. "Your sentence length distribution shifted" is more meaningful than "you wrote a 40-word sentence."

### Proposed Diff Dimensions

Based on the evidence, a voice diff should cover:

| Dimension | Example | Source |
|-----------|---------|--------|
| **Structural patterns** | "Shifted from compound to simple sentence structures" | PLOS ONE: syntactic features most discriminative |
| **Rhythm/cadence** | "Sentence length variation decreased (more uniform)" | Klaussner & Vogel: temporal feature analysis |
| **Tonal register** | "More declarative, fewer hedging constructions" | Composition studies: voice as stance |
| **Vocabulary** | "Vocabulary diversity increased; fewer repeated phrases" | PLOS ONE: word n-grams |
| **Confirmed pattern changes** | "3 patterns previously marked intentional are now absent" | ink-mirror's curation model |

### What to Show vs. What to Store

The system should store raw feature distributions over time (compact numerical data). The human-readable diff should be generated on demand by the Observer, interpreting what the distribution changes mean in plain language. This separation keeps storage lean while making diffs meaningful.

**Store:** Feature vectors per entry or per time window. Sentence length distributions, vocabulary metrics, POS tag frequencies, structural pattern frequencies.

**Generate on demand:** Natural language descriptions of what changed. "You've been writing longer sentences with more subordinate clauses. Your technical entries have moved toward passive voice while your journal entries stayed active."

### How Much History Is Useful

The concept drift literature identifies a key tradeoff: too much history smooths out real changes; too little creates false alarms from noise.

**For self-reflection:** Quarterly or biannual comparison is enough. The Klaussner/Vogel corpus study found that meaningful style periods span years, not weeks. Monthly diffs would mostly show noise.

**For the Observer's temporal awareness:** A rolling window of 20-50 entries provides enough signal for comparison without requiring the full archive. This aligns with the sliding window sizes that worked in computational stylistics research.

**For long-term preservation:** Keep periodic snapshots indefinitely but space them further apart as they age. Monthly snapshots for the current year, quarterly for prior years, annually beyond that. This is analogous to log rotation and keeps the archive from growing unboundedly.

## Open Questions Remaining

1. **Threshold calibration for change detection.** The concept drift literature offers multiple detection methods (ADWIN, DDM, KSWIN), but the right sensitivity for voice change in journal entries is unknown. This likely needs empirical tuning with real user data.

2. **Cold start.** How many entries does the system need before it can meaningfully detect change? The PLOS ONE study used complete novels; ink-mirror has journal entries. The minimum viable history window is probably 20-30 entries, but this is inferred, not verified.

3. **Contextual vs. temporal variation.** The system needs a way to distinguish "I write differently in different contexts" from "my voice is changing over time." This might require entries to carry context metadata (topic, genre, mood) or might be inferable from the text itself.

4. **User-initiated anchoring.** The frictionless principle says versioning should be automatic. But should the user be able to say "I'm deliberately changing my voice now, mark this moment"? This is a design decision, not a research question.

## Sources

- Hernandez-Castaneda et al. (2022). "Detection of changes in literary writing style using N-grams as style markers and supervised machine learning." [PLOS ONE](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0267590)
- Klaussner & Vogel (2018). "A Diachronic Corpus for Literary Style Analysis." [ACL Anthology](https://aclanthology.org/L18-1552/)
- Eder (2016). "Rolling Stylometry." [Digital Scholarship in the Humanities](https://academic.oup.com/dsh/article-abstract/31/3/457/1745764) / [Project Page](https://computationalstylistics.github.io/projects/rolling-stylometry/)
- Composition Forum Issue 43. "Knowing Students and Hearing Their Voices in Writing." [Composition Forum](https://compositionforum.com/issue/43/voice.php)
- Evidently AI. "Concept Drift in ML." [Evidently AI](https://www.evidentlyai.com/ml-in-production/concept-drift)
- Various ML surveys on concept drift detection methods (ADWIN, DDM, KSWIN)
