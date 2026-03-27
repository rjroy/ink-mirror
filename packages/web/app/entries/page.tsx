import Link from "next/link";
import { daemonJson } from "@/lib/daemon";
import type { EntryListItem } from "@ink-mirror/shared";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function EntriesPage() {
  let entries: EntryListItem[];
  try {
    entries = await daemonJson<EntryListItem[]>("/entries");
  } catch {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Failed to load entries. Is the daemon running?</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>Entries</h1>

      {entries.length === 0 ? (
        <p className={styles.empty}>
          No entries yet.{" "}
          <Link href="/write" className={styles.emptyLink}>
            Write your first entry
          </Link>
          .
        </p>
      ) : (
        <div>
          {entries.map((entry) => (
            <Link key={entry.id} href={`/entries/${entry.id}`} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardTitle}>{entry.title ?? entry.id}</div>
                <div className={styles.cardDate}>{entry.date}</div>
              </div>
              <div className={styles.cardPreview}>{entry.preview}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
