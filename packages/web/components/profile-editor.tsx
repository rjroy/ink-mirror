"use client";

import { useState, useCallback } from "react";
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
      <div style={{ maxWidth: "48rem", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ margin: 0 }}>Edit Profile (Markdown)</h2>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => setMarkdownMode(false)}
              style={{ padding: "0.4rem 0.8rem", border: "1px solid #ddd", borderRadius: "4px", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveMarkdown}
              disabled={saving}
              style={{
                padding: "0.4rem 0.8rem",
                backgroundColor: "#111",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: saving ? "default" : "pointer",
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
        {error && <div style={{ color: "#c00", marginBottom: "1rem" }}>{error}</div>}
        <textarea
          value={markdownContent}
          onChange={(e) => setMarkdownContent(e.target.value)}
          rows={20}
          style={{
            width: "100%",
            padding: "0.75rem",
            fontSize: "0.9rem",
            fontFamily: "monospace",
            border: "1px solid #ddd",
            borderRadius: "4px",
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
      </div>
    );
  }

  // Group rules by dimension
  const rulesByDimension: Record<string, ProfileRule[]> = {};
  for (const rule of profile.rules) {
    const dim = rule.dimension;
    if (!rulesByDimension[dim]) rulesByDimension[dim] = [];
    rulesByDimension[dim].push(rule);
  }

  return (
    <div style={{ maxWidth: "48rem", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h2 style={{ margin: 0 }}>Style Profile</h2>
        <button
          onClick={() => setMarkdownMode(true)}
          style={{ padding: "0.4rem 0.8rem", border: "1px solid #ddd", borderRadius: "4px", cursor: "pointer" }}
        >
          Edit as Markdown
        </button>
      </div>

      {error && <div style={{ color: "#c00", marginBottom: "1rem" }}>{error}</div>}

      {profile.rules.length === 0 ? (
        <p style={{ color: "#666" }}>
          No profile rules yet. Write entries and curate observations to build your style profile.
        </p>
      ) : (
        Object.entries(rulesByDimension).map(([dimension, rules]) => (
          <div key={dimension} style={{ marginBottom: "1.5rem" }}>
            <h3 style={{ fontSize: "1rem", textTransform: "capitalize", marginBottom: "0.5rem" }}>
              {dimension.replace("-", " ")}
            </h3>
            {rules.map((rule) => (
              <div
                key={rule.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.5rem",
                  padding: "0.75rem",
                  marginBottom: "0.5rem",
                  border: "1px solid #e5e5e5",
                  borderRadius: "4px",
                }}
              >
                <div style={{ flex: 1 }}>
                  {editing === rule.id ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.3rem",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        boxSizing: "border-box",
                      }}
                    />
                  ) : (
                    <>
                      <div>{rule.pattern}</div>
                      <div style={{ fontSize: "0.8rem", color: "#999", marginTop: "0.25rem" }}>
                        {rule.sourceSummary}
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={() => void handleEditRule(rule.id)}
                  disabled={saving}
                  style={{ padding: "0.3rem 0.5rem", fontSize: "0.8rem", border: "1px solid #ddd", borderRadius: "4px", cursor: "pointer" }}
                >
                  {editing === rule.id ? "Save" : "Edit"}
                </button>
                <button
                  onClick={() => void handleDeleteRule(rule.id)}
                  style={{ padding: "0.3rem 0.5rem", fontSize: "0.8rem", border: "1px solid #ddd", borderRadius: "4px", cursor: "pointer", color: "#c00" }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
