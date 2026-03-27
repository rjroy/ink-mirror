---
title: "Research: Observer History Window Strategy"
status: complete
date: 2026-03-26
resolves: .lore/issues/research-observer-history-window.md
tags: [observer, research, performance, cost, rag]
---

# Observer History Window Strategy

## Question

How much historical context does the Observer need when analyzing a new entry? The full corpus is expensive and slow. No history makes observations shallow. What's the right window?

## Summary of Findings

The full corpus should never be sent raw. A hybrid strategy outperforms both fixed windows and full-corpus approaches: send the **style profile as compressed history**, a **recency window** of recent entries, and optionally **retrieve similar past entries** via embedding search. This keeps input tokens low (3,000-8,000 per observation) while preserving the depth that comes from a large corpus.

The style profile is the key insight. It IS the compressed history. Every confirmed pattern represents information extracted from dozens of past entries. Sending the profile instead of the entries it was built from gives the Observer the same analytical power at a fraction of the token cost.

---

## Evidence

### How much text is needed to identify stylistic patterns?

Maciej Eder's stylometry research established thresholds for reliable authorship attribution. His initial finding was 5,000 running words minimum; later work revised this down to 2,000 words in favorable conditions ([Eder 2015, "Does size matter?"](https://www.academia.edu/17435663/Does_size_matter_Authorship_attribution_small_samples_big_problem); [Eder 2017, "Short Samples in Authorship Attribution"](https://www.semanticscholar.org/paper/Short-Samples-in-Authorship-Attribution:-A-New-Eder/8e55de66c9c8060cd19ecac8bac25b311ad42184)). These thresholds use statistical features (word frequency distributions, function word usage) rather than LLM comprehension, so they represent a floor, not a ceiling.

**What this means for ink-mirror:** A typical journal entry runs 200-500 words. At 5,000 words minimum, the Observer needs roughly 10-25 entries before it can make reliable claims about patterns. At 2,000 words, it needs 4-10. The first few observations will necessarily be shallow. This is fine; the system should be honest about it.

**Confidence level:** Verified against published research. The 2,000-5,000 word range is well-established in computational stylistics. LLMs likely need less because they understand semantics, not just statistics, but I found no direct study measuring LLM stylistic detection vs. sample size.

### RAG retrieval vs. long context: what the benchmarks show

Sending everything into a long context window is both expensive and counterproductive. Key findings:

