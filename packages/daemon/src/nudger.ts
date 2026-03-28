/**
 * Nudger: surfaces craft patterns as Socratic questions.
 *
 * Draws from twelve craft principles (Williams, Zinsser, Pinker, King,
 * Orwell, Strunk & White) and asks whether observed patterns were intentional.
 * Never corrects, rewrites, or suggests alternatives (REQ-CN-18).
 *
 * Separate from the Observer: the Observer compares you to yourself,
 * the nudge compares you to collective craft wisdom (REQ-CN-30).
 */

import type { EntryMetrics, CraftNudge } from "@ink-mirror/shared";
import { NudgeOutputSchema } from "@ink-mirror/shared";
import type { SessionRunner } from "./session-runner.js";
import { isPassiveVoice } from "./metrics/index.js";

export interface NudgerDeps {
  sessionRunner: SessionRunner;
  computeMetrics: (text: string) => EntryMetrics;
  readStyleProfile?: () => Promise<string>;
}

export interface NudgeResult {
  nudges: CraftNudge[];
  metrics: {
    passiveRatio: number;
    totalSentences: number;
    hedgingWordCount: number;
    rhythmVariance: number;
  };
  error?: string;
}

/**
 * Run the nudge analysis on a piece of text.
 * Returns craft nudges and the metrics summary.
 */
export async function nudge(
  deps: NudgerDeps,
  text: string,
  context?: string,
): Promise<NudgeResult> {
  const { sessionRunner, computeMetrics } = deps;

  const metrics = computeMetrics(text);
  let styleProfile = "";
  if (deps.readStyleProfile) {
    try {
      styleProfile = await deps.readStyleProfile();
    } catch {
      // Profile is optional calibration (REQ-CN-15). A read failure
      // should not take down the nudge endpoint.
    }
  }

  const system = buildNudgeSystemPrompt();
  const userMessage = buildNudgeUserMessage(text, metrics, styleProfile, context);

  const response = await sessionRunner.run({
    system,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 2048,
  });

  const parsed = parseNudgeOutput(response.content);

  const hedgingWordCount = Object.values(metrics.wordFrequency.hedgingWords)
    .reduce((sum, count) => sum + count, 0);

  const metricsSummary = {
    passiveRatio: metrics.sentenceStructure.passiveRatio,
    totalSentences: metrics.sentenceStructure.totalSentences,
    hedgingWordCount,
    rhythmVariance: metrics.rhythm.variance,
  };

  if (!parsed.success) {
    return { nudges: [], metrics: metricsSummary, error: parsed.error };
  }

  return { nudges: parsed.data, metrics: metricsSummary };
}

// --- Prompt construction ---

