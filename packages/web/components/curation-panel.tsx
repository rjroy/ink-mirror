"use client";

import { useState, useEffect, useCallback } from "react";
import { getCurationSession, classifyObservation } from "@/lib/api";
import type { CurationSession, ObservationWithContext, Contradiction } from "@ink-mirror/shared";
import styles from "./curation-panel.module.css";

type ClassificationStatus = "intentional" | "accidental" | "undecided";

export function CurationPanel() {
  const [session, setSession] = useState<CurationSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classifying, setClassifying] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCurationSession();
      setSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load curation session");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const handleClassify = useCallback(
    async (id: string, status: ClassificationStatus) => {
      setClassifying(id);
      try {
        await classifyObservation(id, status);
        setSession((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            observations: prev.observations.filter((o) => o.id !== id),
          };
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to classify observation");
      } finally {
        setClassifying(null);
      }
    },
    [],
  );

  if (loading) return <div className={styles.loading}>Loading curation session...</div>;
  if (error) return <div className={styles.error}>{error}</div>;
  if (!session) return <div className={styles.loading}>No session data</div>;

  const { observations, contradictions } = session;

  if (observations.length === 0) {
    return (
      <div className={styles.container}>
        <p className={styles.empty}>
          No pending observations to curate. Write a new entry to generate observations.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {contradictions.length > 0 && (
        <div className={styles.contradictions}>
          <div className={styles.contradictionsLabel}>Contradictions Detected</div>
          {contradictions.map((c: Contradiction, i: number) => (
            <div key={i} className={styles.contradictionCard}>
              <div className={styles.contradictionDimension}>Tension in {c.dimension}</div>
              <div className={styles.contradictionPatterns}>
                <div>New: {c.newObservation.pattern}</div>
                <div>Confirmed: {c.confirmedObservation.pattern}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        {observations.map((obs: ObservationWithContext) => (
          <ObservationCard
            key={obs.id}
            observation={obs}
            onClassify={handleClassify}
            classifying={classifying === obs.id}
          />
        ))}
      </div>

      <button onClick={loadSession} className={styles.refreshBtn}>
        Refresh Session
      </button>
    </div>
  );
}

function ObservationCard({
  observation,
  onClassify,
  classifying,
}: {
  observation: ObservationWithContext;
  onClassify: (id: string, status: ClassificationStatus) => Promise<void>;
  classifying: boolean;
}) {
  return (
    <div className={styles.obsCard}>
      <div className={styles.obsMeta}>
        {observation.dimension} &middot; {observation.status}
      </div>
      <div className={styles.obsPattern}>{observation.pattern}</div>

      <div className={styles.obsEvidence}>
        <div className={styles.obsEvidenceText}>
          &ldquo;{observation.evidence}&rdquo;
        </div>
      </div>

      {observation.entryText && (
        <details className={styles.obsEntryText}>
          <summary className={styles.obsEntryTextSummary}>Original entry text</summary>
          <div className={styles.obsEntryTextBody}>{observation.entryText}</div>
        </details>
      )}

      <div className={styles.obsClassify}>
        <button
          onClick={() => void onClassify(observation.id, "intentional")}
          disabled={classifying}
          className={styles.classifyBtnIntentional}
        >
          Intentional
        </button>
        <button
          onClick={() => void onClassify(observation.id, "accidental")}
          disabled={classifying}
          className={styles.classifyBtnAccidental}
        >
          Accidental
        </button>
        <button
          onClick={() => void onClassify(observation.id, "undecided")}
          disabled={classifying}
          className={styles.classifyBtnUndecided}
        >
          Undecided
        </button>
      </div>
    </div>
  );
}
