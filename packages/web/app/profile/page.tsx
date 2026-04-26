import { daemonJson } from "@/lib/daemon";
import { ProfileEditor } from "@/components/profile-editor";
import type { Profile } from "@ink-mirror/shared";

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

  return (
    <div className="im-page">
      <ProfileEditor initialProfile={profile} />
    </div>
  );
}