- **Lost in the Middle** (Liu et al., Stanford, 2023; [arxiv:2307.03172](https://arxiv.org/abs/2307.03172)): LLM accuracy on information retrieval tasks drops 20-30% when relevant information is in the middle of the context. Performance follows a U-shape: best at the start and end, worst in the middle. This is architectural (caused by Rotary Position Embeddings and causal masking), not a training artifact.

- **RAG maintains quality at lower cost** ([Pinecone, "Less is More"](https://www.pinecone.io/blog/why-use-retrieval-instead-of-larger-context/)): In benchmarks using the QuALITY dataset, retrieval-augmented generation maintained 95% of baseline accuracy using only 25% of the original tokens. RAG was measured at 8-82x cheaper than long-context approaches for typical workloads.

- **Fewer, more relevant documents beat more documents** (same source): Accuracy declined consistently as document count increased, regardless of document diversity. Models perform best when given fewer, highly relevant inputs.

**What this means for ink-mirror:** Stuffing 200 entries into context would be both expensive and likely to degrade observation quality. The Observer would attend most to the current entry (at the end) and the first few historical entries, while entries in the middle would be functionally invisible. Selective retrieval of 3-5 relevant past entries will outperform sending 50.

**Confidence level:** Verified against peer-reviewed research and reproducible benchmarks. The lost-in-the-middle effect has been replicated across every major model family through 2025.

### How Grammarly handles voice profiling

Grammarly's "personal voice" feature (launched October 2023) is the closest commercial analog to what ink-mirror's Observer does. Key design decisions ([TechCrunch, Oct 2023](https://techcrunch.com/2023/10/25/grammarlys-new-generative-ai-feature-learns-your-style-and-applies-it-to-any-text/); [Neowin coverage](https://www.neowin.net/news/grammarly-announces-new-generative-ai-feature-that-learns-your-writing-style/)):

- **Passive accumulation.** The profile builds automatically as you write across apps. No explicit "analyze my history" step. The user never thinks about how much text the system has seen.
- **Separate profiles by context.** Short messages get one profile, long documents get another. The system recognizes that voice varies by medium.
- **User-editable profile.** The generated description can be customized. Users can discard elements that don't reflect how they write.
- **No visible window.** Grammarly never exposes how many documents it analyzed or how far back it looked. The profile just improves over time.

**What this means for ink-mirror:** The frictionless principle is validated by commercial practice. Grammarly's approach confirms that the history window should be invisible to the user. Where ink-mirror diverges: Grammarly auto-applies corrections based on the profile. ink-mirror only observes. This means ink-mirror can be more aggressive about surfacing patterns (no risk of wrong auto-corrections).

**Confidence level:** Verified against product announcements and support documentation. Grammarly does not publish implementation details (how many tokens, what embedding strategy, etc.).

### Cost modeling

Assumptions for a single observation:
- Journal entry: 300-700 tokens (~200-500 words)
- System prompt + observation instructions: ~1,500 tokens
- Observer output (observations): ~800 tokens
- Style profile (when it exists): ~500-1,500 tokens

#### Per-observation cost by model and history window

| History Strategy | Input Tokens | Haiku 4.5 Cost | Sonnet 4.6 Cost | Notes |
|---|---|---|---|---|
| Entry only (no history) | ~2,500 | $0.003 | $0.008 | Shallow observations, no comparison |
| Entry + profile | ~3,500 | $0.004 | $0.011 | Compressed history via profile |
| Entry + profile + 5 recent | ~6,000 | $0.006 | $0.018 | Recency window for drift detection |
| Entry + profile + 5 recent + 3 retrieved | ~8,000 | $0.008 | $0.024 | Full hybrid strategy |
| Entry + 50 raw entries | ~27,000 | $0.027 | $0.081 | Brute force, no profile |
| Entry + 200 raw entries | ~102,000 | $0.102 | $0.306 | Full corpus, worst case |

Output costs add ~$0.004 (Haiku) or ~$0.012 (Sonnet) per observation.

**Monthly cost at daily journaling (Haiku, hybrid strategy):** ~$0.36/month.
**Monthly cost at daily journaling (Sonnet, hybrid strategy):** ~$1.08/month.
**Monthly cost at daily journaling (Sonnet, 200-entry brute force):** ~$9.54/month.

([Anthropic pricing page](https://platform.claude.com/docs/en/about-claude/pricing): Haiku 4.5 at $1/$5 per MTok, Sonnet 4.6 at $3/$15 per MTok.)

**Prompt caching opportunity:** The system prompt, style profile, and recent entries are stable across sequential observations. With 5-minute caching (cache hits at 10% of input price), the input cost for the stable portion drops by ~90%. If a user submits multiple entries in a session, subsequent observations would cost roughly half.

**Batch API opportunity:** If observations are not time-sensitive (queued and processed async), the 50% batch discount applies. Combined with caching, hybrid strategy costs under $0.15/month on Haiku.

**What this means for ink-mirror:** The hybrid strategy (profile + recency + retrieval) costs 3-13x less than brute-forcing 50 entries, and 13-40x less than sending the full corpus. The quality is better too (see RAG findings above). Cost is not a blocking concern at any reasonable model choice.

**Confidence level:** Computed from verified pricing. Token estimates for journal entries are assumptions (calibrate against real entries once they exist).

### Recency weighting vs. fixed windows

Research on context management strategies ([IBM, "What is a context window?"](https://www.ibm.com/think/topics/context-window); [Agenta, "Top techniques to manage context length"](https://agenta.ai/blog/top-6-techniques-to-manage-context-length-in-llms)):

- **Importance scoring** in production systems combines recency, topical relevance, entity tracking, and user interaction metadata. Pure recency weighting is one component, not a complete strategy.
- **Retrieval with a small context window** (4K tokens + RAG) matches performance of fine-tuned models with 16K windows ([arxiv:2310.03025](https://arxiv.org/abs/2310.03025)). The retrieval quality matters more than the window size.
- **Position placement matters.** Relevant context placed at the end of the input performs best. The current entry should always be last.

**What this means for ink-mirror:** A fixed window of "last N entries" is worse than a mixed strategy of "last few + most relevant." Recency captures drift; relevance captures pattern recurrence. Both matter. The current entry should be positioned last in the prompt.

**Confidence level:** Verified against published research. The "retrieval beats large windows" finding is reproducible across benchmarks.

---

## Proposed Strategy: Three-Tier Hybrid

### Tier 1: Always Included (every observation)

| Component | Approx. Tokens | Purpose |
|---|---|---|
| System prompt + instructions | 1,500 | Observer behavior and output format |
| Style profile (accumulated) | 500-1,500 | Compressed history of all confirmed patterns |
| Current entry | 300-700 | The text being observed |

**Total: ~2,300-3,700 tokens.** Available from the first entry. The style profile starts empty and grows as the user curates observations.

### Tier 2: Recency Window (when corpus >= 5 entries)

Add the **last 5 entries** to the context. This enables drift detection: "This entry uses shorter sentences than your recent work." Five entries is enough to establish a local baseline without overwhelming the context.

Why 5, not 10 or 20: The lost-in-the-middle research shows diminishing returns as document count increases. Five recent entries at ~500 tokens each adds ~2,500 tokens and fits comfortably in the high-attention zone at the start of the context.

**Total with Tier 2: ~5,000-6,500 tokens.**

### Tier 3: Semantic Retrieval (when corpus >= 20 entries)

When the corpus is large enough to make retrieval meaningful, embed all entries and retrieve the **3 most similar past entries** to the current one. This surfaces recurring patterns across time: "You tend to use passive voice when writing about work topics" (because the retrieved entries are thematically similar and share the pattern).

Why 3 retrieved entries: Pinecone's benchmarks show accuracy peaks with fewer, highly relevant documents. Three is enough to establish a pattern without diluting the context.

**Total with Tier 3: ~6,500-8,500 tokens.**

### Context Layout (position matters)

```
[System prompt + Observer instructions]     ← stable, cacheable
[Style profile]                              ← stable within session, cacheable
[5 recent entries, oldest first]             ← start of context, primacy zone
[3 retrieved similar entries]                ← middle (acceptable; these are supplementary)
[Current entry]                              ← end of context, recency zone (highest attention)
[Output instructions]                        ← final framing
```

This layout places the current entry in the highest-attention position (end) and recent entries in the second-highest (start). Retrieved entries go in the middle where attention is lowest, but that's acceptable because they're supplementary context, not the primary analysis target.

---

## Options and Tradeoffs

### Option A: Profile-only (no retrieval infrastructure)

Ship with Tiers 1 and 2 only. The style profile and recency window handle the common case. No embedding database needed.

**Pro:** Simpler architecture. No embedding model dependency. The style profile already compresses history.
**Con:** Cannot surface cross-temporal patterns ("you do X when writing about Y"). Misses thematic clustering. Observations plateau once the profile stabilizes.

### Option B: Full hybrid (all three tiers)

Add embedding-based retrieval once the corpus reaches ~20 entries.

**Pro:** Richer observations. Catches patterns that recency alone misses. Gets better over time without degrading from noise.
**Con:** Requires an embedding pipeline (model selection, index management, storage). More moving parts.

### Option C: Deferred retrieval

Ship Option A. Add retrieval later as a separate milestone.

**Pro:** Validates the core loop (write-observe-curate) before adding infrastructure. The profile mechanism alone may be sufficient for v1.
**Con:** If observations feel shallow without retrieval, it's hard to tell whether the problem is the Observer prompt or the missing context.

### Embedding approach (if retrieval is chosen)

Two paths, not mutually exclusive:

1. **Local embeddings** (e.g., `all-MiniLM-L6-v2` via sentence-transformers): Free, fast, ~22M parameters. Runs locally. Quality is adequate for topical similarity in personal writing. No API dependency.

2. **API embeddings** (e.g., OpenAI `text-embedding-3-small` at $0.02/MTok, or Voyage AI): Higher quality retrieval. Adds a dependency and small ongoing cost (~$0.001 per entry embedded).

For a personal writing corpus that grows by 1 entry/day, even the API approach costs under $0.01/month for embedding. The choice is about dependency tolerance, not cost.

---

## What I Could Not Verify

- **LLM stylistic detection vs. sample size.** Eder's 2,000-5,000 word thresholds are for statistical stylometry (function word frequencies, etc.). An LLM with semantic comprehension likely needs less text to detect patterns, but I found no published study measuring this directly. The threshold for ink-mirror's Observer is an open empirical question that should be tested against real journal entries.

- **Grammarly's internal architecture.** The product behavior is documented, but the implementation (how many tokens, what models, what embedding strategy) is not public. The design principles are transferable; the engineering details are not.

- **Whether the style profile alone is sufficient context.** This is the central bet of the proposed strategy. The profile compresses history, but it's also filtered through the user's curation. Patterns the user hasn't curated yet are invisible to the profile. The recency window partially compensates, but there may be a gap between "patterns in the profile" and "patterns in the corpus" that neither tier covers. This requires testing.

- **Optimal recency window size.** I proposed 5 entries based on the lost-in-the-middle research and token budget reasoning. Whether 3 or 7 or 10 is better is an empirical question. The cost difference between 3 and 10 recent entries is ~$0.003 per observation on Haiku, so the constraint is quality, not budget.

---

## Sources

- [Eder, "Does size matter? Authorship attribution, small samples, big problem" (2015)](https://www.academia.edu/17435663/Does_size_matter_Authorship_attribution_small_samples_big_problem) - Minimum sample sizes for stylometry
- [Eder, "Short Samples in Authorship Attribution: A New Approach" (2017)](https://www.semanticscholar.org/paper/Short-Samples-in-Authorship-Attribution:-A-New-Eder/8e55de66c9c8060cd19ecac8bac25b311ad42184) - Revised minimum down to 2,000 words
- [Liu et al., "Lost in the Middle" (Stanford, 2023)](https://arxiv.org/abs/2307.03172) - Position bias in long-context LLMs
- [Pinecone, "Less is More: Why Use Retrieval Instead of Larger Context Windows"](https://www.pinecone.io/blog/why-use-retrieval-instead-of-larger-context/) - RAG vs. long context benchmarks
- [Anthropic API Pricing](https://platform.claude.com/docs/en/about-claude/pricing) - Token costs for Claude models
- [Grammarly voice profile announcement (TechCrunch, Oct 2023)](https://techcrunch.com/2023/10/25/grammarlys-new-generative-ai-feature-learns-your-style-and-applies-it-to-any-text/) - Commercial prior art
- [Xu et al., "Retrieval meets Long Context" (2023)](https://arxiv.org/abs/2310.03025) - 4K+RAG matching 16K fine-tuned performance
- [RAGFlow, "From RAG to Context" (2025)](https://ragflow.io/blog/rag-review-2025-from-rag-to-context) - RAG architecture evolution
