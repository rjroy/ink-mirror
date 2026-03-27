"use client";

import { useState, useCallback } from "react";
import { updateProfileRule, deleteProfileRule, replaceProfile } from "@/lib/api";
import type { Profile, ProfileRule } from "@ink-mirror/shared";
import styles from "./profile-editor.module.css";

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
            rules: prev.rules.map((r) =>
              r.id === ruleId ? updated : r,
            ),
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

  if (markdownMode) {
    return (
      <div className={styles.container}>
        <div className={styles.markdownHeader}>
          <span className={styles.sectionTitle}>Edit Profile (Markdown)</span>
          <div className={styles.markdownHeaderActions}>
            <button onClick={() => setMarkdownMode(false)} className={styles.subtleBtn}>
              Cancel
            </button>
            <button onClick={handleSaveMarkdown} disabled={saving} className={styles.primaryBtn}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
        {error && <div className={styles.error}>{error}</div>}
        <textarea
          value={markdownContent}
          onChange={(e) => setMarkdownContent(e.target.value)}
          rows={20}
          className={styles.markdownTextarea}
        />
      </div>
    );
  }

  const rulesByDimension: Record<string, ProfileRule[]> = {};
  for (const rule of profile.rules) {
    const dim = rule.dimension;
    if (!rulesByDimension[dim]) rulesByDimension[dim] = [];
    rulesByDimension[dim].push(rule);
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.sectionTitle}>Style Profile</span>
        <button onClick={() => setMarkdownMode(true)} className={styles.subtleBtn}>
          Edit as Markdown
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {profile.rules.length === 0 ? (
        <p className={styles.empty}>
          No profile rules yet. Write entries and curate observations to build your style profile.
        </p>
      ) : (
        Object.entries(rulesByDimension).map(([dimension, rules]) => (
          <div key={dimension} className={styles.dimensionSection}>
            <div className={styles.dimensionLabel}>
              {dimension.replace("-", " ")}
            </div>
            {rules.map((rule) => (
              <div key={rule.id} className={styles.ruleCard}>
                <div className={styles.ruleContent}>
                  {editing === rule.id ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className={styles.ruleInput}
                    />
                  ) : (
                    <>
                      <div className={styles.rulePattern}>{rule.pattern}</div>
                      <div className={styles.ruleSource}>{rule.sourceSummary}</div>
                    </>
                  )}
                </div>
                <div className={styles.ruleActions}>
                  <button
                    onClick={() => void handleEditRule(rule.id)}
                    disabled={saving}
                    className={styles.subtleBtn}
                  >
                    {editing === rule.id ? "Save" : "Edit"}
                  </button>
                  <button
                    onClick={() => void handleDeleteRule(rule.id)}
                    className={styles.dangerBtn}
                  >
                    Delete
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
