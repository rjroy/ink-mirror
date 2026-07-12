import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFileSync, readFileSync, unlinkSync } from "node:fs";
import {
  type ObservationDimension,
  DIMENSION_LABELS,
  type Dossier,
  type PatternCurationSession,
  type ResurfacedRuleReason,
} from "@ink-mirror/shared";
import type { DaemonClient } from "./client.js";

interface ProfileRuleResponse {
  id: string;
  pattern: string;
  dimension: ObservationDimension;
  sourceCount: number;
  sourceSummary: string;
  /** Links to the pattern this rule was created from (REQ-LPC-18). Optional for legacy rules predating linkage. */
  patternId?: string;
  /** How this rule entered the profile (REQ-LPC-16). */
  provenance?: "writer-asserted" | "evidence-confirmed";
  baseline?: number;
  lastSupportedAt?: string;
}

interface ProfileResponse {
  version: number;
  updatedAt: string;
  rules: ProfileRuleResponse[];
  markdown: string;
}

/** "fine" / "stale" / "drifting" / "stale, drifting" — from resurfaced-rule health data (REQ-LPC-19/20/21), never computed here. */
function formatHealth(reasons: ResurfacedRuleReason[] | undefined): string {
  if (!reasons || reasons.length === 0) return "fine";
  return reasons.join(", ");
}

/**
 * Answers "why does it say this?" for a rule (REQ-LPC-18): fetches the
 * linked pattern's dossier and cites its canonical statement, sighting
 * count, and (when available) one evidence quote. Migrated rules show the
 * explicit no-history state instead of implying evidence that isn't there
 * (REQ-LPC-18 exception, REQ-LPC-27).
 */
async function formatRuleDossierSummary(client: DaemonClient, patternId: string): Promise<string> {
  try {
    const dossier = await client.fetchJson<Dossier>(`/patterns/${patternId}`);
    if (dossier.pattern.migratedNoHistory) {
      return `Why: "${dossier.pattern.statement}" — migrated, no historical sightings recorded.`;
    }
    const entryWord = dossier.distinctEntryCount === 1 ? "entry" : "entries";
    const sightingWord = dossier.sightings.length === 1 ? "sighting" : "sightings";
    const citation = dossier.sightings[0] ? ` e.g. "${dossier.sightings[0].evidence}"` : "";
    return `Why: "${dossier.pattern.statement}" — ${dossier.sightings.length} ${sightingWord} across ${dossier.distinctEntryCount} ${entryWord}.${citation}`;
  } catch {
    return "Why: dossier unavailable.";
  }
}

/**
 * Display the current writing style profile.
 * `ink-mirror profile`
 *
 * Each rule shows its provenance (writer-asserted vs evidence-confirmed,
 * REQ-LPC-16), its health state (fine/stale/drifting, from the curation
 * session's resurfaced-rule data, REQ-LPC-19/20/21), and a line reaching
 * back to its pattern's dossier (REQ-LPC-18).
 */
export async function showProfile(client: DaemonClient): Promise<void> {
  const profile = await client.fetchJson<ProfileResponse>("/profile");

  if (profile.rules.length === 0) {
    console.log("No patterns confirmed yet.");
    console.log("Write entries and curate patterns to build your profile.");
    return;
  }

  // Rule health only exists as session-computed state (REQ-LPC-19/20/21):
  // there is no dedicated health endpoint, so the curation session is the
  // one place this data lives.
  const healthByRuleId = new Map<string, ResurfacedRuleReason[]>();
  try {
    const session = await client.fetchJson<PatternCurationSession>("/patterns/session");
    for (const resurfaced of session.resurfacedRules) {
      healthByRuleId.set(resurfaced.rule.id, resurfaced.reasons);
    }
  } catch {
    // Health is a nice-to-have annotation; a session-fetch failure still
    // lets the rest of the profile display.
  }

  // Group by dimension
  const byDimension = new Map<ObservationDimension, ProfileRuleResponse[]>();
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
      const provenanceLabel = rule.provenance ?? "unspecified";
      const healthLabel = formatHealth(healthByRuleId.get(rule.id));
      console.log(`  ${rule.pattern}  [${provenanceLabel}, ${healthLabel}]`);
      console.log(`    ${rule.sourceSummary} [${rule.id}]`);
      if (rule.patternId) {
        console.log(`    ${await formatRuleDossierSummary(client, rule.patternId)}`);
      }
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
