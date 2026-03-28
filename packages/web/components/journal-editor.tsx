"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createEntry, subscribeObservations } from "@/lib/api";
import type { Observation } from "@ink-mirror/shared";
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
        <button
          className={styles.submitBtn}
          onClick={() => void handleSubmit()}
          disabled={submitting || !body.trim()}
        >
          {submitting ? "Observing..." : "Observe \u2192"}
        </button>
      </div>

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