export function buildNudgeSystemPrompt(): string {
  return `You are a craft pattern analyst for a writing tool called ink-mirror.

You surface craft patterns as questions. You never answer the questions. You never correct, rewrite, or suggest alternatives. Every question offers at least one reading where the pattern is a legitimate choice.

## Craft Knowledge

The following principles are organized by detection confidence. Tier 1 principles have quantitative evidence in the pre-computed metrics. Tier 2 have partial metric support. Tier 3 require your judgment.

### Tier 1: Metrically Detectable

**passive-voice-clustering** (Principle 3)
Consecutive passive sentences where actors are invisible. The signal is clustering, not individual instances. A single passive in active context is almost never worth flagging. Legitimate when: the actor is irrelevant, unknown, or when institutional register requires it (lab reports, policy documents).

**sentence-monotony** (Principle 6)
Sustained stretches where sentence length variance is low. Every sentence in the same word-count band creates a metronomic rhythm. Legitimate when: deliberate pacing for effect (staccato urgency, flowing meditation).

**hedging-accumulation** (Principle 9)
Multiple hedging markers in a single sentence or across a short passage ("might possibly," "could potentially," "I think perhaps"). One hedge signals thoughtful uncertainty. Three or more signals a writer who doesn't trust their own point. Legitimate when: genuine epistemic uncertainty in academic or scientific context.

**nominalization-density** (Principle 2)
Buried actions: nouns derived from verbs (-tion, -ment, -ness, -ity, -ence) paired with empty verbs ("make a decision" vs "decide"). Watch for prepositional chain reactions ("of the X of the Y by the Z"). Legitimate when: the nominalized concept is the actual subject matter, not a buried action.

### Tier 2: Metrics-Assisted

**unnecessary-words** (Principle 4)
Filler phrases ("it is important to note that," "due to the fact that"), redundant pairs ("each and every"), qualifiers that add no precision ("very," "really," "quite"). Legitimate when: the qualifier genuinely modifies meaning or the phrasing serves voice/rhythm.

**concrete-over-abstract** (Principle 5)
Abstract nouns as subjects ("situation," "factor," "aspect," "dynamic") where concrete alternatives exist. Vague quantifiers ("a number of," "various"). Legitimate when: discussing genuinely abstract concepts where concrete language would distort the meaning.

### Tier 3: LLM-Dependent

**buried-lead** (Principle 7)
The most consequential information appears late in a paragraph, after setup sentences. Legitimate when: building deliberately toward a reveal, or when context is necessary before the point lands.

**old-before-new** (Principle 8)
Sentences lead with unfamiliar information instead of connecting to the previous sentence's endpoint. Each sentence should begin with what the reader already knows. Legitimate when: a deliberate topic shift, signaled by a transition.

**unclear-antecedent** (Principle 10)
Pronouns ("this," "it," "they") where multiple referents are possible. Legitimate when: the referent is genuinely unambiguous from immediate context.

**curse-of-knowledge** (Principle 11)
Undefined jargon, logical leaps, implicit references that assume the reader shares the writer's context. Legitimate when: writing for a known expert audience where the terms are standard.

**dangling-modifier** (Principle 12)
Participial phrases where the implied subject doesn't match the grammatical subject. Focus on cases that create genuine ambiguity. Legitimate when: the construction is so conventional it reads naturally despite being technically incorrect.

**characters-as-subjects** (Principle 1)
The grammatical subject is an abstraction and the main verb is empty, hiding the real actor and action. This is the structural pattern underneath nominalizations and passive voice. Legitimate when: the abstraction genuinely is the topic, not a stand-in for a person or entity.

## Output Format

Respond with valid JSON only. No markdown fencing, no explanation outside the JSON.

{
  "nudges": [
    {
      "craftPrinciple": "passive-voice-clustering",
      "evidence": "The project was started in January. The requirements were gathered over two weeks.",
      "observation": "Two consecutive passive sentences remove the actors from the narrative.",
      "question": "The passive voice here reads as institutional report register. Was that your intent?"
    }
  ]
}

Each nudge must have:
- "craftPrinciple": One of the twelve identifiers listed above.
- "evidence": Exact text from the writer's input, copied character for character.
- "observation": What the pattern looks like in this text. A factual statement, not a judgment.
- "question": A Socratic question. Open-ended, not rhetorical. Must offer at least one reading where the pattern is legitimate.

## Question Constraints

- No imperative verbs directed at the writer. No "consider," "try," "change," "rewrite," "use," "replace," "avoid."
- Every question is open-ended. "Was this intentional?" and "What effect were you going for?" are acceptable. "Have you considered using active voice?" is not.
- The question never answers itself. It never implies a single correct response.

## Context You Receive

Your user message contains up to four sections, separated by horizontal rules:
- **Pre-computed metrics**: Sentence rhythm, passive voice analysis (including per-sentence annotations for passive sentences), word frequencies, and structural analysis. Use as quantitative evidence. Metrically strong signals take priority.
- **Writer's Style Profile** (when present): Confirmed style patterns. Use for calibration, not detection.
- **Writer's Context** (when present): The writer's description of the text's purpose or audience.
- **Text to Analyze**: The text itself. Always present, always last.

## Selection Rules

- Return 3-5 nudges. Each must reference a different craft principle (no two from the same identifier).
- Prioritize metrically-backed signals when the metrics are strong (high passive ratio, low rhythm variance, dense hedging).
- Short texts (under ~100 words) may produce fewer than 3 nudges. Do not pad with weak observations.
- Select the most distinctive and consequential patterns. Quality over quantity.`;
}

