/**
 * Curation: assembles the pattern-grain curation session (REQ-LPC-12).
 *
 * Phase 4 moves curation from observation grain to pattern grain: the
 * writer judges a pattern's whole evidence dossier (every sighting, plus a
 * substrate trend where computable), not one observation in isolation.
 * "Sightings" live in the observation store today (each Observation record
 * carries a `patternId`, per Phase 3) — there is no separate sighting-file
 * store yet (that's the Phase 5 migration's job), so this module derives a
 * pattern's Sighting-shaped evidence by filtering the full observation list.
 */
import type {
  Pattern,
  Observation,
  Sighting,
  SightingWithContext,
  MetricSnapshot,
  Dossier,
  DossierTrend,
  DossierWatchStatus,
  PatternContradiction,
  PatternCurationSession,
  ProfileRule,
  ResurfacedRule,
  ResurfacedRuleReason,
} from "@ink-mirror/shared";
import { isLinkableMetricKey } from "@ink-mirror/shared";
import { trendSummary, recurrenceSince, isStale, detectDrift, type Recurrence } from "./substrate.js";
import { DEFAULT_CONFIG, type Config } from "./config.js";

const UNDECIDED_CAP = 3;

/**
 * Patterns that indicate opposing ends of a dimension.
 * Each pair represents terms that, when found in pattern descriptions
 * within the same dimension, suggest a contradiction.
 */
const OPPOSING_SIGNALS: Array<[RegExp, RegExp]> = [
  [/\bshort\b/i, /\blong\b/i],
  [/\bbrief\b/i, /\blong\b/i],
  [/\bstaccato\b/i, /\bflowing\b/i],
  [/\bsimple\b/i, /\bcomplex\b/i],
  [/\bminimal\b/i, /\babundant\b/i],
  [/\bfew\b/i, /\bmany\b/i],
  [/\brare(?:ly)?\b/i, /\bfrequent(?:ly)?\b/i],
  [/\bavoids?\b/i, /\brelies on\b|uses? heavily\b/i],
  [/\bactive\b/i, /\bpassive\b/i],
  [/\bdeclarative\b/i, /\bcompound\b/i],
  [/\bshort\s+paragraphs?\b/i, /\blong\s+paragraphs?\b/i],
  [/\buniform\b/i, /\bvaried\b/i],
  [/\btransitions?\b/i, /\bjuxtaposition\b|\babrupt\b/i],
];

/**
 * Detects whether two patterns in the same dimension describe opposing
 * habits (REQ-LPC-13). Structural comparison over canonical statements: same
 * dimension, opposing pattern signals. The regex table itself is unchanged
 * from the observation-grain version (Phase 4 plan) — only what it's
 * applied to moved from raw observation text to pattern statements.
 */
export function detectContradiction(a: Pattern, b: Pattern): boolean {
  if (a.dimension !== b.dimension) return false;

  const statementA = a.statement;
  const statementB = b.statement;

  for (const [left, right] of OPPOSING_SIGNALS) {
    if (
      (left.test(statementA) && right.test(statementB)) ||
      (right.test(statementA) && left.test(statementB))
    ) {
      return true;
    }
  }

  return false;
}

interface EntryTextLookup {
  (entryId: string): Promise<string | undefined>;
}

/** Narrows an Observation record down to its Sighting-shaped fields. */
export function toSighting(obs: Observation): Sighting {
  return {
    id: obs.id,
    patternId: obs.patternId,
    entryId: obs.entryId,
    evidence: obs.evidence,
    dimension: obs.dimension,
    createdAt: obs.createdAt,
  };
}

/**
 * Every sighting of `patternId`, oldest first. There is no dedicated
 * sighting store yet (Phase 5 migration): sightings live in the observation
 * store's records, each already carrying the `patternId` it resolved to
 * (Phase 3), so this filters the full observation list rather than querying
 * a store directly — matching the plan's guidance to derive this from
 * `observationStore.list()`.
 */
