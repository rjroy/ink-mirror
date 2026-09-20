/**
 * Observer: produces pattern-level observations from journal entries.
 *
 * Assembles context (Tier 1: system prompt + style profile + metrics + entry
 * + pattern ledger), calls the session runner, validates output, resolves
 * each observation to a pattern (match or discover), and stores it.
 *
 * Critical constraint: the Observer NEVER generates text for the user.
 * Observations describe patterns. No alternatives, corrections, or rewrites.
 * No comparisons to external norms or other writers (REQ-V1-9).
 */

import type {
  EntryMetrics,
  RawObservation,
  Observation,
  MetricSnapshot,
  Pattern,
  Sighting,
  ObservationDimension,
  ObservationValidationDiagnostic,
  ObservationValidationWarning,
} from "@ink-mirror/shared";
import { ObserverOutputSchema, isLinkableMetricKey } from "@ink-mirror/shared";
import type { SessionRunner } from "./session-runner.js";
import type { ObservationStore } from "./observation-store.js";
import type { PatternStore } from "./pattern-store.js";
import { trendSummary, type TrendSummary } from "./substrate.js";
import { DEFAULT_CONFIG } from "./config.js";

/** Returns the N most recent entry texts, newest first. */
export type RecentEntriesFn = (limit: number) => Promise<Array<{ id: string; body: string }>>;
/** Returns the total number of entries in the corpus. */
export type CorpusSizeFn = () => Promise<number>;
/** Returns every persisted metric snapshot (any order; buildLedger sorts as needed). */
export type ListSnapshotsFn = () => Promise<MetricSnapshot[]>;

export interface ObserverDeps {
  sessionRunner: SessionRunner;
  observationStore: ObservationStore;
  /** Every observation resolves to a pattern (REQ-LPC-2): match or discover. */
  patternStore: PatternStore;
  computeMetrics: (text: string) => EntryMetrics;
  readStyleProfile?: () => Promise<string>;
  /** Tier 2: supply recent entries for drift detection (REQ-V1-13) */
  recentEntries?: RecentEntriesFn;
  /** Tier 2: total corpus size to decide if Tier 2 activates */
  corpusSize?: CorpusSizeFn;
  /** Substrate trend source for computable ledger patterns (REQ-LPC-10). Omit to skip trends. */
  listSnapshots?: ListSnapshotsFn;
  /** Caps the ledger included in the prompt (REQ-LPC-5). Defaults to config.ts's default. */
  ledgerCap?: number;
}

export interface ObserveResult {
  observations: Observation[];
  errors: string[];
  /** Newly created candidate patterns (discoveries) this observe() call resolved to (REQ-LPC-29's pattern:discovered event source). */
  discoveries: Pattern[];
}

export interface ObserveOptions {
  /** Called after a reflection has durably saved its accepted output, so the
   * caller can retire the entry's previously current observations. */
  replaceCurrentObservations?: (entryId: string, observationIds: string[]) => Promise<void>;
}

/**
 * Run the Observer on a submitted entry.
 * Returns stored observations and any validation errors.
 *
 * `precomputedMetrics`, when supplied, is used as-is instead of calling
 * `deps.computeMetrics` again. This lets a caller (onEntryCreated in
 * src/index.ts) compute metrics once, persist them as a snapshot, and pass
 * the same result in here so the Observer doesn't duplicate the work.
 * Falling back to `deps.computeMetrics` when absent keeps every existing
 * caller/test that doesn't pass it unchanged.
 */
