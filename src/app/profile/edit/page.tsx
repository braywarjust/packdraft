import { requireUser } from "@/lib/auth";
import { MAX_FEATURED, getProfile, nbaTeams } from "@/lib/profile";
import { PageHeader } from "@/components/PageHeader";
import { ProfileEditor } from "./ProfileEditor";

export const metadata = { title: "Edit profile" };

export default async function EditProfile() {
  const u = await requireUser();
  const p = getProfile(u.id)!;
  return (
    <div>
      <PageHeader eyebrow="Your profile" title="Edit profile" description="Everything here is optional. Changes show in the live preview before you save." />
      <ProfileEditor initial={p} nba={nbaTeams().map((t) => ({ abbr: t.abbr, name: t.name, color: `#${t.color ?? "1f2937"}`, alt: `#${t.alt ?? "111827"}` }))} maxFeatured={MAX_FEATURED} />
    </div>
  );
}
