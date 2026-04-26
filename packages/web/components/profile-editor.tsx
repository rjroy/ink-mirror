"use client";

import { useState, useCallback, useMemo } from "react";
import { updateProfileRule, deleteProfileRule, replaceProfile } from "@/lib/api";
import type { Profile, ProfileRule } from "@ink-mirror/shared";

interface ProfileEditorProps {
  initialProfile: Profile & { markdown: string };
}

export function ProfileEditor({ initialProfile }: ProfileEditorProps) {
  const [profile, setProfile] = useState(initialProfile);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [markdownMode, setMarkdownMode] = useState(false);
  const [markdownContent, setMarkdownContent] = useState(initialProfile.markdown);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
              <h3>{dimension.replace(/-/g, " ")}</h3>
              <span className="rule" />
              <span className="ct">
                {rules.length} rule{rules.length === 1 ? "" : "s"}
              </span>
            </div>
            {rules.map((rule) => (
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
                        <Pips n={rule.sourceCount} />
                        <span>{rule.sourceSummary}</span>
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
            ))}
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
