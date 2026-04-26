"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { requestNudge } from "@/lib/api";
import type { CraftNudge, NudgeResponse } from "@ink-mirror/shared";
import { NudgeResults } from "./nudge-results";

type ResultState = {
  nudges: CraftNudge[];
  source: "cache" | "fresh";
  stale: boolean;
  generatedAt: string;
};

export function formatSavedLabel(
  generatedAt: string,
  stale: boolean,
  now: Date = new Date(),
): string {
  const base = `Saved ${formatRelativeTime(generatedAt, now)}`;
  return stale ? `${base} — entry edited since` : base;
}

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  if (Number.isNaN(diffMs)) return iso;
  const seconds = Math.max(0, Math.round(diffMs / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return then.toISOString().slice(0, 10);
}

export function toResultState(response: NudgeResponse): ResultState {
  return {
    nudges: response.nudges,
    source: response.source,
    // Defensive: the stale suffix only has meaning for cache hits. A malformed
    // fresh response claiming stale=true should not display "edited since".
    stale: response.source === "cache" && response.stale === true,
    generatedAt: response.generatedAt,
  };
}

export function EntryNudge({ entryId }: { entryId: string }) {
  const [nudging, setNudging] = useState(false);
  const [result, setResult] = useState<ResultState | null>(null);
  const [nudgeError, setNudgeError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const runNudge = useCallback(
    async (refresh: boolean) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setNudging(true);
      setNudgeError(null);

      try {
        const response = await requestNudge(
          refresh ? { entryId, refresh: true } : { entryId },
          { signal: controller.signal },
        );
        if (!mountedRef.current || controller.signal.aborted) return;
        setResult(toResultState(response));
        setNudgeError(response.error ?? null);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (!mountedRef.current) return;
        setNudgeError(err instanceof Error ? err.message : "Failed to get nudges");
      } finally {
        if (mountedRef.current && abortRef.current === controller) {
          setNudging(false);
        }
      }
    },
    [entryId],
  );

  if (!result && !nudgeError) {
    return (
      <div style={{ marginTop: 28, maxWidth: 720 }}>
        <button
          className="btn btn-sm"
          onClick={() => void runNudge(false)}
          disabled={nudging}
        >
          {nudging ? "Nudging..." : "Nudge"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 28, maxWidth: 720 }}>
      <NudgeResults
        nudges={result?.nudges ?? []}
        error={nudgeError ?? undefined}
      />
      {result && result.nudges.length > 0 && (
        <div className="im-nudge-saved">
          <span>{formatSavedLabel(result.generatedAt, result.stale)}</span>
          <button
            className="btn btn-sm"
            onClick={() => void runNudge(true)}
            disabled={nudging}
          >
            {nudging ? "Regenerating..." : "Regenerate"}
          </button>
        </div>
      )}
      {nudgeError && (!result || result.nudges.length === 0) && (
        <div className="im-nudge-saved">
          <button
            className="btn btn-sm"
            onClick={() => void runNudge(false)}
            disabled={nudging}
          >
            {nudging ? "Nudging..." : "Try again"}
          </button>
        </div>
      )}
    </div>
  );
}