export async function observe(
  deps: ObserverDeps,
  entryId: string,
  entryText: string,
  precomputedMetrics?: EntryMetrics,
  options: ObserveOptions = {},
): Promise<ObserveResult> {
  const { sessionRunner, observationStore, patternStore, computeMetrics } = deps;
  const ledgerCap = deps.ledgerCap ?? DEFAULT_CONFIG.ledgerCap;

  console.log(`[observer] starting for ${entryId} (${entryText.length} chars)`);

  const metrics = precomputedMetrics ?? computeMetrics(entryText);
  const styleProfile = deps.readStyleProfile
    ? await deps.readStyleProfile()
    : "";

  // Tier 2 context: include last 5 entries when corpus >= 5 (REQ-V1-13)
  let recentEntryTexts: string[] = [];
  if (deps.corpusSize && deps.recentEntries) {
    const total = await deps.corpusSize();
    if (total >= 5) {
      const recent = await deps.recentEntries(5);
      recentEntryTexts = recent.map((e) => e.body);
      console.log(`[observer] tier 2 active: ${recentEntryTexts.length} recent entries, corpus size ${total}`);
    }
  }

  // Pattern ledger (REQ-LPC-4/5/10): active patterns, capped and prioritized
  // by recency, with a substrate trend attached where computable.
  const allPatterns = await patternStore.list();
  const snapshots = deps.listSnapshots ? await deps.listSnapshots() : [];
  const ledger = buildLedger(allPatterns, snapshots, ledgerCap);

  const system = buildSystemPrompt();
  const userMessage = buildUserMessage(entryText, metrics, styleProfile, recentEntryTexts, ledger);

  console.log("[observer] calling LLM...");
  const start = performance.now();
  const response = await sessionRunner.run({
    system,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 2048,
  });
  const llmMs = (performance.now() - start).toFixed(0);
  console.log(`[observer] LLM responded in ${llmMs}ms (${response.content.length} chars)`);

  const parsed = parseObserverOutput(response.content);
  if (!parsed.success) {
    console.error(`[observer] parse failed: ${parsed.error}`);
    return { observations: [], errors: [parsed.error], discoveries: [] };
  }

  const validated = validateObservations(parsed.data, entryText, ledger);
  const stored: Observation[] = [];
  const discoveries: Pattern[] = [];
  const errors: string[] = [...validated.errors];

  if (validated.errors.length > 0) {
    console.warn(`[observer] validation rejected ${validated.errors.length} observation(s): ${validated.errors.join("; ")}`);
  }

  for (const raw of validated.valid) {
    const resolution = await resolveAndStoreObservation({ observationStore, patternStore }, entryId, raw);
    if ("error" in resolution) {
      errors.push(resolution.error);
      continue;
    }
    stored.push(resolution.observation);
    if (resolution.discoveredPattern) discoveries.push(resolution.discoveredPattern);
  }

  // A fully accepted empty response is a deliberate replacement. A response
  // containing validation/storage errors but no accepted observations leaves
  // the prior accepted set intact, matching the reflection UI's warning path.
  if (options.replaceCurrentObservations && (stored.length > 0 || errors.length === 0)) {
    await options.replaceCurrentObservations(entryId, stored.map((observation) => observation.id));
  }

  console.log(`[observer] done: ${stored.length} stored, ${errors.length} errors, ${discoveries.length} discovered`);
  return { observations: stored, errors, discoveries };
}

/**
 * Resolves one validated observation to its pattern — either a match against
 * an existing ledger entry or a discovery that creates a new candidate
 * pattern (REQ-LPC-2) — then persists the observation as a sighting and
 * records it against that pattern. Split out of observe() to keep that
 * function under the project's ~100-line function heuristic.
 */
async function resolveAndStoreObservation(
  deps: Pick<ObserverDeps, "observationStore" | "patternStore">,
  entryId: string,
  raw: ValidatedRawObservation,
): Promise<{ observation: Observation; discoveredPattern?: Pattern } | { error: string }> {
  const { observationStore, patternStore } = deps;
  const ref = raw.patternRef;

  let resolvedPatternId: string;
  let discoveredPattern: Pattern | undefined;
  if (ref?.patternId) {
    // Match: cites an existing ledger pattern (validated above against the
    // same ledger passed to the prompt).
    resolvedPatternId = ref.patternId;
    console.log(`[observer] matched existing pattern ${resolvedPatternId}: "${raw.pattern.slice(0, 60)}"`);
  } else if (ref?.newPattern) {
    // Discovery: creates a new candidate pattern with its first sighting (REQ-LPC-2).
    // metricLink was already downgraded to undefined by validateObservations
    // if invalid; this check is a defensive, statically-typed second guard.
    const { metricLink } = ref.newPattern;
    const pattern = await patternStore.create({
      statement: ref.newPattern.statement,
      dimension: ref.newPattern.dimension,
      metricLink: metricLink && isLinkableMetricKey(metricLink) ? metricLink : undefined,
    });
    resolvedPatternId = pattern.id;
    discoveredPattern = pattern;
    console.log(
      `[observer] discovered new pattern ${resolvedPatternId} (${ref.newPattern.dimension}): "${ref.newPattern.statement.slice(0, 60)}"`,
    );
  } else {
    // validateObservations rejects any observation lacking a resolvable
    // patternRef, so this branch is unreachable in practice; it's a
    // defensive fallback rather than a silent drop.
    return { error: `Observation "${raw.pattern.slice(0, 60)}" has no resolvable pattern reference` };
  }

  const obs = await observationStore.save(entryId, raw, resolvedPatternId, raw.validation);

  const sighting: Sighting = {
    id: obs.id,
    patternId: resolvedPatternId,
    entryId,
    evidence: obs.evidence,
    dimension: obs.dimension,
    createdAt: obs.createdAt,
  };
  // recordSighting bumps the pattern's counters; re-fetch the up-to-date
  // record for discoveredPattern so the emitted pattern:discovered event
  // (routes/entries.ts) carries sightingCount:1/entryIds populated rather
  // than the zeroed-out state from the moment create() returned it.
  const updated = await patternStore.recordSighting(resolvedPatternId, sighting);
  if (discoveredPattern) discoveredPattern = updated;

  return { observation: obs, discoveredPattern };
}

