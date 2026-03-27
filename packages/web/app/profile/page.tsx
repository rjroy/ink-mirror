import { daemonJson } from "@/lib/daemon";
import { ProfileEditor } from "@/components/profile-editor";
import type { Profile } from "@ink-mirror/shared";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  let profile: Profile & { markdown: string };
  try {
    profile = await daemonJson<Profile & { markdown: string }>("/profile");
  } catch {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Failed to load profile. Is the daemon running?</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>Profile</h1>
      <ProfileEditor initialProfile={profile} />
    </div>
  );
}
