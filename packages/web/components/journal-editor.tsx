"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createEntry, requestNudge, subscribeObservations } from "@/lib/api";
import type { ObservationCreatedEvent, PatternDiscoveredEvent, CraftNudge } from "@ink-mirror/shared";
import { NudgeResults } from "./nudge-results";

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * The live SSE stream of observations right after entry submission
 * (REQ-LPC-11). Every one is a fresh sighting, not yet judged — its pattern
 * may still be a brand-new candidate or years from crossing the promotion
 * thresholds — so each is labeled "Unconfirmed" here, matching the honest,
 * un-hedged tone of curation-panel.tsx's "Evidence still accumulating"
 * copy. This is deliberately scoped to the immediate post-submission
 * stream: the dossier/curation-panel views already show real classification
 * state (candidate/intentional/accidental/etc.) and don't need this label.
 * Exported as its own component (rather than inlined in JournalEditor) so
 * it can be tested directly without needing a router or a live SSE
 * connection.
 */
export function StreamedObservations({ observations }: { observations: ObservationCreatedEvent[] }) {
  if (observations.length === 0) return null;
  return (
    <div className="im-nudge-section">
      <div className="im-nudge-label">Observations</div>
      {observations.map((obs) => (
        <div key={obs.id} className="im-note">
          <div className="im-note-dim">{obs.dimension}</div>
          <p className="im-note-body">{obs.pattern}</p>
          <span
            className="im-badge im-badge-unconfirmed"
            title="A sighting, not a confirmed pattern — it needs to cross the confirmation thresholds during curation first."
          >
            Unconfirmed
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * A "new pattern noticed" banner for the same submission-scoped SSE window
 * StreamedObservations covers (REQ-LPC-29). `pattern:discovered` fires when
 * the Observer creates a brand-new candidate pattern while processing the
 * just-submitted entry — that happens inside the same request/SSE-connection
 * window this component's caller already has open, so surfacing it here is a
 * natural extension of the existing stream rather than a new connection.
 * (Detach-triggered `pattern:discovered` events, from routes/patterns.ts,
 * fire during curation, outside this window, and are simply never observed
 * here — there is no live listener open at that time.)
 * Exported separately, like StreamedObservations, so it can be tested without
 * a router or a live SSE connection.
 */
export function DiscoveredPatterns({ patterns }: { patterns: PatternDiscoveredEvent[] }) {
  if (patterns.length === 0) return null;
  return (
    <div className="im-nudge-section">
      <div className="im-nudge-label">New patterns</div>
      {patterns.map(({ pattern }) => (
        <div key={pattern.id} className="im-note">
          <div className="im-note-dim">{pattern.dimension}</div>
          <p className="im-note-body">New pattern noticed: {pattern.statement}</p>
        </div>
      ))}
    </div>
  );
}

export function JournalEditor() {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamedObservations, setStreamedObservations] = useState<ObservationCreatedEvent[]>([]);
  const [discoveredPatterns, setDiscoveredPatterns] = useState<PatternDiscoveredEvent[]>([]);
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
    setDiscoveredPatterns([]);

    const cleanup = subscribeObservations({
      onObservation: (obs) => {
        setStreamedObservations((prev) => [...prev, obs]);
      },
      onPatternDiscovered: (event) => {
        setDiscoveredPatterns((prev) => [...prev, event]);
      },
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

      <DiscoveredPatterns patterns={discoveredPatterns} />
      <StreamedObservations observations={streamedObservations} />
    </div>
  );
}
