import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFileSync, readFileSync, unlinkSync } from "node:fs";
import type { ObservationDimension } from "@ink-mirror/shared";
import { DIMENSION_LABELS } from "@ink-mirror/shared";
import type { DaemonClient } from "./client.js";

interface ProfileResponse {
  version: number;
  updatedAt: string;
  rules: Array<{
    id: string;
    pattern: string;
    dimension: ObservationDimension;
    sourceCount: number;
    sourceSummary: string;
  }>;
  markdown: string;
}

/**
 * Display the current writing style profile.
 * `ink-mirror profile`
 */
export async function showProfile(client: DaemonClient): Promise<void> {
  const profile = await client.fetchJson<ProfileResponse>("/profile");

  if (profile.rules.length === 0) {
    console.log("No patterns confirmed yet.");
    console.log("Write entries and curate observations to build your profile.");
    return;
  }

  // Group by dimension
  const byDimension = new Map<ObservationDimension, typeof profile.rules>();
  for (const rule of profile.rules) {
    const existing = byDimension.get(rule.dimension) ?? [];
    existing.push(rule);
    byDimension.set(rule.dimension, existing);
  }

  for (const [dimension, rules] of byDimension) {
    const label = DIMENSION_LABELS[dimension];
    console.log(`\n${label}`);
    console.log("─".repeat(label.length));
    for (const rule of rules) {
      console.log(`  ${rule.pattern}`);
      console.log(`    ${rule.sourceSummary} [${rule.id}]`);
    }
  }
  console.log("");
}

/**
 * Open the profile in $EDITOR for full editing.
 * `ink-mirror profile edit`
 */
export async function editProfile(
  client: DaemonClient,
  editorSpawn?: (file: string) => Promise<number>,
): Promise<void> {
  const editor = process.env.EDITOR;
  if (!editor) {
    console.error(
      "No $EDITOR set. Set EDITOR to your preferred text editor.",
    );
    process.exit(1);
  }

  // Fetch current profile markdown
  const res = await client.fetch("/profile");
  if (!res.ok) {
    const text = await res.text();
    console.error(`Error fetching profile: ${text}`);
    process.exit(1);
  }

  const profile = (await res.json()) as ProfileResponse;

  // Build the full markdown from the stored profile
  const currentMarkdown = buildProfileMarkdown(profile);

  const tmpFile = join(tmpdir(), `ink-mirror-profile-${Date.now()}.md`);
  writeFileSync(tmpFile, currentMarkdown, "utf-8");

  try {
    const exitCode = await (editorSpawn ?? defaultSpawn)(tmpFile);
    if (exitCode !== 0) {
      console.error(`Editor exited with code ${exitCode}. Profile not updated.`);
      process.exit(1);
    }

    const edited = readFileSync(tmpFile, "utf-8").trim();
    if (!edited) {
      console.log("Empty content, profile not updated.");
      return;
    }

    if (edited === currentMarkdown.trim()) {
      console.log("No changes made.");
      return;
    }

    const putRes = await client.fetch("/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: edited }),
    });

    if (!putRes.ok) {
      const text = await putRes.text();
      console.error(`Error updating profile: ${text}`);
      process.exit(1);
    }

    console.log("Profile updated.");
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch {
      // Best effort cleanup
    }
  }
}

function buildProfileMarkdown(profile: ProfileResponse): string {
  const lines: string[] = [
    "---",
    "version: 1",
    `updatedAt: ${profile.updatedAt}`,
    "---",
    "",
    "# Writing Style Profile",
    "",
  ];

  const byDimension = new Map<ObservationDimension, typeof profile.rules>();
  for (const rule of profile.rules) {
    const existing = byDimension.get(rule.dimension) ?? [];
    existing.push(rule);
    byDimension.set(rule.dimension, existing);
  }

  if (byDimension.size === 0) {
    lines.push("*No patterns confirmed yet.*");
    lines.push("");
  }

  for (const [dimension, rules] of byDimension) {
    const label = DIMENSION_LABELS[dimension];
    lines.push(`## ${label}`);
    lines.push("");
    for (const rule of rules) {
      lines.push(`- **${rule.pattern}**`);
      lines.push(`  *${rule.sourceSummary}* <!-- id:${rule.id} -->`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

async function defaultSpawn(file: string): Promise<number> {
  const editor = process.env.EDITOR!;
  const proc = Bun.spawn([editor, file], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  return proc.exited;
}
