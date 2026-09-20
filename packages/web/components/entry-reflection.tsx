"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { DIMENSION_LABELS } from "@ink-mirror/shared";
import type { Observation } from "@ink-mirror/shared";
import { reflectEntry } from "@/lib/api";

export function EntryReflection({
  entryId,
  initialObservations,
}: {
  entryId: string;
  initialObservations: Observation[];
}) {
  const [observations, setObservations] = useState(initialObservations);
  const [isReflecting, setIsReflecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isWarning, setIsWarning] = useState(false);

  const runReflection = useCallback(async () => {
    setIsReflecting(true);
    setMessage(null);
    setIsWarning(false);
    try {
      const result = await reflectEntry(entryId);
      // A warning can still carry accepted observations. An all-rejected run
      // keeps the previous accepted observations visible rather than erasing
      // them with an unsuccessful result.
      if (result.errors.length === 0 || result.observations.length > 0) {
        setObservations(result.observations);
      }
      if (result.errors.length > 0) {
        setMessage(`Reflection completed with warnings: ${result.errors.join("; ")}`);
        setIsWarning(true);
      } else {
        setMessage("Reflection updated.");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Reflection failed");
      setIsWarning(true);
    } finally {
      setIsReflecting(false);
    }
  }, [entryId]);

  return (
    <aside className="im-rail" aria-live="polite">
      <div className="im-rail-head">
        <div className="im-rail-title">Observations</div>
        <button className="btn btn-sm" onClick={() => void runReflection()} disabled={isReflecting}>
          {isReflecting ? "Reflecting..." : "Reflect again"}
        </button>
      </div>
      {message && <p role={isWarning ? "alert" : "status"}>{message}</p>}
      {observations.length === 0 ? (
        <p>No accepted observations yet.</p>
      ) : (
        observations.map((obs, i) => (
          <div key={obs.id} className="im-note">
            <div className="im-note-dim">{DIMENSION_LABELS[obs.dimension] ?? obs.dimension}</div>
            <p className="im-note-body">{obs.pattern}</p>
            {obs.evidence.length > 0 && (
              <div className="im-note-quote">
                <span className="qhead">From your entry</span>
                {obs.evidence.map((fragment, index) => (
                  <span key={index} className="block">&ldquo;{fragment}&rdquo;</span>
                ))}
              </div>
            )}
            <div className="im-note-foot">
              <Link href={`/patterns/${obs.patternId}`} className="im-dossier-link">View pattern →</Link>
              <span className="im-rail-count">№ {String(i + 1).padStart(2, "0")}</span>
            </div>
          </div>
        ))
      )}
    </aside>
  );
}