// --- Pattern ledger assembly (REQ-LPC-5/10) ---

/** One ledger row as rendered into the Observer prompt. */
export interface LedgerEntry {
  id: string;
  statement: string;
  dimension: ObservationDimension;
  sightingCount: number;
  lastSightingAt?: string;
  /** Present only when the pattern has a valid metricLink (computable). */
  trend?: TrendSummary;
}

/**
 * Builds the ledger block: active (non-retired) patterns only, capped at
 * `ledgerCap`, prioritized by recency of last sighting (most recent first,
 * REQ-LPC-5). Patterns with no sighting yet sort last (empty string is the
 * lowest possible lastSightingAt comparison value) — in practice every
 * pattern gets its first sighting at creation, so this is a defensive
 * ordering choice rather than an expected case.
 */
export function buildLedger(
  patterns: Pattern[],
  snapshots: MetricSnapshot[],
  ledgerCap: number,
): LedgerEntry[] {
  const active = patterns.filter((p) => p.status !== "retired");
  const sorted = [...active].sort((a, b) =>
    (b.lastSightingAt ?? "").localeCompare(a.lastSightingAt ?? ""),
  );
  const capped = sorted.slice(0, Math.max(0, ledgerCap));

  return capped.map((p) => {
    const entry: LedgerEntry = {
      id: p.id,
      statement: p.statement,
      dimension: p.dimension,
      sightingCount: p.sightingCount,
      lastSightingAt: p.lastSightingAt,
    };
    if (p.metricLink && isLinkableMetricKey(p.metricLink)) {
      entry.trend = trendSummary(snapshots, p.metricLink);
    }
    return entry;
  });
}

function formatLedger(ledger: LedgerEntry[]): string {
  const lines: string[] = [];
  for (const entry of ledger) {
    const sightingWord = entry.sightingCount === 1 ? "sighting" : "sightings";
    lines.push(
      `- [${entry.id}] (${entry.dimension}, ${entry.sightingCount} ${sightingWord}): ${entry.statement}`,
    );
    if (entry.trend) {
      lines.push(
        `  Substrate trend — ${entry.trend.metricKey}: rolling mean ${entry.trend.rollingMean.toFixed(3)} ` +
          `over last ${entry.trend.windowSize} entries, direction ${entry.trend.direction} ` +
          `(magnitude ${entry.trend.magnitude.toFixed(3)})`,
      );
    }
  }
  return lines.join("\n");
}

// --- Prompt construction ---

export function buildSystemPrompt(): string {
  return `You are a writing pattern observer for a personal journal tool called ink-mirror.

Your role is to observe patterns in the writer's text. You describe what you see. You NEVER:
- Generate text for the writer
- Suggest alternatives, corrections, or rewrites
- Compare the writer's style to external norms, famous authors, or other writers
- Evaluate whether patterns are "good" or "bad"

Maintain these behavioral boundaries throughout the response.`;
}

