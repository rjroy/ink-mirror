import Link from "next/link";
import { notFound } from "next/navigation";
import { daemonJson } from "@/lib/daemon";
import type { Entry, Observation } from "@ink-mirror/shared";

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

  return (
    <div style={{ maxWidth: "48rem", margin: "0 auto" }}>
      <Link href="/entries" style={{ fontSize: "0.9rem", color: "#666", textDecoration: "none" }}>
        &larr; Back to entries
      </Link>

      <h1 style={{ fontSize: "1.5rem", marginTop: "1rem", marginBottom: "0.25rem" }}>
        {entry.title ?? entry.id}
      </h1>
      <div style={{ fontSize: "0.9rem", color: "#999", marginBottom: "1.5rem" }}>
        {entry.date}
      </div>

      <div style={{ lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: "2rem" }}>
        {entry.body}
      </div>

      {observations.length > 0 && (
        <div>
          <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Observations</h2>
          {observations.map((obs) => (
            <div
              key={obs.id}
              style={{
                padding: "0.75rem",
                marginBottom: "0.5rem",
                border: "1px solid #e5e5e5",
                borderRadius: "4px",
              }}
            >
              <div style={{ fontWeight: 500 }}>{obs.pattern}</div>
              <div style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.25rem" }}>
                {obs.dimension} | {obs.status}
              </div>
              <div style={{ fontSize: "0.9rem", fontStyle: "italic", marginTop: "0.25rem", color: "#555" }}>
                &ldquo;{obs.evidence}&rdquo;
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
