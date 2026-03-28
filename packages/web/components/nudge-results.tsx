"use client";

import type { CraftNudge } from "@ink-mirror/shared";
import styles from "./nudge-results.module.css";

function formatPrinciple(principle: string): string {
  return principle.replace(/-/g, " ");
}

export function NudgeResults({
  nudges,
  error,
}: {
  nudges: CraftNudge[];
  error?: string;
}) {
  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  if (nudges.length === 0) {
    return null;
  }

  return (
    <div className={styles.nudgeSection}>
      <div className={styles.nudgeLabel}>Craft Nudges</div>
      {nudges.map((nudge, i) => (
        <div key={i} className={styles.nudgeCard}>
          <div className={styles.principle}>
            {formatPrinciple(nudge.craftPrinciple)}
          </div>
          <div className={styles.observation}>{nudge.observation}</div>
          <div className={styles.evidence}>
            <div className={styles.evidenceLabel}>from your writing</div>
            <div className={styles.evidenceText}>
              &ldquo;{nudge.evidence}&rdquo;
            </div>
          </div>
          <div className={styles.question}>{nudge.question}</div>
        </div>
      ))}
    </div>
  );
}
