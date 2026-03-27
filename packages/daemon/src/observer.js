/**
 * Observer: produces pattern-level observations from journal entries.
 *
 * Assembles context (Tier 1: system prompt + style profile + metrics + entry),
 * calls the session runner, validates output, and stores observations.
 *
 * Critical constraint: the Observer NEVER generates text for the user.
 * Observations describe patterns. No alternatives, corrections, or rewrites.
 * No comparisons to external norms or other writers (REQ-V1-9).
 */
import { ObserverOutputSchema } from "@ink-mirror/shared";
/**
 * Run the Observer on a submitted entry.
 * Returns stored observations and any validation errors.
 */
export async function observe(deps, entryId, entryText) {
    const { sessionRunner, observationStore, computeMetrics } = deps;
    const metrics = computeMetrics(entryText);
    const styleProfile = deps.readStyleProfile
        ? await deps.readStyleProfile()
        : "";
    // Tier 2 context: include last 5 entries when corpus >= 5 (REQ-V1-13)
    let recentEntryTexts = [];
    if (deps.corpusSize && deps.recentEntries) {
        const total = await deps.corpusSize();
        if (total >= 5) {
            const recent = await deps.recentEntries(5);
            recentEntryTexts = recent.map((e) => e.body);
        }
    }
    const system = buildSystemPrompt();
    const userMessage = buildUserMessage(entryText, metrics, styleProfile, recentEntryTexts);
    const response = await sessionRunner.run({
        system,
        messages: [{ role: "user", content: userMessage }],
        maxTokens: 2048,
    });
    const parsed = parseObserverOutput(response.content);
    if (!parsed.success) {
        return { observations: [], errors: [parsed.error] };
    }
    const validated = validateObservations(parsed.data, entryText);
    const stored = [];
    const errors = [...validated.errors];
    for (const raw of validated.valid) {
        const obs = await observationStore.save(entryId, raw);
        stored.push(obs);
    }
    return { observations: stored, errors };
}
// --- Prompt construction ---
export function buildSystemPrompt() {
    return `You are a writing pattern observer for a personal journal tool called ink-mirror.

Your role is to identify patterns in the writer's text. You describe what you see. You NEVER:
- Generate text for the writer
- Suggest alternatives, corrections, or rewrites
- Compare the writer's style to external norms, famous authors, or other writers
- Evaluate whether patterns are "good" or "bad"

You observe. You cite evidence. You name patterns.

## Observation Rules

1. Surface 2-3 observations per entry. Select the most distinctive patterns. Quality over quantity.
2. Each observation must pass the curation test: the writer can meaningfully answer "is this intentional?" If not, the observation is at the wrong grain.
3. Every observation must cite specific text from the entry as evidence. A count is supporting data; the cited text is the observation.
4. Name a specific pattern, not a broad category. "Uses three consecutive short sentences for emphasis at paragraph endings" not "varies sentence length."
5. Categorize each observation by dimension: "sentence-rhythm" or "word-level-habits".
6. All comparisons must be within the entry itself or against the writer's own style profile. NEVER compare to external standards.

## Dimensions

**sentence-rhythm**: Length patterns within the entry. Consecutive short or long sentences, pace changes between sections, uniformity or variation in sentence length.

**word-level-habits**: Repeated words or phrases, hedging language ("just", "actually", "probably", "I think"), intensifiers, filler patterns.

## Output Format

Respond with valid JSON only. No markdown fencing, no explanation outside the JSON.

{
  "observations": [
    {
      "pattern": "A specific, named pattern description",
      "evidence": "Exact quoted text from the entry demonstrating the pattern",
      "dimension": "sentence-rhythm" or "word-level-habits"
    }
  ]
}`;
}
export function buildUserMessage(entryText, metrics, styleProfile, recentEntries = []) {
    // Prompt layout (REQ-V1-15): recent entries at start (second highest attention),
    // current entry at the end (highest attention zone).
    const parts = [];
    // Tier 2: recent entries at the start for drift detection
    if (recentEntries.length > 0) {
        const entrySections = recentEntries
            .map((text, i) => `### Recent Entry ${i + 1}\n\n${text}`)
            .join("\n\n");
        parts.push(`## Recent Entries (for comparison against writer's own patterns)\n\n${entrySections}`);
    }
    if (styleProfile.trim()) {
        parts.push(`## Writer's Style Profile\n\n${styleProfile}`);
    }
    parts.push(`## Pre-computed Metrics\n\n${formatMetrics(metrics)}`);
    // Current entry at the end for highest attention (REQ-V1-15)
    parts.push(`## Current Entry\n\n${entryText}`);
    return parts.join("\n\n---\n\n");
}
function formatMetrics(metrics) {
    const lines = [];
    // Sentence rhythm summary
    const r = metrics.rhythm;
    lines.push("### Sentence Rhythm");
    lines.push(`- Sentence count: ${metrics.sentences.length}`);
    lines.push(`- Length sequence (words): [${r.lengthSequence.join(", ")}]`);
    lines.push(`- Mean sentence length: ${r.mean.toFixed(1)} words`);
    lines.push(`- Variance: ${r.variance.toFixed(1)}`);
    lines.push(`- Max consecutive short (≤${r.shortThreshold} words): ${r.maxConsecutiveShort}`);
    lines.push(`- Max consecutive long (≥${r.longThreshold} words): ${r.maxConsecutiveLong}`);
    if (r.paceChanges.length > 0) {
        lines.push("- Pace changes:");
        for (const pc of r.paceChanges) {
            lines.push(`  - At sentence ${pc.position}: ${pc.fromAvgLength.toFixed(1)} → ${pc.toAvgLength.toFixed(1)} avg words`);
        }
    }
    // Word frequency summary
    const wf = metrics.wordFrequency;
    lines.push("\n### Word-Level Habits");
    lines.push(`- Total tokens: ${wf.totalTokens}`);
    lines.push(`- Unique tokens: ${wf.uniqueTokens}`);
    if (Object.keys(wf.hedgingWords).length > 0) {
        lines.push("- Hedging words: " + Object.entries(wf.hedgingWords).map(([w, c]) => `"${w}" (${c}x)`).join(", "));
    }
    if (Object.keys(wf.intensifiers).length > 0) {
        lines.push("- Intensifiers: " + Object.entries(wf.intensifiers).map(([w, c]) => `"${w}" (${c}x)`).join(", "));
    }
    if (Object.keys(wf.repeatedPhrases).length > 0) {
        lines.push("- Repeated phrases: " + Object.entries(wf.repeatedPhrases).map(([p, c]) => `"${p}" (${c}x)`).join(", "));
    }
    // Top frequency words (excluding common function words)
    const topWords = Object.entries(wf.tokenFrequencies)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    if (topWords.length > 0) {
        lines.push("- Top 10 words: " + topWords.map(([w, c]) => `"${w}" (${c}x)`).join(", "));
    }
    return lines.join("\n");
}
export function parseObserverOutput(content) {
    // Strip markdown code fences if the LLM wrapped the JSON
    let cleaned = content.trim();
    if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }
    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    }
    catch {
        return { success: false, error: `Invalid JSON in observer output: ${cleaned.slice(0, 200)}` };
    }
    const result = ObserverOutputSchema.safeParse(parsed);
    if (!result.success) {
        return {
            success: false,
            error: `Observer output validation failed: ${result.error.message}`,
        };
    }
    return { success: true, data: result.data.observations };
}
/**
 * Validates each observation against the entry text.
 * REQ-V1-7: evidence must be cited text from the entry.
 * REQ-V1-5: each observation must have a named pattern.
 */
export function validateObservations(observations, entryText) {
    const valid = [];
    const errors = [];
    const normalizedEntry = entryText.toLowerCase();
    for (const obs of observations) {
        const issueList = [];
        // REQ-V1-5: must have a named pattern
        if (!obs.pattern || obs.pattern.trim().length === 0) {
            issueList.push("Missing pattern name");
        }
        // REQ-V1-7: evidence must appear in the entry text
        if (!obs.evidence || obs.evidence.trim().length === 0) {
            issueList.push("Missing cited evidence");
        }
        else if (!normalizedEntry.includes(obs.evidence.toLowerCase())) {
            issueList.push(`Cited evidence not found in entry text: "${obs.evidence.slice(0, 80)}"`);
        }
        if (issueList.length > 0) {
            errors.push(`Observation "${obs.pattern?.slice(0, 60) ?? "(no pattern)"}": ${issueList.join("; ")}`);
        }
        else {
            valid.push(obs);
        }
    }
    return { valid, errors };
}
