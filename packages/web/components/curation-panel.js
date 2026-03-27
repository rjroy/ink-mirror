"use client";
import { useState, useEffect, useCallback } from "react";
import { getCurationSession, classifyObservation } from "@/lib/api";
export function CurationPanel() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [classifying, setClassifying] = useState(null);
    const loadSession = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getCurationSession();
            setSession(data);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load curation session");
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        void loadSession();
    }, [loadSession]);
    const handleClassify = useCallback(async (id, status) => {
        setClassifying(id);
        try {
            await classifyObservation(id, status);
            // Remove classified observation from session
            setSession((prev) => {
                if (!prev)
                    return null;
                return {
                    ...prev,
                    observations: prev.observations.filter((o) => o.id !== id),
                };
            });
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to classify observation");
        }
        finally {
            setClassifying(null);
        }
    }, []);
    if (loading)
        return <div>Loading curation session...</div>;
    if (error)
        return <div style={{ color: "#c00" }}>{error}</div>;
    if (!session)
        return <div>No session data</div>;
    const { observations, contradictions } = session;
    if (observations.length === 0) {
        return (<div style={{ maxWidth: "48rem", margin: "0 auto" }}>
        <p style={{ color: "#666" }}>No pending observations to curate. Write a new entry to generate observations.</p>
      </div>);
    }
    return (<div style={{ maxWidth: "48rem", margin: "0 auto" }}>
      {contradictions.length > 0 && (<div style={{ marginBottom: "2rem" }}>
          <h3 style={{ marginBottom: "0.5rem" }}>Contradictions Detected</h3>
          {contradictions.map((c, i) => (<div key={i} style={{
                    padding: "0.75rem",
                    marginBottom: "0.5rem",
                    border: "1px solid #f0c040",
                    borderRadius: "4px",
                    backgroundColor: "#fffbe6",
                }}>
              <div style={{ fontWeight: 500 }}>Tension in {c.dimension}</div>
              <div style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
                <div>New: {c.newObservation.pattern}</div>
                <div>Confirmed: {c.confirmedObservation.pattern}</div>
              </div>
            </div>))}
        </div>)}

      <div>
        {observations.map((obs) => (<ObservationCard key={obs.id} observation={obs} onClassify={handleClassify} classifying={classifying === obs.id}/>))}
      </div>

      <button onClick={loadSession} style={{
            marginTop: "1rem",
            padding: "0.5rem 1rem",
            fontSize: "0.9rem",
            border: "1px solid #ddd",
            borderRadius: "4px",
            cursor: "pointer",
            backgroundColor: "#fff",
        }}>
        Refresh Session
      </button>
    </div>);
}
function ObservationCard({ observation, onClassify, classifying, }) {
    return (<div style={{
            padding: "1rem",
            marginBottom: "1rem",
            border: "1px solid #e5e5e5",
            borderRadius: "4px",
        }}>
      <div style={{ fontWeight: 500, marginBottom: "0.5rem" }}>
        {observation.pattern}
      </div>

      <div style={{ fontSize: "0.9rem", color: "#666", marginBottom: "0.5rem" }}>
        {observation.dimension} | {observation.status}
      </div>

      <div style={{
            padding: "0.5rem 0.75rem",
            backgroundColor: "#f7f7f7",
            borderRadius: "4px",
            fontSize: "0.9rem",
            fontStyle: "italic",
            marginBottom: "0.75rem",
        }}>
        &ldquo;{observation.evidence}&rdquo;
      </div>

      {observation.entryText && (<details style={{ marginBottom: "0.75rem" }}>
          <summary style={{ cursor: "pointer", fontSize: "0.9rem", color: "#666" }}>
            Original entry text
          </summary>
          <div style={{
                marginTop: "0.5rem",
                padding: "0.75rem",
                backgroundColor: "#fafafa",
                borderRadius: "4px",
                fontSize: "0.9rem",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
            }}>
            {observation.entryText}
          </div>
        </details>)}

      <div style={{ display: "flex", gap: "0.5rem" }}>
        {["intentional", "accidental", "undecided"].map((status) => (<button key={status} onClick={() => void onClassify(observation.id, status)} disabled={classifying} style={{
                padding: "0.4rem 0.8rem",
                fontSize: "0.85rem",
                border: "1px solid #ddd",
                borderRadius: "4px",
                cursor: classifying ? "default" : "pointer",
                backgroundColor: status === "intentional"
                    ? "#e8f5e9"
                    : status === "accidental"
                        ? "#fce4ec"
                        : "#fff3e0",
            }}>
            {status}
          </button>))}
      </div>
    </div>);
}
