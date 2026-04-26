import Link from "next/link";
import { notFound } from "next/navigation";
import { daemonJson } from "@/lib/daemon";
import type {
  Entry,
  Observation,
  ObservationDimension,
  CurationStatus,
} from "@ink-mirror/shared";
import { EntryNudge } from "@/components/entry-nudge";

export const dynamic = "force-dynamic";

const DIMENSION_LABELS: Record<ObservationDimension, string> = {
  "sentence-rhythm": "Sentence rhythm",
  "word-level-habits": "Word habits",
  "sentence-structure": "Sentence shape",
  "paragraph-structure": "Paragraph shape",
};

const STATUS_CLASS: Record<CurationStatus, string> = {
  pending: "awaiting",
  intentional: "kept",
  accidental: "released",
  undecided: "set-aside",
};

const STATUS_LABEL: Record<CurationStatus, string> = {
  pending: "Awaiting",
  intentional: "Kept",
  accidental: "Released",
  undecided: "Set aside",
};

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
              {obs.evidence && (
                <div className="im-note-quote">
                  <span className="qhead">From your entry</span>
                  &ldquo;{obs.evidence}&rdquo;
                </div>
              )}
              <div className="im-note-foot">
                <span className={`im-stamp ${STATUS_CLASS[obs.status]}`}>
                  <span className="pip" />
                  {STATUS_LABEL[obs.status]}
                </span>
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
