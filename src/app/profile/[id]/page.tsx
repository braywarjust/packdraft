import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/profile";
import { ProfileView } from "@/components/ProfileView";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const p = getProfile(Number((await params).id));
  return { title: p ? p.user.name : "Profile" };
}

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const p = getProfile(Number((await params).id));
  if (!p) notFound();
  return <ProfileView d={p} editHref={p.user.id === me.id ? "/profile/edit" : undefined} />;
}
