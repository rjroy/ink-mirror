import Link from "next/link";
import { notFound } from "next/navigation";
import { daemonJson } from "@/lib/daemon";
import { DIMENSION_LABELS } from "@ink-mirror/shared";
import type { Entry, Observation } from "@ink-mirror/shared";
import { EntryNudge } from "@/components/entry-nudge";

export const dynamic = "force-dynamic";

export default async function EntryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let entry: Entry;
  try {
    entry = await daemonJson<Entry>(`/entries/${id}`);
  } catch {
    notFound();
  }

  let observations: Observation[] = [];
  try {
    const all = await daemonJson<Observation[]>("/observations");
    observations = all.filter((o) => o.entryId === id);
  } catch {
    // Observations are non-fatal
  }

  const hasObservations = observations.length > 0;

  return (
    <div className={hasObservations ? "im-detail" : "im-page"}>
      <section className={hasObservations ? "im-detail-main" : ""}>
        <Link href="/entries" className="im-back">
          ← The ledger
        </Link>

        <div className="im-detail-date">{entry.date}</div>
        {entry.title && <h1 className="im-detail-title">{entry.title}</h1>}
        <div className="im-prose">{entry.body}</div>

        <EntryNudge entryId={id} />
      </section>

      {hasObservations && (
        <aside className="im-rail">
          <div className="im-rail-head">
            <div className="im-rail-title">Observations</div>
            <div className="im-rail-count">
              {observations.length} of {observations.length}
            </div>
          </div>

          {observations.map((obs, i) => (
            <div key={obs.id} className="im-note">
              <div className="im-note-dim">
                {DIMENSION_LABELS[obs.dimension] ?? obs.dimension}
              </div>
              <p className="im-note-body">{obs.pattern}</p>
              {obs.evidence.length > 0 && (
                <div className="im-note-quote">
                  <span className="qhead">From your entry</span>
                  {obs.evidence.map((fragment, index) => (
                    <span key={index} className="block">&ldquo;{fragment}&rdquo;</span>
                  ))}
                </div>
              )}
              <div className="im-note-foot">
                {/* Classification is a pattern-level concept now (REQ-LPC-13),
                    not per-observation, so there's no per-observation status
                    field on the schema anymore. Link through to the pattern's
                    dossier instead (REQ-LPC-18's "why does it say this?"),
                    which shows the real lifecycle status. */}
                <Link href={`/patterns/${obs.patternId}`} className="im-dossier-link">
                  View pattern →
                </Link>
                <span className="im-rail-count">
                  № {String(i + 1).padStart(2, "0")}
                </span>
              </div>
            </div>
          ))}
        </aside>
      )}
    </div>
  );
}
