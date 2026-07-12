/**
 * Configurable constants for the longitudinal pattern confirmation layer.
 *
 * Defaults are research-informed (spec Open Questions), not measured: ship
 * configurable, tune from use. Each is overridable via an INK_MIRROR_* env
 * var, following the precedent set by INK_MIRROR_MODEL/INK_MIRROR_DATA in
 * src/index.ts.
 *
 * loadConfig takes an env map as a parameter (defaulting to process.env) so
 * tests can construct a Config without mutating global process.env or
 * fighting module caching (project testing rule: dependency injection, not
 * mock.module()).
 */
export interface Config {
  /** Minimum sightings before a pattern is promotion-eligible (REQ-LPC-14b). */
  sightingThreshold: number;
  /** Minimum distinct entries before a pattern is promotion-eligible (REQ-LPC-14c). */
  distinctEntryThreshold: number;
  /** Minimum total words across supporting entries (REQ-LPC-14d). */
  wordCountThreshold: number;
  /** Entries without a sighting before a rule resurfaces for reaffirm-or-retire (REQ-LPC-20). */
  stalenessWindow: number;
  /** Consecutive entries below baseline before a computable watch resolves (REQ-LPC-25). */
  computableWatchWindow: number;
  /** Consecutive entries with no sighting before a qualitative watch resolves (REQ-LPC-25). */
  qualitativeWatchWindow: number;
  /** Max active patterns included in the Observer prompt ledger (REQ-LPC-5). */
  ledgerCap: number;
  /** Relative deviation from baseline that counts as drift (REQ-LPC-21). */
  driftMargin: number;
}

export const DEFAULT_CONFIG: Config = {
  sightingThreshold: 3,
  distinctEntryThreshold: 3,
  wordCountThreshold: 2000,
  stalenessWindow: 10,
  computableWatchWindow: 5,
  qualitativeWatchWindow: 10,
  ledgerCap: 50,
  driftMargin: 0.5,
};

/**
 * Parses a positive-finite override from an env map. Falls back silently
 * on anything absent, blank, non-numeric, or non-finite (e.g. "NaN",
 * "Infinity") rather than propagating a bad value into threshold math.
 */
function envNumber(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    sightingThreshold: envNumber(env, "INK_MIRROR_SIGHTING_THRESHOLD", DEFAULT_CONFIG.sightingThreshold),
    distinctEntryThreshold: envNumber(env, "INK_MIRROR_ENTRY_THRESHOLD", DEFAULT_CONFIG.distinctEntryThreshold),
    wordCountThreshold: envNumber(env, "INK_MIRROR_WORD_THRESHOLD", DEFAULT_CONFIG.wordCountThreshold),
    stalenessWindow: envNumber(env, "INK_MIRROR_STALENESS_WINDOW", DEFAULT_CONFIG.stalenessWindow),
    computableWatchWindow: envNumber(env, "INK_MIRROR_COMPUTABLE_WATCH_WINDOW", DEFAULT_CONFIG.computableWatchWindow),
    qualitativeWatchWindow: envNumber(env, "INK_MIRROR_QUALITATIVE_WATCH_WINDOW", DEFAULT_CONFIG.qualitativeWatchWindow),
    ledgerCap: envNumber(env, "INK_MIRROR_LEDGER_CAP", DEFAULT_CONFIG.ledgerCap),
    driftMargin: envNumber(env, "INK_MIRROR_DRIFT_MARGIN", DEFAULT_CONFIG.driftMargin),
  };
}

/** Process-wide config, resolved once at import time from real env vars. */
export const config: Config = loadConfig();
