import Link from "next/link";
import { notFound } from "next/navigation";
import { daemonJson } from "@/lib/daemon";
import type { Entry, Observation } from "@ink-mirror/shared";
import { EntryNudge } from "@/components/entry-nudge";
import styles from "./page.module.css";

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
    // Observations loading failure is non-fatal
  }

  const hasObservations = observations.length > 0;

  return (
    <div className={hasObservations ? styles.layout : styles.layoutFullWidth}>
      <section className={styles.entryPane}>
        <Link href="/entries" className={styles.backLink}>
          &larr; Entries
        </Link>

        <div className={styles.entryDate}>{entry.date}</div>
        {entry.title && <h1 className={styles.entryTitle}>{entry.title}</h1>}
        <div className={styles.entryBody}>{entry.body}</div>

        <EntryNudge entryId={id} />
      </section>

      {hasObservations && (
        <aside className={styles.observerPane}>
          <div className={styles.observerHeader}>
            <span className={styles.observerLabel}>Observations</span>
            <span className={styles.observerCount}>
              {observations.length} observation{observations.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className={styles.observationsList}>
            {observations.map((obs) => (
              <div key={obs.id} className={styles.obsCard}>
                <div className={styles.obsDimension}>{obs.dimension}</div>
                <div className={styles.obsText}>{obs.pattern}</div>
                {obs.evidence && (
                  <div className={styles.obsEvidence}>
                    <div className={styles.obsEvidenceLabel}>from your entry</div>
                    <div className={styles.obsEvidenceText}>
                      &ldquo;{obs.evidence}&rdquo;
                    </div>
                  </div>
                )}
                <div className={styles.obsStatus}>
                  {obs.status}
                </div>
              </div>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}
