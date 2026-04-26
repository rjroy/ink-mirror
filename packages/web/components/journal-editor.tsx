"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createEntry, requestNudge, subscribeObservations } from "@/lib/api";
import type { Observation, CraftNudge } from "@ink-mirror/shared";
import { NudgeResults } from "./nudge-results";

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
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
    <div className="im-editor-wrap">
      <div className="im-sheet">
        <div className="grain-bg" />
        <div className="im-date">{formatDate()}</div>
        <textarea
          className="im-textarea"
          placeholder="Begin here. The page keeps no opinion of you."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={submitting}
        />
      </div>

      {error && <div className="im-error">{error}</div>}

      <div className="im-bottombar">
        <span className="im-wordcount">
          {wordCount} {wordCount === 1 ? "word" : "words"}
        </span>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="btn btn-sm"
            onClick={() => void handleNudge()}
            disabled={nudging || !body.trim()}
          >
            {nudging ? "Nudging..." : "Nudge"}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => void handleSubmit()}
            disabled={submitting || !body.trim()}
          >
            {submitting ? "Reflecting..." : "Reflect →"}
          </button>
        </div>
      </div>

      <NudgeResults nudges={nudges} error={nudgeError ?? undefined} />

      {streamedObservations.length > 0 && (
        <div className="im-nudge-section">
          <div className="im-nudge-label">Observations</div>
          {streamedObservations.map((obs) => (
            <div key={obs.id} className="im-note">
              <div className="im-note-dim">{obs.dimension}</div>
              <p className="im-note-body">{obs.pattern}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
