"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createEntry, subscribeObservations } from "@/lib/api";
export function JournalEditor() {
    const router = useRouter();
    const [body, setBody] = useState("");
    const [title, setTitle] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [streamedObservations, setStreamedObservations] = useState([]);
    useEffect(() => {
        const cleanup = subscribeObservations((obs) => {
            setStreamedObservations((prev) => [...prev, obs]);
        });
        return cleanup;
    }, []);
    const handleSubmit = useCallback(async () => {
        if (!body.trim())
            return;
        setSubmitting(true);
        setError(null);
        setStreamedObservations([]);
        try {
            const entry = await createEntry(body, title || undefined);
            setBody("");
            setTitle("");
            router.push(`/entries/${entry.id}`);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create entry");
        }
        finally {
            setSubmitting(false);
        }
    }, [body, title, router]);
    return (<div style={{ maxWidth: "48rem", margin: "0 auto" }}>
      <div style={{ marginBottom: "1rem" }}>
        <input type="text" placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} disabled={submitting} style={{
            width: "100%",
            padding: "0.5rem",
            fontSize: "1.1rem",
            border: "1px solid #ddd",
            borderRadius: "4px",
            boxSizing: "border-box",
        }}/>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <textarea placeholder="Write your journal entry..." value={body} onChange={(e) => setBody(e.target.value)} disabled={submitting} rows={16} style={{
            width: "100%",
            padding: "0.75rem",
            fontSize: "1rem",
            lineHeight: 1.6,
            border: "1px solid #ddd",
            borderRadius: "4px",
            resize: "vertical",
            fontFamily: "inherit",
            boxSizing: "border-box",
        }}/>
      </div>

      {error && (<div style={{ color: "#c00", marginBottom: "1rem" }}>{error}</div>)}

      <button onClick={handleSubmit} disabled={submitting || !body.trim()} style={{
            padding: "0.5rem 1.5rem",
            fontSize: "1rem",
            backgroundColor: submitting ? "#ccc" : "#111",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: submitting ? "default" : "pointer",
        }}>
        {submitting ? "Submitting..." : "Submit Entry"}
      </button>

      {streamedObservations.length > 0 && (<div style={{ marginTop: "2rem" }}>
          <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Observations (streaming)</h3>
          {streamedObservations.map((obs) => (<div key={obs.id} style={{
                    padding: "0.75rem",
                    marginBottom: "0.5rem",
                    border: "1px solid #e5e5e5",
                    borderRadius: "4px",
                }}>
              <div style={{ fontWeight: 500 }}>{obs.pattern}</div>
              <div style={{ color: "#666", fontSize: "0.9rem", marginTop: "0.25rem" }}>
                {obs.dimension}
              </div>
            </div>))}
        </div>)}
    </div>);
}
