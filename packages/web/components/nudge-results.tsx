"use client";

import type { CraftNudge } from "@ink-mirror/shared";

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
    return <div className="im-error">{error}</div>;
  }

  if (nudges.length === 0) {
    return null;
  }

  return (
    <div className="im-nudge-section">
      <div className="im-nudge-label">Craft Nudges</div>
      {nudges.map((nudge, i) => (
        <div key={i} className="im-note" style={{ maxWidth: 720 }}>
          <div className="im-note-dim">{formatPrinciple(nudge.craftPrinciple)}</div>
          <p className="im-note-body">{nudge.observation}</p>
          <div className="im-note-quote">
            <span className="qhead">From your writing</span>
            &ldquo;{nudge.evidence}&rdquo;
          </div>
          <p className="im-nudge-question">{nudge.question}</p>
        </div>
      ))}
    </div>
  );
}