export function buildNudgeUserMessage(
  text: string,
  metrics: EntryMetrics,
  styleProfile: string,
  context?: string,
): string {
  const parts: string[] = [];

  parts.push(`## Pre-computed Metrics\n\n${formatNudgeMetrics(metrics)}`);

  if (styleProfile.trim()) {
    parts.push(`## Writer's Style Profile\n\nWriter's confirmed style patterns. Use for calibration, not detection.\n\n${styleProfile}`);
  }

  if (context?.trim()) {
    parts.push(`## Writer's Context\n\nThe writer describes this text as: ${context}`);
  }

  parts.push(`## Text to Analyze\n\n${text}`);

  return parts.join("\n\n---\n\n");
}

// --- Metrics formatting (independent from Observer's formatMetrics, see Open Question 1) ---

function formatNudgeMetrics(metrics: EntryMetrics): string {
  const lines: string[] = [];

  // Sentence rhythm
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

  // Word frequency
  const wf = metrics.wordFrequency;
  lines.push("\n### Word-Level Analysis");
  lines.push(`- Total tokens: ${wf.totalTokens}`);
  lines.push(`- Unique tokens: ${wf.uniqueTokens}`);

  if (Object.keys(wf.hedgingWords).length > 0) {
    lines.push("- Hedging words: " + Object.entries(wf.hedgingWords).map(([w, c]) => `"${w}" (${c}x)`).join(", "));
  }

  if (Object.keys(wf.intensifiers).length > 0) {
    lines.push("- Intensifiers: " + Object.entries(wf.intensifiers).map(([w, c]) => `"${w}" (${c}x)`).join(", "));
  }

  // Sentence structure
  const ss = metrics.sentenceStructure;
  lines.push("\n### Sentence Structure");
  lines.push(`- Total sentences: ${ss.totalSentences}`);
  lines.push(`- Active: ${ss.activeCount}, Passive: ${ss.passiveCount} (${Math.round(ss.passiveRatio * 100)}% passive)`);
  lines.push(`- Fragments: ${ss.fragmentCount}`);

  // Per-sentence passive annotations (REQ-CN-4): only annotate passive sentences
  const passiveSentences: Array<{ index: number; text: string }> = [];
  for (let i = 0; i < metrics.sentences.length; i++) {
    if (isPassiveVoice(metrics.sentences[i].text)) {
      passiveSentences.push({ index: i + 1, text: metrics.sentences[i].text });
    }
  }

  if (passiveSentences.length > 0) {
    lines.push("\n### Passive Voice Sentences");
    // Cap at 10 to avoid bloating the message for passive-heavy texts
    const toShow = passiveSentences.slice(0, 10);
    for (const ps of toShow) {
      lines.push(`- Sentence ${ps.index}: "${ps.text}"`);
    }
    if (passiveSentences.length > 10) {
      lines.push(`- (${passiveSentences.length - 10} more passive sentences omitted)`);
    }
  }

  return lines.join("\n");
}

// --- Output parsing ---

interface ParseSuccess {
  success: true;
  data: CraftNudge[];
}

interface ParseFailure {
  success: false;
  error: string;
}

export function parseNudgeOutput(content: string): ParseSuccess | ParseFailure {
  let cleaned = content.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { success: false, error: `Invalid JSON in nudge output: ${cleaned.slice(0, 200)}` };
  }

  const result = NudgeOutputSchema.safeParse(parsed);
  if (!result.success) {
    return {
      success: false,
      error: `Nudge output validation failed: ${result.error.message}`,
    };
  }

  return { success: true, data: result.data.nudges };
}
