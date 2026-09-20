import Link from "next/link";
import { notFound } from "next/navigation";
import { daemonJson } from "@/lib/daemon";
import { DIMENSION_LABELS } from "@ink-mirror/shared";
import type { Dossier } from "@ink-mirror/shared";

export const dynamic = "force-dynamic";

/**
 * A single pattern's dossier (REQ-LPC-18): "why does it say this?" for a
 * profile rule, and the pattern reference for a sighting shown on an entry
 * page. Read-only — curation actions live on /curate.
 */
export default async function PatternDossierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let dossier: Dossier;
  try {
    dossier = await daemonJson<Dossier>(`/patterns/${id}`);
  } catch {
    notFound();
  }

  const { pattern, sightings, distinctEntryCount, trend, watchStatus } = dossier;

  return (
    <div className="im-page">
      <Link href="/curate" className="im-back">
        ← Curation
      </Link>

      <div className="im-hand-head">
        <div>
          <div className="eyebrow">{DIMENSION_LABELS[pattern.dimension]}</div>
          <h1 style={{ fontSize: 32 }}>{pattern.statement}</h1>
          <div className="sub">
            Status: {pattern.status}
            {pattern.migratedNoHistory && " — migrated, no historical sightings recorded"}
          </div>
        </div>
      </div>

      <p className="im-ledger-sub">
        {pattern.sightingCount} sighting{pattern.sightingCount === 1 ? "" : "s"} across{" "}
        {distinctEntryCount} entr{distinctEntryCount === 1 ? "y" : "ies"}
      </p>

      {trend && (
        <p className="im-ledger-sub">
          Trend: {trend.metricLink} averaging {trend.rollingMean.toFixed(2)} over the last{" "}
          {trend.windowSize} entries
          {trend.baseline !== undefined && ` (baseline ${trend.baseline.toFixed(2)})`}
        </p>
      )}

      {watchStatus && (
        <div className="im-note-quote" style={{ maxWidth: 600 }}>
          <span className="qhead">
            {watchStatus.resolved ? "Resolved" : "Watch status"}
          </span>
          {watchStatus.recurrenceText}
        </div>
      )}

      <div className="im-dim-section" style={{ marginTop: 24 }}>
        <div className="im-dim-head">
          <h3>Evidence</h3>
          <span className="rule" />
        </div>
        {sightings.length === 0 ? (
          <p className="im-ledger-sub">
            {pattern.migratedNoHistory
              ? "No historical sightings — this rule was migrated from a prior profile format before evidence tracking existed."
              : "No sightings recorded yet."}
          </p>
        ) : (
          sightings.map((sighting) => (
            <div key={sighting.id} className="im-note">
              <div className="im-note-dim">Entry {sighting.entryId}</div>
              {sighting.entryText && <p className="im-note-body">{sighting.entryText}</p>}
              <div className="im-note-quote">
                <span className="qhead">Evidence</span>
                {sighting.evidence.map((fragment, index) => (
                  <span key={index} className="block">&ldquo;{fragment}&rdquo;</span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