export function sightingsForPattern(patternId: string, allObservations: Observation[]): Sighting[] {
  return allObservations
    .filter((o) => o.patternId === patternId)
    .map(toSighting)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Deterministic recurrence text for a watched pattern (REQ-LPC-24). Never a verdict — observation, per REQ-LPC-25's qualitative wording. */
function formatRecurrenceText(recurrence: Recurrence): string {
  if (recurrence.of === 0) {
    return "No entries submitted since you marked this accidental yet.";
  }
  const entryWord = recurrence.of === 1 ? "entry" : "entries";
  return `Seen in ${recurrence.count} of ${recurrence.of} ${entryWord} since you marked this accidental.`;
}

/**
 * Builds one pattern's dossier: every sighting with entry context, the
 * distinct-entry count, a substrate trend when the pattern is computable,
 * and watch status when the pattern is on the accidental watch list
 * (REQ-LPC-12/24). Field order in the returned object follows
 * DossierSchema's evidence-first/pattern-second/status-last convention.
 */
/**
 * Builds one pattern's dossier. Exported (beyond this module's own
 * assembleCurationSession use) so routes/patterns.ts can build a single
 * dossier for GET /patterns/:id without duplicating sighting/trend/watch
 * assembly logic.
 */
export async function buildDossier(
  pattern: Pattern,
  allObservations: Observation[],
  snapshots: MetricSnapshot[],
  resolveText: (entryId: string) => Promise<string>,
): Promise<Dossier> {
  const sightings = sightingsForPattern(pattern.id, allObservations);

  const sightingsWithContext: SightingWithContext[] = [];
  for (const sighting of sightings) {
    const entryText = await resolveText(sighting.entryId);
    sightingsWithContext.push({ ...sighting, entryText });
  }

  const distinctEntryCount = new Set(sightings.map((s) => s.entryId)).size;

  let trend: DossierTrend | undefined;
  if (pattern.metricLink && isLinkableMetricKey(pattern.metricLink)) {
    const summary = trendSummary(snapshots, pattern.metricLink);
    trend = {
      metricLink: pattern.metricLink,
      rollingMean: summary.rollingMean,
      windowSize: summary.windowSize,
      baseline: pattern.watch?.baseline,
    };
  }

  let watchStatus: DossierWatchStatus | undefined;
  if (pattern.watch) {
    // "N of last M entries" is scoped to the entries submitted since
    // classification (REQ-LPC-24), derived from snapshots rather than a
    // separate entry store — every submitted entry has a snapshot
    // (REQ-LPC-7), so this population is complete and deterministic
    // (REQ-LPC-8) without needing entry-store access here.
    const entriesSince = snapshots
      .filter((s) => s.date >= pattern.watch!.classifiedAt)
      .map((s) => s.entryId);
    const recurrence = recurrenceSince(sightings, entriesSince, pattern.watch.classifiedAt);
    watchStatus = {
      classifiedAt: pattern.watch.classifiedAt,
      recurrenceText: formatRecurrenceText(recurrence),
      resolved: pattern.watch.resolved,
      resolvedAt: pattern.watch.resolvedAt,
    };
  }

  return {
    sightings: sightingsWithContext,
    distinctEntryCount,
    trend,
    pattern,
    watchStatus,
    // This module never surfaces promotion proposals (that's promotion.ts,
    // composed in at the route layer per the Phase 4 split): every dossier
    // assembled here is candidate/undecided/watched, never intentional, so
    // isProposal is always false in this session's output.
    isProposal: false,
  };
}

/** Compares each unclassified (candidate/undecided) pattern against every intentional pattern in the same dimension (REQ-LPC-13). One contradiction surfaced per unclassified pattern, at most — the first intentional match found. */
function findContradictions(
  unclassified: Pattern[],
  intentionalPatterns: Pattern[],
): PatternContradiction[] {
  const contradictions: PatternContradiction[] = [];
  for (const pattern of unclassified) {
    for (const confirmed of intentionalPatterns) {
      if (detectContradiction(pattern, confirmed)) {
        contradictions.push({ pattern, contradicts: confirmed, dimension: pattern.dimension });
        break;
      }
    }
  }
  return contradictions;
}

/**
 * True when fewer than `window` entries (by snapshot date) have elapsed
 * since `referenceDate`. Used to build "don't flag stale until N entries
 * have passed since some reference point" grace periods — the same shape
 * of policy for two different reference points (see call sites below).
 * `referenceDate` may be a full ISO timestamp or a plain date; only the
 * date portion is compared, matching snapshot.date's "YYYY-MM-DD" format.
 */
function entriesSinceBelowWindow(
  referenceDate: string,
  snapshots: MetricSnapshot[],
  window: number,
): boolean {
  const dateOnly = referenceDate.slice(0, 10);
  return snapshots.filter((s) => s.date >= dateOnly).length < window;
}

/**
 * Rule health (REQ-LPC-19/20/21). For each profile rule linked to a
 * still-active pattern, checks:
 *  - staleness: substrate.ts's `isStale` — no sighting among the pattern's
 *    last `config.stalenessWindow` entries (REQ-LPC-20), unless a grace
 *    period (migration or reaffirm, see below) is still active.
 *  - drift: for a computable pattern with a recorded baseline on the rule,
 *    substrate.ts's `detectDrift` — the rolling 5-entry mean deviates from
 *    the baseline by more than `config.driftMargin` (REQ-LPC-21).
 *
 * Either condition resurfaces the rule. This function only *reports*:
 * nothing here mutates a rule or pattern (REQ-LPC-19/20 — never
 * auto-retire); the writer acts via the reaffirm/retire routes.
 */
function computeResurfacedRules(
  rules: ProfileRule[],
  patterns: Pattern[],
  snapshots: MetricSnapshot[],
  config: Pick<Config, "stalenessWindow" | "driftMargin">,
): ResurfacedRule[] {
  if (rules.length === 0) return [];

  const patternsById = new Map(patterns.map((p) => [p.id, p]));
  // isStale wants the recent-entries population newest-first. Every
  // submitted entry has a snapshot (REQ-LPC-7), so snapshots are the
  // deterministic source for "the last N entries" (REQ-LPC-8) — no separate
  // entry-store access needed here.
  const recentEntryIds = [...snapshots]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((s) => s.entryId);

  const resurfaced: ResurfacedRule[] = [];
  for (const rule of rules) {
    if (!rule.patternId) continue;
    const pattern = patternsById.get(rule.patternId);
    // A retired pattern's rule should already be gone (retire deletes the
    // rule, REQ-LPC-22); skip defensively instead of resurfacing orphaned
    // state if the two ever fall out of sync.
    if (!pattern || pattern.status === "retired") continue;

    const reasons: ResurfacedRuleReason[] = [];

    // Grace period #1 (REQ-LPC-27): "staleness clock starts at migration."
    // A normally-created pattern always has >=1 entryId (pattern-store.create
    // is immediately followed by recordSighting for its first sighting), so
    // isStale's "no sighting in the window" question is already meaningful
    // for it from day one — no grace period needed. The one case with zero
    // entryIds ever is a migrated pattern (`migratedNoHistory: true`), which
    // legitimately has no sighting history yet. Without a grace period, such
    // a pattern would be flagged stale the instant a single recent entry
    // exists, rather than after a full staleness window has actually elapsed
    // since migration. Gate the check on entryIds being empty so
    // ordinarily-created patterns are entirely unaffected.
    const migrationGracePeriod =
      pattern.entryIds.length === 0 &&
      entriesSinceBelowWindow(pattern.createdAt, snapshots, config.stalenessWindow);

    // Grace period #2 (REQ-LPC-19/20): reaffirming a rule is the writer
    // asserting "this is still true as of now," and must actually suppress
    // the staleness flag it responds to — otherwise reaffirm is a no-op and
    // the rule resurfaces at the very next session (the bug this grace
    // period fixes). isStale only ever looks at pattern.entryIds, which
    // reaffirm never touches, so without this the rule's only way to look
    // "fresh" again is a brand new sighting landing in the window.
    // Staleness is judged from whichever is more recent of the pattern's own
    // last sighting or the rule's lastSupportedAt: if a real sighting has
    // landed since the reaffirm, that sighting is the one isStale should
    // judge freshness by (no override needed — and no risk of a stale
    // reaffirm artificially extending a grace period past a sighting that
    // has itself already aged out). Only when reaffirm is the more recent of
    // the two does it get to set the grace-period clock.
    const reaffirmIsMostRecent =
      rule.lastSupportedAt !== undefined &&
      (pattern.lastSightingAt === undefined || rule.lastSupportedAt >= pattern.lastSightingAt);
    const reaffirmGracePeriod =
      reaffirmIsMostRecent &&
      entriesSinceBelowWindow(rule.lastSupportedAt!, snapshots, config.stalenessWindow);

    const inGracePeriod = migrationGracePeriod || reaffirmGracePeriod;
    const stale = !inGracePeriod && isStale(pattern, recentEntryIds, config.stalenessWindow);
    if (stale) reasons.push("stale");

    let drift: ResurfacedRule["drift"];
    if (pattern.metricLink && isLinkableMetricKey(pattern.metricLink) && rule.baseline !== undefined) {
      const result = detectDrift(snapshots, pattern.metricLink, rule.baseline, config.driftMargin);
      if (result.isDrifting) {
        reasons.push("drift");
        drift = {
          rollingMean: result.rollingMean,
          baseline: result.baseline,
          relativeDeviation: result.relativeDeviation,
          margin: config.driftMargin,
        };
      }
    }

    if (reasons.length === 0) continue;

    resurfaced.push({
      rule,
      pattern,
      reasons,
      staleness: stale ? { windowSize: config.stalenessWindow } : undefined,
      drift,
    });
  }
  return resurfaced;
}

/**
 * Assembles a curation session from the pattern ledger (REQ-LPC-12/13/24).
 *
 * Session contents:
 * 1. Every `candidate` pattern's dossier, oldest-first (never-yet-judged
 *    patterns get first attention).
 * 2. Up to `UNDECIDED_CAP` most-recently-updated `undecided` patterns'
 *    dossiers (unchanged cap/scope from the observation-grain version).
 * 3. Contradictions: unclassified (candidate/undecided, i.e. the same
 *    patterns in the session) vs every `intentional` pattern.
 * 4. `watchList`: dossiers for every pattern currently on the accidental
 *    watch list, with deterministic recurrence text (REQ-LPC-24).
 * 5. `resurfacedRules`: profile rules flagged stale or drifting
 *    (REQ-LPC-19/20/21) — see `computeResurfacedRules`. `profileRules`
 *    defaults to `[]` and `ruleHealthConfig` to `DEFAULT_CONFIG` so existing
 *    callers that only care about dossier assembly don't need to pass them.
 *
 * Promotion proposals are deliberately NOT computed here: promotion.ts's
 * proposalFor() is a separate pure function the route layer composes in per
 * intentional pattern, keeping this module's scope to dossier assembly and
 * contradiction detection.
 */
export async function assembleCurationSession(
  patterns: Pattern[],
  allObservations: Observation[],
  snapshots: MetricSnapshot[],
  getEntryText: EntryTextLookup,
  profileRules: ProfileRule[] = [],
  ruleHealthConfig: Pick<Config, "stalenessWindow" | "driftMargin"> = DEFAULT_CONFIG,
): Promise<PatternCurationSession> {
  const candidates = [...patterns]
    .filter((p) => p.status === "candidate")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  // "Most recent" for a resurfaced undecided pattern means most recently
  // reclassified back to undecided (updatedAt), not original discovery
  // (createdAt) — a pattern can sit as undecided for a long time between
  // sightings, but what matters for the cap is recency of the judgment call
  // itself.
  const undecided = [...patterns]
    .filter((p) => p.status === "undecided")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, UNDECIDED_CAP);

  const sessionPatterns = [...candidates, ...undecided];

  const entryTextCache = new Map<string, string>();
  const resolveText = async (entryId: string): Promise<string> => {
    if (entryTextCache.has(entryId)) return entryTextCache.get(entryId)!;
    const text = (await getEntryText(entryId)) ?? "[source entry not found]";
    entryTextCache.set(entryId, text);
    return text;
  };

  const dossiers: Dossier[] = [];
  for (const pattern of sessionPatterns) {
    dossiers.push(await buildDossier(pattern, allObservations, snapshots, resolveText));
  }

  const intentionalPatterns = patterns.filter((p) => p.status === "intentional");
  const contradictions = findContradictions(sessionPatterns, intentionalPatterns);

  // Excludes retired patterns: a pattern dismissed or retired after being
  // classified accidental keeps its old `watch` object (nothing here
  // deletes it), but a retired pattern has left the ledger (REQ-LPC-22) and
  // must not keep reappearing on the watch list too.
  const watchedPatterns = patterns.filter((p) => p.watch !== undefined && p.status !== "retired");
  const watchList: Dossier[] = [];
  for (const pattern of watchedPatterns) {
    watchList.push(await buildDossier(pattern, allObservations, snapshots, resolveText));
  }

  const resurfacedRules = computeResurfacedRules(profileRules, patterns, snapshots, ruleHealthConfig);

  return { dossiers, contradictions, watchList, resurfacedRules };
}
