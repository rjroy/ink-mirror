import Link from "next/link";
import { daemonJson } from "@/lib/daemon";
import type { EntryListItem } from "@ink-mirror/shared";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return iso;
}

export default async function EntriesPage() {
  let entries: EntryListItem[];
  try {
    entries = await daemonJson<EntryListItem[]>("/entries");
  } catch {
    return (
      <div className="im-page">
        <div className="im-error">Failed to load entries. Is the daemon running?</div>
      </div>
    );
  }

  return (
    <div className="im-page">
      <div className="im-entries">
        <div className="im-ledger-head">
          <div>
            <div className="eyebrow">The ledger</div>
            <div className="im-ledger-sub">
              {entries.length === 0
                ? "Nothing recorded yet."
                : `${entries.length} entr${entries.length === 1 ? "y" : "ies"} since you began. Newest at the top.`}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/write" className="btn btn-sm">
              Begin a new entry
            </Link>
          </div>
        </div>

        {entries.length === 0 ? (
          <p className="im-ledger-sub" style={{ marginTop: 24 }}>
            <Link href="/write" style={{ color: "var(--ember-700)" }}>
              Write your first entry →
            </Link>
          </p>
        ) : (
          entries.map((entry) => (
            <Link
              key={entry.id}
              href={`/entries/${entry.id}`}
              className="im-entry-card"
            >
              <div className="im-entry-meta">
                <span className="im-entry-id">{entry.title ?? entry.id}</span>
              </div>
              <span className="im-entry-date">{formatDate(entry.date)}</span>
              <p className="im-entry-preview">{entry.preview}</p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
