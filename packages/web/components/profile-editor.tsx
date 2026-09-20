"use client";

import { useState, useCallback, useMemo } from "react";
import { updateProfileRule, deleteProfileRule, replaceProfile } from "@/lib/api";
import { DIMENSION_LABELS } from "@ink-mirror/shared";
import type {
  Profile,
  ProfileRule,
  ResurfacedRule,
  ResurfacedRuleReason,
  RuleProvenance,
  Pattern,
} from "@ink-mirror/shared";

interface ProfileEditorProps {
  initialProfile: Profile & { markdown: string };
  /** Rules currently flagged for reaffirm-or-retire (REQ-LPC-19/20/21). */
  resurfacedRules: ResurfacedRule[];
  /** The pattern ledger, joined against rule.patternId for dossier links and migrated state (REQ-LPC-18/27). */
  patterns: Pattern[];
}

export type HealthState = "fine" | "stale" | "drift" | "stale-and-drift";

/** Reduces a resurfaced rule's reasons (zero or more) to a single display state. */
export function healthState(reasons: ResurfacedRuleReason[]): HealthState {
  const stale = reasons.includes("stale");
  const drift = reasons.includes("drift");
  if (stale && drift) return "stale-and-drift";
  if (stale) return "stale";
  if (drift) return "drift";
  return "fine";
}

export function healthLabel(state: HealthState): string {
  switch (state) {
    case "fine":
      return "Fine";
    case "stale":
      return "Stale";
    case "drift":
      return "Drifting";
    case "stale-and-drift":
      return "Stale + Drifting";
  }
}

// The stylesheet only defines .im-health-stale/-drift/-fine (no combined
// variant): "stale-and-drift" borrows the drift color since drift is the
// more actionable of the two reasons.
function healthClassSuffix(state: HealthState): "fine" | "stale" | "drift" {
  return state === "stale-and-drift" ? "drift" : state;
}

/**
 * REQ-LPC-16: a rule either came from the writer's own say-so or from
 * evidence crossing the promotion thresholds. Older rules (pre-Phase-5
 * migration) recorded neither, so this degrades honestly instead of
 * guessing.
 */
export function provenanceLabel(provenance?: RuleProvenance): string {
  if (provenance === "writer-asserted") return "Writer-asserted";
  if (provenance === "evidence-confirmed") return "Evidence-confirmed";
  return "Unspecified provenance";
}

