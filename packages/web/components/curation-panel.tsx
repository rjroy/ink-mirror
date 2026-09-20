"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getPatternSession,
  listPatterns,
  classifyPattern,
  promotePattern,
  respondToProposal,
  detachSighting,
  mergePatterns,
  dismissPattern,
  retirePattern,
  reaffirmRule,
} from "@/lib/api";
import { DIMENSION_LABELS } from "@ink-mirror/shared";
import type {
  Pattern,
  PatternProposal,
  PatternCurationSession,
  PatternContradiction,
  Dossier,
  ResurfacedRule,
} from "@ink-mirror/shared";

type ClassificationStatus = "intentional" | "accidental" | "undecided";

const STATUS_COPY: Record<ClassificationStatus, string> = {
  intentional: "Keep — this is on purpose",
  accidental: "Release",
  undecided: "Set aside",
};

type Session = PatternCurationSession & { proposals: PatternProposal[] };

/**
 * REQ-LPC-26: an `intentional` pattern with no linked rule and no pending
 * proposal is below the promotion thresholds. It won't appear anywhere else
 * in the session (dossiers are candidate/undecided only; proposals only
 * exist once thresholds are crossed), so callers must ask for it explicitly
 * instead of it silently vanishing. Mirrors the CLI's
 * printAccumulatingEvidence filter.
 */
export function selectAccumulatingPatterns(
  patterns: Pattern[],
  proposals: PatternProposal[],
): Pattern[] {
  const proposedIds = new Set(proposals.map((p) => p.patternId));
  return patterns.filter(
    (p) => p.status === "intentional" && !p.ruleId && !proposedIds.has(p.id),
  );
}

/** Candidates to merge into `source`: same dimension, not itself, not retired. */
export function mergeCandidatesFor(source: Pattern, all: Pattern[]): Pattern[] {
  return all.filter(
    (p) => p.id !== source.id && p.dimension === source.dimension && p.status !== "retired",
  );
}

