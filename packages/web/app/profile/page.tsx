import { daemonJson } from "@/lib/daemon";
import { ProfileEditor } from "@/components/profile-editor";
import type { Profile, Pattern, PatternCurationSession } from "@ink-mirror/shared";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  let profile: Profile & { markdown: string };
  try {
    profile = await daemonJson<Profile & { markdown: string }>("/profile");
  } catch {
    return (
      <div className="im-page">
        <div className="im-error">Failed to load your hand. Is the daemon running?</div>
      </div>
    );
  }

  // Health state and dossier links (REQ-LPC-18/19/20/21) need the rule-health
  // check and the pattern ledger. Both are non-fatal: if either fetch fails
  // (or the daemon is on an older build without them), the profile itself
  // still rendered above, so we degrade to "no health/dossier info" rather
  // than failing the whole page.
  let resurfacedRules: PatternCurationSession["resurfacedRules"] = [];
  let patterns: Pattern[] = [];
  try {
    const session = await daemonJson<PatternCurationSession>("/patterns/session");
    resurfacedRules = session.resurfacedRules;
  } catch {
    // Non-fatal: rules just render without a health badge.
  }
  try {
    patterns = await daemonJson<Pattern[]>("/patterns");
  } catch {
    // Non-fatal: rules just render without dossier links / migrated state.
  }

  return (
    <div className="im-page">
      <ProfileEditor initialProfile={profile} resurfacedRules={resurfacedRules} patterns={patterns} />
    </div>
  );
}