export function ProfileEditor({ initialProfile, resurfacedRules, patterns }: ProfileEditorProps) {
  const [profile, setProfile] = useState(initialProfile);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [markdownMode, setMarkdownMode] = useState(false);
  const [markdownContent, setMarkdownContent] = useState(initialProfile.markdown);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patternsById = useMemo(() => new Map(patterns.map((p) => [p.id, p])), [patterns]);
  const resurfacedByRuleId = useMemo(
    () => new Map(resurfacedRules.map((r) => [r.rule.id, r])),
    [resurfacedRules],
  );

  const handleEditRule = useCallback(
    async (ruleId: string) => {
      if (editing === ruleId) {
        setSaving(true);
        setError(null);
        try {
          const updated = await updateProfileRule(ruleId, { pattern: editValue });
          setProfile((prev) => ({
            ...prev,
            rules: prev.rules.map((r) => (r.id === ruleId ? updated : r)),
          }));
          setEditing(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to update rule");
        } finally {
          setSaving(false);
        }
      } else {
        const rule = profile.rules.find((r) => r.id === ruleId);
        if (rule) {
          setEditValue(rule.pattern);
          setEditing(ruleId);
        }
      }
    },
    [editing, editValue, profile.rules],
  );

  const handleDeleteRule = useCallback(async (ruleId: string) => {
    setError(null);
    try {
      await deleteProfileRule(ruleId);
      setProfile((prev) => ({
        ...prev,
        rules: prev.rules.filter((r) => r.id !== ruleId),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete rule");
    }
  }, []);

  const handleSaveMarkdown = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await replaceProfile(markdownContent);
      setProfile({ ...updated, markdown: markdownContent });
      setMarkdownMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }, [markdownContent]);

  const rulesByDimension = useMemo(() => {
    const grouped: Record<string, ProfileRule[]> = {};
    for (const rule of profile.rules) {
      const dim = rule.dimension;
      if (!grouped[dim]) grouped[dim] = [];
      grouped[dim].push(rule);
    }
    return grouped;
  }, [profile.rules]);

  if (markdownMode) {
    return (
      <div className="im-hand">
        <div className="im-hand-head">
          <div>
            <div className="eyebrow">Your hand</div>
            <h1>Edit as markdown</h1>
            <div className="sub">
              The whole profile, raw. Save replaces every rule.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-sm btn-ghost" onClick={() => setMarkdownMode(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => void handleSaveMarkdown()}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
        {error && <div className="im-error">{error}</div>}
        <textarea
          className="im-markdown"
          value={markdownContent}
          onChange={(e) => setMarkdownContent(e.target.value)}
          rows={20}
        />
      </div>
    );
  }

  const totalRules = profile.rules.length;
  const dimensionEntries = Object.entries(rulesByDimension);

  return (
    <div className="im-hand">
      <div className="im-hand-head">
        <div>
          <div className="eyebrow">Your hand</div>
          <h1>The way you write</h1>
          <div className="sub">
            {totalRules === 0
              ? "Drawn from nothing yet. Sift observations to build your hand."
              : `${totalRules} rule${totalRules === 1 ? "" : "s"} confirmed across your entries.`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-sm btn-ghost" onClick={() => setMarkdownMode(true)}>
            Edit as markdown
          </button>
        </div>
      </div>

      {error && <div className="im-error">{error}</div>}

      {totalRules === 0 ? (
        <p className="im-ledger-sub">
          No profile rules yet. Write entries and sift observations to build your hand.
        </p>
      ) : (
        dimensionEntries.map(([dimension, rules]) => (
          <div key={dimension} className="im-dim-section">
            <div className="im-dim-head">
              <h3>{DIMENSION_LABELS[dimension as keyof typeof DIMENSION_LABELS] ?? dimension}</h3>
              <span className="rule" />
              <span className="ct">
                {rules.length} rule{rules.length === 1 ? "" : "s"}
              </span>
            </div>
            {rules.map((rule) => {
              const pattern = rule.patternId ? patternsById.get(rule.patternId) : undefined;
              const migrated = pattern?.migratedNoHistory === true;
              const reasons = resurfacedByRuleId.get(rule.id)?.reasons ?? [];
              const state = healthState(reasons);

              return (
                <div key={rule.id} className="im-rule-row">
                  <div>
                    {editing === rule.id ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="im-markdown"
                        style={{ minHeight: "auto", padding: 8, fontFamily: "var(--font-serif)" }}
                      />
                    ) : (
                      <>
                        <p className="im-rule-text">{rule.pattern}</p>
                        <div className="im-rule-meta">
                          {!migrated && <Pips n={rule.sourceCount} />}
                          <span>
                            {migrated
                              ? "Migrated — no historical sightings recorded"
                              : rule.sourceSummary}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                          <span
                            className={`im-badge${
                              rule.provenance ? ` im-badge-${rule.provenance}` : ""
                            }`}
                          >
                            {provenanceLabel(rule.provenance)}
                          </span>
                          {migrated && <span className="im-badge im-badge-migrated">Migrated</span>}
                          <span className={`im-health im-health-${healthClassSuffix(state)}`}>
                            {healthLabel(state)}
                          </span>
                          {pattern && (
                            <a href={`/patterns/${pattern.id}`} className="im-dossier-link">
                              Why does it say this?
                            </a>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="im-rule-actions">
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => void handleEditRule(rule.id)}
                      disabled={saving}
                    >
                      {editing === rule.id ? "Save" : "Edit"}
                    </button>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => void handleDeleteRule(rule.id)}
                      style={{ color: "var(--oxblood-500)" }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}

function Pips({ n, max = 6 }: { n: number; max?: number }) {
  const filled = Math.max(0, Math.min(n, max));
  return (
    <span className="pips">
      {Array.from({ length: max }).map((_, i) => (
        <i key={i} className={i < filled ? "" : "dim"} />
      ))}
    </span>
  );
}
