"use client";

import { useState, useCallback } from "react";
import { requestNudge } from "@/lib/api";
import type { CraftNudge } from "@ink-mirror/shared";
import { NudgeResults } from "./nudge-results";
import styles from "./entry-nudge.module.css";

export function EntryNudge({ entryId }: { entryId: string }) {
  const [nudging, setNudging] = useState(false);
  const [nudges, setNudges] = useState<CraftNudge[]>([]);
  const [nudgeError, setNudgeError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);

  const handleNudge = useCallback(async () => {
    setNudging(true);
    setNudgeError(null);
    setNudges([]);

    try {
      const response = await requestNudge({ entryId });
      setNudges(response.nudges);
      setRequested(true);
      if (response.error) {
        setNudgeError(response.error);
      }
    } catch (err) {
      setNudgeError(err instanceof Error ? err.message : "Failed to get nudges");
      setRequested(true);
    } finally {
      setNudging(false);
    }
  }, [entryId]);

  return (
    <div className={styles.nudgeWrapper}>
      <button
        className={styles.nudgeBtn}
        onClick={() => void handleNudge()}
        disabled={nudging}
      >
        {nudging ? "Nudging..." : "Nudge"}
      </button>
      {requested && <NudgeResults nudges={nudges} error={nudgeError ?? undefined} />}
    </div>
  );
}
