"use client";

import { useState, useEffect, useCallback } from "react";
import { getCurationSession, classifyObservation } from "@/lib/api";
import type { CurationSession, ObservationWithContext, Contradiction } from "@ink-mirror/shared";

type ClassificationStatus = "intentional" | "accidental" | "undecided";

const STATUS_COPY: Record<ClassificationStatus, string> = {
  intentional: "Keep — this is on purpose",
  accidental: "Release",
  undecided: "Set aside",
};

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
      setError(err instanceof Error ? err.message : "Failed to load sift session");
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

  if (loading) {
    return (
      <div className="im-page">
        <p className="im-ledger-sub" style={{ textAlign: "center" }}>
          Gathering observations…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="im-page">
        <div className="im-error">{error}</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="im-page">
        <p className="im-ledger-sub">No session data.</p>
      </div>
    );
  }

  const { observations, contradictions } = session;

  if (observations.length === 0) {
    return (
      <div className="im-page">
        <div className="im-sift-empty">
          <Flourish />
          <h2>The reading-room is quiet.</h2>
          <p>
            Once you&rsquo;ve written, observations will gather here for sifting.
            Until then, there is nothing to weigh.
          </p>
          <Flourish width={120} />
        </div>
      </div>
    );
  }

  const current = observations[0];
  const total = observations.length;
  const remaining = total - 1;
  const index = 1;

  return (
    <div className="im-sift">
      <div className="im-sift-context">
        <div className="label">Context · {current.entryId ?? "current entry"}</div>
        {current.entryText ? (
          <div className="im-sift-prose">{current.entryText}</div>
        ) : (
          <div className="im-sift-prose">
            <em>The entry text isn&rsquo;t loaded for this observation.</em>
          </div>
        )}
        {contradictions.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <div className="label">Tensions</div>
            {contradictions.map((c: Contradiction, i: number) => (
              <div key={i} className="im-note" style={{ marginBottom: 12 }}>
                <div className="im-note-dim">Tension in {c.dimension}</div>
                <p className="im-note-body">
                  <strong>New:</strong> {c.newObservation.pattern}
                </p>
                <p className="im-note-body">
                  <strong>Confirmed:</strong> {c.confirmedObservation.pattern}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="im-sift-panel">
        <div className="im-sift-counter">
          <span className="of">Sifting</span>
          <span>
            <span className="num">{index}</span>
            <span className="of" style={{ marginLeft: 6 }}>of {total}</span>
          </span>
        </div>
        <SiftCard
          observation={current}
          onClassify={handleClassify}
          classifying={classifying === current.id}
        />
        <div style={{ flex: 1 }} />
        <p className="im-sift-footnote">
          {remaining > 0
            ? `${remaining} more after this. "Kept" patterns join your hand. "Released" are forgotten. "Set aside" return next session.`
            : 'Last one. "Kept" patterns join your hand. "Released" are forgotten. "Set aside" return next session.'}
        </p>
      </div>
    </div>
  );
}

function SiftCard({
  observation,
  onClassify,
  classifying,
}: {
  observation: ObservationWithContext;
  onClassify: (id: string, status: ClassificationStatus) => Promise<void>;
  classifying: boolean;
}) {
  return (
    <div className="im-sift-card">
      <div className="dim">{observation.dimension}</div>
      <p className="desc">{observation.pattern}</p>
      {observation.evidence && (
        <div className="quote">&ldquo;{observation.evidence}&rdquo;</div>
      )}
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 11,
          letterSpacing: "0.16em",
          color: "var(--fg-3)",
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        Choose
      </div>
      <div className="im-sift-actions">
        <button
          className="btn btn-keep btn-wide"
          onClick={() => void onClassify(observation.id, "intentional")}
          disabled={classifying}
        >
          {STATUS_COPY.intentional}
        </button>
        <button
          className="btn btn-release btn-wide"
          onClick={() => void onClassify(observation.id, "accidental")}
          disabled={classifying}
        >
          {STATUS_COPY.accidental}
        </button>
        <button
          className="btn btn-set-aside btn-wide"
          onClick={() => void onClassify(observation.id, "undecided")}
          disabled={classifying}
        >
          {STATUS_COPY.undecided}
        </button>
      </div>
    </div>
  );
}

function Flourish({ width = 200 }: { width?: number }) {
  return (
    <svg
      className="im-flourish"
      viewBox="0 0 200 14"
      width={width}
      height={14}
      style={{ color: "var(--rule-strong)" }}
    >
      <g fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M0 7 L80 7" />
        <path d="M120 7 L200 7" />
        <circle cx="100" cy="7" r="3" />
        <path d="M92 7 L88 4 M92 7 L88 10 M108 7 L112 4 M108 7 L112 10" />
      </g>
    </svg>
  );
}
