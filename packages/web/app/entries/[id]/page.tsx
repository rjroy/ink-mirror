import Link from "next/link";
import { notFound } from "next/navigation";
import { daemonJson } from "@/lib/daemon";
import type { Entry, Observation } from "@ink-mirror/shared";
import { EntryNudge } from "@/components/entry-nudge";
import { EntryReflection } from "@/components/entry-reflection";
import { currentObservationsForEntry } from "@/lib/current-observations";

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
    observations = currentObservationsForEntry(all, id);
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

      <EntryReflection entryId={id} initialObservations={observations} />
    </div>
  );
}
