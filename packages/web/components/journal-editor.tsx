"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createEntry, requestNudge, subscribeObservations } from "@/lib/api";
import type { Observation, CraftNudge } from "@ink-mirror/shared";
import { NudgeResults } from "./nudge-results";
import styles from "./journal-editor.module.css";

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function JournalEditor() {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamedObservations, setStreamedObservations] = useState<Observation[]>([]);
  const [nudging, setNudging] = useState(false);
  const [nudges, setNudges] = useState<CraftNudge[]>([]);
  const [nudgeError, setNudgeError] = useState<string | null>(null);

  const wordCount = useMemo(() => {
    const trimmed = body.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }, [body]);

  const handleSubmit = useCallback(async () => {
    if (!body.trim()) return;

    setSubmitting(true);
    setError(null);
    setStreamedObservations([]);

    // Open SSE only during submission, close when done
    const cleanup = subscribeObservations((obs) => {
      setStreamedObservations((prev) => [...prev, obs]);
    });

    try {
      const entry = await createEntry(body);
      setBody("");
      router.push(`/entries/${entry.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create entry");
    } finally {
      cleanup();
      setSubmitting(false);
    }
  }, [body, router]);

  const handleNudge = useCallback(async () => {
    if (!body.trim()) return;

    setNudging(true);
    setNudgeError(null);
    setNudges([]);

    try {
      const response = await requestNudge({ text: body });
      setNudges(response.nudges);
      if (response.error) {
        setNudgeError(response.error);
      }
    } catch (err) {
      setNudgeError(err instanceof Error ? err.message : "Failed to get nudges");
    } finally {
      setNudging(false);
    }
  }, [body]);

  return (
    <div className={styles.editorPane}>
      <div className={styles.entryDate}>{formatDate()}</div>

      <textarea
        className={styles.textarea}
        placeholder="Write your journal entry..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={submitting}
      />

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.footer}>
        <span className={styles.wordCount}>{wordCount} words</span>
        <div className={styles.footerActions}>
          <button
            className={styles.nudgeBtn}
            onClick={() => void handleNudge()}
            disabled={nudging || !body.trim()}
          >
            {nudging ? "Nudging..." : "Nudge"}
          </button>
          <button
            className={styles.submitBtn}
            onClick={() => void handleSubmit()}
            disabled={submitting || !body.trim()}
          >
            {submitting ? "Observing..." : "Observe \u2192"}
          </button>
        </div>
      </div>

      <NudgeResults nudges={nudges} error={nudgeError ?? undefined} />

      {streamedObservations.length > 0 && (
        <div className={styles.streamSection}>
          <div className={styles.streamLabel}>Observations</div>
          {streamedObservations.map((obs) => (
            <div key={obs.id} className={styles.streamCard}>
              <div className={styles.streamCardDimension}>{obs.dimension}</div>
              <div className={styles.streamCardPattern}>{obs.pattern}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