function buildTaskAndOutputContract(): string {
  return `## Observer Task

Identify 2-3 distinctive writing patterns in the current entry. Quality over quantity. When possible, select observations from different dimensions. Each observation must pass this curation test: the writer can meaningfully answer "is this intentional?" Name a specific pattern, not a broad category.

Every observation must cite one or more specific fragments from the current entry as evidence. Copy every fragment exactly, character for character, and list the fragments in reading order. Each fragment must independently appear in the current entry. Use only writer-internal comparisons: the current entry, recent entries, and the writer's style profile. Do not compare against external standards.

Classify each observation as one of these dimensions:
- **sentence-rhythm**: length patterns, pace changes, and sentence-length variation.
- **word-level-habits**: repeated words or phrases, hedging, intensifiers, and filler patterns.
- **sentence-structure**: voice, sentence fragments, and sentence-opening tendencies.
- **paragraph-structure**: paragraph shapes, roles, transitions, and relationships to neighboring paragraphs. Do not manufacture this dimension merely to satisfy coverage.

**Not this (boundary between sentence-structure and paragraph-structure)**: If the unit is a sentence, the observation belongs in sentence-structure. Paragraph-opener word classes (e.g., "most paragraphs start with 'I'") stay in sentence-structure because the unit is the opening sentence. Paragraph-opener topic-sentence behavior (does the first sentence announce the paragraph's subject?) goes in paragraph-structure because the unit is the paragraph's shape. Do not manufacture a paragraph-structure observation on a 1-2 paragraph entry to satisfy coverage; the entry must support the pattern.

## Pattern Matching and Output Contract

For every observation, either match an existing Pattern Ledger entry with its exact ` + "`patternRef.patternId`" + `, or declare a genuinely new habit with ` + "`patternRef.newPattern`" + ` containing a statement, dimension, and optional metricLink. Never invent an ID. Do not re-declare a ledger pattern under new wording. Use ledger counts and trends directly when making longitudinal claims. Never estimate, round, or invent numbers.

Respond with valid JSON only. Do not use Markdown fences or add prose outside the JSON. Return no more than three observations in this exact shape:

{
  "observations": [
    {
      "pattern": "Uses three consecutive short sentences for emphasis",
      "evidence": ["I stopped.", "I turned.", "I left."],
      "dimension": "sentence-rhythm",
      "patternRef": { "patternId": "pat-2026-01-01-001" }
    },
    {
      "pattern": "Repeats 'just' as a softener when describing personal reactions",
      "evidence": ["I just couldn't take it anymore.", "It was just too much."],
      "dimension": "word-level-habits",
      "patternRef": { "newPattern": { "statement": "Uses 'just' as a softener before admitting a strong reaction", "dimension": "word-level-habits" } }
    },
    {
      "pattern": "Closes with an isolated single-sentence paragraph",
      "evidence": ["That was the last time I looked back."],
      "dimension": "paragraph-structure",
      "patternRef": { "newPattern": { "statement": "Closes sections with an isolated single-sentence paragraph", "dimension": "paragraph-structure" } }
    }
  ]
}

If nothing in the entry clears the bar in Rule 2 — no habit is distinctive enough to name, or every candidate is a near-duplicate of an existing ledger pattern already declined by the writer — respond with ` + "`{\"observations\": []}`" + ` and nothing else. Never explain the absence of observations in prose; an empty array is a complete, valid response.`;
}

export function buildUserMessage(
  entryText: string,
  metrics: EntryMetrics,
  styleProfile: string,
  recentEntries: string[] = [],
  ledger: LedgerEntry[] = [],
): string {
  // Prompt layout (REQ-V1-15): recent entries at start (second highest attention),
  // current entry at the end (highest attention zone).
  const parts: string[] = [buildTaskAndOutputContract()];

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

  // Pattern ledger (REQ-LPC-5/10): only rendered when non-empty so entries
  // with no ledger history produce byte-identical prompts to before Phase 3.
  if (ledger.length > 0) {
    parts.push(`## Pattern Ledger\n\n${formatLedger(ledger)}`);
  }

  parts.push(`## Pre-computed Metrics\n\n${formatMetrics(metrics)}`);

  // Current entry at the end for highest attention (REQ-V1-15)
  parts.push(`## Current Entry\n\n${entryText}`);

  return parts.join("\n\n---\n\n");
}

function formatMetrics(metrics: EntryMetrics): string {
  const lines: string[] = [];

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

  // Sentence structure summary
  const ss = metrics.sentenceStructure;
  lines.push("\n### Sentence Structure");
  lines.push(`- Total sentences analyzed: ${ss.totalSentences}`);
  lines.push(`- Active voice: ${ss.activeCount}, Passive voice: ${ss.passiveCount} (${Math.round(ss.passiveRatio * 100)}% passive)`);
  lines.push(`- Fragments: ${ss.fragmentCount}`);
  lines.push(`- Paragraphs: ${ss.paragraphCount}`);

  if (ss.paragraphOpeners.length > 0) {
    lines.push("- Paragraph opener patterns: " + ss.paragraphOpeners.map((o) => `"${o.pattern}" (${o.count}x)`).join(", "));
  }

  // Paragraph-structure summary (companion to sentence structure, different dimension)
  lines.push("\n### Paragraph Structure");
  lines.push(`- Paragraph sentence counts: [${ss.paragraphLengths.join(", ")}]`);
  const d = ss.paragraphLengthDistribution;
  lines.push(`- Length distribution: short (1-2 sentences): ${d.short}, medium (3-5): ${d.medium}, long (6+): ${d.long}`);
  lines.push(`- Single-sentence paragraphs: ${ss.singleSentenceParagraphCount}`);

  return lines.join("\n");
}