function pluralize(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

export function formatSightingSummary(dossier: Dossier): string {
  const entryWord = dossier.distinctEntryCount === 1 ? "entry" : "entries";
  return `${pluralize(dossier.pattern.sightingCount, "sighting")} across ${dossier.distinctEntryCount} ${entryWord}`;
}

export function formatProposalSummary(proposal: PatternProposal): string {
  const entryWord = proposal.distinctEntryCount === 1 ? "entry" : "entries";
  return `${pluralize(proposal.sightingCount, "sighting")} across ${proposal.distinctEntryCount} ${entryWord}, ${proposal.totalWordCount} words total`;
}

// ~120 lines: over the ~100-line guideline even after extracting every
// section (Contradictions/ResurfacedRules/Proposals/WatchList/Accumulating)
// and the empty-state/current-dossier wiring into their own components below.
// What's left is state, the loadAll/runAction data-flow, and one JSX tree
// wiring six independent sections together — genuine orchestration, not
// bloat, so further splitting would just relocate the coupling rather than
// reduce it.
export function CurationPanel() {
  const [session, setSession] = useState<Session | null>(null);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessionData, patternsData] = await Promise.all([getPatternSession(), listPatterns()]);
      setSession(sessionData);
      setPatterns(patternsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load curation session");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  /** Runs a mutating action, then refreshes session + patterns from the server (never local guesswork about resulting state). */
  const runAction = useCallback(
    async (id: string, action: () => Promise<unknown>, failureMessage: string) => {
      setActingId(id);
      setError(null);
      try {
        await action();
        await loadAll();
      } catch (err) {
        setError(err instanceof Error ? err.message : failureMessage);
      } finally {
        setActingId(null);
      }
    },
    [loadAll],
  );

  if (loading) {
    return (
      <div className="im-page">
        <p className="im-ledger-sub" style={{ textAlign: "center" }}>
          Gathering patterns…
        </p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="im-page">
        {error ? <div className="im-error">{error}</div> : <p className="im-ledger-sub">No session data.</p>}
      </div>
    );
  }

  const { dossiers, contradictions, watchList, resurfacedRules, proposals } = session;
  const accumulating = selectAccumulatingPatterns(patterns, proposals);
  const currentDossier = dossiers[0];

  const nothingToReview =
    dossiers.length === 0 &&
    contradictions.length === 0 &&
    watchList.length === 0 &&
    resurfacedRules.length === 0 &&
    proposals.length === 0;

  return (
    <div className="im-page">
      {error && <div className="im-error">{error}</div>}

      <ContradictionsSection contradictions={contradictions} />

      <ResurfacedRulesSection
        items={resurfacedRules}
        actingId={actingId}
        onReaffirm={(patternId) =>
          void runAction(patternId, () => reaffirmRule(patternId), "Failed to reaffirm rule")
        }
        onRetire={(patternId) =>
          void runAction(patternId, () => retirePattern(patternId), "Failed to retire pattern")
        }
      />

      <ProposalsSection
        proposals={proposals}
        actingId={actingId}
        onAccept={(patternId) =>
          void runAction(patternId, () => respondToProposal(patternId, "accept"), "Failed to accept proposal")
        }
        onDecline={(patternId) =>
          void runAction(patternId, () => respondToProposal(patternId, "decline"), "Failed to decline proposal")
        }
      />

      <WatchListSection watchList={watchList} />

      {nothingToReview ? (
        <EmptyReadingRoom />
      ) : (
        currentDossier && (
          <CurrentDossierReview
            dossier={currentDossier}
            patterns={patterns}
            actingId={actingId}
            runAction={runAction}
          />
        )
      )}

      <AccumulatingSection
        patterns={accumulating}
        actingId={actingId}
        onPromote={(id) => void runAction(id, () => promotePattern(id), "Failed to promote pattern")}
      />
    </div>
  );
}

/**
 * Evidence quotes (with the entry context they came from) first, sighting/
 * entry counts and trend line second, watch-status block last (research-
 * grounded presentation order, matching the CLI's formatDossier and the
 * read-only pattern dossier page).
 */
function DossierEvidence({
  dossier,
  onDetach,
  acting,
}: {
  dossier: Dossier;
  onDetach?: (sightingId: string) => void;
  acting?: boolean;
}) {
  const { pattern, sightings, trend, watchStatus } = dossier;

  return (
    <>
      {pattern.migratedNoHistory ? (
        <p className="im-ledger-sub">
          No historical sightings — this rule was migrated from a prior profile format before evidence tracking existed.
        </p>
      ) : sightings.length === 0 ? (
        <p className="im-ledger-sub">No sightings recorded yet.</p>
      ) : (
        sightings.map((s) => (
          <div key={s.id} className="im-note">
            <div className="im-note-dim">Entry {s.entryId}</div>
            {s.entryText && <p className="im-note-body">{s.entryText}</p>}
            <div className="im-note-quote">
              <span className="qhead">Evidence</span>
              {s.evidence.map((fragment, index) => (
                <span key={index} className="block">&ldquo;{fragment}&rdquo;</span>
              ))}
            </div>
            {onDetach && (
              <div className="im-note-foot">
                <button className="btn btn-sm btn-ghost" disabled={acting} onClick={() => onDetach(s.id)}>
                  Detach this sighting
                </button>
              </div>
            )}
          </div>
        ))
      )}

      <p className="im-ledger-sub" style={{ marginTop: 12 }}>
        {formatSightingSummary(dossier)}
      </p>

      {trend && (
        <p className="im-ledger-sub">
          Trend: {trend.metricLink} averaging {trend.rollingMean.toFixed(2)} over the last {trend.windowSize} entries
          {trend.baseline !== undefined && ` (baseline ${trend.baseline.toFixed(2)})`}
        </p>
      )}

      {watchStatus && (
        <div className="im-note-quote" style={{ maxWidth: 600, marginTop: 8 }}>
          <span className="qhead">{watchStatus.resolved ? "Resolved" : "Watch status"}</span>
          {watchStatus.recurrenceText}
        </div>
      )}
    </>
  );
}

/** Unclassified-vs-intentional tension rows shown above the curation session (REQ-LPC-13). */
function ContradictionsSection({ contradictions }: { contradictions: PatternContradiction[] }) {
  return (
    <>
      {contradictions.map((c, i) => (
        <div key={i} className="im-note" style={{ marginBottom: 16 }}>
          <div className="im-note-dim">Tension in {c.dimension}</div>
          <p className="im-note-body">
            <strong>Unclassified:</strong> {c.pattern.statement}
          </p>
          <p className="im-note-body">
            <strong>Confirmed:</strong> {c.contradicts.statement}
          </p>
        </div>
      ))}
    </>
  );
}

/** Rules flagged stale/drifting for reaffirm-or-retire (REQ-LPC-19/20/21). */
function ResurfacedRulesSection({
  items,
  actingId,
  onReaffirm,
  onRetire,
}: {
  items: ResurfacedRule[];
  actingId: string | null;
  onReaffirm: (patternId: string) => void;
  onRetire: (patternId: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="im-dim-section">
      <div className="im-dim-head">
        <h3>Resurfaced for review</h3>
        <span className="rule" />
      </div>
      {items.map((item) => (
        <ResurfacedRuleRow
          key={item.rule.id}
          item={item}
          acting={actingId === item.pattern.id}
          onReaffirm={() => onReaffirm(item.pattern.id)}
          onRetire={() => onRetire(item.pattern.id)}
        />
      ))}
    </div>
  );
}

/** Patterns that crossed the promotion thresholds, awaiting accept/decline (REQ-LPC-14/15). */
function ProposalsSection({
  proposals,
  actingId,
  onAccept,
  onDecline,
}: {
  proposals: PatternProposal[];
  actingId: string | null;
  onAccept: (patternId: string) => void;
  onDecline: (patternId: string) => void;
}) {
  if (proposals.length === 0) return null;
  return (
    <div className="im-dim-section">
      <div className="im-dim-head">
        <h3>Ready to promote</h3>
        <span className="rule" />
      </div>
      {proposals.map((p) => (
        <ProposalRow
          key={p.patternId}
          proposal={p}
          acting={actingId === p.patternId}
          onAccept={() => onAccept(p.patternId)}
          onDecline={() => onDecline(p.patternId)}
        />
      ))}
    </div>
  );
}

/** Accidental patterns on the recurrence watch list (REQ-LPC-24). Read-only (REQ-LPC-25). */
function WatchListSection({ watchList }: { watchList: Dossier[] }) {
  if (watchList.length === 0) return null;
  return (
    <div className="im-dim-section">
      <div className="im-dim-head">
        <h3>On watch</h3>
        <span className="rule" />
      </div>
      {watchList.map((dossier) => (
        <div key={dossier.pattern.id} className="im-note" style={{ marginBottom: 16 }}>
          <div className="im-note-dim">{DIMENSION_LABELS[dossier.pattern.dimension]}</div>
          <p className="im-note-body">{dossier.pattern.statement}</p>
          {/* Watch resolution is read-only (REQ-LPC-25): no action controls here. */}
          <DossierEvidence dossier={dossier} />
        </div>
      ))}
    </div>
  );
}

function DossierCard({
  dossier,
  mergeCandidates,
  acting,
  onClassify,
  onDismiss,
  onDetach,
  onMerge,
}: {
  dossier: Dossier;
  mergeCandidates: Pattern[];
  acting: boolean;
  onClassify: (status: ClassificationStatus, promote: boolean) => void;
  onDismiss: () => void;
  onDetach: (sightingId: string) => void;
  onMerge: (duplicateId: string) => void;
}) {
  // Local to this dossier: keyed by pattern id from the parent, so a new
  // dossier remounts this component and resets these rather than carrying
  // stale checkbox/select state across patterns.
  const [promoteOnKeep, setPromoteOnKeep] = useState(false);
  const [duplicateId, setDuplicateId] = useState("");
  const { pattern } = dossier;

  return (
    <div className="im-sift">
      <div className="im-sift-context">
        <div className="label">Evidence</div>
        <DossierEvidence dossier={dossier} onDetach={onDetach} acting={acting} />
      </div>
      <div className="im-sift-panel">
        <div className="im-sift-card">
          <div className="dim">{DIMENSION_LABELS[pattern.dimension]}</div>
          <p className="desc">{pattern.statement}</p>

          <label style={{ display: "flex", gap: 6, alignItems: "center", margin: "8px 0" }}>
            <input
              type="checkbox"
              checked={promoteOnKeep}
              onChange={(e) => setPromoteOnKeep(e.target.checked)}
            />
            Promote to a profile rule if kept
          </label>

          <div className="im-sift-actions">
            <button
              className="btn btn-keep btn-wide"
              disabled={acting}
              onClick={() => onClassify("intentional", promoteOnKeep)}
            >
              {STATUS_COPY.intentional}
            </button>
            <button
              className="btn btn-release btn-wide"
              disabled={acting}
              onClick={() => onClassify("accidental", false)}
            >
              {STATUS_COPY.accidental}
            </button>
            <button
              className="btn btn-set-aside btn-wide"
              disabled={acting}
              onClick={() => onClassify("undecided", false)}
            >
              {STATUS_COPY.undecided}
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            <button
              className="btn btn-sm btn-ghost"
              disabled={acting}
              onClick={onDismiss}
              style={{ color: "var(--oxblood-500)" }}
            >
              Dismiss — not a real pattern
            </button>
          </div>

          {mergeCandidates.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
              <select value={duplicateId} onChange={(e) => setDuplicateId(e.target.value)}>
                <option value="">Merge a duplicate into this pattern…</option>
                {mergeCandidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.statement}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-sm btn-ghost"
                disabled={acting || !duplicateId}
                onClick={() => onMerge(duplicateId)}
              >
                Merge
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** The "nothing to curate yet" state, shown when every review queue is empty. */
function EmptyReadingRoom() {
  return (
    <div className="im-sift-empty">
      <Flourish />
      <h2>The reading-room is quiet.</h2>
      <p>
        Once you&rsquo;ve written, patterns will gather here for sifting.
        Until then, there is nothing to weigh.
      </p>
      <Flourish width={120} />
    </div>
  );
}

/** Binds the current dossier's classify/dismiss/detach/merge actions to runAction and renders DossierCard. */
function CurrentDossierReview({
  dossier,
  patterns,
  actingId,
  runAction,
}: {
  dossier: Dossier;
  patterns: Pattern[];
  actingId: string | null;
  runAction: (id: string, action: () => Promise<unknown>, failureMessage: string) => Promise<void>;
}) {
  return (
    <DossierCard
      key={dossier.pattern.id}
      dossier={dossier}
      mergeCandidates={mergeCandidatesFor(dossier.pattern, patterns)}
      acting={actingId === dossier.pattern.id}
      onClassify={(status, promote) =>
        void runAction(
          dossier.pattern.id,
          () => classifyPattern(dossier.pattern.id, status, promote),
          "Failed to classify pattern",
        )
      }
      onDismiss={() =>
        void runAction(dossier.pattern.id, () => dismissPattern(dossier.pattern.id), "Failed to dismiss pattern")
      }
      onDetach={(sightingId) =>
        void runAction(
          dossier.pattern.id,
          () => detachSighting(dossier.pattern.id, sightingId),
          "Failed to detach sighting",
        )
      }
      onMerge={(duplicateId) =>
        void runAction(
          dossier.pattern.id,
          () => mergePatterns(dossier.pattern.id, duplicateId),
          "Failed to merge patterns",
        )
      }
    />
  );
}

/** Intentional patterns below the promotion thresholds (REQ-LPC-26), with a manual override. */
function AccumulatingSection({
  patterns,
  actingId,
  onPromote,
}: {
  patterns: Pattern[];
  actingId: string | null;
  onPromote: (patternId: string) => void;
}) {
  if (patterns.length === 0) return null;
  return (
    <div className="im-dim-section">
      <div className="im-dim-head">
        <h3>Evidence still accumulating</h3>
        <span className="rule" />
      </div>
      {patterns.map((p) => (
        <div key={p.id} className="im-note">
          <p className="im-note-body">{p.statement}</p>
          <p className="im-note-dim">
            {pluralize(p.sightingCount, "sighting")} across {p.entryIds.length} distinct{" "}
            {p.entryIds.length === 1 ? "entry" : "entries"} — not yet eligible for a promotion proposal.
          </p>
          <button className="btn btn-sm btn-ghost" disabled={actingId === p.id} onClick={() => onPromote(p.id)}>
            Promote now anyway
          </button>
        </div>
      ))}
    </div>
  );
}

function ProposalRow({
  proposal,
  acting,
  onAccept,
  onDecline,
}: {
  proposal: PatternProposal;
  acting: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="im-note" style={{ marginBottom: 16 }}>
      <p className="im-note-body">{proposal.statement}</p>
      <p className="im-note-dim">{formatProposalSummary(proposal)}</p>
      <div className="im-rule-actions">
        <button className="btn btn-sm btn-keep" disabled={acting} onClick={onAccept}>
          Accept
        </button>
        <button className="btn btn-sm btn-ghost" disabled={acting} onClick={onDecline}>
          Decline
        </button>
      </div>
    </div>
  );
}

function ResurfacedRuleRow({
  item,
  acting,
  onReaffirm,
  onRetire,
}: {
  item: ResurfacedRule;
  acting: boolean;
  onReaffirm: () => void;
  onRetire: () => void;
}) {
  const reasonLabels = item.reasons.map((r) => (r === "stale" ? "Stale" : "Drifting")).join(" + ");

  return (
    <div className="im-note" style={{ marginBottom: 16 }}>
      <div className="im-note-dim">{reasonLabels}</div>
      <p className="im-note-body">{item.rule.pattern}</p>
      {item.staleness && (
        <p className="im-ledger-sub">No sighting in the last {item.staleness.windowSize} entries.</p>
      )}
      {item.drift && (
        <p className="im-ledger-sub">
          Rolling mean {item.drift.rollingMean.toFixed(2)} vs baseline {item.drift.baseline.toFixed(2)} (
          {(item.drift.relativeDeviation * 100).toFixed(0)}% deviation, margin{" "}
          {(item.drift.margin * 100).toFixed(0)}%).
        </p>
      )}
      <div className="im-rule-actions">
        <button className="btn btn-sm btn-ghost" disabled={acting} onClick={onReaffirm}>
          Reaffirm
        </button>
        <button
          className="btn btn-sm btn-ghost"
          disabled={acting}
          onClick={onRetire}
          style={{ color: "var(--oxblood-500)" }}
        >
          Retire
        </button>
      </div>
    </div>
  );
}

function Flourish({ width = 200 }: { width?: number }) {
  return (
    <svg
      className="im-flourish"
      viewBox="0 0 200 14"
      width={width}
      height={14}
      style={{ color: "var(--rule-strong)" }}
    >
      <g fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M0 7 L80 7" />
        <path d="M120 7 L200 7" />
        <circle cx="100" cy="7" r="3" />
        <path d="M92 7 L88 4 M92 7 L88 10 M108 7 L112 4 M108 7 L112 10" />
      </g>
    </svg>
  );
}
