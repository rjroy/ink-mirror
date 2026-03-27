import { daemonJson } from "@/lib/daemon";
import { ProfileEditor } from "@/components/profile-editor";
export const dynamic = "force-dynamic";
export default async function ProfilePage() {
    let profile;
    try {
        profile = await daemonJson("/profile");
    }
    catch {
        return <div style={{ color: "#c00" }}>Failed to load profile. Is the daemon running?</div>;
    }
    return (<div>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>Profile</h1>
      <ProfileEditor initialProfile={profile}/>
    </div>);
}
