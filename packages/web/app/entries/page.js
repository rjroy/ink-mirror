import Link from "next/link";
import { daemonJson } from "@/lib/daemon";
export const dynamic = "force-dynamic";
export default async function EntriesPage() {
    let entries;
    try {
        entries = await daemonJson("/entries");
    }
    catch {
        return <div style={{ color: "#c00" }}>Failed to load entries. Is the daemon running?</div>;
    }
    return (<div style={{ maxWidth: "48rem", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>Entries</h1>

      {entries.length === 0 ? (<p style={{ color: "#666" }}>
          No entries yet. <Link href="/write">Write your first entry</Link>.
        </p>) : (<div>
          {entries.map((entry) => (<Link key={entry.id} href={`/entries/${entry.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
              <div style={{
                    padding: "1rem",
                    marginBottom: "0.5rem",
                    border: "1px solid #e5e5e5",
                    borderRadius: "4px",
                }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontWeight: 500 }}>
                    {entry.title ?? entry.id}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#999" }}>
                    {entry.date}
                  </div>
                </div>
                <div style={{ fontSize: "0.9rem", color: "#666", marginTop: "0.25rem" }}>
                  {entry.preview}
                </div>
              </div>
            </Link>))}
        </div>)}
    </div>);
}