// --- Output parsing and validation ---

interface ParseSuccess {
  success: true;
  data: RawObservation[];
}

interface ParseFailure {
  success: false;
  error: string;
}

export function parseObserverOutput(content: string): ParseSuccess | ParseFailure {
  // Strip markdown code fences if the LLM wrapped the JSON
  let cleaned = content.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
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

interface ValidationResult {
  valid: ValidatedRawObservation[];
  errors: string[];
}

type ValidatedRawObservation = RawObservation & {
  validation: {
    validationStatus: "verified" | "unverified";
    validationWarnings: ObservationValidationWarning[];
    validationDiagnostics: ObservationValidationDiagnostic[];
  };
};

/**
 * Validates each observation against the entry text and the pattern ledger.
 * REQ-V1-7: evidence must be cited text from the entry.
 * REQ-V1-5: each observation must have a named pattern.
 * REQ-LPC-4: a patternRef.patternId not present in the supplied ledger is rejected.
 *
 * `patternRef.newPattern.metricLink` is handled differently: an invalid link
 * (not a key in the linkable-metric registry) does NOT reject the
 * observation. It downgrades the declaration to qualitative by dropping the
 * link — a pattern is either validly computable or plain qualitative, never
 * rejected outright for a bad link (spec Concepts).
 */
export function validateObservations(
  observations: RawObservation[],
  entryText: string,
  ledger: LedgerEntry[] = [],
): ValidationResult {
  const ledgerIds = new Set(ledger.map((e) => e.id));
  const valid: ValidatedRawObservation[] = [];
  const errors: string[] = [];
  const normalizedEntry = entryText.toLowerCase();

  for (const obs of observations) {
    const issueList: string[] = [];
    const diagnostics: ObservationValidationDiagnostic[] = [];

    // REQ-V1-5: must have a named pattern
    if (!obs.pattern || obs.pattern.trim().length === 0) {
      issueList.push("Missing pattern name");
    }

    // REQ-V1-7: every evidence fragment must independently appear in the entry text.
    if (obs.evidence.length === 0) {
      issueList.push("Missing cited evidence");
    } else {
      for (const fragment of obs.evidence) {
        if (fragment.trim().length === 0) {
          issueList.push("Missing cited evidence");
        } else if (!normalizedEntry.includes(fragment.toLowerCase())) {
          diagnostics.push({
            code: "evidence-not-found-in-entry",
            fragment,
            message: `Cited evidence was not found in the source entry: "${fragment.slice(0, 80)}"`,
          });
        }
      }
    }

    // REQ-LPC-2/4: every observation must resolve to exactly one pattern.
    if (!obs.patternRef) {
      issueList.push("Missing patternRef: must cite an existing pattern ID or declare a new pattern");
    } else if (obs.patternRef.patternId && !ledgerIds.has(obs.patternRef.patternId)) {
      issueList.push(`References unknown pattern ID "${obs.patternRef.patternId}": not present in the supplied ledger`);
    }

    if (issueList.length > 0) {
      errors.push(`Observation "${obs.pattern?.slice(0, 60) ?? "(no pattern)"}": ${issueList.join("; ")}`);
      continue;
    }

    // Invalid metricLink on a new-pattern declaration downgrades to
    // qualitative rather than rejecting the observation (spec Concepts).
    const newPattern = obs.patternRef?.newPattern;
    if (newPattern?.metricLink && !isLinkableMetricKey(newPattern.metricLink)) {
      console.warn(
        `[observer] dropping invalid metricLink "${newPattern.metricLink}" on new pattern "${newPattern.statement.slice(0, 60)}": storing as qualitative`,
      );
      valid.push({
        ...obs,
        patternRef: {
          ...obs.patternRef,
          newPattern: { ...newPattern, metricLink: undefined },
        },
        validation: {
          validationStatus: diagnostics.length > 0 ? "unverified" : "verified",
          validationWarnings: diagnostics.length > 0 ? ["evidence-not-found-in-entry"] : [],
          validationDiagnostics: diagnostics,
        },
      });
    } else {
      valid.push({
        ...obs,
        validation: {
          validationStatus: diagnostics.length > 0 ? "unverified" : "verified",
          validationWarnings: diagnostics.length > 0 ? ["evidence-not-found-in-entry"] : [],
          validationDiagnostics: diagnostics,
        },
      });
    }
  }

  return { valid, errors };
}
